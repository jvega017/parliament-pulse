// WK-02 abuse and availability hardening: /rss exact-URL allowlist, fail-open
// rate limiter, capped single-query analytics.
//
// Run: node --experimental-strip-types tests/hardening.test.mjs
//
// Measured to fail when the controls are removed (scratch clone):
//  - re-adding "www.youtube.com" to allowedHosts in jurisdictions.json fails
//    "config: youtube is not an allowed host" and
//    "rss: redirect to youtube is refused";
//  - removing the try/catch in checkRateLimit fails
//    "limiter: KV get that throws fails open" and
//    "state: KV that throws on rate-limit keys still returns 200".

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const { default: worker } = await import("../src/index.ts");
const { checkRateLimit } = await import("../src/rateLimit.ts");
const { APH_ALLOWED_HOSTS, APH_FEEDS } = await import("../src/feeds.ts");
const { RSS_MAX_BYTES } = await import("../src/rssProxy.ts");

const FEED = "https://www.aph.gov.au/senate/rss/reports";
const XML = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`;

// Silence the fail-open warnings the tests deliberately provoke.
console.warn = () => {};
console.error = () => {};

function mockKv({ getThrows = null, putThrows = false, putRejects = false, seed = {} } = {}) {
  const store = new Map(Object.entries(seed));
  const puts = [];
  return {
    store,
    puts,
    async get(key) {
      if (getThrows && getThrows(key)) throw new Error("kv get down");
      return store.has(key) ? store.get(key) : null;
    },
    put(key, value) {
      if (putThrows) throw new Error("kv put down");
      if (putRejects) return Promise.reject(new Error("kv put rejected"));
      puts.push(key);
      store.set(key, value);
      return Promise.resolve();
    },
  };
}

function mockD1(firstResult = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const call = { sql, binds: [] };
      calls.push(call);
      const stmt = {
        bind(...b) { call.binds = b; return stmt; },
        async first() { return firstResult; },
        async all() { return { results: [] }; },
        async run() { return { success: true }; },
      };
      return stmt;
    },
  };
}

function mockCtx() {
  const pending = [];
  return { pending, waitUntil(p) { pending.push(p); }, passThroughOnException() {} };
}

function env(overrides = {}) {
  return { ALLOWED_ORIGINS: "", CACHE: mockKv(), ARCHIVE: mockD1(), ...overrides };
}

async function call(path, e = env(), ctx = mockCtx()) {
  const res = await worker.fetch(new Request(`https://worker.test${path}`), e, ctx);
  await Promise.allSettled(ctx.pending);
  return res;
}

function rss(u) {
  return `/rss?u=${encodeURIComponent(u)}`;
}

let fetchCalls = [];
function stubFetch(handler) {
  fetchCalls = [];
  globalThis.fetch = async (url, init) => {
    fetchCalls.push(String(url));
    return handler(String(url), init);
  };
}

function xmlResponse(body = XML, headers = {}) {
  return new Response(body, { status: 200, headers: { "content-type": "application/rss+xml", ...headers } });
}

// ---------------------------------------------------------------- config

test("config: youtube is not an allowed host", () => {
  assert.ok(!APH_ALLOWED_HOSTS.includes("www.youtube.com"), "www.youtube.com must not be in allowedHosts");
  assert.ok(!APH_ALLOWED_HOSTS.some((h) => h.includes("youtube")));
});

// ---------------------------------------------------------------- /rss

test("rss: configured feed is served (200) and cached under a query-free key", async () => {
  stubFetch(() => xmlResponse());
  const e = env();
  const res = await call(rss(FEED), e);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), XML);
  assert.ok(e.CACHE.store.has(`rss:${FEED}`), [...e.CACHE.store.keys()].join(","));
});

test("rss: every configured feed URL is accepted by the allowlist", async () => {
  stubFetch(() => xmlResponse());
  for (const f of APH_FEEDS) {
    const res = await call(rss(f.url));
    assert.equal(res.status, 200, f.url);
  }
});

test("rss: disallowed path on an allowed host returns 403 without fetching", async () => {
  stubFetch(() => xmlResponse());
  const res = await call(rss("https://www.aph.gov.au/robots.txt"));
  assert.equal(res.status, 403);
  assert.equal(fetchCalls.length, 0);
});

test("rss: youtube URL returns 403", async () => {
  stubFetch(() => xmlResponse());
  const res = await call(rss("https://www.youtube.com/robots.txt"));
  assert.equal(res.status, 403);
  assert.equal(fetchCalls.length, 0);
});

