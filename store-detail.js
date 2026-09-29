function DetailModal() {
  const { modal, closeModal, openModal, state, assignOwner, addWatchlist, openSignal } = useStore();
  const prevFocusRef = React.useRef(null);
  const closeButtonRef = React.useRef(null);
  const titleId = React.useId();
  React.useEffect(() => {
    if (!modal) return;
    const h = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [modal, closeModal]);
  React.useEffect(() => {
    if (!modal) return;
    prevFocusRef.current = document.activeElement;
    requestAnimationFrame(() => {
      var _a;
      return (_a = closeButtonRef.current) == null ? void 0 : _a.focus();
    });
    return () => {
      var _a, _b;
      (_b = (_a = prevFocusRef.current) == null ? void 0 : _a.focus) == null ? void 0 : _b.call(_a);
      prevFocusRef.current = null;
    };
  }, [modal]);
  React.useEffect(() => {
    if (!modal) return;
    const trap = (e) => {
      var _a;
      if (e.key !== "Tab") return;
      const modalEl = (_a = closeButtonRef.current) == null ? void 0 : _a.closest(".modal");
      if (!modalEl) return;
      const focusable = Array.from(modalEl.querySelectorAll("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])")).filter((el) => !el.disabled);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [modal]);
  if (!modal) return null;
  const { type, id } = modal;
  const render = () => {
    if (type === "committee") return /* @__PURE__ */ React.createElement(CommitteeDetail, { id });
    if (type === "bill") return /* @__PURE__ */ React.createElement(BillDetail, { id });
    if (type === "member") return /* @__PURE__ */ React.createElement(MemberDetail, { id });
    if (type === "minister") return /* @__PURE__ */ React.createElement(MinisterDetail, { id });
    if (type === "division") return /* @__PURE__ */ React.createElement(DivisionDetail, { id });
    if (type === "feed") return /* @__PURE__ */ React.createElement(FeedDetail, { id });
    if (type === "watchlist") return /* @__PURE__ */ React.createElement(WatchlistDetail, { id });
    if (type === "radar") return /* @__PURE__ */ React.createElement(RadarDetail, { id });
    if (type === "inquiry") return /* @__PURE__ */ React.createElement(InquiryDetail, { id });
    if (type === "hearing") return /* @__PURE__ */ React.createElement(HearingDetail, { data: id });
    return /* @__PURE__ */ React.createElement("div", null, "Unknown");
  };
  return /* @__PURE__ */ React.createElement("div", { className: "modal-back" }, /* @__PURE__ */ React.createElement("div", { className: "modal-scrim", onClick: closeModal, "aria-hidden": "true" }), /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
      style: {
        border: "1px solid var(--line-bright)",
        boxShadow: "0 1px 0 color-mix(in srgb, #000 38%, transparent), 0 40px 90px -32px color-mix(in srgb, #000 75%, transparent), inset 0 0 0 1px color-mix(in srgb, #fff 3%, transparent)"
      }
    },
    React.cloneElement(render(), { titleId, closeButtonRef })
  ));
}
const NOT_HELD = "Not held here \xB7 see APH";
function ModalHead({ kicker, title, right, onClose, representative = false, titleId, closeButtonRef }) {
  const { closeModal } = useStore();
  return /* @__PURE__ */ React.createElement("div", { className: "modal-head" }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", null, kicker), representative && SITE_CONFIG.showUnsourcedSurfaces && /* @__PURE__ */ React.createElement("span", { className: "chip-fixture" }, "Sample data")), /* @__PURE__ */ React.createElement("h2", { id: titleId, className: "serif", style: { fontSize: "var(--t-headline)", margin: "4px 0 0", fontWeight: 500, lineHeight: 1.25 } }, title)), right, /* @__PURE__ */ React.createElement("button", { ref: closeButtonRef, className: "btn ghost sm", "aria-label": "Close detail", onClick: onClose || closeModal, style: { flex: "none" } }, /* @__PURE__ */ React.createElement(Icon, { name: "close", size: 14 })));
}
function copyModalText(text, toast, ok = "Copied to clipboard") {
  return copyToClipboard(text).then(() => toast(ok, "brass")).catch(() => toast("Clipboard unavailable: content not copied", "error"));
}
function CommitteeDetail({ id, titleId, closeButtonRef }) {
  var _a, _b, _c, _d;
  const c = ENTITIES.committees[id];
  const { openModal, closeModal, toast, addWatchlist, isWatched } = useStore();
  if (!c) return /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Committee", title: "Not found", titleId, closeButtonRef });
  const watchKey = `committee:${id}`;
  const watched = isWatched(watchKey);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: `Committee \xB7 ${c.chamber}`, title: c.name, representative: !!c.representative, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, c.bio && /* @__PURE__ */ React.createElement("p", { style: { color: "var(--ink-2)", marginTop: 0 } }, c.bio), /* @__PURE__ */ React.createElement("dl", { className: "kv", style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("dt", null, "Chair"), /* @__PURE__ */ React.createElement("dd", null, c.chair || (c.url ? /* @__PURE__ */ React.createElement("a", { href: "https://www." + c.url.replace(/^https?:\/\/(www\.)?/, ""), target: "_blank", rel: "noopener noreferrer" }, "See current membership at APH \u2192") : "See APH for current membership")), /* @__PURE__ */ React.createElement("dt", null, "Members"), /* @__PURE__ */ React.createElement("dd", null, (_a = c.members) != null ? _a : NOT_HELD), /* @__PURE__ */ React.createElement("dt", null, "Portfolio"), /* @__PURE__ */ React.createElement("dd", null, (_b = c.portfolio) != null ? _b : NOT_HELD), /* @__PURE__ */ React.createElement("dt", null, "Active inquiries"), /* @__PURE__ */ React.createElement("dd", null, (_c = c.active) != null ? _c : NOT_HELD), /* @__PURE__ */ React.createElement("dt", null, "Reports (30d)"), /* @__PURE__ */ React.createElement("dd", null, (_d = c.recentReports) != null ? _d : NOT_HELD), /* @__PURE__ */ React.createElement("dt", null, "Source"), /* @__PURE__ */ React.createElement("dd", { className: "mono", style: { fontSize: "var(--t-eyebrow)", color: "var(--ink-3)" } }, c.url)), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 22, marginBottom: 8 } }, "Upcoming & today's hearings"), /* @__PURE__ */ React.createElement("div", { className: "empty" }, "This panel does not match hearings to individual committees. Hearings from the APH feeds are listed on the Committees page under Today's hearings and Upcoming Senate hearings; the committee's own page carries its full programme. See", " ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Committees", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "aph.gov.au/Parliamentary_Business/Committees ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11, style: { verticalAlign: "-1px" } })), "."), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 22, marginBottom: 8 } }, "Open inquiries"), c.inquiries.length > 0 ? /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, c.inquiries.map((q, i) => /* @__PURE__ */ React.createElement("button", { type: "button", key: i, className: "tag clk", onClick: () => openModal("inquiry", q) }, q))) : /* @__PURE__ */ React.createElement("div", { className: "empty" }, "This panel does not match inquiries to individual committees. Inquiries from the APH feeds are listed on the Committees page under Inquiries and reports, and the committee's own page on aph.gov.au lists its current inquiries.")), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    copyModalText(`# Committee prep pack
Committee: ${c.name}
Chamber: ${c.chamber}
Open inquiries: ${c.inquiries.join("; ")}
Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`, toast, "Committee prep pack copied");
    closeModal();
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Prep pack"), /* @__PURE__ */ React.createElement("button", { className: "btn", onClick: () => addWatchlist(watchKey), style: watched ? { borderColor: "var(--brass)", color: "var(--brass)" } : void 0 }, /* @__PURE__ */ React.createElement(Icon, { name: "watch", size: 13 }), " ", watched ? "Watching committee" : "Watch committee"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", style: { marginLeft: "auto" }, onClick: closeModal }, "Close")));
}
function HearingDetail({ data, titleId, closeButtonRef }) {
  const { closeModal, toast } = useStore();
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Hearing", title: data.topic, representative: true, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("dl", { className: "kv" }, /* @__PURE__ */ React.createElement("dt", null, "Committee"), /* @__PURE__ */ React.createElement("dd", null, data.committee), /* @__PURE__ */ React.createElement("dt", null, "When"), /* @__PURE__ */ React.createElement("dd", null, data.when), /* @__PURE__ */ React.createElement("dt", null, "Room"), /* @__PURE__ */ React.createElement("dd", null, data.room), /* @__PURE__ */ React.createElement("dt", null, "Broadcast"), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement("a", { href: "https://parlview.aph.gov.au/", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "ParlView ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11, style: { verticalAlign: "-1px" } })))), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 8 } }, "Witnesses"), /* @__PURE__ */ React.createElement("div", { className: "empty" }, "Parliament Pulse holds no verified witness list for this hearing, because APH publishes witness lists as hearing programmes on the committee page rather than as a machine-readable feed. See the real hearing programme at", " ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Committees", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "aph.gov.au/Parliamentary_Business/Committees ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11, style: { verticalAlign: "-1px" } })), ".")), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    copyModalText(`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Parliament Pulse//Live Beta//EN
BEGIN:VEVENT
SUMMARY:${data.topic}
LOCATION:${data.room}
DESCRIPTION:${data.committee} hearing. Verify time against APH before importing.
END:VEVENT
END:VCALENDAR`, toast, "Calendar stub copied");
    closeModal();
  } }, "Copy calendar stub"), /* @__PURE__ */ React.createElement("button", { className: "btn", onClick: () => {
    copyModalText(`# Hearing prep note
Topic: ${data.topic}
Committee: ${data.committee}
When: ${data.when}
Room: ${data.room}

Parliament Pulse holds no verified witness list for this hearing. See the real hearing programme at https://www.aph.gov.au/Parliamentary_Business/Committees`, toast, "Prep note copied");
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Generate prep note")));
}
function InquiryDetail({ id, titleId, closeButtonRef }) {
  const { closeModal, toast, state, assignOwner } = useStore();
  const name = typeof id === "string" ? id : id == null ? void 0 : id.name;
  const [owner, setOwner] = React.useState(state.owners[name] || "");
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Inquiry", title: name, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("div", { className: "empty" }, "Parliament Pulse holds no verified detail for this inquiry, because APH publishes no machine-readable feed of inquiry terms of reference. See the real committee page at", " ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Committees", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "aph.gov.au/Parliamentary_Business/Committees ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11, style: { verticalAlign: "-1px" } })), "."), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 8 } }, "Assign owner"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("input", { "aria-label": "Owner name", value: owner, onChange: (e) => setOwner(e.target.value), placeholder: "Owner name", className: "search", style: { padding: "7px 10px", flex: 1 } }), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    if (owner.trim()) {
      assignOwner(name, owner.trim());
    }
  } }, "Assign")), state.owners[name] && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8, fontSize: "var(--t-body-sm)", color: "var(--ok)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 13, style: { verticalAlign: "-2px", marginRight: 4 } }), "Owner: ", /* @__PURE__ */ React.createElement("strong", null, state.owners[name]))), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => copyModalText(`# Submission starter
