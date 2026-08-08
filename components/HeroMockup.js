"use client";

import { Heart, Pill, Bell, CalendarDays, Check } from "lucide-react";

const meds = [
  { name: "Metformin", dose: "500mg · Morning", time: "8:00 AM", done: true },
  { name: "Lisinopril", dose: "10mg · Evening", time: "6:00 PM", done: false },
  { name: "Atorvastatin", dose: "20mg · Night", time: "9:00 PM", done: false },
];

const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

export default function HeroMockup() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto w-full max-w-md animate-[float-slow_4s_ease-in-out_infinite]"
    >
      {/* soft glow behind the card */}
      <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-rose-200/30 blur-2xl" />

      <div className="relative rounded-[2rem] border border-white/60 bg-white/90 p-5 shadow-2xl shadow-rose-200/50 backdrop-blur-sm">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-500">
              <Heart className="h-4 w-4 text-white" fill="white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Mom&apos;s Care</p>
              <p className="text-[11px] text-slate-400">Family group · 3 members</p>
            </div>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-500 ring-1 ring-rose-100">
            <CalendarDays className="h-3 w-3" /> Today
          </span>
        </div>

        {/* medication pills */}
        <div className="mt-4 space-y-2.5">
          {meds.map((m) => (
            <div
              key={m.name}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-100">
                <Pill className="h-4 w-4 text-rose-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-900">{m.name}</p>
                <p className="text-[11px] text-slate-400">{m.dose}</p>
              </div>
              {m.done ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  <Check className="h-3 w-3" strokeWidth={3} /> Taken
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
                  <Bell className="h-3 w-3" /> {m.time}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* calendar strip */}
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] font-semibold text-slate-500">This week</p>
            <p className="text-[11px] font-medium text-rose-500">3 events</p>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {weekDays.map((d, i) => (
              <div
                key={`${d}-${i}`}
                className={`flex h-9 flex-col items-center justify-center rounded-lg text-[10px] font-semibold ${
                  i === 3
                    ? "bg-rose-500 text-white shadow-sm shadow-rose-200"
                    : "text-slate-500"
                }`}
              >
                <span>{d}</span>
                <span className={i === 3 ? "text-white" : "text-slate-400"}>{10 + i}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
