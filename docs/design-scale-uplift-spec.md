# Parliament Pulse: design and scale uplift spec (executable)

**Status:** Execution spec, designed 2026-07-20 by the Fable design session. An executor session implements this mechanically via the multi-agent plan in section 5.
**Ground truth inputs (all Verified this session unless labelled):** `index.html` (1320 lines, full token set and CSS read), `shell.jsx` (903 lines), `pages.jsx` (2175 lines, PageSignals and component map read), `store.jsx` (single /state fetch effect read), `data.jsx:24` (`WORKER_BASE_URL`), `docs/state-contract.md`, `docs/licence-architecture.md`, `docs/live-wiring-spec.md`, `README.md`, `_headers` (CSP read), `tests/` (beta-contract, state-contract), current `.js` bundle sizes from `ls -la`, and WCAG contrast ratios computed numerically this session for every pair cited below.
**Branch:** `review/honesty-hardening` (HEAD `ebd7ac6`, Verified via `git log`).
**Build rule (unchanged):** every edited `.jsx` transpiles via `powershell -File build-jsx.ps1` (esbuild, all 7 files). Production `index.html` loads the `.js` files.

---

## 0. Invariants carried forward (violating any is a blocker)

These come from `docs/live-wiring-spec.md` section 0 and `docs/licence-architecture.md`. The uplift must not regress them.

1. **Licence contract.** A live signal's `title` renders only as a linked identifier whose click target is its APH `link`. Product-owned content is the attention level, confidence, `scoring_explanation`, threads, and provenance metadata. No APH prose renders as standalone product text.
2. **Provenance chips.** `ProvenanceChip` (`shell.jsx:450`) values stay `live | derived | fixture`. A Live chip appears only when live-block items are actually on screen. Representative desks keep their Representative chip.
3. **Fixture fallback.** When a block is missing, non-live, or empty, the desk renders its representative fixture with its honest chip. A failed refetch never erases a good cache (`store.jsx:341`).
4. **Never invent data.** No asset, OG description, empty-state copy, or marketing line may state a statistic, customer count, or capability the product does not have. The OG copy in section 3.5 is the approved wording.
5. **Git discipline.** Checkpoint-commit before any agent fan-out. Agents never run `git restore`, `git checkout --`, `git reset`, `git clean`, or `git stash` on tracked files. Verify `git status` after every fan-out.
6. **Interface freeze.** Section 5.2 lists the cross-file interfaces (window globals, CSS class names, token names). Parallel agents code against the freeze, never against each other's in-progress work.

---

## 1. Identity decision and design system uplift

### 1.1 The identity decision

**Decision: Parliament Pulse keeps and formalises its current ember-on-warm-black identity as its own commercial brand, decoupled from the Fire House workspace system.** Three reasons:

1. **Differentiation (Inferred).** The Australian civic-tech and gov-adjacent field defaults to institutional navy and blue. A warm near-black surface with a single incandescent ember accent is distinctive shelf presence, and the Prometheus flame mark already carries the Lab's brand story.
2. **The system is already disciplined (Verified).** The current CSS encodes a sovereign-accent rule (ember appears in exactly five sanctioned roles, DESIGN-2 comment at `index.html:47`), a verification-only teal, a five-hue functional cap (DESIGN-9), a two-step elevation model, and a complete light theme with recalibrated AA accents. This is a designed system, and every colour pair passes WCAG AA (section 1.2). Discarding it for a new identity would be churn without a quality argument.
3. **Provenance is the brand (Verified positioning).** The product's honest-data architecture (live/derived/representative chips, source-linked titles) is its commercial differentiator. The ember-as-signal-fire metaphor and the teal-as-verified pairing express that architecture visually.

Formalisation: the executor adds a header comment to the `:root` token block naming it `Parliament Pulse brand v1.0` and stating it is product-owned. No dependency on `04_Templates/brand-tokens.json` is added. The QLD Government navy palette is irrelevant here; this is a personal-capacity commercial product.

### 1.2 Colour tokens: LOCKED, with verified contrast pairs

The brief flagged an ember `#a23b1c` failing at 2.89:1. That token no longer exists; the current ember is `#f08a3c`. All ratios below were computed this session (Verified, WCAG 2.x relative-luminance formula):

