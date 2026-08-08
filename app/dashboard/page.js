"use client";

import { useAuth } from "@/components/AuthProvider";
import { useEffect, useState } from "react";
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
} from "lucide-react";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [familyGroup, setFamilyGroup] = useState(null);
  const [medications, setMedications] = useState([]);
  const [events, setEvents] = useState([]);
  const [todayMeds, setTodayMeds] = useState([]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

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

    const evQ = query(
      collection(db, "events"),
      where("familyGroupId", "==", group.id),
      orderBy("date", "asc"),
      limit(5)
    );
    const evSnap = await getDocs(evQ);
    setEvents(evSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const upcomingEvents = events.filter(
    (e) => new Date(e.date) >= new Date(new Date().toISOString().split("T")[0])
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Pill className="w-5 h-5 text-rose-500" />}
            label="Meds Today"
            value={todayMeds.length}
            subtext={todayMeds.length === 0 ? "All caught up" : `${todayMeds.length} pending`}
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
                            {med.dosage} — {med.frequency} at {med.times}
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
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>No upcoming events</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() => router.push("/calendar")}
                    >
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                        <span className="text-sm font-bold text-slate-700">
                          {new Date(ev.date).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{ev.title}</p>
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {ev.time || "All day"}
                          </span>
                          {ev.location && (
                            <span className="truncate">{ev.location}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
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

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
