# Parliament Pulse remediation and bold-redesign plan

Author: Lead engineer (consolidation of five audit reports)
Date: 2026-05-30
Status: Working draft (Official)
Goal: move Parliament Pulse from a 30% demo to a 90%+ deploy-ready flagship on Cloudflare, with real data wherever a verified feed exists, a bold Fire House visual redesign, and all functionality working.

A note on confidence labelling is applied throughout: Verified means checked against the codebase or a feed this session; Inferred means a logical conclusion from the reports; Based on training means not re-verified. Two in-code assertions still carry an anti-hallucination caveat and are flagged as [VERIFY]: the PARL_STREAMS YouTube channel id and the Cloudflare Worker subdomain.

---

## 1. Honest current-state grade and the gap to 90%

Current grade: 72/100 (Verified by the functionality audit; consistent with the redesign and data audits).

The product is not a 30% demo in code terms. It is a competent, accessible, well-structured single-file React-over-Babel app whose core interaction layer genuinely works: command search, the signal drawer with keyboard navigation, the detail modals, theme persistence, analyst notes, CSV export, and a real RSS poller on the Live page. It reads as a 30% demo for three honest reasons:

1. Data reality. Only one of fourteen modules (Live) is backed by a real feed. Everything else is fixture data published as global consts. The owner perceives this gap immediately.
2. Visual identity. The shell hedges: a cool blue-grey background, two co-equal soft accents, a default Inter and Fraunces pairing, near-flat panels, and a 34px serif hero that reads as a magazine rather than an intelligence terminal. The app ignores its own Fire House SSOT (brand-tokens.json v2.0.1).
3. Broken headline feature plus dead controls. The production live-RSS path is broken by a route mismatch, a localStorage hydration bug can crash returning users, user-created watchlists open a "Not found" modal, and a long tail of primary buttons only fire a success toast with no effect.

The gap to 90% is four substantive fixes plus a re-skin plus the feeds that can truly go live:

- Fix the four high and medium correctness defects (F14, F2, F1, F10) and audit the toast-only buttons (F4, F15). Verified that fixing these alone moves the build into the high 80s.
- Connect the verified feeds through a working Worker proxy so at least four modules go genuinely live.
- Execute the Fire House redesign as a re-skin and re-weighting, not a rebuild, because the component bones are already correct.

Reaching 90%+ does NOT require building the hard enrichment pipeline (Signals scoring, Radar clustering, QON NLP). Those modules stay representative and clearly flagged. Flagship feel comes from real feeds where they exist, bold visual commitment, and zero broken controls.

---

## 2. The feed reality: what goes live, what stays representative, and the CORS plan

### 2.1 Verified feeds (can go truly live)

Six APH RSS feeds were verified live this session (real items dated April to May 2026). None send CORS headers, so a proxy is mandatory.

| Feed | URL | Backs module |
|---|---|---|
| House Media Releases | aph.gov.au/house/rss/media_releases | Media / Overview signals |
| Senate Committee Reports Tabled | aph.gov.au/senate/rss/reports | Committees |
| Senate New Inquiries | aph.gov.au/senate/rss/new_inquiries | Committees |
| Senate Upcoming Hearings | aph.gov.au/senate/rss/upcoming_hearings | What's On / hearings |
| House Divisions (results, ttl=10, near-live) | aph.gov.au/house/rss/divisions | Divisions (aggregate result only) |
| House Daily Program | aph.gov.au/house/rss/daily_program | Live / Parliament (supplementary, empty off-sitting days) |

TheyVoteForYou v1 REST API (theyvoteforyou.org.au, free key on signup) is the correct backing for the data APH exposes no clean RSS for: Senate divisions, per-member vote breakdowns, member profiles, policy positions, and bills-via-divisions. Verification caveat: the API contract was confirmed from official docs and the auth gate proven live (key=test returns 401), but no authenticated 200 was exercised this session because no key is provisioned. Provision a free key before relying on it.

### 2.2 Modules that can go fully or mostly live (easy tier, RSS aggregation)

