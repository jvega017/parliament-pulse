// pages-workspace.jsx: the Workspace desks (Committees, Bills, Daily program, Threads, Briefings, Watchlists).
// Split from pages.jsx (FE-11, ARCH-11). Every file is a classic script: its
// top-level declarations share one global lexical scope with the other files, so
// load order in index.html matters only for code that runs at load time.



// ---------- SITTING-DAY HONESTY HELPERS ----------
// No sitting or return date is ever hardcoded here: a literal date goes false
// the day the calendar moves, and tests/fabrication-patterns.mjs bans the
// patterns. When a sitting-day feed returns zero items the copy says only that
// the app holds no records, and points to the official source.
//
// Every empty sentence names the exact feed and window it speaks for ("dated
// today", "in the current feed window"). A blanket "no hearing records are
// available in this app" sat under a Today's hearings panel on a page that
// listed upcoming hearings a few rows below, so the two contradicted each other.

// Shared honest-empty copy for a sitting-day feed that has returned zero items.
// `scope` is one sentence naming the feed and the window that are empty (for
// example "No hearings dated today are in the APH hearing feeds."); `url` and
// `linkLabel` point to the official source.
function recessEmptyText(scope, url, linkLabel) {
  return (
    <>
      {scope} This does not establish whether the chamber is sitting. Check the official source for current proceedings.{" "}
      <a href={url} target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>{linkLabel} <Icon name="ext" size={11} style={{verticalAlign:"-1px"}}/></a>.
    </>
  );
}

// One live signal row, shared by every sitting-day list below: the title renders
// only inside its APH anchor (licence rule), with the feed label and date around
// it as the product's own metadata.
// The committee read from the link (committeeFromLink) tells same-titled items
// apart; a hearing row with a hearing date (Worker 0.16.2) shows that date in
// place of the publication line, which the hearings feed never supplies.
function LiveSignalRow({ s, isLast, hearingLabel }) {
  const hearing = s.hearingDate ? fmtHearingDay(s.hearingDate) : null;
  return (
    <div className="data-row" style={{padding:"10px 0", borderBottom: isLast ? 0 : "1px solid var(--line)"}}>
      {s.link
        ? <a href={s.link} target="_blank" rel="noopener noreferrer" style={{color:"var(--link)", textDecoration:"none", fontSize:"var(--t-body-sm)", fontWeight:500}} title="Opens the source at aph.gov.au">{s.title} <Icon name="ext" size={11}/></a>
        : <span style={{fontSize:"var(--t-body-sm)", fontWeight:500, color:"var(--ink-2)"}}>{s.source}</span>}
      <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginTop:4}}>
        <span className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".12em"}}>{feedDisplayName(s.source)}</span>
        {s.committee && <span data-committee="" style={{fontSize:"var(--t-caption)", color:"var(--ink-3)"}}>{s.committee}</span>}
        {hearing
          ? <span className="mono" data-hearing-date={s.hearingDate} style={{fontSize:"var(--t-eyebrow)", color:"var(--ink-2)"}}>{hearingLabel || "Hearing"} {hearing}</span>
          : <span className="mono" style={{fontSize:"var(--t-eyebrow)", color:"var(--ink-4)"}}>{s.date}</span>}
      </div>
    </div>
  );
}

// Renders a filtered live-signal list with the shared three-state honesty
// contract: the live block itself unavailable (outage, not recess), the block
// live but this filter empty (recess-aware empty text supplied by the caller),
// or real rows. Used by every sitting-day panel below so the "outage vs
// genuinely nothing scheduled" distinction never gets blurred into one message.
function SittingDeskList({ rows, unavailableText, emptyIcon = "clock", emptyKicker, emptyBody, hearingLabel }) {
  if (rows === null) {
    return (
      <EmptyState icon={emptyIcon} kicker="Live data unavailable" variant="error">
        {unavailableText}
      </EmptyState>
    );
  }
  if (rows.length === 0) {
    return <EmptyState icon={emptyIcon} kicker={emptyKicker}>{emptyBody}</EmptyState>;
  }
  return <>{rows.map((s, i) => <LiveSignalRow key={s.id || i} s={s} isLast={i === rows.length - 1} hearingLabel={hearingLabel} />)}</>;
}

// Related House divisions, shared by the Bills register and the Daily program
// page. Filters the live signals block by the Worker's REAL feed_label, "House
// divisions" (verified against workers/aph-proxy/src/jurisdictions.json and a
// live /state probe, 2026-07-22) — the previous filter here compared against
// "House Divisions" (title case), which never matched a real row and silently
// hid genuinely live division items behind an empty state every single poll.
function DivisionsLiveList() {
  const live = useLiveState("signals");
  const rows = live.items ? live.items.filter(s => s.source === "House divisions") : null;
  return (
    <SittingDeskList
      rows={rows} emptyIcon="flag"
      unavailableText={<>Parliament Pulse holds no verified division results right now because the live signal feed is unavailable. <a href="https://www.aph.gov.au/Parliamentary_Business/Chamber_documents" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Open division results on aph.gov.au</a>.</>}
      emptyKicker="No divisions in the feed window"
      emptyBody={recessEmptyText("The House divisions feed lists no division results in the current feed window.", "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", "Open division results on aph.gov.au")}
    />
  );
}

// Today's House, joint and Senate committee hearings — two real Worker feeds
// ("Today's House and joint hearings", "Today's Senate hearings") that return an
// empty channel while the relevant chamber is not sitting.
// The archive keeps every hearing these feeds ever listed, so the feed name alone
// put hearings from 1 Sep to 1 Oct under "Today's hearings" (UX and data review,
// 5 Oct 2026). Only rows dated today in Brisbane stay: the hearing date when the
// Worker sends one, otherwise the publication day. Undated rows cannot be shown
// as today's.
function hearingDayKey(s) {
  return (s && s.hearingDate) || signalDayKey(s);
}
function todaysHearingRows(items, now = Date.now()) {
  const HEARING_LABELS = new Set(["Today's House and joint hearings", "Today's Senate hearings"]);
  const today = brisbaneDayKey(now);
  return items.filter(s => HEARING_LABELS.has(s.source) && hearingDayKey(s) === today);
}
function TodaysHearingsPanel() {
  const live = useLiveState("signals");
  const rows = live.items ? todaysHearingRows(live.items) : null;
  return (
    <div className="panel" style={{marginTop:16}}>
      <div className="panel-head"><h2 className="panel-title">Today's hearings</h2><span className="panel-kicker">House, joint & Senate</span></div>
      <div className="panel-body">
        <SittingDeskList
          rows={rows} emptyIcon="clock"
          unavailableText={<>Parliament Pulse holds no verified hearing schedule right now because the live signal feed is unavailable. <a href="https://www.aph.gov.au/Parliamentary_Business/Committees" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Open committee hearings on aph.gov.au</a>.</>}
          emptyKicker="No hearings dated today"
          emptyBody={recessEmptyText("The APH feeds of today's House, joint and Senate hearings list no hearings dated today.", "https://www.aph.gov.au/Parliamentary_Business/Committees", "Open committee hearings on aph.gov.au")}
        />
      </div>
    </div>
  );
}

// ---------- COMMITTEES ----------
// Every feed_label set below is the Worker's REAL value (verified against
// workers/aph-proxy/src/jurisdictions.json and a live /state probe, 2026-07-22).
// The previous version of this page compared against title-case labels
// ("Senate Committee Reports Tabled", "Senate New Inquiries", "Senate Upcoming
// Hearings") that never matched an actual feed_label, so the live strip below
// silently rendered nothing every poll despite the Senate feeds carrying real
// items throughout. House and joint committee inquiries were never added at
// all, despite being live in the signals block the whole time.
// COMMITTEE_STRIP_LABELS now lives in store.jsx beside selectCounts(), so the nav
// badge, the Overview tile and this page all count from one definition (UX-02).
const COMMITTEE_RECENT_LABELS = new Set([
  "Senate reports tabled", "New Senate inquiries", "House committee inquiries", "Joint committee inquiries",
]);

