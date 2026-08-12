/* KinOS Service Worker — network-first caching strategy. */
// v2.0.0 — SAFE version: pages are ALWAYS fetched from the network first, so a
// deploy can never serve a stale HTML shell (the crash that disabled v1).
// Only content-hashed /_next/static assets are served from cache first.
// No HTML precaching at install time — caches are filled lazily on demand.
// Bump CACHE_NAME on every functional change.

const CACHE_NAME = "kinos-shell-v4";

self.addEventListener("install", () => {
  // Intentionally precache NOTHING. The old worker cached shell HTML at
  // install, which survived deploys and crashed the app on stale chunks.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Client asks the new worker to take over immediately (belt-and-suspenders
// with the skipWaiting() call in install above).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only intercept GET requests.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip API calls entirely (e.g. /api/remind).
  if (url.pathname.startsWith("/api/")) return;

  // Skip Firebase / Google API traffic (auth, Firestore, storage, etc.).
  if (
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firebase.google.com")
  ) {
    return;
  }

  // Build assets under /_next/static are content-hashed and immutable:
  // serve from cache first, falling back to the network on a miss.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else (HTML pages, manifest, icons): network-first so the
  // latest deploy always wins, with the cache as an offline fallback.
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful same-origin responses for offline use.
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request, { ignoreSearch: true }).then((cached) => {
          if (cached) return cached;
          // Offline navigation falls back to the cached home shell.
          if (request.mode === "navigate") {
            return caches.match("/");
          }
          return Response.error();
        })
      )
  );
});
