# Parliament Pulse — Codex task queue
Generated: 2026-05-08 | Owner: Juan Vega / Prometheus Policy Lab
**Status: ALL TASKS COMPLETE — 2026-05-10**

## Context

Parliament Pulse is a browser-only React app (CDN Babel, no build step) for Australian
parliamentary intelligence. Source: multi-file JSX in this folder. The consolidated
single-file version is `parliament-pulse.html`.

Architecture: `index.html` loads all `.jsx` files as `<script type="text/babel" src="...">`.
State lives in `store.jsx` (React context + localStorage). Data in `data.jsx` and `entities.jsx`.
Shell (sidebar, topbar, drawer) in `shell.jsx`. Pages in `pages.jsx`. Router in `app.jsx`.

All global variables (`SIGNALS`, `ENTITIES`, `APH_FEEDS`, etc.) are set via `Object.assign(window, {...})`
at the bottom of each file — this is how CDN Babel modules share state.

**Before working on any task:** run `python -m http.server 8080` in this folder and
open `http://localhost:8080/index.html` to verify the baseline.

---

## TASK 1 — Local CORS proxy (replaces jina.ai dependency)

**Priority: HIGH — blocks live data tasks**

**Problem:** `pages.jsx` uses `https://r.jina.ai/` to proxy APH RSS feeds around CORS.
jina.ai is a third-party service — if it's rate-limited or offline, the Live page breaks.

**Deliverable:** `proxy-server.js` — a single-file Node.js HTTP server with no npm dependencies.

**Spec:**
```
GET http://localhost:3001/proxy?url=<encoded-url>

Response:
  - Forward the HTTP response from <encoded-url>
  - Add header: Access-Control-Allow-Origin: *
  - Add header: Access-Control-Allow-Headers: *
  - Handle OPTIONS preflight (respond 200 with CORS headers, empty body)
  - Timeout: 8 seconds per upstream request
  - Error: if upstream fails, return { error: "upstream failed", url } as JSON with status 502

No npm install required. Use Node built-in http and https modules only.
```

**After writing proxy-server.js, also update `pages.jsx`:**
Find the constant or inline string `https://r.jina.ai/` and replace with `http://localhost:3001/proxy?url=`.
The existing call pattern is: `fetch("https://r.jina.ai/" + feedUrl)` — preserve this pattern,
just swap the proxy base.

**Test:** start the proxy with `node proxy-server.js`, open the app, go to Live Parliament page,
confirm feeds load without jina.ai.

---

## TASK 2 — Keyboard navigation for signals

**Priority: HIGH — analyst UX**

**Problem:** No keyboard navigation. Analysts using the app for monitoring must click every signal.

**Deliverable:** Add to `shell.jsx` a keyboard navigation hook.

**Spec:**
```javascript
// In the Drawer component or as a standalone hook useSignalKeyNav():
// When drawer is CLOSED:
//   j — open next signal in SIGNALS array (by index), increment
//   k — open previous signal
// When drawer is OPEN:
//   Escape — close (already works via Topbar escape handler — verify it still does)
//   j — open next signal without closing/reopening drawer
//   k — open previous signal
//   b — toggle "Generate brief" action
//   w — add to watchlist

// Show a small keyboard hint in the drawer footer:
// "j/k navigate · Escape close · b brief · w watchlist"
```

Track current signal index in a `React.useRef`. Update it when `openSignal` is called.
Skip archived signals (check `state.archived[s.id]`).

---

## TASK 3 — Generate brief (functional, not just toast)

**Priority: HIGH — core workflow**

**Problem:** The "Generate brief" button in the signal drawer fires a toast but produces nothing.

**Deliverable:** Clicking "Generate brief" in the Drawer should:
1. Generate a formatted markdown brief string from the signal data
2. Copy it to the clipboard using `navigator.clipboard.writeText()`
3. Show the existing toast: "Brief copied to clipboard"

**Brief format:**
```markdown
# Executive Brief — {signal.title}
Date: {signal.date} | Source: {signal.source} | Priority: {signal.attention.toUpperCase()}

## Summary
{signal.summary}

## Why it matters
{signal.attentionReason}

## Recommended action
**{signal.action}**
{signal.actionReason}

## Evidence
{signal.evidence.map(e => `- [${e.label}](${e.url})`).join('\n')}

## Provenance
Signal ID: {signal.id} | Confidence: {signal.confidence}/5 | Human review: {signal.humanReview}
Generated: {new Date().toISOString()}
```

