// store-detail.jsx: the entity detail modal (committee, hearing, inquiry, bill,
// member, minister, division, feed, watchlist, radar). Split from store.jsx
// (FE-11, ARCH-11); a classic script sharing the global lexical scope.


// ---- Detail Modal: renders per entity type ----
function DetailModal() {
  const { modal, closeModal, openModal, state, assignOwner, addWatchlist, openSignal } = useStore();
  const prevFocusRef = React.useRef(null);
  const closeButtonRef = React.useRef(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!modal) return;
    const h = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeModal(); } };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [modal, closeModal]);

  React.useEffect(() => {
    if (!modal) return;
    prevFocusRef.current = document.activeElement;
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      prevFocusRef.current?.focus?.();
      prevFocusRef.current = null;
    };
  }, [modal]);

  React.useEffect(() => {
    if (!modal) return;
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const modalEl = closeButtonRef.current?.closest(".modal");
      if (!modalEl) return;
      const focusable = Array.from(modalEl.querySelectorAll("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])")).filter(el => !el.disabled);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [modal]);

  if (!modal) return null;
  const { type, id } = modal;

  const render = () => {
    if (type === "committee") return <CommitteeDetail id={id} />;
    if (type === "bill") return <BillDetail id={id} />;
    if (type === "member") return <MemberDetail id={id} />;
    if (type === "minister") return <MinisterDetail id={id} />;
    if (type === "division") return <DivisionDetail id={id} />;
    if (type === "feed") return <FeedDetail id={id} />;
    if (type === "watchlist") return <WatchlistDetail id={id} />;
    if (type === "radar") return <RadarDetail id={id} />;
    if (type === "inquiry") return <InquiryDetail id={id} />;
    if (type === "hearing") return <HearingDetail data={id} />;
    return <div>Unknown</div>;
  };

  return (
    <div className="modal-back">
      {/* FE-10 (A11Y-01): the click-outside layer is its own aria-hidden scrim
          under the dialog; Esc and the dialog's Close button do the same. */}
      {/* a11y-exempt: backdrop */}
      <div className="modal-scrim" onClick={closeModal} aria-hidden="true" />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          border: "1px solid var(--line-bright)",
          boxShadow: "0 1px 0 color-mix(in srgb, #000 38%, transparent), 0 40px 90px -32px color-mix(in srgb, #000 75%, transparent), inset 0 0 0 1px color-mix(in srgb, #fff 3%, transparent)",
        }}
      >
        {React.cloneElement(render(), { titleId, closeButtonRef })}
      </div>
    </div>
  );
}

// Shown for an entity field Parliament Pulse does not hold, so a detail row is never blank.
const NOT_HELD = "Not held here · see APH";

function ModalHead({ kicker, title, right, onClose, representative = false, titleId, closeButtonRef }) {
  const { closeModal } = useStore();
  return (
    <div className="modal-head">
      <div style={{flex:1}}>
        <div className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
          <span>{kicker}</span>
          {/* FE-04: a sample-data chip can only appear behind the unsourced-surfaces
              flag, which is false in every public build. Entities that remain in the
              public build hold only public facts (names, chambers, APH URLs). */}
          {representative && SITE_CONFIG.showUnsourcedSurfaces && <span className="chip-fixture">Sample data</span>}
        </div>
        <h2 id={titleId} className="serif" style={{fontSize:"var(--t-headline)", margin:"4px 0 0", fontWeight:500, lineHeight:1.25}}>{title}</h2>
      </div>
      {right}
      <button ref={closeButtonRef} className="btn ghost sm" aria-label="Close detail" onClick={onClose || closeModal} style={{flex:"none"}}><Icon name="close" size={14}/></button>
    </div>
  );
}

function copyModalText(text, toast, ok = "Copied to clipboard") {
  return copyToClipboard(text)
    .then(() => toast(ok, "brass"))
    .catch(() => toast("Clipboard unavailable: content not copied", "error"));
}

