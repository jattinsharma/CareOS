"use client";

import { useEffect } from "react";

// Service worker is DISABLED during beta to prevent stale-cache crashes on
// installed PWAs. The app now always loads fresh from the network — no offline
// support, but no risk of a stale cached shell either.
// Re-enable later (e.g. after moving to next-pwa) once deploys stabilize.
export default function PWAUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Actively remove any previously registered worker so EXISTING installs
    // don't keep serving a stale cached shell. Renaming sw.js alone can't do
    // this — an already-registered worker survives until it is unregistered
    // or the browser storage is cleared.
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        // allSettled so a single failure can't surface as an unhandled
        // rejection and so we can report how many were removed.
        Promise.allSettled(registrations.map((r) => r.unregister())).then(
          (results) => {
            const removed = results.filter((r) => r.status === "fulfilled" && r.value).length;
            console.log(
              `[KinOS] Service worker disabled for reliability (removed ${removed} of ${registrations.length} registration(s))`
            );
          }
        )
      )
      .catch((err) => {
        console.error("[KinOS] Failed to remove service worker:", err);
      });
  }, []);

  return null;
}
