# Parliament Pulse: live-wiring and deploy spec (executable)

**Status:** Execution spec, designed 2026-07-19 by the Fable design session. An executor session implements this mechanically.
**Ground truth inputs (all Verified this session):** `docs/state-contract.md` (live Worker v0.15.0 `/state` payload), `docs/licence-architecture.md` (facts-and-links display contract), `pages.jsx`, `store.jsx`, `shell.jsx`, `data.jsx`, `tests/state-contract.test.mjs`, the GitHub remote refs, and the `deploy-web.yml` content read from `main` via the GitHub API.
**Branch:** `review/honesty-hardening` (28 commits ahead of `origin/master`, Verified via `git log --oneline origin/master..HEAD | wc -l`).
**Build rule:** every edited `.jsx` is transpiled by `powershell -File build-jsx.ps1` (esbuild, all 7 files, no minify). Production `index.html` loads the `.js` files.

## 0. Invariants (violating any of these is a blocker)

1. **The live boundary.** Live blocks are exactly `blocks.signals.items` (31), `blocks.connectors.checks` (11), `blocks.threads.items` (16). `alerts.events` and `qons.items` are empty. Divisions, bills, committees have no dedicated live block. No desk may claim live for data outside this boundary.
2. **Provenance values** are `live | derived | fixture` (Verified from `tests/state-contract.test.mjs` `ALLOWED_PROVENANCE` and `ProvenanceChip` at `shell.jsx:441`). A chip may show "Live" only when live-block items are actually on screen.
3. **Licence contract.** A live item's `title` renders only as a linked identifier whose click target is its `link` (the APH deep link). The product's own content is the attention level, confidence, `scoring_explanation`, clustering, and provenance metadata. No live title or feed prose renders as standalone product text (licence-architecture.md sections 3 and 4).
4. **Never invent a field.** The Worker serves exactly the fields in `docs/state-contract.md` section "Field names". Mapping may rename and derive; it may never fabricate momentum, trend history, actions, or provenance trails for live items (the existing `mapWorkerSignalToCard` comment at `pages.jsx:1835` states this rule; keep it).
5. **Fixture fallback per block.** When a block is missing, non-live, or empty, the desk renders its existing representative fixture with its honest chip. The fixture is never replaced on a guess (existing PageSignals rule, `pages.jsx:1889`).
6. **Git discipline.** Checkpoint-commit before any agent fan-out. Agents never run `git restore`, `git checkout --`, `git reset`, `git clean`, or `git stash` on tracked files. Verify `git status` after every fan-out.

---

## 1. Shared live-data layer: `useLiveState` (owned by store.jsx)

Generalise the PageSignals pattern (`pages.jsx:1872-1907`) into one fetch, one cache, one selector hook. These files share the global scope via `Object.assign(window, ...)`; they are plain globals, so attach the new names to `window` at the bottom of `store.jsx`.

### 1.1 Store state (inside `StoreProvider`, replacing `liveSignals`)

```js
// Live /state cache — polled data, deliberately NOT persisted to localStorage.
const [liveState, setLiveState] = React.useState({
  status: "idle",   // idle | loading | ready | error
  meta: null,       // { generated_at, worker_version, schema } passthrough
  blocks: null,     // { signals, connectors, threads, alerts, qons } mapped, see 1.3
});
```

Delete the `liveSignals` state and its `setLiveSignals` export. Keep `requestLiveRefresh` / `consumeLiveRefresh` unchanged. The two former consumers of `liveSignals` (Drawer in shell.jsx, PageSignals in pages.jsx) are rewired in their own files (sections 2 and 3); the interface below is frozen so the three file-owning agents need no coordination.

### 1.2 Fetch effect (once, in `StoreProvider`)

Move the PageSignals fetch into a `React.useEffect(..., [])` in `StoreProvider`, preserving all its guards verbatim: `location.protocol === "file:"` early-return, `AbortController` with an 8-second timeout, `inFlight` flag, `cancelled` cleanup. URL: `` `${WORKER_BASE_URL}/state` `` (`WORKER_BASE_URL` is `data.jsx:24`). On success call `setLiveState({ status: "ready", meta: payload.meta ?? null, blocks: mapLiveBlocks(payload.blocks) })`. On failure set `status: "error"` and leave `blocks` as they were (a failed refetch never erases a good cache). Fetch once on mount; no polling interval today.