- Live (PageLive): already real; productionise only.
- Sources (PageSources): derive health from the same poll.
- Overview (PageOverview): aggregation over the live slices.
- Parliament / Today (PageParliament): daily program plus house news from already-polled RSS.

### 2.3 Modules that go partially live (moderate tier)

- Committees: schedule, inquiries, reports, hearings from RSS; committee profiles (chair, members) stay representative or need scraping.
- Divisions: question and result text from House Divisions RSS; per-member tallies need TheyVoteForYou or a division-list scrape; Senate divisions need TheyVoteForYou (no APH feed).
- Bills: digest existence and link possible, but bill stage and provisions need scraping or PDF extraction. Stays largely representative until a scraper Worker exists.
- Members / Ministers: roster scrapeable infrequently; per-member activity counts have no feed.
- Briefings queue: generation half is already real and local; a real shared queue needs a backend (none exists).

### 2.4 Modules that must stay representative (hard or no-feed)

- Signals enrichment (attention score, action, provenance, 7-factor score, member NER): RSS gives roughly 3 of 18 fields. The scoring pipeline does not exist and is out of scope for 90%.
- Radar: clustering layer on top of enriched signals.
- Watchlists matching: keyword matcher computing matches and trend over the signal stream.
- QON / Patterns: Questions on Notice are not an RSS feed; requires ParlInfo and Hansard scraping plus NLP.
- Bills detail, committee membership, general tabled papers, live chamber proceedings: no clean feed.

Hard rule for honesty: every module that stays representative MUST carry a visible "Representative data" chip and must not present success toasts that imply a backend action occurred.

### 2.5 parlinfo is a dead end

The parlinfo.aph.gov.au Bills Digests feed is NOT usable. It sits behind a hard Azure WAF JavaScript challenge and returned 403 even through a stealth proxy. A plain Cloudflare Worker fetch will also be blocked. Remove the parlinfo entry from the feed list (pages.jsx line 337). For Bills, either use TheyVoteForYou or build a separate scheduled Worker using the browser-rendering binding to render the Bills HTML pages into KV on a cron. Do not route parlinfo through the simple proxy.

### 2.6 Production CORS / Worker plan

A single allowlisted, caching, key-injecting Cloudflare Worker handles every verified feed. Design:

1. Route at a stable path; accept only a `?u=` value matched against a hardcoded ALLOWLIST of the exact verified APH feed URLs plus the TheyVoteForYou base. Reject anything else with 400 so the Worker can never become an open proxy.
2. Fetch upstream with a realistic User-Agent and Accept headers; pass the body through unchanged for RSS, sanitised JSON for TheyVoteForYou.
3. Add the CORS headers the upstream lacks. Once the production origin is known, set Access-Control-Allow-Origin to that exact origin, not `*`. Handle OPTIONS preflight with 204.
4. Cache each feed 5 to 10 minutes via the Cache API (most APH channels declare ttl=60; divisions ttl=10).
5. Store the TheyVoteForYou key as a Worker secret (`wrangler secret put TVFY_KEY`) and inject it server-side so it never reaches the browser.
6. Do NOT route parlinfo through this Worker. Bills needs a separate cron Worker with browser rendering.

Two blocking defects must be fixed before any live RSS works in production (both Verified in code this session):

- Route mismatch. pages.jsx lines 387 to 389 call `https://aph-proxy.jvega019.workers.dev/proxy?url=` but the Worker (src/index.ts line 315) rejects any pathname that is not `/rss` and reads the param `u`, not `url`. Fix the frontend to `/rss?u=` (preferred, one-line) OR add a `/proxy` alias route in the Worker.
- CORS allowlist gap. The Worker ALLOWED_ORIGINS (wrangler.toml line 27) lists only the two :5173 dev origins, parliament-pulse.pages.dev, and pulse.prometheuspolicylab.com. It lacks localhost:8080 (the README dev origin) and any non-pages.dev production or preview origin. Non-listed callers get the :5173 origin echoed back, which fails the browser CORS check. Add the real production Pages origin and localhost:8080.

---

