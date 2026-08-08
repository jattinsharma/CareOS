"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Heart,
  Pill,
  CalendarDays,
  Users,
  FolderOpen,
  Mail,
  Lock,
  User,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import InstallPrompt from "@/components/InstallPrompt";

const features = [
  {
    icon: Pill,
    title: "Medication tracking",
    desc: "Daily doses, streaks, and shared history",
    color: "bg-rose-400/20 text-rose-200",
  },
  {
    icon: CalendarDays,
    title: "Shared calendar",
    desc: "Appointments & refills for the whole family",
    color: "bg-blue-400/20 text-blue-200",
  },
  {
    icon: Users,
    title: "Family groups",
    desc: "Invite caregivers with a simple code",
    color: "bg-emerald-400/20 text-emerald-200",
  },
  {
    icon: FolderOpen,
    title: "Document vault",
    desc: "Insurance cards & records, always handy",
    color: "bg-violet-400/20 text-violet-200",
  },
];

function friendlyAuthError(err) {
  const code = err?.code || "";
  const map = {
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "An account with this email already exists. Try signing in.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/unauthorized-domain":
      "This domain isn't authorized for sign-in yet. Add it in Firebase Console → Authentication → Settings → Authorized domains.",
    "auth/operation-not-allowed":
      "This sign-in method isn't enabled. Enable it in Firebase Console → Authentication → Sign-in method.",
  };
  return map[code] || err?.message || "Something went wrong. Please try again.";
}

export default function LandingPage() {
  const { loginWithGoogle, loginWithEmail, signupWithEmail } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    if (!email.trim() || !password) {
      toast.error("Please fill in your email and password.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password should be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await loginWithEmail(email.trim(), password);
        toast.success("Welcome back!");
      } else {
        await signupWithEmail(email.trim(), password, name.trim());
        toast.success("Account created — welcome to CareOS!");
      }
      router.push("/dashboard");
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      toast.success("Signed in with Google!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  const inputClass =
    "w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent focus:bg-white text-slate-900 placeholder:text-slate-400 transition-all";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <InstallPrompt />

      {/* ---------- Brand panel ---------- */}
      <div className="relative lg:w-[46%] bg-gradient-to-br from-rose-500 via-rose-600 to-pink-700 text-white overflow-hidden flex flex-col justify-between p-8 lg:p-14">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-pink-300/20 blur-3xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center shadow-lg shadow-rose-900/20">
            <Heart className="w-6 h-6 text-white" fill="white" />
          </div>
          <span className="font-bold text-2xl tracking-tight">CareOS</span>
        </div>

        {/* Headline + features (desktop) */}
        <div className="relative my-10 lg:my-0">
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
            Caring for family,
            <br />
            <span className="text-rose-100">simpler together.</span>
          </h1>
          <p className="mt-4 text-rose-100/90 max-w-md leading-relaxed">
            One shared space for medications, appointments, documents, and
            communication — built for families caring for aging parents or
            managing chronic conditions.
          </p>

          <div className="hidden lg:grid grid-cols-2 gap-4 mt-10">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${f.color}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{f.title}</p>
                    <p className="text-xs text-rose-100/80 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trust note */}
        <div className="relative flex items-center gap-2 text-xs text-rose-100/80">
          <ShieldCheck className="w-4 h-4" />
          Your family&apos;s health data is protected with Firebase Authentication
          and secure access rules.
        </div>
      </div>

      {/* ---------- Auth card ---------- */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Logo (mobile) */}
          <div className="lg:hidden flex items-center gap-2.5 justify-center mb-8">
            <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center shadow-sm shadow-rose-200">
              <Heart className="w-5 h-5 text-white" fill="white" />
            </div>
            <span className="font-bold text-2xl text-slate-900 tracking-tight">CareOS</span>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm shadow-slate-200/60 p-8">
            <h2 className="text-2xl font-bold text-slate-900">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-slate-500 mt-1 text-sm">
              {mode === "signin"
                ? "Sign in to your family care space."
                : "Join CareOS and start coordinating care."}
            </p>

            {/* Mode tabs */}
            <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1 mt-6">
              {[
                { key: "signin", label: "Sign in" },
                { key: "signup", label: "Create account" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setMode(tab.key)}
                  className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    mode === tab.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <div className="relative">
                  <User className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className={inputClass}
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className={inputClass}
                />
              </div>

              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors shadow-sm shadow-rose-200"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {mode === "signin" ? "Sign in" : "Create account"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-slate-400 font-medium">
                  or continue with
                </span>
              </div>
            </div>

            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed py-3 rounded-xl font-semibold text-slate-700 transition-all"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              Continue with Google
            </button>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Protected by Firebase Authentication · Email &amp; Google sign-in
          </p>
        </div>
      </div>
    </div>
  );
}
