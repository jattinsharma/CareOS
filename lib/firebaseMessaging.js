// Client-side Firebase Cloud Messaging helpers.
//
// Flow: request browser permission -> register the FCM service worker ->
// mint a web push token -> persist it (plus the user's IANA timezone) on
// /users/{uid} so the scheduled reminder Cloud Function can target this
// device at the correct LOCAL dose time.
//
// Platform support: FCM web push works on Chrome (desktop + Android), Edge,
// and Firefox (desktop). It is NOT supported on iOS Safari — the app reports
// that gracefully instead of failing silently.
//
// Every step logs to the browser console with a [KinOS FCM] prefix so the
// exact point of failure is visible in DevTools instead of failing silently:
//   FCM supported: true/false
//   SW registered: <scope>
//   Token generated: <first 24 chars…>   or   Token error: <error>
//   Token saved to Firestore /users/<uid>

import {
  getMessaging,
  getToken,
  deleteToken,
  isSupported,
  onMessage,
  onTokenRefresh,
} from "firebase/messaging";
import { db } from "./firebase";
import { doc, setDoc, getDoc, deleteField } from "firebase/firestore";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// Combined service worker (PWA caching + FCM background handling), served by
// the App Router route handler at app/firebase-messaging-sw.js/route.js so the
// Firebase config is injected from env at request time.
const SW_PATH = "/firebase-messaging-sw.js";

let messagingInstance = null;
let swRegistrationPromise = null;

function log(...args) {
  console.log("[KinOS FCM]", ...args);
}

function logError(...args) {
  console.error("[KinOS FCM]", ...args);
}

function getMessagingInstance() {
  if (typeof window === "undefined") return null;
  if (!messagingInstance) messagingInstance = getMessaging();
  return messagingInstance;
}

// Register once per page load, then WAIT for the worker to be ACTIVE.
// navigator.serviceWorker.ready only resolves once a worker is controlling
// the page — getToken against an installing/waiting worker fails with a
// generic "push service error", a classic silent token failure. The promise
// is reset on failure so a later attempt can retry.
function registerServiceWorker() {
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker
      .register(SW_PATH, { scope: "/" })
      .then(async (registration) => {
        log(`SW registered: ${registration.scope}`);
        await navigator.serviceWorker.ready;
        return registration;
      })
      .catch((err) => {
        logError("SW registration failed:", err);
        swRegistrationPromise = null; // allow retry on next call
        throw err;
      });
  }
  return swRegistrationPromise;
}

export async function isMessagingSupported() {
  if (typeof window === "undefined") return false;
  try {
    const ok = await isSupported();
    log(`FCM supported: ${ok}`);
    return ok;
  } catch (err) {
    logError("isSupported() threw:", err);
    return false;
  }
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

async function persistUserPrefs(uid, patch) {
  await setDoc(doc(db, "users", uid), patch, { merge: true });
}

// Reads the user's stored notification prefs. Never throws — failures log
// and return empty defaults so the caller can decide what to do.
export async function getNotificationPrefs(uid) {
  if (typeof window === "undefined") return { fcmToken: null, notificationsEnabled: null };
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.exists() ? snap.data() : {};
    return {
      fcmToken:
        typeof data.fcmToken === "string" && data.fcmToken.length > 0
          ? data.fcmToken
          : null,
      notificationsEnabled:
        typeof data.notificationsEnabled === "boolean"
          ? data.notificationsEnabled
          : null,
    };
  } catch (err) {
    logError("Couldn't read stored notification prefs:", err);
    return { fcmToken: null, notificationsEnabled: null };
  }
}

