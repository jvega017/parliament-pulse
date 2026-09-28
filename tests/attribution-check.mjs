// Licence attribution check (LEG-03), called by tests/release-gate.mjs.
//
// APH web content is licensed CC BY-NC-ND 4.0, which requires attribution. This
// check proves the exact attribution sentence reaches (1) the persistent site
// footer, which app.jsx must render, and (2) every export template: the shared
// CSV builder behind every CSV download, the single-signal brief markdown and the
// daily brief. It runs over the .jsx sources AND the built .js, because Pages
// serves the .js.
//
// Canary-first, per the standing rule: before reporting on the real bundle, the
// check must FAIL on seeded copies with the footer sentence, the CSV attribution
// and the brief attribution each removed, and PASS on the unmodified bundle.

export const LICENCE_URL = "https://creativecommons.org/licenses/by-nc-nd/4.0/";
export const ATTRIBUTION_TEXT =
  "Source material: Parliament of Australia website, licensed under CC BY-NC-ND 4.0 (" + LICENCE_URL + "). " +
  "Titles reproduced unmodified; scores and summaries are Parliament Pulse analysis.";

// The two literal halves the footer must render (the licence name sits inside
// a link between them, so the full sentence is never one contiguous string).
export const FOOTER_PARTS = [
  "Source material: Parliament of Australia website, licensed under",
  "CC BY-NC-ND 4.0",
  LICENCE_URL,
  "Titles reproduced unmodified; scores and summaries are Parliament Pulse analysis.",
];

// Balanced-brace body of `function <name>(`, or null when absent. Naive about
// braces inside strings, which is adequate for these small, known functions.
export function functionBody(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) return null;
  const open = src.indexOf("{", src.indexOf(")", start));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  return null;
}

// Evaluate the APH_ATTRIBUTION declaration in data.* without running the file.
function declaredAttribution(dataSrc) {
  const url = dataSrc.match(/const APH_LICENCE_URL = "([^"]+)";/);
  const decl = dataSrc.match(/const APH_ATTRIBUTION = "([^"]*)" \+ APH_LICENCE_URL \+ "([^"]*)";/);
  if (!url || !decl) return null;
  return decl[1] + url[1] + decl[2];
}

// files: { data, shell, pages, app } source strings (all .jsx or all .js).
// Returns a list of failure strings; empty means the attribution is intact.
export function checkAttribution(files, label = "") {
  const f = [];
  const tag = label ? `[${label}] ` : "";
  const declared = declaredAttribution(files.data || "");
  if (declared !== ATTRIBUTION_TEXT) f.push(`${tag}data: APH_ATTRIBUTION is missing or differs from the required text (got ${JSON.stringify(declared)})`);

  const footer = functionBody(files.shell || "", "SiteFooter");
  if (!footer) f.push(`${tag}shell: SiteFooter component is missing`);
  else for (const part of FOOTER_PARTS) if (!footer.includes(part)) f.push(`${tag}shell: SiteFooter does not render ${JSON.stringify(part)}`);
  if (!/<SiteFooter\b|createElement\(SiteFooter\b/.test(files.app || "")) f.push(`${tag}app: the shell does not render <SiteFooter />`);

  const brief = functionBody(files.shell || "", "generateBriefMarkdown");
  if (!brief || !brief.includes("APH_ATTRIBUTION")) f.push(`${tag}shell: generateBriefMarkdown export template omits APH_ATTRIBUTION`);

  const csv = functionBody(files.pages || "", "buildCSV");
  if (!csv || !csv.includes("APH_ATTRIBUTION")) f.push(`${tag}pages: buildCSV export template omits APH_ATTRIBUTION`);
  const rowsCsv = functionBody(files.pages || "", "exportRowsCSV");
  if (!rowsCsv || !rowsCsv.includes("buildCSV(")) f.push(`${tag}pages: exportRowsCSV does not build through buildCSV`);
  const overview = functionBody(files.pages || "", "PageOverview");
  if (!overview || !overview.includes("APH_ATTRIBUTION")) f.push(`${tag}pages: daily brief template (PageOverview) omits APH_ATTRIBUTION`);
  return f;
}

// Seeded mutations the check must catch. Each returns a mutated copy.
export const ATTRIBUTION_CANARIES = [
  { why: "footer sentence removed", mutate: x => ({ ...x, shell: x.shell.split("Titles reproduced unmodified; scores and summaries are Parliament Pulse analysis.").join("") }) },
  { why: "footer licence prefix removed", mutate: x => ({ ...x, shell: x.shell.split("Source material: Parliament of Australia website, licensed under").join("Source:") }) },
  { why: "footer not rendered by the app", mutate: x => ({ ...x, app: x.app.replace(/<SiteFooter\s*\/>/g, "").replace(/React\.createElement\(SiteFooter[^)]*\)/g, "null") }) },
  { why: "CSV attribution row removed", mutate: x => {
      const body = functionBody(x.pages, "buildCSV") || "";
      return { ...x, pages: x.pages.replace(body, body.split("APH_ATTRIBUTION").join("\"\"")) };
    } },
  { why: "brief attribution removed", mutate: x => {
      const body = functionBody(x.shell, "generateBriefMarkdown") || "";
      return { ...x, shell: x.shell.replace(body, body.split("APH_ATTRIBUTION").join("\"\"")) };
    } },
  { why: "attribution text altered", mutate: x => ({ ...x, data: x.data.replace("Titles reproduced unmodified", "Titles summarised") }) },
];
