import { useState } from "react";
import { Icon } from "../icons";
import { Att, ModalHead } from "../shell/common";
import { APH_FEEDS, DIVISIONS, SIGNALS, WATCHLISTS, RADAR } from "../data/fixtures";
import { ENTITIES } from "../data/entities";
import { useStore } from "./Store";
import type { Division, Hearing, ModalState } from "../types";

export function DetailModal(): JSX.Element | null {
  const { modal, closeModal } = useStore();
  if (!modal) return null;

  return (
    <div
      className="modal-back"
      role="dialog"
      aria-modal="true"
      onClick={closeModal}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <ModalBody modal={modal} />
      </div>
    </div>
  );
}

function ModalBody({ modal }: { modal: ModalState }): JSX.Element {
  switch (modal.kind) {
    case "committee":
      return <CommitteeDetail id={modal.id} />;
    case "bill":
      return <BillDetail id={modal.id} />;
    case "member":
      return <MemberDetail id={modal.id} />;
    case "minister":
      return <MinisterDetail id={modal.id} />;
    case "division":
      return <DivisionDetail data={modal.id} />;
    case "feed":
      return <FeedDetail id={modal.id} />;
    case "watchlist":
      return <WatchlistDetail name={modal.id} />;
    case "radar":
      return <RadarDetail issue={modal.id} />;
    case "inquiry":
      return <InquiryDetail name={modal.id} />;
    case "hearing":
      return <HearingDetail data={modal.id} />;
  }
}

function CommitteeDetail({ id }: { id: string }): JSX.Element {
  const committee = ENTITIES.committees[id];
  const { openModal, closeModal, toast } = useStore();
  if (!committee) {
    return <ModalHead kicker="Committee" title="Not found" onClose={closeModal} />;
  }
  return (
    <>
      <ModalHead
        kicker={`Committee · ${committee.chamber}`}
        title={committee.name}
        onClose={closeModal}
      />
      <div className="modal-body">
        <p style={{ color: "var(--ink-2)", marginTop: 0 }}>{committee.bio}</p>
        <dl className="kv" style={{ marginTop: 14 }}>
          <dt>Chair</dt>
          <dd>{committee.chair}</dd>
          <dt>Members</dt>
          <dd>{committee.members}</dd>
          <dt>Portfolio</dt>
          <dd>{committee.portfolio}</dd>
          <dt>Active inquiries</dt>
          <dd>{committee.active}</dd>
          <dt>Reports (30d)</dt>
          <dd>{committee.recentReports}</dd>
          <dt>Source</dt>
          <dd>
            <a
              href={committee.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--teal)" }}
            >
              Open APH committee page
            </a>
          </dd>
        </dl>

        <Section title="Upcoming & today's hearings">
          {committee.hearings.length === 0 ? (
            <div className="empty">No scheduled hearings.</div>
          ) : (
            committee.hearings.map((h, i) => (
              <button
                key={i}
                type="button"
                className="clk"
                onClick={() =>
                  openModal({
                    kind: "hearing",
                    id: { ...h, committee: committee.name },
                  })
                }
                style={{
                  display: "grid",
                  gridTemplateColumns: "130px 1fr auto",
                  padding: "10px 12px",
                  border: "1px solid var(--line-2)",
                  borderRadius: 8,
                  marginBottom: 6,
                  gap: 12,
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
                  {h.when}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{h.topic}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{h.room}</div>
                </div>
                <Icon name="chevron" size={14} stroke="var(--ink-3)" />
              </button>
            ))
          )}
        </Section>

        <Section title="Open inquiries">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {committee.inquiries.map((q, i) => (
              <button
                key={i}
                type="button"
                className="tag clk"
                onClick={() => openModal({ kind: "inquiry", id: q })}
              >
                {q}
              </button>
            ))}
          </div>
        </Section>
      </div>
      <div className="modal-foot">
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            toast("Committee prep pack queued", "brass");
            closeModal();
          }}
        >
          <Icon name="brief" size={13} /> Prep pack
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => toast("Committee added to watchlist", "brass")}
        >
          <Icon name="watch" size={13} /> Watch committee
        </button>
        <button
          type="button"
          className="btn ghost"
          style={{ marginLeft: "auto" }}
          onClick={closeModal}
        >
          Close
        </button>
      </div>
    </>
  );
}

