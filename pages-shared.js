const { useState, useMemo } = React;
function csvEscape(v) {
  const text = v == null ? "" : String(v);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function exportSignalsCSV(signals) {
  const source = Array.isArray(signals) ? signals : SIGNALS;
  const headers = ["id", "date", "source", "attention", "title", "link", "action", "confidence"];
  const rows = source.map((s) => {
    var _a;
    return [
      s.id,
      s.date,
      s.source,
      s.attention || NOT_SUPPLIED,
      s.title,
      s.link || "",
      s.action,
      (_a = s.confidence) != null ? _a : NOT_SUPPLIED
    ];
  });
  exportRowsCSV(headers, rows, `parliament-pulse-signals-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`);
}
function buildCSV(headers, rows) {
  return [headers, ...rows, [], [APH_ATTRIBUTION]].map((r) => r.map(csvEscape).join(",")).join("\n");
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
  } catch (e) {
    return false;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
function copyText(text, toast, ok = "Copied to clipboard") {
  return copyToClipboard(text).then(() => toast(ok, "brass")).catch(() => toast("Clipboard unavailable: content not copied", "error"));
}
function copyLiveActionNote(kind, toast) {
  const note = [
    `# Parliament Pulse live action note`,
    `Type: ${kind}`,
    `Stream: APH live stream (AUSParliamentLive; one channel for every chamber)`,
    `Captured: ${(/* @__PURE__ */ new Date()).toISOString()}`,
    ``,
    `Source links:`,
    `- AUSParliamentLive: https://www.youtube.com/@AUSParliamentLive/streams`,
    `- ParlView: https://www.aph.gov.au/News_and_Events/Watch_Read_Listen/ParlView/`,
    `- Hansard: https://www.aph.gov.au/Parliamentary_Business/Hansard`
  ].join("\n");
  return copyText(note, toast, `${kind} note copied`);
}
function downloadBriefingQueue(briefs, toast) {
  const ok = exportRowsCSV(
    ["type", "for", "status"],
    briefs.map((b) => [b.type, b.for, b.status]),
    `parliament-pulse-briefing-queue-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`
  );
  if (toast) toast(ok ? "Briefing queue CSV downloaded" : "CSV export unavailable", ok ? "brass" : "error");
}
function safeHttpUrl(u) {
  const url = String(u || "").trim();
  if (!/^https?:\/\//i.test(url)) return "";
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "aph.gov.au" || host.endsWith(".aph.gov.au") ? url : "";
  } catch (e) {
    return "";
  }
}
