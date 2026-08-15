// Scheduled medication-reminder notifications with family escalation.
//
// Runs every minute. Scheduling is timezone-aware: each user stores their IANA
// timezone on /users/{uid} (saved by the client when they enable
// notifications), and a med's `times` ("HH:MM") is compared against the
// PATIENT's local clock — so reminders fire at the right local moment even
// when a caregiver added the med or the family spans timezones.
//
// Three stages per run:
//   Stage 1 — Early reminder       (5 min before the dose time, patient only)
//   Stage 2 — Due alert            (at the dose time, patient only; creates
//                                   the pendingConfirmation that gates the
//                                   escalation)
//   Stage 3 — Missed escalation    (10 min after an unconfirmed due dose,
//                                   sent to the patient AND every family
//                                   member via messaging.sendEach)
//
// Idempotency: every patient push is guarded by a "sent" marker doc under
// /notifications/{medId}_{dateKey} (with a `_early` suffix for Stage 1), and
// each escalation is guarded by the pendingConfirmation's `escalationSent`
// flag — so the function is stateless and safe to retry, and an untaken dose
// is never nagged more than once per stage. Marking a dose "taken" from the
// app flips the confirmation to confirmed=true, which suppresses Stage 3.
//
// Deployment requirements (flag these):
//   - Cloud Functions + Cloud Scheduler need the Blaze (pay-as-you-go) plan.
//   - FCM web push is not supported on iOS Safari (works on Android Chrome
//     and desktop Chrome/Edge/Firefox).
//   - Deploy rules + indexes too: firebase deploy --only firestore:rules,firestore:indexes

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

const DAY_MS = 24 * 60 * 60 * 1000;
const EARLY_BEFORE_MINUTES = 5;
const ESCALATION_AFTER_MINUTES = 10;

// A token that FCM reports as dead — the user uninstalled, cleared site data,
// or revoked the subscription. Drop it from the user doc so we stop trying.
function isDeadTokenCode(code) {
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-argument"
  );
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

// Load every user with a registered push token (token holders only — users
// without a token can't be pushed to). Timezone is NOT filtered here because
// family members only need a token to RECEIVE escalations; the per-user
// timezone check happens inside the patient-push stage where it matters.
async function loadPushableUsers() {
  const users = new Map();
  let noTimezone = 0;
  const snap = await db.collection("users").get();
  for (const userDoc of snap.docs) {
    const data = userDoc.data();
    if (!data.fcmToken || data.notificationsEnabled === false) continue;
    users.set(userDoc.id, data);
    if (!data.timezone) noTimezone++;
  }
  return { users, noTimezone };
}