### 1.3 Mappers (module scope in store.jsx)

`mapLiveBlocks(blocks)` returns an object with the five block names. Per block it copies `provenance`, maps `fetched_at -> fetchedAt`, `note -> note` (when present), and maps the payload array ONLY when `provenance === "live"` and the array is non-empty; otherwise the mapped array is `null`. Exact field maps (worker snake_case -> frontend camelCase; every worker field is Verified from state-contract.md):

**signals.items[] -> signal card shape** (move `mapWorkerSignalToCard` from `pages.jsx:1840` into store.jsx unchanged, then extend it with the two new fields marked NEW):

| Worker field | Frontend field | Rule |
|---|---|---|
| `guid` | `id` | as-is |
| `pub_date` | `time`, `date` | `HH:MM` and `en-AU` `d MMM yyyy`; `"—"` when null (existing logic) |
| `feed_label` | `source` | as-is |
| `source_group` | `sourceGroup` | as-is |
| `title` | `title` | as-is; render rule in section 4 makes it a linked identifier only |
| `link` | `link` (NEW) | `safeHttpUrl(row.link)`; also `evidence: [{ label: feed_label, url: link }]` (existing) |
| `kind` | `tags: [{ l: kind, c: "" }]` | existing |
| `attention` | `attention` | default `"low"` (existing) |
| `confidence` | `confidence` | `?? 0` (existing) |
| `scoring_explanation` | `summary`, `attentionReason` | existing |
| (constant) | `sourceAuthority: "Official"`, `isLive: true` (NEW) | `isLive` drives the licence render rule |

`action`, `score`, `provenance` trail, `updates` stay undefined for live items; existing consumers guard on their presence.

**connectors.checks[] -> feed-health row:**

| Worker field | Frontend field | Rule |
|---|---|---|
| `url` | `url` | join key against `SOURCE_REGISTRY` by exact `url` |
| `checked_at` | `checkedAt` | as-is (ISO string) |
| `ok` | `ok` | coerce truthy: `!!row.ok` (live sample carries `1`, Verified from the contract test) |
| `status` | `httpStatus` | as-is |
| `error` | `error` | as-is |
| (derived) | `label` | `SOURCE_REGISTRY.find(r => r.url === row.url)?.label`; fallback: URL with scheme stripped |
| (derived) | `group` | matching registry row's `group`; fallback `"Worker"` |

**threads.items[] -> thread row:**

| Worker field | Frontend field |
|---|---|
| `thread_id` | `id` |
| `title` | `title` (identifier only; render rule in section 4.3) |
| `item_count` | `itemCount` |
| `first_seen_at` | `firstSeenAt` |
| `last_seen_at` | `lastSeenAt` |
| `signal_guids` | `signalGuids` (array; each guid MAY resolve against the mapped signals; unresolved guids render as a count only, never a fabricated row) |

### 1.4 The hook (frozen signature)

```js
// Selector over the store's /state cache. blockName: "signals" | "connectors"
// | "threads" | "alerts" | "qons".
function useLiveState(blockName) {
  const { liveState } = useStore();
  const block = liveState.blocks?.[blockName] || null;
  const items = block?.items || null;      // null => render the desk's fixture
  return {
    status: liveState.status,
    items,                                  // mapped array, or null
    fetchedAt: block?.fetchedAt || null,
    note: block?.note || null,
    // What the chip shows. "live" only when live items are actually usable;
    // an empty or missing block can never place a Live chip (invariant 2).
    displayProvenance: items ? "live"
      : (block && block.provenance !== "live" ? block.provenance : "fixture"),
  };
}
```

For connectors the mapped array is stored under `items` too (the hook is uniform; the desk knows its rows are checks). Export from store.jsx: `Object.assign(window, { ..., useLiveState, mapWorkerSignalToCard })` and expose `liveState` through the `storeValue` memo (add to the dependency array). Add a small shared formatter `fmtFetchedAt(iso)` returning `HH:MM AEST` via `toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Brisbane" })`, attached to window from store.jsx, used by every desk that prints a fetched-at.

---

## 2. Desk-by-desk wiring table

Ten `Page*` components plus the Live page. "Chip" is what the page header must show. Representative desks keep the existing `<span className="chip-fixture">Representative data</span>`; block-driven desks use `<ProvenanceChip provenance={displayProvenance} .../>`.

