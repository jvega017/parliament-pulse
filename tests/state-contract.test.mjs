// Contract test for the Worker's composed GET /state endpoint (schema "state-v1").
// Pure node, no network: validates the shape of a sample payload and asserts the
// degraded (fixture) path never fabricates content. Mirrors the assertion style
// of beta-contract.test.mjs.
import assert from "node:assert/strict";

const ALLOWED_PROVENANCE = new Set(["live", "derived", "fixture"]);
const BLOCK_KEYS = {
  signals: "items",
  connectors: "checks",
  alerts: "events",
  qons: "items",
};

// A realistic sample payload, as the Worker would compose it (workers/aph-proxy/src/state.ts).
const samplePayload = {
  meta: { generated_at: "2026-07-10T00:00:00.000Z", worker_version: "0.13.0", schema: "state-v1" },
  blocks: {
    signals: {
      provenance: "live",
      fetched_at: "2026-07-10T00:00:00.000Z",
      origin: "d1:parliament-pulse-archive",
      items: [
        {
          guid: "aph-1", title: "Example signal", link: "https://www.aph.gov.au/example",
          pub_date: "2026-07-09T22:00:00.000Z", feed_label: "House Media Releases",
          source_group: "House", kind: "signal", attention: "high", confidence: 3,
          scoring_explanation: "High attention (72/100).",
        },
      ],
    },
    connectors: {
      provenance: "live", fetched_at: "2026-07-10T00:00:00.000Z", origin: "d1:parliament-pulse-archive",
      checks: [{ url: "https://www.aph.gov.au/house/rss/media_releases", checked_at: "2026-07-09T00:00:00.000Z", ok: 1, status: 200, error: null }],
    },
    alerts: {
      provenance: "fixture", fetched_at: "2026-07-10T00:00:00.000Z", origin: "d1:parliament-pulse-archive",
      events: [], note: "alert_events table returned no rows",
    },
    qons: {
      provenance: "fixture", fetched_at: "2026-07-10T00:00:00.000Z", origin: "d1:parliament-pulse-archive",
      items: [], note: "qons table returned no rows",
    },
  },
};

function assertBlockShape(name, block, collectionKey) {
  assert.ok(block && typeof block === "object", `${name} block must be an object`);
  assert.ok(ALLOWED_PROVENANCE.has(block.provenance), `${name}.provenance must be one of live|derived|fixture, got ${block.provenance}`);
  assert.equal(typeof block.fetched_at, "string", `${name}.fetched_at must be an ISO string`);
  assert.equal(typeof block.origin, "string", `${name}.origin must be a string`);
  assert.ok(Array.isArray(block[collectionKey]), `${name}.${collectionKey} must be an array`);
  if (block.provenance === "fixture") {
    assert.equal(block[collectionKey].length, 0, `${name} degraded to fixture must carry an empty ${collectionKey} array, not placeholder content`);
    assert.equal(typeof block.note, "string", `${name} degraded to fixture must carry a note explaining why`);
  }
}

// ---- meta -------------------------------------------------------------------
assert.equal(samplePayload.meta.schema, "state-v1", "meta.schema must be the literal state-v1");
assert.equal(typeof samplePayload.meta.generated_at, "string", "meta.generated_at must be an ISO string");
assert.equal(typeof samplePayload.meta.worker_version, "string", "meta.worker_version must be a string");

// ---- all four blocks present, each with a valid provenance and shape --------
for (const [name, collectionKey] of Object.entries(BLOCK_KEYS)) {
  assertBlockShape(name, samplePayload.blocks[name], collectionKey);
}

// ---- degraded-block shape: fixture never fabricates content -----------------
assertBlockShape("alerts", samplePayload.blocks.alerts, "events");
assert.equal(samplePayload.blocks.alerts.provenance, "fixture");
assert.equal(samplePayload.blocks.alerts.events.length, 0);
assertBlockShape("qons", samplePayload.blocks.qons, "items");
assert.equal(samplePayload.blocks.qons.provenance, "fixture");
assert.equal(samplePayload.blocks.qons.items.length, 0);

// ---- fixture fallback path: an empty or malformed signals block must resolve
// to provenance "fixture" with no items, mirroring the frontend's PageSignals
// fallback logic in pages.jsx (mapWorkerSignalToCard / liveSignals state).
function resolveSignalsProvenance(block) {
  if (block?.provenance === "live" && Array.isArray(block.items) && block.items.length > 0) {
    return { provenance: "live", items: block.items };
  }
  // Fixture renders in this branch (items stays null), so an empty "live" block must
  // resolve to "fixture" too — the chip reflects what is actually on screen.
  const fallback = (block?.provenance && block.provenance !== "live") ? block.provenance : "fixture";
  return { provenance: fallback, items: null };
}

const emptyLiveBlock = { provenance: "live", fetched_at: "2026-07-10T00:00:00.000Z", origin: "d1:parliament-pulse-archive", items: [] };
const resolvedFromEmptyLive = resolveSignalsProvenance(emptyLiveBlock);
assert.equal(resolvedFromEmptyLive.provenance, "fixture", "an empty live block must still resolve to fixture on the frontend (never render zero items as if they were the whole live set)");
assert.equal(resolvedFromEmptyLive.items, null);

const missingBlock = undefined;
const resolvedFromMissing = resolveSignalsProvenance(missingBlock);
assert.equal(resolvedFromMissing.provenance, "fixture", "a missing signals block must resolve to fixture");
assert.equal(resolvedFromMissing.items, null);

const degradedBlock = { provenance: "fixture", fetched_at: "2026-07-10T00:00:00.000Z", origin: "d1:parliament-pulse-archive", items: [], note: "signals table returned no rows" };
const resolvedFromDegraded = resolveSignalsProvenance(degradedBlock);
assert.equal(resolvedFromDegraded.provenance, "fixture");
assert.equal(resolvedFromDegraded.items, null);

console.log("state-contract.test.mjs: all assertions passed");