function HearingDetail({
  data,
}: {
  data: Hearing & { committee: string };
}): JSX.Element {
  const { closeModal, toast } = useStore();
  return (
    <>
      <ModalHead kicker="Hearing" title={data.topic} onClose={closeModal} />
      <div className="modal-body">
        <dl className="kv">
          <dt>Committee</dt>
          <dd>{data.committee}</dd>
          <dt>When</dt>
          <dd>{data.when}</dd>
          <dt>Room</dt>
          <dd>{data.room}</dd>
          <dt>Broadcast</dt>
          <dd>
            <a
              href="https://www.aph.gov.au/News_and_Events/Watch_Read_Listen"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--teal)" }}
            >
              APH Watch/Read/Listen
            </a>
          </dd>
        </dl>
        <Section title="Likely witnesses">
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)" }}>
            <li>Department (First Assistant Secretary)</li>
            <li>OAIC (Privacy Commissioner)</li>
            <li>Industry peak body</li>
          </ul>
        </Section>
        <Section title="Likely questions (AI-suggested)">
          <ol style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)" }}>
            <li>
              How does the department assure AI models against bias in high-risk
              contexts?
            </li>
            <li>
              Which programs currently use automated decision-making for benefit
              eligibility?
            </li>
            <li>What is the escalation pathway when assurance fails in production?</li>
          </ol>
        </Section>
      </div>
      <div className="modal-foot">
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            toast("Added to calendar", "brass");
            closeModal();
          }}
        >
          Add to calendar
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => toast("Prep note generated", "brass")}
        >
          <Icon name="brief" size={13} /> Generate prep note
        </button>
      </div>
    </>
  );
}

function InquiryDetail({ name }: { name: string }): JSX.Element {
  const { closeModal, toast, state, assignOwner } = useStore();
  const [owner, setOwner] = useState(state.owners[name] ?? "");
  return (
    <>
      <ModalHead kicker="Inquiry" title={name} onClose={closeModal} />
      <div className="modal-body">
        <dl className="kv">
          <dt>Status</dt>
          <dd>Accepting submissions</dd>
          <dt>Submissions close</dt>
          <dd>19 May 2026</dd>
          <dt>Reporting</dt>
          <dd>by 30 August 2026</dd>
          <dt>Scope</dt>
          <dd>
            Commonwealth procurement and contract governance for digital programs
            over $100m
          </dd>
        </dl>
        <Section title="Terms of reference">
          <ol style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)" }}>
            <li>Adequacy of current governance frameworks</li>
            <li>Use of limited tender and contract variations</li>
            <li>Transparency and public reporting</li>
            <li>Any related matters</li>
          </ol>
        </Section>
        <Section title="Assign owner">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Owner name"
              className="search"
              style={{ padding: "7px 10px", flex: 1 }}
              aria-label="Owner name"
            />
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                if (owner.trim()) assignOwner(name, owner.trim());
              }}
            >
              Assign
            </button>
          </div>
          {state.owners[name] && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--ok)" }}>
              <Icon
                name="check"
                size={13}
                style={{ verticalAlign: "-2px", marginRight: 4 }}
              />
              Owner: <strong>{state.owners[name]}</strong>
            </div>
          )}
        </Section>
      </div>
      <div className="modal-foot">
        <button
          type="button"
          className="btn primary"
          onClick={() => toast("Submission draft started", "brass")}
        >
          <Icon name="brief" size={13} /> Start submission
        </button>
        <button
          type="button"
          className="btn ghost"
          style={{ marginLeft: "auto" }}
          onClick={closeModal}
        >
          Close
        </button>
      </div>
    </>
  );
}

