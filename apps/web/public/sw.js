// Parliament Pulse service worker.
// Strategy: cache-first for the app shell (HTML, JS, CSS, images), with a
// stale-while-revalidate fallback for static assets. RSS proxy responses are
// NEVER cached here — the Worker already handles 5-min KV cache. This SW
// only exists so the user can open the app while offline (mobile/train).

const VERSION = "pp-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never cache cross-origin requests (RSS proxy, YouTube, APH).
  if (url.origin !== self.location.origin) return;

  // Never cache API-style requests (no JSON or POST).
  if (e.request.method !== "GET") return;

  // App shell: cache first, falling back to network and updating in background.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request)
        .then((res) => {
          if (res.ok && url.pathname.match(/\.(js|css|svg|png|webp|webmanifest|html)$/)) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached ?? fetched;
    }),
  );
});
