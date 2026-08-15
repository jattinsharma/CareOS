"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  Stethoscope,
  Pill,
  Calendar,
  CalendarDays,
  Check,
  Clock,
  MapPin,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import TimePicker from "@/components/TimePicker";
import { formatTime12h } from "@/lib/medUtils";
import { getEventStatus, formatAttendedAt } from "@/lib/eventUtils";

// Parse a "yyyy-MM-dd" event date into a local Date (avoids UTC-offset drift
// when constructing dates from stored strings, same as MobileDashboard).
function parseDateKey(key) {
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// "2026-08-16" -> "Today" / "Tomorrow" / "Aug 16"
function sectionLabel(dateKey) {
  const d = parseDateKey(dateKey);
  if (!d) return dateKey;
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "MMM d");
}

const TYPE_ICONS = {
  appointment: Stethoscope,
  medication: Pill,
  other: Calendar,
};

const TYPE_BADGES = { appointment: "Appt", medication: "Med", other: "Event" };

const TYPE_COLORS = {
  appointment: "bg-blue-50 text-blue-700 border-blue-100",
  medication: "bg-rose-50 text-rose-700 border-rose-100",
  other: "bg-slate-50 text-slate-700 border-slate-100",
};

const TYPE_ICON_BG = {
  appointment: "bg-blue-50 text-blue-600",
  medication: "bg-rose-50 text-rose-600",
  other: "bg-slate-100 text-slate-600",
};

const TYPE_OPTIONS = [
  { value: "appointment", label: "Appointment", icon: Stethoscope },
  { value: "medication", label: "Medication", icon: Pill },
  { value: "other", label: "Other", icon: Calendar },
];