## 3. Prioritised file-by-file work breakdown (parallel-safe)

Work is grouped so that no two work packages touch the same file. Each package can be implemented by a separate agent in parallel. Order of priority is given per package. The data contract (the field shape of every fixture) is held constant so pages and the drawer never need rewriting.

### WP-A: index.html (design and CSS) — highest visual leverage

Owner of: the Fire House re-skin. See section 4 for the concrete spec. Summary of edits, all within `<style>` and the Google Fonts link:

1. Swap the Google Fonts link to IBM Plex Sans, Mono, and Serif; rebind `--sans`, `--mono`, `--serif`.
2. Replace the dark-theme `:root` palette block with the Fire House warm near-black tokens and the single sovereign ember accent (section 4.1). Add `--gold`, `--ember-flash`, and a CSS type scale (`--t-display` through `--t-micro`).
3. Replace the body radial-gradient washes with warm ember-lit ones.
4. Re-anchor the light-theme `:root` block and the structural light-theme overrides to the warmer ember.
5. Add the elevation system (two-step panel recession, bright hairlines, ember-tinted shadows), the command-strip hero styles, the widened sidebar (256px) and command-bar topbar, and the named motion tokens.
6. Add security headers note: index.html cannot set HTTP headers, so this is handled in WP-F via `_headers`.

Second pass within the same file: grep and migrate hardcoded hex literals (`#c9a36a`, `#d7b079`, `#b28a4f`, `#4eaea2`, `#3fa39a`, blue-grey panel literals, `#16242f`, `#0c141d`) to the new variables. Re-verify AA contrast on both themes after the swap.

### WP-B: shell.jsx — sidebar, topbar, drawer, streak

1. F5 (low). Move the streak localStorage WRITE out of the useState lazy initialiser into a `useEffect` that runs once on mount, keyed on whether last open date differs from today, to survive StrictMode double-invocation.
2. F8 (low). Either make the Topbar Refresh navigate to Live then poll, or change its `title` and label so it no longer overpromises a global refresh.
3. F12 (low). Flush the analyst note on drawer close and before signal navigation (j/k), not only on textarea blur, to close the data-loss edge.
4. Redesign chrome (section 4): widen sidebar to 256px, taller brand block, 3px ember active-nav left-border with `#ffffff0c` wash and ember count badge; raise topbar to a command bar with a Plex Mono live clock and a sources-healthy status chip; light the search border on focus.
5. Confidence bar refinement: 5-segment ember-to-gold gradient.

### WP-C: pages.jsx — live path, briefings, buttons, broadcast

1. F1 (high). Branch the Live empty-state message on `location.hostname`: localhost shows the `node proxy-server.js` instruction; production shows the Worker and deployment guidance plus the actual proxy URL that failed. Surface collected feedStatus errors in the panel. Add a `file://` guard advising to serve over http.
2. Route fix (critical, deploy blocker). Change the proxy base at lines 387 to 389 from `/proxy?url=` to `/rss?u=` to match the Worker. Remove the parlinfo entry at line 337. De-duplicate the two feed lists (APH_FEED_URLS here vs APH_FEEDS in data.jsx) by reading from a single source registry.
3. F10 (medium). Clamp `briefs[sel]` with `const safeSel = Math.min(sel, briefs.length - 1)` and guard the preview render with an undefined check.
4. F11 (low). Rewrite the generated-brief label as `for: sig ? (sig.title.slice(0,40) + "…") : sid` to fix the precedence bug that renders "For undefined...".
5. F9 (medium). Add an iframe onLoad timeout or postMessage heuristic to auto-switch the YouTube embed to the offline panel; do not render the LIVE badge until playback is confirmed. Verify the live_stream endpoint still resolves [VERIFY]; if not, switch to the IFrame Player API with a resolved video id.
6. F13 (low). In exportSignalsCSV: append the anchor to the DOM, click, remove, and call `URL.revokeObjectURL` to stop the blob leak.
7. F4 and F15 (medium, the single largest gap). Audit every toolbar and workflow button. For each: either wire a real local-state effect, or visibly mark it as a stub and stop the false success toast. "Export register" reuses the CSV logic over BILLS. "Sort: attention" and "Group by topic" drive local Overview state or are removed. Briefings "Approve" and "Send" must say "(demo)" or be disabled, never toast "Brief sent".
8. Redesign: build the command-strip hero (one dominant 48px KPI plus three secondary stats), push the overview grid to 2.4fr/1fr, raise stat values to 44 to 48px IBM Plex Sans 600 tabular-nums, lift signal titles to 18px serif, recolour attention pills to the fire-to-ash ramp.