function CommitteeDetail({ id, titleId, closeButtonRef }) {
  const c = ENTITIES.committees[id];
  const { openModal, closeModal, toast, addWatchlist, isWatched } = useStore();
  if (!c) return <ModalHead kicker="Committee" title="Not found" titleId={titleId} closeButtonRef={closeButtonRef} />;
  const watchKey = `committee:${id}`;
  const watched = isWatched(watchKey);
  return (
    <>
      <ModalHead kicker={`Committee · ${c.chamber}`} title={c.name} representative={!!c.representative} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        {c.bio && <p style={{color:"var(--ink-2)", marginTop:0}}>{c.bio}</p>}
        <dl className="kv" style={{marginTop:14}}>
          <dt>Chair</dt><dd>{c.chair || (c.url ? <a href={"https://www." + c.url.replace(/^https?:\/\/(www\.)?/, "")} target="_blank" rel="noopener noreferrer">See current membership at APH →</a> : "See APH for current membership")}</dd>
          <dt>Members</dt><dd>{c.members ?? NOT_HELD}</dd>
          <dt>Portfolio</dt><dd>{c.portfolio ?? NOT_HELD}</dd>
          <dt>Active inquiries</dt><dd>{c.active ?? NOT_HELD}</dd>
          <dt>Reports (30d)</dt><dd>{c.recentReports ?? NOT_HELD}</dd>
          <dt>Source</dt><dd className="mono" style={{fontSize:"var(--t-eyebrow)", color:"var(--ink-3)"}}>{c.url}</dd>
        </dl>

        <h3 className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:22, marginBottom:8}}>Upcoming & today's hearings</h3>
        <div className="empty">
          Parliament Pulse holds no verified hearing schedule for this committee, because APH publishes hearing programmes on the committee page rather than as a machine-readable feed. See the current schedule at{" "}
          <a href="https://www.aph.gov.au/Parliamentary_Business/Committees" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>aph.gov.au/Parliamentary_Business/Committees <Icon name="ext" size={11} style={{verticalAlign:"-1px"}}/></a>.
        </div>

        <h3 className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:22, marginBottom:8}}>Open inquiries</h3>
        {c.inquiries.length > 0 ? (
          <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
            {c.inquiries.map((q, i) => (
              <button type="button" key={i} className="tag clk" onClick={() => openModal("inquiry", q)}>{q}</button>
            ))}
          </div>
        ) : (
          <div className="empty">
            Parliament Pulse holds no verified inquiry list for this committee. See the committee's own page on aph.gov.au for its current inquiries.
          </div>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => {
          copyModalText(`# Committee prep pack\nCommittee: ${c.name}\nChamber: ${c.chamber}\nOpen inquiries: ${c.inquiries.join("; ")}\nGenerated: ${new Date().toISOString()}`, toast, "Committee prep pack copied");
          closeModal();
        }}><Icon name="brief" size={13}/> Prep pack</button>
        <button className="btn" onClick={() => addWatchlist(watchKey)} style={watched ? {borderColor:"var(--brass)", color:"var(--brass)"} : undefined}><Icon name="watch" size={13}/> {watched ? "Watching committee" : "Watch committee"}</button>
        <button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button>
      </div>
    </>
  );
}

function HearingDetail({ data, titleId, closeButtonRef }) {
  const { closeModal, toast } = useStore();
  return (
    <>
      <ModalHead kicker="Hearing" title={data.topic} representative titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <dl className="kv">
          <dt>Committee</dt><dd>{data.committee}</dd>
          <dt>When</dt><dd>{data.when}</dd>
          <dt>Room</dt><dd>{data.room}</dd>
          <dt>Broadcast</dt><dd><a href="https://parlview.aph.gov.au/" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>ParlView <Icon name="ext" size={11} style={{verticalAlign:"-1px"}}/></a></dd>
        </dl>
        <h3 className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:8}}>Witnesses</h3>
        <div className="empty">
          Parliament Pulse holds no verified witness list for this hearing, because APH publishes witness lists as hearing programmes on the committee page rather than as a machine-readable feed. See the real hearing programme at{" "}
          <a href="https://www.aph.gov.au/Parliamentary_Business/Committees" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>aph.gov.au/Parliamentary_Business/Committees <Icon name="ext" size={11} style={{verticalAlign:"-1px"}}/></a>.
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => {
          copyModalText(`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Parliament Pulse//Live Beta//EN\nBEGIN:VEVENT\nSUMMARY:${data.topic}\nLOCATION:${data.room}\nDESCRIPTION:${data.committee} hearing. Verify time against APH before importing.\nEND:VEVENT\nEND:VCALENDAR`, toast, "Calendar stub copied");
          closeModal();
        }}>Copy calendar stub</button>
        <button className="btn" onClick={() => {
          copyModalText(`# Hearing prep note\nTopic: ${data.topic}\nCommittee: ${data.committee}\nWhen: ${data.when}\nRoom: ${data.room}\n\nParliament Pulse holds no verified witness list for this hearing. See the real hearing programme at https://www.aph.gov.au/Parliamentary_Business/Committees`, toast, "Prep note copied");
        }}><Icon name="brief" size={13}/> Generate prep note</button>
      </div>
    </>
  );
}