Inquiry: ${name}
Owner: ${state.owners[name] || owner || "Unassigned"}
Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`, toast, "Submission starter copied") }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Start submission"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", style: { marginLeft: "auto" }, onClick: closeModal }, "Close")));
}
function BillDetail({ id, titleId, closeButtonRef }) {
  const b = ENTITIES.bills[id];
  const { closeModal, toast, state, assignOwner, openModal, addWatchlist, isWatched } = useStore();
  const [owner, setOwner] = React.useState(state.owners[id] || ((b == null ? void 0 : b.owner) || ""));
  if (!b) return /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Bill", title: "Not found", titleId, closeButtonRef });
  const min = ENTITIES.ministers[b.minister];
  const watchKey = `bill:${id}`;
  const watched = isWatched(watchKey);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: `Bill \xB7 ${b.ref}`, title: b.title, representative: !!b.representative, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(Att, { level: b.att }), /* @__PURE__ */ React.createElement("span", { className: "tag" }, b.portfolio), /* @__PURE__ */ React.createElement("span", { className: "tag teal" }, b.stage), b.digest === "Published" && /* @__PURE__ */ React.createElement("span", { className: "tag teal" }, "Digest published")), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: 6 } }, "Purpose"), /* @__PURE__ */ React.createElement("p", { style: { margin: 0, color: "var(--ink-2)" } }, b.purpose), b.provisions.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 6 } }, "Key provisions"), /* @__PURE__ */ React.createElement("ul", { style: { margin: 0, paddingLeft: 18, color: "var(--ink-2)" } }, b.provisions.map((p, i) => /* @__PURE__ */ React.createElement("li", { key: i }, p)))), b.stageHistory.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 6 } }, "Timeline"), /* @__PURE__ */ React.createElement("div", { className: "timeline" }, b.stageHistory.map((h, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "tl-item" }, /* @__PURE__ */ React.createElement("div", { className: "tl-time" }, h.when), /* @__PURE__ */ React.createElement("div", { className: "tl-body" }, h.event))))), min && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 6 } }, "Responsible minister"), /* @__PURE__ */ React.createElement("button", { type: "button", className: "tag clk brass", onClick: () => openModal("minister", b.minister) }, min.name)), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 6 } }, "Matching watchlists"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } }, b.watchlists.map((w) => /* @__PURE__ */ React.createElement("span", { key: w, className: "tag brass" }, w))), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 6 } }, "Assign policy owner"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("input", { "aria-label": "Owner name", value: owner, onChange: (e) => setOwner(e.target.value), placeholder: "Owner name", className: "search", style: { padding: "7px 10px", flex: 1 } }), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    if (owner.trim()) assignOwner(id, owner.trim());
  } }, "Assign")), state.owners[id] && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8, fontSize: "var(--t-body-sm)", color: "var(--ok)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 13, style: { verticalAlign: "-2px", marginRight: 4 } }), "Owner: ", /* @__PURE__ */ React.createElement("strong", null, state.owners[id]))), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    copyModalText(`# Bill brief