| Desk (component) | Live block | Chip | Render change |
|---|---|---|---|
| Overview (`PageOverview`) | `signals` | ProvenanceChip for the signal sections; timeline and briefing queue keep Representative labels | See 2.1 |
| Signal inbox (`PageSignals`) | `signals` (already wired) | ProvenanceChip (existing, `pages.jsx:1946`) | Refactor to `useLiveState("signals")`; delete the local fetch effect and local `mapWorkerSignalToCard` (now in store.jsx). See 2.2 |
| Attention radar (`PageRadar`) | `signals`, derived aggregation | ProvenanceChip showing `derived` when live signals present, else `fixture` | See 2.3 |
| Watchlists (`PageWatchlists`) | `signals`, derived matching | ProvenanceChip `derived`/`fixture` on the match counts; config panel keeps its Fixture chip | See 2.4 |
| Briefings (`PageBriefings`) | `signals` (lookup only) | none new; static queue rows already say "Example" | Generated-brief lookup searches live items too. See 2.5 |
| Committees (`PageCommittees`) | none dedicated; additive live strip from `signals` | Representative chip on the fixture tables; ProvenanceChip on the live strip | See 2.6 |
| Bills (`PageBills`) | none | Representative chip in page head | See 2.7 |
| Daily program (`PageParliament`) | none dedicated; additive live strip from `signals` | Representative chips on fixture panels; ProvenanceChip on the live strip | See 2.8 |
| QON patterns (`PagePatterns`) | `threads` | ProvenanceChip on the threads panel; QON pattern block keeps its representative banner | See 2.9 |
| Sources (`PageSources`) | `connectors` | ProvenanceChip on the feed bundle panel | See 2.10, the highest-value wiring |
| Live parliament (`PageLive`) | independent `/rss` poller (already live) | unchanged | No change |
| Sidebar counts (shell.jsx) | `signals`, `threads` | n/a | See 3.2 |

### 2.1 PageOverview

- Top of component: `const live = useLiveState("signals"); const sourceSignals = live.items || SIGNALS;`
- Replace every `SIGNALS` read that feeds the priority/rest computation and the command strip (`priority`, `rest`, the "actioned" counts at `pages.jsx:335-336, 441, 504`) with `sourceSignals`.
- Page kicker (`pages.jsx:421`): when `live.items`, show `` `Live signals · fetched ${fmtFetchedAt(live.fetchedAt)} AEST · verify sitting status from the Live page` ``; else keep the current representative wording.
- Replace the header chip at `pages.jsx:425` with `<ProvenanceChip provenance={live.displayProvenance} title={...}/>` plus, when representative, keep the existing explanatory `title`.
- The "What changed" timeline (`pages.jsx:506-513`) and "Briefing queue" panel stay fixture: their rows deep-link to fixture modals. Keep the existing "Representative set · 24 Apr 2026" kicker; when `live.items` is non-null change it to "Representative timeline · live inbox on Signals" so the two provenance states cannot be read as one.
- "Committee activity" stat card (`pages.jsx:446-449`): hardcoded `7`; add `title="Representative count"` and a small `chip-fixture` inside the card. No number changes.
- `generateDailyBrief` and CSV export operate on `sourceSignals` so a live inbox exports live rows. `exportSignalsCSV` (`pages.jsx:10`) takes the array as a parameter: change signature to `exportSignalsCSV(signals)` and pass `sourceSignals` (the only caller is this page).

### 2.2 PageSignals (refactor to the shared layer)

- Delete the `React.useEffect` fetch block (`pages.jsx:1872-1907`) and the local `mapWorkerSignalToCard` (`pages.jsx:1840-1859`, moved to store.jsx).
- `const live = useLiveState("signals"); const sourceSignals = live.items || SIGNALS;` and replace `liveSignals.items || SIGNALS`.
- Chip becomes `<ProvenanceChip provenance={live.displayProvenance} title={live.displayProvenance === "live" ? "Signals from the Worker's composed /state endpoint (D1 archive)" : "Representative data — the /state signals block is not live"} />`.
- Everything else (filters, counts, search, `setVisibleSignalOrder`) already reads `sourceSignals` and needs only the variable rename.

### 2.3 PageRadar (derived aggregation, the product's own analysis)

