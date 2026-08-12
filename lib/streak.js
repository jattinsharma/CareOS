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

// True if a "missed" (confirmed or auto) log exists for the med on the given
// date, with no overriding "taken" log — retroactive corrections win, exactly
// matching findLogForDate's preference.
export function isMissedOn(med, dateKey) {
  return !!findLogForDate(med, dateKey)?.missed;
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
    const missed = required.filter((m) => isMissedOn(m, key)).length;
    records.push({
      date: key,
      required: required.length,
      taken,
      missed,
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

// Date-grouped log summary for a med: for each date, whether a taken or missed
// log exists. Taken wins when both appear (retro corrections), and a legacy
// log carrying neither flag is treated as taken (backward compat).
function logSummaryByDate(med) {
  const byDate = {};
  for (const l of med?.logs || []) {
    if (!l || !l.date) continue;
    const cur = byDate[l.date] || { taken: false, missed: false };
    if (l.taken) cur.taken = true;
    else if (l.missed) cur.missed = true;
    else cur.taken = true; // legacy log with no status → assume taken
    byDate[l.date] = cur;
  }
  return byDate;
}

// Miss stats for a set of medications:
//   totalMisses       — lifetime missed doses (all stored logs, deduped per
//                       date; a retroactive "taken" cancels a same-date miss)
//   weeklyMisses      — missed doses within the last `daysBack` days
//   currentMissStreak — consecutive recent days (ending at the latest resolved
//                       day) where at least one scheduled dose was missed.
//                       Days with nothing scheduled are skipped; a day where
//                       every scheduled dose was taken breaks the run; an
//                       unresolved day at the start of the walk (e.g. today
//                       before any log exists) is skipped so an unfinished
//                       today doesn't falsely zero the run.
export function calculateMissStats(
  medications,
  now = new Date(),
  daysBack = 7,
  days = 90
) {
  const meds = Array.isArray(medications) ? medications : [];

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffKey = toDateKey(cutoff);

  let totalMisses = 0;
  let weeklyMisses = 0;
  for (const med of meds) {
    for (const [date, s] of Object.entries(logSummaryByDate(med))) {
      if (!s.missed || s.taken) continue;
      totalMisses++;
      if (date > cutoffKey) weeklyMisses++; // the last `daysBack` full days
    }
  }

  const records = buildDailyRecords(meds, now, days);
  let currentMissStreak = 0;
  let started = false;
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r.required === 0) continue; // neutral day — neither extends nor breaks
    if (r.missed > 0) {
      currentMissStreak++;
      started = true;
    } else if (r.allTaken || started) {
      break; // fully-taken day, or an unresolved day after the run began
    }
    // otherwise: unresolved day before the run started → skip it
  }

  return { totalMisses, weeklyMisses, currentMissStreak };
}

// Miss stats for a single family member's medications (owner, falling back to
// the creator for meds added before ownership existed).
export function calculateMemberMissStats(
  medications,
  memberUid,
  now = new Date(),
  daysBack = 7,
  days = 90
) {
  const meds = (Array.isArray(medications) ? medications : []).filter(
    (m) => (m.ownerUid || m.createdBy) === memberUid
  );
  return calculateMissStats(meds, now, daysBack, days);
}

// Streak stats for a single family member's medications.
export function calculateMemberStreaks(
  medications,
  memberUid,
  now = new Date(),
  days = 90
) {
  const meds = (Array.isArray(medications) ? medications : []).filter(
    (m) => (m.ownerUid || m.createdBy) === memberUid
  );
  return calculateStreaks(meds, now, days);
}

// Per-med dose history over the look-back window. Scheduled days that resolve
// to taken or missed are counted; unresolved days are excluded from the
// ratio. Uses the same date-grouped summary as the miss stats, so a legacy
// flagless log counts as taken (backward compat) and a retroactive "taken"
// correction cancels a same-date miss. Returns { taken, missed, total, rate }
// where rate is the adherence percentage (taken / total × 100) or null when
// nothing has resolved yet.
export function medHistoryStats(med, now = new Date(), days = 90) {
  if (!med) return { taken: 0, missed: 0, total: 0, rate: null };
  const start = createdAtKey(med);
  const byDate = logSummaryByDate(med);
  let taken = 0;
  let missed = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    if (key < start) break;
    if (!isScheduledOn(med, key)) continue;
    const s = byDate[key];
    if (!s) continue; // scheduled but unresolved — excluded from the ratio
    if (s.taken) taken++;
    else if (s.missed) missed++;
  }
  const total = taken + missed;
  return {
    taken,
    missed,
    total,
    rate: total === 0 ? null : Math.round((taken / total) * 100),
  };
}

// Lifetime missed doses for a med (all stored logs, deduped per date; a
// retroactive "taken" correction cancels a same-date miss).
export function medLifetimeMisses(med) {
  let count = 0;
  for (const s of Object.values(logSummaryByDate(med))) {
    if (s.missed && !s.taken) count++;
  }
  return count;
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
