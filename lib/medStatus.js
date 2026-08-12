// Shared helpers for medication dose status.
//
// A dose's status is derived from the med's scheduled `times` (24h "HH:MM")
// plus the day's log entry in `med.logs`:
//   taken:    { date, taken: true, takenBy, timestamp, takenAt }
//   missed:   { date, taken: false, missed: true, takenBy, markedMissedAt }
//   autoMiss: { date, taken: false, missed: true, autoMissed: true }
//
// Status timeline for a dose scheduled at time T on date D:
//   now < T                     -> "upcoming"
//   T <= now <= T + 30min       -> "due"        (pulse, "Take now")
//   T + 30min < now < (D+1) 4AM -> "overdue"    (ask: taken or missed?)
//   now >= (D+1) 4AM            -> "missed"     (auto-marked for history)

import { toDateKey } from "./eventUtils";
import { formatTime12h } from "./medUtils";

// A dose becomes "overdue" this many minutes after its scheduled time.
export const OVERDUE_AFTER_MINUTES = 30;
// A dose becomes "missed" (auto) at this hour on the day AFTER its dose date.
export const AUTO_MISS_HOUR = 4;

// The log entry for a given date, preferring "taken" over "missed" when both
// exist (e.g. after a retroactive correction). Returns undefined if none.
export function findLogForDate(med, dateKey) {
  const logs = med?.logs || [];
  const dayLogs = logs.filter((l) => l && l.date === dateKey);
  return dayLogs.find((l) => l.taken) || dayLogs.find((l) => l.missed) || undefined;
}

// Local Date for a medication's scheduled time on the given date key.
export function scheduledTimeFor(med, dateKey) {
  const [h, m] = (med?.times || "00:00").split(":").map(Number);
  const [y, mo, d] = dateKey.split("-").map(Number);
  return new Date(
    y,
    mo - 1,
    d,
    Number.isNaN(h) ? 0 : h,
    Number.isNaN(m) ? 0 : m,
    0,
    0
  );
}

// 4 AM on the day AFTER the dose date — the auto-miss boundary for that dose.
export function autoMissTimeFor(dateKey) {
  const [y, mo, d] = dateKey.split("-").map(Number);
  return new Date(y, mo - 1, d + 1, AUTO_MISS_HOUR, 0, 0, 0);
}

// Resolves the display status for a medication "today" (i.e. on `now`'s date).
// Returns { state, label, color, pulse?, ask?, log?, scheduled }.
export function getMedStatus(med, now = new Date()) {
  const todayKey = toDateKey(now);
  const log = findLogForDate(med, todayKey);

  if (log?.taken) {
    return {
      state: "taken",
      label: "Taken",
      color: "green",
      log,
      scheduled: scheduledTimeFor(med, todayKey),
    };
  }
  if (log?.missed) {
    return {
      state: "missed",
      label: "Missed",
      color: "red",
      log,
      scheduled: scheduledTimeFor(med, todayKey),
    };
  }

  // Meds without a scheduled time, or "As needed" (no required window), have
  // no status timeline — they're never due/overdue and never count toward
  // streaks (the form always sets a time, so the frequency check matters).
  if (!med?.times || med?.frequency === "As needed") {
    return { state: "asneeded", label: "As needed", color: "gray", scheduled: null };
  }

  const scheduled = scheduledTimeFor(med, todayKey);
  const overdueAt = new Date(scheduled.getTime() + OVERDUE_AFTER_MINUTES * 60 * 1000);
  const autoMissAt = autoMissTimeFor(todayKey);

  if (now < scheduled) {
    return {
      state: "upcoming",
      label: `Due at ${formatTime12h(med.times)}`,
      color: "gray",
      scheduled,
    };
  }
  if (now <= overdueAt) {
    return { state: "due", label: "Take now", color: "pink", pulse: true, scheduled };
  }
  // Overdue persists until 4 AM on the day after the dose date, so a late
  // night dose still lets the user decide — nothing is auto-marked silently
  // while the decision is still meaningful.
  if (now < autoMissAt) {
    return { state: "overdue", label: "Overdue", color: "red", ask: true, scheduled };
  }
  // Safety net: for a dose whose date is already past the 4 AM boundary, fall
  // back to "missed" (normally the auto-miss reconcile writes a log first).
  return { state: "missed", label: "Missed", color: "red", scheduled };
}
