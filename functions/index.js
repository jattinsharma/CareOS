// Scheduled medication-reminder notifications.
//
// Runs every minute. For each user with a registered FCM web push token it
// computes the CURRENT local time (IANA timezone stored on /users/{uid} by the
// client), finds their medications scheduled for exactly that HH:MM, skips
// doses already logged "taken" today (or off-schedule per the med's
// frequency), and pushes one FCM notification per dose — to the PATIENT's
// device (the med's ownerUid), even when a caregiver added the med.
//
// One notification per dose per day: the /notifications/{medId}_{date} doc is
// the "sent" marker, so an untaken dose isn't re-nagged every minute.
//
// Deployment requirements (flag these):
//   - Cloud Functions + Cloud Scheduler need the Blaze (pay-as-you-go) plan.
//   - FCM web push is not supported on iOS Safari (works on Android Chrome
//     and desktop Chrome/Edge/Firefox).

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

const FREQUENCY_LABELS = {
  Daily: "Daily",
  "Twice daily": "Twice daily",
  "every-2-days": "Every 2 days",
  "every-3-days": "Every 3 days",
  Weekly: "Weekly",
  "As needed": "As needed",
};

const DAY_MS = 24 * 60 * 60 * 1000;

// "22:30" -> "10:30 PM" (mirrors lib/medUtils.formatTime12h)
function formatTime12h(time24) {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

// 'yyyy-MM-dd' key in the given IANA timezone (en-CA formats as ISO).
function dateKeyInTz(tz, date) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return null;
  }
}

// The med's creation date as a 'yyyy-MM-dd' key in the patient's timezone
// (mirrors lib/streak.createdAtKey, but tz-aware).
function createdAtKey(med, tz) {
  if (!med?.createdAt) return null;
  const d = new Date(med.createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return dateKeyInTz(tz, d);
}

// True if the med is scheduled (required) on the given local date — mirrors
// lib/streak.isScheduledOn so the function and the app agree day-for-day.
function isScheduledOn(med, dateKey, tz) {
  if (!med) return false;
  const start = createdAtKey(med, tz);
  if (!start || dateKey < start) return false;
  const freq = med.frequency;
  if (freq === "Daily" || freq === "Twice daily") return true;
  const diff = Math.round(
    (new Date(dateKey + "T12:00:00") - new Date(start + "T12:00:00")) / DAY_MS
  );
  if (freq === "every-2-days") return diff % 2 === 0;
  if (freq === "every-3-days") return diff % 3 === 0;
  if (freq === "Weekly") {
    return (
      new Date(dateKey + "T12:00:00").getDay() ===
      new Date(start + "T12:00:00").getDay()
    );
  }
  return false; // "As needed" is never required
}

// Current local "HH:MM" in the given IANA timezone (24-hour, zero-padded).
function localTimeHHMM(tz, now = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const hour = parts.find((p) => p.type === "hour")?.value || "00";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    return `${hour === "24" ? "00" : hour}:${minute}`;
  } catch {
    return null;
  }
}