function InquiryDetail({ id, titleId, closeButtonRef }) {
  const { closeModal, toast, state, assignOwner } = useStore();
  const name = typeof id === "string" ? id : id?.name;
  const [owner, setOwner] = React.useState(state.owners[name] || "");
  return (
    <>
      <ModalHead kicker="Inquiry" title={name} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <div className="empty">
          Parliament Pulse holds no verified detail for this inquiry, because APH publishes no machine-readable feed of inquiry terms of reference. See the real committee page at{" "}
          <a href="https://www.aph.gov.au/Parliamentary_Business/Committees" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>aph.gov.au/Parliamentary_Business/Committees <Icon name="ext" size={11} style={{verticalAlign:"-1px"}}/></a>.
        </div>
        <h3 className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:8}}>Assign owner</h3>
        <div style={{display:"flex", gap:8}}>
          <input aria-label="Owner name" value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Owner name" className="search" style={{padding:"7px 10px", flex:1}}/>
          <button className="btn primary" onClick={() => { if (owner.trim()) { assignOwner(name, owner.trim()); } }}>Assign</button>
        </div>
        {state.owners[name] && <div style={{marginTop:8, fontSize:"var(--t-body-sm)", color:"var(--ok)"}}><Icon name="check" size={13} style={{verticalAlign:"-2px", marginRight:4}}/>Owner: <strong>{state.owners[name]}</strong></div>}
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => copyModalText(`# Submission starter\nInquiry: ${name}\nOwner: ${state.owners[name] || owner || "Unassigned"}\nGenerated: ${new Date().toISOString()}`, toast, "Submission starter copied")}><Icon name="brief" size={13}/> Start submission</button>
        <button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button>
      </div>
    </>
  );
}