// Stages 1 + 2: send the patient-only reminder for doses scheduled
// `offsetMin` from `now`:
//   offsetMin = EARLY_BEFORE_MINUTES -> Stage 1 (early, 5 min before)
//   offsetMin = 0                    -> Stage 2 (due, at dose time)
// Stage 2 additionally creates the pendingConfirmation that gates escalation.
// Each push is guarded by a marker doc so a run can never double-send.
async function runPatientPushStage(users, now, offsetMin, { early }) {
  const target = new Date(now.getTime() + offsetMin * 60 * 1000);

  // Users grouped by their local "HH:MM" AT THE TARGET time, so one
  // medications query runs per distinct time instead of one per user.
  const byTime = new Map();
  for (const [uid, data] of users) {
    if (!data.timezone) continue;
    const hhmm = localTimeHHMM(data.timezone, target);
    if (!hhmm) continue;
    const list = byTime.get(hhmm) || [];
    list.push(uid);
    byTime.set(hhmm, list);
  }

  let sent = 0;
  let skippedTaken = 0;
  let skippedOffSchedule = 0;
  let skippedAlreadySent = 0;
  let failed = 0;
  const sentKeys = new Set(); // in-run dedup (defensive)

  for (const [hhmm] of byTime) {
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
      if (!patient?.fcmToken || !patient.timezone) continue;

      // A med matching this batch's HH:MM is only due for THIS patient when
      // their own local clock reads the same time at the target instant (the
      // same med can surface in another timezone's batch).
      if (localTimeHHMM(patient.timezone, target) !== hhmm) continue;

      const dateKey = dateKeyInTz(patient.timezone, target);
      if (!dateKey) continue;

      // Respect the med's schedule (every-2-days / weekly / etc.).
      if (!isScheduledOn(med, dateKey, patient.timezone)) {
        skippedOffSchedule++;
        continue;
      }

      // Already marked taken on the dose date? Then no reminder is needed —
      // and for Stage 2, no pendingConfirmation is created either, so a dose
      // taken before its due time can never escalate.
      const takenToday = (med.logs || []).some(
        (l) => l && l.date === dateKey && l.taken
      );
      if (takenToday) {
        skippedTaken++;
        continue;
      }

      // One push per dose per day per stage — the notifications doc is the
      // sent marker (and doubles as the user's inbox record).
      const notifId = early
        ? `${medDoc.id}_${dateKey}_early`
        : `${medDoc.id}_${dateKey}`;
      if (sentKeys.has(notifId)) continue;
      const notifRef = db.doc(`notifications/${notifId}`);
      const existing = await notifRef.get();
      if (existing.exists) {
        skippedAlreadySent++;
        continue;
      }

      const title = early
        ? "💊 Upcoming Medication"
        : "⏰ Time to Take Your Medication";
      const medName = med.name || "Medication";
      const dose = med.dosage || "dose";
      const body = early
        ? `${medName} (${dose}) in 5 minutes`
        : `${medName} (${dose}) — take it now!`;

      try {
        await messaging.send({
          token: patient.fcmToken,
          notification: { title, body },
          data: {
            type: early ? "early_reminder" : "due_reminder",
            medicationId: medDoc.id,
            ...(early ? { medicationName: medName } : {}),
          },
          android: { priority: "high" },
          apns: {
            payload: { aps: { sound: "default", ...(early ? {} : { badge: 1 }) } },
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
        logger.info(`Sent ${early ? "early " : ""}reminder "${title}" to ${patientUid}`);

        // Stage 2: create the escalation gate for this dose. merge:true keeps
        // `confirmed` if the client already flipped it (it can't exist yet in
        // the normal flow — the marker guard above prevents re-entry).
        if (!early) {
          await db
            .doc(`pendingConfirmations/${medDoc.id}_${dateKey}`)
            .set(
              {
                userId: patientUid,
                medicationId: medDoc.id,
                medicationName: medName,
                dosage: med.dosage || "",
                scheduledTime: target,
                familyGroupId: med.familyGroupId || "",
                dueReminderSent: true,
                confirmed: false,
                escalationSent: false,
                createdAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
        }
      } catch (err) {
        failed++;
        const code = err?.errorInfo?.code || err?.code || "";
        if (isDeadTokenCode(code)) {
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

  return { sent, skippedTaken, skippedOffSchedule, skippedAlreadySent, failed };
}

// Stage 3 — 10 minutes after an unconfirmed due dose, notify the patient AND
// every family member (each with a valid token) so someone can step in.
async function runEscalationStage(users, now) {
  const cutoff = new Date(now.getTime() - ESCALATION_AFTER_MINUTES * 60 * 1000);
  let escalated = 0;
  let noRecipients = 0;
  let staleTokens = 0;

  let snap;
  try {
    snap = await db
      .collection("pendingConfirmations")
      .where("confirmed", "==", false)
      .where("escalationSent", "==", false)
      .where("scheduledTime", "<=", cutoff)
      .get();
  } catch (err) {
    logger.error(
      `pendingConfirmations query failed (is the composite index deployed?): ${err.message}`
    );
    return { escalated, noRecipients, staleTokens };
  }
  if (snap.empty) return { escalated, noRecipients, staleTokens };

  for (const pcDoc of snap.docs) {
    const pc = pcDoc.data();
    const patient = users.get(pc.userId);

    // Recipients = patient + every family member with a token (deduped by
    // token). `notificationsEnabled === false` opts a device out, matching
    // the patient-push stages.
    const recipients = new Map(); // token -> uid
    if (patient?.fcmToken && patient.notificationsEnabled !== false) {
      recipients.set(patient.fcmToken, pc.userId);
    }
    if (pc.familyGroupId) {
      let group = null;
      try {
        const g = await db.doc(`familyGroups/${pc.familyGroupId}`).get();
        group = g.exists ? g.data() : null;
      } catch {
        group = null; // missing/invalid family — escalate to the patient alone
      }
      for (const memberUid of group?.members || []) {
        if (memberUid === pc.userId) continue;
        const member = users.get(memberUid);
        if (!member?.fcmToken || member.notificationsEnabled === false) continue;
        recipients.set(member.fcmToken, memberUid);
      }
    }

    if (recipients.size === 0) {
      noRecipients++;
      logger.warn(`Escalation skipped for ${pc.userId}: no valid FCM tokens`);
      continue;
    }

    const patientName = patient?.displayName || "A family member";
    const medLabel = pc.medicationName || "A medication";
    const body = `${medLabel}${pc.dosage ? ` (${pc.dosage})` : ""} was not taken.`;

    const recipientList = [...recipients.entries()];
    const messages = recipientList.map(([token]) => ({
      token,
      notification: {
        title: `⚠️ ${patientName} missed a medication`,
        body,
      },
      data: {
        type: "missed_escalation",
        medicationId: pc.medicationId || "",
        patientId: pc.userId,
        patientName,
        medicationName: pc.medicationName || "",
      },
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
      webpush: {
        notification: {
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-192x192.png",
          vibrate: [200, 100, 200],
        },
      },
    }));

    try {
      // sendEach resolves per-message even when individual sends fail — only a
      // transport-level error rejects. Handle each failure so one dead token
      // can't block the rest of the family.
      const res = await messaging.sendEach(messages);
      for (let i = 0; i < res.responses.length; i++) {
        const r = res.responses[i];
        if (r.success) continue;
        const err = r.error;
        const code = err?.errorInfo?.code || err?.code || "";
        const uid = recipientList[i][1];
        logger.error(`Escalation send failed for ${uid}: ${code || err?.message}`);
        if (isDeadTokenCode(code)) {
          await db
            .doc(`users/${uid}`)
            .update({ fcmToken: FieldValue.delete() })
            .catch(() => {});
          staleTokens++;
        }
      }
      await pcDoc.ref.update({ escalationSent: true });
      escalated++;
      logger.info(
        `Escalated missed dose for ${pc.userId} (${medLabel}) to ${recipients.size} devices`
      );
    } catch (err) {
      // Transport-level failure — leave escalationSent=false so the next run
      // retries the whole escalation for this dose.
      logger.error(`Escalation sendEach threw for ${pc.userId}: ${err.message}`);
    }
  }

  return { escalated, noRecipients, staleTokens };
}

exports.checkMedicationReminders = onSchedule("every 1 minutes", async () => {
  const now = new Date();

  const { users, noTimezone } = await loadPushableUsers();
  if (users.size === 0) {
    logger.info(
      `checkMedicationReminders: no token-bearing users (noTimezone=${noTimezone})`
    );
    return;
  }

  // Stage 1 — early reminder 5 minutes before the dose time.
  const early = await runPatientPushStage(users, now, EARLY_BEFORE_MINUTES, {
    early: true,
  });
  // Stage 2 — due alert at the dose time (+ pendingConfirmation gate).
  const due = await runPatientPushStage(users, now, 0, { early: false });
  // Stage 3 — missed-dose escalation to the patient + family.
  const escalation = await runEscalationStage(users, now);

  logger.info(
    `checkMedicationReminders: early=${early.sent} due=${due.sent} ` +
      `escalated=${escalation.escalated} (noRecipients=${escalation.noRecipients}, ` +
      `staleTokens=${escalation.staleTokens}) ` +
      `skippedTaken=${early.skippedTaken + due.skippedTaken} ` +
      `skippedOffSchedule=${early.skippedOffSchedule + due.skippedOffSchedule} ` +
      `skippedAlreadySent=${early.skippedAlreadySent + due.skippedAlreadySent} ` +
      `failed=${early.failed + due.failed} noTimezone=${noTimezone}`
  );
});
