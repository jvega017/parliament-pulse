// ---- Global store: persistent state for real interactivity ----
const StoreCtx = React.createContext(null);

function useStore() { return React.useContext(StoreCtx); }

function StoreProvider({ children }) {
  // Owners assigned to signals/bills, feedback given, watchlist additions, toasts
  const [state, setState] = React.useState(() => {
    try {
      const raw = localStorage.getItem("cs-state-v1");
      if (raw) return JSON.parse(raw);
    } catch(e){}
    return {
      owners: {}, // { entityId: ownerName }
      feedback: {}, // { signalId: { label, reason, ts } }
      archived: {}, // { signalId: true }
      briefsGenerated: {}, // { signalId: { ts, type } }
      watchlistAdds: {}, // { entityKey: true }
      watchlistCreated: [], // extra watchlists
      feeds: [], // extra custom feeds
      notes: {}, // { signalId: "text" }
    };
  });

  React.useEffect(() => {
    try { localStorage.setItem("cs-state-v1", JSON.stringify(state)); } catch(e){}
  }, [state]);

  const [toasts, setToasts] = React.useState([]);
  const toast = (msg, kind = "ok", action = null) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, kind, action }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), action ? 5000 : 2800);
  };

  const [modal, setModal] = React.useState(null); // { type, id }
  const openModal = (type, id) => setModal({ type, id });
  const closeModal = () => setModal(null);

  const [signalId, setSignalId] = React.useState(null);
  const openSignal = s => setSignalId(typeof s === "string" ? s : s?.id);
  const closeSignal = () => setSignalId(null);

  // Expose for places that don't live inside the provider context
  React.useEffect(() => {
    window.__openModal = (type, id) => setModal({ type, id });
    window.__openSignal = (id) => setSignalId(id);
    return () => { window.__openModal = null; window.__openSignal = null; };
  }, []);

  const assignOwner = (entityId, owner) => {
    setState(s => ({ ...s, owners: { ...s.owners, [entityId]: owner } }));
    toast(`Assigned ${owner} as policy owner`);
  };
  const saveFeedback = (signalId, label, reason) => {
    setState(s => ({ ...s, feedback: { ...s.feedback, [signalId]: { label, reason, ts: Date.now() } } }));
    toast(`Feedback logged: ${label}`, "brass");
  };
  const archive = (signalId) => {
    setState(s => ({ ...s, archived: { ...s.archived, [signalId]: true } }));
    toast("Signal archived", "ok", { label: "Undo", fn: () => unarchive(signalId) });
  };
  const unarchive = (signalId) => {
    setState(s => { const n = { ...s.archived }; delete n[signalId]; return { ...s, archived: n }; });
  };
  const addWatchlist = (key) => {
    setState(s => ({ ...s, watchlistAdds: { ...s.watchlistAdds, [key]: true } }));
    toast("Added to watchlist", "brass");
  };
  const createWatchlist = (name) => {
    setState(s => ({ ...s, watchlistCreated: [...s.watchlistCreated, { name, keywords: 0, matches: 0, trend: [0,0,0,0,0,0,0] }] }));
    toast(`Watchlist "${name}" created`, "brass");
  };
  const generateBrief = (signalId, type) => {
    setState(s => ({ ...s, briefsGenerated: { ...s.briefsGenerated, [signalId]: { ts: Date.now(), type } } }));
  };
  const addFeed = (feed) => {
    setState(s => ({ ...s, feeds: [...s.feeds, feed] }));
    toast(`Feed added: ${feed.name}`, "brass");
  };
  const saveNote = (signalId, text) => {
    setState(s => ({ ...s, notes: { ...s.notes, [signalId]: text } }));
  };

  return (
    <StoreCtx.Provider value={{
      state, setState, toast, toasts,
      modal, openModal, closeModal,
      signalId, openSignal, closeSignal,
      assignOwner, saveFeedback, archive, unarchive,
      addWatchlist, createWatchlist, generateBrief, addFeed, saveNote,
    }}>
      {children}
      <div className="toast-wrap" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div key={t.id} className={"toast" + (t.kind === "error" ? " toast-err" : "")}>
            <Icon
              name={t.kind === "error" ? "close" : "check"}
              size={14}
              stroke={t.kind === "error" ? "var(--escalate)" : t.kind === "brass" ? "var(--brass)" : "var(--ok)"}
            />
            <span>{t.msg}</span>
            {t.action && (
              <button className="toast-act" onClick={() => { t.action.fn(); setToasts(ts => ts.filter(x => x.id !== t.id)); }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </StoreCtx.Provider>
  );
}

// ---- Detail Modal: renders per entity type ----
function DetailModal() {
  const { modal, closeModal, openModal, state, assignOwner, addWatchlist, openSignal } = useStore();
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

  React.useEffect(() => {
    const h = (e) => { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [closeModal]);

  return (
    <div className="modal-back" onClick={closeModal}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        {render()}
      </div>
    </div>
  );
}

function ModalHead({ kicker, title, right, onClose }) {
  const { closeModal } = useStore();
  return (
    <div className="modal-head">
      <div style={{flex:1}}>
        <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em"}}>{kicker}</div>
        <div className="serif" style={{fontSize:22, marginTop:4, fontWeight:500, lineHeight:1.25}}>{title}</div>
      </div>
      {right}
      <button className="btn ghost sm" onClick={onClose || closeModal} style={{flex:"none"}}><Icon name="close" size={14}/></button>
    </div>
  );
}

function CommitteeDetail({ id }) {
  const c = ENTITIES.committees[id];
  const { openModal, closeModal, toast } = useStore();
  if (!c) return <ModalHead kicker="Committee" title="Not found" />;
  return (
    <>
      <ModalHead kicker={`Committee · ${c.chamber}`} title={c.name} />
      <div className="modal-body">
        <p style={{color:"var(--ink-2)", marginTop:0}}>{c.bio}</p>
        <dl className="kv" style={{marginTop:14}}>
          <dt>Chair</dt><dd>{c.chair}</dd>
          <dt>Members</dt><dd>{c.members}</dd>
          <dt>Portfolio</dt><dd>{c.portfolio}</dd>
          <dt>Active inquiries</dt><dd>{c.active}</dd>
          <dt>Reports (30d)</dt><dd>{c.recentReports}</dd>
          <dt>Source</dt><dd className="mono" style={{fontSize:11, color:"var(--ink-3)"}}>{c.url}</dd>
        </dl>

        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:22, marginBottom:8}}>Upcoming & today's hearings</h4>
        {c.hearings.length === 0 && <div className="empty">No scheduled hearings.</div>}
        {c.hearings.map((h, i) => (
          <div key={i} className="clk" onClick={() => openModal("hearing", { ...h, committee: c.name })}
               style={{display:"grid", gridTemplateColumns:"130px 1fr auto", padding:"10px 12px", border:"1px solid var(--line-2)", borderRadius:8, marginBottom:6, gap:12, alignItems:"center"}}>
            <div className="mono" style={{fontSize:11.5, color:"var(--ink-2)"}}>{h.when}</div>
            <div>
              <div style={{fontSize:13, fontWeight:500}}>{h.topic}</div>
              <div style={{fontSize:11.5, color:"var(--ink-3)"}}>{h.room}</div>
            </div>
            <Icon name="chevron" size={14} stroke="var(--ink-3)" />
          </div>
        ))}

        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:22, marginBottom:8}}>Open inquiries</h4>
        <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
          {c.inquiries.map((q, i) => (
            <span key={i} className="tag clk" onClick={() => openModal("inquiry", q)}>{q}</span>
          ))}
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => { toast("Committee prep pack queued", "brass"); closeModal(); }}><Icon name="brief" size={13}/> Prep pack</button>
        <button className="btn" onClick={() => { toast("Committee added to watchlist", "brass"); }}><Icon name="watch" size={13}/> Watch committee</button>
        <button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button>
      </div>
    </>
  );
}