test("rss: configured feed plus a cache-busting query returns 403", async () => {
  stubFetch(() => xmlResponse());
  const res = await call(rss(`${FEED}?bust=1`));
  assert.equal(res.status, 403);
  assert.equal(fetchCalls.length, 0);
});

test("rss: redirect off the allowlist is refused", async () => {
  stubFetch((url) => url === FEED
    ? new Response(null, { status: 302, headers: { Location: "https://evil.example/feed.xml" } })
    : xmlResponse());
  const res = await call(rss(FEED));
  assert.equal(res.status, 502);
  assert.deepEqual(fetchCalls, [FEED]);
});

test("rss: redirect to youtube is refused", async () => {
  stubFetch((url) => url === FEED
    ? new Response(null, { status: 301, headers: { Location: "https://www.youtube.com/feeds/videos.xml" } })
    : xmlResponse());
  const res = await call(rss(FEED));
  assert.equal(res.status, 502);
  assert.deepEqual(fetchCalls, [FEED]);
});

test("rss: redirect within APH hosts is still followed", async () => {
  const next = "https://aph.gov.au/senate/rss/reports";
  stubFetch((url) => url === FEED
    ? new Response(null, { status: 302, headers: { Location: next } })
    : xmlResponse());
  const res = await call(rss(FEED));
  assert.equal(res.status, 200);
  assert.deepEqual(fetchCalls, [FEED, next]);
});

test("rss: oversize streamed body (no content-length) returns 413", async () => {
  const chunk = new Uint8Array(256 * 1024).fill(0x61);
  const chunks = Math.ceil(RSS_MAX_BYTES / chunk.byteLength) + 1;
  stubFetch(() => {
    let sent = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (sent >= chunks) { controller.close(); return; }
        sent += 1;
        controller.enqueue(chunk);
      },
    });
    return new Response(stream, { status: 200, headers: { "content-type": "application/xml" } });
  });
  const e = env();
  const res = await call(rss(FEED), e);
  assert.equal(res.status, 413);
  assert.equal(e.CACHE.store.has(`rss:${FEED}`), false, "oversize body must not be cached");
});

test("rss: declared content-length over the cap returns 413", async () => {
  stubFetch(() => xmlResponse(XML, { "content-length": String(RSS_MAX_BYTES + 1) }));
  const res = await call(rss(FEED));
  assert.equal(res.status, 413);
});

test("rss: non-XML content-type returns 502 with a generic message", async () => {
  stubFetch(() => new Response("<html>login</html>", { status: 200, headers: { "content-type": "text/html" } }));
  const res = await call(rss(FEED));
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.error, "upstream returned an unexpected response");
});

test("rss: rate limited after 60 requests per minute", async () => {
  stubFetch(() => xmlResponse());
  const e = env();
  let last;
  for (let i = 0; i < 61; i++) last = await call(rss(FEED), e);
  assert.equal(last.status, 429);
});

// ---------------------------------------------------------------- limiter

test("limiter: KV get that throws fails open", async () => {
  const kv = mockKv({ getThrows: () => true });
  assert.equal(await checkRateLimit(kv, "1.2.3.4", "x", 1, 60, mockCtx()), true);
});

test("limiter: KV put that throws synchronously fails open", async () => {
  const kv = mockKv({ putThrows: true });
  assert.equal(await checkRateLimit(kv, "1.2.3.4", "x", 1, 60, mockCtx()), true);
});

test("limiter: KV put runs in waitUntil, off the request path", async () => {
  const kv = mockKv();
  const ctx = mockCtx();
  assert.equal(await checkRateLimit(kv, "1.2.3.4", "x", 5, 60, ctx), true);
  assert.equal(ctx.pending.length, 1);
  await Promise.all(ctx.pending);
  assert.equal(kv.puts.length, 1);
});

test("state: KV put that throws still returns 200", async () => {
  for (const kvOpts of [{ putThrows: true }, { putRejects: true }]) {
    const kv = mockKv({ ...kvOpts, seed: { "state:v2": JSON.stringify({ ok: true }) } });
    const res = await call("/state", env({ CACHE: kv }));
    assert.equal(res.status, 200, JSON.stringify(kvOpts));
  }
});