**Location in code:** `Drawer` component in `shell.jsx`, the `generateBrief` onClick handler.
Replace the existing `generateBrief(s.id, "Executive brief")` store call with the clipboard logic.
Keep the toast. Change toast text to "Brief copied to clipboard".

---

## TASK 4 — Export signals as CSV

**Priority: MEDIUM — analyst workflow**

**Deliverable:** Add an "Export CSV" button to the Overview page (`PageOverview` in `pages.jsx`).

**Spec:**
```javascript
function exportSignalsCSV() {
  const headers = ["id","date","source","attention","title","action","confidence"];
  const rows = SIGNALS.map(s => [
    s.id, s.date, s.source, s.attention,
    `"${s.title.replace(/"/g,'""')}"`,
    `"${s.action.replace(/"/g,'""')}"`,
    s.confidence
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `parliament-pulse-signals-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}
```

Add a button in the Overview page header row (same row as the "Today's signal" heading):
`<button className="btn ghost sm" onClick={exportSignalsCSV}><Icon name="ext" size={12}/> Export CSV</button>`

---

## TASK 5 — Dark / light theme toggle

**Priority: MEDIUM — usability**

**Deliverable:** A theme toggle button in the topbar, with preference saved to localStorage.

**Spec:**
- In the consolidated CSS (inside `parliament-pulse.html` or `index.html`), the existing variables
  are defined on `:root`. Add a second block:
  ```css
  :root[data-theme="light"] {
    --bg: #f5f4f1;
    --panel: #ffffff;
    --ink: #1a1814;
    --ink-2: #3d3930;
    --ink-3: #7a7468;
    --ink-4: #a09890;
    --line: rgba(0,0,0,.10);
    --line-2: rgba(0,0,0,.07);
  }
  ```
- Add a sun/moon icon button at the end of `.top-right` in `Topbar` (shell.jsx):
  ```jsx
  <button className="btn ghost sm" title="Toggle theme"
    onClick={() => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("pp-theme", next);
    }}>
    <Icon name="star" size={13} />
  </button>
  ```
- On app load (in app.jsx `App` component, first `useEffect`), restore the saved theme:
  ```javascript
  React.useEffect(() => {
    const saved = localStorage.getItem("pp-theme");
    if (saved) document.documentElement.dataset.theme = saved;
  }, []);
  ```

---

## TASK 6 — Consolidate changes into parliament-pulse.html

**Priority: RUN LAST — do this after all other tasks are done**

The `parliament-pulse.html` is the single-file distribution. After tasks 1-5 are complete,
regenerate it by inlining all JSX files into the HTML.

**Method:**
Read `index.html` to see how it loads the JSX files. Then create `parliament-pulse-updated.html`:
- Keep the same `<head>` and CSS
- Replace the separate `<script src="...jsx">` tags with inline `<script type="text/babel">` blocks
  containing the content of each file in load order:
  `icons.jsx` → `data.jsx` → `entities.jsx` → `store.jsx` → `shell.jsx` → `pages.jsx` → `app.jsx`

**Do NOT inline proxy-server.js** — that is a Node.js file, not browser code. Note in a comment
at the top of parliament-pulse-updated.html that the Live page requires `node proxy-server.js`.

---

## Quick reference — file map

| File | What it contains | Edit for |
|---|---|---|
| `app.jsx` | App root, page router | Theme restore (Task 5) |
| `store.jsx` | React context, modals, toasts | — |
| `shell.jsx` | Sidebar, topbar, signal card, drawer | Keyboard nav (T2), brief gen (T3), theme toggle (T5) |
| `pages.jsx` | All 10 page modules, RSS poller | Export CSV (T4), proxy URL update (T1) |
| `data.jsx` | Fixture: signals, feeds, watchlists | — |
| `entities.jsx` | Fixture: committees, members, bills | — |
| `icons.jsx` | SVG icon set | — |
| `index.html` | Entry point for multi-file dev | CSS addition (T5) |
| `parliament-pulse.html` | Consolidated single-file | Regenerate (T6) |
| `proxy-server.js` | NEW — local CORS proxy | Write (T1) |