function HearingDetail({ data }) {
  const { closeModal, toast } = useStore();
  return (
    <>
      <ModalHead kicker="Hearing" title={data.topic} />
      <div className="modal-body">
        <dl className="kv">
          <dt>Committee</dt><dd>{data.committee}</dd>
          <dt>When</dt><dd>{data.when}</dd>
          <dt>Room</dt><dd>{data.room}</dd>
          <dt>Broadcast</dt><dd><a href="#" onClick={e=>e.preventDefault()} style={{color:"var(--teal)"}}>aph.gov.au/live/hearing</a></dd>
        </dl>
        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:8}}>Witnesses</h4>
        <ul style={{margin:0, paddingLeft:18, color:"var(--ink-2)"}}>
          <li>Department (First Assistant Secretary)</li>
          <li>OAIC (Privacy Commissioner)</li>
          <li>Industry peak body</li>
        </ul>
        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:8}}>Sample questions <span className="chip-fixture" style={{verticalAlign:"middle", marginLeft:6}}>Fixture</span></h4>
        <ol style={{margin:0, paddingLeft:18, color:"var(--ink-2)"}}>
          <li>How does the department assure AI models against bias in high-risk contexts?</li>
          <li>Which programs currently use automated decision-making for benefit eligibility?</li>
          <li>What is the escalation pathway when assurance fails in production?</li>
        </ol>
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => { toast("Added to calendar", "brass"); closeModal(); }}>Add to calendar</button>
        <button className="btn" onClick={() => { toast("Prep note generated", "brass"); }}><Icon name="brief" size={13}/> Generate prep note</button>
      </div>
    </>
  );
}

