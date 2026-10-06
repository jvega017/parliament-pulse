#!/usr/bin/env node
// Uptime check for .github/workflows/uptime.yml (7 Oct 2026).
//
//   node workers/aph-proxy/scripts/uptime-check.mjs [--retry-ms 60000]
//
// GETs the Worker's /healthz/deep and the Pages site. A target that fails
// is checked once more after --retry-ms, and only a target that fails both
// times is down, so one dropped request does not open an issue.
//
// What counts as down, for /healthz/deep: no answer, a non-JSON body, or
// HTTP 503 (a job overdue or stuck, or the run log unreadable). Feed
// counts never count: feeds_failed and feeds_blocked (Bills Digests is
// "source blocked" when parlinfo refuses the Worker, 0.16.11) are reported in
// the summary only. The Worker's own verdict is job-based and ignores feeds
// (jobs.ts, 0.16.3), and this check judges by that verdict alone.
//
// For the Pages site: no answer or a non-2xx status.
//
// Prints a JSON verdict; with GITHUB_OUTPUT set, also writes down=<bool>,
// signature=<text> and a multi-line summary for the workflow's issue step.
// Always exits 0 unless the script itself breaks: down is data, not an error.

import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TARGETS = {
  deep: "https://aph-proxy.jvega019.workers.dev/healthz/deep",
  pages: "https://parliament-pulse.pages.dev/",
};
export const TIMEOUT_MS = 15_000;

/** One GET with a deadline. Never throws. */
export async function probe(url, fetchImpl = fetch, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "user-agent": "parliament-pulse-uptime (+https://github.com/jvega017/parliament-pulse)", "cache-control": "no-cache" },
      redirect: "follow",
    });
    const text = await res.text();
    return { status: res.status, text, error: null };
  } catch (err) {
    return { status: 0, text: "", error: controller.signal.aborted ? "timed out" : "fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** The verdict for one /healthz/deep answer. */
export function judgeDeep(p) {
  if (p.error) return { up: false, reasons: [`healthz/deep: ${p.error}`], notes: [] };
  let body = null;
  try { body = JSON.parse(p.text); } catch { body = null; }
  if (!body || typeof body !== "object") return { up: false, reasons: [`healthz/deep: HTTP ${p.status}, body is not JSON`], notes: [] };
  const notes = [];
  if (typeof body.feeds_failed === "number" && body.feeds_failed > 0) notes.push(`feeds_failed ${body.feeds_failed} (not counted as down)`);
  if (typeof body.feeds_blocked === "number" && body.feeds_blocked > 0) notes.push(`feeds_blocked ${body.feeds_blocked}, source blocked (not counted as down)`);
  if (p.status >= 200 && p.status < 300) return { up: true, reasons: [], notes };
  const reasons = [];
  for (const [job, h] of Object.entries(body.jobs ?? {})) {
    if (h?.stuck) reasons.push(`job ${job} stuck since ${h.running_since}`);
    else if (h?.overdue) reasons.push(`job ${job} overdue (last ok ${h.last_ok_at ?? "never"}${h.last_failure ? `, last failure ${h.last_failure}` : ""})`);
  }
  if (reasons.length === 0) reasons.push(`healthz/deep: HTTP ${p.status}${body.note ? `, ${body.note}` : ""}`);
  return { up: false, reasons, notes };
}

/** The verdict for one Pages answer. */
export function judgePages(p) {
  if (p.error) return { up: false, reasons: [`pages: ${p.error}`], notes: [] };
  if (p.status < 200 || p.status >= 300) return { up: false, reasons: [`pages: HTTP ${p.status}`], notes: [] };
  return { up: true, reasons: [], notes: [] };
}

const JUDGES = { deep: judgeDeep, pages: judgePages };

/** Checks every target; a failing one is checked once more after retryMs. */
export async function runChecks({ fetchImpl = fetch, retryMs = 60_000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const results = {};
  for (const [name, url] of Object.entries(TARGETS)) {
    let v = JUDGES[name](await probe(url, fetchImpl));
    if (!v.up) {
      await sleep(retryMs);
      v = JUDGES[name](await probe(url, fetchImpl));
    }
    results[name] = v;
  }
  const reasons = Object.values(results).flatMap((r) => r.reasons);
  const notes = Object.values(results).flatMap((r) => r.notes);
  const down = reasons.length > 0;
  // The signature changes only when the set of reasons does, so the workflow
  // comments on the open issue when what is wrong changes, not every 30 min.
  const signature = down ? reasons.map((r) => r.replace(/\(last ok [^)]*\)/, "").trim()).sort().join(" | ") : "up";
  return { down, reasons, notes, signature, results };
}

export function summaryMarkdown(v, when = new Date()) {
  const lines = [`Checked ${when.toISOString()}.`, ""];
  lines.push(v.down ? "**Down or degraded:**" : "**All targets up.**");
  for (const r of v.reasons) lines.push(`- ${r}`);
  if (v.notes.length) {
    lines.push("", "Reported, not counted:");
    for (const n of v.notes) lines.push(`- ${n}`);
  }
  lines.push("", `Targets: ${Object.values(TARGETS).join(", ")}`);
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--retry-ms");
  const retryMs = i > -1 ? Number(process.argv[i + 1]) : 60_000;
  const v = await runChecks({ retryMs });
  const summary = summaryMarkdown(v);
  console.log(JSON.stringify({ down: v.down, reasons: v.reasons, notes: v.notes, signature: v.signature }));
  if (process.env.GITHUB_OUTPUT) {
    const delim = `EOF_${Date.now()}`;
    appendFileSync(process.env.GITHUB_OUTPUT, `down=${v.down}\nsignature=${v.signature.replace(/\n/g, " ")}\nsummary<<${delim}\n${summary}\n${delim}\n`);
  }
}
