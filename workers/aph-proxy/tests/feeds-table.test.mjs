// WK-08 (ARCH-13): src/jurisdictions.json is the single feed source and every
// documented feed table is generated from it. Calls the verdict function
// checkDoc() itself, on the real documents and on seeded bad specimens.
//
// Run: node tests/feeds-table.test.mjs
//
// Canary-first: the bad-specimen tests run before the real-document test and
// must each be caught, and the restraint test proves a correct document passes.
// Measured to fail when the control is removed (scratch copy, 29 Sep 2026):
// making checkDoc() skip the table comparison fails the three table canaries
// (3 of 8); a hand edit of one label in a scratch README fails the
// real-document test; a src/dup.ts repeating a feed URL fails the
// no-duplicate test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  checkDoc,
  renderFeedsTable,
  replaceBlock,
  loadConfig,
  DOC_PATHS,
  WORKER_DIR,
  START_MARKER,
  END_MARKER,
} from "../scripts/feeds-table.mjs";

const config = loadConfig();
const good = `# Doc\n\n${START_MARKER}\n${renderFeedsTable(config)}\n${END_MARKER}\n\nTail.\n`;

function clone(c) {
  return JSON.parse(JSON.stringify(c));
}

test("canary: a document missing one configured feed is caught", () => {
  const fewer = clone(config);
  fewer.aph.feeds.pop();
  const stale = `${START_MARKER}\n${renderFeedsTable(fewer)}\n${END_MARKER}\n`;
  const v = checkDoc(stale, config, "canary-missing-feed");
  assert.equal(v.ok, false);
  assert.match(v.problems.join(" "), /differs/);
});

test("canary: a relabelled feed is caught", () => {
  const relabelled = clone(config);
  relabelled.aph.feeds[0].label = "Invented feed label";
  const stale = `${START_MARKER}\n${renderFeedsTable(relabelled)}\n${END_MARKER}\n`;
  assert.equal(checkDoc(stale, config, "canary-label").ok, false);
});

test("canary: an '8 feeds' claim in the table header is caught", () => {
  const bad = good.replace(`${config.aph.feeds.length} configured feeds`, "8 configured feeds");
  assert.notEqual(bad, good, "specimen actually mutated");
  assert.equal(checkDoc(bad, config, "canary-count").ok, false);
});

test("canary: missing markers are caught", () => {
  const v = checkDoc("# No table here\n", config, "canary-markers");
  assert.equal(v.ok, false);
  assert.match(v.problems[0], /markers missing/);
});

test("restraint: a correct generated document passes, CRLF included", () => {
  assert.deepEqual(checkDoc(good, config, "good"), { ok: true, problems: [] });
  assert.equal(checkDoc(good.replace(/\n/g, "\r\n"), config, "good-crlf").ok, true);
  assert.equal(replaceBlock(good, config), good, "replaceBlock is idempotent on a good document");
});

test("the root README, STATUS.md and Worker README agree with jurisdictions.json", () => {
  for (const p of DOC_PATHS) {
    const v = checkDoc(readFileSync(p, "utf8"), config, p);
    assert.deepEqual(v.problems, [], p);
  }
});

const FEED_URLS = config.aph.feeds.map((f) => f.url);

function duplicateFeedLiterals(dir) {
  const hits = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (name === "jurisdictions.json") continue;
      const text = readFileSync(p, "utf8");
      for (const u of FEED_URLS) if (text.includes(u)) hits.push(`${name}: ${u}`);
    }
  };
  walk(dir);
  return hits;
}

test("canary: a duplicated feed URL literal in a seeded directory is caught", () => {
  const d = mkdtempSync(join(tmpdir(), "pp-feeds-"));
  try {
    writeFileSync(join(d, "jurisdictions.json"), "{}");
    writeFileSync(join(d, "copy.ts"), `const u = "${FEED_URLS[2]}";\n`);
    assert.equal(duplicateFeedLiterals(d).length, 1);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test("no configured feed URL is duplicated as a literal elsewhere in src", () => {
  assert.equal(new Set(FEED_URLS).size, FEED_URLS.length, "feed URLs unique within jurisdictions.json");
  assert.deepEqual(duplicateFeedLiterals(resolve(WORKER_DIR, "src")), [], "feed URLs appear only in src/jurisdictions.json");
});