function InquiryDetail({ id }) {
  const { closeModal, toast, state, assignOwner } = useStore();
  const name = typeof id === "string" ? id : id?.name;
  const [owner, setOwner] = React.useState(state.owners[name] || "");
  return (
    <>
      <ModalHead kicker="Inquiry" title={name} />
      <div className="modal-body">
        <dl className="kv">
          <dt>Status</dt><dd>Accepting submissions</dd>
          <dt>Submissions close</dt><dd>19 May 2026</dd>
          <dt>Reporting</dt><dd>by 30 August 2026</dd>
          <dt>Scope</dt><dd>Commonwealth procurement and contract governance for digital programs over $100m</dd>
        </dl>
        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:8}}>Terms of reference</h4>
        <ol style={{margin:0, paddingLeft:18, color:"var(--ink-2)"}}>
          <li>Adequacy of current governance frameworks</li>
          <li>Use of limited tender and contract variations</li>
          <li>Transparency and public reporting</li>
          <li>Any related matters</li>
        </ol>
        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:8}}>Assign owner</h4>
        <div style={{display:"flex", gap:8}}>
          <input value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Owner name" className="search" style={{padding:"7px 10px", flex:1}}/>
          <button className="btn primary" onClick={() => { if (owner.trim()) { assignOwner(name, owner.trim()); } }}>Assign</button>
        </div>
        {state.owners[name] && <div style={{marginTop:8, fontSize:12.5, color:"var(--ok)"}}><Icon name="check" size={13} style={{verticalAlign:"-2px", marginRight:4}}/>Owner: <strong>{state.owners[name]}</strong></div>}
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => { toast("Submission draft started", "brass"); }}><Icon name="brief" size={13}/> Start submission</button>
        <button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button>
      </div>
    </>
  );
}

