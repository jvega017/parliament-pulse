// Screenshot capture for the design critic (FE-09). Not a test: it writes
// full-page PNGs of every NAV desk, the signal drawer and one modal, in dark and
// light, at 1280 and 390 CSS px, into tests/browser/out/<label>/ (gitignored).
//
// Run: node tests/browser/capture.mjs <label>        e.g. pre-fix, post-fix
// Builds dist/ with build-dist.ps1 and serves it through the FE-07 harness, so
// every screenshot is of the exact allowlisted build that would be deployed,
// answered from tests/fixtures/. Old shots under the same label are deleted
// first, so a folder never mixes two builds.

import fs from "node:fs";
import path from "node:path";
import { launch, openDesk, navDesks, root } from "./harness.mjs";

const label = process.argv[2] || "capture";
const outDir = path.join(root, "tests", "browser", "out", label);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const WIDTHS = [1280, 390];
// .signal uses content-visibility: auto, which leaves off-screen cards unpainted in
// a full-page screenshot although a reader scrolling the page sees them. Paint them
// for the capture only, so the critic judges what a reader sees.
const PAINT_ALL = ".signal { content-visibility: visible !important; }";
const settle = async page => { await page.addStyleTag({ content: PAINT_ALL }); await page.waitForTimeout(150); };
const THEMES = ["dark", "light"];
const h = await launch();
const written = [];
try {
  const page = await h.newPage();
  await openDesk(page, "overview");
  const desks = await navDesks(page);
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      for (const d of desks) {
        await openDesk(page, d.id, { theme, width });
        await settle(page);
        const f = path.join(outDir, `${d.id}-${theme}-${width}.png`);
        await page.screenshot({ path: f, fullPage: true });
        written.push(f);
      }
      // Signal drawer: open the first card on the Signal inbox.
      await openDesk(page, "signals", { theme, width });
      await page.click(".signal[role=button]");
      await page.waitForSelector("aside.drawer.on");
      await page.waitForTimeout(400);
      let f = path.join(outDir, `drawer-${theme}-${width}.png`);
      await page.screenshot({ path: f });
      written.push(f);
      // One modal: the first feed row on Sources.
      await openDesk(page, "sources", { theme, width });
      await page.click("table.ds tbody tr[data-feed-row], table.ds tbody tr");
      await page.waitForSelector(".modal", { timeout: 5000 });
      await page.waitForTimeout(400);
      f = path.join(outDir, `modal-${theme}-${width}.png`);
      await page.screenshot({ path: f });
      written.push(f);
    }
  }
  if (page.pageErrors.length) console.log(`page errors:\n  ${page.pageErrors.join("\n  ")}`);
} finally {
  await h.close();
}
console.log(`wrote ${written.length} screenshots to ${path.relative(root, outDir)}`);
