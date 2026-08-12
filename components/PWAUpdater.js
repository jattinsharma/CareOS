"use client";

import { useEffect } from "react";

// Registers the KinOS service worker (public/sw.js).
//
// Why this exists: installed Android WebAPKs boot through a standalone shell
// that expects a valid service worker at the registered scope. When sw.js
// returned 404 (during the "disable SW for stability" phase), Chrome kept a
// stale registration on devices, so launching the installed app failed with
// "KinOS failed to start" while the browser tab worked fine.
//
// The worker itself is network-first for pages, so a fresh deploy can never
// serve a stale shell — no offline-cache crash risk.
export default function PWAUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let disposed = false;

    async function register() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        if (disposed) return;

        // If a newer worker is waiting to activate (new deploy landed), tell
        // it to take over immediately so the next load uses the fresh build.
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch (err) {
        // Registration is best-effort — never let it take down the app.
        console.warn("[KinOS] Service worker registration failed:", err);
      }
    }

    // Re-check for updates when the page regains focus so a deploy during a
    // long-lived session still gets picked up without a manual refresh.
    const onFocus = () => {
      navigator.serviceWorker
        .getRegistration()
        .then((registration) => {
          if (!registration) return;
          // Force Chrome to byte-compare sw.js with the deployed copy, then
          // let a waiting (new) worker activate immediately.
          registration.update().catch(() => {});
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        })
        .catch(() => {});
    };

    register();
    window.addEventListener("focus", onFocus);

    return () => {
      disposed = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}