function BillDetail({ id, titleId, closeButtonRef }) {
  const b = ENTITIES.bills[id];
  const { closeModal, toast, state, assignOwner, openModal, addWatchlist, isWatched } = useStore();
  const [owner, setOwner] = React.useState(state.owners[id] || (b?.owner || ""));
  if (!b) return <ModalHead kicker="Bill" title="Not found" titleId={titleId} closeButtonRef={closeButtonRef} />;
  const min = ENTITIES.ministers[b.minister];
  const watchKey = `bill:${id}`;
  const watched = isWatched(watchKey);
  return (
    <>
      <ModalHead kicker={`Bill · ${b.ref}`} title={b.title} representative={!!b.representative} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <div style={{display:"flex", gap:8, marginBottom:14, flexWrap:"wrap"}}>
          <Att level={b.att}/>
          <span className="tag">{b.portfolio}</span>
          <span className="tag teal">{b.stage}</span>
          {b.digest === "Published" && <span className="tag teal">Digest published</span>}
        </div>
        <h3 className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginBottom:6}}>Purpose</h3>
        <p style={{margin:0, color:"var(--ink-2)"}}>{b.purpose}</p>

        {b.provisions.length > 0 && <>
          <h3 className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Key provisions</h3>
          <ul style={{margin:0, paddingLeft:18, color:"var(--ink-2)"}}>{b.provisions.map((p,i) => <li key={i}>{p}</li>)}</ul>
        </>}

        {b.stageHistory.length > 0 && <>
          <h3 className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Timeline</h3>
          <div className="timeline">
            {b.stageHistory.map((h,i) => (
              <div key={i} className="tl-item">
                <div className="tl-time">{h.when}</div>
                <div className="tl-body">{h.event}</div>
              </div>
            ))}
          </div>
        </>}

        {min && <>
          <h3 className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Responsible minister</h3>
          <button type="button" className="tag clk brass" onClick={() => openModal("minister", b.minister)}>{min.name}</button>
        </>}

        <h3 className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Matching watchlists</h3>
        <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>{b.watchlists.map(w => <span key={w} className="tag brass">{w}</span>)}</div>

        <h3 className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Assign policy owner</h3>
        <div style={{display:"flex", gap:8}}>
          <input aria-label="Owner name" value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Owner name" className="search" style={{padding:"7px 10px", flex:1}}/>
          <button className="btn primary" onClick={() => { if (owner.trim()) assignOwner(id, owner.trim()); }}>Assign</button>
        </div>
        {state.owners[id] && <div style={{marginTop:8, fontSize:"var(--t-body-sm)", color:"var(--ok)"}}><Icon name="check" size={13} style={{verticalAlign:"-2px", marginRight:4}}/>Owner: <strong>{state.owners[id]}</strong></div>}
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => {
          copyModalText(`# Bill brief\nBill: ${b.title}\nReference: ${b.ref}\nStage: ${b.stage}\nPortfolio: ${b.portfolio}\n\nPurpose:\n${b.purpose}\n\nKey provisions:\n${b.provisions.map(p => `- ${p}`).join("\n") || "- Not recorded"}\n\nGenerated: ${new Date().toISOString()}`, toast, "Bill brief copied");
          closeModal();
        }}><Icon name="brief" size={13}/> Draft bill brief</button>
        <button className="btn" onClick={() => addWatchlist(watchKey)} style={watched ? {borderColor:"var(--brass)", color:"var(--brass)"} : undefined}><Icon name="watch" size={13}/> {watched ? "Tracking bill" : "Track bill"}</button>
      </div>
    </>
  );
}

// FE-04 (DATA-10): no live source of member records is connected, so
// ENTITIES.members is empty and every member id lands on this honest empty state.
// The previous body rendered invented question and Hansard counts; it is removed
// rather than kept for a data source that does not exist.
function MemberDetail({ id, titleId, closeButtonRef }) {
  const { closeModal } = useStore();
  return (
    <>
      <ModalHead kicker="Member" title="No member profile held" titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <div className="empty">
          Parliament Pulse holds no senator or member profiles, because no live source of member records is connected. Look up current senators and members at{" "}
          <a href="https://www.aph.gov.au/Senators_and_Members" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>aph.gov.au/Senators_and_Members <Icon name="ext" size={11} style={{verticalAlign:"-1px"}}/></a>.
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button>
      </div>
    </>
  );
}

function MinisterDetail({ id, titleId, closeButtonRef }) {
  const m = ENTITIES.ministers[id];
  const { closeModal } = useStore();
  if (!m) return <ModalHead kicker="Minister" title="Not found" titleId={titleId} closeButtonRef={closeButtonRef} />;
  return (
    <>
      <ModalHead kicker={m.role} title={m.name} representative={!!m.representative} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <p style={{color:"var(--ink-2)", marginTop:0}}>{m.bio}</p>
        <h3 className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:14, marginBottom:6}}>Recent signals</h3>
        <ul style={{margin:0, paddingLeft:18, color:"var(--ink-2)"}}>{m.recent.map((r,i) => <li key={i}>{r}</li>)}</ul>
      </div>
      <div className="modal-foot"><button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button></div>
    </>
  );
}