async function mintAndPersistToken(user) {
  const registration = await registerServiceWorker();
  const token = await getToken(getMessagingInstance(), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Couldn't get a push token — please try again.");

  log(`Token generated: ${token.slice(0, 24)}…`);
  const timezone = browserTimezone();
  await persistUserPrefs(user.uid, {
    fcmToken: token,
    notificationsEnabled: true,
    ...(timezone ? { timezone } : {}),
  });
  log(`Token saved to Firestore /users/${user.uid}`);
  return token;
}

// Auto-run on login: if the browser permission is ALREADY granted and no
// token is stored yet, mint + save one without showing the prompt. Skips when
// the user explicitly disabled notifications. Returns
// { permission, token, alreadyEnabled }.
export async function ensureNotificationsEnabled(user) {
  if (!user) throw new Error("You must be signed in to enable notifications.");
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { permission: "unsupported", token: null, alreadyEnabled: false };
  }
  if (!(await isMessagingSupported())) {
    return { permission: "unsupported", token: null, alreadyEnabled: false };
  }

  if (Notification.permission !== "granted") {
    // Permission "default" (never asked) is owned by the prompt; "denied"
    // is owned by Profile Settings. Nothing to do here.
    log(`Permission is "${Notification.permission}" — no auto token setup`);
    return { permission: Notification.permission, token: null, alreadyEnabled: false };
  }

  const prefs = await getNotificationPrefs(user.uid);
  if (prefs.fcmToken) {
    log(`Token already stored for ${user.uid} — skipping`);
    return { permission: "granted", token: prefs.fcmToken, alreadyEnabled: true };
  }
  if (prefs.notificationsEnabled === false) {
    log("Notifications were explicitly disabled — skipping auto setup");
    return { permission: "granted", token: null, alreadyEnabled: false };
  }
  if (!VAPID_KEY) {
    logError("VAPID key missing (NEXT_PUBLIC_FIREBASE_VAPID_KEY) — cannot mint token");
    return { permission: "granted", token: null, alreadyEnabled: false };
  }

  try {
    const token = await mintAndPersistToken(user);
    return { permission: "granted", token, alreadyEnabled: false };
  } catch (err) {
    logError("Token error:", err);
    throw err;
  }
}

// Full enable flow (used by the prompt button and Profile Settings). Returns
// { permission, token } on success; throws a descriptive Error for the UI.
export async function enableNotifications(user) {
  if (!user) throw new Error("You must be signed in to enable notifications.");
  if (typeof window === "undefined" || !("Notification" in window)) {
    throw new Error("This browser does not support notifications.");
  }
  if (!(await isMessagingSupported())) {
    throw new Error(
      "Push notifications aren't supported in this browser yet (works on Android Chrome and desktop Chrome/Edge/Firefox)."
    );
  }
  if (!VAPID_KEY) {
    throw new Error("FCM VAPID key is not configured (NEXT_PUBLIC_FIREBASE_VAPID_KEY).");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    // Remember the choice so the reminder function stops considering this
    // device (Profile Settings has a re-enable path).
    await persistUserPrefs(user.uid, { notificationsEnabled: false }).catch(() => {});
    log(`Permission ${permission} — token NOT generated`);
    return { permission };
  }

  try {
    const token = await mintAndPersistToken(user);
    return { permission, token };
  } catch (err) {
    logError("Token error:", err);
    throw err;
  }
}

export async function disableNotifications(user) {
  if (!user || typeof window === "undefined") return;
  const m = getMessagingInstance();
  if (m) {
    try {
      await deleteToken(m);
      log("Token deleted");
    } catch {
      // The token may already be gone — ignore.
    }
  }
  await persistUserPrefs(user.uid, {
    fcmToken: deleteField(),
    notificationsEnabled: false,
  }).catch(() => {});
  log("Notifications disabled for", user.uid);
}

// Subscribe to messages delivered while the app is OPEN (foreground). FCM
// only auto-displays notifications when the tab is closed or backgrounded —
// in the foreground the page must handle them itself. Returns an unsubscribe
// function.
export function onForegroundMessage(callback) {
  if (typeof window === "undefined") return () => {};
  try {
    return onMessage(getMessagingInstance(), callback);
  } catch (err) {
    logError("onMessage failed:", err);
    return () => {};
  }
}

// The browser periodically rotates the FCM token (and does so when the push
// subscription changes). When that happens, re-mint the token and persist it
// on /users/{uid} so the reminder function keeps targeting this device.
// Attach this once per session (e.g. alongside ensureNotificationsEnabled).
// Returns an unsubscribe function. Never throws — failures log and the stale
// token just stops receiving pushes until the next refresh.
export function attachTokenRefreshListener(user, { onToken } = {}) {
  if (typeof window === "undefined" || !user) return () => {};
  try {
    return onTokenRefresh(getMessagingInstance(), async () => {
      log("Token refresh event — re-minting");
      try {
        const registration = await registerServiceWorker();
        const token = await getToken(getMessagingInstance(), {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration,
        });
        if (!token) throw new Error("refresh produced no token");
        await persistUserPrefs(user.uid, { fcmToken: token });
        log(`Refreshed token saved to Firestore /users/${user.uid}`);
        onToken?.(token);
      } catch (err) {
        logError("Token refresh failed:", err);
      }
    });
  } catch (err) {
    logError("Couldn't attach token refresh listener:", err);
    return () => {};
  }
}
