"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

// Registers the KinOS service worker (/firebase-messaging-sw.js) and keeps
// installed PWAs on the latest build without forcing an uninstall.
//
// Why this exists: installed Android WebAPKs boot through a standalone shell
// that expects a valid service worker at the registered scope. The worker is
// served by an App Router route handler and combines the PWA caching logic
// (network-first for pages, so a fresh deploy can never serve a stale shell)
// with Firebase Cloud Messaging background handling — one root-scope
// registration.
//
// How updates flow:
//   1. The served worker embeds a unique-per-deploy build id (see
//      app/firebase-messaging-sw.js/route.js), so its bytes change on every
//      deploy and browsers install the fresh worker.
//   2. Because this is a SPA, navigations never trigger the browser's
//      automatic update check — we force one on mount, on window focus, and
//      on a timer so a deploy during a long-lived session still arrives.
//   3. The worker calls skipWaiting() itself, so the new worker activates and
//      claims the page (controllerchange) as soon as it installs.
//   4. If we spot the new worker while it's still waiting, we show "Update
//      available. Tap to refresh." — tapping posts SKIP_WAITING (for older
//      workers that don't skip on install) and reloads. If the takeover
//      happens silently first, we reload automatically so the fresh build is
//      what the user actually sees.
export default function PWAUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // In dev every server restart gets a new build id; auto-reloading on each
    // change would be disruptive, so only the tap-to-refresh path applies.
    const isDev = process.env.NODE_ENV === "development";

    let disposed = false;
    let reloaded = false; // guard: reload at most once per update
    let toastShown = false;
    let hadActiveWorker = false; // true when an update replaced a live worker
    let sawUpdate = false; // true when a new worker was detected installing

    const reloadOnce = () => {
      if (disposed || reloaded) return;
      reloaded = true;
      window.location.reload();
    };

    const showUpdateToast = (waitingWorker) => {
      if (disposed || toastShown) return;
      toastShown = true;
      toast(
        <button
          type="button"
          onClick={() => {
            // Old workers without skipWaiting-on-install need a nudge to
            // activate; the served worker listens for this message.
            if (waitingWorker && waitingWorker.state === "installed") {
              waitingWorker.postMessage({ type: "SKIP_WAITING" });
            }
            reloadOnce();
          }}
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          Update available. Tap to refresh.
        </button>,
        { id: "kinos-update-available", duration: Infinity }
      );
    };

    async function register() {
      try {
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/", updateViaCache: "none" }
        );
        if (disposed) return;

        // A deploy landed while this page was already open and the new worker
        // is already waiting to take over.
        hadActiveWorker = !!registration.active;
        if (registration.waiting) {
          sawUpdate = true;
          showUpdateToast(registration.waiting);
        }

        // Watch for a new worker installing alongside the active one.
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          sawUpdate = true;
          newWorker.addEventListener("statechange", () => {
            // "installed" = the new worker is ready but waiting for activation
            // (only reachable when it didn't skipWaiting on install itself).
            if (newWorker.state === "installed" && registration.active) {
              showUpdateToast(newWorker);
            }
          });
        });

        // The new worker took over (skipWaiting + clients.claim). If the user
        // hasn't been prompted yet, load the new build automatically. Skipped
        // on first install (no previous worker to have replaced) and in dev.
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (disposed || isDev) return;
          if (hadActiveWorker && sawUpdate && !toastShown) {
            reloadOnce();
          }
        });
      } catch (err) {
        // Registration is best-effort — never let it take down the app.
        console.warn("[KinOS] Service worker registration failed:", err);
      }
    }

    // Force an update check. In a SPA the browser only auto-checks on hard
    // navigations, which rarely happen after install — without this, deployed
    // changes would sit unnoticed until the user manually refreshed.
    const checkForUpdates = () => {
      navigator.serviceWorker
        .getRegistration()
        .then((registration) => {
          if (!registration) return;
          registration.update().catch(() => {});
          // update() is async; the new worker may already be waiting by the
          // time we look, so check the waiting slot too.
          if (registration.waiting) {
            sawUpdate = true;
            showUpdateToast(registration.waiting);
          }
        })
        .catch(() => {});
    };

    register();
    checkForUpdates();
    window.addEventListener("focus", checkForUpdates);
    const interval = setInterval(checkForUpdates, 30 * 60 * 1000);

    return () => {
      disposed = true;
      window.removeEventListener("focus", checkForUpdates);
      clearInterval(interval);
    };
  }, []);

  return null;
}
