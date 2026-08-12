// Streak helpers. A streak = consecutive days where EVERY scheduled med was
// taken. Days with nothing scheduled are skipped (neither counted nor
// breaking). A missed dose (confirmed or auto) breaks the chain.
//
// Scheduling is derived from each med's `frequency` and `createdAt`:
//   Daily / Twice daily : every day
//   every-2-days        : every 2nd day from creation
//   every-3-days        : every 3rd day from creation
//   Weekly              : same weekday as creation
//   As needed           : never required

import { toDateKey } from "./eventUtils";
import { findLogForDate } from "./medStatus";

const DAY_MS = 24 * 60 * 60 * 1000;

function createdAtKey(med) {
  if (!med?.createdAt) return toDateKey(new Date());
  const d = new Date(med.createdAt);
  return Number.isNaN(d.getTime()) ? toDateKey(new Date()) : toDateKey(d);
}

// True if the med is scheduled (required) on the given 'yyyy-MM-dd' date.
export function isScheduledOn(med, dateKey) {
  if (!med) return false;
  const start = createdAtKey(med);
  if (dateKey < start) return false; // med didn't exist yet
  const freq = med.frequency;
  if (freq === "Daily" || freq === "Twice daily") return true;
  const diff = Math.round((new Date(dateKey) - new Date(start)) / DAY_MS);
  if (freq === "every-2-days") return diff % 2 === 0;
  if (freq === "every-3-days") return diff % 3 === 0;
  if (freq === "Weekly") return new Date(dateKey).getDay() === new Date(start).getDay();
  return false; // "As needed"
}

// True if a "taken" log exists for the med on the given date.
export function isTakenOn(med, dateKey) {
  return !!findLogForDate(med, dateKey)?.taken;
}

// Day-by-day "allTaken" records over the last `days` days (including today).
export function buildDailyRecords(medications, now = new Date(), days = 90) {
  const meds = Array.isArray(medications) ? medications : [];
  const records = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    const required = meds.filter((m) => isScheduledOn(m, key));
    const taken = required.filter((m) => isTakenOn(m, key)).length;
    records.push({
      date: key,
      required: required.length,
      taken,
      allTaken: required.length > 0 && taken === required.length,
    });
  }
  return records;
}

// Current + longest streak (days). The current streak counts from today
// backwards, so it stays 0 until every med scheduled today has been taken.
// Note: `days` caps the look-back window (90 by default), so a best streak
// longer than that is undercounted — acceptable at family scale.
export function calculateStreaks(medications, now = new Date(), days = 90) {
  const records = buildDailyRecords(medications, now, days);

  let current = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r.required === 0) continue; // neutral day — doesn't break the chain
    if (r.allTaken) current++;
    else break;
  }

  let best = 0;
  let run = 0;
  for (const r of records) {
    if (r.required === 0) continue;
    if (r.allTaken) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  return { current, best };
}

// Per-med streak for card display: consecutive scheduled days where the dose
// was taken, ending at today (if taken today) or yesterday. Today counts only
// once it's been taken, so an untaken today doesn't zero the chip — but a
// missed day (yesterday included) does. `days` caps the look-back window (60
// by default), so very long per-med streaks are undercounted past that.
export function medStreak(med, now = new Date(), days = 60) {
  if (!med) return 0;
  const start = isTakenOn(med, toDateKey(now)) ? 0 : 1; // skip an untaken today
  let streak = 0;
  for (let i = start; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    if (!isScheduledOn(med, key)) continue;
    if (isTakenOn(med, key)) streak++;
    else break; // a scheduled day with no taken log is a gap / miss
  }
  return streak;
}
