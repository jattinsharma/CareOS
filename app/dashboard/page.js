"use client";

import { useAuth } from "@/components/AuthProvider";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import Navbar from "@/components/Navbar";
import {
  Pill,
  CalendarDays,
  Users,
  AlertCircle,
  ChevronRight,
  Clock,
  Activity,
  Check,
  Bell,
} from "lucide-react";
import { frequencyLabel, formatTime12h } from "@/lib/medUtils";
import { getEventStatus, isPastEvent, toDateKey } from "@/lib/eventUtils";
import toast from "react-hot-toast";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [familyGroup, setFamilyGroup] = useState(null);
  const [medications, setMedications] = useState([]);
  const [events, setEvents] = useState([]);
  const [todayMeds, setTodayMeds] = useState([]);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);
  const [notifReady, setNotifReady] = useState(false);
  const medsRef = useRef(medications);
  const lastNotifiedRef = useRef({});

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  // Keep a ref so the notification interval always sees the latest medications
  useEffect(() => {
    medsRef.current = medications;
  }, [medications]);

  // Restore stored notification preference once on mount (avoids re-asking)
  useEffect(() => {
    setNotifReady(true);
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    try {
      const stored = localStorage.getItem("careos_notifications");
      if (Notification.permission === "granted") {
        setNotifEnabled(true);
        localStorage.setItem("careos_notifications", "granted");
      } else if (Notification.permission === "denied" || stored === "denied") {
        setNotifDenied(true);
      }
    } catch {
      // localStorage unavailable — ignore
    }
  }, []);

  // Reminder loop: every 60s, notify for meds due within the next 5 minutes
  useEffect(() => {
    if (!notifEnabled) return;
    const tick = () => {
      const meds = medsRef.current;
      if (!meds.length) return;
      const today = new Date().toISOString().split("T")[0];
      const now = new Date();
      const windowEnd = new Date(now.getTime() + 5 * 60 * 1000);
      const due = meds.filter((m) => {
        if (!m.times) return false;
        const log = m.logs?.find((l) => l.date === today);
        if (log?.taken) return false;
        const [h, min] = m.times.split(":").map(Number);
        if (Number.isNaN(h)) return false;
        const dueTime = new Date(now);
        dueTime.setHours(h, min, 0, 0);
        return dueTime >= now && dueTime <= windowEnd;
      });
      // Don't re-alert the same med more than once per 5 minutes
      const COOLDOWN_MS = 5 * 60 * 1000;
      const nowTs = now.getTime();
      const freshDue = due.filter((m) => {
        const last = lastNotifiedRef.current[m.id];
        return !last || nowTs - last >= COOLDOWN_MS;
      });
      freshDue.forEach((m) => {
        lastNotifiedRef.current[m.id] = nowTs;
        if (document.visibilityState === "visible") {
          toast(`Time for ${m.name}!`, {
            duration: 10000,
            icon: "⏰",
            style: { fontSize: "1.15rem", fontWeight: 600, padding: "14px 18px" },
          });
          playBeep();
        } else if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          try {
            const n = new Notification("CareOS", {
              body: `Time to take ${m.name}`,
            });
            n.onclick = () => {
              window.focus();
              n.close();
            };
          } catch {
            // Notification constructor failed — ignore
          }
        }
      });
    };
    tick();
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, [notifEnabled]);

  async function fetchData() {
    const q = query(
      collection(db, "familyGroups"),
      where("members", "array-contains", user.uid)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      router.push("/family");
      return;
    }
    const group = { id: snap.docs[0].id, ...snap.docs[0].data() };
    setFamilyGroup(group);

    const medQ = query(
      collection(db, "medications"),
      where("familyGroupId", "==", group.id)
    );
    const medSnap = await getDocs(medQ);
    const meds = medSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setMedications(meds);

    const today = new Date().toISOString().split("T")[0];
    const due = meds.filter((m) => {
      const lastLog = m.logs?.find((l) => l.date === today);
      return !lastLog || !lastLog.taken;
    });
    setTodayMeds(due);

    // Upcoming (today + future) plus a few recent past events so caregivers
    // can see what was attended or missed. Range filters on `date` reuse the
    // existing (familyGroupId, date) composite index.
    const todayKey = toDateKey(new Date());
    const upQ = query(
      collection(db, "events"),
      where("familyGroupId", "==", group.id),
      where("date", ">=", todayKey),
      orderBy("date", "asc"),
      limit(5)
    );
    const pastQ = query(
      collection(db, "events"),
      where("familyGroupId", "==", group.id),
      where("date", "<", todayKey),
      orderBy("date", "asc"),
      limit(5)
    );
    const [upSnap, pastSnap] = await Promise.all([getDocs(upQ), getDocs(pastQ)]);
    const upcoming = upSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const past = pastSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.date.localeCompare(a.date)); // most recent first
    setEvents([...upcoming, ...past]);
  }

  async function enableNotifications() {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      toast.error("Notifications aren't supported in this browser");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotifEnabled(true);
        try {
          localStorage.setItem("careos_notifications", "granted");
        } catch {
          // ignore
        }
        toast.success("Notifications enabled");
      } else {
        setNotifDenied(true);
        try {
          localStorage.setItem("careos_notifications", "denied");
        } catch {
          // ignore
        }
        toast.error("Notifications were blocked. Enable them in your browser settings.");
      }
    } catch {
      toast.error("Couldn't enable notifications");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const upcomingEvents = events.filter((e) => !isPastEvent(e));
  const pastEvents = events.filter((e) => isPastEvent(e));

  const showNotifButton =
    notifReady && !notifEnabled && !notifDenied && typeof Notification !== "undefined";

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Good {getTimeOfDay()},{" "}
              {user.displayName?.split(" ")[0] || user.email?.split("@")[0] || "there"}
            </h1>
            <p className="text-slate-500 mt-1">
              {familyGroup?.name
                ? `Managing ${familyGroup.name}`
                : "Set up your family group to get started"}
            </p>
          </div>
          {showNotifButton && (
            <button
              onClick={enableNotifications}
              className="flex items-center gap-2 border border-slate-200 bg-white text-slate-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              <Bell className="w-4 h-4" />
              Enable Notifications
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Pill className="w-5 h-5 text-rose-500" />}
            label="Meds Today"
            value={medications.length}
            subtext={
              todayMeds.length === 0 ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <Check className="w-3.5 h-3.5" />
                  All caught up
                </span>
              ) : (
                <span className="text-amber-600">
                  {todayMeds.length} remaining
                </span>
              )
            }
            onClick={() => router.push("/medications")}
            color="rose"
          />
          <StatCard
            icon={<CalendarDays className="w-5 h-5 text-blue-500" />}
            label="Upcoming"
            value={upcomingEvents.length}
            subtext={upcomingEvents.length === 0 ? "No events" : "This week"}
            onClick={() => router.push("/calendar")}
            color="blue"
          />
          <StatCard
            icon={<Users className="w-5 h-5 text-emerald-500" />}
            label="Members"
            value={familyGroup?.members?.length || 0}
            subtext="Active caregivers"
            onClick={() => router.push("/family")}
            color="emerald"
          />
          <StatCard
            icon={<Activity className="w-5 h-5 text-violet-500" />}
            label="Total Meds"
            value={medications.length}
            subtext="Being tracked"
            onClick={() => router.push("/medications")}
            color="violet"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {todayMeds.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-9 h-9 bg-rose-50 rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-rose-500" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Medications Due Today
                  </h2>
                </div>
                <div className="space-y-3">
                  {todayMeds.map((med) => (
                    <div
                      key={med.id}
                      className="flex items-center justify-between p-4 bg-rose-50/60 rounded-xl border border-rose-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                          <Pill className="w-5 h-5 text-rose-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{med.name}</p>
                          <p className="text-sm text-slate-500">
                            {med.dosage} — {frequencyLabel(med.frequency)} at {formatTime12h(med.times)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push("/medications")}
                        className="text-sm font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-3 py-2 hover:bg-rose-100 rounded-lg transition-colors"
                      >
                        Mark taken
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <CalendarDays className="w-5 h-5 text-blue-500" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">Upcoming Events</h2>
                </div>
                <button
                  onClick={() => router.push("/calendar")}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  View all
                </button>
              </div>
              {events.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>No events yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((ev) => (
                    <EventRow key={ev.id} ev={ev} onClick={() => router.push("/calendar")} />
                  ))}
                  {pastEvents.length > 0 && (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 pt-2">
                        Recently Past
                      </p>
                      {pastEvents.map((ev) => (
                        <EventRow key={ev.id} ev={ev} onClick={() => router.push("/calendar")} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-6 text-white">
              <h2 className="text-xl font-bold mb-2">Beta Access</h2>
              <p className="text-rose-100 text-sm leading-relaxed mb-4">
                CareOS is completely free during beta. Help us build the best care coordination tool and get lifetime free access.
              </p>
              <button className="bg-white text-rose-600 px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-rose-50 transition-colors w-full">
                Share Feedback
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <QuickAction
                  icon={<Pill className="w-4 h-4" />}
                  label="Add Medication"
                  onClick={() => router.push("/medications")}
                />
                <QuickAction
                  icon={<CalendarDays className="w-4 h-4" />}
                  label="Add Appointment"
                  onClick={() => router.push("/calendar")}
                />
                <QuickAction
                  icon={<Users className="w-4 h-4" />}
                  label="Invite Family"
                  onClick={() => router.push("/family")}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subtext, onClick, color }) {
  const colorMap = {
    rose: "bg-rose-50 text-rose-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <button
      onClick={onClick}
      className="bg-white p-5 rounded-2xl border border-slate-200 text-left hover:shadow-md hover:border-slate-300 transition-all w-full group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{subtext}</p>
    </button>
  );
}

function QuickAction({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
    >
      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
        {icon}
      </div>
      {label}
    </button>
  );
}

function EventRow({ ev, onClick }) {
  const status = getEventStatus(ev);
  const attended = status === "attended";
  const missed = status === "missed";
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
    >
      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
        <span className="text-sm font-bold text-slate-700">
          {new Date(ev.date).getDate()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`font-semibold truncate ${
            attended ? "text-slate-400 line-through" : "text-slate-900"
          }`}
        >
          {ev.title}
        </p>
        <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatTime12h(ev.time) || "All day"}
          </span>
          {ev.location && <span className="truncate">{ev.location}</span>}
        </div>
      </div>
      {attended && (
        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 flex-shrink-0 whitespace-nowrap">
          <Check className="w-4 h-4" />
          Attended
        </span>
      )}
      {missed && (
        <span className="flex items-center gap-1 text-xs font-semibold text-rose-600 flex-shrink-0 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5" />
          Missed — follow up?
        </span>
      )}
    </div>
  );
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

// Soft reminder beep using the Web Audio API (safe to fail silently)
function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume(); // may start suspended without a user gesture
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.5);
  } catch {
    // audio not available — ignore
  }
}
