import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicFiles = [
  "shell.jsx", "pages.jsx", "store.jsx", "data.jsx", "entities.jsx",
  "shell.js", "pages.js", "store.js", "data.js", "entities.js",
];

const publicDemoPatterns = [
  /\bDemo mode\b/i,
  /\bDemo data\b/i,
  /\bdemo control\b/i,
  /\bdemo\b/i,
  /\(demo\)/i,
  /\bfixture demonstration data\b/i,
  /\bFixture data only\b/i,
  /Minister [XY] \(fixture\)/,
];

for (const file of publicFiles) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const pattern of publicDemoPatterns) {
    assert.equal(
      pattern.test(text),
      false,
      `${file} still contains public placeholder wording matching ${pattern}`,
    );
  }
}

const shell = fs.readFileSync(path.join(root, "shell.jsx"), "utf8");
const builtShell = fs.readFileSync(path.join(root, "shell.js"), "utf8");
assert.match(shell, /BetaNotice/, "Shell should expose a beta notice component");
assert.match(shell, /Live beta\./, "Beta notice should describe live beta status");
assert.match(builtShell, /BetaNotice/, "Built shell.js should include the beta notice component");
assert.match(shell, /copyToClipboard/, "Shell clipboard actions should use the safe copy helper");
assert.match(shell, /safeGetLocalStorage/, "Shell storage reads should use the safe storage helper");

const pages = fs.readFileSync(path.join(root, "pages.jsx"), "utf8");
const builtPages = fs.readFileSync(path.join(root, "pages.js"), "utf8");
assert.match(pages, /copyLiveActionNote/, "Live controls should copy concrete action notes");
assert.match(pages, /downloadBriefingQueue/, "Briefings queue should export local queue state");
assert.match(pages, /BetaReadinessPanel/, "Overview should explain beta evidence status");
assert.match(pages, /What is live, what is representative, and what activates next/, "Overview should include explicit live vs representative content");
assert.match(pages, /ProvenanceStackPanel/, "Overview should include source-to-decision provenance content");
assert.match(pages, /ProvenanceMetricsBand/, "Overview should include provenance metrics content");
assert.match(pages, /CoverageActivationMatrix/, "Overview should include module coverage and activation content");
assert.match(pages, /copyBetaHandoff/, "Overview should provide a copyable beta handoff");
assert.match(pages, /copyActivationPlan/, "Overview should provide a copyable activation plan");
assert.match(builtPages, /CoverageActivationMatrix/, "Built pages.js should include module coverage and activation content");
assert.match(builtPages, /copyActivationPlan/, "Built pages.js should include copyable activation plan");
assert.doesNotMatch(pages, /Sitting day/, "Overview should not hard-code sitting-day status");
assert.doesNotMatch(pages, /LIVE NOW/, "Overview should not label representative chamber text as live now");

assert.match(shell, /side-status/, "Sidebar should include system status content");

const styles = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(styles, /beta-ledger/, "Styles should include the beta evidence ledger treatment");
assert.match(styles, /provenance-stack/, "Styles should include the provenance stack treatment");
assert.match(styles, /provenance-metrics/, "Styles should include provenance metrics treatment");
assert.match(styles, /coverage-matrix/, "Styles should include coverage matrix treatment");
assert.match(styles, /side-status/, "Styles should include sidebar status treatment");
assert.match(styles, /grid-template-columns: auto minmax\(0, 1fr\)/, "Mobile topbar should avoid squeezing the search input");