### WP-D: store.jsx — hydration, watchlists, archive, modal

1. F14 (high, crash on load for returning users). Merge parsed state over a DEFAULTS object: `return { ...DEFAULTS, ...JSON.parse(raw) }` with a deep merge of nested objects (notes, feeds, watchlistCreated, owners, feedback), or bump the storage key and discard incompatible old state. Verified that line 11 currently returns the raw parsed blob with no merge.
2. F2 (high, dead create-watchlist feature). In WatchlistDetail, resolve against the merged list `[...WATCHLISTS, ...state.watchlistCreated]`. Guard the spark with `const max = Math.max(...w.trend, 1)`.
3. F7 (low). After F2, seed created watchlists with sensible placeholders or compute matches from SIGNALS by name; mark created watchlists as new or empty in the UI.
4. F6 (low). Compute archive "remaining" from the next state inside the setState updater, or as `SIGNALS.filter(x => !state.archived[x.id]).length - 1` clamped at 0, to fix the stale count.
5. F3 (medium). Make watchlistAdds observable (a count on the signal card or a real watchlist entry), or make the toast honestly say it is a design-state stub.
6. F16 (low). Replace first-word substring matching with stable id matching: give WATCHLISTS an explicit keyword and tag list, and resolve committees by a stable id rather than `name.split(" ")[0]`.
7. Redesign: align toast and modal borders to `--line-bright`, swap toast accent to ember, deepen modal shadow.

### WP-E: data.jsx and entities.jsx — source registry and contracts

1. Unify the feed list. Create one canonical source-registry object (replacing the duplication between data.jsx APH_FEEDS and pages.jsx APH_FEED_URLS). Remove the parlinfo entry. Keep per-feed config metadata (fpr, authority, confidence) static; add `lastStatusCode`, `errorDetail`, `lastItemCount` fields for live health.
2. Hold the data contract constant. Keep every fixture field shape unchanged so pages and the drawer need no rewrite. Where a module will go live (Sources, Overview, Parliament/Today), the array shape stays identical; only the source of the values changes (live for those, representative for the rest).
3. Mark representative entities clearly. ENTITIES.ministers already carries "(fixture)"; extend the same explicit flag to every representative-backed entity so the UI can render the chip honestly.
4. [VERIFY] the PARL_STREAMS YouTube channel id and APH_YT_CHANNEL before relying on them; both are asserted in-code and were not verified this session.

### WP-F: deployment, proxy, build, Worker — see section 5

1. Worker route alias or confirm the frontend `/rss?u=` change (coordinate with WP-C).
2. Worker ALLOWED_ORIGINS: add the real production Pages origin and localhost:8080.
3. _headers: add security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) to HTML responses; keep the existing MIME types for .jsx and .js.
4. Switch CDN React to production builds (react.production.min.js, react-dom.production.min.js) with regenerated SRI hashes before public launch; precompile JSX (Vite or esbuild) per the README to drop Babel-in-browser. Acceptable to defer for a soft launch, mandatory for a public one.
5. Rebuild or delete the stale single-file artefacts (parliament-pulse-updated.html, -beta.html). They are gitignored and not served by Pages; either re-run build.py or remove them to stop anyone distributing the broken localhost-only build.
6. Optional: provision the TheyVoteForYou key as a Worker secret; apply D1 migrations on first Worker deploy.

### WP-G: icons.jsx — lowest priority

1. Add any new icons the redesign needs (trend up/down for the `--stat-trend` slot, a live-pulse glyph). Audit existing icons for stroke-weight consistency against the bolder shell. No correctness defects were found here.