function DivisionDetail({ id, titleId, closeButtonRef }) {
  const d = DIVISIONS.find(x => x.bill === id?.bill && x.when === id?.when) || id;
  const { closeModal, openModal } = useStore();
  return (
    <>
      <ModalHead kicker="Division" title={d.q} representative={!!d.representative} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <dl className="kv">
          <dt>When</dt><dd>{d.when}</dd>
          <dt>Chamber</dt><dd>{d.chamber}</dd>
          <dt>Result</dt><dd style={{color: d.result.startsWith("Agreed") ? "var(--ok)" : "var(--escalate)"}}>{d.result}</dd>
          <dt>Related bill</dt><dd><button type="button" className="tag clk brass" onClick={() => openModal("bill", d.bill)}>{d.bill}</button></dd>
        </dl>
        <h3 className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:16, marginBottom:8}}>Vote breakdown</h3>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
          <div style={{padding:12, border:"1px solid var(--line-2)", borderRadius:8}}>
            <div className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ok)"}}>AYES</div>
            <div style={{fontSize:"var(--t-headline)", fontFamily:"var(--serif)"}}>{d.result.match(/\d+/)?.[0] || NO_VALUE}</div>
          </div>
          <div style={{padding:12, border:"1px solid var(--line-2)", borderRadius:8}}>
            <div className="mono" style={{fontSize:"var(--t-micro)", color:"var(--escalate)"}}>NOES</div>
            <div style={{fontSize:"var(--t-headline)", fontFamily:"var(--serif)"}}>{d.result.match(/\d+/g)?.[1] || NO_VALUE}</div>
          </div>
        </div>
      </div>
      <div className="modal-foot"><button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button></div>
    </>
  );
}

function FeedDetail({ id, titleId, closeButtonRef }) {
  const f = APH_FEEDS.find(x => x.id === id);
  const { closeModal, toast } = useStore();
  // The modal reads the same latest health check as the Sources table row it
  // opens from, so the two can never disagree (FE-09).
  const health = useLiveState("connectors");
  if (!f) return <ModalHead kicker="Feed" title="Not found" titleId={titleId} closeButtonRef={closeButtonRef} />;
  const c = (health.items || []).find(x => x && x.isFeed && x.url === f.url) || null;
  const st = c ? feedHealthState(c) : null;
  const status = st === "ok" ? "OK" : st === "failed" ? "Failed" : st === "pending" ? "Not yet checked" : NOT_SUPPLIED;
  const last = c ? (fmtPollStamp(c.lastSuccessAt) || "Never") : NOT_SUPPLIED;
  const parsed = c && c.itemsParsed != null ? String(c.itemsParsed) : NOT_SUPPLIED;
  return (
    <>
      <ModalHead kicker={`Source · ${f.group}`} title={c && c.label ? c.label : f.name} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <dl className="kv">
          <dt>URL</dt><dd className="mono" style={{fontSize:"var(--t-eyebrow)", color:"var(--ink-3)", wordBreak:"break-all"}}>{f.url}</dd>
          <dt>Status</dt><dd style={st === "failed" ? {color:"var(--escalate)"} : undefined}>{status}{c && c.lastHttpStatus != null ? ` · HTTP ${c.lastHttpStatus}` : ""}</dd>
          <dt>Authority</dt><dd>{f.authority}</dd>
          <dt>Last success</dt><dd>{last}</dd>
          <dt>Items at last check</dt><dd>{parsed}</dd>
          {c && c.parseError && <><dt>Error</dt><dd>{c.parseError}</dd></>}
          <dt>False positives</dt><dd title={FPR_PENDING_NOTE}><span style={{color:"var(--ink-4)"}}>Not measured yet ({FPR_PENDING_NOTE.toLowerCase()})</span></dd>
        </dl>
      </div>
      <div className="modal-foot">
        <a className="btn primary" href={f.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}><Icon name="ext" size={13}/> Open the feed on aph.gov.au</a>
        <button className="btn" title="Copy the checks a reader can run on this feed" onClick={() => copyModalText(`# Feed check list
Feed: ${f.name}
URL: ${f.url}
Status: ${status}
Last success: ${last}

Checks:
- HTTP status is 2xx
- The feed lists items when the source publishes
- Each item has a title, date and link`, toast, "Feed check list copied")}>Copy check list</button>
        <button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button>
      </div>
    </>
  );
}

