"use client";

import { useAuth } from "@/components/AuthProvider";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  orderBy,
} from "firebase/firestore";
import Navbar from "@/components/Navbar";
import MobileCalendar from "@/components/calendar/MobileCalendar";
import { CalendarDays, Plus, X, Clock, MapPin, Stethoscope, Pill, Calendar, Check } from "lucide-react";
import toast from "react-hot-toast";
import { format, addDays, startOfWeek, isSameMonth, isToday } from "date-fns";
import TimePicker from "@/components/TimePicker";
import { formatTime12h } from "@/lib/medUtils";
import { getEventStatus, formatAttendedAt } from "@/lib/eventUtils";

export default function CalendarPage() {
  const { user } = useAuth();
  const [familyGroup, setFamilyGroup] = useState(null);
  const [events, setEvents] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "",
    location: "",
    type: "appointment",
  });

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    const q = query(
      collection(db, "familyGroups"),
      where("members", "array-contains", user.uid)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const group = { id: snap.docs[0].id, ...snap.docs[0].data() };
    setFamilyGroup(group);

    const evQ = query(
      collection(db, "events"),
      where("familyGroupId", "==", group.id),
      orderBy("date", "asc")
    );
    const evSnap = await getDocs(evQ);
    setEvents(evSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  async function addEvent() {
    if (!newEvent.title.trim() || !newEvent.date) {
      toast.error("Please enter a title and date");
      return;
    }
    const ref = await addDoc(collection(db, "events"), {
      ...newEvent,
      familyGroupId: familyGroup.id,
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
    });
    setEvents([...events, { id: ref.id, ...newEvent, familyGroupId: familyGroup.id }]);
    setShowAdd(false);
    setNewEvent({
      title: "",
      date: format(new Date(), "yyyy-MM-dd"),
      time: "",
      location: "",
      type: "appointment",
    });
    toast.success("Event added!");
  }

  async function markAttended(ev) {
    try {
      const attendedAt = new Date().toISOString();
      await updateDoc(doc(db, "events", ev.id), { status: "attended", attendedAt });
      setEvents(
        events.map((e) => (e.id === ev.id ? { ...e, status: "attended", attendedAt } : e))
      );
      toast.success("Marked as attended");
    } catch {
      toast.error("Couldn't update event");
    }
  }

  const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const typeIcons = {
    appointment: <Stethoscope className="w-3.5 h-3.5" />,
    medication: <Pill className="w-3.5 h-3.5" />,
    other: <Calendar className="w-3.5 h-3.5" />,
  };

  const typeColors = {
    appointment: "bg-blue-50 text-blue-700 border-blue-100",
    medication: "bg-rose-50 text-rose-700 border-rose-100",
    other: "bg-slate-50 text-slate-700 border-slate-100",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop view — existing code, unchanged */}
      <div className="hidden md:block">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Calendar</h1>
            <p className="text-slate-500 mt-1">Shared schedule for the whole family.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm shadow-rose-200"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        </div>

        {/* Add Form */}
        {showAdd && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Add Event</h2>
              <button
                onClick={() => setShowAdd(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Event Title</label>
                <input
                  placeholder="e.g., Dr. Smith Appointment"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
                <select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 bg-white"
                >
                  <option value="appointment">Doctor Appointment</option>
                  <option value="medication">Medication Refill</option>
                  <option value="other">Other</option>
                </select>
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
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Location (optional)</label>
                <input
                  placeholder="e.g., City Hospital, Room 302"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>
            <button
              onClick={addEvent}
              className="mt-5 w-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              Save Event
            </button>
          </div>
        )}

        {/* Week View */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              This Week
            </h2>
            <span className="text-sm text-slate-400">
              {format(weekStart, "MMM d")} — {format(addDays(weekStart, 6), "MMM d")}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => {
              const dayStr = format(day, "yyyy-MM-dd");
              const dayEvents = events.filter((e) => e.date === dayStr);
              const today = isToday(day);
              return (
                <div
                  key={day}
                  className={`rounded-xl p-2 min-h-[100px] border ${
                    today
                      ? "border-rose-300 bg-rose-50/30 ring-1 ring-rose-100"
                      : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <p
                    className={`text-xs font-medium mb-1 ${
                      today ? "text-rose-600" : "text-slate-400"
                    }`}
                  >
                    {format(day, "EEE")}
                  </p>
                  <p
                    className={`text-lg font-bold mb-1.5 ${
                      today ? "text-rose-600" : "text-slate-700"
                    }`}
                  >
                    {format(day, "d")}
                  </p>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        className={`text-[10px] px-1.5 py-0.5 rounded-md truncate font-medium border ${
                          typeColors[ev.type] || typeColors.other
                        } ${
                          getEventStatus(ev) === "attended"
                            ? "opacity-60 line-through"
                            : getEventStatus(ev) === "missed"
                            ? "ring-1 ring-red-200"
                            : ""
                        }`}
                      >
                        {ev.time ? `${formatTime12h(ev.time)} ` : ""}
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="text-[10px] text-slate-400 pl-1">
                        +{dayEvents.length - 2} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* All Events */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-5">All Events</h2>
          {events.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-slate-500">No events scheduled yet</p>
              <p className="text-sm mt-1">Add appointments and medication refills to keep track.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((ev) => {
                  const status = getEventStatus(ev);
                  const attended = status === "attended";
                  const attendedAt = formatAttendedAt(ev.attendedAt);
                  return (
                    <div
                      key={ev.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                        attended
                          ? "bg-emerald-50/50 border-emerald-100"
                          : "bg-slate-50 border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          attended ? "opacity-60 " : ""
                        }${
                          ev.type === "appointment"
                            ? "bg-blue-50 text-blue-600"
                            : ev.type === "medication"
                            ? "bg-rose-50 text-rose-600"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {typeIcons[ev.type] || typeIcons.other}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-semibold truncate ${
                            attended ? "text-slate-400 line-through" : "text-slate-900"
                          }`}
                        >
                          {ev.title}
                        </p>
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {format(new Date(ev.date), "MMM d, yyyy")}
                            {ev.time && ` at ${formatTime12h(ev.time)}`}
                          </span>
                          {ev.location && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3.5 h-3.5" />
                              {ev.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0">
                        {status === "attended" ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 whitespace-nowrap">
                            <Check className="w-4 h-4" />
                            {attendedAt ? `Attended at ${attendedAt}` : "Attended"}
                          </span>
                        ) : (
                          <>
                            {status === "missed" && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100 whitespace-nowrap">
                                Missed
                              </span>
                            )}
                            <button
                              onClick={() => markAttended(ev)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 border border-emerald-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {status === "missed" ? "Mark attended" : "Mark as Attended"}
                            </button>
                          </>
                        )}
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${
                            typeColors[ev.type] || typeColors.other
                          }`}
                        >
                          {ev.type === "appointment"
                            ? "Appt"
                            : ev.type === "medication"
                            ? "Med"
                            : "Event"}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Mobile view — native app UI (mobile only) */}
      <div className="md:hidden">
        <MobileCalendar
          user={user}
          events={events}
          familyGroup={familyGroup}
          weekDays={weekDays}
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
          showAdd={showAdd}
          setShowAdd={setShowAdd}
          newEvent={newEvent}
          setNewEvent={setNewEvent}
          onAddEvent={addEvent}
          onMarkAttended={markAttended}
        />
      </div>
    </div>
  );
}
