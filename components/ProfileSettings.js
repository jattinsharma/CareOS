"use client";

import { useAuth } from "@/components/AuthProvider";
import { useEffect, useRef, useState } from "react";
import { db, storage, googleProvider } from "@/lib/firebase";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updateEmail,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { Bell, Camera, Loader2, Lock, Mail, Phone, Users } from "lucide-react";
import toast from "react-hot-toast";
import { getInitials } from "@/components/ProfileDropdown";
import {
  disableNotifications,
  enableNotifications,
  isMessagingSupported,
} from "@/lib/firebaseMessaging";

function friendlyAuthError(err) {
  const code = err?.code || "";
  const map = {
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Incorrect password. Please try again.",
    "auth/requires-recent-login": "Please sign in again to make this change.",
    "auth/email-already-in-use": "That email is already in use by another account.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[code] || err?.message || "Something went wrong. Please try again.";
}

/**
 * Profile settings page body — reads/writes /users/{uid} (Firestore) and the
 * Firebase Auth profile (displayName, photoURL, email, password).
 *
 * Every change syncs to BOTH Firebase Auth and Firestore /users/{uid}.
 * Sensitive changes (email, password) require re-authentication first.
 */
export default function ProfileSettings() {
  const { user, refreshUser } = useAuth();
  const photoInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({});

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [phone, setPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  const [families, setFamilies] = useState([]);
  const [defaultFamilyId, setDefaultFamilyId] = useState("");

  // Push-notification state (read from /users/{uid}, written by the client
  // messaging helpers).
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Re-auth gate for email/password changes: { mode: "email" | "password" }
  const [reauth, setReauth] = useState(null);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthSubmitting, setReauthSubmitting] = useState(false);

  const hasPassword = (user?.providerData || []).some(
    (p) => p.providerId === "password"
  );

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.exists() ? snap.data() : {};
      setProfile(data);
      setName(data.displayName || user.displayName || "");
      setPhone(data.phoneNumber || "");
      setDefaultFamilyId(data.defaultFamilyId || "");
    } catch {
      // Non-fatal — the form still renders with Auth profile values.
    }
    try {
      const q = query(
        collection(db, "familyGroups"),
        where("members", "array-contains", user.uid)
      );
      const famSnap = await getDocs(q);
      setFamilies(famSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      // Non-fatal — the default-family dropdown just stays empty.
    }
    try {
      setNotifSupported(await isMessagingSupported());
    } catch {
      setNotifSupported(false);
    }
    setLoading(false);
  }

  // A device is considered "on" when it has a registered token (the flag
  // defaults to true once a token exists).
  const notificationsEnabled =
    !!profile.fcmToken && profile.notificationsEnabled !== false;

  async function handleEnableNotifications() {
    setNotifBusy(true);
    try {
      const res = await enableNotifications(user);
      if (res.permission === "granted") {
        setProfile((p) => ({ ...p, notificationsEnabled: true }));
        toast.success("Medication reminders enabled for this device");
      } else {
        toast.error(
          "Notifications are blocked in your browser. Unblock KinOS in your site settings, then try again."
        );
      }
    } catch (err) {
      toast.error(err?.message || "Couldn't enable notifications");
    } finally {
      setNotifBusy(false);
    }
  }

  async function handleDisableNotifications() {
    setNotifBusy(true);
    try {
      await disableNotifications(user);
      setProfile((p) => ({ ...p, fcmToken: undefined, notificationsEnabled: false }));
      toast.success("Medication reminders turned off");
    } catch {
      toast.error("Couldn't turn off notifications");
    } finally {
      setNotifBusy(false);
    }
  }

  // Merge a patch into /users/{uid}. Guards the fields the rules require when
  // the doc doesn't exist yet (e.g. the signup attribution write failed).
  async function saveProfileField(patch) {
    const base = profile || {};
    await setDoc(
      doc(db, "users", user.uid),
      {
        ...patch,
        source: base.source || "direct",
        createdAt: base.createdAt || new Date().toISOString(),
      },
      { merge: true }
    );
  }

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Display name can't be empty");
      return;
    }
    setSavingName(true);
    try {
      await updateProfile(user, { displayName: trimmed });
      await saveProfileField({ displayName: trimmed });
      setProfile((p) => ({ ...p, displayName: trimmed }));
      await refreshUser();
      toast.success("Display name updated");
    } catch {
      toast.error("Couldn't update display name");
    } finally {
      setSavingName(false);
    }
  }

  async function handlePhotoFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }
    setPhotoUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "jpg";
      const fileRef = storageRef(
        storage,
        `avatars/${user.uid}/avatar-${Date.now()}.${ext}`
      );
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await updateProfile(user, { photoURL: url });
      await saveProfileField({ photoURL: url });
      setProfile((p) => ({ ...p, photoURL: url }));
      await refreshUser();
      toast.success("Profile photo updated");
    } catch {
      toast.error("Couldn't upload photo");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function savePhone() {
    setSavingPhone(true);
    try {
      const value = phone.trim();
      await saveProfileField({ phoneNumber: value });
      setProfile((p) => ({ ...p, phoneNumber: value }));
      toast.success("Phone number saved");
    } catch {
      toast.error("Couldn't save phone number");
    } finally {
      setSavingPhone(false);
    }
  }

  async function handleDefaultFamily(e) {
    const id = e.target.value;
    setDefaultFamilyId(id);
    try {
      // Clearing uses deleteField so the rules (which reject empty strings
      // for defaultFamilyId) keep passing.
      await saveProfileField(
        id ? { defaultFamilyId: id } : { defaultFamilyId: deleteField() }
      );
      setProfile((p) => ({
        ...p,
        ...(id ? { defaultFamilyId: id } : {}),
      }));
      toast.success("Default family updated");
    } catch {
      toast.error("Couldn't update default family");
    }
  }

  function startEmailChange(e) {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast.error("Enter your new email address");
      return;
    }
    setReauth({ mode: "email" });
  }

  function startPasswordChange(e) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setReauth({ mode: "password" });
  }

  // Re-authenticate (password credential, or Google popup for Google-only
  // accounts), then run the pending sensitive update.
  async function confirmReauth() {
    const mode = reauth.mode;
    if (hasPassword && !reauthPassword) {
      toast.error("Enter your current password");
      return;
    }
    setReauthSubmitting(true);
    try {
      if (hasPassword) {
        await reauthenticateWithCredential(
          user,
          EmailAuthProvider.credential(user.email, reauthPassword)
        );
      } else {
        await reauthenticateWithPopup(user, googleProvider);
      }

      if (mode === "email") {
        await updateEmail(user, newEmail.trim());
        toast.success("Email updated");
        setNewEmail("");
        setShowEmailForm(false);
      } else {
        await updatePassword(user, newPassword);
        toast.success("Password updated");
        setNewPassword("");
        setShowPasswordForm(false);
      }
      setReauth(null);
      setReauthPassword("");
      await refreshUser();
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setReauthSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
      </div>
    );
  }

  const initials = getInitials(user.displayName, user.email);

  return (
    <div className="space-y-6">
      {/* ---------- Photo + display name ---------- */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="relative flex-shrink-0">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt="Profile"
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-full object-cover border border-slate-200 shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-rose-500 text-white text-2xl font-bold flex items-center justify-center shadow-sm shadow-rose-200">
                {initials}
              </div>
            )}
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              aria-label="Upload profile photo"
              className="absolute -bottom-1 -right-1 w-9 h-9 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:opacity-60 rounded-full border-4 border-white flex items-center justify-center shadow-sm transition-colors"
            >
              {photoUploading ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Camera className="w-4 h-4 text-white" />
              )}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoFile}
            />
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
              />
              <button
                onClick={saveName}
                disabled={savingName}
                className="inline-flex items-center gap-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors flex-shrink-0"
              >
                {savingName && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Shown to your family and synced to your account.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Account (email / password / phone) ---------- */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Lock className="w-4 h-4 text-rose-500" />
          Account
        </h2>
        <p className="text-sm text-slate-500 mt-0.5 mb-3">
          Email, password, and contact details.
        </p>

        {/* Email */}
        <div className="flex items-center justify-between gap-4 py-4 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            <Mail className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700">Email address</p>
              <p className="text-sm text-slate-500 truncate mt-0.5">{user.email}</p>
              {!hasPassword && (
                <p className="text-xs text-slate-400 mt-1">
                  Signed in with Google — your email is managed by Google.
                </p>
              )}
            </div>
          </div>
          {hasPassword && (
            <button
              onClick={() => {
                setShowEmailForm((v) => !v);
                setShowPasswordForm(false);
              }}
              className="text-sm font-semibold text-rose-600 hover:text-rose-700 flex-shrink-0"
            >
              Change
            </button>
          )}
        </div>
        {showEmailForm && (
          <form onSubmit={startEmailChange} className="flex gap-2 py-3">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="New email address"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors flex-shrink-0"
            >
              Change email
            </button>
          </form>
        )}

        {/* Password */}
        <div className="flex items-center justify-between gap-4 py-4 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            <Lock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700">Password</p>
              <p className="text-sm text-slate-500 mt-0.5">••••••••</p>
            </div>
          </div>
          {hasPassword && (
            <button
              onClick={() => {
                setShowPasswordForm((v) => !v);
                setShowEmailForm(false);
              }}
              className="text-sm font-semibold text-rose-600 hover:text-rose-700 flex-shrink-0"
            >
              Change
            </button>
          )}
        </div>
        {showPasswordForm && (
          <form onSubmit={startPasswordChange} className="flex gap-2 py-3">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (6+ characters)"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors flex-shrink-0"
            >
              Update password
            </button>
          </form>
        )}

        {/* Phone */}
        <div className="py-4">
          <div className="flex items-start gap-3">
            <Phone className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700">Phone number</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Saved for future SMS refill reminders.
              </p>
              <div className="flex gap-2 mt-2.5">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                />
                <button
                  onClick={savePhone}
                  disabled={savingPhone}
                  className="inline-flex items-center gap-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors flex-shrink-0"
                >
                  {savingPhone && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Family preferences ---------- */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-rose-500" />
          Family preferences
        </h2>
        <p className="text-sm text-slate-500 mt-0.5 mb-4">
          Choose which family is used by default when you belong to more than one.
        </p>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Default family
        </label>
        <select
          value={defaultFamilyId}
          onChange={handleDefaultFamily}
          disabled={families.length === 0}
          className="w-full sm:w-80 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 bg-white disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="">No default family</option>
          {families.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        {families.length === 0 && (
          <p className="text-xs text-slate-400 mt-2">
            You&apos;re not in any family groups yet — create or join one from the
            Family page.
          </p>
        )}
      </section>

      {/* ---------- Medication reminders ---------- */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Bell className="w-4 h-4 text-rose-500" />
          Medication reminders
        </h2>
        <p className="text-sm text-slate-500 mt-0.5 mb-4">
          Push notifications when it&apos;s time for a dose — even when KinOS is
          closed.
        </p>

        {!notifSupported ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            Push notifications aren&apos;t supported in this browser yet — they work
            on Android Chrome and desktop Chrome/Edge/Firefox, but not iOS
            Safari.
          </p>
        ) : notificationsEnabled ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              Reminders are{" "}
              <span className="font-semibold text-emerald-600">on</span> for this
              device.
            </p>
            <button
              onClick={handleDisableNotifications}
              disabled={notifBusy}
              className="flex-shrink-0 border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
            >
              {notifBusy ? "Turning off…" : "Turn off"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              Reminders are{" "}
              <span className="font-semibold text-slate-400">off</span>.
            </p>
            <button
              onClick={handleEnableNotifications}
              disabled={notifBusy}
              className="flex-shrink-0 inline-flex items-center gap-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
            >
              <Bell className="w-4 h-4" />
              {notifBusy ? "Enabling…" : "Enable reminders"}
            </button>
          </div>
        )}
      </section>

      {/* ---------- Re-auth modal (email / password changes) ---------- */}
      {reauth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setReauth(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900">Confirm your identity</h3>
            <p className="text-sm text-slate-500 mt-1">
              {reauth.mode === "email"
                ? "Enter your current password to change your email address."
                : "Enter your current password to set a new one."}
            </p>
            {hasPassword ? (
              <input
                type="password"
                autoFocus
                placeholder="Current password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmReauth()}
                className="w-full mt-4 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
              />
            ) : (
              <p className="text-sm text-slate-500 mt-4">
                Re-authenticate with your Google account to continue.
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setReauth(null)}
                disabled={reauthSubmitting}
                className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60 py-3 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReauth}
                disabled={reauthSubmitting}
                className="flex-1 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                {reauthSubmitting
                  ? "Verifying…"
                  : hasPassword
                  ? "Verify & continue"
                  : "Continue with Google"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
