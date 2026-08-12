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
 * The family creator/admin is NEVER prompted — their role is auto-set to
 * "admin" when the group is created (and silently back-filled for groups
 * that predate roles), so only invite joiners without a role see the modal.
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
        if (g.memberRoles?.[user.uid]) return; // role already set — nothing to do
        // The creator/admin is never asked who they are: their identity is
        // already marked by createdBy (Admin crown). Silently back-fill an
        // "admin" role for legacy groups so the record is complete.
        if (g.createdBy === user.uid) {
          selfHealCreatorRole(g, user).catch(() => {
            // Best-effort — ignore failures.
          });
          return;
        }
        // Only invite joiners without a role are prompted — and only if they
        // haven't dismissed the modal via "Skip for now".
        if (hasSkippedRolePrompt()) return;
        setGroup(g);
        setOpen(true);
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

  // One-time self-heal: a creator whose group predates roles gets an "admin"
  // entry written silently (field-path write, own key only, so the rules and
  // concurrent member writes are unaffected). Idempotent — only called when
  // the entry is missing.
  async function selfHealCreatorRole(group, user) {
    const name = user.displayName || user.email?.split("@")[0] || "You";
    await updateDoc(doc(db, "familyGroups", group.id), {
      [`memberRoles.${user.uid}.role`]: "admin",
      [`memberRoles.${user.uid}.name`]: name,
    });
  }

  // "Skip for now" — dismisses the prompt without picking a role, and stops
  // it from re-opening (per device). The creator's silent self-heal still
  // runs regardless, so the record stays complete.
  function handleSkip() {
    try {
      localStorage.setItem("kinos_role_skipped", "true");
    } catch {
      // localStorage unavailable — the in-memory dismissal still stands.
    }
    setOpen(false);
  }

  function hasSkippedRolePrompt() {
    try {
      return localStorage.getItem("kinos_role_skipped") === "true";
    } catch {
      return false;
    }
  }

  if (loading || pending || !open || !group) return null;

  async function handleSelect(role) {
    setSaving(true);
    try {
      const name = user.displayName || user.email?.split("@")[0] || "Member";
      // Field-path write: atomic per field, never clobbers other members'
      // roles, and merges into an existing entry instead of replacing it.
      await updateDoc(doc(db, "familyGroups", group.id), {
        [`memberRoles.${user.uid}.role`]: role,
        [`memberRoles.${user.uid}.name`]: name,
      });
      // A saved role supersedes any previous "skip" — the memberRoles entry
      // now gates the prompt, so clear the flag so it can't suppress a future
      // prompt for a different family or a cleared entry.
      try {
        localStorage.removeItem("kinos_role_skipped");
      } catch {
        // Ignore — localStorage unavailable.
      }
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
      onSkip={handleSkip}
    />
  );
}
