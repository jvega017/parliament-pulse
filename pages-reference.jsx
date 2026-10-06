// pages-reference.jsx: reference desks (Sources, About the data with its legal panels, Page not found).
// Split from pages.jsx (FE-11, ARCH-11). Every file is a classic script: its
// top-level declarations share one global lexical scope with the other files, so
// load order in index.html matters only for code that runs at load time.



const BETA_READINESS_ROWS = [
  {
    state: "Configured",
    title: "Official APH feeds",
    detail: "The Parliament Pulse service reads the official APH RSS feeds. The Live page shows each feed's current state and links to the source.",
    action: "Open Live",
    page: "live",
  },
  {
    state: "Derived",
    title: "Parliament Pulse analysis",
    detail: "Attention and confidence come from fixed, published scoring rules; threads, source groups and watchlist matches are worked out from the live signals. All of it is Parliament Pulse's own analysis, labelled as such.",
    action: "Review signals",
    page: "signals",
  },
  {
    state: "Next",
    title: "Not yet available",
    detail: "Questions on notice, Hansard, member profiles, alert delivery and parliamentary lines have no live source. They are listed below with the official APH page to use instead.",
    action: "View sources",
    page: "sources",
  },
];

const PROVENANCE_STACK = [
  {
    label: "Official source",
    title: "APH feeds with their source links",
    detail: "Every live item keeps its official APH link, and the Live page links to Hansard, ParlView and YouTube, before any analysis is added.",
    state: "Configured",
  },
  {
    label: "Transport",
    title: "Fetched from a fixed list of APH feeds",
    detail: "Parliament Pulse reads only the official APH feeds on its list, so nothing else enters the signal stream.",
    state: "Configured",
  },
  {
    label: "Enrichment",
    title: "Attention and confidence scoring",
    detail: "Parliament Pulse scores each live item with fixed rules that give the same result every time. Scores are Parliament Pulse's analysis, not APH content, and each item keeps its official source link.",
    state: "Derived",
  },
  {
    label: "Analyst action",
    title: "Briefs, exports, notes and watchlists",
    detail: "You can draft briefs, copy handoff notes, export CSV files and keep notes. All of it stays in this browser.",
    state: "Beta",
  },
];

// Module coverage rows. `source` names the selectCounts() key whose provenance
// sets the status, so the matrix is generated from the same fields the nav
// badges and the ledger read (UX-02) and a module turns Live the moment its
// block does. `derivedFrom` marks modules that are the product's own analysis
// over a live block (Derived, never Live). `fallback` is the status with no
// usable block; nothing here is a hand-set "Live".
const COVERAGE_MATRIX = [
  {
    module: "Live parliament",
    source: "signals",
    fallback: "Configured",
    evidence: "Six official APH RSS feeds plus chamber program and broadcast links.",
    activation: "Show whether each chamber is sitting, from an official source.",
    page: "live",
  },
  {
    module: "Sources",
    source: "connectors",
    fallback: "Configured",
    evidence: "Official feed register; each feed is health-checked on every poll.",
    activation: "Check feeds you add yourself before they join the signal stream.",
    page: "sources",
  },
  {
    module: "Overview signals",
    source: "signals",
    fallback: "Unavailable",
    evidence: "Signals from the official APH feeds, each linked to its source.",
    activation: "Recognise people, portfolios and bills in each item; keep scores labelled as Parliament Pulse analysis.",
    page: "signals",
  },
  {
    module: "Committees",
    source: "committees",
    fallback: "Unavailable",
    evidence: "Items from the Senate, House and joint committee feeds.",
    activation: "Add committee chairs, hearing dates and hearing status.",
    page: "committees",
  },
  {
    module: "Bills intelligence",
    source: "bills",
    fallback: "Unavailable",
    evidence: "Bills with a Bills Digest in the Parliamentary Library feed.",
    activation: "Track amendments and show which portfolio each bill belongs to.",
    page: "bills",
  },
  {
    module: "Briefings",
    source: null,
    fallback: "In this browser",
    evidence: "Briefs are copied to the clipboard or exported as CSV; the queue stays in this browser.",
    activation: "Share briefs with a team, assign a reviewer and record approval.",
    page: "briefings",
  },
  {
    module: "Threads",
    source: "threads",
    fallback: "Unavailable",
    evidence: "Parliament Pulse groups related live signals into threads.",
    activation: "Add Hansard and questions on notice once a feed for them can be reached.",
    page: "patterns",
  },
  {
    module: "Watchlists",
    source: "signals",
    derivedFrom: true,
    fallback: "Unavailable",
    evidence: "Whole-word keyword matching over the live signals.",
    activation: "Sending alerts needs a sign-in, which this release does not have.",
    page: "watchlists",
  },
];

// Status for one row from the shared counts: a live block reads Live, the
// Worker's own analysis reads Derived, no usable block reads the row fallback.
function coverageState(row, counts) {
  const prov = row.source && counts && counts.provenance ? counts.provenance[row.source] : null;
  if (prov === "live") return row.derivedFrom ? "Derived" : "Live";
  if (prov === "derived") return "Derived";
  return row.fallback;
}

function coverageRows(counts) {
  return COVERAGE_MATRIX.map(row => ({ ...row, state: coverageState(row, counts) }));
}

