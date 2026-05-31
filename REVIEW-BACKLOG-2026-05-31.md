# Parliament Pulse — production-readiness backlog (2026-05-31)

Source: 8-dimension multi-agent review (design, UX/IA, correctness, accessibility,
performance, security, data-honesty, code quality) + consolidation. 87 findings,
0 P0, 18 P1, ~31 P2, ~16 P3. Goal: finished, hyper-quality, functional site.
Target = the LIVE Babel app in this folder. Worker = `C:\Users\jvega\parliament-pulse\workers\aph-proxy`.

Verdict: strong register-faithful build, above median; three pillars gate "hyper quality":
(1) data-honesty fabrications on the default page, (2) modal a11y parity, (3) two untrusted-RSS
injection sinks + dev React builds.

Paths are absolute. Each item: ID | sev | file | location | fix.

---

## BATCH A — Resilience + correctness foundation (frontend)

- **PERF-2** P1 | index.html:874-875 | Swap `react.development.js` + `react-dom.development.js` to `react.production.min.js` + `react-dom.production.min.js` (pinned 18.3.1) and REGENERATE the SRI `integrity` hashes (current hashes pin the dev files and will block load otherwise). Verify mount after.
- **CQ-ERR** P1 | app.jsx:27-43 | Add a class `ErrorBoundary` (componentDidCatch + getDerivedStateFromError) rendering a Fire House styled fallback with a Reload action. Wrap the page region: `<ErrorBoundary>{renderPage()}</ErrorBoundary>`. Optionally wrap DetailModal and Drawer separately so a modal throw does not kill navigation.
- **FUNC-1** P1 | pages.jsx:1366,1375 (PageWatchlists grid card) | Mirror the modal guard: `const trend = Array.isArray(w.trend) ? w.trend : []; const max = Math.max(...trend, 1);` and render `trend.map(...)`. Also harden createWatchlist shape at hydration (coerce each watchlistCreated entry's trend to array, matches/keywords to numbers).
- **FUNC-7** P3 | store.jsx:426-429 (BillDetail) | `const min = ENTITIES.ministers[b.minister]` and render the minister tag only if `min` truthy.
- **MAINT-7** P3 | store.jsx:451-452 (MemberDetail), 482-483 (MinisterDetail) | Move `useStore()` and all hook calls ABOVE the `if (!m) return` early return, matching CommitteeDetail/BillDetail/FeedDetail.
- **FUNC-9** P3 | pages.jsx:1084 (PageParliament daily program) | Invert: `className={"tl-item " + (billRef ? "teal" : "")}` so tracked-bill rows get the teal accent (teal marks notable items everywhere else).
- **A11Y-7** P1-adjacent | shell.jsx:370 (SignalCard onKeyDown) | `onKeyDown={e => { if (e.key==="Enter"||e.key===" ") { e.preventDefault(); openSignal(s.id); } }}` so Space does not scroll the page. Audit other role=button divs.
- **A11Y-11** P3 | icons.jsx:5-6 | Add `aria-hidden="true"` and `focusable="false"` to the default Icon props (labelled icons can override).
- **A11Y-12** P3 | shell.jsx:335-340 (theme toggle) | Add `aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}` (keep title).

---

## BATCH B — Worker security (cwd = C:\Users\jvega\parliament-pulse)

- **SEC-1** P1 | workers/aph-proxy/src/digest.ts:144 (renderDigestHtml href="${i.link}") | i.link is untrusted RSS, interpolated raw into an emailed href (outside CSP). Add `function safeUrl(u){ try{ const p=new URL(u); return (p.protocol==="https:"||p.protocol==="http:")?u:"#"; }catch{ return "#"; } }` and write `href="${escapeHtml(safeUrl(i.link))}"`. Extend escapeHtml to also escape single quote (`&#39;`).
- **SEC-3** (worker half) P2 | workers/aph-proxy/src/index.ts:65-70 SECURITY_HEADERS | Add `"strict-transport-security": "max-age=31536000; includeSubDomains"`.
- **SEC-4** P2 | workers/aph-proxy/src/index.ts:50-63 corsHeaders | Fail CLOSED: `const accepted = list.includes(origin) ? origin : null;` and add the allow-origin header only when accepted is non-null. Never fall back to `"*"`. Keep `Vary: Origin`.
- **SEC-8** P3 | workers/aph-proxy/src/index.ts:356-367 upstream fetch | Set `redirect:"manual"` and re-validate the Location URL against protocol + ALLOWED_HOSTS before re-fetching (or reject redirects since APH feeds are stable). At minimum verify `upstream.url` hostname is still allowlisted before caching/returning.
- **SEC-7** P3 | workers/aph-proxy/wrangler.toml + app-tracker.md:29 | Doc reconcile: Worker has no TVFY usage (only RESEND_API_KEY). When TVFY is wired, add via `wrangler secret put TVFY_KEY` (never [vars], never frontend). Note in tracker that TVFY is not yet implemented.

---

## BATCH C — Data honesty (frontend; reputationally critical)

- **HONESTY-1** P1 | pages.jsx:119,153,262; shell.jsx NAV:29 + fallback:323; pages.jsx PageSources 752-753 | SOURCE_REGISTRY has exactly 6 feeds. Kill every "13/15 sources live" / "15 sources" / "Healthy: 13" / "24 items ingested" literal. Drive ALL source counts from a shared selector: `total = SOURCE_REGISTRY.length` (6); `live` = count actually returning data from the poller. On Overview (no poller) show "6 official feeds configured" with no live/healthy split. Set NAV sources count to 6. Replace fabricated Sources stat tiles with registry length and "—" where no real metric exists.
- **HONESTY-2** P1 | pages.jsx PageOverview:112-126 | Overview (default landing) has NO representative banner. Add the same inline `.design-banner` used on every other page (Sources 734, Committees 903, Bills 949, Parliament 1059, Briefings 1250, Watchlists 1348, Radar 1428), at the top of PageOverview before OnboardingGuide, stating signal counts, deltas and committee/source tiles are representative and only the Live RSS page polls real feeds.
- **HONESTY-3** P1 | store.jsx detail modals (CommitteeDetail 274, BillDetail 391, MemberDetail 449, MinisterDetail 480, DivisionDetail 497, RadarDetail 609, WatchlistDetail 566); flag stamped entities.jsx:209-214, data.jsx:400-403 | Entities carry `representative:true` but no modal renders a chip. In ModalHead, accept the entity (or a `representative` prop) and conditionally render `<span className="chip-fixture">Representative data</span>` next to the kicker. At minimum flag the quantitative claims (member QON/Hansard counts, division vote breakdown, bill provisions/timeline). Pure render-side.
- **HONESTY-4** P1 | pages.jsx PageLive:577-605 (APH connectors panel) | Panel asserts 8 named connectors "live" with green dots + "6 connected" header; they are static hyperlinks, header count disagrees with 8 cards, descriptions overclaim ("Votes within 2 min of call"). Relabel to "Official APH links" / "Source pages", remove green live hdots and the "N connected" count. If a live distinction is wanted, only SOURCE_REGISTRY feeds currently returning data may carry a live dot; everything else neutral / "not connected" (match the Sources-page "Not yet connected" panel 839-861).
- **HONESTY-5** P2 | data.jsx SOURCE_REGISTRY legacy fields 34,47,60,73,86,99 (status:"live", last:"08:11", today:N, parser:"Valid"); rendered Overview 265-271 + Sources table 769-782 + FeedDetail store.jsx 536-555 | Either null the legacy live-health fields so they render "—" until the runtime poller populates lastStatusCode/lastItemCount, or carry the Sources-page disclosure to the Overview source-health panel. In FeedDetail replace the fabricated 5 "Recent items" and "Parser test passed" toast with real polled items or an explicit representative label.
- **HONESTY-6** P2 | pages.jsx:284-287 ("Channel ID verified May 2026") vs entities.jsx:192-200 ([VERIFY] same id NOT verified) | Internal contradiction. Reconcile: either verify channel id `UCzx6ti0rql6Q2Dc2zSAPmuA` against the live @AUSParliamentLive channel and drop the [VERIFY], or change the pages.jsx comments to "asserted, not verified this session". Keep the offline-fallback behaviour.
- **HONESTY-7** P2 | pages.jsx PageLive:551-559 (src-badge live dot + "Since 09:30 AEST") + page-sub:538 | Remove the green hdot and hardcoded "Since 09:30 AEST", or derive badge state from the LiveBroadcast loaded/offline state. Soften page-sub to describe only what is wired (official broadcast embed + live RSS), not "all wired to the signal engine".
- **HONESTY-8** P3 | data.jsx:134-135 (provenance invented $100m keyword, byte counts, exact 0.86 arithmetic, GUID); drawer renders shell.jsx | Add a "Representative" chip to the provenance/score section heading inside the signal drawer, or tone down the manufactured precision (drop invented byte counts and GUIDs).

---

## BATCH D — Accessibility (contrast, forms, headings) (frontend)

- **A11Y-1** P1 | pages.jsx:1306 (PageBriefings, `<a style={{color:"var(--gold)"}}>` inside .brief, bg #f4efe4 = 1.66:1) | Introduce `--brief-link` (e.g. #5a4310, ~6.5:1 on #f4efe4), add `text-decoration:underline` to brief anchors, replace var(--gold) on 1306.
- **A11Y-2** P1 | index.html:642-643 `--brief-accent #8a6a28` (4.39:1 on #f4efe4), applied .brief h5/.meta 10.5-11px | Darken to ~#6f5418 (clears 4.5:1) in both :root and :root[data-theme="light"]. Re-verify.
- **A11Y-FORMS** P1 | pages.jsx PageSources selects 803-806 & 809-812, inputs 794-798; PageWatchlists name input 1359; store.jsx owner inputs 378,436 | Add `aria-label="Source type"` / `"Refresh cadence"` to the selects; add id+htmlFor (or wrap) for Display-name + RSS-URL inputs; `aria-label="New watchlist name"` (1359) and `aria-label="Owner name"` (378,436).
- **A11Y-6** P2 | pages.jsx page-title h1 (118) → panel-title h3 (180,195) no h2; Drawer title div shell.jsx:551; modal title div store.jsx:266 | Promote panel-title h3→h2. Change `.h-drawer` title to `<h2>`, demote its h4s to h3. Change ModalHead title to `<h2 id=...>` and wire `aria-labelledby` (pairs with UX-1); demote modal section h4s to h3.
- **A11Y-9** P2 | index.html .att.high 504-505 (~4.8:1) and .nav-item .count.nav-live #fff on #e0534b 277 (~3.5:1) | For the LIVE count/badge darken ember bg to ~#c4382f under white (clears 4.5:1) or use near-black text. For .att.high nudge text toward #ef6a5e or deepen tint. Re-verify >=4.5:1.
- **A11Y-10** P3 | pages.jsx 228-232, 569-570, 1087 (`<a href="#" onClick preventDefault openModal>`) | Convert to `<button class="linklike">` with the same onClick; add a shared `.linklike` style (inherit colour, underline, no chrome).

---

## BATCH E — Security/headers (frontend)

- **SEC-2** P1 | pages.jsx parseRSSXml 444-453 + render 669 (`href={e.link || e.sourceUrl}`) | Validate scheme at parse time before pushing: `const ok = /^https?:\/\//i.test(link); if(!ok) return;` Repeat coercion at render so href can never carry a non-http(s) scheme. Apply to e.sourceUrl too.
- **SEC-3** (frontend half) P2 | _headers /* block 30-34 | Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- **SEC-6** P2 | _headers /* block 30-34; embed pages.jsx LiveBroadcast | Add `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`. Restrict the YouTube iframe via its `allow` attribute (autoplay; encrypted-media) and prefer `youtube-nocookie.com` origin (already in CSP frame-src).

---

## BATCH F — UX / interaction parity (frontend)

- **UX-1** P1 | store.jsx DetailModal 217-258 (only Escape wired) | Lift the Drawer pattern (shell.jsx 458-483): store document.activeElement on open, rAF-focus the close button (ref on ModalHead close), Tab-trap keydown scoped to .modal, restore focus on close. Give dialog accessible name via aria-labelledby (pairs A11Y-6).
- **UX-5** P2 | store.jsx DetailModal + Drawer | Body scroll-lock: when `modal` or `signalId` set, `document.body.style.overflow="hidden"`, restore on close. Do it in StoreProvider effects keyed on modal and signalId.
- **UX-9** P2 | store.jsx:236 Drawer shell.jsx:501 Topbar:185 (three Escape handlers) | Centralise overlay dismissal: a single top-of-stack Escape dispatcher closing only the topmost layer (modal > drawer > search) by precedence; modal stopPropagation on Escape. Optional "in <signal>" back-context in modal head when opened over a drawer.
- **UX-10** P2 | shell.jsx Refresh live 324-331 (200ms race), Alerts 332; poller sets window.__refreshLiveFeeds pages.jsx:510 | Remove the 200ms race: poller mount effect consumes a pending-refresh flag the Topbar sets, or expose a ready flag + short retry-poll. For Alerts, wire a real (even fixture) alerts panel or label it clearly as a placeholder.
- **UX-2** P1 | shell.jsx Drawer visibleSigs 448,502-509; PageSignals pages.jsx 1479-1530 | The active page publishes its current ordered/filtered signal id list to the store (setVisibleSignalOrder on filter/sort change); the Drawer navigates that list when present, falling back to the global non-archived list. The list the drawer walks must match what is on screen.
- **UX-6** P2 | shell.jsx flat slice(0,4) 207,211; render 264,304 | Show total count per group ("Signals (12)") and a "See all 12 signals" row that closes the palette and routes to PageSignals pre-filtered by the query.
- **UX-8** P2 | shell.jsx onBlur setTimeout 200ms 243 + onMouseDown preventDefault 261 | Replace blur-timeout with a document mousedown listener that closes when click is outside .search, plus Escape. Handle selection on option mousedown.
- **FUNC-2** P2 | store.jsx CommitteeDetail:315, BillDetail:443, MemberDetail:474 ("Watch"/"Track" fire success toast, never call addWatchlist) | Wire each to the store (addWatchlist + show watched state) OR relabel as demo controls (title="Demo control…", toast "(demo): watchlist persistence not wired"). No plain success toast on a no-op.
- **FUNC-3** P2 | store.jsx isWatched defined 150, exposed 185, zero consumers | Consume isWatched in SignalCard (~shell.jsx:380) and the drawer Watchlist button (shell.jsx:690): render filled/active state when watched; make the button toggle, or change toast to "Already on watchlist" when key already true.
- **UX-11** P2 | store.jsx addWatchlist 138-149 toast-only | Route all track/watch through the persisted store and render a "Tracked items" section on PageWatchlists (or per-entity "Watching" state). Show watched state inline mirroring SignalCard feedback echo (shell.jsx:388-392). With FUNC-2/FUNC-3.
- **FUNC-4** P2 | pages.jsx PageWatchlists config panel 1382-1418 (keywords/committees/thresholds/audit hardcoded "Digital government") | Drive panel from selectedWl (watchlistKeywords(selectedWl) for chips, derive thresholds/committees per watchlist) OR add a Fixture chip + sentence that config is illustrative and identical across watchlists in this build.
- **FUNC-5** P2 | shell.jsx Topbar results useMemo 191-201 | Broaden: members also test m.party and (m.roles||[]).join(' '); committees also c.portfolio and c.chamber; bills also b.portfolio and b.stage. Lowercase-include each.
- **MAINT-4** P2 | pages.jsx PageCommittees matchId 876-877 (first-word prefix, falls to committees[0]); PagePatterns surname ladder 1179 | Add explicit id fields to COMMITTEE_ITEMS and QON_PATTERN.items in data.jsx and read directly. Where a match can fail, render a disabled/non-clickable row rather than defaulting to index 0. Remove the surname includes() ladder.

---

## BATCH G — Responsive (frontend)

- **UX-3** P1 | index.html @media(max-width:780px) 730-737; .side 219-227 | Add a mobile top-bar hamburger that toggles the sidebar as an off-canvas overlay (reuse .drawer-back dimming), defaulting collapsed below 780px. Keep desktop sticky sidebar unchanged. Persist open/closed, close on nav-item select.
- **UX-4** P1 | pages.jsx inline grids: command-strip 128, live-strip 159, PageLive 548, PageBriefings 1263, PageRadar 1446/1454 | Move inline gridTemplateColumns to CSS classes and add max-width:780px overrides collapsing to 1-2 columns. Coordinate with the duplicated .command-strip grid (DESIGN-4).

---

## BATCH H — Performance + code structure (frontend)

- **PERF-1** P1 | pages.jsx PageLive poll()/fetchOne() 473-514 | Replace unbounded Promise.allSettled with a pool of 3: `mapPool(items,limit,fn)`; add AbortController ~8s timeout per fetchOne (abort on cleanup); skip a scheduled poll if one is in flight (inFlight ref). Drop cache no-store unless freshness essential.
- **PERF-4** P2 | shell.jsx Topbar clock 176-180,319 | Extract a TopClock leaf with its own clock state + interval; move fmtClock to module scope. Only the clock re-renders per second.
- **PERF-5** P2 | shell.jsx SignalCard 365-395; store value store.jsx 180-186 | useMemo the context value over [state,toasts,modal,signalId]; React.memo SignalCard reading only its own archived/feedback. Ideally isolate toasts in a separate provider/portal.
- **PERF-9** P3 | pages.jsx LiveBroadcast iframe keyed which+nonce 325 | Debounce/lazy-mount: set src only after chamber settles ~300ms, or loading=lazy and gate autoplay until first interaction.
- **PERF-6** P2 | index.html:11 display=swap; stacks 55-57 | Preload the two key Plex Sans weights (font/woff2 crossorigin) + size-adjust/ascent-override @font-face for fallback. Preconnect already present.
- **PERF-7** P2 | shell.jsx DesignStateBanner 5-16; OnboardingGuide pages.jsx 40-67; .page fadeIn index.html:668; .cs-count-up 411 | Reserve banner min-height (or animate max-height) and switch .page/.cs-count-up to opacity-only animations.
- **MAINT-2** P2 | window.__setPage app.jsx:4; __openModal/__openSignal store.jsx:109-113; __refreshLiveFeeds pages.jsx:510 | Add `navigate(page)` to StoreCtx; Drawer + toast actions call useStore().navigate(). Keep __refreshLiveFeeds only if truly needed and guard every call site uniformly.
- **MAINT-3** P2 | shell.jsx generateBriefMarkdown 397-422 vs pages.jsx generateDailyBrief 90-111; exportSignalsCSV 5-23 vs exportRowsCSV 26-37 | exportSignalsCSV calls exportRowsCSV. Extract buildBriefSections(signal) consumed by both brief generators + the PageBriefings preview. Add csvEscape(v) helper.
- **FUNC-STRICT** P2 | shell.jsx claims StrictMode-safe 50,60-61; app.jsx:43 not wrapped | Enable `<React.StrictMode>` and verify streak counter + live poller behave under double-mount (no double-poll/double-toast), OR remove the StrictMode-safety claims. Preferred: enable and confirm.
- **FUNC-NOTEHOOK** P2 | shell.jsx note-reset effect eslint-disable 491-493; flushNote 435 | Add invariant comment linking flushNote and the note-reset effect as a pair; ideally colocate in a useAnalystNote(signalId) hook owning both reset and flush.
- **FUNC-INDEXKEY** P1 | pages.jsx PageBriefings key={i} 1267 + sel by index 1227,1246-1268; Overview 244; Parliament divisions 1099; Radar 1453; CommitteeTable 887 | Track selection by stable identity (b._sid for generated, b.type+b.for for static) and key rows by that id. Divisions key={d.when+d.bill}; Radar key={r.issue}; CommitteeTable key={r.name+r.when}.
- **UX-12** P3 | shell.jsx liveCount 40-47, render 113, static NAV 19-30 | Derive all nav counts from store/data (watchlists = WATCHLISTS.length+created; sources = registry+custom) or drop static badges.
- **UX-13** P3 | shell.jsx note "(auto-saved)" 657-659; feedback "Logged" 671-681 | Add a quiet "Saved" micro-confirmation near the note on flush; drop either the toast or the inline block for feedback so each action confirms once.
- **UX-14** P3 | pages.jsx PageBriefings "New brief" toast 1260 | Make "New brief" navigate to PageSignals (optionally auto-open first priority signal) so the instruction is also the action.
- **MAINT-6** P3 | parliament-pulse-beta.html, parliament-pulse-updated.html | Move snapshots to archive/ (or delete) and note that data/entities/store/shell/pages.jsx are the only authoritative sources.

---

## BATCH I — Design cohesion (Claude owns — judgment work)

- **DESIGN-9** P2 | index.html palette | Reduce to a true five: ink-scale, ember (priority/live), gold (numeric/secondary), teal (verified), ONE risk colour. Replace cool --ok #4ade80 with a warm positive (or ember/gold for positive deltas); the "▲ vs yesterday" delta pages.jsx:132 should not be green. Make caution distinct from gold or merge.
- **DESIGN-2** P2 | index.html ember inventory | Demote >=3 ember uses to ink/line: Fixture/match-count pills neutral (--ink-3 on --panel-hi); confidence bar gold-only or steel-to-gold; .tag.brass the exception not default. Reserve ember strictly for brand mark, primary action, active selection, live/priority. Document the final ember inventory as a comment.
- **DESIGN-1** P2 | demo/fixture chrome | Collapse to ONE honesty surface: keep the single dismissible global DesignStateBanner; remove per-page banners (but Overview still needs HONESTY-2 — fold into a quiet kicker tag). Replace inline "Fixture" pills + "(demo)" suffixes with one quiet affordance (small mono "DEMO" in the page kicker + disabled styling on non-wired buttons). Demote demo-only controls from primary to ghost; at most one live primary per header.
- **DESIGN-8** P2 | app.jsx:32-33 banner above sticky topbar | Render banner full-bleed across both columns or below the topbar so the topbar is the true top edge aligning with the sidebar brand block.
- **DESIGN-5** P2 | empty states pages.jsx 189,207,1290 / PageSignals 1522 / PageLive 628-667 / Parliament 1129 | One EmptyState component (icon + mono kicker + one-line body + optional action) used everywhere; PageLive's richer variant becomes the "error" mode of the same family.
- **DESIGN-6** P2 | .skeleton index.html 670-681 used only PageLive | Extract SkeletonRow/SkeletonCard and render behind async on Overview priority panel, Signals list, Sources table so loading language is consistent + layout reservation-stable.
- **DESIGN-13** P3 | shell.jsx drawer footer 684-699; feedback chips 663-670 | Give feedback row a clear primary affirmative ("Correct priority" filled/teal-verified) distinct from corrective chips; lower-emphasis Archive; exactly one .btn.primary per footer.
- **DESIGN-12** P3 | shell.jsx streak 49-72, render 124-126 | Remove or reframe as neutral provenance ("Session 3 this week" / "Last reviewed: today 09:14") in mono ink-4; drop the reward framing + Math.min cap cosmetics.
- **DESIGN-10** P3 | pages.jsx ▲ 132; ✓⚠✗ 829,831,658; ↗ 373-375,554-556 | Replace ▲ with Icon/styled caret; use existing check/flag/close SVGs in feed tester + error list; drop literal ↗ where Icon name="ext" already renders.
- **DESIGN-3** P2 (L) | type scale tokens bypassed by inline px | Introduce utility classes (.t-body,.t-label,.t-stat,.t-kpi) and replace inline fontSize. Collapse 12/12.5/13/13.5 cluster to two steps (body 13, body-sm 12). Reconcile --t-body with body font-size + card body.
- **DESIGN-11** P3 | hero KPI 48 inline vs .cs-kpi 48 vs .stat-value 44 | One KPI size + one secondary-stat size as tokens (--t-kpi,--t-stat); .stat-value and .cs-kpi reference --t-kpi; delete inline fontSize overrides. Apply count-up consistently or not at all. (Subsumed by DESIGN-3.)
- **DESIGN-4** P2 (L) | inline styles defeat spacing; duplicated grids | Define --sp-1..6 + .list-row/.data-row utilities with one canonical vertical padding. Delete inline grid-template pages.jsx:128 and let .command-strip own it (fix ratio in ONE place — with UX-4).
- **DESIGN-7** P2 (L) | light theme afterthought | Move hardcoded dark hex in base CSS (.side gradient 220, .topbar 298-300, scrims, search-results shadow, brand-mark glow) onto CSS variables so light overrides by token; audit JSX for inline #fff/#000 scrims. If parity unreachable before launch, ship dark-only and hide the toggle.

---

## DEFERRED (correct per "polish in place"; Vite-migration territory — document, do not do now)

- **SEC-5** | _headers:34 | Drop 'unsafe-eval'/'unsafe-inline' once JSX precompiled (needs Vite). Until then close every untrusted-input sink (SEC-1, SEC-2).
- **PERF-3** | Babel in-browser compile | Partial now: add preload-as-fetch for the 6 JSX files + a static skeleton in #root for first paint. Full fix = Vite.
- **MAINT-1** | implicit window globals | Namespace `window.PP = {...}` (L). Full fix = Vite modules.
- **PERF-8** | SIGNALS inlines drawer-only detail | Lazy id-keyed lookup before going live. No change today.

---

Recommended fix order (from consolidation):
PERF-2, CQ-ERR, FUNC-1, FUNC-7, MAINT-7, SEC-1, SEC-2, SEC-3, SEC-4, SEC-6, A11Y-1, A11Y-2,
A11Y-FORMS, A11Y-7, A11Y-9, A11Y-11, A11Y-12, HONESTY-1, HONESTY-2, HONESTY-4, HONESTY-3,
HONESTY-5, HONESTY-7, HONESTY-6, HONESTY-8, UX-1, A11Y-6, UX-5, UX-9, UX-10, FUNC-2, FUNC-3,
UX-11, FUNC-4, FUNC-5, UX-2, UX-6, UX-8, MAINT-4, FUNC-9, UX-3, UX-4, PERF-1, PERF-4, PERF-5,
PERF-9, MAINT-2, MAINT-3, FUNC-STRICT, FUNC-NOTEHOOK, FUNC-INDEXKEY, UX-12, UX-13, UX-14,
DESIGN-9, DESIGN-2, DESIGN-1, DESIGN-8, PERF-7, DESIGN-5, DESIGN-6, DESIGN-13, DESIGN-12,
DESIGN-10, A11Y-10, DESIGN-3, DESIGN-11, DESIGN-4, DESIGN-7, PERF-6, MAINT-6, SEC-7, SEC-8,
PERF-8, MAINT-1, PERF-3, SEC-5

---

## VERIFICATION + PASS V — 2026-05-31 (commit b0e52ec, deployed 218fdfdd)

Independent 10-agent verification workflow (9 batch auditors + build-integrity, Opus
synthesis) audited the committed Codex passes against the actual code, NOT the commit
claims. Verdict: HOLD on the prior state. build-integrity PASS (all 8 checks). Counts:
53 DONE / 16 PARTIAL / 4 NOT_DONE. Two P1 responsive items gated ship.

Fixed in pass V and browser-verified (dark / light / mobile 375px, prod 0 console errors):
- UX-3 (P1) DONE — mobile-nav state persists via localStorage `pp-nav-open`.
- UX-4 (P1) DONE — `.radar-row` class applied; radar table now collapses to one column
  on mobile (confirmed gridTemplateColumns single-track at 375px). `.grid` and
  `.live-strip` already collapsed via existing media queries.
- FUNC-STRICT DONE — React.StrictMode enabled (no-op under prod React build; removes the
  stale safety claim). No double-render observed in prod (2 banners, not 4).
- DESIGN-9 DONE — positive/affirmative `--ok` folded into the teal verification family in
  both themes; true five-colour palette documented. No green sixth hue.
- A11Y-9 DONE — light-theme `.att.high` was ~2.8:1 coral on warm paper (fail); added
  `#b02a20` override, verified computed colour rgb(176,42,32) ≈ 6.2:1 AA.
- DESIGN-2 DONE — sanctioned ember inventory documented next to `--brass`.
- DESIGN-7 (frontend) DONE — topbar underglow on `--topbar-underglow` (both themes).
  Video-overlay scrims left dark intentionally (correct over video in both themes).
- DESIGN-12 DONE — streak line reframed as factual weekly stat, not a reward.
- PERF-7 DONE — `.design-banner` min-height reserves space (no CLS on dismiss).
- UX-13 DONE — duplicate feedback toast removed; inline chip is the single confirm.

Auditor false negatives (verified already DONE, no change needed):
- DESIGN-13 — `.fb.affirmative` rule exists (index.html:597).
- DESIGN-8 — banner sits below the topbar, which the item explicitly accepts.
- DESIGN-5 — PageLive error block already uses the shared `.empty-state.error` class.

Deliberate deviation (documented, not a miss):
- DESIGN-1 — per-page honesty banners RETAINED. This is a public Prometheus Policy Lab
  site; data-honesty (BATCH C, reputationally critical) outranks design-cohesion (P2).
  The cost of a redundant honesty banner is minor; the cost of under-flagging fixture
  data on a public site is reputational. Honesty also preserved via inline chips +
  per-modal Representative-data chips + global dismissible DesignStateBanner.

Remaining tail — invisible code hygiene only, no user-facing/honesty/a11y impact
(suitable for a Codex mechanical pass, off the expensive lane):
- DESIGN-3 (34 inline fontSize → utility classes), DESIGN-4 (17 inline grids → classes),
  DESIGN-6 (extract SkeletonRow/Card to Overview/Signals/Sources), MAINT-2 (remove
  window.__setPage/__openModal globals), UX-9 (single Escape dispatcher; current
  guard-chain is functionally fine).
- PERF-6 — fallback @font-face (the substantive CLS fix) is in place; the woff2 preload
  links are skipped as fragile (version-hashed gstatic URLs 404 on font bumps).
- DEFERRED per "polish in place": SEC-5, PERF-3, MAINT-1, PERF-8 (all Vite-migration).

Bottom line: shippable. Every P1 across all batches is closed; build is AA-accessible,
responsive, honest, and Fire-House-coherent in both themes. Production live and verified.

---

## PASS W — mechanical tail (2026-05-31, commit 17756c4, deploy 27e65ada)

Codex (workspace-write) did the spec-bound mechanical sweeps; Claude browser-verified
every changed path (nav, modal-open, signal-drawer functional; grids collapse at 375px;
production 0 console errors).

- DESIGN-4 DONE — inline gridTemplateColumns in pages.jsx moved to named CSS classes
  with mobile collapse rules. Verified single-track at 375px, full columns at desktop.
- MAINT-2 DONE — window.__setPage/__openModal/__openSignal removed; call sites use
  useStore(). window.__refreshLiveFeeds retained. Navigation/modals/drawer verified post-removal.
- DESIGN-6 CLOSED (scoped) — SkeletonRow/SkeletonCard extracted; PageLive uses the row.
  NOT wired onto Overview/Signals/Sources: they render synchronously from fixture data,
  so a skeleton there would be a dishonest fake-loading state.
- DESIGN-3 WON'T-FIX (rationale) — the type scale has no exact token for the inline sizes
  in use (10.5/11/11.5/12/12.5/13.5/14/16/18/22). Mapping shifts sizes 1-2px across dense
  tables for zero user-visible benefit + layout-shift risk. Codex and Claude independently
  judged forcing it a net negative. Needs a deliberate type-scale decision, not a sweep.

REMAINING BACKLOG = only the Vite-migration deferrals (SEC-5, PERF-3, MAINT-1, PERF-8),
which require a JSX build pipeline that does not yet exist. Everything actionable without
a new build pipeline is now done, verified, and deployed.