- `const live = useLiveState("signals");`
- When `live.items`: build `derivedRows = ` group `live.items` by `sourceGroup`; per group: `issue = sourceGroup`, `count` of items, `sources` = distinct `source` count, `att` = highest member attention (high > med > low), `reason` = `` `${count} live items across ${sources} feeds` ``. Sort by count descending. This is clustering the product performs on factual metadata; the licence never engages (licence-architecture section 3).
- Render `derivedRows` through the existing row markup; the Momentum and Confidence cells render `"—"` in derived mode (no history exists; invariant 4 forbids inventing it). Row click in derived mode does NOT open the fixture radar modal (which contains fixture momentum): make derived rows non-clickable with `cursor: default`.
- When `live.items` is null: render the existing `RADAR` fixture exactly as now.
- Page head gains `<ProvenanceChip provenance={live.items ? "derived" : "fixture"} title={live.items ? "Grouped live signals; momentum and confidence require history the product does not yet have" : "Representative clusters"} />`.

### 2.4 PageWatchlists (derived matching)

- Extend `watchlistMatches(w)` in store.jsx to `watchlistMatches(w, signals = SIGNALS)` (default preserves every existing caller) and match a term against BOTH `(s.tags||[]).some(...)` and `s.title.toLowerCase().includes(term)`; live items carry only the `kind` tag, so title matching is what makes live matching real.
- In `PageWatchlists`: `const live = useLiveState("signals"); const matchSource = live.items || SIGNALS;` and compute each card's match count as `watchlistMatches(w, matchSource).length` in live mode (fixture mode keeps the stored `w.matches`).
- In live mode the 7-day spark renders a single flat `"—"` placeholder (no trend history exists). Card layout otherwise unchanged.
- Page head gains `<ProvenanceChip provenance={live.items ? "derived" : "fixture"} title={live.items ? "Keyword matches computed against the live signal stream" : "Representative match counts"} />`. `WatchlistDetail` in store.jsx keeps fixture behaviour today (modal refactor is out of scope; its existing representative chip already covers it).

### 2.5 PageBriefings

- The generated-brief merge (`pages.jsx:1567-1572`) resolves `sid` against fixture only. Change to: `const live = useLiveState("signals"); const known = live.items ? [...SIGNALS, ...live.items] : SIGNALS;` and use `known.find(...)` in both places (`pages.jsx:1568` and `pages.jsx:1629`). Pass `isLive` into `buildBriefSections(sig, !!sig.isLive)` at `pages.jsx:1631` so the confidence label is honest (the `isLive` parameter already exists, `shell.jsx:467`).
- No other change; the static queue rows are already labelled "Example".

### 2.6 PageCommittees (additive live strip; tables stay representative)

- `const live = useLiveState("signals");` and `const committeeFeedLabels = new Set(["Senate Committee Reports Tabled", "Senate New Inquiries", "Senate Upcoming Hearings"]);` (these labels are Verified registry labels, `data.jsx:43-78`, and `feed_label` mirrors them: the contract-test sample uses the exact registry label "House Media Releases").
- When `live.items`: render a NEW panel "Latest committee items · live feed" ABOVE "Today's hearings", listing `live.items.filter(s => committeeFeedLabels.has(s.source))` (empty-state: "No committee items in the current live window."). Each row uses the shared live row treatment (section 4): title as anchor to `s.link`, then `kind`, `source`, `date` metadata. Panel head carries `<ProvenanceChip provenance="live" .../>` and `fetched ${fmtFetchedAt(...)}`.
- Add `<span className="chip-fixture">Representative data</span>` to the page head, and to the three stat cards' panel (`pages.jsx:1259-1263`), because the hearing schedule and counts are fixture.
- Soften the page-sub (`pages.jsx:1251`): "Committee profiles and schedules are representative; the live strip lists real items from the Senate committee feeds."

### 2.7 PageBills (representative, honestly)

- Add `<span className="chip-fixture">Representative data</span>` beside the page title (`pages.jsx:1292`), with `title="Bill stages and provisions are representative until a bills register connector exists"`.
- No live wiring: no live block serves bills, and none of the six live feeds is bills-specific (the Bills Digests feed is WAF-blocked, `data.jsx:10-12`). Every existing panel keeps its current representative content.

### 2.8 PageParliament (additive live strip; panels stay representative)

