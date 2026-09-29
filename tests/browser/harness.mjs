// Shared browser harness (FE-07; reused by FE-09 and FE-10).
//
// What it does:
//   buildDist()      runs build-dist.ps1 (after a pinned-esbuild rebuild), so a
//                    browser test always exercises the exact allowlisted dist/
//                    that would be deployed, never the working folder.
//   startServer()    serves a dist directory through node:http on
//                    127.0.0.1:8080, with the Content-Security-Policy from
//                    dist/_headers applied, so a CSP regression shows up here.
//   routeFixtures()  intercepts every Worker call the app makes and answers it
//                    from tests/fixtures/: /state, /bills, /rss (and the local
//                    dev proxy the app uses on 127.0.0.1), /alerts. Every other
//                    external request is refused, so runs are deterministic and
//                    offline. A request to YouTube is answered with a blank page
//                    and recorded, so a test can prove none happened.
//   openDesk()       opens one NAV desk at a width and theme, with the browser
//                    clock pinned to the fixture time.
//
// Usage:
//   import { launch, openDesk } from "./harness.mjs";
//   const h = await launch();                 // builds dist, starts server + chromium
//   const page = await h.newPage();
//   await openDesk(page, "sources", { theme: "light", width: 390 });
//   ...
//   await h.close();

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FIXTURES = path.join(root, "tests", "fixtures");
export const PORT = 8080;
export const HOST = "127.0.0.1";
export const WORKER_ORIGIN = "https://aph-proxy.jvega019.workers.dev";

const fixture = name => fs.readFileSync(path.join(FIXTURES, name), "utf8");
const STATE = JSON.parse(fixture("state.json"));
// Browser clock: five minutes after the fixture's poll, so the topbar reads a
// fresh poll on every run regardless of the real date.
export const FIXTURE_CLOCK = Date.parse(STATE.meta.generated_at) + 5 * 60 * 1000;

// ---- build -----------------------------------------------------------------
export function buildDist() {
  const b = spawnSync(process.execPath, [path.join(root, "scripts", "build.mjs")], { cwd: root, stdio: "inherit" });
  if (b.status !== 0) throw new Error(`npm run build failed (exit ${b.status})`);
  const shells = process.platform === "win32" ? ["pwsh", "powershell"] : ["pwsh"];
  for (const sh of shells) {
    const r = spawnSync(sh, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(root, "build-dist.ps1"), "-SkipCompile"], { cwd: root, stdio: "inherit" });
    if (r.error && r.error.code === "ENOENT") continue;
    if (r.status !== 0) throw new Error(`build-dist.ps1 failed (exit ${r.status})`);
    return path.join(root, "dist");
  }
  throw new Error("build-dist.ps1 needs PowerShell (pwsh or powershell) on PATH");
}

// ---- static server -----------------------------------------------------------
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain; charset=utf-8",
};

// The production CSP, read from the `/*` rule of dist/_headers.
export function cspFromHeaders(distDir) {
  const p = path.join(distDir, "_headers");
  if (!fs.existsSync(p)) return null;
  const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
  let inStar = false;
  for (const line of lines) {
    if (/^\S/.test(line)) { inStar = line.trim() === "/*"; continue; }
    const m = inStar && line.match(/^\s+Content-Security-Policy:\s*(.+)$/);
    if (m) return m[1].trim();
  }
  return null;
}

export function startServer(distDir, { port = PORT, host = HOST } = {}) {
  const csp = cspFromHeaders(distDir);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.resolve(distDir, "." + rel);
    const headers = {};
    if (csp) headers["Content-Security-Policy"] = csp;
    if (!file.startsWith(path.resolve(distDir)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      const nf = path.join(distDir, "404.html");
      res.writeHead(404, { ...headers, "Content-Type": "text/html; charset=utf-8" });
      res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : "not found");
      return;
    }
    res.writeHead(200, { ...headers, "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve({
      url: `http://${host}:${port}/`,
      close: () => new Promise(r => server.close(() => r())),
    }));
  });
}

// ---- fixture routing -----------------------------------------------------------
const CORS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