// States the order of the Senate hearing rows that carry NO hearing date. The
// APH feed prints each hearing's date only in its <description> and supplies no
// pubDate. Worker 0.16.2 parses that date into hearing_date; Worker 0.16.1 (and
// any row whose description does not parse) sends none, so those rows cannot be
// listed soonest first. Dated-by-publication rows run newest published first;
// with none dated, the rows keep the Worker's attention-score order. Neither is
// hearing order, and the feed can still carry hearings that have passed.
function hearingOrderNote(rows) {
  if (!rows || rows.length === 0) return null;
  const order = rows.some(s => s.dateKind !== "none")
    ? "Listed newest published first, undated items last."
    : "The feed gives these items no dates, so they are listed by Parliament Pulse attention score.";
  return `${order} This is not the order the hearings will be held, and the feed can still list hearings that have passed. Open an item for its hearing date on aph.gov.au.`;
}

// Splits the Upcoming Senate hearings rows by their hearing date (Worker 0.16.2):
//   upcoming: dated today or later in Brisbane, soonest first;
//   held:     dated before today, most recent first, shown under "Recently held"
//             rather than hidden. Worker 0.16.2 keeps one row per inquiry with
//             the FIRST date the feed lists, so a held row can still list later
//             hearings; from 0.16.3 the date is the inquiry's next listed
//             hearing, so a held row's date is its latest past one and every
//             hearing the feed lists for it has passed (hearingCopy below);
//   undated:  no hearing date (Worker 0.16.1, or a description that did not
//             parse), newest published first, with hearingOrderNote.
function splitSenateHearings(rows, now = Date.now()) {
  const today = brisbaneDayKey(now);
  const dated = rows.filter(s => s.hearingDate);
  return {
    anyDated: dated.length > 0,
    upcoming: dated.filter(s => s.hearingDate >= today).sort((a, b) => a.hearingDate.localeCompare(b.hearingDate)),
    held: dated.filter(s => s.hearingDate < today).sort((a, b) => b.hearingDate.localeCompare(a.hearingDate)),
    undated: sortSignalsNewestFirst(rows.filter(s => !s.hearingDate)),
  };
}

const HEARINGS_URL = "https://www.aph.gov.au/Parliamentary_Business/Committees";

// The words that describe which hearing date a row carries. They follow the
// Worker's rule, read from meta.worker_version: 0.16.3 and later date each
// inquiry by its next listed hearing (a held row by its latest past one);
// older Workers by the first hearing the feed lists.
function hearingCopy(nextRule) {
  return nextRule
    ? { sort: "Where an inquiry lists several hearings, the date shown is its next listed hearing.",
        held: "Every hearing the feed lists for these inquiries has passed. Open one on aph.gov.au for its record.",
        heldLabel: "Last hearing" }
    : { sort: "Where an inquiry lists several hearings, the date shown is the first one the feed lists.",
        held: "The first hearing date the feed lists for these inquiries has passed. An inquiry can still list later hearings; open it on aph.gov.au for its full schedule.",
        heldLabel: "First listed" };
}