- `const live = useLiveState("signals");` with `const chamberFeedLabels = new Set(["House Divisions", "House Daily Program", "House Media Releases"]);`
- When `live.items`: render a NEW panel "Latest chamber items · live feed" above the grid, same shared live row treatment and Live chip as 2.6, filtered by those labels.
- Add `chip-fixture` "Representative data" chips to: "House · daily program" panel head, "Recent divisions" panel head, and "House news & media" panel head (the three hardcoded titles at `pages.jsx:1447-1451` are fixtures). "Parliamentary lines" already carries one.

### 2.9 PagePatterns (threads go live)

- `const threads = useLiveState("threads"); const signalsLive = useLiveState("signals");`
- When `threads.items`: render a NEW panel FIRST, "Signal threads · live clustering", chip `<ProvenanceChip provenance="live" .../>` plus `` `16 threads · fetched ${fmtFetchedAt(threads.fetchedAt)} AEST` `` (count from `threads.items.length`, no hardcoding). Each thread row: the product-owned facts lead: `itemCount` items, span `firstSeenAt -> lastSeenAt` (formatted dates), then the thread `title` rendered per section 4.3. A row expands (local `useState` toggle) to list member signals resolved via `signalGuids` against `signalsLive.items`; each resolved member uses the shared live row treatment (title anchored to its `link`); unresolved guids collapse to one line: `` `${n} further items in the archive` ``.
- The existing "Design-state module" banner (`pages.jsx:1491-1494`) changes text when threads are live: "**QON feed not connected** (source returns 403). Thread clustering above is live from the archive. The QON pattern below remains representative." The fixture QON pattern block and "How patterns are detected" panel stay unchanged.
- When `threads.items` is null: page renders exactly as today.
- Confidence note: whether thread `title` originates from a member item's feed title is Inferred (the Worker clusters feed items). The section 4.3 identifier treatment is therefore mandatory, so conformance holds under either origin.

### 2.10 PageSources (connectors: the real feed-health surface)

- `const health = useLiveState("connectors");` (`health.items` is the mapped checks array).
- **Feed table** (`pages.jsx:1095-1116`): build `const checkByUrl = new Map((health.items || []).map(c => [c.url, c]));` and for each registry row read `const c = checkByUrl.get(f.url)`. Columns change: Status cell: `c ? (c.ok ? "Live" : \`Error ${c.httpStatus ?? ""}\`) : (existing lastStatusCode logic)`; Last cell: `c ? fmtFetchedAt(c.checkedAt) : (f.last || "—")`. Colour the Error state with `var(--escalate)`.
- **Worker-monitored rows:** after the registry rows, append any checks whose `url` is NOT in `SOURCE_REGISTRY` (11 checks vs 6 registry rows, so about 5 extra; count from data, never hardcode) as rows with `label` from the mapper, group tag "Worker", and no click-through modal. These are real monitored endpoints the frontend does not poll directly.
- **KPI tiles** (`pages.jsx:1083-1086`): when `health.items`: "Healthy" = `` `${health.items.filter(c => c.ok).length}/${health.items.length}` `` with stat-meta `` `as at ${fmtFetchedAt(health.fetchedAt)} AEST` ``; "Active feeds" meta becomes "Official feeds configured · 11 endpoints health-checked". "Items ingested · today" and "False positive rate" keep `"—"` (no live field serves them; invariant 4).
- Panel head chip: `<ProvenanceChip provenance={health.displayProvenance} title={health.displayProvenance === "live" ? "Feed health from the Worker's connector checks" : "Health appears after the Worker check runs"} />`.
- Page-sub (`pages.jsx:1074`) becomes: "Official APH feed register with live health checks from the Worker. Custom-feed validation remains a prototype workflow." The custom "Add feed" simulated validation and "Not yet connected" panels stay as they are (already honest).

---

## 3. shell.jsx changes (Drawer, Sidebar, nav)

### 3.1 Drawer

- Replace `liveSignals` destructure (`shell.jsx:571`) with `const signalsLive = useLiveState("signals");` and use `signalsLive.items` in the live lookup (`shell.jsx:575`) and in `visibleSigs` (`shell.jsx:607`). Logic is otherwise identical.
- Drawer header for a live signal (`s.isLive`): the title renders as an anchor to `s.link` per section 4.2. The drawer's existing provenance chip (`shell.jsx:721`, `itemProvenance`) keeps working; feed it `signalsLive.displayProvenance` for live items.