function BetaReadinessPanel({ navigate }) {
  return (
    <div className="beta-ledger" role="group" aria-label="Beta evidence status">
      <div className="beta-ledger-head">
        <div>
          <div className="panel-section-title">Beta evidence ledger</div>
          <h2>What is live, what is derived, and what is not yet available</h2>
        </div>
        <span className="chip-fixture">Official-first beta</span>
      </div>
      <div className="beta-ledger-grid">
        {BETA_READINESS_ROWS.map(row => (
          <button key={row.title} className="beta-ledger-row" onClick={() => navigate(row.page)}>
            <span className={"beta-state beta-" + row.state.toLowerCase()}>{row.state}</span>
            <span>
              <strong>{row.title}</strong>
              <span>{row.detail}</span>
            </span>
            <span className="beta-action">{row.action} →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProvenanceStackPanel({ navigate }) {
  return (
    <div className="provenance-stack">
      <div className="provenance-head">
        <div>
          <div className="panel-section-title">Source to decision</div>
          <h2>How a parliamentary item becomes a beta signal</h2>
        </div>
        <button className="btn ghost sm" onClick={() => navigate("sources")}><Icon name="ext" size={12}/> Source register</button>
      </div>
      <div className="provenance-steps">
        {PROVENANCE_STACK.map((step, index) => (
          <div key={step.label} className="provenance-step">
            <div className="prov-index">{String(index + 1).padStart(2, "0")}</div>
            <div>
              <div className="prov-label">{step.label}</div>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </div>
            <span className={"beta-state beta-" + (step.state === "Representative" ? "representative" : step.state === "Live" ? "live" : "next")}>{step.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProvenanceMetricsBand({ navigate }) {
  // Counts come from the shared selectCounts() (UX-02), the same source as the nav
  // badges; a dash means the block is not live, never a remembered number.
  const counts = useCounts();
  // FE-05 (DATA-16): the feed count is the Worker's configured feeds, never the
  // frontend registry length.
  const feedCount = useFeedCount();
  const dash = v => (typeof v === "number" ? v : NO_VALUE);
  // The Official feeds cell appears only when the Worker reports its configured
  // feed count. An older Worker reports none, and a cell holding a bare dot told
  // the reader nothing, so it is left out rather than shown empty.
  const metrics = [
    ...(typeof feedCount === "number" ? [{ label: "Official feeds", value: feedCount, detail: "Official APH feeds the service polls", icon: "rss", page: "sources" }] : []),
    { label: "Signals", value: dash(counts.signals), detail: counts.signals == null ? "Live signals are unavailable" : "Live signals held right now", icon: "signal", page: "signals" },
    { label: "Committee items", value: dash(counts.committees), detail: "From the live committee feeds", icon: "committee", page: "committees" },
    // No item is reviewed by Parliament Pulse before it shows; review is the reader's.
    { label: "Human review", value: "Yours", detail: "Verify each item before use", icon: "check" },
  ];
  return (
    <div className="provenance-metrics">
      <div className="panel-section-title">Provenance at a glance</div>
      <div className="prov-metric-grid" style={{"--prov-cols": metrics.length}}>
        {metrics.map(m => (
          <button key={m.label} className="prov-metric" data-metric={m.label} onClick={() => navigate(m.page || "signals")}>
            <Icon name={m.icon} size={14}/>
            <strong>{m.value}</strong>
            <span>{m.label}</span>
            <small>{m.detail}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function CoverageActivationMatrix({ navigate, copyPlan }) {
  const rows = coverageRows(useCounts());
  return (
    <div className="coverage-matrix" role="group" aria-label="Desk coverage and what comes next">
      <div className="coverage-head">
        <div>
          <div className="panel-section-title">Desk coverage</div>
          <h2>What each desk shows today, and what comes next</h2>
        </div>
        <button className="btn ghost sm" onClick={copyPlan}><Icon name="brief" size={12}/> Copy coverage table</button>
      </div>
      <div className="coverage-grid">
        <div className="coverage-row coverage-labels" aria-hidden="true">
          <span>Desk</span><span>Status</span><span>Based on</span><span>Next step</span><span>Open</span>
        </div>
        {rows.map(row => (
          <div key={row.module} className="coverage-row" data-module={row.module}>
            <strong>{row.module}</strong>
            <span className={"coverage-state state-" + row.state.toLowerCase().replace(/\s+/g, "-")}>{row.state}</span>
            <span>{row.evidence}</span>
            <span>{row.activation}</span>
            <button className="btn ghost sm" onClick={() => navigate(row.page)}><Icon name="ext" size={12}/> Open</button>
          </div>
        ))}
      </div>
    </div>
  );
}


// ---------- ABOUT THE DATA ----------
// Home for the beta evidence ledger, coverage matrix and provenance panels: reference
// material about what this product currently proves, moved off the landing page so
// the overview reads as a working product rather than a beta explainer.
// LB-05 (2026-07-23): the legal surface. Privacy, non-affiliation, disclaimer and
// terms, written to match what the product actually does: no accounts, no email
// collected through the site, no analytics, local-only preferences, and links to
// official sources rather than republishing them. Placed on the About page so it
// travels with the honest account of coverage.
const legalH = { fontSize:"var(--t-body-sm)", fontWeight: 600, color: "var(--ink)", margin: "14px 0 4px" };

// FE-04 (LEG-10): every localStorage key the code reads or writes, so the privacy
// text states exactly what is held. tests/unsourced-surfaces.test.mjs fails if a
// key used in the built bundle is missing from this list.
const LOCAL_STORAGE_KEYS = [
  { key: "cs-state-v1", holds: "your analyst notes, feedback, archived and tracked items, generated brief markers, created watchlists and added feeds" },
  { key: "pp-theme", holds: "your light or dark theme choice" },
  { key: "pp-nav-open", holds: "whether the mobile navigation was left open" },
  { key: "pp-beta-ack", holds: "that you dismissed the beta notice" },
  { key: "pp-onboarded", holds: "that you dismissed the How it works guide" },
  { key: "pp-shortcuts", holds: "whether you turned the single-key keyboard shortcuts off" },
];

// FE-04 (PR-07, LEG-04): the contact channel is read from SITE_CONFIG only. An
// email address renders as a mailto: link and an https URL as a link; while it is
// unset the text says so and points the reader at the official source.
function ContactLine({ purpose = "To report a correction or ask a privacy question", pending = "A public corrections address is being set up. Until it is published, check any item against the linked official APH source." }) {
  const link = siteContactLink();
  if (link && link.external) {
    return <>{purpose}, contact Prometheus Policy Lab at <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--link)" }}>{link.text}</a>.</>;
  }
  if (link) {
    return <>{purpose}, email Prometheus Policy Lab at <a href={link.href} style={{ color: "var(--link)" }}>{link.text}</a>.</>;
  }
  return <>{pending}</>;
}

// FE-10 (LEG-09): the accessibility statement. Every figure below is the
// scope of the recorded axe-core run (npm run a11y, tests/browser/axe.test.mjs),
// which checks this section against its own run: the state count, the axe-core
// version and the rule tags must match, and the date must not be later than
// the run. Re-issue the date only after a clean run on the changed UI.
const A11Y_SCAN = {
  date: "2026-09-29",
  dateText: "29 September 2026",
  axeVersion: "4.13.0",
  tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
  stateCount: 64,
};
function AccessibilityPanel() {
  return (
    <div className="panel" style={{ marginTop: "var(--gap-section)" }} id="about-accessibility" data-section="accessibility">
      <div className="panel-head">
        <h2 className="panel-title">Accessibility</h2>
        <span className="panel-kicker">Target, what was tested, and known limits</span>
      </div>
      <div className="panel-body" style={{ fontSize:"var(--t-body-sm)", lineHeight: 1.65, color: "var(--ink-2)", maxWidth: 820 }}>
        <h3 style={legalH}>Target</h3>
        <p style={legalP}>Parliament Pulse aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA. This section does not claim full conformance: it states what has been measured.</p>

        <h3 style={legalH}>What was tested</h3>
        <p style={legalP}>
          On <time dateTime={A11Y_SCAN.date} data-axe-scan-date={A11Y_SCAN.date}>{A11Y_SCAN.dateText}</time>, an automated scan with
          axe-core <span data-axe-version={A11Y_SCAN.axeVersion}>{A11Y_SCAN.axeVersion}</span> checked <span data-axe-state-count={A11Y_SCAN.stateCount}>{A11Y_SCAN.stateCount}</span> page
          states against its WCAG 2.0, 2.1 and 2.2 Level A and AA rules (<span className="mono" data-axe-tags={A11Y_SCAN.tags.join(" ")} style={{ fontSize:"var(--t-caption)" }}>{A11Y_SCAN.tags.join(", ")}</span>).
          The states were every desk in the navigation, an open signal, an open feed detail dialog, the search results, and the phone navigation open and closed,
          each in the dark and the light theme at 1280 and 390 pixels wide. The scan found no serious or critical violations.
        </p>
        <p style={legalP}>Most panels here have a gradient background, and axe cannot measure text contrast over a gradient. For those, the test measured contrast again with each gradient replaced by each of its colours in turn, and that found no serious or critical contrast failures either. <span data-axe-unmeasured="some">Some elements, such as text partly covered by another layer, still could not be measured automatically and need a manual check.</span></p>
        <p style={legalP}>The scan ran against a recorded test copy of the APH feeds, so it checked the page structure and design, not the wording of any live item. A scripted keyboard test also checks that Tab reaches every signal's Open button, Enter opens it, Esc closes it and returns focus, and the closed phone navigation holds no focus stops.</p>

        <h3 style={legalH}>Known limitations</h3>
        <ul style={{ margin: "0 0 6px", paddingLeft: 18 }}>
          <li>Automated tools find only some accessibility barriers. No manual audit or screen reader testing has been done yet.</li>
          <li>Dialogs and views not listed above, such as bill, committee and watchlist details, were not part of the scan.</li>
          <li>Item titles and descriptions come from the APH feeds as published. Parliament Pulse does not rewrite them, so it cannot fix their wording or structure.</li>
          <li>The Live parliament page can load the APH YouTube player on request. The player's accessibility is YouTube's.</li>
        </ul>

        <h3 style={legalH}>Keyboard shortcuts</h3>
        <p style={legalP}>The single-key shortcuts (j, k, b, w and a) can be turned off from the keyboard shortcuts button in the top bar. They never fire while you type in a field or hold Ctrl, Cmd or Alt, and archiving with a shows a notice with Undo.</p>

        <h3 style={legalH}>Report a barrier</h3>
        <p style={legalP}><ContactLine purpose="To report an accessibility barrier" pending="A public contact address is being set up. Until it is published, this site has no channel for reporting an accessibility barrier." /></p>
      </div>
    </div>
  );
}
const legalP = { margin: "0 0 6px" };
// FE-04 (PR-06, DATA-09): coverage Parliament Pulse does not hold, rendered from
// SITE_CONFIG.unavailable so the list, its reasons and its APH links have one source.
function NotYetAvailablePanel() {
  const items = (SITE_CONFIG && Array.isArray(SITE_CONFIG.unavailable)) ? SITE_CONFIG.unavailable : [];
  return (
    <div className="panel" style={{ marginTop: "var(--gap-section)" }} data-section="not-yet-available" id="about-not-yet-available">
      <div className="panel-head">
        <h2 className="panel-title">Not yet available</h2>
        <span className="panel-kicker">No live source, so not shown here</span>
      </div>
      <div className="panel-body">
        {items.map((u, i) => (
          <div key={u.id} data-unavailable={u.id} style={{ padding: "10px 0", borderBottom: i < items.length - 1 ? "1px solid var(--line)" : 0, display: "grid", gap: 4 }}>
            <strong style={{ fontSize:"var(--t-body-sm)", color: "var(--ink)" }}>{u.name}</strong>
            <span style={{ fontSize:"var(--t-body-sm)", color: "var(--ink-2)", lineHeight: 1.5 }}>{u.reason}</span>
            <a href={u.aphUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:"var(--t-body-sm)", color: "var(--link)", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 24 }}>
              Use the official page on aph.gov.au <Icon name="ext" size={11} />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

// The date the privacy, terms and disclaimer text above last changed. It moves
// only when that text moves: tests/finalise.test.mjs records a hash of the text
// beside this date and fails when one changes without the other.
const PRIVACY_UPDATED = "7 October 2026";
function LegalNoticePanel() {
  return (
    <div className="panel" style={{ marginTop: "var(--gap-section)" }} id="about-legal">
      <div className="panel-head">
        <h2 className="panel-title">Privacy, terms and disclaimer</h2>
        <span className="panel-kicker">What this is, and what it does with your data</span>
      </div>
      <div className="panel-body" style={{ fontSize:"var(--t-body-sm)", lineHeight: 1.65, color: "var(--ink-2)", maxWidth: 820 }}>
        <h3 style={legalH}>Independent, not affiliated</h3>
        <p style={legalP}>Parliament Pulse is an independent project by Prometheus Policy Lab. It is not affiliated with, endorsed by, or an official product of the Parliament of Australia, the Department of Parliamentary Services, or any government body. It reads publicly available RSS feeds published at aph.gov.au and links every item back to its official source.</p>

        <h3 style={legalH} id="about-privacy">Your privacy</h3>
        <p style={legalP}>No account, login, or email is required or collected through this site. We run no third-party analytics, advertising or tracking, and the site sets no cookies. Live parliamentary data is fetched from official APH feeds by the Parliament Pulse service for display and is not saved on your device.</p>
        <p style={legalP}>Your browser's local storage holds only the following, on this device, and none of it is sent to us:</p>
        <ul style={{ margin: "0 0 6px", paddingLeft: 18 }}>
          {LOCAL_STORAGE_KEYS.map(k => (
            <li key={k.key}><code className="mono" style={{ fontSize:"var(--t-caption)" }}>{k.key}</code>: {k.holds}</li>
          ))}
        </ul>
        <p style={legalP}>Clearing this site's data in your browser removes all of it.</p>
        <p style={legalP}>The Live parliament page opens on a branded card, not a video player. Your browser contacts YouTube (youtube-nocookie.com) only after you press "Load YouTube player"; from then on YouTube's own privacy policy applies to that player.</p>

        <h3 style={legalH}>Not advice</h3>
        <p style={legalP}>Parliament Pulse is derived intelligence over public sources, provided for information only. It is not legal, parliamentary, or professional advice. Scoring, clustering and watchlist matching are the product's own analysis and can contain errors. Verify against the linked official source at aph.gov.au before relying on any item.</p>

        <h3 style={legalH} id="about-licence">Use and content</h3>
        <p style={legalP}>The service is free and provided as-is, without warranty. Material published by the Australian Parliament remains subject to the Parliament's own copyright and terms of use; Parliament Pulse reproduces item titles unmodified, with attribution and a link to the official source, under the Parliament's {APH_LICENCE_NAME} licence; scores, summaries and clustering are Parliament Pulse's own analysis. Coverage and content may change without notice.</p>

        <h3 style={legalH}>Contact and corrections</h3>
        <p style={legalP}><ContactLine /></p>

        <p className="mono" data-privacy-updated="" style={{ fontSize:"var(--t-eyebrow)", color: "var(--ink-4)", marginTop: 14 }}>Last updated {PRIVACY_UPDATED}.</p>
      </div>
    </div>
  );
}
function PageAbout() {
  const { navigate, toast } = useStore();
  const goto = navigate;
  const counts = useCounts();
  const liveSignals = useLiveState("signals");
  const copyActivationPlan = () => {
    const table = coverageRows(counts).map(row => `| ${row.module} | ${row.state} | ${row.evidence} | ${row.activation} |`).join("\n");
    const plan = [
      "# Parliament Pulse activation plan",
      `Generated: ${new Date().toISOString()}`,
      "",
      "| Desk | Current coverage | Based on | Next step |",
      "| --- | --- | --- | --- |",
      table,
      "",
      "## Immediate priorities",
      "1. Keep official feed polling visible in Live and avoid current-sitting claims until verified.",
      "2. Check feeds you add yourself before they join the signal stream.",
      "3. Wire production enrichment for scoring, entity extraction, watchlist matching, Hansard/QON extraction and briefing persistence.",
      "4. Keep every module without a live source off the public build until it has verified item-level evidence.",
    ].join("\n");
    copyText(plan, toast, "Activation plan copied");
  };
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Reference</div>
          <h1 className="page-title">About the data</h1>
          <div className="page-sub">What is live, what is derived, and what is not yet available. Every module below states its evidence basis and links to the page that carries it.</div>
        </div>
      </div>

      <p style={{color:"var(--ink-2)", fontSize:"var(--t-body-sm)", lineHeight:1.6, maxWidth:760, marginBottom:"var(--gap-section)"}}>
        Parliament Pulse is a live beta. It reads the official APH feeds, shows when each was last
        checked, and links every live item back to its source at aph.gov.au. Signal scoring, threads, source
        grouping and watchlist matching are Parliament Pulse's own analysis over those live items.
        No sample content is shown anywhere: a desk with nothing to show says so and links to the
        official source. This page is the honest account of that split.
      </p>

      {/* PR-11: the About paragraph behind the tooltip on every attention value. */}
      <p data-att-about="" style={{color:"var(--ink-2)", fontSize:"var(--t-body-sm)", lineHeight:1.6, maxWidth:760, marginBottom:"var(--gap-section)"}}>
        <strong>How attention and confidence are scored.</strong> {attentionDisclosure(scoringDims((liveSignals.items || []).map(s => s.attentionReason)))} Confidence
        is shown as "Confidence n of 5" and reflects the kind of source only: inquiry, report and hearing
        items score 3, Bills Digests and divisions score 2, and everything else scores 1. When every item on a
        desk shares one attention or confidence value, the desk says so in one line instead of repeating a
        value that separates nothing.
      </p>

      <BetaReadinessPanel navigate={goto} />

      <CoverageActivationMatrix navigate={goto} copyPlan={copyActivationPlan} />

      <ProvenanceStackPanel navigate={goto} />

      <ProvenanceMetricsBand navigate={goto} />

      <NotYetAvailablePanel />

      <AccessibilityPanel />

      <LegalNoticePanel />
    </div>
  );
}

// ---------- PAGE NOT FOUND (FE-08, ARCH-14) ----------
// An address that names no desk renders this, never a silent Overview. app.jsx
// sets document.title to "Page not found · Parliament Pulse" for it.
function PageNotFound({ path }) {
  return (
    <div className="page" data-page-not-found="">
      <div className="page-head">
        <div>
          <div className="page-kicker">Address not recognised</div>
          <h1 className="page-title">Page not found</h1>
          <div className="page-sub">
            {path ? <>Parliament Pulse has no page at <code className="mono">#/{String(path).replace(/^\//, "")}</code>. </> : null}
            The link may be mistyped, or it may point to a page that has been removed.
          </div>
        </div>
      </div>
      <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a className="btn primary" href="#/overview">Go to Overview</a>
        <a className="btn" href="#/about">About the data</a>
      </p>
    </div>
  );
}


// ---------- SOURCES ----------
function PageSources() {
  const { openModal, addFeed, state, toast, refreshLiveState, liveState } = useStore();
  const health = useLiveState("connectors");   // health.items is the mapped checks array
  const fresh = (liveState && liveState.blocks && liveState.blocks.freshness) || null;
  // The form starts empty: example values are placeholders only, so no real
  // feed name or address is ever pre-filled as though the reader had typed it.
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  // No check runs. The earlier "Validate" button played a simulated check with
  // no request behind it; a saved feed is stored on this device, never polled,
  // and the table below labels it "Not polled" and "Not yet checked".
  const saveFeed = () => {
    if (!newName.trim() || !newUrl.trim()) { toast("Add a display name and an RSS URL"); return; }
    if (!/^https?:\/\//i.test(newUrl.trim())) { toast("Enter a full address starting with https://"); document.getElementById("new-feed-url")?.focus(); return; }
    addFeed({ id: "custom-"+Date.now(), name: newName.trim(), url: newUrl.trim(), status:"review", group:"Custom" });
    setNewName(""); setNewUrl("");
  };

  // Custom saved feeds are never polled: liveFeedList() (the Live page poller) reads
  // only SOURCE_REGISTRY, so a feed saved here never fetches. "Not polled" replaces
  // any invented "just now" freshness claim so the row cannot be mistaken for a
  // monitored feed.
  const allFeeds = [...APH_FEEDS, ...state.feeds.map(f => ({ ...f, last:"Not polled", today:0, modules:["Custom"], parser:"Not yet checked", authority:"Custom", confidence:NOT_SUPPLIED }))];

  // Feed-health from the Worker's connector checks, joined to the registry by url.
  const checkByUrl = new Map((health.items || []).map(c => [c.url, c]));
  const registryUrls = new Set((typeof SOURCE_REGISTRY !== "undefined" && Array.isArray(SOURCE_REGISTRY) ? SOURCE_REGISTRY : []).map(r => r.url));
  // Real endpoints the Worker health-checks that the frontend does not poll directly
  // (11 checks vs 6 registry rows). Counted from data, never hardcoded.
  const workerRows = (health.items || []).filter(c => !registryUrls.has(c.url));
  const healthyCount = (health.items || []).filter(c => c.ok).length;
  // "Refresh all" used to call the Live page's poller, which exists only while
  // Live parliament is open, so on this page it could only print "Open Live
  // parliament to refresh the feeds" and sent no request. It now reloads /state
  // through the store, as the topbar refresh button does, and the health table
  // re-renders from the checks that come back. The store hands back the running
  // /state request (a press during a background fetch awaits that fetch), and no
  // promise at all when no request can be sent, so "reloaded" is only ever said
  // after a request has actually come back.
  const refreshHealth = () => {
    const pending = typeof refreshLiveState === "function" ? refreshLiveState() : undefined;
    if (!pending || typeof pending.then !== "function") { toast("Feed health cannot be reloaded right now", "error"); return; }
    pending
      .then(() => toast("Feed health reloaded from the latest check"))
      .catch(() => toast("Could not reach the service; showing the last health check held", "error"));
  };

  // FE-05 (DATA-08, UX-12, DATA-16): a current Worker serves one check per
  // CONFIGURED feed. The table is then built from those rows alone, one row per
  // feed, with no registry list and no hardcoded count. A feed never polled reads
  // "Not yet polled" and is not coloured as failed. An older Worker (landing-page
  // probes, no feed_label) keeps the previous registry table below.
  const feedChecks = (health.items || []).filter(c => c.isFeed);
  const feedShape = feedChecks.length > 0;
  const feedOk = feedChecks.filter(c => feedHealthState(c) === "ok").length;
  const feedPending = feedChecks.filter(c => feedHealthState(c) === "pending").length;
  const feedPolled = feedChecks.length - feedPending;
  const referenceLinks = health.referenceLinks || [];
  const registryByUrl = new Map((typeof SOURCE_REGISTRY !== "undefined" && Array.isArray(SOURCE_REGISTRY) ? SOURCE_REGISTRY : []).map(r => [r.url, r]));
  const customFeeds = state.feeds.map(f => ({ ...f, authority:"Custom" }));
  // Source coverage not held, from the single SITE_CONFIG.unavailable record.
  const NOT_CONNECTED_IDS = ["hansard", "qon", "members"];
  const notConnected = ((typeof SITE_CONFIG !== "undefined" && Array.isArray(SITE_CONFIG.unavailable)) ? SITE_CONFIG.unavailable : [])
    .filter(u => NOT_CONNECTED_IDS.includes(u.id));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Admin</div>
          <h1 className="page-title">Sources</h1>
          <div className="page-sub">The official APH feeds Parliament Pulse reads{health.items ? ", with the result of the latest health check for each" : "; each feed's health appears after the next check"}. Feeds you add yourself are kept on this device and are not yet checked.</div>
        </div>
        <div style={{display:"flex", gap:10}}>
          <button className="btn" data-refresh-health="" title="Reloads the latest feed health check from the Parliament Pulse service" onClick={refreshHealth}><Icon name="refresh" size={13}/> Refresh health</button>
          <button className="btn primary" onClick={() => document.getElementById("new-feed-url")?.focus()}><Icon name="plus" size={13}/> Add feed</button>
        </div>
      </div>

      <div className={"grid " + (feedShape ? "g-3" : "g-2")} style={{marginBottom:18}}>
        <div className="panel stat" data-stat="feeds"><div className="stat-label">Active feeds</div>
          {feedShape
            ? <><div className="stat-value">{feedChecks.length}</div><div className="stat-meta">official APH feeds the service polls</div></>
            : <><div className="stat-value" style={{fontSize:"var(--t-subhead)", color:"var(--ink-3)"}}>{NOT_SUPPLIED}</div><div className="stat-meta">{health.items ? health.items.length + " sources health-checked; this version of the service does not list feeds one by one" : "Appears once the feed list loads"}</div></>}
        </div>
        <div className="panel stat" data-stat="healthy"><div className="stat-label">Healthy</div>
          {feedShape
            ? <><div className="stat-value">{feedOk}/{feedPolled}</div><div className="stat-meta" data-healthy-meta="">{["polled feeds OK", feedPending ? `${feedPending} not yet polled` : "", latestCheckClause(feedChecks)].filter(Boolean).join(" · ")}</div></>
            : health.items
            ? <><div className="stat-value">{healthyCount}/{health.items.length}</div><div className="stat-meta" data-healthy-meta="">{latestCheckClause(health.items) || "No check time supplied"}</div></>
            : <><div className="stat-value" style={{fontSize:"var(--t-subhead)", color:"var(--ink-3)"}}>{NOT_SUPPLIED}</div><div className="stat-meta">Available after live poll</div></>}
        </div>
        {/* FE-09: the "items ingested today" and "false positive rate" tiles showed
            nothing but a placeholder, so they are replaced by the one count the
            latest health check does supply. */}
        {feedShape && (
          <div className="panel stat" data-stat="items"><div className="stat-label">Items at last check</div>
            <div className="stat-value">{feedChecks.reduce((n, c) => n + (c.itemsParsed || 0), 0)}</div><div className="stat-meta">across {feedPolled} checked feed{feedPolled === 1 ? "" : "s"}</div>
          </div>
        )}
      </div>

      <div className="grid g-overview" style={{alignItems:"start"}}>
        {health.status === "loading" && !health.items ? <SkeletonTable rows={6} /> : (
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Official APH feeds</h2>
            <span className="panel-kicker">{feedShape ? `${feedChecks.length} feeds configured · one row per feed` : "Select a row for detail"}</span>
            <ProvenanceChip provenance={health.displayProvenance}
              title={health.displayProvenance === "live" ? "Feed health from the latest check" : "Health appears after the next check"} />
          </div>
          {health.status === "error" && !health.items && (
            <div className="panel-body">
              <EmptyState icon="sources" kicker="Feed status unavailable" variant="error">
                The status service did not respond, so no feed health is shown. The official feed addresses are listed below, and APH publishes every feed on its <a href="https://www.aph.gov.au/Help/Rss_feeds" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>RSS feeds page</a>.
              </EmptyState>
            </div>
          )}
          {feedShape ? (
          <div className="table-scroll">
          <table className="ds ds-stack" data-feed-table="">
            <thead><tr>
              <th>Feed</th><th>Group</th><th>Status</th><th className="num">HTTP</th>
              <th className="num">Items in latest poll</th><th>Last success</th><th>Parse error</th>
            </tr></thead>
            <tbody>
              {feedChecks.map(c => {
                const reg = registryByUrl.get(c.url);
                const st = feedHealthState(c);
                return (
                <tr key={c.url} data-feed-row={c.feedLabel} data-feed-state={st}>
                  <td className="ds-lead" data-label="Feed">
                    {/* FE-10 (A11Y-01): the feed name opens its detail; the row is no longer a mouse-only target. */}
                    {reg
                      ? <button type="button" className="row-btn" data-feed-open="" aria-label={`${c.label}: feed detail`} onClick={() => openModal("feed", reg.id)}>{c.label}</button>
                      : <div style={{fontWeight:500}}>{c.label}</div>}
                    <div className="mono ds-url" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)"}}>{c.url.length > 56 ? c.url.slice(0,56)+"…" : c.url}</div>
                  </td>
                  <td data-label="Group"><span className="tag">{c.group}</span></td>
                  <td data-label="Status" style={st === "failed" ? {color:"var(--escalate)"} : st === "pending" ? {color:"var(--ink-4)", fontStyle:"italic"} : undefined}>
                    {st === "pending" ? "Not yet polled" : st === "ok" ? "OK" : "Failed"}
                  </td>
                  <td className="num mono" data-label="HTTP">{c.lastHttpStatus ?? NO_VALUE}</td>
                  <td className="num" data-label="Items in latest poll">{c.itemsParsed ?? NO_VALUE}
                    {/* A feed can parse 0 now while the desks still list its older items;
                        the last poll that carried any item says how old they are. */}
                    {(() => { const at = feedLastSeenAt(fresh, c.feedLabel); const t = at ? Date.parse(at) : NaN; return Number.isNaN(t) ? null : <div className="mono" data-last-carried="" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)"}}>items last seen {fmtDayMon(t)}</div>; })()}</td>
                  <td className="mono" data-label="Last success" style={{fontSize:"var(--t-caption)", color:"var(--ink-3)"}}>{st === "pending" ? NO_VALUE : (() => {
                    // "07:32 AEST" over "4 Oct 2026": two lines at most, never three.
                    const stamp = fmtPollStamp(c.lastSuccessAt);
                    if (!stamp) return "Never";
                    const [clockPart, datePart] = stamp.split(", ");
                    return <><span style={{whiteSpace:"nowrap"}}>{clockPart}</span>{datePart ? <> <span style={{whiteSpace:"nowrap"}}>{datePart}</span></> : null}</>;
                  })()}</td>
                  <td data-label="Parse error" style={{fontSize:"var(--t-caption)", color: c.parseError ? "var(--ink-2)" : "var(--ink-4)", overflowWrap:"anywhere"}} title={c.parseError || undefined}>{c.parseError ? (c.parseError.length > 60 ? c.parseError.slice(0,60)+"…" : c.parseError) : NO_VALUE}</td>
                </tr>
                );
              })}
              {customFeeds.map(f => (
                <tr key={f.id}>
                  <td className="ds-lead" data-label="Feed">
                    <div style={{fontWeight:500}}>{f.name}</div>
                    <div className="mono ds-url" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)"}}>{f.url.length > 56 ? f.url.slice(0,56)+"…" : f.url}</div>
                  </td>
                  <td data-label="Group"><span className="tag">Custom</span></td>
                  <td data-label="Status"><span style={{color:"var(--ink-4)", fontStyle:"italic"}} title="Saved feeds are not polled">Not polled</span></td>
                  <td className="num" data-label="HTTP">{NO_VALUE}</td><td className="num" data-label="Items in latest poll">{NO_VALUE}</td><td data-label="Last success">{NO_VALUE}</td><td data-label="Parse error">{NO_VALUE}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          ) : (
          <div className="table-scroll">
          <table className="ds ds-stack">
            <thead><tr>
              <th>Source</th><th>Group</th><th>Status</th><th>Last</th>
              <th className="num">Today</th><th>Check</th>
            </tr></thead>
            <tbody>
              {allFeeds.map(f => {
                const c = checkByUrl.get(f.url);
                return (
                <tr key={f.id}>
                  <td className="ds-lead" data-label="Source">
                    {f.group !== "Custom"
                      ? <button type="button" className="row-btn" data-feed-open="" aria-label={`${f.name}: feed detail`} onClick={() => openModal("feed", f.id)}>{f.name}</button>
                      : <div style={{fontWeight:500}}>{f.name}</div>}
                    <div className="mono ds-url" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)"}}>{f.url.length > 56 ? f.url.slice(0,56)+"…" : f.url}</div>
                  </td>
                  <td data-label="Group"><span className="tag">{f.group}</span></td>
                  <td data-label="Status" style={c && !c.ok ? {color:"var(--escalate)"} : undefined}>
                    {f.group === "Custom"
                      ? <span style={{color:"var(--ink-4)", fontStyle:"italic"}} title="Saved feeds are not polled by the live feed poller">Not polled</span>
                      : (c
                        ? (c.ok ? "Live" : `Error ${c.httpStatus ?? ""}`.trim())
                        : (f.lastStatusCode != null ? (f.lastStatusCode >= 200 && f.lastStatusCode < 300 ? "Live" : "Error") : NO_VALUE))}
                  </td>
                  <td className="mono" data-label="Last" style={{fontSize:"var(--t-caption)", color:"var(--ink-3)"}}>{c ? fmtFetchedAt(c.checkedAt) : (f.last || NO_VALUE)}</td>
                  <td className="num" data-label="Today">{f.lastItemCount ?? NO_VALUE}</td>
                  <td data-label="Check">{f.parser || NO_VALUE}</td>
                </tr>
                );
              })}
              {workerRows.map(c => (
                <tr key={c.url}>
                  <td className="ds-lead" data-label="Source">
                    <div style={{fontWeight:500}}>{c.label}</div>
                    <div className="mono ds-url" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)"}}>{c.url.length > 56 ? c.url.slice(0,56)+"…" : c.url}</div>
                  </td>
                  <td data-label="Group"><span className="tag">{c.group}</span></td>
                  <td data-label="Status" style={!c.ok ? {color:"var(--escalate)"} : undefined}>{c.ok ? "Live" : `Error ${c.httpStatus ?? ""}`.trim()}</td>
                  <td className="mono" data-label="Last" style={{fontSize:"var(--t-caption)", color:"var(--ink-3)"}}>{fmtFetchedAt(c.checkedAt)}</td>
                  <td className="num" data-label="Today">{NO_VALUE}</td>
                  {/* The Worker pings these reference pages on its own schedule (a
                      daily link check on the current Worker); the Last column shows
                      the time of the check that produced this row, so no cadence
                      is claimed here. */}
                  <td data-label="Check">Page reachability</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          )}
        </div>
        )}

        <div>
          {referenceLinks.length > 0 && (
            <div className="panel" style={{marginBottom:16}} data-reference-pages="">
              <div className="panel-head">
                <h2 className="panel-title">Reference pages</h2>
                <span className="panel-kicker">APH pages linked from the app · not health-checked</span>
              </div>
              <div className="panel-body">
                <ul style={{listStyle:"none", margin:0, padding:0}}>
                  {referenceLinks.map(u => (
                    <li key={u} data-reference-link="" style={{padding:"6px 0", borderBottom:"1px dashed var(--line-2)", fontSize:"var(--t-body-sm)", overflowWrap:"break-word"}}>
                      <a href={u} target="_blank" rel="noopener noreferrer" style={{color:"var(--ink-2)"}}>{u.replace(/^https?:\/\/(www\.)?/, "").split("/").map((part, i, arr) => <React.Fragment key={i}>{part}{i < arr.length - 1 ? <>/<wbr/></> : null}</React.Fragment>)}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div className="panel" style={{marginBottom:16}}>
            <div className="panel-head">
              <h2 className="panel-title">Add RSS feed</h2>
              <span className="panel-kicker">Kept on this device · not checked</span>
            </div>
            <div className="panel-body">
              <label htmlFor="new-feed-name" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Display name</label>
              <input id="new-feed-name" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="For example: My committee feed" autoComplete="off" className="search" style={{padding:"8px 10px", marginTop:4, marginBottom:8, width:"100%"}}/>
              <label htmlFor="new-feed-url" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Paste RSS URL</label>
              <div style={{display:"flex", gap:8, marginTop:4}}>
                <input id="new-feed-url" type="url" inputMode="url" value={newUrl} onChange={e=>setNewUrl(e.target.value)} placeholder="https://example.org/feed.xml" autoComplete="off" className="search" style={{flex:1, minWidth:0, padding:"8px 10px"}}/>
                <button className="btn primary" onClick={saveFeed} data-save-feed="">Save feed</button>
              </div>
              <p data-addfeed-note="" style={{margin:"10px 0 0", fontSize:"var(--t-caption)", color:"var(--ink-3)", lineHeight:1.5}}>Parliament Pulse does not fetch or check a feed you add. It is saved in this browser only and listed in the feed table as not polled.</p>
            </div>
          </div>

          {/* Sources Parliament Pulse does not read yet, from SITE_CONFIG.unavailable
              (the same record the About page lists), each with the official APH page
              to use instead. No request button: there is no channel to send one to. */}
          <div className="panel" data-not-connected="">
            <div className="panel-head">
              <h2 className="panel-title">Not yet connected</h2>
              <span className="panel-kicker">Use the official APH page instead</span>
            </div>
            <div className="panel-body">
              {notConnected.map((u, i) => (
                <div key={u.id} data-not-connected-row={u.id} style={{padding:"8px 0", borderBottom: i < notConnected.length - 1 ? "1px dashed var(--line-2)" : 0, display:"grid", gap:4}}>
                  <div style={{fontSize:"var(--t-body-sm)"}}>{u.name}</div>
                  <div style={{fontSize:"var(--t-caption)", color:"var(--ink-3)", lineHeight:1.5}}>{u.reason}</div>
                  <a href={u.aphUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:"var(--t-caption)", color:"var(--link)", display:"inline-flex", alignItems:"center", gap:6, minHeight:24}}>
                    Open on aph.gov.au <Icon name="ext" size={11} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PageSources, PageAbout, PageNotFound });
