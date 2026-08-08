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
  arrayUnion,
} from "firebase/firestore";
import Navbar from "@/components/Navbar";
import { Pill, Plus, Check, Clock, X, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";

export default function MedicationsPage() {
  const { user } = useAuth();
  const [familyGroup, setFamilyGroup] = useState(null);
  const [medications, setMedications] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newMed, setNewMed] = useState({
    name: "",
    dosage: "",
    frequency: "Daily",
    times: "08:00",
    notes: "",
  });
  const [expandedMed, setExpandedMed] = useState(null);

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

    const medQ = query(
      collection(db, "medications"),
      where("familyGroupId", "==", group.id)
    );
    const medSnap = await getDocs(medQ);
    setMedications(medSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  async function addMedication() {
    if (!newMed.name.trim() || !newMed.dosage.trim()) {
      toast.error("Please fill in medication name and dosage");
      return;
    }
    const ref = await addDoc(collection(db, "medications"), {
      ...newMed,
      familyGroupId: familyGroup.id,
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
      logs: [],
    });
    setMedications([
      ...medications,
      { id: ref.id, ...newMed, familyGroupId: familyGroup.id, logs: [] },
    ]);
    setShowAdd(false);
    setNewMed({ name: "", dosage: "", frequency: "Daily", times: "08:00", notes: "" });
    toast.success("Medication added!");
  }

  async function markTaken(medId) {
    const today = new Date().toISOString().split("T")[0];
    const medRef = doc(db, "medications", medId);
    const logEntry = {
      date: today,
      taken: true,
      takenBy: user.uid,
      timestamp: new Date().toISOString(),
    };
    await updateDoc(medRef, {
      logs: arrayUnion(logEntry),
    });
    setMedications((meds) =>
      meds.map((m) => {
        if (m.id !== medId) return m;
        return { ...m, logs: [...(m.logs || []), logEntry] };
      })
    );
    toast.success("Marked as taken!");
  }

  const today = new Date().toISOString().split("T")[0];

  const getTodayStatus = (med) => {
    const log = med.logs?.find((l) => l.date === today);
    return log?.taken || false;
  };

  const getStreak = (med) => {
    if (!med.logs || med.logs.length === 0) return 0;
    const sorted = [...med.logs]
      .filter((l) => l.taken)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sorted.length === 0) return 0;
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date);
      const curr = new Date(sorted[i].date);
      const diff = (prev - curr) / (1000 * 60 * 60 * 24);
      if (diff === 1) streak++;
      else break;
    }
    return streak;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Medications</h1>
            <p className="text-slate-500 mt-1">Track doses and never miss a medication.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm shadow-rose-200"
          >
            <Plus className="w-4 h-4" />
            Add Med
          </button>
        </div>

        {/* Add Form */}
        {showAdd && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Add Medication</h2>
              <button
                onClick={() => setShowAdd(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Medication Name</label>
                <input
                  placeholder="e.g., Lisinopril"
                  value={newMed.name}
                  onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Dosage</label>
                <input
                  placeholder="e.g., 10mg, 1 tablet"
                  value={newMed.dosage}
                  onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Frequency</label>
                <select
                  value={newMed.frequency}
                  onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 bg-white"
                >
                  <option>Daily</option>
                  <option>Twice daily</option>
                  <option>Weekly</option>
                  <option>As needed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Time</label>
                <input
                  type="time"
                  value={newMed.times}
                  onChange={(e) => setNewMed({ ...newMed, times: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes (optional)</label>
                <input
                  placeholder="e.g., Take with food"
                  value={newMed.notes}
                  onChange={(e) => setNewMed({ ...newMed, notes: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>
            <button
              onClick={addMedication}
              className="mt-5 w-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              Save Medication
            </button>
          </div>
        )}

        {/* Meds List */}
        <div className="space-y-4">
          {medications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Pill className="w-8 h-8 text-rose-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No medications yet</h3>
              <p className="text-slate-500">Add your first medication to start tracking.</p>
            </div>
          ) : (
            medications.map((med) => {
              const isTaken = getTodayStatus(med);
              const streak = getStreak(med);
              const isExpanded = expandedMed === med.id;
              return (
                <div
                  key={med.id}
                  className={`bg-white rounded-2xl border transition-all shadow-sm ${
                    isTaken ? "border-emerald-200" : "border-slate-200"
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isTaken ? "bg-emerald-50" : "bg-rose-50"
                          }`}
                        >
                          <Pill
                            className={`w-6 h-6 ${
                              isTaken ? "text-emerald-600" : "text-rose-600"
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-semibold text-slate-900">{med.name}</h3>
                            {isTaken && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-100">
                                <Check className="w-3 h-3" />
                                Taken today
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600 mt-0.5">{med.dosage}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {med.frequency} at {med.times}
                            </span>
                            {streak > 0 && (
                              <span className="text-amber-600 font-medium">
                                {streak} day streak
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!isTaken && (
                          <button
                            onClick={() => markTaken(med.id)}
                            className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-rose-200"
                          >
                            <Check className="w-4 h-4" />
                            Take
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedMed(isExpanded ? null : med.id)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 border-t border-slate-100">
                      {med.notes && (
                        <p className="text-sm text-slate-600 mb-3 bg-slate-50 p-3 rounded-lg">
                          <span className="font-medium">Note:</span> {med.notes}
                        </p>
                      )}
                      <p className="text-sm font-medium text-slate-700 mb-2">Recent History</p>
                      <div className="flex flex-wrap gap-2">
                        {med.logs && med.logs.length > 0 ? (
                          med.logs
                            .slice(-14)
                            .reverse()
                            .map((log, i) => (
                              <span
                                key={i}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                                  log.taken
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                    : "bg-slate-50 text-slate-500 border border-slate-100"
                                }`}
                              >
                                {log.taken ? <Check className="w-3 h-3" /> : null}
                                {new Date(log.date).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            ))
                        ) : (
                          <p className="text-sm text-slate-400">No history yet</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