function BillDetail({ id }) {
  const b = ENTITIES.bills[id];
  const { closeModal, toast, state, assignOwner, openModal } = useStore();
  const [owner, setOwner] = React.useState(state.owners[id] || (b?.owner === "—" ? "" : b?.owner || ""));
  if (!b) return <ModalHead kicker="Bill" title="Not found" />;
  return (
    <>
      <ModalHead kicker={`Bill · ${b.ref}`} title={b.title} />
      <div className="modal-body">
        <div style={{display:"flex", gap:8, marginBottom:14, flexWrap:"wrap"}}>
          <Att level={b.att}/>
          <span className="tag">{b.portfolio}</span>
          <span className="tag teal">{b.stage}</span>
          {b.digest === "Published" && <span className="tag teal">Digest published</span>}
        </div>
        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginBottom:6}}>Purpose</h4>
        <p style={{margin:0, color:"var(--ink-2)"}}>{b.purpose}</p>

        {b.provisions.length > 0 && <>
          <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Key provisions</h4>
          <ul style={{margin:0, paddingLeft:18, color:"var(--ink-2)"}}>{b.provisions.map((p,i) => <li key={i}>{p}</li>)}</ul>
        </>}

        {b.stageHistory.length > 0 && <>
          <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Timeline</h4>
          <div className="timeline">
            {b.stageHistory.map((h,i) => (
              <div key={i} className="tl-item">
                <div className="tl-time">{h.when}</div>
                <div className="tl-body">{h.event}</div>
              </div>
            ))}
          </div>
        </>}

        {b.minister && <>
          <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Responsible minister</h4>
          <span className="tag clk brass" onClick={() => openModal("minister", b.minister)}>{ENTITIES.ministers[b.minister].name}</span>
        </>}

        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Matching watchlists</h4>
        <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>{b.watchlists.map(w => <span key={w} className="tag brass">{w}</span>)}</div>

        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Assign policy owner</h4>
        <div style={{display:"flex", gap:8}}>
          <input value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Owner name" className="search" style={{padding:"7px 10px", flex:1}}/>
          <button className="btn primary" onClick={() => { if (owner.trim()) assignOwner(id, owner.trim()); }}>Assign</button>
        </div>
        {state.owners[id] && <div style={{marginTop:8, fontSize:12.5, color:"var(--ok)"}}><Icon name="check" size={13} style={{verticalAlign:"-2px", marginRight:4}}/>Owner: <strong>{state.owners[id]}</strong></div>}
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => { toast("Bill brief drafted", "brass"); closeModal(); }}><Icon name="brief" size={13}/> Draft bill brief</button>
        <button className="btn" onClick={() => { toast("Bill added to watchlist", "brass"); }}><Icon name="watch" size={13}/> Track bill</button>
      </div>
    </>
  );
}

function MemberDetail({ id }) {
  const m = ENTITIES.members[id];
  if (!m) return <ModalHead kicker="Member" title="Not found" />;
  const { closeModal, toast } = useStore();
  return (
    <>
      <ModalHead kicker={`${m.party} · ${m.state}`} title={m.name} />
      <div className="modal-body">
        <p style={{color:"var(--ink-2)", marginTop:0}}>{m.bio}</p>
        <div style={{display:"flex", gap:6, flexWrap:"wrap", marginTop:4}}>
          {m.roles.map((r,i) => <span key={i} className="tag">{r}</span>)}
        </div>
        <div className="grid g-3" style={{marginTop:16, gap:12}}>
          <div className="panel stat"><div className="stat-label">QONs (30d)</div><div className="stat-value" style={{fontSize:26}}>{m.qons}</div></div>
          <div className="panel stat"><div className="stat-label">Hansard mentions</div><div className="stat-value" style={{fontSize:26}}>{m.hansard}</div></div>
          <div className="panel stat"><div className="stat-label">Committees</div><div className="stat-value" style={{fontSize:26}}>{m.committees.length}</div></div>
        </div>
        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:8}}>Recent activity</h4>
        <ul style={{margin:0, paddingLeft:18, color:"var(--ink-2)"}}>
          <li>Lodged QON on digital procurement · 23 Apr</li>
          <li>Spoke on Cyber Security Bill · 22 Apr</li>
          <li>Committee questioning at FinPA hearing · 21 Apr</li>
        </ul>
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => { toast("Tracking member", "brass"); closeModal(); }}>Track member</button>
      </div>
    </>
  );
}

