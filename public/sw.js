/* CareOS Service Worker — network-first caching strategy. */

const CACHE_NAME = "careos-shell-v1";

// App shell pages to precache at install time.
const SHELL_URLS = [
  "/",
  "/dashboard",
  "/family",
  "/medications",
  "/calendar",
  "/vault",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // Cache each shell URL individually so one failure can't abort install;
        // any gaps are filled lazily by the fetch handler on first visit.
        Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
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

  // Everything else: network-first, with cache fallback when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful same-origin responses (shell HTML + other assets).
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