exports.checkMedicationReminders = onSchedule("every 1 minutes", async () => {
  const now = new Date();

  // 1. Every user with a registered token + timezone, keyed by uid, plus a
  //    map of local "HH:MM" -> user uids so we run ONE medications query per
  //    distinct time instead of one per user.
  const users = new Map();
  const byTime = new Map();
  let noTimezone = 0;

  const usersSnap = await db.collection("users").get();
  for (const snap of usersSnap.docs) {
    const data = snap.data();
    if (!data.fcmToken || data.notificationsEnabled === false) continue;
    if (!data.timezone) {
      // The client saves the timezone with the token; until it does, we can't
      // know the patient's local time, so skip rather than fire at the wrong
      // moment.
      noTimezone++;
      continue;
    }
    users.set(snap.id, data);
    const hhmm = localTimeHHMM(data.timezone, now);
    if (!hhmm) continue;
    const list = byTime.get(hhmm) || [];
    list.push(snap.id);
    byTime.set(hhmm, list);
  }

  if (users.size === 0) {
    logger.info(`checkMedicationReminders: no token-bearing users (noTimezone=${noTimezone})`);
    return;
  }

  let sent = 0;
  let skippedTaken = 0;
  let skippedOffSchedule = 0;
  let skippedAlreadySent = 0;
  let failed = 0;
  const sentKeys = new Set(); // in-run dedup (defensive)

  for (const [hhmm, userIds] of byTime) {
    const medSnap = await db
      .collection("medications")
      .where("times", "==", hhmm)
      .get();
    if (medSnap.empty) continue;

    for (const medDoc of medSnap.docs) {
      const med = medDoc.data();

      // The recipient is the PATIENT (ownerUid), not whoever added the med —
      // the caregiver scenario from the spec.
      const patientUid = med.ownerUid || med.createdBy;
      const patient = users.get(patientUid);
      if (!patient) continue; // patient's device isn't registered for push

      // A med matching this query batch's HH:MM is only due for THIS patient
      // when their own local clock also reads HH:MM right now (same med can
      // surface in another timezone's batch).
      if (localTimeHHMM(patient.timezone, now) !== hhmm) continue;

      const dateKey = dateKeyInTz(patient.timezone, now);
      if (!dateKey) continue;

      // Respect the med's schedule (every-2-days / weekly / etc.).
      if (!isScheduledOn(med, dateKey, patient.timezone)) {
        skippedOffSchedule++;
        continue;
      }

      // Already marked taken today?
      const takenToday = (med.logs || []).some(
        (l) => l && l.date === dateKey && l.taken
      );
      if (takenToday) {
        skippedTaken++;
        continue;
      }

      // One push per dose per day — the notifications doc is the sent marker.
      const notifId = `${medDoc.id}_${dateKey}`;
      if (sentKeys.has(notifId)) continue;
      const notifRef = db.doc(`notifications/${notifId}`);
      const existing = await notifRef.get();
      if (existing.exists) {
        skippedAlreadySent++;
        continue;
      }

      const title = `Time for your ${med.name || "medication"}`;
      const label = FREQUENCY_LABELS[med.frequency] || med.frequency || "";
      const timeLabel = formatTime12h(med.times);
      const body = [
        med.dosage ? String(med.dosage) : "",
        label ? `${label} at ${timeLabel}` : timeLabel,
      ]
        .filter(Boolean)
        .join(" • ");

      try {
        await messaging.send({
          token: patient.fcmToken,
          notification: { title, body },
          data: {
            url: "/medications",
            medicationId: medDoc.id,
            dateKey,
          },
          webpush: {
            notification: {
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
              vibrate: [200, 100, 200],
            },
          },
        });
        await notifRef.set({
          userId: patientUid,
          medicationId: medDoc.id,
          title,
          body,
          date: dateKey,
          sentAt: FieldValue.serverTimestamp(),
          read: false,
        });
        sentKeys.add(notifId);
        sent++;
        logger.info(`Sent reminder "${title}" to ${patientUid}`);
      } catch (err) {
        failed++;
        const code = err?.errorInfo?.code || err?.code || "";
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-argument"
        ) {
          // Token is stale — drop it so we stop trying a dead device.
          await db
            .doc(`users/${patientUid}`)
            .update({ fcmToken: FieldValue.delete() })
            .catch(() => {});
          users.delete(patientUid);
          logger.warn(`Dropped stale FCM token for ${patientUid}`);
        } else {
          logger.error(`send failed for ${medDoc.id}: ${code || err.message}`);
        }
      }
    }
  }

  logger.info(
    `checkMedicationReminders: sent=${sent} skippedTaken=${skippedTaken} ` +
      `skippedOffSchedule=${skippedOffSchedule} skippedAlreadySent=${skippedAlreadySent} ` +
      `failed=${failed} noTimezone=${noTimezone}`
  );
});
