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
