// The uptime verdict (scripts/uptime-check.mjs, used by
// .github/workflows/uptime.yml, 7 Oct 2026). fetch is faked; nothing leaves
// the process.
//
// Run: node tests/uptime-check.test.mjs
//
// Each control was reverted on a scratch copy and this file then failed
// (see the commit message): counting a source-blocked feed as down, dropping
// the retry, judging /healthz/deep by its body alone, and a signature that
// changes with every last_ok_at.

import { test } from "node:test";
import assert from "node:assert/strict";
import { judgeDeep, judgePages, runChecks, TARGETS, summaryMarkdown } from "../scripts/uptime-check.mjs";

const job = (o = {}) => ({ last_ok_at: "2026-10-07T00:00:00.000Z", last_outcome: "ok", overdue: false, running_since: null, stuck: false, last_failure: null, ...o });
const deepBody = (o = {}) => ({
  ok: true,
  jobs: { poll: job(), members: job(), connectors: job(), qons: job(), digest: job() },
  feeds_failed: 0,
  feeds_blocked: 0,
  resend_wired: false,
  ...o,
});
const answer = (status, body) => ({ status, text: typeof body === "string" ? body : JSON.stringify(body), error: null });

test("Bills Digests source blocked: /healthz/deep 200 with feeds_blocked 1 is up, noted only", () => {
  const v = judgeDeep(answer(200, deepBody({ feeds_blocked: 1 })));
  assert.equal(v.up, true);
  assert.deepEqual(v.reasons, []);
  assert.ok(v.notes.some((n) => n.includes("source blocked")));
});

test("a failed feed alone is not down either (the Worker's verdict is job-based)", () => {
  assert.equal(judgeDeep(answer(200, deepBody({ feeds_failed: 2 }))).up, true);
});

test("503 with an overdue job is down and names the job", () => {
  const b = deepBody({ ok: false });
  b.jobs.connectors = job({ overdue: true, last_outcome: "error", last_failure: "abandoned", last_ok_at: "2026-10-05T05:01:09.208Z" });
  const v = judgeDeep(answer(503, b));
  assert.equal(v.up, false);
  assert.equal(v.reasons.length, 1);
  assert.match(v.reasons[0], /^job connectors overdue/);
});

test("503 with a stuck poll is down", () => {
  const b = deepBody({ ok: false });
  b.jobs.poll = job({ stuck: true, running_since: "2026-10-07T00:00:00.000Z" });
  assert.match(judgeDeep(answer(503, b)).reasons[0], /^job poll stuck/);
});

test("503 'job run log unavailable', a non-JSON body and no answer are down", () => {
  assert.equal(judgeDeep(answer(503, { ok: false, note: "job run log unavailable" })).up, false);
  assert.equal(judgeDeep(answer(502, "<html>Bad gateway</html>")).up, false);
  assert.equal(judgeDeep({ status: 0, text: "", error: "timed out" }).up, false);
});

test("judged by HTTP status: a 200 is up even if a body field says otherwise (restraint)", () => {
  assert.equal(judgeDeep(answer(200, deepBody({ ok: false }))).up, true);
});

test("pages: 2xx up, 5xx and no answer down", () => {
  assert.equal(judgePages(answer(200, "<html></html>")).up, true);
  assert.equal(judgePages(answer(522, "")).up, false);
  assert.equal(judgePages({ status: 0, text: "", error: "fetch failed" }).up, false);
});

function fakeFetch(plan) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const seq = plan[url];
    const next = seq.length > 1 ? seq.shift() : seq[0];
    if (next === "throw") throw new Error("network down");
    return new Response(typeof next.body === "string" ? next.body : JSON.stringify(next.body), { status: next.status });
  };
  return { impl, calls };
}
const noSleep = async () => {};

test("one failed request is retried; a pass on the retry is up", async () => {
  const f = fakeFetch({
    [TARGETS.deep]: ["throw", { status: 200, body: deepBody() }],
    [TARGETS.pages]: [{ status: 200, body: "<html>" }],
  });
  const v = await runChecks({ fetchImpl: f.impl, retryMs: 0, sleep: noSleep });
  assert.equal(v.down, false);
  assert.equal(f.calls.filter((u) => u === TARGETS.deep).length, 2, "retried once");
  assert.equal(f.calls.filter((u) => u === TARGETS.pages).length, 1, "an up target is not retried (restraint)");
});

test("two failures are down; the signature ignores last_ok_at so a repeat is not a new comment", async () => {
  const mk = (lastOk) => {
    const b = deepBody({ ok: false });
    b.jobs.connectors = job({ overdue: true, last_ok_at: lastOk });
    return { status: 503, body: b };
  };
  const a = await runChecks({ fetchImpl: fakeFetch({ [TARGETS.deep]: [mk("2026-10-05T05:01:09.208Z")], [TARGETS.pages]: [{ status: 200, body: "" }] }).impl, retryMs: 0, sleep: noSleep });
  const b = await runChecks({ fetchImpl: fakeFetch({ [TARGETS.deep]: [mk("2026-10-04T05:01:09.208Z")], [TARGETS.pages]: [{ status: 200, body: "" }] }).impl, retryMs: 0, sleep: noSleep });
  assert.equal(a.down, true);
  assert.equal(a.signature, b.signature);
  const c = await runChecks({ fetchImpl: fakeFetch({ [TARGETS.deep]: [mk("x")], [TARGETS.pages]: [{ status: 500, body: "" }] }).impl, retryMs: 0, sleep: noSleep });
  assert.notEqual(c.signature, a.signature, "a new reason changes the signature");
  assert.match(summaryMarkdown(c), /pages: HTTP 500/);
});