function BillDetail({ id }: { id: string }): JSX.Element {
  const bill = ENTITIES.bills[id];
  const { closeModal, toast, state, assignOwner, openModal } = useStore();
  // Correct precedence: prefer a persisted owner; else fall back to bill.owner
  // unless that placeholder is "—"; else empty string.
  const initialOwner =
    state.owners[id] ?? (bill && bill.owner !== "—" ? bill.owner : "");
  const [owner, setOwner] = useState(initialOwner);

  if (!bill) {
    return <ModalHead kicker="Bill" title="Not found" onClose={closeModal} />;
  }

  return (
    <>
      <ModalHead
        kicker={`Bill · ${bill.ref}`}
        title={bill.title}
        onClose={closeModal}
      />
      <div className="modal-body">
        <div
          style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}
        >
          <Att level={bill.att} />
          <span className="tag">{bill.portfolio}</span>
          <span className="tag teal">{bill.stage}</span>
          {bill.digest === "Published" && (
            <span className="tag teal">Digest published</span>
          )}
        </div>
        <Section title="Purpose">
          <p style={{ margin: 0, color: "var(--ink-2)" }}>{bill.purpose}</p>
        </Section>
        {bill.provisions.length > 0 && (
          <Section title="Key provisions">
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)" }}>
              {bill.provisions.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </Section>
        )}
        {bill.stageHistory.length > 0 && (
          <Section title="Timeline">
            <div className="timeline">
              {bill.stageHistory.map((h, i) => (
                <div key={i} className="tl-item">
                  <div className="tl-time">{h.when}</div>
                  <div className="tl-body">{h.event}</div>
                </div>
              ))}
            </div>
          </Section>
        )}
        {bill.minister && ENTITIES.ministers[bill.minister] && (
          <Section title="Responsible minister">
            <button
              type="button"
              className="tag clk brass"
              onClick={() => openModal({ kind: "minister", id: bill.minister! })}
            >
              {ENTITIES.ministers[bill.minister].name}
            </button>
          </Section>
        )}
        <Section title="Matching watchlists">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {bill.watchlists.map((w) => (
              <span key={w} className="tag brass">
                {w}
              </span>
            ))}
          </div>
        </Section>
        <Section title="Assign policy owner">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Owner name"
              className="search"
              style={{ padding: "7px 10px", flex: 1 }}
              aria-label="Policy owner"
            />
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                if (owner.trim()) assignOwner(id, owner.trim());
              }}
            >
              Assign
            </button>
          </div>
          {state.owners[id] && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--ok)" }}>
              <Icon
                name="check"
                size={13}
                style={{ verticalAlign: "-2px", marginRight: 4 }}
              />
              Owner: <strong>{state.owners[id]}</strong>
            </div>
          )}
        </Section>
      </div>
      <div className="modal-foot">
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            toast("Bill brief drafted", "brass");
            closeModal();
          }}
        >
          <Icon name="brief" size={13} /> Draft bill brief
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => toast("Bill added to watchlist", "brass")}
        >
          <Icon name="watch" size={13} /> Track bill
        </button>
      </div>
    </>
  );
}

function MemberDetail({ id }: { id: string }): JSX.Element {
  const m = ENTITIES.members[id];
  const { closeModal, toast } = useStore();
  if (!m) {
    return <ModalHead kicker="Member" title="Not found" onClose={closeModal} />;
  }
  return (
    <>
      <ModalHead
        kicker={`${m.party} · ${m.state}`}
        title={m.name}
        onClose={closeModal}
      />
      <div className="modal-body">
        <p style={{ color: "var(--ink-2)", marginTop: 0 }}>{m.bio}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          {m.roles.map((r, i) => (
            <span key={i} className="tag">
              {r}
            </span>
          ))}
        </div>
        <div className="grid g-3" style={{ marginTop: 16, gap: 12 }}>
          <div className="panel stat">
            <div className="stat-label">QONs (30d)</div>
            <div className="stat-value" style={{ fontSize: 26 }}>
              {m.qons}
            </div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Hansard mentions</div>
            <div className="stat-value" style={{ fontSize: 26 }}>
              {m.hansard}
            </div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Committees</div>
            <div className="stat-value" style={{ fontSize: 26 }}>
              {m.committees.length}
            </div>
          </div>
        </div>
        <Section title="Recent activity">
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)" }}>
            <li>Lodged QON on digital procurement · 23 Apr</li>
            <li>Spoke on Cyber Security Bill · 22 Apr</li>
            <li>Committee questioning at FinPA hearing · 21 Apr</li>
          </ul>
        </Section>
      </div>
      <div className="modal-foot">
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            toast("Tracking member", "brass");
            closeModal();
          }}
        >
          Track member
        </button>
      </div>
    </>
  );
}

