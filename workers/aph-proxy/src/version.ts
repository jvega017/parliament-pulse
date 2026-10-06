// The single declaration of the Worker version. /healthz serves it as
// `version` and /state serves it as `meta.worker_version`, so a post-deploy
// probe can tell the new Worker from the old one. tests/version.test.mjs
// asserts both served values equal package.json "version"; bump the two
// together.
export const WORKER_VERSION = "0.16.9";

// The /state KV cache key carries the version, so a body cached by the
// previous Worker (TTL 5 minutes) is never served, with the old version in
// its meta, after a deploy. "v2" is the WK-04 per-feed-quota shape.
export const STATE_CACHE_KEY = `state:v2:${WORKER_VERSION}`;
