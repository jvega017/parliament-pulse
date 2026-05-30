// Simple, consistent stroke icons.
// Stroke weight is uniform across every glyph so the set reads as one family.
// Bumped from 1.6 to 1.75 to sit confidently against the bolder Fire House shell;
// override per-icon with a strokeWidth prop where a lighter weight is wanted.
const Icon = ({ name, size = 16, stroke = "currentColor", strokeWidth = 1.75, ...rest }) => {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", focusable: "false", ...rest };
  switch (name) {
    case "overview": return <svg {...props}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>;
    case "signal": return <svg {...props}><path d="M4 12h3l3-8 4 16 3-8h3"/></svg>;
    case "sources": return <svg {...props}><circle cx="6" cy="18" r="2"/><path d="M4 4c8 0 14 6 14 14"/><path d="M4 10c4 0 8 4 8 8"/></svg>;
    case "committee": return <svg {...props}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3"/><path d="M3 13h18"/></svg>;
    case "bill": return <svg {...props}><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h7"/></svg>;
    case "parliament": return <svg {...props}><path d="M3 10l9-6 9 6"/><path d="M5 10v8M9 10v8M13 10v8M17 10v8"/><path d="M3 20h18"/></svg>;
    case "brief": return <svg {...props}><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M8 12h8"/></svg>;
    case "watch": return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/></svg>;
    case "radar": return <svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><path d="M12 3v9l6 3"/></svg>;
    case "pattern": return <svg {...props}><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 7l4 9M17 7l-4 9"/></svg>;
    case "search": return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case "close": return <svg {...props}><path d="M6 6l12 12M6 18L18 6"/></svg>;
    case "link": return <svg {...props}><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>;
    case "bell": return <svg {...props}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>;
    case "check": return <svg {...props}><path d="M5 12l5 5L20 7"/></svg>;
    case "plus": return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case "chevron": return <svg {...props}><path d="M9 6l6 6-6 6"/></svg>;
    case "filter": return <svg {...props}><path d="M3 5h18M6 12h12M10 19h4"/></svg>;
    case "refresh": return <svg {...props}><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>;
    case "download": return <svg {...props}><path d="M12 3v13"/><path d="M7 12l5 5 5-5"/><path d="M4 21h16"/></svg>;
    case "ext": return <svg {...props}><path d="M14 4h6v6"/><path d="M20 4L10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>;
    case "clock": return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "flag": return <svg {...props}><path d="M4 21V4"/><path d="M4 4h13l-2 4 2 4H4"/></svg>;
    case "book": return <svg {...props}><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/></svg>;
    case "moon": return <svg {...props}><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>;
    case "sun":  return <svg {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>;
    // --- Redesign additions (Fire House re-skin) ---
    // Stat-trend slot: ember up, steel-ash down. Caller sets the stroke colour.
    case "trend-up":   return <svg {...props}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h6v6"/></svg>;
    case "trend-down": return <svg {...props}><path d="M3 7l6 6 4-4 8 8"/><path d="M14 17h6v-6"/></svg>;
    case "trend-flat": return <svg {...props}><path d="M3 12h14"/><path d="M14 8l4 4-4 4"/></svg>;
    // Live-pulse glyph: a broadcasting dot for the LIVE badge and live-strip.
    // The slow ember-pulse is driven by CSS on the wrapping element, not here.
    case "live-pulse": return <svg {...props}><circle cx="12" cy="12" r="2.5" fill={stroke} stroke="none"/><path d="M7.5 16.5a6 6 0 0 1 0-9"/><path d="M16.5 7.5a6 6 0 0 1 0 9"/><path d="M4.7 19.3a10 10 0 0 1 0-14.6"/><path d="M19.3 4.7a10 10 0 0 1 0 14.6"/></svg>;
    // Command-strip hero glyph: a pulse/activity line inside a frame, for the dominant KPI tile.
    case "command":    return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 14h4l2-5 3 8 2-4h7"/></svg>;
    // Hero KPI accent: an upward spark for the count-up headline number.
    case "spark":      return <svg {...props}><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>;
    // Secondary hero stats: activity (throughput) and gauge (attention level).
    case "activity":   return <svg {...props}><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>;
    case "gauge":      return <svg {...props}><path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-5"/><circle cx="12" cy="18" r="1.2" fill={stroke} stroke="none"/></svg>;
    default: return <svg {...props}><circle cx="12" cy="12" r="9"/></svg>;
  }
};

Object.assign(window, { Icon });
