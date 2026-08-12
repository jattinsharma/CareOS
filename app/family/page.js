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
import { Users, Copy, Check, Plus, UserPlus, Crown, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import RolePickerModal from "@/components/RolePickerModal";
import { getRoleLabel, getRoleEmoji } from "@/lib/family";
import { calculateMemberStreaks, calculateMemberMissStats } from "@/lib/streak";

// roleModal drives the shared role picker for two flows:
//   { mode: "join", id, data } — joining an existing group (role required)
//   { mode: "edit" }           — changing your own role later
// Creating a group never opens the picker: the creator's role is auto-set to
// "admin" in startCreate.
export default function FamilyPage() {
  const { user } = useAuth();
  const [familyGroup, setFamilyGroup] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleModal, setRoleModal] = useState(null);
  const [savingRole, setSavingRole] = useState(false);
  const [medications, setMedications] = useState([]);

  useEffect(() => {
    if (!user) return;
    checkFamilyGroup();
  }, [user]);

  async function checkFamilyGroup() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "familyGroups"),
        where("members", "array-contains", user.uid)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const group = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setFamilyGroup(group);
        loadMeds(group);
      }
    } catch {
      // Keep the page usable — a failed group query just leaves the
      // create/join UI on screen.
    }
    setLoading(false);
  }

  // Best-effort fetch of the group's medications for the per-member streak /
  // miss lines. A failure must never block the page (the group UI renders
  // fine without the stats).
  async function loadMeds(group) {
    try {
      const medQ = query(
        collection(db, "medications"),
        where("familyGroupId", "==", group.id)
      );
      const medSnap = await getDocs(medQ);
      setMedications(medSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      // ignore — the stats lines just won't show
    }
  }

  // Create the group directly — the creator is never asked to pick a role;
  // their identity is createdBy (Admin crown) and the stored role is "admin".
  async function startCreate() {
    if (!groupName.trim()) {
      toast.error("Please enter a family name");
      return;
    }
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const name = user.displayName || user.email?.split("@")[0] || "You";
    try {
      const ref = await addDoc(collection(db, "familyGroups"), {
        name: groupName.trim(),
        createdBy: user.uid,
        members: [user.uid],
        inviteCode: code,
        createdAt: new Date().toISOString(),
        memberRoles: { [user.uid]: { role: "admin", name } },
      });
      setFamilyGroup({
        id: ref.id,
        name: groupName.trim(),
        members: [user.uid],
        inviteCode: code,
        createdBy: user.uid,
        memberRoles: { [user.uid]: { role: "admin", name } },
      });
      loadMeds({ id: ref.id });
      toast.success("Family group created!");
    } catch {
      toast.error("Something went wrong — please try again");
    }
  }

  // Step 1 of join: validate the invite code, fetch the group, and open the
  // role picker. Membership is written only after they pick who they are.
  async function startJoin() {
    if (!joinCode.trim()) {
      toast.error("Please enter an invite code");
      return;
    }
    const q = query(
      collection(db, "familyGroups"),
      where("inviteCode", "==", joinCode.toUpperCase().trim())
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      toast.error("Invalid invite code");
      return;
    }
    const groupDoc = snap.docs[0];
    const groupData = groupDoc.data();
    if (groupData.members.includes(user.uid)) {
      toast.error("You're already in this group");
      return;
    }
    setRoleModal({ mode: "join", id: groupDoc.id, data: groupData });
  }

  // Step 2 for the join / edit flows: persist the chosen role (+ membership
  // for joins). The create flow never reaches here (startCreate auto-sets
  // the creator's "admin" role).
  async function handleRoleSelect(role) {
    setSavingRole(true);
    const name = user.displayName || user.email?.split("@")[0] || "Member";
    const entry = { role, name };
    try {
      if (roleModal.mode === "join") {
        const groupData = roleModal.data;
        // Field-path write so a concurrent join can never clobber another
        // member's freshly-written role entry (atomic per key).
        await updateDoc(doc(db, "familyGroups", roleModal.id), {
          members: arrayUnion(user.uid),
          [`memberRoles.${user.uid}`]: entry,
        });
        setFamilyGroup({
          id: roleModal.id,
          ...groupData,
          members: [...groupData.members, user.uid],
          memberRoles: { ...(groupData.memberRoles || {}), [user.uid]: entry },
        });
        loadMeds({ id: roleModal.id });
        toast.success("Joined family group!");
      } else {
        await updateDoc(doc(db, "familyGroups", familyGroup.id), {
          [`memberRoles.${user.uid}`]: entry,
        });
        setFamilyGroup((g) => ({
          ...g,
          memberRoles: { ...(g.memberRoles || {}), [user.uid]: entry },
        }));
        toast.success("Role saved!");
      }
      setRoleModal(null);
    } catch {
      toast.error("Something went wrong — please try again");
    } finally {
      setSavingRole(false);
    }
  }

  const copyCode = () => {
    if (!familyGroup?.inviteCode) return;
    navigator.clipboard.writeText(familyGroup.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Invite code copied!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Family Group</h1>
        <p className="text-slate-500 mb-8">
          Create or join a family group to start coordinating care together.
        </p>

        {!familyGroup ? (
          <div className="space-y-6">
            {/* Create */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                  <Plus className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Create a New Group</h2>
                  <p className="text-sm text-slate-500">Start a new family care group</p>
                </div>
              </div>
              <input
                type="text"
                placeholder="e.g., The Johnson Family"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startCreate()}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent mb-4 text-slate-900 placeholder:text-slate-400"
              />
              <button
                onClick={startCreate}
                className="w-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                Create Group
              </button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-slate-50 text-slate-400 font-medium">or</span>
              </div>
            </div>

            {/* Join */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Join with Code</h2>
                  <p className="text-sm text-slate-500">Enter a 6-character invite code</p>
                </div>
              </div>
              <input
                type="text"
                placeholder="e.g., A1B2C3"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && startJoin()}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4 text-slate-900 placeholder:text-slate-400 uppercase tracking-widest font-mono"
                maxLength={6}
              />
              <button
                onClick={startJoin}
                className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                Join Group
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{familyGroup.name}</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {familyGroup.members.length} member{familyGroup.members.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-rose-600" />
              </div>
            </div>

            {/* Invite Code */}
            <div className="bg-slate-50 rounded-xl p-5 mb-6 border border-slate-100">
              <p className="text-sm font-medium text-slate-600 mb-3">Invite Code</p>
              <div className="flex items-center gap-3">
                <code className="text-3xl font-mono font-bold text-slate-900 tracking-[0.2em] bg-white px-5 py-3 rounded-lg border border-slate-200 flex-1 text-center">
                  {familyGroup.inviteCode}
                </code>
                <button
                  onClick={copyCode}
                  className="p-3.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                  title="Copy invite code"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Copy className="w-5 h-5 text-slate-500" />
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Share this code with family members so they can join your group.
              </p>
            </div>

            {/* Members */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                Members
              </h3>
              <div className="space-y-2">
                {familyGroup.members.map((memberId, i) => {
                  const entry = familyGroup.memberRoles?.[memberId];
                  const isYou = memberId === user.uid;
                  const isAdmin = memberId === familyGroup.createdBy;
                  const name =
                    entry?.name || (isYou ? user.displayName || user.email?.split("@")[0] || "" : "");
                  const roleLabel = entry ? getRoleLabel(entry.role) : null;
                  const roleEmoji = entry ? getRoleEmoji(entry.role) : null;
                  const initial = (name || (isYou ? "Y" : `M${i + 1}`))[0].toUpperCase();
                  const memberMeds = medications.filter(
                    (m) => (m.ownerUid || m.createdBy) === memberId
                  );
                  const memberStreak = calculateMemberStreaks(medications, memberId);
                  const memberMiss = calculateMemberMissStats(medications, memberId);
                  return (
                    <div
                      key={memberId}
                      className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100"
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm text-sm font-bold ${
                          isYou ? "bg-rose-100 text-rose-700" : "bg-white text-slate-600"
                        }`}
                      >
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900">
                            {isYou ? (name ? `You (${name})` : "You") : name || `Member ${i + 1}`}
                          </span>
                          {/* The creator's stored "admin" role is already shown
                              by the crown badge — don't render a duplicate chip. */}
                          {roleLabel && entry.role !== "admin" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full border border-slate-200">
                              {roleEmoji} {roleLabel}
                            </span>
                          )}
                          {isAdmin && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-100">
                              <Crown className="w-3 h-3" />
                              Admin
                            </span>
                          )}
                        </div>
                        {memberMeds.length > 0 && (
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2.5 flex-wrap">
                            <span>
                              🔥 {memberStreak.current} day streak
                            </span>
                            <span
                              className={
                                memberMiss.weeklyMisses > 0
                                  ? "text-red-600 font-medium"
                                  : ""
                              }
                            >
                              ❌ {memberMiss.weeklyMisses} miss
                              {memberMiss.weeklyMisses === 1 ? "" : "es"} this week
                            </span>
                          </p>
                        )}
                      </div>
                      {isYou && !entry && (
                        <button
                          onClick={() => setRoleModal({ mode: "edit" })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-full border border-amber-200 transition-colors flex-shrink-0"
                        >
                          Set my role
                        </button>
                      )}
                      {isYou && entry && (
                        <button
                          onClick={() => setRoleModal({ mode: "edit" })}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
                          title="Change my role"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shared role picker (create / join / edit) */}
      <RolePickerModal
        open={!!roleModal}
        title={
          roleModal?.mode === "join"
            ? `Join ${roleModal.data?.name}`
            : "Tell us who you are"
        }
        ctaLabel={roleModal?.mode === "join" ? "Join Family" : "Save"}
        closable={false}
        submitting={savingRole}
        onSelect={handleRoleSelect}
      />
    </div>
  );
}