Bill: ${b.title}
Reference: ${b.ref}
Stage: ${b.stage}
Portfolio: ${b.portfolio}

Purpose:
${b.purpose}

Key provisions:
${b.provisions.map((p) => `- ${p}`).join("\n") || "- Not recorded"}

Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`, toast, "Bill brief copied");
    closeModal();
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Draft bill brief"), /* @__PURE__ */ React.createElement("button", { className: "btn", onClick: () => addWatchlist(watchKey), style: watched ? { borderColor: "var(--brass)", color: "var(--brass)" } : void 0 }, /* @__PURE__ */ React.createElement(Icon, { name: "watch", size: 13 }), " ", watched ? "Tracking bill" : "Track bill")));
}
function MemberDetail({ id, titleId, closeButtonRef }) {
  const { closeModal } = useStore();
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Member", title: "No member profile held", titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("div", { className: "empty" }, "Parliament Pulse holds no senator or member profiles, because no live source of member records is connected. Look up current senators and members at", " ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Senators_and_Members", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "aph.gov.au/Senators_and_Members ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11, style: { verticalAlign: "-1px" } })), ".")), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost", style: { marginLeft: "auto" }, onClick: closeModal }, "Close")));
}
function MinisterDetail({ id, titleId, closeButtonRef }) {
  const m = ENTITIES.ministers[id];
  const { closeModal } = useStore();
  if (!m) return /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Minister", title: "Not found", titleId, closeButtonRef });
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: m.role, title: m.name, representative: !!m.representative, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("p", { style: { color: "var(--ink-2)", marginTop: 0 } }, m.bio), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 14, marginBottom: 6 } }, "Recent signals"), /* @__PURE__ */ React.createElement("ul", { style: { margin: 0, paddingLeft: 18, color: "var(--ink-2)" } }, m.recent.map((r, i) => /* @__PURE__ */ React.createElement("li", { key: i }, r)))), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost", style: { marginLeft: "auto" }, onClick: closeModal }, "Close")));
}
function DivisionDetail({ id, titleId, closeButtonRef }) {
  var _a, _b;
  const d = DIVISIONS.find((x) => x.bill === (id == null ? void 0 : id.bill) && x.when === (id == null ? void 0 : id.when)) || id;
  const { closeModal, openModal } = useStore();
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Division", title: d.q, representative: !!d.representative, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("dl", { className: "kv" }, /* @__PURE__ */ React.createElement("dt", null, "When"), /* @__PURE__ */ React.createElement("dd", null, d.when), /* @__PURE__ */ React.createElement("dt", null, "Chamber"), /* @__PURE__ */ React.createElement("dd", null, d.chamber), /* @__PURE__ */ React.createElement("dt", null, "Result"), /* @__PURE__ */ React.createElement("dd", { style: { color: d.result.startsWith("Agreed") ? "var(--ok)" : "var(--escalate)" } }, d.result), /* @__PURE__ */ React.createElement("dt", null, "Related bill"), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement("button", { type: "button", className: "tag clk brass", onClick: () => openModal("bill", d.bill) }, d.bill))), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 16, marginBottom: 8 } }, "Vote breakdown"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { padding: 12, border: "1px solid var(--line-2)", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ok)" } }, "AYES"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-headline)", fontFamily: "var(--serif)" } }, ((_a = d.result.match(/\d+/)) == null ? void 0 : _a[0]) || NO_VALUE)), /* @__PURE__ */ React.createElement("div", { style: { padding: 12, border: "1px solid var(--line-2)", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--escalate)" } }, "NOES"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-headline)", fontFamily: "var(--serif)" } }, ((_b = d.result.match(/\d+/g)) == null ? void 0 : _b[1]) || NO_VALUE)))), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost", style: { marginLeft: "auto" }, onClick: closeModal }, "Close")));
}
function FeedDetail({ id, titleId, closeButtonRef }) {
  const f = APH_FEEDS.find((x) => x.id === id);
  const { closeModal, toast } = useStore();
  const health = useLiveState("connectors");
  if (!f) return /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Feed", title: "Not found", titleId, closeButtonRef });
  const c = (health.items || []).find((x) => x && x.isFeed && x.url === f.url) || null;
  const st = c ? feedHealthState(c) : null;
  const status = st === "ok" ? "OK" : st === "failed" ? "Failed" : st === "pending" ? "Not yet checked" : NOT_SUPPLIED;
  const last = c ? fmtPollStamp(c.lastSuccessAt) || "Never" : NOT_SUPPLIED;
  const parsed = c && c.itemsParsed != null ? String(c.itemsParsed) : NOT_SUPPLIED;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: `Source \xB7 ${f.group}`, title: c && c.label ? c.label : f.name, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("dl", { className: "kv" }, /* @__PURE__ */ React.createElement("dt", null, "URL"), /* @__PURE__ */ React.createElement("dd", { className: "mono", style: { fontSize: "var(--t-eyebrow)", color: "var(--ink-3)", wordBreak: "break-all" } }, f.url), /* @__PURE__ */ React.createElement("dt", null, "Status"), /* @__PURE__ */ React.createElement("dd", { style: st === "failed" ? { color: "var(--escalate)" } : void 0 }, status, c && c.lastHttpStatus != null ? ` \xB7 HTTP ${c.lastHttpStatus}` : ""), /* @__PURE__ */ React.createElement("dt", null, "Authority"), /* @__PURE__ */ React.createElement("dd", null, f.authority), /* @__PURE__ */ React.createElement("dt", null, "Last success"), /* @__PURE__ */ React.createElement("dd", null, last), /* @__PURE__ */ React.createElement("dt", null, "Items at last check"), /* @__PURE__ */ React.createElement("dd", null, parsed), c && c.parseError && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", null, "Error"), /* @__PURE__ */ React.createElement("dd", null, c.parseError)))), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("a", { className: "btn primary", href: f.url, target: "_blank", rel: "noopener noreferrer", style: { textDecoration: "none" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 13 }), " Open the feed on aph.gov.au"), /* @__PURE__ */ React.createElement("button", { className: "btn", title: "Copy the checks a reader can run on this feed", onClick: () => copyModalText(`# Feed check list