| Token | Value | On `--bg #07080e` | On `--panel #11131f` | AA verdict |
|---|---|---|---|---|
| `--brass` (ember) | `#f08a3c` | 8.00:1 | 7.39:1 | Pass, all sizes |
| `--brass-2` | `#ff9d4f` | 9.70:1 | | Pass |
| `--gold` | `#d9b779` | 10.47:1 | 9.68:1 | Pass |
| `--teal` | `#45b3a4` | 7.84:1 | 7.25:1 | Pass |
| `--ink` | `#f5f0e1` | 17.55:1 | | Pass |
| `--ink-2` | `#d8d4c5` | | 12.44:1 | Pass |
| `--ink-3` | `#a0a4b4` | 8.06:1 | 7.45:1 | Pass |
| `--ink-4` | `#8a8e9e` | 6.14:1 | 5.67:1 | Pass (4.5:1 floor) |
| `--caution` | `#d4a017` | 8.42:1 | 7.78:1 | Pass |
| `--info` | `#9aa6b0` | 8.05:1 | 7.44:1 | Pass |
| `--escalate` | `#f87171` | | 6.68:1 | Pass |
| `.att.high` text | `#ef6a5e` | | 6.06:1 (5.83:1 on its `#1f1614` gradient head) | Pass |
| `--ember-flash` | `#e0534b` | 5.25:1 | | Pass, used at 12px+ only |
| `--live-red` bg + white text | `#c4382f` | 5.31:1 (white on it) | | Pass |
| `.btn.primary` text | `#160b03` on `#f08a3c` | 7.76:1 | | Pass |
| Light: `--brass` | `#9a5219` on `#f3eee2` | 5.05:1 | | Pass |
| Light: `--teal` | `#1f7068` on `#f3eee2` | 5.07:1 | | Pass |
| Light: `--ink-3` | `#5a5044` on `#fdfaf2` | 7.55:1 | | Pass |
| Light: `.att.high` | `#b02a20` on `#f3eee2` | 5.67:1 | | Pass |

**Executor action:** none on colour values. Add the verified ratios as a comment table at the top of the token block so future edits have a conformance baseline. Any NEW colour must be checked against `--bg` and `--panel` and appended to that table.

### 1.3 Type scale: raise the micro floor, tokenise the strays

Current scale (Verified, `index.html:108-118`): display 56, masthead 30, headline 23, subhead 18, body 15, body-sm 13, stat 28, kpi 48, label 10, micro 9. The commercial problem is the sub-11px band: `--t-micro: 9px`, `.prov-label` 9.5px, `.side-status .mono` 9.5px, `.chip-fixture` 9px, plus dozens of hardcoded `fontSize:10` inline styles in `pages.jsx` and `shell.jsx`.

**New rule: no rendered text below 10px, and every label uses a token.** Exact changes to `:root`:

```css
--t-label:  10.5px;   /* was 10px — uppercase mono kickers, nav groups, table headers */
--t-micro:  10px;     /* was 9px — chips, provenance labels, timestamps */
```

Mechanical sweeps (executor runs these greps and converts each hit):

1. `index.html`: `.chip-fixture` `font-size:9px` becomes `font-size: var(--t-micro)`. `.prov-label` `9.5px` becomes `var(--t-micro)`. `.side-status .mono` `9.5px` becomes `var(--t-micro)`. `.nav-group`, `table.ds th`, `.sr-group`, `.stat-label`, `.panel-section-title`, `.sig-action-label`, `.att`, `.beta-state`, `.coverage-labels`, `.coverage-state`, `.tl-time`, `.live-badge`, `.src-badge`, `.empty-kicker`: `font-size: 10px` becomes `var(--t-label)`.
2. `shell.jsx` and `pages.jsx`: grep `fontSize:9` and `fontSize:10` (also `fontSize: 9`, `fontSize: 10`, `fontSize:10.5`). Label-type text (uppercase mono kickers) becomes `fontSize:"var(--t-label)"`; metadata text (ids, timestamps, chips) becomes `fontSize:"var(--t-micro)"`. Nothing may remain below 10px.
3. Letter-spacing compensation: where a converted label carried `.18em` tracking at 10px, keep the tracking; the 0.5px size increase reads as more air, which is the premium direction.

Two additive tokens for hierarchy polish:

```css
--t-masthead: clamp(24px, 2.2vw + 16px, 30px);   /* fluid page titles; was fixed 30px */
--lh-tight: 1.25; --lh-body: 1.5;
```

`.sig-title` line-height moves from 1.25 to 1.3 (18px serif titles wrap on live headlines; the extra leading removes the cramped read).

### 1.4 Spacing, radius, elevation: consolidate to tokens

Spacing scale (Verified `--sp-1..6`, 4/8/12/16/20/24) is sound. Add the two gaps already used ad hoc:

```css
--sp-7: 28px;   /* equals --gap-section */
--sp-8: 32px;
```

Radius (Verified 4/8/14) is sound; add `--r-pill: 999px` and convert the hardcoded `border-radius: 999px` (`.chip`), `10px` (`.wl`, `.live-strip`, modal bits, search results) and `14px` (`.modal`) instances: 10px becomes `var(--r)` visually acceptable only where it was 8px; where it was genuinely 10px keep a new `--r-md: 10px` token and use it. Exact assignment: `.wl`, `.live-strip`, `.live-wrap`, `.search-results`, `.brief`, `.feed-test` use `--r-md`; `.modal` uses `--r-lg`.

Elevation becomes three named tiers (currently scattered inline):

```css
--elev-1: inset 0 1px 0 #ffffff08;                                 /* resident panel: tonal lift */
--elev-2: 0 20px 50px -28px #00000090, 0 1px 0 #00000060;          /* floating: drawer, search results, popover */
--elev-3: 0 50px 100px var(--scrim-strong), inset 0 0 0 1px #ffffff08;  /* modal */
```