function PageCommittees() {
  const liveSignalsState = useLiveState("signals");
  const items = liveSignalsState.items;
  const { liveState, toast } = useStore();
  const fresh = (liveState && liveState.blocks && liveState.blocks.freshness) || null;
  // Inquiries and reports run newest published first with undated items last,
  // as the Signal inbox does; the Worker sends score-then-recency order.
  const hearingRows = items ? items.filter(s => s.source === "Upcoming Senate hearings") : null;
  const hearings = hearingRows ? splitSenateHearings(hearingRows) : null;
  const hCopy = hearingCopy(useWorkerVersionAtLeast("0.16.3"));
  // The undated rows, ordered and noted as before. With no hearing date on any
  // row (Worker 0.16.1) this is the whole list.
  const upcomingHearings = hearings ? hearings.undated : null;
  const recentItems = items ? sortSignalsNewestFirst(items.filter(s => COMMITTEE_RECENT_LABELS.has(s.source))) : null;
  const hearingsOrder = hearingOrderNote(upcomingHearings);
  const hearingsHeld = heldOfAvailable(fresh, ["Upcoming Senate hearings"], (hearingRows || []).length);
  const recentHeld = heldOfAvailable(fresh, [...COMMITTEE_RECENT_LABELS], (recentItems || []).length);

  const exportPrepPack = () => {
    const rows = recentItems || [];
    if (rows.length === 0) { toast("No live committee items to export yet", "error"); return; }
    exportRowsCSV(
      ["date", "feed", "title", "link"],
      rows.map(r => [r.date, r.source, r.title, r.link || ""]),
      `parliament-pulse-committee-prep-${new Date().toISOString().slice(0,10)}.csv`,
    );
    toast("Committee prep pack exported", "brass");
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament</div>
          <h1 className="page-title">Committees</h1>
          <div className="page-sub">Senate, House and joint committee hearings, inquiries and reports from the official APH committee feeds, each linked to its page on aph.gov.au.</div>
        </div>
        <button className="btn ghost" title="Export the current live committee rows" onClick={exportPrepPack}><Icon name="brief" size={13}/> Export prep pack</button>
      </div>

      {/* UX-14: one list per kind. The combined "latest activity" strip repeated
          every row of the two lists below, so it is gone. */}
      <div className="grid g-3" style={{marginBottom:18}}>
        {/* With hearing dates (Worker 0.16.2) the tile counts only hearings dated
            today or later; without them it counts notices, which include hearings
            that have passed, and says so. */}
        {hearings && hearings.anyDated
          ? <div className="panel stat" data-stat="hearings"><div className="stat-label">Upcoming Senate hearings</div><div className="stat-value">{hearings.upcoming.length}</div><div className="stat-meta">dated today or later</div></div>
          : <div className="panel stat" data-stat="hearings"><div className="stat-label">Senate hearing notices</div><div className="stat-value">{(hearingRows || []).length}</div><div className="stat-meta">{hearingsHeld ? `${hearingsHeld} · ` : ""}no hearing dates supplied</div></div>}
        <div className="panel stat" data-stat="inquiries"><div className="stat-label">Inquiries and reports</div><div className="stat-value">{(recentItems || []).length}</div>{recentHeld && <div className="stat-meta">{recentHeld} archived</div>}</div>
        <div className="panel stat"><div className="stat-label">Official committee feeds</div><div className="stat-value">{COMMITTEE_STRIP_LABELS.size}<span className="unit">tracked</span></div></div>
      </div>

      <TodaysHearingsPanel />

      <div className="grid g-2">
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Upcoming Senate hearings</h2><span className="panel-kicker" data-hearings-kicker="">{hearings && hearings.anyDated
            ? `${hearings.upcoming.length} dated today or later · ${hearings.held.length} recently held`
            : `${hearingsHeld || (hearingRows || []).length} notices from the APH feed`}</span></div>
          <div className="panel-body">
            {hearings && hearings.anyDated ? (
              <>
                <p data-hearing-sort="" style={{margin:"0 0 10px", color:"var(--ink-2)", fontSize:"var(--t-body-sm)"}}>Soonest hearing first, by the hearing date the APH feed prints. {hCopy.sort}</p>
                <div data-hearings-upcoming="">
                  <SittingDeskList
                    rows={hearings.upcoming} emptyIcon="signal" hearingLabel="Hearing"
                    unavailableText={null}
                    emptyKicker="No hearing dated today or later"
                    emptyBody={<>No hearing in the feed window is dated today or later. <a href={HEARINGS_URL} target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Open committee hearings on aph.gov.au</a>.</>}
                  />
                </div>
                {hearings.held.length > 0 && (
                  <div data-hearings-held="" style={{marginTop:16, paddingTop:12, borderTop:"1px solid var(--line-2)"}}>
                    <h3 className="mono t-label" style={{margin:"0 0 6px", color:"var(--ink-3)", textTransform:"uppercase", letterSpacing:".14em"}}>Recently held</h3>
                    <p style={{margin:"0 0 6px", color:"var(--ink-3)", fontSize:"var(--t-caption)"}} data-hearings-held-note="">{hCopy.held}</p>
                    {hearings.held.map((s, i) => <LiveSignalRow key={s.id || i} s={s} isLast={i === hearings.held.length - 1} hearingLabel={hCopy.heldLabel} />)}
                  </div>
                )}
                {hearings.undated.length > 0 && (
                  <div data-hearings-undated="" style={{marginTop:16, paddingTop:12, borderTop:"1px solid var(--line-2)"}}>
                    <h3 className="mono t-label" style={{margin:"0 0 6px", color:"var(--ink-3)", textTransform:"uppercase", letterSpacing:".14em"}}>No hearing date in the feed</h3>
                    {hearingsOrder && <p data-hearing-order="" style={{margin:"0 0 6px", color:"var(--ink-3)", fontSize:"var(--t-caption)"}}>{hearingsOrder}</p>}
                    {hearings.undated.map((s, i) => <LiveSignalRow key={s.id || i} s={s} isLast={i === hearings.undated.length - 1} />)}
                  </div>
                )}
              </>
            ) : (
              <>
                {hearingsOrder && <p data-hearing-order="" style={{margin:"0 0 10px", color:"var(--ink-2)", fontSize:"var(--t-body-sm)"}}>{hearingsOrder}</p>}
                <SittingDeskList
                  rows={upcomingHearings} emptyIcon="signal"
                  unavailableText={<>Parliament Pulse holds no verified upcoming Senate hearings right now because the live signal feed is unavailable. <a href={HEARINGS_URL} target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Open committee hearings on aph.gov.au</a>.</>}
                  emptyKicker="No upcoming hearings listed"
                  emptyBody={<>The Upcoming Senate hearings feed lists no hearings in the current live window. <a href={HEARINGS_URL} target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Open committee hearings on aph.gov.au</a>.</>}
                />
              </>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Inquiries and reports</h2><span className="panel-kicker">{`${recentHeld || (recentItems || []).length} from the APH feeds`}</span></div>
          <div className="panel-body">
            <SittingDeskList
              rows={recentItems} emptyIcon="signal"
              unavailableText={<>Parliament Pulse holds no verified committee reports or inquiries right now because the live signal feed is unavailable. <a href="https://www.aph.gov.au/Parliamentary_Business/Committees" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Open committee reports on aph.gov.au</a>.</>}
              emptyKicker="No reports or inquiries listed"
              emptyBody={<>The committee inquiry and report feeds list no items in the current live window. <a href="https://www.aph.gov.au/Parliamentary_Business/Committees" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Open committee reports on aph.gov.au</a>.</>}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- BILLS ----------
function PageBills() {
  const live = useLiveBills();
  const bills = live.items; // null = nothing has ever loaded; array (maybe empty) once live
  // The /bills list is the archive of the Bills Digests feed. When that feed's
  // latest check failed, the list is only as current as its last success, so the
  // header says so instead of a Live chip (UX review, 5 Oct 2026: HTTP 403 since
  // 4 Oct while the page read LIVE).
  const { liveState } = useStore();
  const digestCheck = feedCheckFor(liveState && liveState.blocks, "Bills Digests");
  const digestFailing = !!digestCheck && feedHealthState(digestCheck) === "failed";
  const digestSince = digestCheck ? fmtPollStamp(digestCheck.lastSuccessAt) : null;
  const digestPending = !!digestCheck && feedHealthState(digestCheck) === "pending";
  // Why the list is empty, from the feed's health rather than assumed: a feed
  // that has never succeeded returned nothing at all (review round 6: a timeout
  // read "returned no bills just now").
  const digestError = digestCheck ? (digestCheck.error || (digestCheck.lastHttpStatus ? `HTTP ${digestCheck.lastHttpStatus}` : null)) : null;
  const emptyBills = digestFailing
    ? { kicker: "Bills Digest feed failing", text: digestSince
        ? `The Bills Digest feed's latest check failed${digestError ? ` (${digestError})` : ""}. It last answered at ${digestSince}, and Parliament Pulse holds no bills from it.`
        : `The Bills Digest feed has not answered a check successfully yet${digestError ? ` (latest: ${digestError})` : ""}, so Parliament Pulse holds no bills from it.` }
    : digestPending
      ? { kicker: "Not yet polled", text: "The Parliament Pulse service has not polled the Bills Digest feed yet." }
      : { kicker: "No bills returned", text: "The Bills Digest feed returned no bills just now." };
  const billCount = bills ? (live.total != null && live.total > bills.length ? `${bills.length} of ${live.total} bills` : `${bills.length} bill${bills.length !== 1 ? "s" : ""}`) : null;

  const fmtBillDate = (iso) => fmtIsoDate(iso, true);

  // UX-03: a column in which every bill shares one value separates nothing, so it
  // collapses to a single line that says so.
  const attAll = uniformScore(bills, "attention");
  const confAll = uniformScore(bills, "confidence");
  const showAtt = attAll === undefined;
  const showConf = confAll === undefined;
  const disclosure = attentionDisclosure(scoringDims((bills || []).map(b => b.scoring_explanation)));

  const exportBills = () => {
    const headers = ["title", "published", "attention", "confidence", "link"];
    const rows = (bills || []).map(b => [b.title, b.pub_date || "", attentionWord(b.attention) || "not scored", confidenceLabel(b.confidence), b.link || ""]);
    exportRowsCSV(headers, rows, `parliament-pulse-bills-${new Date().toISOString().slice(0,10)}.csv`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament · Bills Intelligence</div>
          <h1 className="page-title">Bills intelligence</h1>
          <div className="page-sub" data-bills-scope="">Lists bills that have a Bills Digest in the Parliamentary Library feed, not every bill before Parliament. Each title links to its ParlInfo record; attention and confidence are Parliament Pulse's own scoring. For every bill, <a href="https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>search bills on aph.gov.au</a>.</div>
        </div>
        <div style={{display:"flex", gap:10, alignItems:"center"}}>
          {bills && (digestFailing
            ? <span className="chip-fixture chip-caution" data-bills-feed-failing="" title="The latest check of the Bills Digests feed failed; see Sources">{digestSince ? `Bills Digest feed failing since ${digestSince}; list as at then` : "Bills Digest feed failing; no successful check yet"}</span>
            : <ProvenanceChip provenance="live" title="Bills from the Parliamentary Library Bills Digest feed" />)}
          <button className="btn" disabled={!bills || bills.length === 0} onClick={exportBills}><Icon name="download" size={13}/> Export register</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Tracked bills</h2>
          <span className="panel-kicker">{bills ? [billCount, fetchedClause(live.fetchedAt)].filter(Boolean).join(" · ") :(live.status === "loading" ? "Loading…" : NO_VALUE)}</span>
        </div>
        {live.status === "loading" && !bills ? <SkeletonTable rows={6} /> : !bills ? (
          <div className="panel-body">
            <EmptyState icon="bill" kicker="Live data unavailable" variant="error">
              Parliament Pulse could not load the bills list just now, so it shows nothing rather than an invented list. <a href="https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Open Bills Legislation on aph.gov.au</a>.
            </EmptyState>
          </div>
        ) : bills.length === 0 ? (
          <div className="panel-body">
            <EmptyState icon="bill" kicker={emptyBills.kicker} variant={digestFailing ? "error" : undefined}>
              <span data-bills-empty={digestFailing ? "failing" : digestPending ? "pending" : "empty"}>{emptyBills.text}</span> <a href="https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Open Bills Legislation on aph.gov.au</a>.
            </EmptyState>
          </div>
        ) : (
          <>
          {(!showAtt || !showConf) && (
            <div className="panel-body score-uniform" style={{fontSize:"var(--t-body-sm)", color:"var(--ink-3)", paddingBottom:0}}>
              {!showAtt && <div data-uniform="attention">{uniformScoreLine(bills.length, "attention", attAll)}</div>}
              {!showConf && <div data-uniform="confidence">{uniformScoreLine(bills.length, "confidence", confAll)}</div>}
            </div>
          )}
          <div className="table-scroll">
          <table className="ds ds-stack" data-bills-table="">
            <thead><tr>
              <th>Title</th><th>Published</th>{showAtt && <th data-col="attention" title={disclosure}>Attention</th>}{showConf && <th data-col="confidence">Confidence</th>}
            </tr></thead>
            <tbody>
              {bills.map(b => {
                const link = safeHttpUrl(b.link);
                return (
                  <tr key={b.guid}>
                    <td className="ds-lead" data-label="Title" style={{fontWeight:500}}>
                      {link
                        ? <a href={link} target="_blank" rel="noopener noreferrer" style={{color:"var(--link)", textDecoration:"none"}} title="Opens the source at aph.gov.au">{b.title} <Icon name="ext" size={11} style={{verticalAlign:"-1px"}}/></a>
                        : b.title}
                      {/* description is null on every row today: render nothing rather
                          than an empty element, and never invent a summary. */}
                      {b.description && <div style={{fontSize:"var(--t-caption)", color:"var(--ink-3)", marginTop:2}}>{b.description}</div>}
                    </td>
                    <td className="mono" data-label="Published" style={{fontSize:"var(--t-caption)", color:"var(--ink-3)"}}>{fmtBillDate(b.pub_date)}</td>
                    {showAtt && <td data-col="attention" data-label="Attention"><Att level={b.attention} disclosure={disclosure} /></td>}
                    {showConf && <td data-col="confidence" data-label="Confidence"><Conf n={b.confidence} /></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="panel-body score-disclosure" data-att-disclosure-line="" style={{fontSize:"var(--t-caption)", color:"var(--ink-4)"}}>{disclosure}</div>
          </>
        )}
      </div>

      <div className="panel" style={{marginTop:16}}>
        <div className="panel-head"><h2 className="panel-title">Recent House divisions</h2><span className="panel-kicker">Latest in the feed, not matched to these bills</span></div>
        <div className="panel-body">
          <DivisionsLiveList />
        </div>
      </div>
    </div>
  );
}

// ---------- PARLIAMENT ----------
function PageParliament() {
  const live = useLiveState("signals");
  // Chamber feeds matched against signal.source (the feed_label). Casing here is
  // the Worker's REAL value (verified against workers/aph-proxy/src/jurisdictions.json
  // and a live /state probe, 2026-07-22) — the previous filters here compared
  // against "House Daily Program" / "House Divisions" (title case), which never
  // matched a real row, so both strips silently rendered nothing on every poll
  // regardless of whether the House was sitting.
  // The House daily program feed holds one item whose guid never changes, so the
  // archive kept the 16 September program and showed it as current weeks later
  // (UX and data review, 5 Oct 2026). It shows only when meta.feeds says the feed
  // carried an item in today's poll (Brisbane); otherwise the empty state names
  // the day the program was last seen. A Worker that sends no meta.feeds keeps
  // the previous behaviour.
  const { liveState } = useStore();
  const fresh = (liveState && liveState.blocks && liveState.blocks.freshness) || null;
  const programSeenAt = feedLastSeenAt(fresh, "House daily program");
  const programSeenMs = programSeenAt ? Date.parse(programSeenAt) : NaN;
  const programKnown = !!(fresh && Array.isArray(fresh.feeds) && fresh.feeds.length);
  const programToday = !programKnown || (!Number.isNaN(programSeenMs) && brisbaneDayKey(programSeenMs) === brisbaneDayKey());
  const dailyProgramLive = live.items ? (programToday ? live.items.filter(s => s.source === "House daily program") : []) : null;
  const programLastSeen = !programToday && !Number.isNaN(programSeenMs) ? fmtDayMon(programSeenMs) : null;
  const divisionsLive = live.items ? live.items.filter(s => s.source === "House divisions") : null;
  const newsLive = live.items ? live.items.filter(s => s.source === "House news" || s.source === "House media releases") : null;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament</div>
          <h1 className="page-title">Daily program</h1>
          <div className="page-sub">The chamber program, divisions, hearings and House news from the official APH feeds.</div>
        </div>
      </div>

      <div className="grid g-overview">
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">House · daily program</h2></div>
          <div className="panel-body">
            <SittingDeskList
              rows={dailyProgramLive} emptyIcon="clock"
              unavailableText={<>Parliament Pulse holds no verified daily program right now because the live signal feed is unavailable. <a href="https://www.aph.gov.au/Parliamentary_Business/Chamber_documents" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Open the House daily program on aph.gov.au</a>.</>}
              emptyKicker={programToday ? "No daily program items in the feed window" : "No daily program today"}
              emptyBody={recessEmptyText(programToday
                ? "The House daily program feed lists no items in the current feed window."
                : `The House daily program feed has carried no program today${programLastSeen ? `; the last program it carried was seen on ${programLastSeen}` : ""}.`,
                "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", "Open the House daily program on aph.gov.au")}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Recent divisions</h2><span className="panel-kicker">House</span></div>
          <div className="panel-body">
            <DivisionsLiveList />
          </div>
        </div>
      </div>

      <TodaysHearingsPanel />

      {/* FE-04: the Parliamentary lines panel has no live source, so it renders only
          behind the unsourced-surfaces flag; House news then takes the full width. */}
      <div className={SITE_CONFIG.showUnsourcedSurfaces ? "grid g-2" : undefined} style={{marginTop:16}}>
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">House news & media</h2></div>
          <div className="panel-body">
            <SittingDeskList
              rows={newsLive} emptyIcon="signal"
              unavailableText={<>Parliament Pulse holds no verified House news right now because the live signal feed is unavailable. <a href="https://www.aph.gov.au/house/rss/house_news" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Open House news on aph.gov.au</a>.</>}
              emptyKicker="No House news listed"
              emptyBody={<>The House news and media release feeds list no items in the current live window. <a href="https://www.aph.gov.au/house/rss/house_news" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Open House news on aph.gov.au</a>.</>}
            />
          </div>
        </div>
        {SITE_CONFIG.showUnsourcedSurfaces && (
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Parliamentary lines</h2><span className="chip-fixture" style={{marginLeft:"auto"}}>Sample data</span></div>
          <div className="panel-body">
            <div style={{padding:12, border:"1px dashed var(--line-2)", borderRadius:8, fontSize:"var(--t-body-sm)", color:"var(--ink-3)", lineHeight:1.6, fontStyle:"italic"}}>
              <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:8, fontStyle:"normal"}}>No lines drafted yet</div>
              Lines will appear here once generated by an analyst. Use "Generate brief" from a signal to start the drafting workflow.
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ---------- PATTERNS ----------
// Format a thread span date (day + month) from an ISO timestamp.
function fmtSpanDate(iso) {
  return fmtIsoDate(iso, false);
}

// A thread's date range. With Worker 0.16.3 publication dates it reads
// "published 23 Jun to 14 Aug"; without them (an older Worker, or a thread whose
// members carry no pubDate) it falls back to the ingest times, labelled as
// when Parliament Pulse saw the items, so no ingest time reads as a publication.
function threadSpan(t) {
  const a = t.firstPubDate ? fmtSpanDate(t.firstPubDate) : null;
  const b = t.lastPubDate ? fmtSpanDate(t.lastPubDate) : null;
  if (a || b) {
    const text = a && b && a !== b ? `published ${a} to ${b}` : `published ${a || b}`;
    return { text, pub: true, title: "The earliest and latest APH publication dates among the items in this thread" };
  }
  return { text: `first seen ${fmtSpanDate(t.firstSeenAt)} · last seen ${fmtSpanDate(t.lastSeenAt)}`, pub: false, title: "When Parliament Pulse first and last saw an item in this thread, not when APH published it" };
}

// One live thread row. The product-owned facts (item count, first/last seen) lead;
// the thread title is a quoted identifier with no anchor of its own (threads carry no
// link field; spec 4.3). Expanding lists member signals, each anchored to its APH link.
function ThreadRow({ t, byGuid, isLast }) {
  const [open, setOpen] = useState(false);
  const resolved = t.signalGuids.map(g => byGuid.get(g)).filter(Boolean);
  const unresolved = t.signalGuids.length - resolved.length;
  const span = threadSpan(t);
  return (
    <div style={{padding:"12px 0", borderBottom: isLast ? 0 : "1px solid var(--line)"}}>
      <button onClick={() => setOpen(v => !v)} aria-expanded={open}
        style={{display:"flex", alignItems:"center", flexWrap:"wrap", columnGap:12, rowGap:4, width:"100%", minHeight:24, background:"none", border:"none", padding:0, cursor:"pointer", textAlign:"left", color:"inherit"}}>
        <Icon name="chevron" size={13} style={{flexShrink:0, transform: open ? "rotate(90deg)" : "none", transition:"transform .15s"}}/>
        <span style={{fontSize:"var(--t-body-sm)", fontWeight:600, color:"var(--ink)", whiteSpace:"nowrap"}}>{t.itemCount} item{t.itemCount !== 1 ? "s" : ""}</span>
        <span className="mono" data-thread-span={span.pub ? "published" : "seen"} title={span.title} style={{fontSize:"var(--t-eyebrow)", color:"var(--ink-3)", whiteSpace:"nowrap"}}>{span.text}</span>
        {/* The thread title is the product's own clustering label, not APH-sourced
            prose. It is framed with a "Cluster" tag so it reads unambiguously as the
            product's analysis (threads carry no link; spec 4.3). */}
        <span className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".1em", marginLeft:4}}>Thread</span>
        <span style={{color:"var(--ink-2)", fontSize:"var(--t-body-sm)", fontWeight:500, flex:"1 1 18rem", minWidth:0}}>{t.title}</span>
      </button>
      {open && (
        <div style={{marginTop:10, marginLeft:25, display:"grid", gap:8}}>
          {resolved.map((s, i) => (
            <div key={s.id || i} style={{display:"grid", gap:4}}>
              {/* Licence rule: the live APH title renders only inside an anchor to a
                  valid APH link; with no link it falls back to the source label,
                  never a bare title inside a "#" anchor. */}
              {s.link
                ? <a href={s.link} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex", alignItems:"center", gap:6, color:"var(--link)", textDecoration:"none", fontSize:"var(--t-body-sm)", fontWeight:500}} title="Opens the source at aph.gov.au">
                    {s.title} <Icon name="ext" size={11}/>
                  </a>
                : <span style={{fontSize:"var(--t-body-sm)", fontWeight:500, color:"var(--ink-2)"}}>{s.source}</span>}
              <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"}}>
                <span className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".12em"}}>{(s.tags && s.tags[0] && s.tags[0].l) || "item"}</span>
                <span style={{fontSize:"var(--t-eyebrow)", color:"var(--ink-3)"}}>{feedDisplayName(s.source)}</span>
                {s.committee && <span data-committee="" style={{fontSize:"var(--t-eyebrow)", color:"var(--ink-3)"}}>{s.committee}</span>}
                <span className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)"}}>{s.date}</span>
              </div>
            </div>
          ))}
          {unresolved > 0 && (
            <div className="mono" style={{fontSize:"var(--t-eyebrow)", color:"var(--ink-4)"}}>{unresolved} further item{unresolved !== 1 ? "s" : ""} in the archive</div>
          )}
        </div>
      )}
    </div>
  );
}

function PagePatterns() {
  const { openModal, toast } = useStore();
  const threads = useLiveState("threads");
  const signalsLive = useLiveState("signals");
  const byGuid = React.useMemo(() => new Map((signalsLive.items || []).map(s => [s.id, s])), [signalsLive.items]);
  const [clusterStatus, setClusterStatus] = useState("Needs analyst review");
  // Defensive against the QON fixture being emptied (or reshaped) upstream: never
  // assume .items exists, and derive every displayed number directly from it so a
  // stale hardcoded count can never outlive the data it once described.
  const qonItems = (QON_PATTERN && Array.isArray(QON_PATTERN.items)) ? QON_PATTERN.items : [];
  const qonMemberCount = new Set(qonItems.map(q => q.memberId || q.who).filter(Boolean)).size;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament · Scrutiny</div>
          <h1 className="page-title">Threads</h1>
          <div className="page-sub">Related live signals grouped into threads. Questions on notice will join these threads once a feed for them can be connected.</div>
        </div>
      </div>

      {!threads.items && (
        <div className="panel" style={{marginBottom:16}}>
          <div className="panel-head"><h2 className="panel-title">Signal threads</h2></div>
          <div className="panel-body">
            <EmptyState icon="pattern" kicker="No threads held">
              Parliament Pulse holds no signal threads right now, because the live archive returned none or could not be reached. Threads group live APH items; the items themselves are published through the <a href="https://www.aph.gov.au/Help/Rss_feeds" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>APH RSS feeds</a>.
            </EmptyState>
          </div>
        </div>
      )}

      {threads.items && (
        <div className="panel" style={{marginBottom:16}}>
          <div className="panel-head">
            <h2 className="panel-title">Signal threads</h2>
            <ProvenanceChip provenance={threads.displayProvenance} title="Parliament Pulse's own grouping of live signals (derived analysis)" />
            <span className="panel-kicker" style={{marginLeft:"auto"}}>{[threads.total != null && threads.total > threads.items.length ? `the ${threads.items.length} largest of ${threads.total} threads` : `the ${threads.items.length} largest threads`, fetchedClause(threads.fetchedAt)].filter(Boolean).join(" · ")}</span>
          </div>
          <div className="panel-body">
            {threads.items.length === 0
              ? <EmptyState icon="pattern" kicker="No threads">Thread detection groups related signals as they accumulate. Nothing has clustered yet.</EmptyState>
              : threads.items.map((t, i) => (
                <ThreadRow key={t.id || i} t={t} byGuid={byGuid} isLast={i === threads.items.length - 1} />
              ))}
          </div>
        </div>
      )}

      <div style={{padding:"10px 14px", background:"var(--panel-hi)", border:"1px solid var(--line-bright)", borderRadius:8, marginBottom:16, display:"flex", gap:10, alignItems:"center", color:"var(--ink-2)", fontSize:"var(--t-body-sm)"}}>
        <Icon name="flag" size={14} stroke="var(--info)"/>
        <span><strong>Questions on notice not connected</strong>: Parliament Pulse's search of ParlInfo returns no questions on notice, so none are held. {threads.items ? "The threads above are built from live signals. " : ""}<a href="https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents/qon" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Search questions on notice on aph.gov.au</a>.</span>
      </div>

      {/* FE-04: the QON_PATTERN block (and its Draft Estimates monitor note button)
          has no live source, so it renders only behind the unsourced-surfaces flag. */}
      {SITE_CONFIG.showUnsourcedSurfaces && qonItems.length > 0 ? (
      <div className="pattern">
        <div className="ribbon">Clustered pattern · moderate confidence</div>
        <div className="serif" style={{fontSize:"var(--t-headline)", fontWeight:500, marginBottom:6, paddingRight:200}}>Clustered scrutiny pattern{QON_PATTERN.topic ? ` on ${QON_PATTERN.topic}` : ""}</div>
        {QON_PATTERN.trigger && (
          <div style={{color:"var(--ink-2)", fontSize:"var(--t-body-sm)", maxWidth:720}}>
            {qonItems.length} related question{qonItems.length !== 1 ? "s" : ""} lodged by {qonMemberCount} member{qonMemberCount !== 1 ? "s" : ""}{QON_PATTERN.window ? ` within ${QON_PATTERN.window}` : ""}. Trigger likely: {QON_PATTERN.trigger}.
          </div>
        )}

        <div className="grid g-4" style={{marginTop:16, marginBottom:18}}>
          <div><div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Members</div><div style={{fontSize:"var(--t-subhead)", marginTop:4}}>{qonMemberCount}</div></div>
          <div><div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Questions</div><div style={{fontSize:"var(--t-subhead)", marginTop:4}}>{qonItems.length}</div></div>
          <div><div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Window</div><div style={{fontSize:"var(--t-subhead)", marginTop:4}}>{QON_PATTERN.window || NOT_SUPPLIED}</div></div>
          <div><div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Target</div><div style={{fontSize:"var(--t-body-sm)", marginTop:4, lineHeight:1.25}}>{QON_PATTERN.target || NOT_SUPPLIED}</div></div>
        </div>

        <div style={{borderTop:"1px dashed var(--line-2)", paddingTop:14}}>
          <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:8}}>Evidence</div>
          {qonItems.map((q,i) => {
            const mid = q.memberId;
            const canOpen = !!(mid && ENTITIES.members[mid]);
            return (
              <div key={q.when + q.who} className="g-qon-evidence" style={{display:"grid", gap:12, padding:"8px 0", borderBottom: i<qonItems.length-1 ? "1px solid var(--line)" : 0, alignItems:"start", fontSize:"var(--t-body-sm)"}}>
                <div className="mono" style={{color:"var(--ink-3)"}}>{q.when}</div>
                <div>{canOpen
                  ? <button type="button" className="tag brass clk" onClick={() => openModal("member", mid)}>{q.who}</button>
                  : <span className="tag brass" style={{opacity:.65}}>{q.who}</span>}</div>
                <div style={{color:"var(--ink-2)"}}>{q.q}</div>
                <div style={{textAlign:"right"}}><span className="tag">{q.chamber}</span></div>
              </div>
            );
          })}
        </div>

        <div style={{display:"flex", gap:10, marginTop:16, flexWrap:"wrap"}}>
          <button className="btn" title="Copy an Estimates monitor note" onClick={() => copyText(`# Estimates monitor note\nGenerated: ${new Date().toISOString()}\n\nPattern: ${QON_PATTERN.topic || "Unknown"}\nStatus: ${clusterStatus}\n\nRecommended action: monitor for Estimates references and verify against Hansard or QON source material.`, toast, "Estimates monitor note copied")}><Icon name="brief" size={13}/> Draft Estimates monitor note</button>
          <button className="btn" title="Mark this cluster as tracked in this session" onClick={() => { setClusterStatus("Tracked"); toast("Cluster marked as tracked", "brass"); }}><Icon name="watch" size={13}/> Track cluster</button>
          <button className="btn" title="Confirm the analyst classification for this session" onClick={() => { setClusterStatus("Confirmed as coordinated"); toast("Cluster confirmed for review", "brass"); }}><Icon name="check" size={13}/> Confirm as coordinated</button>
          <button className="btn ghost" title="Classify the cluster as coincidence in this session" onClick={() => { setClusterStatus("Marked as coincidence"); toast("Cluster marked as coincidence"); }}>Mark as coincidence</button>
        </div>
        <div className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-3)", marginTop:8, letterSpacing:".08em"}}>Session status: {clusterStatus}</div>
      </div>
      ) : (
      <div className="panel">
        <div className="panel-head"><h2 className="panel-title">Clustered scrutiny pattern</h2></div>
        <div className="panel-body">
          <EmptyState icon="pattern" kicker="No questions on notice held">
            Parliament Pulse holds no questions on notice to find a scrutiny pattern in, because its search of ParlInfo returns none. <a href="https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents/qon" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Search questions on notice on aph.gov.au</a>, or <a href="https://www.aph.gov.au/Parliamentary_Business/Senate_estimates" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>open Senate Estimates</a>.
          </EmptyState>
        </div>
      </div>
      )}

    </div>
  );
}

// ---------- BRIEFINGS ----------
function PageBriefings() {
  const [selId, setSelId] = useState(null);
  // Local, honest "Mark reviewed" state: page-session state only, since store.jsx sits
  // outside this file's edit scope. It genuinely changes what the queue displays the
  // moment a brief is marked, where the previous control only fired a toast and left
  // the brief's status untouched.
  const [reviewedIds, setReviewedIds] = useState({});
  const { toast, state, setSignalSearchQuery, navigate } = useStore();
  // A generated brief may reference a live signal, so resolve sids against both the
  // fixture and the live inbox (spec 2.5).
  const live = useLiveState("signals");
  const known = live.items ? [...SIGNALS, ...live.items] : SIGNALS;

  // The queue is the user's own generated briefs only (state.briefsGenerated). The
  // previous four static "Example" rows always rendered the identical hardcoded
  // procurement-inquiry preview regardless of which row was selected, so they have
  // been deleted entirely, per the honest-empty-state rule (spec: a clean empty state
  // beats keeping something that looks richer).
  const briefs = Object.entries(state.briefsGenerated || {}).map(([sid, v]) => {
    const sig = known.find(s => s.id === sid);
    // F11: fix the "For undefined" label — precedence bug. Use an explicit ternary.
    // A live signal's queue label uses its source, never the raw APH title as
    // standalone product prose; fixture briefs keep their title label.
    const label = sig ? (sig.isLive ? sig.source : (sig.title.slice(0, 40) + "…")) : sid;
    return { type: v.type || "Executive brief", for: label, status: "Copied to clipboard", _sid: sid, _ts: v.ts };
  }).sort((a, b) => b._ts - a._ts);
  const briefId = (b) => b._sid;
  const selected = briefs.find(b => briefId(b) === selId) || briefs[0];
  const selectedId = selected ? briefId(selected) : null;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Workflow</div>
          <h1 className="page-title">Briefings</h1>
          <div className="page-sub">Briefs you generate from a signal appear here with their source, scoring, evidence links and provenance.</div>
        </div>
        <div style={{display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end"}}>
          <button className="btn" disabled={briefs.length === 0} onClick={() => downloadBriefingQueue(briefs, toast)}><Icon name="download" size={13}/> Export queue</button>
          <button className="btn" title="Open signals to generate a brief" onClick={() => { setSignalSearchQuery(""); navigate("signals"); }}><Icon name="plus" size={13}/> Choose a signal</button>
        </div>
      </div>

      <div className="grid g-briefings" style={{gap:16}}>
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Queue</h2><span className="panel-kicker">{briefs.length} generated</span></div>
          <div>
            {briefs.length === 0 ? (
              <EmptyState icon="brief" kicker="No briefs yet">Open any signal and choose Generate brief. Your briefs appear here with their evidence links.</EmptyState>
            ) : briefs.map((b, i) => {
              const id = briefId(b);
              const status = reviewedIds[id] ? "Reviewed" : b.status;
              return (
              <div key={id} className="list-row" role="button" tabIndex={0} aria-pressed={selectedId===id}
                onClick={() => setSelId(id)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelId(id); } }}
                style={{cursor:"pointer", background: selectedId===id ? "var(--panel-hi)" : "transparent", borderLeft: selectedId===id ? "2px solid var(--brass)" : "2px solid transparent"}}>
                <div style={{fontSize:"var(--t-body-sm)", fontWeight:500}}>{b.type}</div>
                <div style={{fontSize:"var(--t-caption)", color:"var(--ink-3)"}}>For {b.for}</div>
                <div className="mono t-label" style={{marginTop:4, color: status === "Reviewed" ? "var(--ok)" : status.startsWith("Copied") ? "var(--ink-3)" : "var(--ink-4)", textTransform:"uppercase", letterSpacing:".12em"}}>{status}</div>
              </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">{selected ? selected.type : "No brief"} · preview</h2>
            <span className="panel-kicker">{selected ? `For ${selected.for}` : "Queue empty"}</span>
            <div style={{marginLeft:"auto", display:"flex", gap:6, flexWrap:"wrap"}}>
              <button className="btn ghost sm" disabled={!selected} onClick={() => window.print()}><Icon name="download" size={12}/> Print</button>
              <button className="btn sm" disabled={!selected} title="Copy a send-ready handoff note" onClick={() => copyText(`# Brief handoff\nType: ${selected.type}\nFor: ${selected.for}\nStatus: ${reviewedIds[selectedId] ? "Reviewed" : selected.status}\nGenerated: ${new Date().toISOString()}`, toast, "Brief handoff copied")}>Copy handoff</button>
              <button className="btn ghost sm" disabled={!selected || reviewedIds[selectedId]} title="Mark this brief reviewed in the local queue" onClick={() => { setReviewedIds(r => ({ ...r, [selectedId]: true })); toast(`Marked reviewed: ${selected.type}`, "brass"); }}>{selected && reviewedIds[selectedId] ? "Reviewed" : "Mark reviewed"}</button>
            </div>
          </div>
          <div className="panel-body">
            {(() => {
              const b = selected;
              if (!b) return <div className="empty">No briefs in the queue. Open any signal and choose Generate brief.</div>;
              const sig = b._sid ? known.find(s => s.id === b._sid) : null;
              if (!sig) {
                return (
                  <EmptyState icon="brief" kicker="Source signal not found">
                    Parliament Pulse cannot rebuild this brief because the original signal is no longer in the inbox.
                  </EmptyState>
                );
              }
              const brief = buildBriefSections(sig, !!sig.isLive);
              return (
              <div className="brief">
                <div className="meta">PARLIAMENT PULSE · {b.type.toUpperCase()} · {[brief.meta.date, brief.meta.time].filter(Boolean).join(" · ")}</div>
                {/* Licence rule: a live APH title renders only inside an anchor to
                    its APH link; no link falls back to the source label. */}
                <h3>{brief.isLive
                  ? (brief.link
                      ? <a href={brief.link} target="_blank" rel="noopener noreferrer" style={{color:"inherit"}} title="Open the source at aph.gov.au">{brief.title} <Icon name="ext" size={12} style={{verticalAlign:"-1px", opacity:.6}}/></a>
                      : brief.meta.source)
                  : brief.title}</h3>
                <h5>{brief.isLive ? brief.summaryHeading : "What happened"}</h5>
                <div>{brief.summary}</div>
                <h5>Source</h5>
                <div>{brief.meta.source} · {brief.meta.sourceAuthority} · {brief.meta.date}</div>
                {brief.whyItMatters && <>
                  <h5>Why it matters</h5>
                  <div>{brief.whyItMatters}</div>
                </>}
                {brief.recommendedAction && <>
                  <h5>Recommended action</h5>
                  <div><strong>{brief.recommendedAction.label}.</strong> {brief.recommendedAction.reason}</div>
                </>}
                {brief.evidence.length > 0 && <>
                  <h5>Evidence</h5>
                  <ul>{brief.evidence.map((e,i) => <li key={i}><a href={e.url} target="_blank" rel="noopener noreferrer" style={{color:"var(--brief-link)", textDecoration:"underline"}}>{e.label}</a></li>)}</ul>
                </>}
                <h5>Provenance</h5>
                <div>{brief.provenance}</div>
                {/* PR-13: the licence attribution travels with the brief, on screen and in print. */}
                <div className="brief-attrib" data-brief-attribution="">{APH_ATTRIBUTION}</div>
              </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- ALERT RULES ----------
// The alerts engine runs inside every feed poll and has run since launch,
// but has never had a rule to evaluate: GET /alerts has always returned
// {"rules":[]} (verified live, 2026-07-22) because no rule has ever been
// created. This panel is the missing surface: create/list/delete a rule against
// the Worker's real endpoints, and show matched events from the /state alerts
// block via the existing useLiveState hook. Placed on the Watchlists page,
// which is the closest existing analogue in the information architecture — both
// features are "define match criteria, get told when something matches", the
// only difference being where the matching runs (this browser session vs the
// Worker's own poll, which fires even when nobody has the tab open).
function renderMatchedAlertEvent(e, i) {
  // The alert_events shape has never been observed live (the table has zero
  // rows so far), so this renders only fields that are actually present under
  // a set of plausible names, with a neutral fallback label — never an invented
  // specific field.
  const title = e.title || e.signal_title || e.rule_name || e.name || "Alert match";
  const link = safeHttpUrl(e.link || e.signal_link || "");
  const when = e.matched_at || e.created_at || e.ts || null;
  return (
    <div key={e.id || i} style={{padding:"8px 0", borderBottom:"1px solid var(--line)"}}>
      {link
        ? <a href={link} target="_blank" rel="noopener noreferrer" style={{color:"var(--link)", textDecoration:"none", fontWeight:500, fontSize:"var(--t-body-sm)"}} title="Opens the source at aph.gov.au">{title} <Icon name="ext" size={11}/></a>
        : <span style={{fontWeight:500, fontSize:"var(--t-body-sm)"}}>{title}</span>}
      {when && fmtFetchedAt(when) !== NOT_SUPPLIED && <div className="mono" style={{fontSize:"var(--t-eyebrow)", color:"var(--ink-4)", marginTop:2}}>{fmtFetchedAt(when)} AEST</div>}
    </div>
  );
}

function AlertRulesPanel() {
  const { toast } = useStore();
  const [rules, setRules] = useState(null);       // null = not loaded yet, or every attempt has failed
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState("");
  const [terms, setTerms] = useState("");
  const [attentionMin, setAttentionMin] = useState("any");
  const [sourceGroup, setSourceGroup] = useState("");
  const [kind, setKind] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const matched = useLiveState("alerts");
  // LB-04 (2026-07-23): the Worker's server-side alert writes are locked pending
  // decision D2 (client-local vs token-gated). Until then this panel is read-only:
  // it lists any live rules but offers no creation or deletion, and it never claims
  // a capability the product does not currently have. Flip to true when D2 lands.
  const ALERTS_WRITABLE = false;

  const loadRules = React.useCallback(() => {
    fetch(`${WORKER_BASE_URL}/alerts`)
      .then(res => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then(data => { setRules(Array.isArray(data.rules) ? data.rules : []); setLoadFailed(false); })
      .catch(() => setLoadFailed(true));
  }, []);
  React.useEffect(() => { loadRules(); }, [loadRules]);

  const createRule = () => {
    if (!ALERTS_WRITABLE) { toast("Rule creation is closed in this release.", "error"); return; }
    const termList = terms.split(",").map(t => t.trim()).filter(Boolean);
    if (!name.trim() || termList.length === 0) { toast("Name and at least one term are required", "error"); return; }
    setSubmitting(true);
    const body = { name: name.trim(), terms: termList };
    if (attentionMin !== "any") body.attention_min = attentionMin;
    if (sourceGroup.trim()) body.source_group = sourceGroup.trim();
    if (kind.trim()) body.kind = kind.trim();
    fetch(`${WORKER_BASE_URL}/alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(res => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json().catch(() => ({})); })
      .then(() => {
        toast(`Alert rule "${name.trim()}" created`, "brass");
        setName(""); setTerms(""); setAttentionMin("any"); setSourceGroup(""); setKind("");
        loadRules();
      })
      .catch(() => toast("Could not create the alert rule. Try again.", "error"))
      .finally(() => setSubmitting(false));
  };

  const deleteRule = (id, ruleName) => {
    fetch(`${WORKER_BASE_URL}/alerts/${encodeURIComponent(id)}`, { method: "DELETE" })
      .then(res => { if (!res.ok && res.status !== 204) throw new Error("HTTP " + res.status); })
      .then(() => { toast(`Alert rule "${ruleName}" removed`, "brass"); loadRules(); })
      .catch(() => toast("Could not remove the alert rule. Try again.", "error"));
  };

  return (
    <div className="panel" style={{marginTop:18}}>
      <div className="panel-head">
        <h2 className="panel-title">Alert rules</h2>
        <span className="panel-kicker">{rules ? `${rules.length} rule${rules.length !== 1 ? "s" : ""} configured` : "Loading…"}</span>
        {rules && rules.length > 0 && <ProvenanceChip provenance="live" title="Rules are read from the Parliament Pulse service" />}
      </div>
      <div className="panel-body">
        <p style={{margin:"0 0 14px", fontSize:"var(--t-body-sm)", color:"var(--ink-3)", lineHeight:1.6}}>
          The alerts engine evaluates each configured rule against every feed poll, whether or not
          this tab is open. A rule matches on its keyword terms, and can optionally require a minimum
          attention level, a source group, or a signal kind.
          {!ALERTS_WRITABLE && " You cannot yet create or remove rules here: that needs a sign-in, which this release does not have."}
        </p>

        {ALERTS_WRITABLE && (
        <div style={{display:"grid", gap:8, marginBottom:16}}>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <div style={{flex:"1 1 200px"}}>
              <label htmlFor="alert-name" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Name</label>
              <input id="alert-name" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. AI governance" className="search" style={{padding:"7px 10px", marginTop:4, width:"100%"}}/>
            </div>
            <div style={{flex:"2 1 260px"}}>
              <label htmlFor="alert-terms" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Terms (comma-separated)</label>
              <input id="alert-terms" value={terms} onChange={e=>setTerms(e.target.value)} placeholder="e.g. artificial intelligence, algorithm" className="search" style={{padding:"7px 10px", marginTop:4, width:"100%"}}/>
            </div>
          </div>
          <div style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"end"}}>
            <div>
              <label htmlFor="alert-attention" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Minimum attention</label><br/>
              <select id="alert-attention" className="select" value={attentionMin} onChange={e=>setAttentionMin(e.target.value)} style={{marginTop:4}}>
                <option value="any">Any</option>
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label htmlFor="alert-source-group" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Source group (optional)</label><br/>
              <input id="alert-source-group" value={sourceGroup} onChange={e=>setSourceGroup(e.target.value)} placeholder="e.g. Senate" className="search" style={{padding:"7px 10px", marginTop:4}}/>
            </div>
            <div>
              <label htmlFor="alert-kind" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Kind (optional)</label><br/>
              <input id="alert-kind" value={kind} onChange={e=>setKind(e.target.value)} placeholder="e.g. inquiry" className="search" style={{padding:"7px 10px", marginTop:4}}/>
            </div>
            <button className="btn primary" disabled={submitting} onClick={createRule}><Icon name="plus" size={13}/> {submitting ? "Creating…" : "Create rule"}</button>
          </div>
        </div>
        )}

        {rules === null ? (
          loadFailed ? (
            <EmptyState icon="bell" kicker="Alert rules unavailable" variant="error"
              action={<button className="btn ghost sm" onClick={loadRules}>Retry</button>}>
              Parliament Pulse could not load alert rules just now.
            </EmptyState>
          ) : <div className="mono" style={{fontSize:"var(--t-caption)", color:"var(--ink-4)"}}>Loading alert rules…</div>
        ) : rules.length === 0 ? (
          <EmptyState icon="bell" kicker="No alert rules configured yet">
            No alert rules are configured yet. Matches appear here within thirty minutes of creating one.
          </EmptyState>
        ) : (
          <div style={{display:"grid", gap:8, marginBottom:16}}>
            {rules.map(r => (
              <div key={r.id} style={{display:"flex", alignItems:"center", gap:10, padding:"8px 12px", border:"1px solid var(--line-2)", borderRadius:8}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:"var(--t-body-sm)", fontWeight:500}}>{r.name}</div>
                  <div style={{fontSize:"var(--t-caption)", color:"var(--ink-3)", marginTop:2}}>
                    {(Array.isArray(r.terms) ? r.terms : String(r.terms || "").split(",").map(t=>t.trim()).filter(Boolean)).join(", ")}
                    {r.attention_min && <> · min {r.attention_min}</>}
                    {r.source_group && <> · {r.source_group}</>}
                    {r.kind && <> · {r.kind}</>}
                  </div>
                </div>
                {ALERTS_WRITABLE && <button className="btn ghost sm" aria-label={`Remove alert rule ${r.name}`} onClick={() => deleteRule(r.id, r.name)}><Icon name="close" size={13}/></button>}
              </div>
            ))}
          </div>
        )}

        <h3 className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:8, marginBottom:8}}>Matched events</h3>
        {!matched.items ? (
          <div className="empty">
            {rules && rules.length > 0
              ? "No alert matches yet. The engine checks your rules on every feed poll."
              : "No alert rules are configured yet. Matches appear here within thirty minutes of creating one."}
          </div>
        ) : (
          <div style={{display:"grid", gap:6}}>{matched.items.map(renderMatchedAlertEvent)}</div>
        )}
      </div>
    </div>
  );
}

// ---------- WATCHLISTS ----------
function PageWatchlists() {
  const { openModal, createWatchlist, state, removeWatchlist } = useStore();
  const [newName, setNewName] = useState("");
  // Keyword matches are always computed live against matchSource (live.items when
  // connected, otherwise the empty SIGNALS fixture), never read from a stored
  // count: the WATCHLISTS fixture's matches/trend fields were invented and are
  // held null. derived only controls the chip label and the trend spark, since a
  // freshly-connected live stream has no history yet either.
  const live = useLiveState("signals");
  const matchSource = live.items || SIGNALS;
  const derived = !!live.items;
  const all = [...WATCHLISTS, ...state.watchlistCreated];
  const [selectedWl, setSelectedWl] = useState(() => all[0]);
  const selectedKeywords = watchlistKeywords(selectedWl || all[0]);
  const trackedItems = Object.keys(state.watchlistAdds || {}).map(key => {
    const sig = SIGNALS.find(s => s.id === key);
    return { key, title: sig ? sig.title : key, meta: sig ? `${sig.id} · ${sig.source}` : "Entity watch" };
  });
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Workflow</div>
          <h1 className="page-title">Watchlists</h1>
          <div className="page-sub">Keyword matching over the live signal stream, run in your browser. Select a watchlist to see its matches and keywords. Match history over time, alert rules and email digests are not yet available.</div>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <ProvenanceChip provenance={derived ? "derived" : "fixture"}
            title={derived ? "Keyword matches computed against the live signal stream" : "Live data is unavailable, so matches show 0 rather than an invented count"} />
          <input id="new-wl-name" aria-label="New watchlist name" placeholder="New watchlist name" value={newName} onChange={e=>setNewName(e.target.value)} className="search" style={{padding:"7px 10px"}}/>
          <button className="btn primary" onClick={() => { if (newName.trim()) { createWatchlist(newName.trim()); setNewName(""); } }}><Icon name="plus" size={13}/> Create</button>
        </div>
      </div>

      {all.length === 0 ? (
        <EmptyState icon="watch" kicker="No watchlists yet"
          action={<button className="btn sm primary" onClick={() => document.getElementById("new-wl-name")?.focus()}>New watchlist</button>}>
          Create a watchlist to match its keywords against the live signal stream in this browser.
        </EmptyState>
      ) : (
      <div className="grid g-3">
        {all.map(w => {
          const matchCount = watchlistMatches(w, matchSource).length;
          const keywordCount = watchlistKeywords(w).length;
          return (
            <div key={w.name} className={"wl" + (selectedWl?.name === w.name ? " active" : "")} role="button" tabIndex={0}
              aria-label={`${w.name}: ${matchCount} ${matchCount === 1 ? "match" : "matches"}, ${keywordCount} keywords. Open watchlist`}
              onClick={() => { setSelectedWl(w); openModal("watchlist", w.name); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedWl(w); openModal("watchlist", w.name); } }}
              style={selectedWl?.name === w.name ? {borderColor:"var(--brass)"} : {}}>
              <div style={{display:"flex", alignItems:"center", gap:8}}>
                <span className="wl-name">{w.name}</span>
                <span className="mono" data-wl-matches={matchCount} style={{fontSize:"var(--t-micro)", color: matchCount > 0 ? "var(--brass)" : "var(--ink-3)", background:"var(--panel-hi)", border: matchCount > 0 ? "1px solid var(--brass-soft)" : "1px solid var(--line-2)", padding:"1px 6px", borderRadius:4, marginLeft:"auto"}}>{matchCount} {matchCount === 1 ? "match" : "matches"}</span>
              </div>
              <div className="wl-meta"><span>{keywordCount} keywords</span></div>
              {/* No match history is held for any watchlist; the page sub-heading says so once
                  instead of repeating it on every card (FE-09). */}
            </div>
          );
        })}
      </div>
      )}

      {/* FE-04 (UX-11): alert rules need sign-in, which is not built, so the panel
          renders only behind the unsourced-surfaces flag. The About page lists alert
          rules and email digests under "Not yet available". */}
      {SITE_CONFIG.showUnsourcedSurfaces && <AlertRulesPanel />}

      <div className="panel" style={{marginTop:18}}>
        <div className="panel-head">
          <h2 className="panel-title">Tracked items</h2>
          <span className="panel-kicker">{trackedItems.length} saved</span>
        </div>
        <div className="panel-body">
          {trackedItems.length === 0 ? (
            <div className="empty">No tracked items yet. Use Watchlist, Track, or Watch controls to add one.</div>
          ) : trackedItems.map(item => (
            <div key={item.key} className="g-tracked-row" style={{display:"grid", gap:12, padding:"10px 0", borderBottom:"1px solid var(--line)", alignItems:"center"}}>
              <div>
                <div style={{fontSize:"var(--t-body-sm)", fontWeight:500}}>{item.title}</div>
                <div className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", marginTop:2}}>{item.meta}</div>
              </div>
              <button className="btn sm ghost" onClick={() => removeWatchlist(item.key)}>Remove</button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{marginTop:18}}>
        <div className="panel-head">
          <h2 className="panel-title">{selectedWl?.name || "Digital government"} · configuration</h2>
          <span className="panel-kicker">Selected watchlist</span>
          <span className="chip-fixture" style={{marginLeft:8}} title="These keywords are your watchlist configuration">Your keywords</span>
        </div>
        <div className="panel-body">
          <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:6}}>Keywords</div>
          <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
            {selectedKeywords.map(k => <span key={k} className="tag brass">{k}</span>)}
          </div>
          {/* Linked committees, attention thresholds, and an audit log were previously
              rendered here as static blocks identical for all 12 watchlists (only the
              keywords above are genuinely per-watchlist). They have been removed rather
              than left to imply a per-watchlist configuration that does not exist. */}
          <div className="empty" style={{marginTop:14}}>Parliament Pulse does not yet hold linked committees, attention thresholds, or an audit log for watchlists. These settings need a server-side store before they can show real per-watchlist data.</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PageCommittees, PageBills, PageParliament, PagePatterns, PageBriefings, PageWatchlists });
