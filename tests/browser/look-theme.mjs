// Visual look at the light and dark themes (7 Oct 2026, DS-043 cool-sheet light
// theme). Not a test: it opens Overview, Bills, Committees and About at 1280 and
// 390 CSS px, light and dark, from the deployable dist/, saves a viewport and a
// full-page screenshot of each, and prints the computed ground, panel, text and
// accent colours plus whether the page overflows horizontally.
//
// Run: PP_HARNESS_PORT=8955 PP_CANARY_PORT=8956 node tests/browser/look-theme.mjs
// Output: tests/browser/out/theme-look/ (gitignored).

import fs from "node:fs";
import path from "node:path";
import { launch, openDesk, root, PORT, PAGE_HOST } from "./harness.mjs";

const outDir = path.join(root, "tests", "browser", "out", "theme-look");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const DESKS = ["overview", "bills", "committees", "about"];
const h = await launch({ build: false });
let problems = 0;
try {
  const page = await h.newPage();
  for (const desk of DESKS) {
    for (const width of [1280, 390]) {
      for (const theme of ["light", "dark"]) {
        await openDesk(page, desk, { theme, width, baseUrl: `http://${PAGE_HOST}:${PORT}/` });
        const tag = `${desk}-${width}-${theme}`;
        const info = await page.evaluate(() => {
          const cs = getComputedStyle(document.documentElement);
          const v = n => cs.getPropertyValue(n).trim();
          const panel = document.querySelector(".panel");
          return {
            theme: document.documentElement.getAttribute("data-theme"),
            body: getComputedStyle(document.body).backgroundColor,
            panel: panel ? getComputedStyle(panel).backgroundColor : "none",
            ink: getComputedStyle(document.body).color,
            brass: v("--brass"), link: v("--link"),
            overflow: document.documentElement.scrollWidth > window.innerWidth,
          };
        });
        await page.screenshot({ path: path.join(outDir, `${tag}-viewport.png`) });
        await page.screenshot({ path: path.join(outDir, `${tag}-full.png`), fullPage: true });
        console.log(`${tag}: data-theme=${info.theme} body=${info.body} panel=${info.panel} ink=${info.ink} brass=${info.brass} link=${info.link} overflow=${info.overflow}`);
        if (info.overflow || info.theme !== theme) problems++;
      }
    }
  }
} finally {
  await h.close();
}
console.log(problems ? `THEME LOOK: ${problems} state(s) need attention` : `THEME LOOK: 16 states captured, no horizontal overflow; screenshots in ${outDir}`);
process.exit(problems ? 1 : 0);