---

## 4. The bold redesign spec, concretely

This is a re-skin and a re-weighting, not a rebuild. The component bones (signal cards, attention pills, confidence bars, source-health dots, drawer, brief preview) are correct; they are under-dressed. Five bold moves do the work.

### 4.1 Palette (dark theme :root)

Commit to the Fire House warm near-black; make ember the single sovereign accent; demote teal to a verification-only semantic.

Background (warm near-black, not blue-grey):
- `--bg: #07080e`
- `--bg-2: #0a0c14`
- `--panel: #11131f`
- `--panel-2: #161826`
- `--panel-hi: #20223440`
- `--line: #ffffff0c; --line-2: #ffffff16; --line-bright: #ffffff2a`

Body washes (replace blue with ember-lit shadow):
`radial-gradient(1600px 900px at 8% -8%, #14100a 0%, transparent 55%), radial-gradient(1100px 760px at 96% 112%, #1a1108 0%, transparent 55%), var(--bg)`

Ink (warm cream, never pure white):
- `--ink: #f5f0e1; --ink-2: #d8d4c5; --ink-3: #a0a4b4; --ink-4: #8a8e9e`

Primary accent (incandescent ember, sovereign):
- `--brass: #f08a3c` (about 6.4:1 on #07080e, AA)
- `--brass-2: #ff9d4f` (hover/glow)
- `--brass-soft: #7a4420; --brass-ink: #160b03`
- `--gold: #d9b779` (secondary numerics, brief accent, about 10:1)
- `--ember-flash: #e0534b` (reserved strictly for LIVE and breaking and high attention)

Secondary accent (verification only, never decorative):
- `--teal: #45b3a4` (connected, healthy, verified only)

Status (Fire House semantic five):
- `--ok/active: #4ade80; --caution/warm: #d4a017; --info: #9aa6b0` (steel-ash, the single sanctioned cool counterpoint, replacing corporate blue); `--escalate/risk: #f87171; --ember-flash: #e0534b`

Light theme (keep it, it is an accessibility asset): re-anchor to warm ember, `--brass: #b5611f`, `--gold: #8a6a28`, teal verification-only at `#1f7068`. Light theme should feel like warm paper, not cool white.

### 4.2 Typography (adopt IBM Plex)

- `--sans: 'IBM Plex Sans', system-ui, sans-serif; --mono: 'IBM Plex Mono', ui-monospace, monospace; --serif: 'IBM Plex Serif', Georgia, serif`
- Body base 14px, line-height 1.45, tracking 0.005em. Tabular figures (`font-variant-numeric: tabular-nums`) on all data cells and stat values so columns lock.
- Stat values: 44 to 48px IBM Plex Sans 600, -0.02em, tabular-nums, unit appended in Plex Mono 13px at `--ink-3`. A 44px engineered numeral reads as a terminal; a 34px serif numeral reads as a magazine.
- Reserve Plex Serif for editorial moments only (signal titles, brief preview, drawer headline). Serif means narrative; sans-tabular means data.
- Eyebrows, kickers, nav-groups, table headers, stat-labels: Plex Mono 10px, weight 600, letter-spacing 0.18em everywhere (removes the current 0.14 / 0.16 / 0.2em drift).
- Signal title: serif, 18px / 1.25.
- Page title: 28px Plex Serif 600, tracking -0.012em; 32px masthead option for the primary dashboard.
- Establish a CSS type scale (`--t-display` 56, `--t-masthead` 30, `--t-headline` 23, `--t-subhead` 18, `--t-body` 15, `--t-label` 10, `--t-micro` 9) so the codebase adopts it without per-component edits.

### 4.3 Layout (re-weight for hierarchy and density)

- Sidebar: 256px, darker denser rail, 52px brand mark, 3px ember active left-border plus `#ffffff0c` wash, ember top-glow on the mark.
- Topbar: a true command bar; 14px vertical padding, 1px ember underglow on scroll, a pinned Plex Mono live clock and market-style status cluster on the right, search field widened to 620px with an ember focus border.
- Content grid: a full-width command-strip hero row above the fold (one dominant 48px KPI flanked by three 28px secondary stats); overview split pushed to 2.4fr/1fr; inter-panel gap 14px; content padding 20px on desktop.
- Elevation: a real two-step system. Panels recede into a darker warm slab with a 1px warm hairline and an ember-tinted shadow (`0 1px 0 #00000060, 0 20px 50px -28px #00000090`, inset `0 0 0 1px #ffffff08` on key panels). Signal cards lift one step above panels. Invert the current "lighten to separate" approach: go darker and warmer for recession, brighter hairline for the raised edge.
- Data density: tables get tabular-nums, 8px/12px cell padding, a sticky header with a faint ember bottom-rule. Radar rows and watchlists gain Plex Mono numerics.

### 4.4 Motion (Fire House tier model)

- Tokens: `--ease-functional: cubic-bezier(0.2,0,0,1); --ease-entrance: cubic-bezier(0.22,1,0.36,1); --ease-textural: cubic-bezier(0.34,1.56,0.64,1)`; durations `--dur-micro: 120ms, --dur: 200ms, --dur-page: 280ms`. Rebind existing transitions.
- Functional (always): hover, focus, press, drawer, modal at 120 to 280ms. Align the drawer to 280ms entrance ease.
- Textural (justify each): signal-card hover lift reduced to translateY(-1px) with a sharper ember-tinted shadow.
- One signature flourish, surgical: a slow ember-pulse (1.6s ease-in-out, opacity 1 to 0.45) on the LIVE badge and the live-strip left-border, replacing the generic white pulse. This is the one place the Prometheus fire identity breathes.
- A KPI count-up on the hero command-strip number on first paint (Plex Sans tabular-nums, 600ms decel ease).
- Honour prefers-reduced-motion (already present): the pulse and count-up fall back to static.

### 4.5 Component refinements

- Buttons: replace the dated `.btn.primary` gold gradient with a flat-to-subtle ember `linear-gradient(180deg, #f5934a, #e07d33)`, 1px `#c4661e` border, `--brass-ink` text, 1px ember outer glow on hover (no brightness filter).
- Attention pills: high to ember-flash, med to caution-gold, low to steel-ash (a deliberate fire-to-ash ramp, not red/amber/blue). Plex Mono 10px, 0.18em.
- Signal card: 4px attention left-border as a status spine; ember-flash for high attention; serif title at 18px; tabular-nums on sig-id and sig-time.
- Confidence bar: 5-segment ember-to-gold gradient so confidence reads quantitatively.
- Source-health dots: keep shape redundancy for deuteranopia; recolour live to `#4ade80`, broken to ember-flash.
- Brief preview: keep the warm-paper treatment; accent `--gold`, heading Plex Serif 600 so the printed brief reads as a real document against the terminal shell.
- Topbar status cluster: Plex Mono live clock plus a sources-healthy count chip.
- Stat block: optional `--stat-trend` slot (ember up, steel-ash down).

---

## 5. Deployment steps and exact deploy commands

The mechanism is split: Cloudflare Pages serves the multi-file frontend (project parliament-pulse, account ccc93b2330067a401bf57fc9ac736e7a, no wrangler.toml, config via dashboard plus _headers plus .wrangler cache); a separate Cloudflare Worker (aph-proxy, at C:\Users\jvega\parliament-pulse\workers\aph-proxy, with KV, D1, crons) is the production proxy.

Fix the two blockers BEFORE deploying or the live page stays dark:
1. Frontend route: change pages.jsx lines 387 to 389 to `https://aph-proxy.jvega019.workers.dev/rss?u=` (Verified the Worker serves /rss?u=).
2. Worker ALLOWED_ORIGINS: add the real production Pages origin and localhost:8080 in wrangler.toml line 27.

Frontend (Cloudflare Pages, the multi-file source that actually serves):

```
cd C:\Users\jvega\Claude-Workspace\03_Projects\parliament-pulse
npx wrangler@4 pages deploy . --project-name=parliament-pulse
```

Worker (separate folder, its own wrangler.toml pinning wrangler 4.84.1):

```
cd C:\Users\jvega\parliament-pulse\workers\aph-proxy
npx wrangler d1 migrations apply parliament-pulse-archive --remote   # first deploy only
npx wrangler secret put TVFY_KEY                                      # TheyVoteForYou key, server-side only
npx wrangler secret put RESEND_API_KEY                               # optional, email digest only
npx wrangler deploy
```

Optional single-file rebuild (only if distributing the gitignored .html artefacts, which Pages does not serve):

```
python build.py
```

Verify before relying on it:
- Run cf-list.ps1 and cf-worker-url.ps1 (need CLOUDFLARE_API_TOKEN as a User env var) to confirm both Worker and Pages exist and the workers.dev subdomain is jvega019 [VERIFY].
- Confirm the deployed Pages origin matches the Worker CORS list and the non-localhost branch in pages.jsx.
- Before public launch: switch CDN React to production builds with regenerated SRI hashes, precompile JSX, and add security headers to _headers.

---

## 6. Risks and what could break

- Half-migration across roughly 11,000 lines. The bolder palette only lands if the hardcoded hex literals are migrated. Mitigation: do the :root swap first for about 80% of the lift, then sweep `#c9a36a`, `#d7b079`, `#b28a4f`, `#4eaea2`, `#3fa39a`, and the blue-grey panel literals in a second pass within WP-A.
- Contrast regression. The hotter ember and warmer near-black must be re-verified at AA, especially the 10px attention pills and the light theme. Mitigation: re-run the documented ratios against the new tokens before shipping.
- Two themes double the work. Every palette change must be made in both dark and light :root blocks plus the roughly 80 light-theme structural overrides, or light mode breaks.
- Font reflow. IBM Plex Sans has a larger x-height than Inter, so the 14px base and pixel-tuned components (nav-item height, chip and pill padding, table density) need a visual sweep to avoid clipping. Mitigation: change the font, then pass over the dense components once.
- Accent monoculture. Ember (#f08a3c) and ember-flash (#e0534b) could read as the same alarm colour at small sizes. Mitigation: reserve the red strictly for LIVE, breaking, and high attention, never for brand or navigation.
- Returning-user crash (F14). Until the hydration merge ships, any returning user from an earlier build whose saved state lacks newer keys hits a thrown "undefined is not iterable" on load. This is the single highest-risk correctness defect; ship WP-D item 1 first.
- Live path stays dark. If either blocker (route or CORS) is missed, every production feed fetch 404s or fails CORS and the headline feature shows zero items. Deploy both fixes together.
- Worker fragility on first deploy. /archive endpoints fail unless D1 migrations are applied; the database_id in wrangler.toml must point to a real provisioned D1 instance.
- parlinfo regression. Do not reintroduce the parlinfo Bills Digests feed; its Azure WAF will 403 the Worker and break the feed list silently.
- TheyVoteForYou unverified at 200. The auth gate is live but no authenticated success was exercised. Provision the key and confirm a 200 before marking any TheyVoteForYou-backed module as live.
- In-code assertions [VERIFY]: the PARL_STREAMS YouTube channel id, APH_YT_CHANNEL, and the workers.dev subdomain. Verify live before relying on them.

---

## Summary

Parliament Pulse is a 72/100 build whose core interaction layer works but which reads as a demo because only one module is live, the shell ignores its own Fire House identity, and a handful of correctness defects plus dead buttons undermine trust. The path to 90%+ is: fix the four high and medium defects (F14, F2, F1, F10), audit the toast-only buttons, connect the six verified APH feeds plus TheyVoteForYou through a fixed and allowlisted Worker proxy, execute the Fire House re-skin as a re-weighting not a rebuild, and keep the enrichment-dependent modules honestly flagged as representative. The work splits into seven file-isolated packages for safe parallel implementation. The two hard deploy blockers (the /proxy versus /rss route mismatch and the CORS allowlist gap) must be fixed before the live page will work.