export default function MobileCalendar({
  user,
  events,
  weekDays,
  showAdd,
  setShowAdd,
  newEvent,
  setNewEvent,
  onAddEvent,
  onMarkAttended,
}) {
  const router = useRouter();
  const dayRefs = useRef({});
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef(null);

  const initial = (user?.displayName || user?.email || "?").trim().charAt(0).toUpperCase() || "?";

  // Group events by date, preserving ascending date order (page query already
  // orders by date asc).
  const grouped = useMemo(() => {
    const map = new Map();
    for (const ev of [...events].sort((a, b) => a.date.localeCompare(b.date))) {
      if (!map.has(ev.date)) map.set(ev.date, []);
      map.get(ev.date).push(ev);
    }
    return [...map.entries()].map(([date, list]) => ({ date, list }));
  }, [events]);

  const scrollToDay = (dateKey) => {
    dayRefs.current[dateKey]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const closeSheet = () => {
    setDragY(0);
    touchStartY.current = null;
    setShowAdd(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur px-4 h-16 flex items-center justify-between border-b border-slate-100">
        <div
          className="flex items-center gap-2.5 cursor-pointer select-none"
          onClick={() => router.push("/dashboard")}
        >
          <Image
            src="/icons/kinos-logo.png"
            alt="KinOS"
            width={36}
            height={36}
            className="w-9 h-9 rounded-lg object-cover"
            priority
          />
          <span className="font-bold text-lg text-slate-900 tracking-tight">Calendar</span>
        </div>

        <button
          onClick={() => router.push("/settings")}
          aria-label="Profile settings"
          className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center active:scale-95 transition-transform"
        >
          {initial}
        </button>
      </header>

      {/* Week strip — horizontal scroll */}
      <div className="px-3 pt-3">
        <div className="flex gap-1 overflow-x-auto pb-1 -mb-1">
          {weekDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const today = isToday(day);
            const hasEvents = grouped.some((g) => g.date === dayKey);
            return (
              <button
                key={dayKey}
                onClick={() => scrollToDay(dayKey)}
                className={`flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl shrink-0 transition-colors ${
                  today ? "bg-rose-50 ring-2 ring-rose-500" : "active:bg-slate-100"
                }`}
              >
                <span
                  className={`text-[10px] font-medium uppercase ${
                    today ? "text-rose-600" : "text-slate-400"
                  }`}
                >
                  {format(day, "EEE")}
                </span>
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                    today ? "bg-rose-500 text-white" : "text-slate-700"
                  }`}
                >
                  {format(day, "d")}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    hasEvents ? "bg-rose-500" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Events grouped by date */}
      <div className="px-4 mt-4">
        {grouped.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center mt-2">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="font-medium text-slate-500">No events scheduled yet</p>
            <p className="text-sm text-slate-400 mt-1">
              Tap + to add appointments and medication refills.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(({ date, list }) => {
              const d = parseDateKey(date);
              return (
                <section
                  key={date}
                  ref={(el) => {
                    dayRefs.current[date] = el;
                  }}
                  className="scroll-mt-20"
                >
                  <div className="flex items-center gap-2 mb-2.5 px-0.5">
                    <h2 className="text-sm font-bold text-slate-900">{sectionLabel(date)}</h2>
                    <span className="text-xs text-slate-400">
                      {d ? format(d, "MMM d, yyyy") : date}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {list.map((ev) => {
                      const status = getEventStatus(ev);
                      const attended = status === "attended";
                      const missed = status === "missed";
                      const TypeIcon = TYPE_ICONS[ev.type] || TYPE_ICONS.other;
                      const attendedAt = formatAttendedAt(ev.attendedAt);
                      return (
                        <div
                          key={ev.id}
                          className={`bg-white rounded-2xl border p-4 shadow-sm ${
                            attended ? "border-emerald-100" : "border-slate-100"
                          }`}
                        >
                          {/* Top row: icon + title + badge */}
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                TYPE_ICON_BG[ev.type] || TYPE_ICON_BG.other
                              } ${attended ? "opacity-60" : ""}`}
                            >
                              <TypeIcon className="w-4 h-4" />
                            </div>
                            <p
                              className={`flex-1 min-w-0 font-semibold text-slate-900 text-sm truncate ${
                                attended ? "text-slate-400 line-through" : ""
                              }`}
                            >
                              {ev.title}
                            </p>
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border flex-shrink-0 ${
                                TYPE_COLORS[ev.type] || TYPE_COLORS.other
                              }`}
                            >
                              {TYPE_BADGES[ev.type] || TYPE_BADGES.other}
                            </span>
                          </div>

                          {/* Middle: date / time / location on single lines */}
                          <div className="mt-3 space-y-1.5">
                            <p className="text-sm text-slate-600 whitespace-nowrap flex items-center gap-2">
                              <CalendarDays className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="whitespace-nowrap">
                                {d ? format(d, "MMM d, yyyy") : date}
                              </span>
                            </p>
                            <p className="text-sm text-slate-600 whitespace-nowrap flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="whitespace-nowrap">
                                {formatTime12h(ev.time) || "All day"}
                              </span>
                            </p>
                            {ev.location && (
                              <p className="text-sm text-slate-500 flex items-center gap-2 min-w-0">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{ev.location}</span>
                              </p>
                            )}
                          </div>

                          {/* Bottom row: status action */}
                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                            {attended ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                                <Check className="w-4 h-4" />
                                {attendedAt ? `Attended at ${attendedAt}` : "Attended ✓"}
                              </span>
                            ) : (
                              <>
                                {missed && (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-600 border border-red-100">
                                    Missed
                                  </span>
                                )}
                                <button
                                  onClick={() => onMarkAttended(ev)}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 border border-emerald-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  {missed ? "Mark attended" : "Mark as Attended"}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB — above the bottom nav */}
      <button
        onClick={() => setShowAdd(true)}
        aria-label="Add event"
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 active:scale-95 text-white shadow-lg shadow-rose-300 flex items-center justify-center transition-all"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add Event bottom sheet */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={closeSheet} aria-hidden="true" />
          <div
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl animate-slide-in-up max-h-[88vh] flex flex-col"
            onTouchStart={(e) => {
              touchStartY.current = e.touches[0].clientY;
            }}
            onTouchMove={(e) => {
              if (touchStartY.current == null) return;
              const dy = e.touches[0].clientY - touchStartY.current;
              if (dy > 0) setDragY(dy);
            }}
            onTouchEnd={() => {
              if (dragY > 90) {
                closeSheet();
              } else {
                setDragY(0);
              }
              touchStartY.current = null;
            }}
            style={{
              transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
              transition: dragY > 0 ? "none" : undefined,
            }}
          >
            {/* Grabber */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            <div className="flex items-center justify-between px-5 pt-1 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Add Event</h2>
              <button
                onClick={closeSheet}
                aria-label="Close"
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="px-5 pb-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Event Title
                </label>
                <input
                  placeholder="e.g., Dr. Smith Appointment"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
                <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                  {TYPE_OPTIONS.map((opt) => {
                    const OptIcon = opt.icon;
                    const active = newEvent.type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, type: opt.value })}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                          active
                            ? "bg-white text-rose-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <OptIcon className="w-4 h-4" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Time</label>
                <TimePicker
                  value={newEvent.time}
                  onChange={(t) => setNewEvent({ ...newEvent, time: t })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Location (optional)
                </label>
                <input
                  placeholder="e.g., City Hospital, Room 302"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <button
                onClick={onAddEvent}
                className="w-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white py-3.5 rounded-xl font-semibold transition-colors"
              >
                Save Event
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
