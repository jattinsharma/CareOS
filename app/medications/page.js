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
  arrayRemove,
  arrayUnion,
} from "firebase/firestore";
import Navbar from "@/components/Navbar";
import {
  Pill,
  Plus,
  Check,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  formatTime12h,
  nowRounded15,
  FREQUENCY_OPTIONS,
  frequencyLabel,
} from "@/lib/medUtils";
import TimePicker from "@/components/TimePicker";
import { getMedStatus, findLogForDate } from "@/lib/medStatus";
import {
  medStreak,
  isScheduledOn,
  isTakenOn,
  medHistoryStats,
  medLifetimeMisses,
} from "@/lib/streak";
import { markMedTaken, markMedMissed, reconcileAutoMissed } from "@/lib/medActions";
import { toDateKey } from "@/lib/eventUtils";
import {
  getOwnerLabel,
  getMemberName,
  getRoleEmoji,
  getRoleLabel,
  getMemberEntry,
} from "@/lib/family";

export default function MedicationsPage() {
  const { user } = useAuth();
  const [familyGroup, setFamilyGroup] = useState(null);
  const [medications, setMedications] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newMed, setNewMed] = useState({
    name: "",
    dosage: "",
    frequency: "Daily",
    times: nowRounded15(),
    notes: "",
    ownerUid: "",
  });
  const [expandedMed, setExpandedMed] = useState(null);
  const [editingMed, setEditingMed] = useState(null); // med id being edited, null = add mode
  const [selectedDay, setSelectedDay] = useState(null); // week-history day key
  const [ownerFilter, setOwnerFilter] = useState("all"); // med owner uid filter

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
    const meds = medSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setMedications(meds);

    // Auto-record fully-past doses as missed so history and streaks stay
    // accurate even when nobody opened the app overnight. Best-effort: a
    // transient failure must not block the page.
    reconcileAutoMissed(meds)
      .then((updated) => {
        if (!updated.size) return;
        setMedications((cur) =>
          cur.map((m) =>
            updated.has(m.id)
              ? { ...m, logs: [...(m.logs || []), updated.get(m.id)] }
              : m
          )
        );
      })
      .catch(() => {
        // Reconcile is best-effort — ignore failures.
      });
  }

  async function handleSubmit() {
    if (!newMed.name.trim() || !newMed.dosage.trim()) {
      toast.error("Please fill in medication name and dosage");
      return;
    }
    if (editingMed) {
      const target = medications.find((m) => m.id === editingMed);
      if (!target) {
        toast.error("Medication not found");
        return;
      }
      const medRef = doc(db, "medications", editingMed);
      await updateDoc(medRef, {
        ...newMed,
        ownerUid: newMed.ownerUid || target.ownerUid || target.createdBy || user.uid,
        // The rules validate the full resulting document on update and require
        // identity fields + logs to match the existing doc — carry them over.
        familyGroupId: target.familyGroupId,
        createdBy: target.createdBy,
        createdAt: target.createdAt,
        logs: target.logs || [],
      });
      setMedications((meds) =>
        meds.map((m) => (m.id === editingMed ? { ...m, ...newMed } : m))
      );
      toast.success("Medication updated");
    } else {
      const ref = await addDoc(collection(db, "medications"), {
        ...newMed,
        ownerUid: newMed.ownerUid || user.uid,
        familyGroupId: familyGroup.id,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        logs: [],
      });
      setMedications([
        ...medications,
        { id: ref.id, ...newMed, familyGroupId: familyGroup.id, logs: [] },
      ]);
      toast.success("Medication added!");
    }
    setShowAdd(false);
    resetForm();
  }

  function resetForm() {
    setEditingMed(null);
    setNewMed({
      name: "",
      dosage: "",
      frequency: "Daily",
      times: nowRounded15(),
      notes: "",
      ownerUid: user?.uid || "",
    });
  }

  function openEdit(med) {
    setNewMed({
      name: med.name || "",
      dosage: med.dosage || "",
      frequency: med.frequency || "Daily",
      times: med.times || nowRounded15(),
      notes: med.notes || "",
      ownerUid: med.ownerUid || med.createdBy || user?.uid || "",
    });
    setEditingMed(med.id);
    setShowAdd(true);
    // The form renders above the list — bring it into view when editing a
    // card further down the page.
    setTimeout(() => {
      document.getElementById("med-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function markTaken(medId) {
    try {
      const entry = await markMedTaken(medId, user);
      setMedications((meds) =>
        meds.map((m) => (m.id === medId ? { ...m, logs: [...(m.logs || []), entry] } : m))
      );
      toast.success("Marked as taken!");
    } catch {
      toast.error("Couldn't update medication");
    }
  }

  async function markMissed(medId) {
    try {
      const entry = await markMedMissed(medId, user);
      setMedications((meds) =>
        meds.map((m) => (m.id === medId ? { ...m, logs: [...(m.logs || []), entry] } : m))
      );
      toast("Marked as missed", { icon: "✗" });
    } catch {
      toast.error("Couldn't update medication");
    }
  }

  // Retroactively mark an auto-missed dose as taken (yesterday only). The
  // existing auto-missed log is removed first (separate atomic ops) so a
  // concurrent caregiver write is never clobbered and history shows one outcome.
  async function markTakenRetro(med, dateKey) {
    try {
      const existing = findLogForDate(med, dateKey);
      const ts = new Date().toISOString();
      const entry = { date: dateKey, taken: true, takenBy: user.uid, timestamp: ts, takenAt: ts };
      const medRef = doc(db, "medications", med.id);
      if (existing) {
        await updateDoc(medRef, { logs: arrayRemove(existing) });
      }
      await updateDoc(medRef, { logs: arrayUnion(entry) });
      setMedications((cur) =>
        cur.map((m) =>
          m.id === med.id
            ? { ...m, logs: [...(m.logs || []).filter((l) => l !== existing), entry] }
            : m
        )
      );
      toast.success("Marked as taken");
    } catch {
      toast.error("Couldn't update medication");
    }
  }

  const todayKey = toDateKey(new Date());
  const yesterdayKey = toDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

  // Family members (with roles) for the "Who is this for?" selector.
  const memberOptions = (familyGroup?.members || []).map((uid) => {
    const entry = getMemberEntry(familyGroup, uid);
    const name = getMemberName(familyGroup, uid, user) || "Member";
    const label = entry
      ? `${getRoleEmoji(entry.role)} ${getRoleLabel(entry.role)} (${name})`
      : name;
    return { uid, label };
  });

  // Distinct med owners for the filter chips ("All | Dad's | Mom's | …").
  const ownerChips = [
    ...new Set(medications.map((m) => m.ownerUid || m.createdBy)),
  ]
    .map((uid) => ({
      uid,
      label: getOwnerLabel(
        familyGroup,
        uid,
        getMemberName(familyGroup, uid, user)
      ),
      emoji: getRoleEmoji(getMemberEntry(familyGroup, uid)?.role),
    }))
    .filter((c) => c.label);

  const visibleMeds =
    ownerFilter === "all"
      ? medications
      : medications.filter((m) => (m.ownerUid || m.createdBy) === ownerFilter);

  // Aggregate per-day status for the "This Week" view.
  function daySummary(dayKey) {
    const required = medications.filter((m) => isScheduledOn(m, dayKey));
    const taken = required.filter((m) => isTakenOn(m, dayKey)).length;
    const missed = required.filter((m) => {
      const log = findLogForDate(m, dayKey);
      return !!log && !!log.missed;
    }).length;
    return { required: required.length, taken, missed };
  }

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return toDateKey(d);
  });

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
            onClick={() => {
              resetForm();
              setShowAdd(true);
            }}
            className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm shadow-rose-200"
          >
            <Plus className="w-4 h-4" />
            Add Med
          </button>
        </div>

        {/* Add Form */}
        {showAdd && (
          <div id="med-form" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingMed ? "Edit Medication" : "Add Medication"}
              </h2>
              <button
                onClick={() => {
                  setShowAdd(false);
                  resetForm();
                }}
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
                  {FREQUENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Time</label>
                <TimePicker
                  value={newMed.times}
                  onChange={(t) => setNewMed({ ...newMed, times: t })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Who is this for?
                </label>
                <select
                  value={newMed.ownerUid || user?.uid || ""}
                  onChange={(e) => setNewMed({ ...newMed, ownerUid: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 bg-white"
                >
                  {memberOptions.map((o) => (
                    <option key={o.uid} value={o.uid}>
                      {o.label}
                    </option>
                  ))}
                </select>
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
              onClick={handleSubmit}
              className="mt-5 w-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              {editingMed ? "Update Medication" : "Save Medication"}
            </button>
          </div>
        )}

        {/* Owner filter — "All | Dad's | Mom's | …" */}
        {ownerChips.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setOwnerFilter("all")}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                ownerFilter === "all"
                  ? "bg-rose-500 text-white border-rose-500"
                  : "bg-white text-slate-600 border-slate-200 hover:border-rose-300 hover:text-rose-600"
              }`}
            >
              All
            </button>
            {ownerChips.map((c) => (
              <button
                key={c.uid}
                onClick={() => setOwnerFilter(ownerFilter === c.uid ? "all" : c.uid)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  ownerFilter === c.uid
                    ? "bg-rose-500 text-white border-rose-500"
                    : "bg-white text-slate-600 border-slate-200 hover:border-rose-300 hover:text-rose-600"
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
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
          ) : visibleMeds.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
              <p className="text-slate-500">No medications for this family member yet.</p>
            </div>
          ) : (
            visibleMeds.map((med) => {
              const status = getMedStatus(med);
              const isTaken = status.state === "taken";
              const isMissed = status.state === "missed";
              const isOverdue = status.state === "overdue";
              const isDue = status.state === "due";
              const streak = medStreak(med);
              const hStats = medHistoryStats(med);
              const lifetimeMisses = medLifetimeMisses(med);
              const isExpanded = expandedMed === med.id;
              const ownerUid = med.ownerUid || med.createdBy;
              const ownerLabel = getOwnerLabel(
                familyGroup,
                ownerUid,
                getMemberName(familyGroup, ownerUid, user)
              );
              const ownerEmoji = getRoleEmoji(getMemberEntry(familyGroup, ownerUid)?.role);

              const cardBorder = isTaken
                ? "border-emerald-200"
                : isMissed
                ? "border-red-200"
                : isOverdue
                ? "border-red-200"
                : isDue
                ? "border-rose-200"
                : "border-slate-200";

              const iconBox = isTaken
                ? "bg-emerald-50"
                : isMissed || isOverdue
                ? "bg-red-50"
                : isDue
                ? "bg-rose-50"
                : "bg-slate-100";

              const iconColor = isTaken
                ? "text-emerald-600"
                : isMissed || isOverdue
                ? "text-red-600"
                : isDue
                ? "text-rose-600"
                : "text-slate-500";

              return (
                <div
                  key={med.id}
                  className={`bg-white rounded-2xl border transition-all shadow-sm ${cardBorder}`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBox}`}
                        >
                          <Pill className={`w-6 h-6 ${iconColor}`} />
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
                            {isMissed && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-100">
                                <X className="w-3 h-3" />
                                Missed today
                              </span>
                            )}
                            {isOverdue && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-200 animate-pulse">
                                <AlertTriangle className="w-3 h-3" />
                                Overdue
                              </span>
                            )}
                            {isDue && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 text-xs font-medium rounded-full border border-rose-200 animate-pulse">
                                Take now
                              </span>
                            )}
                            {status.state === "upcoming" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-500 text-xs font-medium rounded-full border border-slate-200">
                                <Clock className="w-3 h-3" />
                                Due at {formatTime12h(med.times)}
                              </span>
                            )}
                            {ownerLabel && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-500 text-xs font-medium rounded-full border border-slate-200"
                                title={`For ${getMemberName(familyGroup, ownerUid, user)}`}
                              >
                                {ownerEmoji} {ownerLabel}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600 mt-0.5">{med.dosage}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {frequencyLabel(med.frequency)} at {formatTime12h(med.times)}
                            </span>
                            {isTaken && status.log && (
                              <span className="text-emerald-600 font-medium">
                                Taken at {formatLogTime(status.log)}
                              </span>
                            )}
                            {streak > 0 && (
                              <span className="text-amber-600 font-medium">
                                {streak} day streak
                              </span>
                            )}
                            {lifetimeMisses > 0 && (
                              <span className="text-red-600 font-medium">
                                ❌ Missed {lifetimeMisses} time
                                {lifetimeMisses === 1 ? "" : "s"} total
                              </span>
                            )}
                            {hStats.total > 0 && (
                              <span
                                className={`font-medium ${
                                  hStats.rate >= 80
                                    ? "text-emerald-600"
                                    : hStats.rate >= 50
                                    ? "text-amber-600"
                                    : "text-red-600"
                                }`}
                                title={`${hStats.taken} taken, ${hStats.missed} missed over the last 90 days`}
                              >
                                📊 {hStats.rate}% adherence
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!isTaken && !isMissed && !isOverdue && (
                          <button
                            onClick={() => markTaken(med.id)}
                            className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-rose-200"
                          >
                            <Check className="w-4 h-4" />
                            {isDue ? "Take now" : "Take"}
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(med)}
                          aria-label="Edit medication"
                          title="Edit"
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4 text-slate-400" />
                        </button>
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

                  {/* Overdue banner — the user decides, nothing is auto-marked */}
                  {isOverdue && (
                    <div className="mx-5 mb-5 -mt-2 rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <p className="text-sm font-semibold text-red-700">
                          Overdue — did you take {med.name}?
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => markTaken(med.id)}
                          className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          Yes, I took it
                        </button>
                        <button
                          onClick={() => markMissed(med.id)}
                          className="inline-flex items-center gap-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-300 hover:border-red-400 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                          <X className="w-4 h-4" />
                          No, I missed it
                        </button>
                      </div>
                    </div>
                  )}

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
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                                  log.taken
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    : log.missed
                                    ? "bg-red-50 text-red-600 border-red-100"
                                    : "bg-slate-50 text-slate-500 border-slate-100"
                                }`}
                              >
                                {log.taken ? <Check className="w-3 h-3" /> : null}
                                {!log.taken && log.missed ? <X className="w-3 h-3" /> : null}
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

        {/* This Week — per-day summary of all meds */}
        {medications.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mt-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">This Week</h2>
            <div className="flex flex-wrap gap-2">
              {last7Days.map((dayKey) => {
                const s = daySummary(dayKey);
                const isFuture = dayKey > todayKey;
                let label, cls;
                if (isFuture) {
                  label = "Scheduled";
                  cls = "bg-slate-50 text-slate-500 border-slate-200";
                } else if (s.required === 0) {
                  label = "No meds";
                  cls = "bg-slate-50 text-slate-400 border-slate-100";
                } else if (s.taken === s.required) {
                  label = `All taken (${s.taken}/${s.required})`;
                  cls = "bg-emerald-50 text-emerald-700 border-emerald-100";
                } else if (s.taken === 0 && s.missed === s.required) {
                  label = "Missed";
                  cls = "bg-red-50 text-red-600 border-red-100";
                } else if (s.taken > 0 || s.missed > 0) {
                  label = `${s.taken}/${s.required} taken`;
                  cls = "bg-amber-50 text-amber-700 border-amber-100";
                } else {
                  label = "Pending";
                  cls = "bg-slate-50 text-slate-500 border-slate-200";
                }
                const clickable = !isFuture && s.required > 0;
                const isSelected = selectedDay === dayKey;
                return (
                  <button
                    key={dayKey}
                    onClick={() => setSelectedDay(isSelected ? null : dayKey)}
                    disabled={!clickable}
                    className={`text-left rounded-xl border px-3 py-2 transition-all ${
                      isSelected ? "ring-2 ring-rose-400 border-rose-300" : ""
                    } ${cls} ${clickable ? "hover:shadow-sm cursor-pointer" : "cursor-default opacity-90"}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      {new Date(dayKey + "T12:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                      })}
                    </p>
                    <p className="text-sm font-bold mt-0.5">
                      {new Date(dayKey + "T12:00:00").getDate()}
                    </p>
                    <p className="text-[11px] mt-0.5 font-medium">{label}</p>
                  </button>
                );
              })}
            </div>

            {selectedDay &&
              (() => {
                const s = daySummary(selectedDay);
                const dayMeds = medications.filter((m) => isScheduledOn(m, selectedDay));
                return (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold text-slate-900">
                        {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <span className="text-sm text-slate-500">
                        {s.taken}/{s.required} taken
                      </span>
                    </div>
                    <div className="space-y-2">
                      {dayMeds.length === 0 ? (
                        <p className="text-sm text-slate-400">No medications scheduled.</p>
                      ) : (
                        dayMeds.map((m) => {
                          const log = findLogForDate(m, selectedDay);
                          const retro = selectedDay === yesterdayKey && log?.autoMissed;
                          return (
                            <div
                              key={m.id}
                              className="flex items-center justify-between gap-3 py-2 px-3 bg-slate-50 rounded-lg"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">
                                  {m.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {m.dosage} · {formatTime12h(m.times)}
                                </p>
                              </div>
                              {log?.taken ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 flex-shrink-0">
                                  <Check className="w-3.5 h-3.5" />
                                  Taken {formatLogTime(log)}
                                </span>
                              ) : log?.missed ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 flex-shrink-0">
                                  <X className="w-3.5 h-3.5" />
                                  {log.autoMissed ? "Missed (auto)" : "Missed"}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 flex-shrink-0">
                                  Pending
                                </span>
                              )}
                              {retro && (
                                <button
                                  onClick={() => markTakenRetro(m, selectedDay)}
                                  className="text-xs font-semibold text-emerald-600 border border-emerald-200 bg-white hover:bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
                                >
                                  Mark taken
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}
          </div>
        )}
      </div>
    </div>
  );
}

// "8:45 PM" from a log's taken timestamp (falls back to the log timestamp).
function formatLogTime(log) {
  const ts = log?.takenAt || log?.timestamp;
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
