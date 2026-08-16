// Serves the KinOS service worker at /firebase-messaging-sw.js.
//
// One worker does BOTH jobs — the PWA caching that public/sw.js used to do
// AND Firebase Cloud Messaging background handling. They must share a single
// root-scope registration: registering a second service worker at scope "/"
// would silently REPLACE the first and break caching (and vice versa).
//
// The Firebase config is injected from env at request time, so the values
// never live in source code. Config is public by design (it's the same object
// the browser already receives on every page load), but only the fields FCM
// needs are included.
//
// Env vars it reads (same ones the app already uses, plus none new):
//   NEXT_PUBLIC_FIREBASE_API_KEY
//   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
//   NEXT_PUBLIC_FIREBASE_PROJECT_ID
//   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
//   NEXT_PUBLIC_FIREBASE_APP_ID

export const dynamic = "force-dynamic"; // read env at request time, not build time
export const runtime = "nodejs";

const FCM_SDK_VERSION = "10.14.1"; // must match the firebase version in package.json

const CACHING_WORKER = `
const CACHE_NAME = "kinos-shell-v5";

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
`;

const FCM_WORKER = (configJson) => `
// ---------- Firebase Cloud Messaging (background push) ----------
const FIREBASE_CONFIG = ${configJson};
const FCM_SDK_VERSION = "${FCM_SDK_VERSION}";

if (FIREBASE_CONFIG) {
  importScripts(
    "https://www.gstatic.com/firebasejs/" + FCM_SDK_VERSION + "/firebase-app-compat.js"
  );
  importScripts(
    "https://www.gstatic.com/firebasejs/" + FCM_SDK_VERSION + "/firebase-messaging-compat.js"
  );

  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  // Runs when a push message arrives while the app is closed / backgrounded.
  // payload.data mirrors the message's data field, which the Cloud Function
  // populates with the click-through URL.
  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const title = (payload.notification && payload.notification.title) || data.title || "KinOS reminder";
    const body = (payload.notification && payload.notification.body) || data.body || "";
    return self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192-v2.png",
      badge: "/icons/icon-192-v2.png",
      vibrate: [200, 100, 200],
      tag: data.medicationId || "kinos-reminder", // same dose replaces, never stacks
      data: Object.assign({ url: "/medications" }, data),
    });
  });
}

// Clicking a reminder opens (or focuses + navigates) the app to the
// Medications page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/medications";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const target = windows.find((w) => "focus" in w);
      if (target) {
        const current = new URL(target.url).pathname;
        return (current === url ? Promise.resolve() : target.navigate(url)).then(() =>
          target.focus()
        );
      }
      return clients.openWindow(url);
    })
  );
});
`;

export async function GET() {
  const env = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const hasFullConfig = Object.values(env).every((v) => typeof v === "string" && v.length > 0);
  const configJson = hasFullConfig
    ? JSON.stringify(env)
    : "null";

  // Deploy fingerprint. The browser only installs a new service worker when
  // the script bytes change, so embedding a unique-per-deploy id here is what
  // lets installed PWAs pick up new releases without a reinstall. Stable
  // within a deployment (never a per-request timestamp, which would make every
  // update check look like a new version and cause reload churn).
  const deployId =
    process.env.NEXT_PUBLIC_KINOS_BUILD_ID ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "local-dev";
  const deployMarker = `\n// Deploy id: ${JSON.stringify(deployId)} — changes on every deploy.\n`;

  const sw = deployMarker + CACHING_WORKER + "\n" + FCM_WORKER(configJson);

  return new Response(sw, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Revalidate on every check so a new deploy (new script bytes) is
      // picked up promptly; the worker is small and cheap to re-fetch.
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