### 3.2 Sidebar counts

`navCount` (`shell.jsx:94-109`) reads fixtures. Change: `const signalsLive = useLiveState("signals"); const threadsLive = useLiveState("threads");` then `const signalSource = signalsLive.items || SIGNALS;` and compute `signals`/`radar` from `signalSource`; `patterns: threadsLive.items ? threadsLive.items.length : QON_PATTERN.items.length`. Other counts stay fixture-based (their desks are representative). Add the two hook results to the `useMemo` dependency array.

### 3.3 Nav label

`NAV` entry `patterns` (`shell.jsx:80`): label becomes "Patterns & threads" (the page now leads with live threads).

---

## 4. Facts-and-links display treatment (the licence contract in JSX)

### 4.1 The shared rule

For any item with `isLive: true`, the `title` string appears ONLY inside an anchor whose `href` is the item's `link` and whose target is APH. It never appears as plain text, never in a `<div>`, and never inside product-composed prose. The product's own analysis (attention, confidence, `scoring_explanation`, counts, timestamps, feed labels) renders as ordinary product content around it.

### 4.2 SignalCardView (shell.jsx:507) and Drawer title

In `SignalCardView`, the headline element becomes conditional:

```jsx
{s.isLive ? (
  <a className="sig-title serif sig-title-link" href={s.link}
     target="_blank" rel="noopener noreferrer"
     onClick={e => e.stopPropagation()}
     title="Opens the source at aph.gov.au">
    {s.title} <Icon name="ext" size={12} style={{verticalAlign:"-1px"}}/>
  </a>
) : (
  <div className="sig-title serif">{s.title}</div>
)}
```

Add to the stylesheet (index.html or the CSS block the executor locates by grepping `.sig-title`): `.sig-title-link { display:block; color: var(--teal); text-decoration: none; } .sig-title-link:hover { text-decoration: underline; }`. The teal + external icon styling marks it visually as a source link, the same idiom the Live page already uses for its RSS rows (`pages.jsx:1005`, which is already conformant: its rows are whole-row anchors to the source). The card's own click still opens the drawer; `stopPropagation` keeps the two targets distinct. Below the title, the metadata line already shows `source` and `time`; ensure `pub_date`-derived date joins it for live items (`s.date` after the time). `s.summary` for live items is the `scoring_explanation`, which is the product's own work: correct and prominent as-is. Apply the same conditional anchor to the Drawer's title element (the executor locates it by grepping `sig-title|serif` inside `Drawer`/its head; same JSX pattern).

### 4.3 Thread titles (PagePatterns)

A thread row's product-owned facts lead the row (item count, first/last seen). The thread `title` renders in a quoted-identifier style with no anchor of its own (threads carry no `link` field; inventing one violates invariant 4): `<span className="mono" style={{color:"var(--ink-2)"}}>&ldquo;{t.title}&rdquo;</span>`, and the row's expand action leads to member signal rows, each of which carries the real APH anchor. The click path to the source is therefore always one step away and always lands on `link`.

### 4.4 Clipboard briefs and CSV

`buildBriefSections(s, isLive)` already labels confidence honestly. Verify (Codex gate, section 5) that no clipboard/CSV export composes a live `title` into product prose beyond identifier use with its evidence link present; the existing brief format puts the title in the heading with the evidence URL listed, which is identifier-plus-attribution use, acceptable for the interim per state-contract.md's "linked-identifier treatment is the deployable-today interim".

### 4.5 Email digest

Worker-side and inert (`resend_wired: false`; activation is Juan setting `RESEND_API_KEY`). No frontend work today. Flag: before Juan wires Resend, the digest template must pass the same section 4.1 rule.

---

## 5. Execution plan (multi-agent, partitioned by FILE)

All ten desks live in pages.jsx, so desks must never be parallelised across agents. Partition by file; the frozen interface in section 1.4 is the coordination contract.