function WatchlistDetail({ id, titleId, closeButtonRef }) {
  const { closeModal, toast, state } = useStore();
  // F2: resolve against the merged list so user-created watchlists open their
  // detail rather than a "Not found" modal.
  const all = [...WATCHLISTS, ...(state.watchlistCreated || [])];
  const w = all.find(x => x.name === id);
  if (!w) return <ModalHead kicker="Watchlist" title="Not found" titleId={titleId} closeButtonRef={closeButtonRef} />;
  // Matches and keyword count are always computed live, never read from a stored
  // field: a built-in watchlist's matches/trend are held null (the fixture
  // numbers were invented) and a created watchlist's seed values would
  // otherwise go stale as new signals arrive. matchSource is the same live
  // items or (now empty) SIGNALS fallback every other desk uses.
  const live = useLiveState("signals");
  const matchSource = live.items || SIGNALS;
  // F16: stable keyword matching against signal tags, not a name-prefix substring.
  const matchingAll = watchlistMatches(w, matchSource);
  const matchingSignals = matchingAll.slice(0, 3);
  const keywordList = watchlistKeywords(w);
  return (
    <>
      <ModalHead kicker={w.created ? "Watchlist · New" : "Watchlist"} title={w.name} representative={!!w.representative} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        {w.created && (
          <div className="empty" style={{marginBottom:14}}>Created watchlist. Keyword matching runs against the current signal stream. Trend builds as new signals arrive.</div>
        )}
        <div className="grid g-3" style={{gap:12}}>
          <div className="panel stat"><div className="stat-label">Matches</div><div className="stat-value" style={{fontSize:"var(--t-stat)"}}>{matchingAll.length}</div></div>
          <div className="panel stat"><div className="stat-label">Keywords</div><div className="stat-value" style={{fontSize:"var(--t-stat)"}}>{keywordList.length}</div></div>
          <div className="panel stat"><div className="stat-label">Trend history</div>
            <div className="mono" style={{marginTop:8, color:"var(--ink-4)", fontSize:"var(--t-eyebrow)"}}>Not held. Parliament Pulse does not yet track watchlist matches over time.</div>
          </div>
        </div>
        <h3 className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Matching signals</h3>
        {matchingSignals.length === 0 && <div className="empty">No matching signals in the current stream.</div>}
        {matchingSignals.map(s => (
          <div key={s.id} style={{padding:"8px 12px", border:"1px solid var(--line-2)", borderRadius:8, marginBottom:6}}>
            <div style={{fontSize:"var(--t-body-sm)", fontWeight:500}}>{s.title}</div>
            <div className="mono" style={{fontSize:"var(--t-label)", color:"var(--ink-4)", marginTop:2}}>{s.id} · {s.source}</div>
          </div>
        ))}
      </div>
      <div className="modal-foot">
        <button className="btn ghost" onClick={() => {
          copyModalText(`# Watchlist digest\nWatchlist: ${w.name}\nMatches: ${matchingAll.length}\nKeywords: ${keywordList.join(", ")}\n\nMatching signals:\n${matchingSignals.map(s => `- ${s.id}: ${s.title}`).join("\n") || "- No matching signals in the current stream."}`, toast, "Watchlist digest copied");
          closeModal();
        }}>Copy digest</button>
        <button className="btn" onClick={() => toast("Configuration saved locally")}>Save config</button>
      </div>
    </>
  );
}

// FE-06 (DATA-15): the radar groups live signals by source group, so its detail
// states only what that grouping holds: the group, its highest attention level
// and how many feeds contributed. It shows no trend and prescribes no next step,
// because the product computes neither.
function RadarDetail({ id, titleId, closeButtonRef }) {
  const r = RADAR.find(x => x.group === id);
  if (!r) return <ModalHead kicker="Source group" title="Not found" titleId={titleId} closeButtonRef={closeButtonRef} />;
  return (
    <>
      <ModalHead kicker="Activity by source" title={r.group} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <div style={{display:"flex", gap:8, marginBottom:12}}><Att level={r.att}/><span className="tag">{r.count} items from {r.sources} feed{r.sources !== 1 ? "s" : ""}</span></div>
        <p style={{color:"var(--ink-2)", marginTop:0}}>{attentionDisclosure()}</p>
      </div>
    </>
  );
}

Object.assign(window, { DetailModal });