Sweep: `.panel`, `.cs-primary`, `.beta-ledger` keep `--elev-1`; `.search-results`, `ShortcutHelp` popover, `.toast` use `--elev-2`; `.modal` uses `--elev-3`; `.drawer` keeps its directional `-20px 0 60px var(--overlay-shadow)`. Light-theme overrides for the tiers mirror the existing light `--shadow`.

### 1.5 Component polish rules (what changes and why it reads premium)

Each rule is a concrete edit; together they move the surface from builder-tool to product because the system becomes uniform (one label voice, one elevation logic, one radius language, no orphan styles).

1. **Buttons.** Add `min-height: 32px` to `.btn`, `28px` to `.btn.sm`; under `@media (pointer: coarse)` raise to 44px/40px (WCAG 2.2 target-size). Add `transition: background var(--dur-micro) var(--ease-functional), color var(--dur-micro) var(--ease-functional)` to `.btn` (hover currently snaps).
2. **Form controls.** Add `color-scheme: dark` on `:root` and `color-scheme: light` on `:root[data-theme="light"]` so native `<select>`, scrollbars and inputs stop rendering OS-light chrome inside the dark app. Create a `.select` class in `index.html` carrying the inline `<select>` style currently duplicated in `PageSignals` (`pages.jsx:2138`) and any other select; sweep pages.jsx to use it.
3. **Cards.** `.signal` hover already lifts 1px with an ember-tinted shadow; leave it. Add `content-visibility: auto; contain-intrinsic-size: auto 150px;` to `.signal` (rendering win at hundreds of cards, section 4.3).
4. **Chips.** Standardise chip height: `.chip`, `.chip-fixture`, `.beta-state`, `.coverage-state` get `line-height: 1.2` and vertical padding that yields 20px to 22px rendered height. No behaviour change.
5. **Tables.** Wrap every `table.ds` in a new `<div className="table-scroll">` (`overflow-x: auto; -webkit-overflow-scrolling: touch;`) with `table.ds { min-width: 560px; }` inside it, so phone widths scroll the table within its panel and never the page (pages-agent sweep; grep `table className="ds"` in pages.jsx).
6. **Scrollbars.** Add Firefox support: `* { scrollbar-width: thin; scrollbar-color: #3a3328 transparent; }` with a light-theme override `#cdbfa6 transparent`.
7. **Drawer and modal.** Already full-width on phones. Add `overscroll-behavior: contain` to `.drawer-body` and `.modal-body` so scroll chaining stops leaking to the page.
8. **Motion.** Existing tier model and reduced-motion kill switch stay. One addition: the manual-refresh icon (section 4.4) spins via `@keyframes spin` at 800ms linear while a refetch is in flight, honouring reduced-motion.
9. **Theme metas.** Add `<meta name="theme-color" content="#07080e" media="(prefers-color-scheme: dark)">` and `<meta name="theme-color" content="#f3eee2" media="(prefers-color-scheme: light)">` to the head.
10. **Skip link.** Add as first element in `<body>`-rendered app (shell-agent, in the App-level fragment or Topbar): `<a class="skip-link" href="#pp-content">Skip to content</a>`, with the main content wrapper given `id="pp-content"` and `tabIndex={-1}`. CSS: visually hidden until `:focus-visible`, then a panel-styled pill top-left, `z-index: 80`.

---

## 2. Design assets inventory and specs

Repo search performed this session (Verified): the only brand assets are the inline favicon data-URI SVG (`index.html:16`) and the inline sidebar flame SVG (`shell.jsx:143`). **They are two different flame drawings** (favicon path `M16 5c3 4...`, sidebar path `M11 2 C 7 5...`). Nothing else exists: no OG image, no manifest, no PNG icons, no wordmark lockup.

**Creation methods available:** (a) inline SVG written by the executor, (b) deterministic PNG render of an HTML/SVG harness via Playwright screenshot, (c) the workspace AI image pipeline `tools/output/generate-image.ps1`. **Decision: (a) and (b) only for brand assets.** AI image generation is non-deterministic and cannot reproduce the exact flame path or token colours; it stays available for future marketing illustration, never for the mark, favicon, icons, or OG card.

All assets live in a new `assets/` directory in the repo (bundled, same-origin, CSP-safe). The zero-byte junk files in the repo root (`!registryUrls.has(c.url))` and `[c.url`, Verified via `ls`) are deleted in Phase 0, and the untracked `render` entry is inspected and removed or gitignored.

### 2.1 Canonical mark: `assets/mark.svg` (create)

One flame to rule every surface. Take the sidebar drawing (the better one: outer flame plus white inner core) as canon:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" fill="none">
  <path d="M11 2 C 7 5, 6 9, 8 12 C 5 11, 4 13, 5 15 C 6 17, 9 18, 11 18 C 13 18, 16 17, 17 15 C 18 13, 17 11, 14 12 C 16 9, 15 5, 11 2 Z" fill="url(#flame)" opacity="0.95"/>
  <path d="M11 6 C 9 8, 9 11, 11 13 C 13 11, 13 8, 11 6 Z" fill="#fff" opacity="0.88"/>
  <defs><linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#ff9d4f"/><stop offset="100%" stop-color="#f08a3c"/>
  </linearGradient></defs>
