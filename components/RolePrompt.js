"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import RolePickerModal from "@/components/RolePickerModal";
import toast from "react-hot-toast";

/**
 * Migration prompt: members who joined before roles existed have no
 * memberRoles entry. On next login we ask them to pick who they are so the
 * family page can show names + roles instead of "Member 2".
 *
 * Mounted once in the root layout, above every page. Best-effort: a fetch
 * failure must never block the app.
 */
export default function RolePrompt() {
  const { user, loading } = useAuth();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      setPending(true);
      try {
        const q = query(
          collection(db, "familyGroups"),
          where("members", "array-contains", user.uid)
        );
        const snap = await getDocs(q);
        if (cancelled || snap.empty) return;
        const g = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setGroup(g);
        // No role entry → prompt (covers the group creator and every member
        // who joined before this feature existed).
        if (!g.memberRoles?.[user.uid]) setOpen(true);
      } catch {
        // Best-effort — ignore failures.
      } finally {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  if (loading || pending || !open || !group) return null;

  async function handleSelect(role) {
    setSaving(true);
    try {
      const name = user.displayName || user.email?.split("@")[0] || "Member";
      // Field-path write: atomic per key, never clobbers other members' roles.
      await updateDoc(doc(db, "familyGroups", group.id), {
        [`memberRoles.${user.uid}`]: { role, name },
      });
      setOpen(false);
      toast.success("Thanks! Your role is saved.");
    } catch {
      toast.error("Couldn't save your role — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <RolePickerModal
      open
      title="Tell us who you are"
      familyName={group.name}
      ctaLabel="Save"
      closable={false}
      submitting={saving}
      onSelect={handleSelect}
    />
  );
}
