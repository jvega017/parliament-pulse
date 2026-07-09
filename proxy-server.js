// Parliament Pulse — local CORS proxy
// Replaces jina.ai dependency for APH RSS feeds
// Usage: node proxy-server.js
// Then open http://localhost:8080/index.html (python -m http.server 8080)

const http  = require("http");
const https = require("https");
const url   = require("url");

const PORT = 3001;
const TIMEOUT_MS = 8000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

// APH's edge WAF returns 403 to requests without a real browser User-Agent (see
// app-tracker.md; the production aph-proxy Worker already sends one). Node's http
// client sends no UA by default, so this local proxy would 502 on every APH feed.
// Send the same browser UA + Accept headers the Worker uses. Keep aligned with the
// Worker: do not revert to a bot/blank UA.
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8",
  "Accept-Language": "en-AU,en;q=0.9",
};

function fetchUpstream(targetUrl, res) {
  const parsed = url.parse(targetUrl);
  const mod = parsed.protocol === "https:" ? https : http;

  const req = mod.get(targetUrl, { timeout: TIMEOUT_MS, headers: BROWSER_HEADERS }, (upstream) => {
    res.writeHead(upstream.statusCode, {
      ...CORS_HEADERS,
      "Content-Type": upstream.headers["content-type"] || "application/xml",
    });
    upstream.pipe(res);
  });

  req.on("timeout", () => {
    req.destroy();
    if (!res.headersSent) {
      res.writeHead(504, CORS_HEADERS);
      res.end(JSON.stringify({ error: "upstream timeout", url: targetUrl }));
    }
  });

  req.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { ...CORS_HEADERS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "upstream failed", detail: err.message, url: targetUrl }));
    }
  });
}

const server = http.createServer((req, res) => {
  // Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);
  const targetUrl = parsed.query.url;

  if (!targetUrl) {
    res.writeHead(400, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "missing ?url= parameter" }));
    return;
  }

  // Basic safety: only allow aph.gov.au hosts. parlinfo.aph.gov.au is NOT
  // included: it sits behind an Azure WAF JavaScript challenge that returns 403
  // to a plain fetch, so the production Worker does not route it either. Keep
  // this list aligned with the Worker ALLOWED_HOSTS.
  const allowed = ["aph.gov.au", "www.aph.gov.au"];
  let parsedTarget;
  try { parsedTarget = url.parse(targetUrl); } catch(e) {
    res.writeHead(400, CORS_HEADERS);
    res.end(JSON.stringify({ error: "invalid url" }));
    return;
  }

  const host = (parsedTarget.hostname || "").toLowerCase();
  if (!allowed.some(a => host === a || host.endsWith("." + a))) {
    res.writeHead(403, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "domain not allowed", host }));
    return;
  }

  fetchUpstream(targetUrl, res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Parliament Pulse CORS proxy running at http://localhost:${PORT}/proxy?url=...`);
  console.log("Allowed domains: aph.gov.au (www included)");
  console.log("Press Ctrl+C to stop.");
});