</svg>
```

(Static hexes, since a standalone file has no CSS variables.) The sidebar keeps its inline copy with `var(--brass-2)/var(--brass)` stops; the executor confirms the two paths are byte-identical.

### 2.2 Favicon: replace the data URI with `assets/favicon.svg` (create)

32-grid frame around the canonical flame:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#07080e"/>
  <g transform="translate(5 5) scale(1)">[canonical flame paths from 2.1, viewBox 22 fits in 22px box]</g>
</svg>
```

`index.html` head: `<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">` replacing line 16, plus `<link rel="apple-touch-icon" href="assets/icon-180.png">`.

### 2.3 App icons: `assets/icon-180.png`, `icon-192.png`, `icon-512.png` (create, Playwright render)

Rendered deterministically from an HTML harness `assets/asset-forge.html` (committed): a page containing the favicon SVG scaled in divs of exactly 180/192/512 px with `#07080e` rounded-rect background baked in (512 uses rx 112 for maskable safety, flame at 60% of canvas). Render commands (executor, from repo root):

```
npx playwright screenshot --viewport-size=180,180 "file://<abs>/assets/asset-forge.html#i180" assets/icon-180.png
npx playwright screenshot --viewport-size=192,192 "file://<abs>/assets/asset-forge.html#i192" assets/icon-192.png
npx playwright screenshot --viewport-size=512,512 "file://<abs>/assets/asset-forge.html#i512" assets/icon-512.png
```

The harness reads `location.hash` and shows only the matching tile full-bleed. (Any equivalent Playwright scripting path is acceptable; the byte-exact tokens are the requirement.)

### 2.4 Web app manifest: `manifest.webmanifest` (create)

```json
{
  "name": "Parliament Pulse",
  "short_name": "Pulse",
  "description": "Australian parliamentary intelligence: live APH signals, provenance-first triage, one-click briefs.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#07080e",
  "theme_color": "#07080e",
  "icons": [
    { "src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

Head link: `<link rel="manifest" href="manifest.webmanifest">`. No service worker in this uplift (offline app shell is a later decision; a stale offline shell would fight the live-data honesty story).

### 2.5 OpenGraph card: `assets/og.png`, 1200x630 (create, Playwright render)

Layout spec for the harness page (`assets/asset-forge.html#og`, fixed 1200x630 div):

- Background `#07080e` with the app's two radial ember glows (top-left `#14100a`, bottom-right `#1a1108`) and a 1px `#ffffff14` inner border inset 24px.
- Top-left, 72px from edges: canonical flame mark at 88px, to its right "Parliament Pulse" in IBM Plex Serif 600 at 76px, `#f5f0e1`, letter-spacing -0.01em; beneath it "PROMETHEUS POLICY LAB" in IBM Plex Mono 600 at 20px, `#8a8e9e`, letter-spacing .18em.
- Centre-left, y ~330: one sentence, IBM Plex Sans 400 at 30px, `#d8d4c5`, max-width 900px: "Australian parliamentary intelligence: live APH signals, provenance-first triage, one-click briefs."
- Bottom-left, y ~520: three chips in the app's chip style (mono 18px, 1px borders, pill radius): `LIVE APH FEEDS` (teal `#45b3a4` text/border), `PROVENANCE FIRST` (ember `#f08a3c`), `SOURCE-LINKED` (gold `#d9b779`).
- No screenshots, no statistics, no invented claims (invariant 4).

Render: `npx playwright screenshot --viewport-size=1200,630 "...#og" assets/og.png`. Fonts: the harness links the same self-hosted WOFF2 files (section 4.1) with a `document.fonts.ready` gate before screenshot (Playwright `--wait-for-timeout=1500` acceptable fallback).

Head updates: `og:image` `https://parliament-pulse.pages.dev/assets/og.png`, `og:image:width` 1200, `og:image:height` 630, `twitter:card` becomes `summary_large_image`, `twitter:image` same URL.

### 2.6 Loading skeletons (exists, extend)

`SkeletonRow` and `SkeletonCard` exist (`shell.jsx:48,61`) with a shimmer keyframe. Additions:

- `SkeletonTable({ rows = 5 })` in shell.jsx: a `.panel` containing header bar plus N rows of three bars (30%/45%/15%), for Sources and Bills while `/state` is loading.
- Wiring rule: any desk consuming `useLiveState` renders its skeleton set when `status === "loading"` AND it has no cached items AND its fixture would otherwise flash before live data lands. Concretely: PageSignals shows 3x `SkeletonCard` during initial `loading` with `items === null`; Sources shows `SkeletonTable`; Overview's signal panel shows 2x `SkeletonCard`. When `status` resolves to `error`, the fixture renders with its Representative chip (existing behaviour, invariant 3).

