// Pure decision logic for the deploy-integrity half of tests/production-probe.mjs.
// Kept free of network and filesystem calls so tests/deploy-integrity.test.mjs can
// drive it with mocked responses (canary and restraint specimens) and prove the
// verdict function itself detects, rather than a copy of it.

import crypto from "node:crypto";

// Pages answers a bare scripted user-agent with HTTP 403, which would turn every
// check into a false "not exposed". Every probe request sends a browser UA.
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Paths that must never be served. `local` is the repo file whose bytes a leak
// would carry (null where the path has no single local counterpart). The five
// internal files moved to docs/internal/ in FE-08 (ARCH-17); their root paths stay
// denylisted because an older deploy served them there.
export const DENYLIST = [
  { path: "/README.md", local: "README.md" },
  { path: "/app-tracker.md", local: "app-tracker.md" },
  { path: "/REVIEW-BACKLOG-2026-05-31.md", local: "docs/internal/REVIEW-BACKLOG-2026-05-31.md" },
  { path: "/REMEDIATION-PLAN.md", local: "docs/internal/REMEDIATION-PLAN.md" },
  { path: "/CODEX-TASKS.md", local: "docs/internal/CODEX-TASKS.md" },
  { path: "/docs/licence-architecture.md", local: "docs/licence-architecture.md" },
  { path: "/pages.jsx", local: null },
  { path: "/pages-today.jsx", local: "pages-today.jsx" },
  { path: "/store.jsx", local: "store.jsx" },
  { path: "/data.jsx", local: "data.jsx" },
  { path: "/build.py", local: "docs/internal/build.py" },
  { path: "/verify.ps1", local: "verify.ps1" },
  { path: "/cf-list.ps1", local: "cf-list.ps1" },
  { path: "/proxy-server.js", local: "proxy-server.js" },
  { path: "/tests/release-gate.mjs", local: "tests/release-gate.mjs" },
  { path: "/design-elevation-spec.json", local: "docs/internal/design-elevation-spec.json" },
  { path: "/.gitignore", local: ".gitignore" },
  { path: "/docs/internal/REMEDIATION-PLAN.md", local: "docs/internal/REMEDIATION-PLAN.md" },
  { path: "/parliament-pulse-beta", local: "archive/parliament-pulse-beta-2026-06-01.html" },
  { path: "/parliament-pulse-updated", local: "archive/parliament-pulse-updated-2026-06-01.html" },
  { path: "/parliament-pulse", local: "archive/parliament-pulse.html" },
  { path: "/archive/parliament-pulse-beta.html", local: "archive/parliament-pulse-beta.html" },
];

// The scripts to scan for fabrications (FE-11): index.html plus every app
// script under the content-hashed name the local build gave it, taken from
// dist/build-info.json's js_map. The expected hashes therefore come from the
// build, never from a hand-kept list. Throws when the manifest has no js_map:
// a probe that silently fell back to plain names would fetch 404s or stale
// files and could not prove what it scanned.
export function shippedUrls(localInfo, appScripts) {
  const map = localInfo && localInfo.js_map;
  if (!map || typeof map !== "object") throw new Error("build-info.json has no js_map; rebuild dist with ./build-dist.ps1");
  const missing = appScripts.filter(f => typeof map[f] !== "string" || !/^[\w-]+\.[0-9a-f]{8}\.js$/.test(map[f]));
  if (missing.length) throw new Error(`build-info.json js_map has no hashed name for ${missing.join(", ")}`);
  return ["index.html", ...appScripts.map(f => map[f])];
}

// Files build-info.json lists that Pages consumes instead of serving.
export const NOT_SERVED = new Set(["_headers"]);

export const sha256 = buf => crypto.createHash("sha256").update(buf).digest("hex");

const norm = buf => Buffer.from(buf).toString("utf8").replace(/\r\n/g, "\n").trim();

// Verdict for one denylisted path.
//   response: { status, body: Buffer }
//   localBody: Buffer of the repo file, or null if absent locally
//   fallbackBodies: Buffers Pages returns for a path it does not have (the
//     deployed "/" when no 404.html exists, or the deployed 404 page)
// A path is EXPOSED when it answers 2xx and the body is either the local file's
// content, or anything other than the known not-found fallback. The second arm is
// stricter than byte equality on purpose: a deployed copy that differs from the
// local file (an older bundle, a CRLF-normalised README) is still a leak.
export function classifyDenied(response, localBody, fallbackBodies = []) {
  if (!response || response.status === 404 || response.status === 410) {
    return { exposed: false, reason: `HTTP ${response ? response.status : "none"}` };
  }
  if (response.status < 200 || response.status >= 300) {
    // 403, 5xx and the like prove nothing either way: fail closed.
    return { exposed: true, reason: `HTTP ${response.status}: unverifiable, treated as exposed` };
  }
  const body = norm(response.body);
  if (localBody && body === norm(localBody)) {
    return { exposed: true, reason: "HTTP 200 serving the local file's exact content" };
  }
  if (fallbackBodies.some(fb => fb && body === norm(fb))) {
    return { exposed: false, reason: "HTTP 200 but only the not-found fallback page" };
  }
  return { exposed: true, reason: "HTTP 200 with content other than the not-found fallback" };
}

// Verdict for deploy provenance: compare the served bytes of every file in the
// local manifest with its recorded hash.
//   localInfo: parsed local dist/build-info.json
//   fetched: Map path -> { status, body: Buffer } | { error }
// Returns a list of drift records; empty means production matches the local build.
export function compareProvenance(localInfo, fetched) {
  const drift = [];
  for (const [file, expected] of Object.entries(localInfo.files || {})) {
    if (NOT_SERVED.has(file)) continue;
    const got = fetched.get(file);
    if (!got || got.error) {
      drift.push({ file, reason: `fetch failed: ${got && got.error ? got.error : "not fetched"}` });
      continue;
    }
    const actual = sha256(got.body);
    if (actual !== expected) {
      drift.push({ file, reason: `HTTP ${got.status}, sha256 ${actual.slice(0, 12)} != local ${expected.slice(0, 12)}` });
    }
  }
  return drift;
}