function MinisterDetail({ id }) {
  const m = ENTITIES.ministers[id];
  if (!m) return <ModalHead kicker="Minister" title="Not found" />;
  const { closeModal } = useStore();
  return (
    <>
      <ModalHead kicker={m.role} title={m.name} />
      <div className="modal-body">
        <p style={{color:"var(--ink-2)", marginTop:0}}>{m.bio}</p>
        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:14, marginBottom:6}}>Recent signals</h4>
        <ul style={{margin:0, paddingLeft:18, color:"var(--ink-2)"}}>{m.recent.map((r,i) => <li key={i}>{r}</li>)}</ul>
      </div>
      <div className="modal-foot"><button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button></div>
    </>
  );
}

function DivisionDetail({ id }) {
  const d = DIVISIONS.find(x => x.bill === id?.bill && x.when === id?.when) || id;
  const { closeModal, openModal } = useStore();
  return (
    <>
      <ModalHead kicker="Division" title={d.q} />
      <div className="modal-body">
        <dl className="kv">
          <dt>When</dt><dd>{d.when}</dd>
          <dt>Chamber</dt><dd>{d.chamber}</dd>
          <dt>Result</dt><dd style={{color: d.result.startsWith("Agreed") ? "var(--ok)" : "var(--escalate)"}}>{d.result}</dd>
          <dt>Related bill</dt><dd><span className="tag clk brass" onClick={() => openModal("bill", d.bill)}>{d.bill}</span></dd>
        </dl>
        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:16, marginBottom:8}}>Vote breakdown</h4>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
          <div style={{padding:12, border:"1px solid var(--line-2)", borderRadius:8}}>
            <div className="mono" style={{fontSize:10, color:"var(--ok)"}}>AYES</div>
            <div style={{fontSize:22, fontFamily:"var(--serif)"}}>{d.result.match(/\d+/)?.[0] || "—"}</div>
          </div>
          <div style={{padding:12, border:"1px solid var(--line-2)", borderRadius:8}}>
            <div className="mono" style={{fontSize:10, color:"var(--escalate)"}}>NOES</div>
            <div style={{fontSize:22, fontFamily:"var(--serif)"}}>{d.result.match(/\d+/g)?.[1] || "—"}</div>
          </div>
        </div>
      </div>
      <div className="modal-foot"><button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button></div>
    </>
  );
}

function FeedDetail({ id }) {
  const f = APH_FEEDS.find(x => x.id === id);
  const { closeModal, toast } = useStore();
  if (!f) return <ModalHead kicker="Feed" title="Not found" />;
  const statusColor = f.status === "live" ? "var(--ok)" : f.status === "delayed" ? "var(--caution)" : "var(--info)";
  return (
    <>
      <ModalHead kicker={`Source · ${f.group}`} title={f.name} />
      <div className="modal-body">
        <dl className="kv">
          <dt>URL</dt><dd className="mono" style={{fontSize:11, color:"var(--ink-3)", wordBreak:"break-all"}}>{f.url}</dd>
          <dt>Status</dt><dd><span style={{color: statusColor}}>●</span> {f.status}</dd>
          <dt>Authority</dt><dd>{f.authority}</dd>
          <dt>Confidence</dt><dd>{f.confidence}</dd>
          <dt>Parser</dt><dd>{f.parser}</dd>
          <dt>Last refresh</dt><dd className="mono">{f.last}</dd>
          <dt>Items today</dt><dd className="mono">{f.today ?? "—"}</dd>
          <dt>False positive</dt><dd>{f.fpr}</dd>
          <dt>Modules</dt><dd>{f.modules.join(", ")}</dd>
        </dl>
        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:16, marginBottom:8}}>Recent items</h4>
        <div>
          {[...Array(5)].map((_,i) => (
            <div key={i} style={{padding:"8px 0", borderBottom: i<4 ? "1px solid var(--line)" : 0}}>
              <div style={{fontSize:13}}>Item from {f.name} #{i+1}</div>
              <div className="mono" style={{fontSize:10.5, color:"var(--ink-4)", marginTop:2}}>{["08:15","07:42","07:10","Yesterday 17:30","Yesterday 14:05"][i]}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => toast(`${f.name} re-fetched`, "brass")}><Icon name="refresh" size={13}/> Re-fetch now</button>
        <button className="btn" onClick={() => toast("Parser test passed ✓", "brass")}>Test parser</button>
        <button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button>
      </div>
    </>
  );
}

