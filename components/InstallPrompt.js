"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Share2, Smartphone, X } from "lucide-react";

const DISMISS_KEY = "kinos-install-dismissed-at";
const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const IOS_DELAY_MS = 2000;

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports a Mac user agent.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    // Already installed — running as a standalone PWA (Android/desktop)
    // or added to the iOS home screen.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    // Respect a dismissal within the last 7 days.
    try {
      const dismissedAt = parseInt(localStorage.getItem(DISMISS_KEY) || "", 10);
      if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_WINDOW_MS) {
        return;
      }
    } catch {
      // localStorage unavailable — ignore.
    }

    const onBeforeInstallPrompt = (event) => {
      // Prevent the browser's default mini-infobar so we can show our own banner.
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };

    // If the user installs through the browser's own UI, hide the banner.
    const onAppInstalled = () => setVisible(false);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    // iOS Safari never fires `beforeinstallprompt`, so fall back to manual
    // instructions (Share → Add to Home Screen) after a short delay.
    if (isIOS()) {
      setIsIos(true);
      const timer = setTimeout(() => setVisible(true), IOS_DELAY_MS);
      return () => {
        window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
        window.removeEventListener("appinstalled", onAppInstalled);
        clearTimeout(timer);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setVisible(false);
    } catch {
      // User closed the prompt dialog — leave the banner up.
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignore storage failures.
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[100] sm:inset-x-auto sm:right-6 sm:bottom-6 animate-slide-in-up">
      <div className="relative mx-auto w-full max-w-sm rounded-2xl bg-white p-4 pr-10 shadow-2xl ring-1 ring-slate-200 sm:mx-0">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-rose-500 shadow-sm shadow-rose-200">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Install KinOS</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Add KinOS to your home screen for quick access.
            </p>
          </div>
        </div>

        {isIos ? (
          <>
            <button
              type="button"
              onClick={() => setShowSteps((s) => !s)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white shadow-sm shadow-rose-200 transition-colors hover:bg-rose-600 active:bg-rose-700"
            >
              <Share2 className="h-4 w-4" />
              How to install
            </button>
            {showSteps && (
              <ol className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <li>
                  <span className="font-semibold text-slate-800">1.</span> Tap the
                  Share button <Share2 className="inline h-3 w-3" /> in Safari.
                </li>
                <li>
                  <span className="font-semibold text-slate-800">2.</span> Choose{" "}
                  <span className="font-medium text-slate-700">“Add to Home Screen”</span>.
                </li>
                <li>
                  <span className="font-semibold text-slate-800">3.</span> Tap Add,
                  then launch KinOS from your Home Screen.
                </li>
              </ol>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={handleInstall}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white shadow-sm shadow-rose-200 transition-colors hover:bg-rose-600 active:bg-rose-700"
          >
            <Download className="h-4 w-4" />
            Install App
          </button>
        )}
      </div>
    </div>
  );
}