Feed: ${f.name}
URL: ${f.url}
Status: ${status}
Last success: ${last}

Checks:
- HTTP status is 2xx
- The feed lists items when the source publishes
- Each item has a title, date and link`, toast, "Feed check list copied") }, "Copy check list"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", style: { marginLeft: "auto" }, onClick: closeModal }, "Close")));
}
function WatchlistDetail({ id, titleId, closeButtonRef }) {
  const { closeModal, toast, state } = useStore();
  const all = [...WATCHLISTS, ...state.watchlistCreated || []];
  const w = all.find((x) => x.name === id);
  if (!w) return /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Watchlist", title: "Not found", titleId, closeButtonRef });
  const live = useLiveState("signals");
  const matchSource = live.items || SIGNALS;
  const matchingAll = watchlistMatches(w, matchSource);
  const matchingSignals = matchingAll.slice(0, 3);
  const keywordList = watchlistKeywords(w);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: w.created ? "Watchlist \xB7 New" : "Watchlist", title: w.name, representative: !!w.representative, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, w.created && /* @__PURE__ */ React.createElement("div", { className: "empty", style: { marginBottom: 14 } }, "Created watchlist. Keyword matching runs against the current signal stream. Trend builds as new signals arrive."), /* @__PURE__ */ React.createElement("div", { className: "grid g-3", style: { gap: 12 } }, /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Matches"), /* @__PURE__ */ React.createElement("div", { className: "stat-value", style: { fontSize: "var(--t-stat)" } }, matchingAll.length)), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Keywords"), /* @__PURE__ */ React.createElement("div", { className: "stat-value", style: { fontSize: "var(--t-stat)" } }, keywordList.length)), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Trend history"), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { marginTop: 8, color: "var(--ink-4)", fontSize: "var(--t-eyebrow)" } }, "Not held. Parliament Pulse does not yet track watchlist matches over time."))), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 6 } }, "Matching signals"), matchingSignals.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "empty" }, "No matching signals in the current stream."), matchingSignals.map((s) => /* @__PURE__ */ React.createElement("div", { key: s.id, style: { padding: "8px 12px", border: "1px solid var(--line-2)", borderRadius: 8, marginBottom: 6 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-body-sm)", fontWeight: 500 } }, s.title), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-label)", color: "var(--ink-4)", marginTop: 2 } }, s.id, " \xB7 ", s.source)))), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost", onClick: () => {
    copyModalText(`# Watchlist digest
Watchlist: ${w.name}
Matches: ${matchingAll.length}
Keywords: ${keywordList.join(", ")}

Matching signals:
${matchingSignals.map((s) => `- ${s.id}: ${s.title}`).join("\n") || "- No matching signals in the current stream."}`, toast, "Watchlist digest copied");
    closeModal();
  } }, "Copy digest"), /* @__PURE__ */ React.createElement("button", { className: "btn", onClick: () => toast("Configuration saved locally") }, "Save config")));
}
function RadarDetail({ id, titleId, closeButtonRef }) {
  const r = RADAR.find((x) => x.group === id);
  if (!r) return /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Source group", title: "Not found", titleId, closeButtonRef });
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Activity by source", title: r.group, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 12 } }, /* @__PURE__ */ React.createElement(Att, { level: r.att }), /* @__PURE__ */ React.createElement("span", { className: "tag" }, r.count, " items from ", r.sources, " feed", r.sources !== 1 ? "s" : "")), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--ink-2)", marginTop: 0 } }, attentionDisclosure())));
}
Object.assign(window, { DetailModal });