test("state: KV that throws on rate-limit keys still returns 200", async () => {
  const kv = mockKv({ getThrows: (k) => k.startsWith("rl:"), seed: { "state:v2": JSON.stringify({ ok: true }) } });
  const res = await call("/state", env({ CACHE: kv }));
  assert.equal(res.status, 200);
});

// ---------------------------------------------------------------- analytics

test("analytics: 11 terms return 400 and run no query", async () => {
  const d1 = mockD1();
  const terms = Array.from({ length: 11 }, (_, i) => `term${i}`).join(",");
  const res = await call(`/archive/analytics?terms=${terms}`, env({ ARCHIVE: d1 }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /at most 10/);
  assert.equal(d1.calls.length, 0);
});

test("analytics: 10 terms run exactly one D1 query with escaped LIKE", async () => {
  const first = {};
  for (let i = 0; i < 10; i++) { first[`n${i}`] = i; first[`l${i}`] = i ? `2026-09-0${i}` : null; }
  const d1 = mockD1(first);
  const terms = Array.from({ length: 10 }, (_, i) => `t${i}`).join(",");
  const res = await call(`/archive/analytics?terms=${terms},100%_&from=2026-01-01`, env({ ARCHIVE: d1 }));
  // 11 unique terms including the wildcard one: rejected.
  assert.equal(res.status, 400);

  const d1b = mockD1(first);
  const res2 = await call(`/archive/analytics?terms=${terms}&from=2026-01-01`, env({ ARCHIVE: d1b }));
  assert.equal(res2.status, 200);
  assert.equal(d1b.calls.length, 1);
  const { sql, binds } = d1b.calls[0];
  assert.equal((sql.match(/SUM\(CASE WHEN LOWER\(title\) LIKE \? ESCAPE '\\' THEN 1 ELSE 0 END\)/g) ?? []).length, 10, sql);
  assert.equal(binds.length, 21);
  assert.equal(binds[20], "2026-01-01");
  const body = await res2.json();
  assert.equal(body.series.length, 10);
  assert.deepEqual(body.series[3], { term: "t3", count: 3, last_seen: "2026-09-03" });
  assert.deepEqual(body.series[0], { term: "t0", count: 0, last_seen: null });
});

test("analytics: LIKE wildcards in a term are escaped", async () => {
  const d1 = mockD1({ n0: 0, l0: null });
  const res = await call(`/archive/analytics?terms=${encodeURIComponent("100%_ok")}`, env({ ARCHIVE: d1 }));
  assert.equal(res.status, 200);
  assert.equal(d1.calls[0].binds[0], "%100\\%\\_ok%");
});

// ================================================================ WK-06
// Security tail: SEC-07, SEC-08, SEC-11, SEC-14, SEC-16, LEG-11.
// Each test below was measured to fail on a scratch copy carrying the old
// code (29 Sep 2026); the per-test mutation record is in the WK-06 commit.

const { readFileSync } = await import("node:fs");
const { fileURLToPath } = await import("node:url");
const { timingSafeEqualStr, adminAuthorised } = await import("../src/adminAuth.ts");
const { sendDailyDigest, DIGEST_SUBSCRIBE_ENABLED } = await import("../src/digest.ts");
const { buildState } = await import("../src/state.ts");
const { sqliteD1, memoryKv } = await import("./support/sqlite-d1.mjs");

const srcText = (rel) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), "utf8");

const ADMIN = "s3cret-admin-token-0123456789";

async function post(path, headers, e) {
  const ctx = mockCtx();
  const res = await worker.fetch(new Request(`https://worker.test${path}`, { method: "POST", headers }), e, ctx);
  await Promise.allSettled(ctx.pending);
  return res;
}

// A D1 stand-in whose every prepare() throws a marker message.
function throwingD1(marker) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      calls.push(sql);
      throw new Error(`${marker} near "SELECT": syntax error in ${sql.slice(0, 20)}`);
    },
  };
}

// ---------------------------------------------------------------- (a) admin compare

test("WK-06 (a) timingSafeEqualStr: equal, different, prefix, suffix, empty", async () => {
  assert.equal(await timingSafeEqualStr(ADMIN, ADMIN), true);
  assert.equal(await timingSafeEqualStr("wrong", ADMIN), false);
  assert.equal(await timingSafeEqualStr(ADMIN.slice(0, 10), ADMIN), false, "correct prefix");
  assert.equal(await timingSafeEqualStr(`${ADMIN}x`, ADMIN), false, "correct token plus a suffix");
  assert.equal(await timingSafeEqualStr("", ADMIN), false);
});