// Installs the routes on a BrowserContext. Returns a log of every intercepted
// request so a test can assert what the page did (for example: no YouTube
// request before the player is loaded).
// stateFile: the /state fixture to serve ("state.json", the current Worker shape,
// or "state-legacy.json", the older shape the deployed Worker still serves).
export async function routeFixtures(context, { stateFile = "state.json" } = {}) {
  const stateBody = fixture(stateFile);
  const log = { worker: [], youtube: [], refused: [] };
  const rss = fixture("rss.xml");
  await context.route("**/*", async route => {
    const req = route.request();
    const u = new URL(req.url());
    const local = u.hostname === "127.0.0.1" || u.hostname === "localhost";
    // Any harness static server (8080, or a canary server on another port) is served for real.
    if (local && u.port !== "3001" && u.protocol === "http:") return route.continue();
    if (u.protocol === "data:" || u.protocol === "blob:") return route.continue();
    const isWorker = u.origin === WORKER_ORIGIN;
    const isDevProxy = (u.hostname === "localhost" || u.hostname === "127.0.0.1") && u.port === "3001";
    if (isWorker || isDevProxy) {
      log.worker.push(`${req.method()} ${u.pathname}`);
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...CORS, "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE" } });
      if (u.pathname === "/state") return route.fulfill({ status: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: stateBody });
      if (u.pathname === "/bills") return route.fulfill({ status: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: fixture("bills.json") });
      if (u.pathname === "/alerts") return route.fulfill({ status: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: fixture("alerts.json") });
      if (u.pathname === "/rss" || u.pathname === "/proxy") {
        const feed = u.searchParams.get("u") || u.searchParams.get("url") || "https://www.aph.gov.au/fixture";
        const esc = feed.replace(/&/g, "&amp;").replace(/</g, "&lt;");
        return route.fulfill({ status: 200, headers: { ...CORS, "Content-Type": "application/xml; charset=utf-8" }, body: rss.replaceAll("{{FEED}}", esc) });
      }
      return route.fulfill({ status: 404, headers: { ...CORS, "Content-Type": "application/json" }, body: '{"error":"not in fixtures"}' });
    }
    if (/(^|\.)youtube(-nocookie)?\.com$|(^|\.)ytimg\.com$|(^|\.)googlevideo\.com$/.test(u.hostname)) {
      log.youtube.push(req.url());
      return route.fulfill({ status: 200, headers: { "Content-Type": "text/html" }, body: "<!doctype html><title>YouTube fixture</title>" });
    }
    log.refused.push(req.url());
    return route.abort("blockedbyclient");
  });
  return log;
}

// ---- desks -----------------------------------------------------------------------
// The NAV list is read from the running app (shell.js's top-level NAV), so the
// harness can never drift from the shipped navigation.
export async function navDesks(page) {
  return page.evaluate(() => NAV.map(n => ({ id: n.id, label: n.label })));
}

// Open one desk. theme: "dark" | "light"; width: CSS px; firstVisit: leave the
// beta notice and the How it works guide in their first-visit state.
export async function openDesk(page, id, { theme = "dark", width = 1280, height = 900, firstVisit = false, baseUrl = `http://${HOST}:${PORT}/` } = {}) {
  await page.setViewportSize({ width, height });
  await page.clock.setFixedTime(FIXTURE_CLOCK);
  await page.goto(baseUrl, { waitUntil: "load" });
  await page.evaluate(({ theme, firstVisit }) => {
    localStorage.clear();
    localStorage.setItem("pp-theme", theme);
    localStorage.setItem("pp-nav-open", "false");
    if (!firstVisit) { localStorage.setItem("pp-beta-ack", "1"); localStorage.setItem("pp-onboarded", "1"); }
  }, { theme, firstVisit });
  await page.reload({ waitUntil: "load" });
  // attached, not visible: the closed phone navigation is visibility:hidden (FE-10, A11Y-03).
  await page.waitForSelector(".nav-item", { state: "attached" });
  if (id !== "overview") {
    const clicked = await page.evaluate(id => {
      const i = NAV.findIndex(n => n.id === id);
      const el = document.querySelectorAll("#main-navigation .nav-item")[i];
      if (i < 0 || !el) return false;
      el.click();
      return true;
    }, id);
    if (!clicked) throw new Error(`openDesk: no NAV desk "${id}"`);
  }
  // Let the /state, /bills and RSS fixtures land and the page settle.
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(250);
  // Let finite entrance animations finish (infinite pulses are skipped), so a
  // screenshot or a bounding box never catches a page mid-transition.
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter(a => { const t = a.effect && a.effect.getComputedTiming(); return t && Number.isFinite(t.endTime); })
    .map(a => a.finished.catch(() => {}))));
  await page.evaluate(() => window.scrollTo(0, 0));
}

// ---- one-call setup ----------------------------------------------------------------
export async function launch({ distDir, build = true, port = PORT } = {}) {
  const { chromium } = await import("playwright");
  const dir = distDir || (build ? buildDist() : path.join(root, "dist"));
  if (!fs.existsSync(path.join(dir, "index.html"))) throw new Error(`no index.html in ${dir}; run build-dist.ps1`);
  const server = await startServer(dir, { port });
  const browser = await chromium.launch();
  const contexts = [];
  return {
    distDir: dir, baseUrl: server.url, browser,
    async newPage({ stateFile } = {}) {
      const context = await browser.newContext({ serviceWorkers: "block" });
      contexts.push(context);
      const log = await routeFixtures(context, { stateFile });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(String(e)));
      page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
      page.fixtureLog = log;
      page.pageErrors = errors;
      return page;
    },
    async close() {
      for (const c of contexts) await c.close().catch(() => {});
      await browser.close();
      await server.close();
    },
  };
}
