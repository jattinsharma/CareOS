"use client";

import { useAuth } from "@/components/AuthProvider";
import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  attachTokenRefreshListener,
  enableNotifications,
  ensureNotificationsEnabled,
  isMessagingSupported,
  onForegroundMessage,
} from "@/lib/firebaseMessaging";

// Polite, one-time permission request. Appears after login (mounted in the
// Navbar, so it shows on every page) until the user answers. If denied, the
// path back lives in Profile Settings → Medication reminders.
//
// Also subscribes to FOREGROUND push messages: FCM only auto-displays
// notifications when the tab is closed/backgrounded, so while the app is open
// this surfaces reminders as toasts.
export default function NotificationPrompt() {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [checking, setChecking] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    isMessagingSupported().then((ok) => {
      if (!active) return;
      setSupported(ok);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Foreground push -> toast (independent of the prompt's own visibility).
  useEffect(() => {
    if (!user || !supported) return;
    return onForegroundMessage((payload) => {
      const title = payload?.notification?.title || payload?.data?.title;
      const body = payload?.notification?.body || payload?.data?.body;
      if (!title) return;
      toast(body ? `${title} — ${body}` : title, { icon: "🔔" });
    });
  }, [user, supported]);

  // Auto token setup on login: when the browser permission is ALREADY
  // "granted" (asked on a previous visit), the prompt below never shows — so
  // mint + save the FCM token here instead. Idempotent: skips if a token is
  // already stored or the user explicitly disabled notifications. Failures
  // are logged to the console, never silent.
  useEffect(() => {
    if (!user || !supported) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }
    ensureNotificationsEnabled(user).catch((err) => {
      console.error(
        "[KinOS FCM] Auto token setup failed:",
        err?.message || err
      );
    });
  }, [user, supported]);

  // The browser rotates the FCM token periodically — keep the stored token on
  // /users/{uid} fresh so reminders keep arriving. Attached for the whole
  // session (this component mounts in the Navbar) and cleaned up on unmount.
  useEffect(() => {
    if (!user || !supported) return undefined;
    return attachTokenRefreshListener(user);
  }, [user, supported]);

  // Only nudge when the browser has never been asked (permission "default").
  // Already granted or denied -> the Profile Settings toggle owns the state.
  const show =
    !!user &&
    supported &&
    !checking &&
    !dismissed &&
    !busy &&
    typeof Notification !== "undefined" &&
    Notification.permission === "default";

  async function handleEnable() {
    setBusy(true);
    try {
      const res = await enableNotifications(user);
      setDismissed(true);
      if (res.permission === "granted") {
        toast.success("Medication reminders enabled!");
      } else {
        toast.error(
          "Notifications are blocked. You can re-enable them anytime from Profile Settings."
        );
      }
    } catch (err) {
      setDismissed(true);
      toast.error(err?.message || "Couldn't enable notifications");
    } finally {
      setBusy(false);
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-40">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/70 p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-rose-500" />
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss notification prompt"
            className="p-1.5 -m-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <h3 className="text-sm font-semibold text-slate-900">
          Enable medication reminders?
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          We&apos;ll nudge you when it&apos;s time for a dose — even when KinOS
          is closed.
        </p>
        <div className="flex gap-2.5 mt-4">
          <button
            onClick={() => setDismissed(true)}
            disabled={busy}
            className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            Not now
          </button>
          <button
            onClick={handleEnable}
            disabled={busy}
            className="flex-1 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            {busy ? "Enabling…" : "Allow notifications"}
          </button>
        </div>
      </div>
    </div>
  );
}
