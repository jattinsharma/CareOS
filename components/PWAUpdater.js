"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

// Registers the CareOS service worker and watches for updates. When a new
// version installs (sw.js byte-differs from the active one), it tells the new
// worker to skip waiting, shows a toast, and reloads after 2 seconds so the
// user always ends up on the latest code without manually closing the app.
export default function PWAUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloadTimer = null;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener("statechange", () => {
              // "installed" + an existing controller means this is an update,
              // not the very first install (no controller on first load).
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                newWorker.postMessage({ type: "SKIP_WAITING" });
                // Duration matches the 2s reload delay so the toast stays
                // visible until the page refreshes.
                toast("Update available — refreshing...", { duration: 2000 });
                reloadTimer = setTimeout(() => window.location.reload(), 2000);
              }
            });
          });
        })
        .catch((err) => {
          console.error("Service worker registration failed:", err);
        });
    };

    window.addEventListener("load", register);
    return () => {
      window.removeEventListener("load", register);
      if (reloadTimer) clearTimeout(reloadTimer);
    };
  }, []);

  return null;
}