### 2.7 Empty states (exists, write the copy)

`EmptyState` component exists (`shell.jsx:35`). Per-desk copy (executor pastes verbatim; kicker / body):

| Desk | Kicker | Body |
|---|---|---|
| Signal inbox, all archived | `Inbox zero` | `All signals reviewed. New items appear when the next feed poll lands.` |
| Signal inbox, filter empty | `No matches` | `No {filter} attention signals right now. Clear the filter to see the full inbox.` |
| Search, no results | `No results` | `Nothing matches "{query}" across signals, bills, committees or members. Try a shorter term.` |
| Sources, worker down | `Feed status unavailable` | `The status service did not respond. Direct links to each official APH feed remain available below.` (variant="error") |
| Watchlists, none | `No watchlists yet` | `Create a watchlist to get matched signals and a daily digest of what moved.` (action: New watchlist button) |
| Briefings, none generated | `No briefs yet` | `Open any signal and choose Generate brief. Your briefs appear here with their evidence links.` |
| Threads/patterns, none | `No threads` | `Thread detection groups related signals as they accumulate. Nothing has clustered yet.` |

### 2.8 Wordmark lockup

In-app the wordmark stays live text (`.brand-name`, IBM Plex Serif 600), which is correct: it themes, scales and needs no asset. The OG card (2.5) is the only rasterised lockup. No separate wordmark file is created.

---

## 3. High-scale readiness

### 3.1 Self-host every external dependency (kill unpkg and Google Fonts)

Current (Verified): React and ReactDOM UMD load from `unpkg.com` with SRI; fonts load from Google Fonts (11 weight-files across Sans 300-700, Mono 400-600, Serif 400-700). Both are availability and privacy liabilities for a commercial product, and unpkg is a single point of failure with no SLA.

**Vendor JS.** Download to `vendor/react.production.min.js` and `vendor/react-dom.production.min.js` (18.3.1, the pinned version; sizes on the order of 11KB and 130KB minified, Inferred, verify at download). Script tags switch to same-origin; SRI attributes are dropped (same-origin files under our deploy control). CSP `script-src` tightens to `'self'`.

**Vendor fonts.** Grep first: if `fontWeight:300|font-weight: 300` has no hits (Inferred likely), drop the 300 weight. Download latin-subset WOFF2 for: Sans 400/500/600/700, Mono 400/500/600, Serif 400/600/700 (10 files, roughly 15-25KB each, Inferred) into `fonts/`, with an `@font-face` block replacing the Google `<link>`s, each `font-display: swap`. Preload the three above-the-fold-critical files: Sans 400, Serif 600, Mono 500. CSP: `style-src 'self' 'unsafe-inline'` (Google hosts removed), `font-src 'self'`.

