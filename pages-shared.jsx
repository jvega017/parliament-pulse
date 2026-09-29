// pages-shared.jsx: hooks alias, CSV export, copy and URL helpers used by every desk.
// Split from pages.jsx (FE-11, ARCH-11). Every file is a classic script: its
// top-level declarations share one global lexical scope with the other files, so
// load order in index.html matters only for code that runs at load time.


const { useState, useMemo } = React;

function csvEscape(v) {
  const text = v == null ? "" : String(v);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Takes the array to export so a live inbox exports live rows (spec 2.1). The
// only caller passes PageOverview's sourceSignals (live items or the fixture).
function exportSignalsCSV(signals) {
  const source = Array.isArray(signals) ? signals : SIGNALS;
  const headers = ["id","date","source","attention","title","link","action","confidence"];
  const rows = source.map(s => [
    s.id, s.date, s.source, s.attention || NOT_SUPPLIED,
    s.title,
    s.link || "",
    s.action,
    s.confidence ?? NOT_SUPPLIED,
  ]);
  exportRowsCSV(headers, rows, `parliament-pulse-signals-${new Date().toISOString().slice(0,10)}.csv`);
}

// Reused by the Bills register export (F4): generic array-to-CSV download with no blob leak.
// Every CSV ends with a blank row and the APH licence attribution (LEG-03), a
// single-cell row so spreadsheet tools still parse the table above it.
function buildCSV(headers, rows) {
  return [headers, ...rows, [], [APH_ATTRIBUTION]].map(r => r.map(csvEscape).join(",")).join("\n");
}

function exportRowsCSV(headers, rows, filename) {
  const csv = buildCSV(headers, rows);
  let url = "";
  try {
    const blob = new Blob([csv], { type: "text/csv" });
    url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

function copyText(text, toast, ok = "Copied to clipboard") {
  return copyToClipboard(text)
    .then(() => toast(ok, "brass"))
    .catch(() => toast("Clipboard unavailable: content not copied", "error"));
}

function copyLiveActionNote(kind, toast) {
  const note = [
    `# Parliament Pulse live action note`,
    `Type: ${kind}`,
    `Stream: APH live stream (AUSParliamentLive; one channel for every chamber)`,
    `Captured: ${new Date().toISOString()}`,
    ``,
    `Source links:`,
    `- AUSParliamentLive: https://www.youtube.com/@AUSParliamentLive/streams`,
    `- ParlView: https://www.aph.gov.au/News_and_Events/Watch_Read_Listen/ParlView/`,
    `- Hansard: https://www.aph.gov.au/Parliamentary_Business/Hansard`,
  ].join("\n");
  return copyText(note, toast, `${kind} note copied`);
}

function copyBacklogRequest(name, note, toast) {
  const text = [
    `# Parliament Pulse backlog request`,
    `Capability: ${name}`,
    `Reason: ${note}`,
    `Requested: ${new Date().toISOString()}`,
  ].join("\n");
  return copyText(text, toast, "Backlog request copied");
}

function downloadBriefingQueue(briefs, toast) {
  const ok = exportRowsCSV(
    ["type", "for", "status"],
    briefs.map(b => [b.type, b.for, b.status]),
    `parliament-pulse-briefing-queue-${new Date().toISOString().slice(0,10)}.csv`,
  );
  if (toast) toast(ok ? "Briefing queue CSV downloaded" : "CSV export unavailable", ok ? "brass" : "error");
}


// Accepts a URL only when it is http(s) AND points at an aph.gov.au host (or a
// subdomain such as parlview.aph.gov.au). The licence contract requires every
// rendered live link to target the APH source, so a non-APH or malformed URL
// resolves to "" and the caller falls back to the source label, never a bare title.
function safeHttpUrl(u) {
  const url = String(u || "").trim();
  if (!/^https?:\/\//i.test(url)) return "";
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (host === "aph.gov.au" || host.endsWith(".aph.gov.au")) ? url : "";
  } catch {
    return "";
  }
}