test("WK-06 (a) adminAuthorised fails closed when ADMIN_TOKEN is unset or empty", async () => {
  assert.equal(await adminAuthorised("", undefined), false);
  assert.equal(await adminAuthorised("", ""), false);
  assert.equal(await adminAuthorised(null, ""), false);
  assert.equal(await adminAuthorised("anything", undefined), false);
});

test("WK-06 (a) admin endpoints reject wrong and correct-prefix tokens, accept the right one", async () => {
  stubFetch(() => new Response("", { status: 503 }));
  for (const path of ["/admin/poll-now", "/admin/backfill-threads"]) {
    const e = env({ ADMIN_TOKEN: ADMIN });
    assert.equal((await post(path, {}, e)).status, 401, `${path} no header`);
    assert.equal((await post(path, { "x-admin-token": "wrong" }, e)).status, 401, `${path} wrong`);
    assert.equal((await post(path, { "x-admin-token": ADMIN.slice(0, -1) }, e)).status, 401, `${path} prefix`);
    assert.equal((await post(path, { "x-admin-token": ADMIN }, env())).status, 401, `${path} unset ADMIN_TOKEN`);
    assert.equal((await post(path, { "x-admin-token": ADMIN }, e)).status, 200, `${path} right token`);
  }
});

test("WK-06 (a) no direct !== compare against ADMIN_TOKEN remains in index.ts", () => {
  const src = srcText("src/index.ts");
  assert.ok(!/!==\s*env\.ADMIN_TOKEN/.test(src), "direct string compare found");
  assert.ok(!/env\.ADMIN_TOKEN\s*!==/.test(src), "direct string compare found");
});

// ---------------------------------------------------------------- (b) error leakage

test("WK-06 (b) poll-now: a thrown message never reaches the 503 body", async () => {
  stubFetch(() => new Response("", { status: 503 }));
  const e = env({ ADMIN_TOKEN: ADMIN });
  // One-shot throw from the first toISOString() inside pollAndArchive, which
  // sits outside every internal try, so it reaches the handler's catch.
  const orig = Date.prototype.toISOString;
  let armed = true;
  Date.prototype.toISOString = function () {
    if (armed) { armed = false; throw new Error("SECRET-THROWN-7f3a stack at pollAndArchive"); }
    return orig.call(this);
  };
  let res;
  try {
    res = await post("/admin/poll-now", { "x-admin-token": ADMIN }, e);
  } finally {
    Date.prototype.toISOString = orig;
  }
  assert.equal(res.status, 503);
  const text = await res.text();
  assert.ok(!text.includes("SECRET-THROWN-7f3a"), text);
  assert.deepEqual(JSON.parse(text), { error: "poll failed" });
});

test("WK-06 (b) poll-now: fetch and D1 messages never reach the per-feed results", async () => {
  // Fetch throws for every feed.
  stubFetch(() => { throw new Error("SECRET-FETCH-91c getaddrinfo ENOTFOUND internal.host"); });
  let res = await post("/admin/poll-now", { "x-admin-token": ADMIN }, env({ ADMIN_TOKEN: ADMIN }));
  let text = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!text.includes("SECRET-FETCH-91c"), text.slice(0, 300));
  assert.ok(JSON.parse(text).perFeed.every((f) => f.error === "fetch failed"), text.slice(0, 300));

  // Fetch succeeds, every D1 statement throws inside per-feed processing.
  const item = `<item><title>A real title</title><link>https://www.aph.gov.au/x</link><guid>g-1</guid></item>`;
  stubFetch(() => xmlResponse(`<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${item}</channel></rss>`));
  res = await post("/admin/poll-now", { "x-admin-token": ADMIN }, env({ ADMIN_TOKEN: ADMIN, ARCHIVE: throwingD1("SECRET-D1-44b") }));
  text = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!text.includes("SECRET-D1-44b"), text.slice(0, 300));
});

test("WK-06 (b) /state and /healthz/connectors never serve a D1 message", async () => {
  const state = await buildState(env({ ARCHIVE: throwingD1("SECRET-STATE-5d0") }));
  const s = JSON.stringify(state);
  assert.ok(!s.includes("SECRET-STATE-5d0"), s.slice(0, 400));
  assert.equal(state.blocks.signals.note, "query failed");

  const res = await call("/healthz/connectors", env({ ARCHIVE: throwingD1("SECRET-HC-2e1") }));
  const text = await res.text();
  assert.ok(!text.includes("SECRET-HC-2e1"), text);
});

