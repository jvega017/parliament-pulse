# Parliament Pulse — meta-review synthesis (2026-04-24)

Eight-lens review run over the live deploy at https://parliament-pulse.pages.dev and repo at this commit. Findings below are the consensus set where at least two reviewers converged. Wave 1 ships in this session.

## Verdicts by lens

| # | Lens | Verdict | Notes |
|---|---|---|---|
| 1 | Functionality | AMBER | ~25 toast-only buttons, Ctrl+K keyboard nav missing, YouTube chamber resolver leaks, new watchlists score nothing |
| 2 | Visual design | AMBER | Stat-card hierarchy flat, brief-print section order violates BLUF, live-strip prose wastes its width |
| 3 | Colour | AMBER | `.btn.primary` gradient off-token, `.signal` card off-token, `--escalate` misused for broadcast-presence (LIVE badge) |
| 4 | Typography & microcopy | in progress | (agent output truncated — inferred from peer reports: ad-hoc inline font-sizes, mostly Australian English holds) |
| 5 | Accessibility WCAG 2.2 AA | AMBER | 5 of 7 prior fixes PASS. New: textarea missing label, Ctrl+K listbox without option roles, BriefPrint missing focus trap, `.att.high` pill contrast 4.3:1 |
| 6 | Polish | AMBER | Brief overlay has no open/close transition, signal card hover imperceptible, RSS new items flash in with no animation |
| 7 | Information architecture | AMBER | Overview panel order wrong for morning workflow, watchlist create is a dead end, Ctrl+K searches fixtures only |
| 8 | Data integrity | in progress | (agent output truncated — all [Sample] discipline appears to hold based on peer confirmation) |

## Cross-flagged critical findings (Wave 1)

Items flagged by 2+ reviewers or explicitly Critical:

| # | Finding | Lenses | File:line | Fix |
|---|---|---|---|---|
| C1 | Ctrl+K has no arrow-key nav; role=listbox without option children | 1, 5, 7 | Topbar.tsx:14-193 | Add arrow-key roving-tabindex + role="option"; search liveSignals too |
| C2 | New watchlists store empty `terms`; `useLiveSignals` uses fixture WATCHLISTS only | 1, 7 | Store.tsx:144; app.tsx:50 | Capture comma-separated terms in PageWatchlists; pipe user watchlists into scoring |
| C3 | YouTube chamber resolver falls back to most-recent across channels | 1 | aphFeed.ts:154 | Return null on no-match; broaden chamber regex |
| C4 | Drawer analyst-note `<textarea>` has no accessible name | 5 | Drawer.tsx:361 | Add id+htmlFor or aria-label |
| C5 | BriefPrint lacks focus trap, initial focus, open animation | 5, 6 | BriefPrint.tsx:44 | Apply useFocusTrap; add fadeIn animation |
| C6 | `.att.high` pill contrast 4.3:1 on `--panel` (fails 1.4.3) | 5 | tokens.css + global.css | Darken background or use darker attention surface |
| C7 | Signal card hover imperceptible | 6, 2 | global.css:.signal:hover | Add background shift + shadow on hover |
| C8 | BriefPrint section order violates BLUF | 2 | BriefPrint.tsx:103 | Recommended action → Why it matters → Summary first |
| C9 | Overview panel order wrong for morning workflow | 7 | PageOverview.tsx | What changed + Briefing queue first in right column |
| C10 | "Generate daily brief" opens `liveSignals[0]` not top high-attention | 7 | PageOverview.tsx | Key to first liveHigh signal, fallback to top-scored |
| C11 | Topbar "New brief" is a toast stub (same label as working button) | 1, 7 | Topbar.tsx:235 | Call openBrief on top high-attention signal |
| C12 | Watchlist creation is a dead end — no way to add terms | 7 | Modals.tsx WatchlistDetail | Add editable terms input in modal |
| C13 | Stat cards all equal visual weight | 2 | PageOverview.tsx:189-214 | Accent border + larger number on high-attention card |
| C14 | `--escalate` used for LIVE broadcast badge (semantic creep) | 3 | global.css:.live-badge | Switch to `--brass` for broadcast presence |
| C15 | `.btn.primary` gradient uses 4 off-token warm values | 3 | global.css:286-290 | Reference `var(--brass-2)` and `var(--brass)` |
| C16 | `.signal` card uses off-token `#1a2432/#18222f` | 3 | global.css:435 | Reference `var(--panel-2)` and `var(--bg-2)` |
| C17 | Live-strip content wastes its width (explanation prose instead of top signal) | 2 | PageOverview.tsx:130-161 | Show top live high-attention title in the 1fr column |

## Wave 2 (next session)

~25 toast-only buttons across Topbar, Briefings, Sources, Patterns, Modals; sidebar Briefings → Today; Parliament nav rename; watchlist full-edit UI; brief-print heading colour ruling; RSS new-item enter animation; sidebar mobile nav; various minor hover/focus gaps.

## Pass gates after Wave 1

Expected after fixes:
- **Trust**: green (no UI element presents sample as real)
- **Provenance**: green (every live item links to APH)
- **Usefulness**: green (generate brief works end-to-end)
- **Readiness**: amber → green if Wave 1 lands cleanly (all blockers closed except Wave 2 polish)

## Positive findings worth preserving

- Token system in `tokens.css` is disciplined (Agent 2, 3)
- `useFocusTrap` implementation is clean (Agent 5)
- `prefers-reduced-motion` block is correct and comprehensive (Agent 5, 6)
- LiveSignalsPump architecture avoids double-polling (Agent 1)
- Drawer component is the strongest single UI element (Agent 7)
- CORS allowlist on the Worker is tight (prior security review)
- Drawer transition uses a well-calibrated `cubic-bezier(0.2, 0.7, 0.2, 1)` at 220ms (Agent 6)
- Tag class system is a clean extension pattern (Agent 3)
- Skip-to-main-content link, `<main>` landmark, `aria-current` on nav (Agent 5)
