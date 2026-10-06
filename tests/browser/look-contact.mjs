// Visual look at the contact surfaces (7 Oct 2026). Not a test: it opens the
// About page at 1280 and 390 CSS px, light and dark, from the deployable dist/,
// screenshots the corrections paragraph, the accessibility "Report a barrier"
// paragraph and the footer, and prints what each contact link says and where it
// points, plus whether the footer overflows the viewport.
//
// Run: PP_HARNESS_PORT=8945 PP_CANARY_PORT=8946 node tests/browser/look-contact.mjs
// Output: tests/browser/out/contact-look/ (gitignored).

import fs from "node:fs";
import path from "node:path";
import { launch, openDesk, root, PORT, PAGE_HOST } from "./harness.mjs";

const outDir = path.join(root, "tests", "browser", "out", "contact-look");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const h = await launch({ build: false });
let problems = 0;
try {
  const page = await h.newPage();
  for (const width of [1280, 390]) {
    for (const theme of ["light", "dark"]) {
      await openDesk(page, "about", { theme, width, baseUrl: `http://${PAGE_HOST}:${PORT}/` });
      await page.waitForTimeout(200);
      const links = await page.$$eval('a[href^="mailto:"]', as => as.map(a => ({ text: a.textContent.trim(), href: a.getAttribute("href"), inFooter: !!a.closest("footer") })));
      const stale = await page.evaluate(() => /being set up|no channel for reporting/i.test(document.body.innerText));
      const foot = page.locator("footer.site-foot");
      await foot.scrollIntoViewIfNeeded();
      const box = await foot.boundingBox();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const tag = `${width}-${theme}`;
      // Footer link boxes: any vertical overlap between two links is a target-size failure.
      const boxes = await page.$$eval("footer.site-foot a", as => as.map(a => { const r = a.getBoundingClientRect(); return { t: a.textContent.trim().slice(0, 14), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }));
      if (process.env.PP_DEBUG) console.log(await page.$$eval("footer.site-foot, footer.site-foot > *", els => els.map(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return `${e.tagName}.${e.className} display=${s.display} y=${Math.round(r.top)} h=${Math.round(r.height)} lh=${s.lineHeight}`; }).join("\n")));
      const overlaps = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps.push(`${a.t} / ${b.t}`);
      }
      console.log(`${width}-${theme}: footer links ${boxes.map(b => `${b.t}@${b.x},${b.y} ${b.w}x${b.h}`).join(" | ")}; overlaps: ${overlaps.join(", ") || "none"}`);
      if (overlaps.length) problems++;
      await foot.screenshot({ path: path.join(outDir, `footer-${tag}.png`) });
      const legal = page.locator("#about-legal");
      await legal.scrollIntoViewIfNeeded();
      await legal.screenshot({ path: path.join(outDir, `legal-${tag}.png`) });
      const a11y = page.locator("#about-accessibility");
      await a11y.scrollIntoViewIfNeeded();
      await a11y.screenshot({ path: path.join(outDir, `accessibility-${tag}.png`) });
      await page.screenshot({ path: path.join(outDir, `viewport-footer-${tag}.png`) });
      console.log(`${tag}: ${links.length} mailto link(s): ${links.map(l => `${l.inFooter ? "[footer] " : ""}"${l.text}" -> ${l.href}`).join("; ")}`);
      console.log(`${tag}: footer ${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "not found"}; horizontal overflow ${overflow}; stale interim text ${stale}`);
      if (links.length < 3 || !links.some(l => l.inFooter) || overflow || stale) problems++;
    }
  }
} finally {
  await h.close();
}
console.log(problems ? `CONTACT LOOK: ${problems} state(s) need attention` : `CONTACT LOOK: every state shows the contact in About and the footer; screenshots in ${outDir}`);
process.exit(problems ? 1 : 0);