test("WK-06 (b) source: no jsonResponse body carries err.message or detail: msg", () => {
  const src = srcText("src/index.ts");
  const bad = src.split("\n").filter((l) => l.includes("jsonResponse(") && /\.message|detail:\s*msg/.test(l));
  assert.deepEqual(bad, []);
  assert.ok(!/detail:\s*msg/.test(src));
});

// ---------------------------------------------------------------- (c) LIKE escape

test("WK-06 (c) watchlist-trend: a term containing % matches literally", async () => {
  const d1 = sqliteD1();
  const at = new Date(Date.now() - 3_600_000).toISOString();
  const ins = d1.raw.prepare(
    `INSERT INTO signals (guid, title, link, pub_date, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at)
     VALUES (?, ?, 'https://www.aph.gov.au/x', ?, 'https://f', 'Senate reports tabled', 'Senate', 'report', ?, ?)`,
  );
  ins.run("g-pct", "Target of 50% by 2030", at, at, at);
  ins.run("g-500", "Target of 500 by 2030", at, at, at);
  ins.run("g-50x", "Target of 50x growth", at, at, at);
  const res = await call(`/archive/watchlist-trend?terms=${encodeURIComponent("50%")}`, env({ ARCHIVE: d1, CACHE: memoryKv() }));
  assert.equal(res.status, 200);
  const { days } = await res.json();
  assert.equal(days.length, 7);
  assert.equal(days.reduce((n, d) => n + d.count, 0), 1, JSON.stringify(days));
});

test("WK-06 (c) source: every LIKE ? on user input carries ESCAPE", () => {
  const src = srcText("src/archive.ts");
  const likes = src.match(/LIKE \?[^`"\n]{0,20}/g) ?? [];
  assert.ok(likes.length >= 8, `found ${likes.length}`);
  for (const l of likes) assert.match(l, /^LIKE \? ESCAPE/, l);
});

// ---------------------------------------------------------------- (d)(e) dormant digest

test("WK-06 (d) digest cron performs zero D1 queries while disabled", async () => {
  assert.equal(DIGEST_SUBSCRIBE_ENABLED, false);
  const d1 = mockD1();
  stubFetch(() => new Response("{}", { status: 200 }));
  const r = await sendDailyDigest({ ARCHIVE: d1, CACHE: mockKv(), ALLOWED_ORIGINS: "", RESEND_API_KEY: "re_test_key" });
  assert.deepEqual(r, { sent: 0, skipped: "digest_disabled" });
  assert.equal(d1.calls.length, 0, d1.calls.map((c) => c.sql).join(" | "));
  assert.equal(fetchCalls.length, 0);
});

test("WK-06 (d) /digest/subscribe stays closed and writes nothing", async () => {
  const d1 = mockD1();
  const res = await post("/digest/subscribe", { "content-type": "application/json" }, env({ ARCHIVE: d1 }));
  assert.equal(res.status, 403);
  assert.equal(d1.calls.length, 0);
});

test("WK-06 (e) digest.ts logs no email address", () => {
  const src = srcText("src/digest.ts");
  assert.ok(!src.includes("email: sub.email"));
  const consoleCalls = src.match(/console\.[a-z]+\([^;]*\);/g) ?? [];
  for (const c of consoleCalls) assert.ok(!/email/i.test(c), c);
});

// ---------------------------------------------------------------- (f) CORS config

test("WK-06 (f) production vars carry exactly the two https origins, no localhost", () => {
  const toml = srcText("wrangler.toml");
  const start = toml.indexOf("\n[vars]\n");
  assert.ok(start >= 0, "top-level [vars] present");
  const body = toml.slice(start + "\n[vars]\n".length);
  const next = body.search(/^\[/m);
  const vars = next < 0 ? body : body.slice(0, next);
  const live = vars.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
  assert.ok(!/localhost|127\.0\.0\.1/.test(live), live);
  const m = live.match(/^ALLOWED_ORIGINS\s*=\s*"([^"]*)"/m);
  assert.ok(m, "ALLOWED_ORIGINS set");
  assert.deepEqual(m[1].split(","), ["https://parliament-pulse.pages.dev", "https://pulse.prometheuspolicylab.com"]);
  // Dev origins still exist, in the dev environment only.
  assert.match(toml, /\[env\.dev\.vars\][\s\S]*ALLOWED_ORIGINS\s*=\s*"[^"]*localhost:5173/);
});
