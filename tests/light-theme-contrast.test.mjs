// Light-theme contrast and house-style canary (DS-043, Ledger Instrument variant).
// Exit 0 = pass, 1 = fail.
//
// Reads the tokens:begin / tokens:end block of index.html, resolves every custom
// property of the light theme (:root plus :root[data-theme="light"]) through var()
// and color-mix(in srgb, ...), composites translucent values over the surface they
// sit on, and measures each pair with the WCAG 2.x relative-luminance formula.
//
//   text  4.5:1 or above (every text token on every light surface, plus the
//         chips, badges, buttons and the brief preview that sit on tints)
//   ui    3:1 or above (control edges, focus and accent rules, status dots)
//   brand the light theme's sheet, ground and the brief preview resolve to the
//         cool sheet family (#FBFBFC / #EFEFF0); no warm-cream paper literal
//         (#F8F5EE family) is left anywhere in index.html; the light desk accent
//         is bronze, never the rust ember #A23B1C.
//
// Canaries (in-memory copies; the working tree is never touched):
//   formula   black on white measures 21.00; ink on sheet 19.45 (manifest value)
//   detect    gilt as the light link, rule as the light control edge, cream as
//             the light panel, ember as the light accent: each must be caught
//   restraint the real index.html must pass
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML = fs.readFileSync(path.join(root, "index.html"), "utf8");

// ---- colour maths -----------------------------------------------------------
const hexToRgba = h => {
  let s = h.slice(1);
  if (s.length === 3) s = [...s].map(c => c + c).join("");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16), 1];
};
const toHex = c => "#" + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (fg, bg) => { const a = fg[3]; return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)).concat(1); };

// color-mix(in srgb, A p%, B [q%]) with premultiplied alpha, as CSS Color 5 defines it.
function mix(a, pa, b, pb) {
  if (pa == null && pb == null) { pa = 50; pb = 50; }
  else if (pa == null) pa = 100 - pb;
  else if (pb == null) pb = 100 - pa;
  const sum = pa + pb, wa = pa / sum, wb = pb / sum;
  const alpha = a[3] * wa + b[3] * wb;
  if (alpha === 0) return [0, 0, 0, 0];
  const ch = [0, 1, 2].map(i => (a[i] * a[3] * wa + b[i] * b[3] * wb) / alpha);
  return ch.concat(alpha * Math.min(1, sum / 100));
}

// ---- token parsing ------------------------------------------------------------
function tokenBlock(html) {
  const s = html.indexOf("/* tokens:begin"), e = html.indexOf("/* tokens:end */");
  if (s < 0 || e < s) throw new Error("index.html has no tokens:begin / tokens:end block");
  return html.slice(s, e).replace(/\/\*[\s\S]*?\*\//g, "");
}
function ruleBody(css, selectorRe) {
  const m = selectorRe.exec(css);
  if (!m) return "";
  let i = css.indexOf("{", m.index) + 1, depth = 1, j = i;
  while (depth && j < css.length) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
  return css.slice(i, j - 1);
}
const decls = body => Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));

