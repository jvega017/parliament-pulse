// Regenerates tests/brand-hex-allowlist.json from the design system's sources
// of truth (FE-09, UX-20, DS-043). The allowlist is committed so the raw-hex
// gate runs in CI, where the workspace is absent.
//
// Two sources, unioned:
//   1. 04_Templates/brand-tokens.json, the token SSOT (every hex literal).
//   2. The register-b product palettes in
//      03_Projects/Design-System/brand-book-2026-10/brand-manifest.json. The
//      house style of 7 Oct 2026 (DS-043) moved the light theme to the cool
//      sheet family (sheet, surface, rule, meta, secondary, iron, bronze,
//      copper). The SSOT does not hold that family yet (brand-home.md, known
//      limits: DS-044 registers it), so the manifest is the value source until
//      it does. Only manifest palette values are read, never its contrast table.
//
// Run after any brand-tokens or manifest bump:
//   node scripts/sync-brand-hex.mjs [tokens.json] [brand-manifest.json]
import fs from "node:fs";
import path from "node:path";
import { root } from "./build-config.mjs";

const HEXRE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;
const tokSrc = process.argv[2] || path.resolve(root, "..", "..", "04_Templates", "brand-tokens.json");
const manSrc = process.argv[3] || path.resolve(root, "..", "Design-System", "brand-book-2026-10", "brand-manifest.json");

const raw = fs.readFileSync(tokSrc, "utf8");
const tokens = JSON.parse(raw);
const manifest = JSON.parse(fs.readFileSync(manSrc, "utf8"));

const fromTokens = [...raw.matchAll(HEXRE)].map(m => m[0].toLowerCase());
const fromManifest = [];
for (const p of Object.values(manifest.products || {})) {
  if (p.register !== "b" || !p.palette) continue;
  for (const v of Object.values(p.palette)) {
    for (const m of String(v).matchAll(HEXRE)) fromManifest.push(m[0].toLowerCase());
  }
}
if (!fromManifest.length) throw new Error(`no register-b palette hex found in ${manSrc}`);

const hex = [...new Set([...fromTokens, ...fromManifest])].sort();
const out = {
  _note: "Every hex literal in 04_Templates/brand-tokens.json plus every register-b product palette value in brand-manifest.json. tests/copy-gates.test.mjs accepts a hex in index.html only inside the tokens:begin/tokens:end block (or a theme-color meta) and only if it is listed here. Regenerate with node scripts/sync-brand-hex.mjs; never hand-edit.",
  source: "04_Templates/brand-tokens.json",
  version: tokens.version,
  manifest_source: "03_Projects/Design-System/brand-book-2026-10/brand-manifest.json",
  manifest_version: manifest.version,
  hex,
};
fs.writeFileSync(path.join(root, "tests", "brand-hex-allowlist.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`brand-hex-allowlist.json: ${hex.length} literals from brand-tokens ${tokens.version} and manifest ${manifest.version}`);
