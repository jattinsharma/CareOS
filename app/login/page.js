"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Heart,
  Pill,
  CalendarDays,
  FolderOpen,
  Users,
  Shield,
} from "lucide-react";

function friendlyAuthError(err) {
  const code = err?.code || "";
  const map = {
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/unauthorized-domain":
      "This domain isn't authorized for sign-in yet. Add it in Firebase Console → Authentication → Settings → Authorized domains.",
    "auth/operation-not-allowed":
      "This sign-in method isn't enabled. Enable it in Firebase Console → Authentication → Sign-in method.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/email-already-in-use": "An account with this email already exists.",
  };
  return map[code] || err?.message || "Something went wrong. Please try again.";
}

const features = [
  { icon: Pill, label: "Medication tracking", desc: "Daily doses, streaks, and shared history" },
  { icon: CalendarDays, label: "Shared calendar", desc: "Appointments & refills for the whole family" },
  { icon: Users, label: "Family groups", desc: "Invite caregivers with a simple code" },
  { icon: FolderOpen, label: "Document vault", desc: "Insurance cards & records, always handy" },
];

export default function LoginPage() {
  const { loginWithGoogle, loginWithEmail, signupWithEmail } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  // Separate loading states so a hung/cancelled Google popup can never disable
  // the email form (and vice versa).
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  // Fallback message if the email form has been submitting for >10s.
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (!emailLoading) {
      setStuck(false);
      return;
    }
    const timer = setTimeout(() => setStuck(true), 10000);
    return () => clearTimeout(timer);
  }, [emailLoading]);

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      toast.success("Signed in with Google!");
      router.push("/dashboard");
    } catch (err) {
      console.error("Google sign-in error:", err);
      console.error("Error code:", err?.code, "Message:", err?.message);
      toast.error(friendlyAuthError(err));
    } finally {
      console.log("Google finally running");
      setGoogleLoading(false);
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    console.log("Form submitted, tab:", tab);
    console.log("Name:", name, "Email:", email, "Password length:", password?.length);
    console.log("Loading before:", { googleLoading, emailLoading });

    if (!email || !password) {
      toast.error("Please fill in all fields.");
      return;
    }
    setEmailLoading(true);
    try {
      if (tab === "signin") {
        await loginWithEmail(email, password);
        toast.success("Welcome back!");
      } else {
        if (!name) {
          toast.error("Please enter your name.");
          setEmailLoading(false);
          return;
        }
        await signupWithEmail(email, password, name);
        toast.success("Account created!");
      }
      router.push("/dashboard");
    } catch (err) {
      console.error("Signup error:", err);
      console.error("Error code:", err?.code, "Message:", err?.message);
      toast.error(friendlyAuthError(err));
    } finally {
      console.log("finally running");
      setEmailLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left panel */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-rose-500 to-pink-600 text-white flex-col justify-center px-12 py-16">
        <div className="flex items-center gap-2.5 mb-10">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
            <Heart className="h-5 w-5 text-white" fill="white" />
          </div>
          <span className="text-xl font-bold tracking-tight">KinOS</span>
        </div>
        <h1 className="text-4xl font-bold leading-tight tracking-tight mb-6">
          Caring for family,<br />simpler together.
        </h1>
        <p className="text-lg leading-relaxed text-rose-50 mb-10 max-w-md">
          One shared space for medications, appointments, documents, and communication — built for families caring for aging parents or managing chronic conditions.
        </p>
        <div className="grid grid-cols-2 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.label} className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{f.label}</p>
                  <p className="text-xs text-rose-100 mt-0.5">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-auto pt-10 flex items-center gap-2 text-sm text-rose-100">
          <Shield className="h-4 w-4" />
          <span>Your family&apos;s health data is protected with Firebase Authentication and secure access rules.</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-1 text-slate-500">Sign in to your family care space.</p>

            {/* Tabs */}
            <div className="mt-6 flex p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setTab("signin")}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  tab === "signin"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  tab === "signup"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Create account
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4">
              {tab === "signup" && (
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  />
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={emailLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-rose-200 transition-all hover:bg-rose-600 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {tab === "signin" ? "Sign in" : "Create account"}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              {stuck && (
                <p className="text-center text-xs font-medium text-amber-600">
                  Stuck? Refresh the page and try again.
                </p>
              )}
            </form>

            {/* Divider */}
            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="mt-6 w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>

            <p className="mt-6 text-center text-xs text-slate-400">
              Protected by Firebase Authentication · Email & Google sign-in
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
