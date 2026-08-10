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
    const raw = localStorage.getItem("careos_utm");
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
      } catch {
        // Display name is cosmetic — don't block signup if it fails.
      }
    }
    saveAttribution(credential.user.uid);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ user, loginWithGoogle, loginWithEmail, signupWithEmail, logout, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
