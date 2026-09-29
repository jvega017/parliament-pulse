// Regenerates tests/brand-hex-allowlist.json from the design system's single
// source of truth, 04_Templates/brand-tokens.json (FE-09, UX-20). The allowlist
// is committed so the raw-hex gate runs in CI, where the workspace is absent.
// Run after any brand-tokens bump: node scripts/sync-brand-hex.mjs [path]
import fs from "node:fs";
import path from "node:path";
import { root } from "./build-config.mjs";

const src = process.argv[2] || path.resolve(root, "..", "..", "04_Templates", "brand-tokens.json");
const raw = fs.readFileSync(src, "utf8");
const tokens = JSON.parse(raw);
const hex = [...new Set([...raw.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)].map(m => m[0].toLowerCase()))].sort();
const out = {
  _note: "Every hex literal in 04_Templates/brand-tokens.json. tests/copy-gates.test.mjs accepts a hex in index.html only inside the tokens:begin/tokens:end block (or a theme-color meta) and only if it is listed here. Regenerate with node scripts/sync-brand-hex.mjs; never hand-edit.",
  source: "04_Templates/brand-tokens.json",
  version: tokens.version,
  hex,
};
fs.writeFileSync(path.join(root, "tests", "brand-hex-allowlist.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`brand-hex-allowlist.json: ${hex.length} literals from brand-tokens ${tokens.version}`);