**Phase 0 — checkpoint (main session, sequential).**
1. Delete the stray untracked file `frontend` (19 bytes, contains the text "frontend\nshell.jsx"; created 2026-07-19 16:44; it is junk and `wrangler pages deploy .` would upload it).
2. Reconcile the `M shell.jsx` status flag: `git diff shell.jsx` currently prints empty (line-ending touch, Inferred). Run `git diff --stat` to confirm empty; if genuinely empty, a `git add shell.jsx && git status` check normalises it inside the phase-1 commit; if a real diff exists, read it before proceeding.
3. Commit the two docs (`docs/state-contract.md`, `docs/live-wiring-spec.md`) plus the deletion as the checkpoint commit on `review/honesty-hardening`.

**Phase 1 — wiring (three agents in parallel, one file each).**
- Agent S: store.jsx (section 1 entire; plus the `watchlistMatches` signature change in 2.4).
- Agent H: shell.jsx (sections 3 and 4.2).
- Agent P: pages.jsx (sections 2.1 to 2.10 sequentially within the one agent, plus deleting the moved fetch/mapper code per 2.2).
Each agent edits ONLY its file. None runs build or git commands. Main session commits all three files together as one commit ("feat(pulse): shared live-state layer + desk wiring per live-wiring-spec").

**Phase 2 — build and tests (main session, sequential).**
1. `powershell -File build-jsx.ps1` (all 7; any esbuild failure returns to the owning agent).
2. `node tests/state-contract.test.mjs` and `node tests/beta-contract.test.mjs` (both must pass).
3. jsx-sync check: no `.jsx` has a LastWriteTime newer than its `.js`.
4. Serve locally: `python -m http.server 8080` (plus `node proxy-server.js` if the Live page is exercised).

**Phase 3 — verification fan-out (parallel, read-only agents; Playwright).**
One task per surface (11 surfaces: overview, live, signals, radar, committees, bills, parliament, patterns, briefings, watchlists, sources), each at 1280px width against `http://localhost:8080`:
- Screenshot the desk.
- Assert zero console errors (warnings logged, errors are blockers).
- Assert the chip per the section 2 table. Expected with the Worker reachable: Signals/Overview chips "Live"; Radar and Watchlists "Derived"; Sources "Live" with `n/11` healthy; Patterns thread panel "Live" with 16 threads; Committees/Bills/Parliament "Representative data" chips present (plus Live strips where specified).
- On Signals: assert 31 rendered live cards (or the fixture 6 with a Fixture chip if the Worker is unreachable, which is itself a pass of the honesty rule but a deploy blocker until the Worker answers).
- On Signals: click one card title anchor target equals its `link` host `www.aph.gov.au`; card body click still opens the drawer.
Verification agents write screenshots to the scratchpad and report pass/fail per assertion; they never edit source.

**Phase 4 — Codex adversarial gate (mcp__codex__codex, blocking).**
Two prompts, full diff attached (`git diff <checkpoint>..HEAD`):
1. Licence conformance: "Find any path where a live item's `title` or feed prose renders outside an anchor to its `link`, in DOM, clipboard, CSV, or print output. Find any desk that can display a Live chip while fixture data is on screen, or fixture data while a Live chip shows."
2. Diff review: correctness of the store refactor (deleted `liveSignals` consumers all rewired; `useMemo` dependency arrays complete; no stale `window` exports), and any regression in the Drawer j/k flow.
Blocker findings return to the owning file agent; re-run phases 2 and 3 for touched files. Cross-family rule satisfied: Codex reviews before any within-family review.

