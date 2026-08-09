// Shared helpers for calendar event status ("scheduled" | "attended" | "missed")

// Local-time date key in the same "yyyy-MM-dd" format events are stored in.
export function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// True once the event's date (and time, if set) has passed.
export function isPastEvent(ev, now = new Date()) {
  if (!ev?.date) return false;
  const today = toDateKey(now);
  if (ev.date < today) return true;
  if (ev.date > today) return false;
  if (!ev.time) return false; // all-day events are considered past at the end of the day
  const [h, min] = ev.time.split(":").map(Number);
  if (Number.isNaN(h)) return false;
  const eventTime = new Date(now);
  eventTime.setHours(h, min, 0, 0);
  return now.getTime() > eventTime.getTime();
}

// Resolves the display status: "attended" wins; otherwise past events are "missed".
export function getEventStatus(ev, now = new Date()) {
  if (ev?.status === "attended") return "attended";
  if (isPastEvent(ev, now)) return "missed";
  return "scheduled";
}

// Formats an ISO timestamp as a 12-hour time (e.g. "8:00 PM"), matching the
// app's standard 12h formatting used everywhere else.
export function formatAttendedAt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${m} ${period}`;
}