function MinisterDetail({ id }: { id: string }): JSX.Element {
  const m = ENTITIES.ministers[id];
  const { closeModal } = useStore();
  if (!m) {
    return <ModalHead kicker="Minister" title="Not found" onClose={closeModal} />;
  }
  return (
    <>
      <ModalHead kicker={m.role} title={m.name} onClose={closeModal} />
      <div className="modal-body">
        <p style={{ color: "var(--ink-2)", marginTop: 0 }}>{m.bio}</p>
        <Section title="Recent signals">
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)" }}>
            {m.recent.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Section>
      </div>
      <div className="modal-foot">
        <button
          type="button"
          className="btn ghost"
          style={{ marginLeft: "auto" }}
          onClick={closeModal}
        >
          Close
        </button>
      </div>
    </>
  );
}

function DivisionDetail({ data }: { data: Division }): JSX.Element {
  const { closeModal, openModal } = useStore();
  // Prefer the canonical division if we can find one; else render the passed-in
  // object directly. Prior code returned a malformed fallback that would throw
  // when reading .q / .result from the modal id when it was the lookup key.
  const d = DIVISIONS.find(
    (x) => x.bill === data.bill && x.when === data.when,
  ) ?? data;

  const matches = d.result.match(/\d+/g) ?? [];
  const ayes = matches[0] ?? "—";
  const noes = matches[1] ?? "—";
  const success = d.result.startsWith("Agreed");

  return (
    <>
      <ModalHead kicker="Division" title={d.q} onClose={closeModal} />
      <div className="modal-body">
        <dl className="kv">
          <dt>When</dt>
          <dd>{d.when}</dd>
          <dt>Chamber</dt>
          <dd>{d.chamber}</dd>
          <dt>Result</dt>
          <dd style={{ color: success ? "var(--ok)" : "var(--escalate)" }}>
            {d.result}
          </dd>
          <dt>Related bill</dt>
          <dd>
            <button
              type="button"
              className="tag clk brass"
              onClick={() => openModal({ kind: "bill", id: d.bill })}
            >
              {d.bill}
            </button>
          </dd>
        </dl>
        <Section title="Vote breakdown">
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <div
              style={{
                padding: 12,
                border: "1px solid var(--line-2)",
                borderRadius: 8,
              }}
            >
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ok)" }}>
                AYES
              </div>
              <div style={{ fontSize: 22, fontFamily: "var(--serif)" }}>{ayes}</div>
            </div>
            <div
              style={{
                padding: 12,
                border: "1px solid var(--line-2)",
                borderRadius: 8,
              }}
            >
              <div
                className="mono"
                style={{ fontSize: 10.5, color: "var(--escalate)" }}
              >
                NOES
              </div>
              <div style={{ fontSize: 22, fontFamily: "var(--serif)" }}>{noes}</div>
            </div>
          </div>
        </Section>
      </div>
      <div className="modal-foot">
        <button
          type="button"
          className="btn ghost"
          style={{ marginLeft: "auto" }}
          onClick={closeModal}
        >
          Close
        </button>
      </div>
    </>
  );
}

function FeedDetail({ id }: { id: string }): JSX.Element {
  const f = APH_FEEDS.find((x) => x.id === id);
  const { closeModal, toast } = useStore();
  if (!f) {
    return <ModalHead kicker="Feed" title="Not found" onClose={closeModal} />;
  }
  const statusColor =
    f.status === "live"
      ? "var(--ok)"
      : f.status === "delayed"
        ? "var(--caution)"
        : "var(--info)";
  return (
    <>
      <ModalHead
        kicker={`Source · ${f.group}`}
        title={f.name}
        onClose={closeModal}
      />
      <div className="modal-body">
        <dl className="kv">
          <dt>URL</dt>
          <dd
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-3)",
              wordBreak: "break-all",
            }}
          >
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--teal)" }}
            >
              {f.url}
            </a>
          </dd>
          <dt>Status</dt>
          <dd>
            <span style={{ color: statusColor }}>●</span> {f.status}
          </dd>
          <dt>Authority</dt>
          <dd>{f.authority}</dd>
          <dt>Confidence</dt>
          <dd>{f.confidence}</dd>
          <dt>Parser</dt>
          <dd>{f.parser}</dd>
          <dt>Last refresh</dt>
          <dd className="mono">{f.last}</dd>
          <dt>Items today</dt>
          <dd className="mono">{f.today ?? "—"}</dd>
          <dt>False positive</dt>
          <dd>{f.fpr}</dd>
          <dt>Modules</dt>
          <dd>{f.modules.join(", ")}</dd>
        </dl>
      </div>
      <div className="modal-foot">
        <button
          type="button"
          className="btn primary"
          onClick={() => toast(`${f.name} re-fetched`, "brass")}
        >
          <Icon name="refresh" size={13} /> Re-fetch now
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => toast("Parser test queued")}
        >
          Test parser
        </button>
        <button
          type="button"
          className="btn ghost"
          style={{ marginLeft: "auto" }}
          onClick={closeModal}
        >
          Close
        </button>
      </div>
    </>
  );
}