**Phase 5 — deploy (section 6; Juan's gate).**

After the fan-out: `git status` must show only intended changes (invariant 6).

---

## 6. Deploy-ready path for today

### 6.1 The hazard (Verified this session)

The GitHub remote `jvega017/parliament-pulse` hosts BOTH codebases: this Babel app's history on `master`, and a monorepo on `main` carrying `apps/web` (a Vite frontend) plus four workflows (`ci.yml`, `deploy-web.yml`, `deploy-worker.yml`, `smoke.yml`). `deploy-web.yml` (content read from `main` via `gh api`) deploys `apps/web/dist` to the SAME Cloudflare Pages project (`--project-name=parliament-pulse --branch=main`) on any push to `main` touching `apps/web/**`, the workflow file, `pnpm-lock.yaml`, or `pnpm-workspace.yaml`. A dependabot merge alone could overwrite today's production deploy. Six dependabot branches for those paths currently sit on the remote (Verified via `git ls-remote`).

### 6.2 The fence

1. **Immediate (automatable once Juan approves; it changes CI behaviour, so confirm first):**
   `gh workflow disable "Deploy web" --repo jvega017/parliament-pulse`
   Verify: `gh api repos/jvega017/parliament-pulse/actions/workflows/deploy-web.yml --jq .state` returns `disabled_manually`. This blocks every trigger, including dependabot merges, and is reversible with `gh workflow enable`.
2. **Durable (Juan's decision, later, since it commits to `main`):** replace the `on: push` trigger in `deploy-web.yml` with `on: workflow_dispatch: {}`. GitHub evaluates the workflow file at the pushed commit, so the change cannot self-trigger.
3. **Standing rule for the executor:** never push to `main`, never merge this Babel tree into `main`. `review/honesty-hardening` and `master` carry no workflow files (Verified: `git ls-files` finds none), so pushing them triggers nothing.

### 6.3 Build and verify gate (all must pass before deploy)

1. Phases 2 to 4 complete: 7 `.js` in sync, both contract tests green, 11 surfaces screenshot-verified with zero console errors and correct chips, Codex gate clear.
2. Deploy fence in place (6.2.1 verified `disabled_manually`).
3. Working tree committed and clean; stray `frontend` file gone.
4. Live `/state` answers from the Worker (`curl https://aph-proxy.jvega019.workers.dev/state` returns schema `state-v1`) so the deployed app lands live on first load.

### 6.4 Deploy commands (Juan executes or explicitly authorises; production push is his gate)

```powershell
cd C:\Users\jvega\Claude-Workspace\03_Projects\parliament-pulse
$env:CLOUDFLARE_ACCOUNT_ID = "ccc93b2330067a401bf57fc9ac736e7a"   # from README; token via wrangler login or CLOUDFLARE_API_TOKEN env var, never pasted in chat
npx wrangler@4 pages deploy . --project-name=parliament-pulse --branch=main
```

`--branch=main` targets the Pages production branch (Verified consistent with `deploy-web.yml` and the project memory that Pages prod branch is `main`). The deploy uploads local files; it needs no git push. Post-deploy: re-run the phase-3 Playwright pass against `https://parliament-pulse.pages.dev` (the Worker's CORS allowlist already contains that origin per README; if the chip falls back to Fixture in production, check `ALLOWED_ORIGINS` in the Worker's wrangler.toml first).

**Juan's steps (decision or credential required):** approve and run the deploy; approve the workflow disable; the dead custom domain `pulse.prometheuspolicylab.com` (Cloudflare dashboard DNS fix, deferred, non-blocking since pages.dev serves); optional later: `RESEND_API_KEY` for the digest; push/merge of `review/honesty-hardening` to `master` (safe any time, no CI attached).
**Safe to automate:** all wiring, builds, tests, local verification, screenshots, Codex gate, and the fence verification query.

---

## 7. Exit checklist: "deployable today" means ALL of these are true

| # | Condition | Measured by |
|---|---|---|
| 1 | All 7 `.js` rebuilt and newer than their `.jsx` | `build-jsx.ps1` exit 0 + mtime comparison |
| 2 | Both contract tests pass | `node tests/state-contract.test.mjs`; `node tests/beta-contract.test.mjs` |
| 3 | 11 surfaces render at 1280px with zero console errors | Phase-3 screenshots + console capture |
| 4 | Chips conform to the section 2 table on every desk | Phase-3 assertions |
| 5 | Signal inbox shows the 31 live items; Sources shows 11 health checks; Patterns shows 16 live threads (counts from data, never hardcoded) | Phase-3 assertions with the Worker reachable |
| 6 | Every live title in DOM is an anchor to its `link`; no Live chip over fixture data; no fixture data under a Live chip | Codex gate finding count = 0 blockers |
| 7 | Drawer opens from a live card; title anchor and drawer click are distinct targets | Phase-3 interaction check |
| 8 | `deploy-web.yml` state = `disabled_manually` | `gh api ... --jq .state` |
| 9 | Working tree clean on `review/honesty-hardening`; `frontend` junk file deleted; commits present for phase 0 and phase 1 | `git status`, `git log` |
| 10 | Live `/state` probe returns `state-v1` before deploy | `curl` |
| 11 | Deploy executed by Juan; post-deploy Playwright pass green on `https://parliament-pulse.pages.dev` | Phase-3 rerun against production |
| 12 | Custom domain explicitly deferred and recorded (non-blocking) | This spec, Juan's list |
