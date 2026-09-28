// npm run gate (after npm run build): run every local truth gate in order and
// stop at the first failure. The production probe is deliberately NOT here: it
// hits the network and the deployed site, so it runs as `npm run probe`.
import path from "node:path";
import { spawnSync } from "node:child_process";
import { root } from "./build-config.mjs";

const GATES = [
  "tests/fabrication-selftest.test.mjs",
  "tests/release-gate.mjs",
  "tests/asset-manifest.test.mjs",
  "tests/a11y.test.mjs",
  "tests/beta-contract.test.mjs",
  "tests/matching.test.mjs",
  "tests/state-contract.test.mjs",
  "tests/honest-surfaces.test.mjs",
  "tests/unsourced-surfaces.test.mjs",
];

for (const g of GATES) {
  console.log(`\n=== ${g} ===`);
  const r = spawnSync(process.execPath, [path.join(root, g)], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\nGATE FAILED: ${g} exited ${r.status}.`);
    process.exit(1);
  }
}
console.log(`\nALL GATES PASSED (${GATES.length}).`);