function WatchlistDetail({ id }) {
  const w = WATCHLISTS.find(x => x.name === id);
  const { closeModal, toast } = useStore();
  if (!w) return <ModalHead kicker="Watchlist" title="Not found" />;
  const max = Math.max(...w.trend);
  return (
    <>
      <ModalHead kicker="Watchlist" title={w.name} />
      <div className="modal-body">
        <div className="grid g-3" style={{gap:12}}>
          <div className="panel stat"><div className="stat-label">Matches</div><div className="stat-value" style={{fontSize:26}}>{w.matches}</div></div>
          <div className="panel stat"><div className="stat-label">Keywords</div><div className="stat-value" style={{fontSize:26}}>{w.keywords}</div></div>
          <div className="panel stat"><div className="stat-label">7-day trend</div>
            <div className="spark" style={{marginTop:8}}>{w.trend.map((v,i) => <span key={i} style={{height:(v/max*24+3)+"px"}}/>)}</div>
          </div>
        </div>
        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Matching signals</h4>
        {SIGNALS.filter(s => s.tags.some(t => t.l.toLowerCase().includes(w.name.toLowerCase().split(" ")[0]))).slice(0,3).map(s => (
          <div key={s.id} style={{padding:"8px 12px", border:"1px solid var(--line-2)", borderRadius:8, marginBottom:6}}>
            <div style={{fontSize:12.5, fontWeight:500}}>{s.title}</div>
            <div className="mono" style={{fontSize:10.5, color:"var(--ink-4)", marginTop:2}}>{s.id} · {s.source}</div>
          </div>
        ))}
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => { toast("Watchlist digest sent", "brass"); closeModal(); }}>Send digest</button>
        <button className="btn" onClick={() => toast("Configuration saved")}>Edit</button>
      </div>
    </>
  );
}

function RadarDetail({ id }) {
  const r = RADAR.find(x => x.issue === id);
  const { closeModal, toast } = useStore();
  if (!r) return <ModalHead kicker="Issue" title="Not found" />;
  return (
    <>
      <ModalHead kicker="Attention radar issue" title={r.issue} />
      <div className="modal-body">
        <div style={{display:"flex", gap:8, marginBottom:12}}><Att level={r.att}/><span className="tag">{r.sources} contributing sources</span></div>
        <p style={{color:"var(--ink-2)", marginTop:0}}>{r.reason}</p>
        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:8}}>Momentum (7 days)</h4>
        <div className="spark" style={{height:40}}>
          {[3,4,5,4,6,7,Math.round(r.momentum*10)].map((v,i)=><span key={i} style={{height:(v*3+4)+"px"}}/>)}
        </div>
        <h4 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:8}}>Suggested actions</h4>
        <ul style={{margin:0, paddingLeft:18, color:"var(--ink-2)"}}>
          <li>Draft Executive Brief for DDG Digital</li>
          <li>Monitor for Estimates references</li>
          <li>Coordinate with Procurement lead</li>
        </ul>
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => { toast("Issue brief drafted", "brass"); closeModal(); }}><Icon name="brief" size={13}/> Draft issue brief</button>
      </div>
    </>
  );
}

Object.assign(window, { StoreProvider, useStore, DetailModal });
