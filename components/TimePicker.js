"use client";

import { to12h, to24h, nowRounded15 } from "@/lib/medUtils";

// 12-hour time picker (hour 1-12, minute in 15-min steps, AM/PM toggle).
// Works with 24-hour "HH:MM" strings. When `value` is empty (optional
// fields like event times), it displays the current time rounded to the
// nearest 15 minutes as a default but only writes once the user interacts.
export default function TimePicker({ value, onChange }) {
  const { hour, minute, period } = to12h(value || nowRounded15());

  const update = (next) =>
    onChange(
      to24h(
        next.hour ?? hour,
        next.minute ?? minute,
        next.period ?? period
      )
    );

  return (
    <div className="flex gap-2">
      <select
        value={hour}
        onChange={(e) => update({ hour: Number(e.target.value) })}
        aria-label="Hour"
        className="w-20 px-3 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 bg-white"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <select
        value={minute}
        onChange={(e) => update({ minute: e.target.value })}
        aria-label="Minute"
        className="w-24 px-3 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 bg-white"
      >
        {["00", "15", "30", "45"].map((m) => (
          <option key={m} value={m}>
            :{m}
          </option>
        ))}
      </select>
      <div className="flex flex-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        {["AM", "PM"].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => update({ period: p })}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
              period === p
                ? "bg-rose-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
