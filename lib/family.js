// Shared helpers for family member roles.
//
// Data model: familyGroups/{id} keeps `members` as an array of UID strings so
// the existing `where("members", "array-contains", uid)` queries keep working
// (Firestore's array-contains cannot match objects inside an array). Each
// member's family role + display name live in a parallel map:
//
//   memberRoles: { [uid]: { role: "father" | "mother" | ... | custom, name: "Jatin" } }
//
// The group creator is additionally tracked by `createdBy` (admin badge).

export const FAMILY_ROLES = [
  { id: "father", label: "Father", emoji: "👨", possessive: "Dad's" },
  { id: "mother", label: "Mother", emoji: "👩", possessive: "Mom's" },
  { id: "brother", label: "Brother", emoji: "👦", possessive: "Brother's" },
  { id: "sister", label: "Sister", emoji: "👧", possessive: "Sister's" },
  { id: "son", label: "Son", emoji: "👶", possessive: "Son's" },
  { id: "daughter", label: "Daughter", emoji: "👧", possessive: "Daughter's" },
  { id: "other", label: "Other", emoji: "✏️", possessive: null },
];

export function getRoleMeta(role) {
  if (!role) return null;
  return FAMILY_ROLES.find((r) => r.id === role) || null;
}

export function getRoleLabel(role) {
  const meta = getRoleMeta(role);
  return meta ? meta.label : role; // fall back to a custom "other" value
}

export function getRoleEmoji(role) {
  return getRoleMeta(role)?.emoji || "👤";
}

// memberRoles map entry for a uid (or null when unset)
export function getMemberEntry(group, uid) {
  return group?.memberRoles?.[uid] || null;
}

// "Dad's" / "Mom's" / "Brother's" / custom "In-home caregiver's" / "" (no role)
export function getRolePossessive(group, uid) {
  const entry = getMemberEntry(group, uid);
  const role = entry?.role;
  const meta = getRoleMeta(role);
  if (meta?.possessive) return meta.possessive;
  // 'other' means the member typed a custom role — a bare 'other' (no custom
  // text) has no meaningful label, so let callers fall back to the name.
  if (!role || role === "admin" || role === "other") return "";
  const custom = String(role).trim();
  if (!custom) return "";
  return custom.endsWith("s") ? `${custom}'` : `${custom}'s`;
}

// "Dad's" for med labels; falls back to the member's name when no role exists.
export function getOwnerLabel(group, uid, fallbackName) {
  const poss = getRolePossessive(group, uid);
  if (poss) return poss;
  const entry = getMemberEntry(group, uid);
  const name = (entry?.name || fallbackName || "").trim();
  if (!name) return "";
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

// Best-effort display name for a member: stored name → self displayName → ""
export function getMemberName(group, uid, user) {
  const entry = getMemberEntry(group, uid);
  if (entry?.name) return entry.name;
  if (user && uid === user.uid) {
    return user.displayName || user.email?.split("@")[0] || "";
  }
  return "";
}
