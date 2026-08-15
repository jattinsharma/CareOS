// Shared Firestore writes for medication dose logging. Both the medications
// page and the dashboard use these so "taken"/"missed" entries are recorded
// identically. Log dates use the LOCAL date (via toDateKey), matching the
// overdue/streak logic which is inherently local-time.

import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "./firebase";
import { toDateKey } from "./eventUtils";
import { isScheduledOn, isTakenOn } from "./streak";
import { autoMissTimeFor } from "./medStatus";

// Record a dose as taken. Returns the log entry (caller updates local state).
export async function markMedTaken(medId, user, now = new Date()) {
  const ts = now.toISOString();
  const entry = {
    date: toDateKey(now),
    taken: true,
    takenBy: user.uid,
    timestamp: ts,
    takenAt: ts,
  };
  await updateDoc(doc(db, "medications", medId), { logs: arrayUnion(entry) });
  // Best-effort: confirm the corresponding pendingConfirmation (the escalation
  // gate the Cloud Function creates when the due reminder fires) so a dose
  // logged as taken never triggers the missed-dose family escalation. The doc
  // id mirrors the function's `{medId}_{dateKey}` convention, and works for
  // family members tapping "Taken" too — the confirmation is keyed by the
  // med + dose date, not by who tapped. A missing doc is the NORMAL case
  // (dose taken before its due reminder, or notifications never enabled), so
  // failures are swallowed.
  confirmPendingDose(medId, entry.date).catch(() => {});
  return entry;
}

async function confirmPendingDose(medId, dateKey) {
  await updateDoc(doc(db, "pendingConfirmations", `${medId}_${dateKey}`), {
    confirmed: true,
  });
}

// Record a dose as missed — either confirmed by the user or auto-marked after
// the 4 AM grace window. Returns the log entry (caller updates local state).
export async function markMedMissed(medId, user, { auto = false } = {}, now = new Date()) {
  const ts = now.toISOString();
  const entry = {
    date: toDateKey(now),
    taken: false,
    missed: true,
    autoMissed: auto,
    timestamp: ts,
  };
  if (!auto) {
    entry.takenBy = user.uid;
    entry.markedMissedAt = ts;
  }
  await updateDoc(doc(db, "medications", medId), { logs: arrayUnion(entry) });
  return entry;
}

// Auto-record fully-past doses as missed so history and streaks stay accurate
// even when nobody opened the app overnight. A dose on date D is auto-missed
// once the clock passes 4 AM on D+1 and no log exists for D. Nothing is
// written for today — the UI keeps asking until the next 4 AM boundary.
//
// Returns a Map<medId, entry> of the entries that were written so callers can
// mirror them into local state.
export async function reconcileAutoMissed(medications, now = new Date(), lookBackDays = 7) {
  const updated = new Map();
  const writes = [];
  for (const med of medications) {
    for (let i = 1; i <= lookBackDays; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = toDateKey(d);
      if (now <= autoMissTimeFor(key)) break; // this day (and older) still open
      if (!isScheduledOn(med, key)) continue;
      if (isTakenOn(med, key) || findMissedLog(med, key)) continue;
      const entry = {
        date: key,
        taken: false,
        missed: true,
        autoMissed: true,
        timestamp: now.toISOString(),
      };
      writes.push(updateDoc(doc(db, "medications", med.id), { logs: arrayUnion(entry) }));
      updated.set(med.id, entry);
    }
  }
  if (writes.length) await Promise.all(writes);
  return updated;
}

function findMissedLog(med, dateKey) {
  return (med?.logs || []).find((l) => l && l.date === dateKey && l.missed);
}
