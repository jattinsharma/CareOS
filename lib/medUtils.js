// Shared helpers for the medications and dashboard pages.
// All times are stored in Firestore as 24-hour "HH:MM" strings
// (e.g. "20:00"); these helpers convert to/from 12-hour form for
// the picker UI and for display.

export const FREQUENCY_OPTIONS = [
  { value: "Daily", label: "Daily" },
  { value: "Twice daily", label: "Twice daily" },
  { value: "every-2-days", label: "Every 2 days" },
  { value: "every-3-days", label: "Every 3 days" },
  { value: "Weekly", label: "Weekly" },
  { value: "As needed", label: "As needed" },
];

// "20:00" -> { hour: 8, minute: "00", period: "PM" }
export function to12h(time24) {
  if (!time24) return { hour: 12, minute: "00", period: "AM" };
  const [h, m] = time24.split(":").map(Number);
  if (Number.isNaN(h)) return { hour: 12, minute: "00", period: "AM" };
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { hour, minute: String(m).padStart(2, "0"), period };
}

// { hour: 8, minute: "00", period: "PM" } -> "20:00"
export function to24h(hour, minute, period) {
  let h = Number(hour) % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

// "20:00" -> "8:00 PM"
export function formatTime12h(time24) {
  if (!time24) return "";
  const { hour, minute, period } = to12h(time24);
  return `${hour}:${minute} ${period}`;
}

// Current time rounded to the nearest 15 minutes as a 24h "HH:MM" string
// (setMinutes(60) rolls over to the next hour automatically, so 23:58 -> "00:00")
export function nowRounded15() {
  const d = new Date();
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// "every-2-days" -> "Every 2 days" (falls back to the raw stored value)
export function frequencyLabel(value) {
  if (!value) return "";
  const found = FREQUENCY_OPTIONS.find((o) => o.value === value);
  return found ? found.label : value;
}