export function lightVars(html) {
  const css = tokenBlock(html);
  const base = decls(ruleBody(css, /:root\s*\{/));
  const light = decls(ruleBody(css, /:root\[data-theme="light"\]\s*\{/));
  if (!Object.keys(light).length) throw new Error('no :root[data-theme="light"] block inside the tokens block');
  return { ...base, ...light };
}

function splitArgs(s) {
  const out = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++; else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
export function resolver(vars) {
  const memo = {};
  const val = (expr, seen = []) => {
    expr = expr.trim();
    if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(expr)) return hexToRgba(expr);
    if (expr === "transparent") return [0, 0, 0, 0];
    let m = /^var\((--[\w-]+)\)$/.exec(expr);
    if (m) return get(m[1], seen);
    m = /^color-mix\(in srgb,\s*([\s\S]+)\)$/.exec(expr);
    if (m) {
      const [a, b] = splitArgs(m[1]).map(part => {
        const pm = /^([\s\S]+?)\s+(\d+(?:\.\d+)?)%$/.exec(part);
        return pm ? [val(pm[1], seen), +pm[2]] : [val(part, seen), null];
      });
      return mix(a[0], a[1], b[0], b[1]);
    }
    throw new Error(`cannot resolve colour expression: ${expr}`);
  };
  const get = (name, seen = []) => {
    if (name in memo) return memo[name];
    if (seen.includes(name)) throw new Error(`var cycle at ${name}`);
    if (!(name in vars)) throw new Error(`undefined custom property ${name}`);
    return (memo[name] = val(vars[name], [...seen, name]));
  };
  return { get, val };
}

// ---- the measured pairs ---------------------------------------------------------
export function measure(html) {
  const vars = lightVars(html);
  const { get, val } = resolver(vars);
  const opaque = n => { const c = get(n); if (c[3] < 1) throw new Error(`${n} is not opaque`); return c; };
  const S = {
    "bg": opaque("--bg"),
    "bg-2 (sidebar)": opaque("--bg-2"),
    "panel": opaque("--panel"),
    "panel-2": opaque("--panel-2"),
  };
  S["table head (soft over panel)"] = over(get("--soft-surface"), S.panel);
  S["topbar (over bg)"] = over(get("--topbar-bg"), S.bg);
  // The active nav row lifts to the sheet in the light theme. Read that from the
  // stylesheet rather than assume it: a different background is a parse failure.
  const navRule = /\[data-theme="light"\] \.nav-item\.active \{\s*background:\s*([^;]+);/.exec(html);
  if (!navRule) throw new Error('no [data-theme="light"] .nav-item.active background rule');
  const activeNav = over(val(navRule[1]), S["bg-2 (sidebar)"]);
  const highCard = over(val("color-mix(in srgb, var(--ember-flash) 7%, var(--panel))"), S.panel);
  const pairs = [];
  const add = (kind, fgName, fg, bgName, bg) => pairs.push({ kind, fg: fgName, bg: bgName, fgHex: toHex(over(fg, bg)), bgHex: toHex(bg), r: ratio(over(fg, bg), bg) });

  for (const t of ["--ink", "--ink-2", "--ink-3", "--ink-4", "--link", "--brass", "--gold", "--ok", "--caution", "--escalate", "--info"])
    for (const [bn, bc] of Object.entries(S)) add("text", t, get(t), bn, bc);
  for (const t of ["--control-edge", "--brass", "--att-high", "--caution", "--ok"])
    for (const [bn, bc] of Object.entries(S)) add("ui", t, get(t), bn, bc);

  add("text", "--brass-ink (primary button)", get("--brass-ink"), "--brass", get("--brass"));
  add("text", "--brass-ink (primary button)", get("--brass-ink"), "--brass-2 (button gradient start)", over(get("--brass-2"), S.panel));
  for (const t of ["--ink", "--ink-2", "--ink-3", "--ink-4", "--ok", "--caution"]) add("text", t, get(t), "active nav", activeNav);
  add("ui", "--brass (active nav rule)", get("--brass"), "active nav", activeNav);
  const countBg = over(val("color-mix(in srgb, var(--brass) 12%, transparent)"), activeNav);
  add("text", "--brass-2 (active nav count)", get("--brass-2"), "bronze 12% over active nav", countBg);
  add("text", "--brass-2 (filter chip, beta next)", get("--brass-2"), "bronze 10% over panel", over(val("color-mix(in srgb, var(--brass) 10%, transparent)"), S.panel));
  add("text", "--brass (live chip)", get("--brass"), "bronze 8% over panel", over(val("color-mix(in srgb, var(--brass) 8%, transparent)"), S.panel));
  // The two contexts axe found on 7 Oct: an accent chip on the sidebar ground with
  // a hover wash under it, and a link on a hover row over the ground.
  const sideHover = over(get("--hover-surface"), S["bg-2 (sidebar)"]);
  add("text", "--brass (chip on sidebar hover)", get("--brass"), "bronze 8% over hover over bg-2", over(val("color-mix(in srgb, var(--brass) 8%, transparent)"), sideHover));
  add("text", "--brass (match count)", get("--brass"), "panel-hi over hover over bg-2", over(get("--panel-hi"), sideHover));
  add("text", "--link (hover row)", get("--link"), "hover over bg-2", sideHover);
  const attHighBg = over(val("color-mix(in srgb, var(--att-high) 10%, transparent)"), highCard);
  const ruleColour = sel => {
    const r = new RegExp(`\\[data-theme="light"\\] ${sel} \\{ color:\\s*([^;]+);`).exec(html);
    if (!r) throw new Error(`no [data-theme="light"] ${sel} colour rule`);
    return val(r[1]);
  };
  add("text", ".att.high (light rule)", ruleColour("\\.att\\.high"), "neg 10% over high card", attHighBg);
  add("text", "--ink (high card)", get("--ink"), "high card", highCard);
  const medBg = over(val("color-mix(in srgb, var(--caution) 10%, transparent)"), S["table head (soft over panel)"]);
  add("text", ".att.med (light rule)", ruleColour("\\.att\\.med"), "warn 10% over table head", medBg);
  add("text", "--info (derived chip)", get("--info"), "panel-hi over panel", over(get("--panel-hi"), S.panel));
  const brief = get("--brief-bg");
  for (const t of ["--brief-ink", "--brief-accent", "--brief-link"]) add("text", t, get(t), "--brief-bg", brief);

  return { vars, get, S, pairs };
}

const CREAM = ["#f8f5ee", "#f1ece0", "#ece6d8", "#d7cfbe", "#b7af9c", "#1b1812", "#433e35", "#5c5547", "#6e6757"];
const SHEET_FAMILY = ["#FBFBFC", "#EFEFF0"];

export function check(html) {
  const f = [];
  let m;
  try { m = measure(html); } catch (e) { return { f: [`parse: ${e.message}`], pairs: [] }; }
  for (const p of m.pairs) {
    const need = p.kind === "text" ? 4.5 : 3;
    if (p.r < need) f.push(`${p.kind}: ${p.fg} ${p.fgHex} on ${p.bg} ${p.bgHex} measures ${p.r.toFixed(2)}:1, under ${need}:1`);
  }
  for (const n of ["--panel", "--bg", "--brief-bg"]) {
    const h = toHex(m.get(n));
    if (!SHEET_FAMILY.includes(h)) f.push(`brand: light ${n} resolves to ${h}, outside the cool sheet family ${SHEET_FAMILY.join(" / ")}`);
  }
  const lower = html.toLowerCase();
  for (const c of CREAM) if (lower.includes(c)) f.push(`brand: index.html still carries the warm-cream literal ${c.toUpperCase()}`);
  const accent = toHex(m.get("--brass"));
  if (accent === "#A23B1C") f.push("brand: the light desk accent is the rust ember #A23B1C; the house style puts bronze there");
  return { f, pairs: m.pairs };
}

// ---- canaries ------------------------------------------------------------------
const canaryFail = [];
const near = (a, b) => Math.abs(a - b) < 0.01;
if (!near(ratio([0, 0, 0, 1], [255, 255, 255, 1]), 21)) canaryFail.push("formula: black on white is not 21.00");
if (!near(+ratio(hexToRgba("#06070D"), hexToRgba("#FBFBFC")).toFixed(2), 19.45)) canaryFail.push("formula: ink on sheet is not the manifest's 19.45");

const lightStart = HTML.indexOf(':root[data-theme="light"] {');
const setLight = (name, value) => {
  const body = HTML.slice(lightStart);
  const re = new RegExp(`(${name}:\\s*)[^;]+;`);
  if (!re.test(body)) throw new Error(`canary cannot find ${name} in the light block`);
  return HTML.slice(0, lightStart) + body.replace(re, `$1${value};`);
};
const detect = [
  ["gilt as the light link", setLight("--link", "#D9B779"), /text: --link/],
  ["rule as the light control edge", setLight("--control-edge", "#D5D7DB"), /ui: --control-edge/],
  ["cream as the light panel", setLight("--panel", "#F8F5EE"), /brand: light --panel resolves to #F8F5EE|warm-cream literal #F8F5EE/],
  ["ember as the light accent", setLight("--brass", "#A23B1C"), /rust ember/],
];
for (const [why, html, expect] of detect) {
  const r = check(html);
  if (!r.f.some(x => expect.test(x))) canaryFail.push(`detect: ${why} was not caught (${r.f.length} other finding(s))`);
}
// A canary failure does not stop the real run: both verdicts print, so a failure
// names the real defect as well as the instrument's state.
if (canaryFail.length) console.error("LIGHT CONTRAST CANARY FAILED:\n  " + canaryFail.join("\n  "));
else console.log(`canary OK: formula (21.00, 19.45) and ${detect.length} seeded defects caught`);

// ---- real run ----------------------------------------------------------------
const real = check(HTML);
const rows = real.pairs.slice().sort((a, b) => a.r - b.r);
console.log("\nkind  ratio   fg -> bg");
for (const p of rows) console.log(`${p.kind.padEnd(5)} ${p.r.toFixed(2).padStart(6)}  ${p.fg} ${p.fgHex} on ${p.bg} ${p.bgHex}`);
if (real.f.length || canaryFail.length) {
  if (real.f.length) console.error(`\nLIGHT CONTRAST: FAILED (${real.f.length})\n  ` + real.f.join("\n  "));
  else console.error("\nLIGHT CONTRAST: FAILED (the canary above did not prove detection)");
  process.exit(1);
}
const t = rows.filter(p => p.kind === "text"), u = rows.filter(p => p.kind === "ui");
console.log(`\nLIGHT CONTRAST: PASSED. ${t.length} text pairs (lowest ${t[0].r.toFixed(2)}:1), ${u.length} UI pairs (lowest ${u[0].r.toFixed(2)}:1); light ground, panel and brief preview on the cool sheet family; no warm-cream literal; bronze desk accent.`);