function WatchlistDetail({ name }: { name: string }): JSX.Element {
  const w = WATCHLISTS.find((x) => x.name === name);
  const { closeModal, toast } = useStore();
  if (!w) {
    return <ModalHead kicker="Watchlist" title="Not found" onClose={closeModal} />;
  }
  const max = Math.max(...w.trend, 1);
  const lower = w.name.toLowerCase();
  const matches = SIGNALS.filter((s) =>
    s.tags.some((t) => t.l.toLowerCase().split(/\s|\&/).some((tok) => lower.includes(tok) && tok.length > 3)),
  ).slice(0, 3);

  return (
    <>
      <ModalHead kicker="Watchlist" title={w.name} onClose={closeModal} />
      <div className="modal-body">
        <div className="grid g-3" style={{ gap: 12 }}>
          <div className="panel stat">
            <div className="stat-label">Matches</div>
            <div className="stat-value" style={{ fontSize: 26 }}>
              {w.matches}
            </div>
          </div>
          <div className="panel stat">
            <div className="stat-label">Keywords</div>
            <div className="stat-value" style={{ fontSize: 26 }}>
              {w.keywords}
            </div>
          </div>
          <div className="panel stat">
            <div className="stat-label">7-day trend</div>
            <div className="spark" style={{ marginTop: 8 }}>
              {w.trend.map((v, i) => (
                <span key={i} style={{ height: `${(v / max) * 24 + 3}px` }} />
              ))}
            </div>
          </div>
        </div>
        <Section title="Matching signals">
          {matches.length === 0 && <div className="empty">No recent matches.</div>}
          {matches.map((s) => (
            <div
              key={s.id}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--line-2)",
                borderRadius: 8,
                marginBottom: 6,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>{s.title}</div>
              <div
                className="mono"
                style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}
              >
                {s.id} · {s.source}
              </div>
            </div>
          ))}
        </Section>
      </div>
      <div className="modal-foot">
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            toast("Watchlist digest sent", "brass");
            closeModal();
          }}
        >
          Send digest
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => toast("Configuration saved")}
        >
          Edit
        </button>
      </div>
    </>
  );
}

function RadarDetail({ issue }: { issue: string }): JSX.Element {
  const r = RADAR.find((x) => x.issue === issue);
  const { closeModal, toast } = useStore();
  if (!r) {
    return <ModalHead kicker="Issue" title="Not found" onClose={closeModal} />;
  }
  return (
    <>
      <ModalHead
        kicker="Attention radar issue"
        title={r.issue}
        onClose={closeModal}
      />
      <div className="modal-body">
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Att level={r.att} />
          <span className="tag">{r.sources} contributing sources</span>
        </div>
        <p style={{ color: "var(--ink-2)", marginTop: 0 }}>{r.reason}</p>
        <Section title="Momentum (7 days)">
          <div className="spark" style={{ height: 40 }}>
            {[3, 4, 5, 4, 6, 7, Math.round(r.momentum * 10)].map((v, i) => (
              <span key={i} style={{ height: `${v * 3 + 4}px` }} />
            ))}
          </div>
        </Section>
        <Section title="Suggested actions">
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)" }}>
            <li>Draft Executive Brief for DDG Digital</li>
            <li>Monitor for Estimates references</li>
            <li>Coordinate with Procurement lead</li>
          </ul>
        </Section>
      </div>
      <div className="modal-foot">
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            toast("Issue brief drafted", "brass");
            closeModal();
          }}
        >
          <Icon name="brief" size={13} /> Draft issue brief
        </button>
      </div>
    </>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps): JSX.Element {
  return (
    <>
      <h4
        className="mono"
        style={{
          fontSize: 10.5,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          marginTop: 18,
          marginBottom: 8,
        }}
      >
        {title}
      </h4>
      {children}
    </>
  );
}
