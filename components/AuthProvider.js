"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";

// Read UTM attribution captured on the marketing page (if any) and persist it
// to the user's Firestore profile. Best-effort — a failure must never break
// the sign-in flow.
async function saveAttribution(uid) {
  try {
    let source = "direct";
    let medium = "";
    let campaign = "";
    const raw = localStorage.getItem("kinos_utm");
    if (raw) {
      try {
        const utm = JSON.parse(raw);
        if (utm.source) source = utm.source;
        if (utm.medium) medium = utm.medium;
        if (utm.campaign) campaign = utm.campaign;
      } catch {
        // Malformed stored value — fall through to the defaults.
      }
    }
    await setDoc(
      doc(db, "users", uid),
      { source, medium, campaign, createdAt: new Date().toISOString() },
      { merge: true }
    );
  } catch {
    // Attribution is best-effort — ignore failures.
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      // kinos_session is ONLY a routing hint for middleware.js ("this device
      // had a logged-in user"). It never contains the Firebase ID token —
      // that stays client-side and expires hourly. Middleware reads it to
      // redirect logged-in users off the landing/login pages before they
      // render; Firebase itself remains the source of truth.
      if (typeof window !== "undefined") {
        if (currentUser) {
          document.cookie =
            "kinos_session=true; path=/; max-age=2592000; SameSite=Lax";
        } else {
          // Explicit logout (or an expired/stale session) clears the hint.
          document.cookie = "kinos_session=; path=/; max-age=0";
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const credential = await signInWithPopup(auth, googleProvider);
    // Fire-and-forget: attribution must never delay the sign-in redirect.
    saveAttribution(credential.user.uid);
  };

  const loginWithEmail = async (email, password) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    saveAttribution(credential.user.uid);
  };

  const signupWithEmail = async (email, password, name) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      try {
        await updateProfile(credential.user, { displayName: name });
      } catch (err) {
        // Display name is cosmetic — don't block signup if it fails.
        console.error("updateProfile failed (display name not saved):", err);
      }
    }
    saveAttribution(credential.user.uid);
  };

  const logout = async () => {
    await signOut(auth);
  };

  // Re-read the current Firebase user (e.g. after updateProfile) so the UI
  // (navbar avatar, name) reflects the latest auth state immediately.
  const refreshUser = async () => {
    const current = auth.currentUser;
    if (!current) return;
    await current.reload();
    setUser({ ...current });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
        logout,
        loading,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