**Resulting CSP** (replaces the current one in `_headers`; connect-src unchanged):

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://i.ytimg.com https://*.ytimg.com; connect-src 'self' https://aph-proxy.jvega019.workers.dev http://localhost:3001 http://127.0.0.1:3001; frame-src https://www.youtube.com https://www.youtube-nocookie.com; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'self'
```

### 3.2 Production bundle: one minified file, hashed for cache

Current first-party payload (Verified from `ls`): 7 script files totalling ~301KB unminified (pages.js 143KB, store.js 56KB, shell.js 53KB, data.js 23KB, entities.js 11KB, icons.js 10KB, app.js 4KB), served without minification. The files communicate via `Object.assign(window, ...)` globals, so plain concatenation in load order is semantically identical to today's 7 tags.

**Build step** (extend `build-jsx.ps1` with a `-Bundle` switch):

1. Transpile all 7 `.jsx` to `.js` exactly as today (dev mode unchanged).
2. Concatenate in load order: data, entities, icons, store, shell, pages, app.
3. `npx esbuild concat.js --minify --target=es2018 --outfile=pulse.<hash8>.min.js` where `<hash8>` is the first 8 chars of the SHA-256 of the concatenated input.
4. Rewrite the script block in `index.html` to exactly three tags: the two vendor React files and the hashed bundle. Delete stale `pulse.*.min.js` files.

Expected result: minification plus Cloudflare's automatic Brotli should land total first-party JS transfer near 50KB and React vendor near 45KB (Inferred; the bundle-size gate in section 5.5 measures the real numbers and enforces the budget).

**Cache policy** (append to `_headers`):

```
/vendor/*
  Cache-Control: public, max-age=31536000, immutable
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  Cache-Control: public, max-age=86400
/pulse.*.min.js
  Cache-Control: public, max-age=31536000, immutable
```

The hashed filename makes the year-long cache safe; `index.html` itself stays on Pages' default revalidation.

### 3.3 Rendering at hundreds of signals: progressive list

`PageSignals` maps every visible signal (`pages.jsx:2168`); today that is 31 items, and the SignalCardView is memoised. At several hundred items initial render and filter switches would jank.

**Progressive rendering (no external library, CSP-clean), in pages.jsx:**

```js
const CHUNK = 60;
const [renderCap, setRenderCap] = useState(CHUNK);
React.useEffect(() => { setRenderCap(CHUNK); }, [filter, sort, signalSearchQuery]);  // reset on any reslice
const shown = visible.length > 80 ? visible.slice(0, renderCap) : visible;
```

After the list, when `shown.length < visible.length`, render a sentinel `<div ref={sentinelRef} className="list-sentinel">` observed by an `IntersectionObserver` (`rootMargin: "600px"`) that bumps `renderCap` by `CHUNK`, plus a mono footer line `Showing {shown.length} of {visible.length} signals` and a fallback `Show more` button (keyboard and observer-less path). Below 81 items behaviour is byte-identical to today.

**Keyboard invariant:** `visibleSignalOrder` continues to carry the FULL `visible` order. Where the j/k handler advances the cursor, if the target index is `>= renderCap`, call the exposed `ppBumpRenderCap(targetIndex)` (window global set by PageSignals while mounted, no-op otherwise) before scrolling. Executor verifies j/k past item 60 in the Playwright pass.

**Card cost:** `content-visibility: auto` on `.signal` (section 1.5.3) lets the browser skip layout for off-screen cards. The same progressive pattern applies to the Live page event list if its item count exceeds 80 (same constants, same sentinel class).

### 3.4 /state lifecycle: stale-while-revalidate, visible age, manual refresh

Current (Verified `store.jsx:318-350`): one fetch on mount, 8s abort, no interval; Worker caches 5-10 min. Uplift, all inside `StoreProvider` (store-agent owns):

1. **Track age.** Extend `liveState` with `fetchedAt: null` (ms epoch, set on every successful fetch) and keep `status` semantics; add `isRefreshing` boolean so a background refetch never flips the UI back to skeletons (`status` stays `ready` during refetch; only the initial load shows `loading`).
2. **Interval revalidate.** `setInterval` every 5 minutes: if `document.visibilityState === "visible"`, refetch. A failed refetch keeps cache and sets a `lastError` timestamp; it never toasts (silent background degradation).
3. **Wake revalidate.** On `visibilitychange` to visible: refetch if `Date.now() - fetchedAt > 5 * 60_000`.
4. **Expose** `refreshLiveState()` (forces a fetch, returns a promise) and `liveState.fetchedAt` through the store context and `Object.assign(window, ...)`.
5. **Topbar affordance (shell-agent).** In `.top-right`, before the theme control: a `.btn ghost sm` with the new `refresh` icon and a mono age label, `aria-label="Refresh live data"`. Age text: `now` under 60s, `{n}m` under 60m, else `{h}h`. Icon spins while `isRefreshing`. On manual failure only, toast `"Live refresh failed - showing data from {age} ago"` (toast type err). When `status === "error"` with no cache at all, the chip cluster shows a `.chip warn` reading `LIVE DATA UNAVAILABLE` with title text pointing at the per-desk Representative fallbacks.
6. **Staleness banner.** When `fetchedAt` is older than 30 minutes despite retries, `BetaNotice`-style single-line banner: `Live data is {age} old. The feed service may be degraded; signals shown were correct as fetched.` This keeps the honesty posture graceful under Worker outage.
7. **Conditional requests (optional, flagged).** Send `If-None-Match` when the last response carried an `ETag`; treat 304 as a successful no-op revalidate. Worker-side ETag support is a separate Worker change (out of this repo's scope); the frontend code degrades to full fetches transparently. Label: the Worker's current ETag behaviour is Unverified; do not block on it.

### 3.5 Degradation story (explicit state machine)

| Condition | Surface behaviour |
|---|---|
| Initial load, worker responding | Skeletons (2.6) then live blocks with Live/Derived chips |
| Initial load, worker down/timeout | Fixtures with Representative chips (existing), topbar `LIVE DATA UNAVAILABLE` chip, no skeleton loop |
| Background refetch fails | Silent; cache retained; age label keeps counting up |
| Cache older than 30 min | Staleness banner (3.4.6) |
| Manual refresh fails | Error toast with age (3.4.5) |
| `file://` origin | Existing early-return and guidance (unchanged) |

### 3.6 Mobile completion

Breakpoints at 1100/900/780 exist and are largely complete (Verified: off-canvas sidebar, single-column grids, full-width drawer and modal, deferred secondary KPIs). Remaining gaps, all in scope:

1. Tables: `.table-scroll` wrapper (1.5.5) is the main missing piece.
2. Touch targets: 1.5.1 pointer-coarse rules; also `.nav-item` gets `min-height: 40px` inside the 780px block.
3. iOS safe areas: `.side { padding-bottom: env(safe-area-inset-bottom); }` and `.toast-wrap { bottom: calc(20px + env(safe-area-inset-bottom)); }`.
4. The 390px Playwright pass (5.5) is the acceptance gate for every desk: no horizontal page scroll, no text below 10px, tap targets pass axe's target-size rule.

### 3.7 Accessibility at the commercial bar (WCAG 2.2 AA)

Already in place (Verified): focus-visible ring, drawer focus trap, reduced-motion kill switch, aria-current nav, sr-only labels, shape-redundant health dots, light-theme AA recalibration. To close AA:

1. Skip link (1.5.10).
2. Landmarks: ensure the routed page container is `<main id="pp-content">` (app/shell agent; currently `.main` is a div, Verified `index.html` CSS naming only, executor confirms the JSX element and adds the role).
3. Toast container gets `role="status" aria-live="polite"`; the error toast variant `role="alert"` (shell/store agent, wherever `.toast-wrap` renders).
4. `lang` and title are set; add `<meta name="color-scheme" content="dark light">`.
5. Target size (2.5.8): covered by 1.5.1; axe verifies.
6. Focus appearance: the 2px ember ring on `#07080e` is 8.0:1 (Verified); passes.
7. Axe gate: zero critical or serious findings on Overview, Signal inbox, Sources, and the drawer open state, in BOTH themes, at 1280 and 390 widths (8 scans). Moderate findings are logged to the review backlog, never silently waived.

---

## 4. What changes versus the current look (the premium delta, summarised)

1. One label voice: every kicker/chip/meta size comes off two tokens with a 10px floor; the dozens of 9-10px strays disappear.
2. One elevation logic: three named shadow tiers; popovers and toasts stop inventing their own.
3. One flame: favicon, sidebar, icons and OG all render the same canonical mark; today the favicon and sidebar disagree.
4. Product presence off-platform: real OG card, large twitter card, installable manifest, correct theme-colour chrome. Today a shared link renders a bare text stub.
5. Perceived speed: skeletons on first paint, sub-100KB total JS transfer, self-hosted fonts with swap, year-cached immutable assets.
6. Trust made visible: the data-age label plus manual refresh in the topbar turns the honesty architecture into a visible product feature.
7. Native-feel controls: dark form controls, thin themed scrollbars everywhere, contained overscroll, 44px touch targets.

---

## 5. Multi-agent execution plan

### 5.1 File-ownership partition (hard rule: one file, one owner, per phase)

| Agent | Owns (writes) | Reads |
|---|---|---|
| A1 tokens | `index.html` (style block, head metas, favicon link; NOT the script tags) | everything |
| A2 shell | `shell.jsx` | this spec, index.html current classes |
| A3 pages | `pages.jsx` | this spec, frozen interfaces |
| A4 store | `store.jsx` | this spec, frozen interfaces |
| A5 assets | `icons.jsx`, `assets/*` (new), `manifest.webmanifest` (new), `tests/` additions | this spec |
| B1 infra | `build-jsx.ps1`, `vendor/*` (new), `fonts/*` (new), `_headers`, `index.html` (script tags and font links ONLY, after A1 lands) | everything |

`app.jsx`, `data.jsx`, `entities.jsx` are untouched. Every agent transpiles its own `.jsx` via `build-jsx.ps1` before finishing. No agent runs destructive git (invariant 5).

### 5.2 Frozen interfaces (agents code against these, not against each other)

- CSS tokens added by A1, usable by A2/A3 immediately: `--t-label: 10.5px`, `--t-micro: 10px`, `--r-md: 10px`, `--r-pill: 999px`, `--sp-7`, `--sp-8`, `--elev-1/2/3`, `--lh-tight`, `--lh-body`, classes `.table-scroll`, `.select`, `.skip-link`, `.list-sentinel`.
- Store exposes (A4): `refreshLiveState()` returning a promise; `liveState.fetchedAt` (ms epoch or null); `liveState.isRefreshing` (boolean). Existing `useLiveState(blockName)` signature unchanged.
- Window globals: `ppBumpRenderCap(index)` set/unset by PageSignals (A3); `SkeletonTable` exported from shell (A2); `Icon name="refresh"` added to icons.jsx (A5): a 16-grid circular-arrows path, stroke-based, matching the existing icon style in `icons.jsx`.
- Asset paths: `assets/favicon.svg`, `assets/icon-180.png`, `assets/icon-192.png`, `assets/icon-512.png`, `assets/og.png`, `manifest.webmanifest` (A5 creates; A1 references from the head).

### 5.3 Phase order

- **Phase 0 (main session, sequential).** Checkpoint commit. Delete the two zero-byte junk files; inspect and resolve the untracked `render` entry. Baseline capture: `build-jsx.ps1`, `node --test tests/*.mjs`, Playwright screenshots (Overview, Signals, Live, Sources at 1280 and 390, dark), byte sizes of all 7 `.js`. Commit the cleanup.
- **Phase A (5 agents in parallel: A1-A5).** All edits per sections 1-3 EXCEPT bundling/vendoring. The app must still run in dev multi-file mode at phase exit. Skeleton wiring (A3) may reference `SkeletonTable` (A2) and `refresh` icon (A5) per the freeze.
- **Gate A (main session).** Rebuild all 7, run tests, `git status` sanity, Playwright smoke (zero console errors on all desks, both themes), commit `feat(pulse): design uplift phase A`.
- **Phase B (B1 alone, sequential).** Vendor React, self-host fonts, bundle mode, script-tag rewrite, `_headers` CSP and cache rules, OG/manifest head references finalised. Local verification: serve, confirm three script tags, fonts load same-origin, zero CSP violations in console.
- **Gate B (main session).** Full verification battery (5.5). Commit `feat(pulse): self-host + bundle + cache (phase B)`.
- **Phase C: Codex adversarial gate.** Send Codex (via `mcp__codex__codex`): the full `git diff` from the Phase 0 checkpoint, the 1280/390 screenshot set, and this spec. Mandate: (a) design quality critique against section 4's claimed delta, (b) hunt for licence/honesty regressions against section 0 invariants 1-4, (c) hunt for perf regressions (bundle order, cache keys, CSP). Blockers fix-and-rerun; taste-level findings log to `REVIEW-BACKLOG` with a decision each.
- **Phase D: deploy.** `npx wrangler@4 pages deploy . --project-name=parliament-pulse --branch=preview-uplift` first; run the live-URL smoke (5.5 items 1, 2, 6, 7 against the preview URL). Production deploy to `--branch=main` only on Juan's explicit approval.

### 5.4 What parallelises safely

A1-A5 are disjoint by file and interface-frozen: fully parallel. B1 must be solo because it touches `index.html` (shared with A1) and the build script. Verification gates are main-session sequential. Asset PNG rendering (A5) needs Playwright but no served app; it can run any time inside Phase A.

### 5.5 Verification battery (Gate B, all must pass)

1. **Build:** `build-jsx.ps1` clean; `-Bundle` produces exactly one hashed bundle; `index.html` references it; no stale bundles.
2. **Tests:** `node --test tests/*.mjs` green. A5 adds `tests/asset-manifest.test.mjs`: asserts the six asset files exist and are non-empty, `manifest.webmanifest` parses with 192 and 512 icons, and `index.html` contains no `unpkg.com` or `fonts.googleapis.com` reference. (Instrument-proves-detection rule: the test must first be shown failing against a seeded break, for example a temporarily renamed icon file, then passing.)
3. **Playwright, 1280x800 dark:** every desk screenshot; zero console errors; zero CSP violations; drawer open; search open.
4. **Playwright, 390x844 dark:** every desk; no horizontal page scroll (`document.documentElement.scrollWidth <= 390`); nav drawer; tables scroll internally.
5. **Playwright, light theme:** Overview and Signals at 1280; spot-check contrast tokens applied.
6. **Axe:** the 8-scan matrix of 3.7.7; zero critical/serious.
7. **Bundle budget:** total first-party JS transfer (content-encoding taken from response headers) <= 120KB; fonts total <= 200KB; `assets/og.png` <= 300KB. Log actuals to `REVIEW-BACKLOG`.
8. **Scale probe:** with a synthetic 500-item signals array injected via the store (dev-only page eval in Playwright), Signal inbox initial render under 1.5s on the default Playwright machine, sentinel paging works, j/k reaches item 200.
9. **Refresh probe:** block the Worker origin via Playwright route interception; confirm fixture fallback, `LIVE DATA UNAVAILABLE` chip, and no skeleton loop; unblock and manual-refresh recovers to Live chips.
10. **Licence conformance:** on live data, click a signal title; the navigation target is `aph.gov.au`; no live title renders outside an anchor (invariant 1).

### 5.6 Exit checklist: "commercial-grade and scale-ready" means all of these are true

- [ ] Zero external runtime origins: no unpkg, no Google Fonts; CSP `script-src 'self'`.
- [ ] Exactly 3 script tags in production; first-party JS transfer <= 120KB compressed.
- [ ] Immutable year caching on vendor, fonts and the hashed bundle.
- [ ] No rendered text below 10px anywhere; all label styles token-driven.
- [ ] Every colour pair on every surface passes WCAG AA, both themes (table in 1.2 maintained).
- [ ] Axe: zero critical/serious across the 8-scan matrix.
- [ ] 390px: every desk usable, no page-level horizontal scroll, tables scroll internally, 44px touch targets.
- [ ] One canonical flame across favicon, sidebar, app icons, OG card.
- [ ] Shared link unfurls with the 1200x630 OG card on at least one validator (opengraph.xyz or Slack preview).
- [ ] Installable: manifest valid, icons load, theme-colour correct in both themes.
- [ ] Live data shows its age; manual refresh works; Worker outage degrades to labelled fixtures with a visible chip, and recovery is one click.
- [ ] 500-signal probe passes (5.5.8).
- [ ] All licence/honesty invariants re-verified post-uplift (5.5.10), Codex gate closed with zero open blockers.
- [ ] Repo hygiene: junk files gone, `render` resolved, dev multi-file mode still works for local iteration.

---

*Companion docs: `docs/live-wiring-spec.md` (data layer), `docs/licence-architecture.md` (display contract), `docs/state-contract.md` (payload shape). This spec supersedes the visual sections of `design-elevation-spec.json` where they conflict; that file remains the audit log of the June elevation round.*
