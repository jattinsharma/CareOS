"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, MotionConfig, useInView, animate } from "framer-motion";
import {
  Heart,
  Pill,
  CalendarDays,
  FolderOpen,
  Users,
  Shield,
  Bell,
  ArrowRight,
  Check,
  ChevronDown,
  Menu,
  X,
  Star,
  Smartphone,
} from "lucide-react";
import InstallPrompt from "@/components/InstallPrompt";
import CustomCursor from "@/components/CustomCursor";

/* ---------- Motion presets ---------- */
const EASE = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE },
  },
};

const stagger = (staggerChildren = 0.1, delayChildren = 0) => ({
  hidden: {},
  show: {
    transition: { staggerChildren, delayChildren },
  },
});

const viewportOnce = { once: true, margin: "-100px" };

/* ---------- Animated counter ---------- */
function CountUp({ target, prefix = "", suffix = "", format = false }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!inView) return undefined;

    const fmt = (n) => (format ? n.toLocaleString("en-US") : String(n));

    const controls = animate(0, target, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(fmt(Math.round(v))),
      onComplete: () => setDisplay(fmt(target)),
    });

    return () => controls.stop();
  }, [inView, target, format]);

  return (
    <p
      ref={ref}
      className="bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-4xl font-bold text-transparent md:text-5xl"
    >
      {prefix}
      {display}
      {suffix}
    </p>
  );
}

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const stats = [
  { target: 53, suffix: "M", label: "Family caregivers in the U.S." },
  { target: 7000, prefix: "$", format: true, label: "Avg. annual out-of-pocket cost" },
  { target: 3, suffix: "x", label: "Medication miss rate" },
  { target: 100, suffix: "%", label: "Free during beta" },
];

const steps = [
  {
    step: "1",
    icon: Users,
    title: "Create Family Group",
    desc: "Start a shared care group and invite siblings, partners, or in-home caregivers with a simple code — everyone joins instantly.",
  },
  {
    step: "2",
    icon: Pill,
    title: "Add Medications & Events",
    desc: "Log daily medications, appointments, and refills into one shared space that the whole family can see at a glance.",
  },
  {
    step: "3",
    icon: Bell,
    title: "Get Reminded, Stay in Sync",
    desc: "Smart reminders and shared updates keep every caregiver on the same page — so nothing slips through the cracks.",
  },
];

const features = [
  {
    icon: Pill,
    title: "Medication Tracking",
    desc: "Track doses, streaks, and shared medication history so everyone knows what's been taken.",
    wide: true,
  },
  {
    icon: CalendarDays,
    title: "Shared Calendar",
    desc: "Appointments, refills, and events visible to the whole family — no more group-chat scheduling.",
  },
  {
    icon: FolderOpen,
    title: "Document Vault",
    desc: "Insurance cards, medical records, and important papers — organized and always handy.",
  },
  {
    icon: Bell,
    title: "Smart Reminders",
    desc: "Gentle reminders for medications and events, delivered right when your family needs them.",
    wide: true,
  },
  {
    icon: Users,
    title: "Multi-Caregiver Teams",
    desc: "Siblings, partners, and professional caregivers can all join the same care group.",
  },
  {
    icon: Smartphone,
    title: "Install as App",
    desc: "Add CareOS to any home screen for quick, offline-ready access — just like a native app.",
  },
];

const betaIncluded = [
  "Unlimited family members",
  "Unlimited medications & events",
  "Shared calendar & reminders",
  "SMS reminders included",
  "Lifetime access for beta users",
];

const proIncluded = [
  "Everything in Beta",
  "Advanced reports & insights",
  "Priority support",
  "Data export",
  "Full activity logs",
];

const faqs = [
  {
    q: "Is CareOS really free?",
    a: "Yes. CareOS is free for everyone during the beta, and beta users keep free access for life — no credit card required.",
  },
  {
    q: "Does my elderly parent need a smartphone?",
    a: "No. Caregivers can manage everything from their own phones. Family members who don't use apps simply receive reminders — no smartphone needed on their end.",
  },
  {
    q: "Can multiple family members use it at the same time?",
    a: "Absolutely. Create a family group and invite unlimited members — siblings, partners, and in-home caregivers can all view medications, calendar events, and documents together.",
  },
  {
    q: "Is our family's health data secure?",
    a: "Yes. CareOS uses Firebase Authentication and strict, per-family security rules. Your data stays private to your family group — only the people you invite can see it.",
  },
  {
    q: "What happens if someone misses a medication?",
    a: "Reminders go out to the whole care team, and missed doses are clearly logged so any caregiver can follow up. Nothing slips by silently.",
  },
];

const footerLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Sign In", href: "/login" },
];

const particles = [
  { className: "left-[12%] top-16 h-2 w-2", delay: "0s", duration: "9s" },
  { className: "right-[18%] top-24 h-3 w-3", delay: "1.2s", duration: "11s" },
  { className: "bottom-20 left-[30%] h-2.5 w-2.5", delay: "2s", duration: "10s" },
  { className: "bottom-16 right-[25%] h-1.5 w-1.5", delay: "0.6s", duration: "12s" },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  // Logged-in users go straight to the app.
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  // Navbar shadow + extra blur once the user scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleAuth() {
    router.push("/login");
  }

  function scrollToId(e, id) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  }

  const primaryBtn =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-rose-500/30 transition-all hover:bg-rose-600 active:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed";

  const outlineBtn =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-8 py-4 text-lg font-semibold text-slate-700 transition-all hover:border-rose-400 hover:text-rose-600 active:scale-[0.98]";

  const sectionLabel =
    "text-xs font-semibold uppercase tracking-[0.2em] text-rose-500";

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="min-h-screen bg-white text-slate-900"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <InstallPrompt />
        <CustomCursor />

        {/* ---------- Nav ---------- */}
        <header
          className={`sticky top-0 z-50 border-b border-slate-100/50 transition-all duration-300 ${
            scrolled
              ? "bg-white/80 shadow-sm shadow-slate-900/5 backdrop-blur-xl"
              : "bg-white/80 backdrop-blur-md"
          }`}
        >
          <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4" aria-label="Main">
            <a href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 shadow-sm shadow-rose-200">
                <Heart className="h-5 w-5 text-white" fill="white" />
              </div>
              <span className="text-xl font-bold tracking-tight">CareOS</span>
            </a>

            <div className="hidden items-center gap-7 md:flex">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={(e) => scrollToId(e, l.href.slice(1))}
                  className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                >
                  {l.label}
                </a>
              ))}
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <button
                type="button"
                onClick={handleAuth}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
              >
                Sign In
              </button>
              <motion.button
                type="button"
                onClick={handleAuth}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-rose-200 transition-all hover:from-rose-600 hover:to-pink-600 active:bg-rose-700 disabled:opacity-60"
              >
                Get Started
              </motion.button>
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              className="rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100 md:hidden"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </nav>

          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                key="mobile-menu"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="overflow-hidden border-t border-slate-200 bg-white px-4 py-4 md:hidden"
              >
                <div className="flex flex-col gap-1">
                  {navLinks.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={(e) => scrollToId(e, l.href.slice(1))}
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      handleAuth();
                    }}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                  >
                    Sign In
                  </button>
                  <motion.button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      handleAuth();
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-rose-200 transition-all hover:from-rose-600 hover:to-pink-600 disabled:opacity-60"
                  >
                    Get Started
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* ---------- Hero ---------- */}
        <section className="relative min-h-screen overflow-hidden bg-white">
          {/* animated aurora mesh */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div
              className="absolute -left-32 -top-40 h-[42rem] w-[42rem] rounded-full opacity-40 blur-3xl animate-[aurora-1_22s_ease-in-out_infinite_alternate]"
              style={{ background: "radial-gradient(circle at 30% 30%, #f43f5e 0%, transparent 62%)" }}
            />
            <div
              className="absolute -top-24 right-[-10rem] h-[38rem] w-[38rem] rounded-full opacity-35 blur-3xl animate-[aurora-2_26s_ease-in-out_infinite_alternate_reverse]"
              style={{ background: "radial-gradient(circle at 60% 40%, #f472b6 0%, transparent 62%)" }}
            />
            <div
              className="absolute bottom-[-12rem] left-1/4 h-[36rem] w-[36rem] rounded-full opacity-30 blur-3xl animate-[aurora-3_30s_ease-in-out_infinite_alternate]"
              style={{ background: "radial-gradient(circle at 50% 50%, #fdba74 0%, transparent 62%)" }}
            />
            <div
              className="absolute right-1/4 top-1/3 h-[32rem] w-[32rem] rounded-full opacity-25 blur-3xl animate-[aurora-2_24s_ease-in-out_infinite_alternate]"
              style={{ background: "radial-gradient(circle at 50% 50%, #c084fc 0%, transparent 62%)" }}
            />
          </div>

          {/* fade into the next section */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent via-transparent to-white"
            aria-hidden="true"
          />

          <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-4 py-24 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-sm font-medium text-rose-600 backdrop-blur-md"
            >
              <Star className="h-4 w-4 fill-rose-500 text-rose-500" />
              Free during beta
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
              className="mx-auto mt-8 max-w-4xl text-6xl font-bold leading-[0.95] tracking-tighter text-slate-900 md:text-8xl"
            >
              Caring for family,{" "}
              <span className="bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
                simpler together.
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
              className="mx-auto mt-8 max-w-2xl text-xl leading-relaxed text-slate-600 md:text-2xl"
            >
              One shared space for medications, appointments, documents, and
              reminders — built for families caring for aging parents or managing
              chronic conditions.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: EASE }}
              className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <motion.button
                type="button"
                onClick={handleAuth}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                animate={{
                  boxShadow: [
                    "0 8px 24px rgba(244, 63, 94, 0.3)",
                    "0 8px 40px rgba(244, 63, 94, 0.45)",
                    "0 8px 24px rgba(244, 63, 94, 0.3)",
                  ],
                }}
                transition={{ boxShadow: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}
                className={primaryBtn}
              >
                Get Started Free
                <ArrowRight className="h-5 w-5" />
              </motion.button>
              <motion.a
                href="#how-it-works"
                onClick={(e) => scrollToId(e, "how-it-works")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={outlineBtn}
              >
                See How It Works
              </motion.a>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7, ease: EASE }}
              className="mt-6 flex items-center justify-center gap-1.5 text-sm text-slate-600"
            >
              <Shield className="h-4 w-4 text-rose-500" />
              No credit card required · Setup takes minutes
            </motion.p>
          </div>

          {/* scroll indicator */}
          <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center">
            <motion.button
              type="button"
              onClick={(e) => scrollToId(e, "how-it-works")}
              aria-label="Scroll down to see how it works"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: [0, 8, 0] }}
              transition={{ opacity: { duration: 0.6, delay: 1 }, y: { duration: 1.8, repeat: Infinity, ease: "easeInOut" } }}
              className="text-slate-400 transition-colors hover:text-rose-500"
            >
              <ChevronDown className="h-7 w-7" />
            </motion.button>
          </div>
        </section>

        {/* ---------- Stats ---------- */}
        <motion.section
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="bg-slate-950"
        >
          <div className="mx-auto max-w-6xl px-4 py-20 md:py-24">
            <motion.div variants={stagger(0.1)} className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {stats.map((s) => (
                <motion.div
                  key={s.label}
                  variants={fadeUp}
                  className="rounded-2xl border border-white/10 bg-white/10 p-6 text-center shadow-lg shadow-rose-500/10 backdrop-blur-lg"
                >
                  <CountUp
                    target={s.target}
                    prefix={s.prefix || ""}
                    suffix={s.suffix || ""}
                    format={s.format || false}
                  />
                  <p className="mt-2 text-sm uppercase tracking-widest text-slate-400">
                    {s.label}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* ---------- How It Works ---------- */}
        <motion.section
          id="how-it-works"
          className="relative scroll-mt-16 bg-slate-950 py-20 md:py-28"
          variants={stagger(0.15)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
        >
          {/* soft spotlight */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(244,63,94,0.08),transparent_70%)]"
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-6xl px-4">
            <motion.div variants={fadeUp} className="mx-auto max-w-2xl text-center">
              <p className={`${sectionLabel} mb-3`}>How it works</p>
              <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                Up and running in minutes
              </h2>
              <div className="mx-auto mt-6 h-1 w-20 rounded-full bg-gradient-to-r from-rose-500 to-pink-500" />
              <p className="mt-6 text-lg leading-relaxed text-slate-400">
                Three simple steps bring your whole care team onto the same page.
              </p>
            </motion.div>

            {/* timeline */}
            <motion.div variants={stagger(0.15)} className="relative mx-auto mt-16 max-w-3xl">
              <div
                className="absolute bottom-6 left-6 top-6 w-0.5 rounded-full bg-gradient-to-b from-rose-500 to-pink-500"
                aria-hidden="true"
              />
              <div className="space-y-8">
                {steps.map((s) => {
                  const Icon = s.icon;
                  return (
                    <motion.div key={s.title} variants={fadeUp} className="relative pl-16">
                      <div
                        className="absolute left-[19px] top-[50px] h-3 w-3 rounded-full bg-rose-500 ring-4 ring-slate-950"
                        aria-hidden="true"
                      />
                      <div className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-rose-500/50">
                        <span
                          className="pointer-events-none absolute -right-3 -top-7 select-none text-8xl font-bold text-slate-800"
                          aria-hidden="true"
                        >
                          {s.step}
                        </span>
                        <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 p-3">
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="relative mt-5 text-lg font-semibold text-white">
                          {s.title}
                        </h3>
                        <p className="relative mt-2 text-base leading-relaxed text-slate-400">
                          {s.desc}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ---------- Features (bento) ---------- */}
        <motion.section
          id="features"
          className="scroll-mt-16 bg-white py-20 md:py-28"
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
        >
          <div className="mx-auto max-w-6xl px-4">
            <motion.div variants={fadeUp} className="mx-auto max-w-2xl text-center">
              <p className={`${sectionLabel} mb-3`}>Features</p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Everything your family needs, in one place
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                Powerful tools designed around real caregiving — simple enough for
                everyone.
              </p>
            </motion.div>
            <motion.div variants={stagger(0.1)} className="mt-14 grid gap-6 md:grid-cols-4">
              {features.map((f) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={f.title}
                    variants={fadeUp}
                    className={`group relative overflow-hidden rounded-3xl border border-slate-100 bg-slate-50 p-8 shadow-inner shadow-slate-200/40 transition-all duration-300 hover:-translate-y-1 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-100/50 ${
                      f.wide ? "md:col-span-2" : ""
                    }`}
                  >
                    {/* decorative corner shape */}
                    <div
                      className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rotate-12 rounded-3xl border border-rose-200/50 transition-transform duration-500 group-hover:rotate-45"
                      aria-hidden="true"
                    />
                    <div
                      className="pointer-events-none absolute bottom-6 right-6 h-2 w-2 rounded-full bg-rose-200/60"
                      aria-hidden="true"
                    />
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-pink-100 text-rose-500 transition-transform duration-300 group-hover:scale-105">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="relative mt-5 text-lg font-semibold text-slate-900">
                      {f.title}
                    </h3>
                    <p className="relative mt-2 text-base leading-relaxed text-slate-600">
                      {f.desc}
                    </p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </motion.section>

        {/* ---------- Pricing ---------- */}
        <motion.section
          id="pricing"
          className="scroll-mt-16 bg-slate-50 py-20 md:py-28"
          variants={stagger(0.15)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
        >
          <div className="mx-auto max-w-6xl px-4">
            <motion.div variants={fadeUp} className="mx-auto max-w-2xl text-center">
              <p className={`${sectionLabel} mb-3`}>Pricing</p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Simple, honest pricing
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                Start free today. Upgrade only when your family wants more.
              </p>
            </motion.div>
            <motion.div
              variants={stagger(0.15)}
              className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2"
            >
              {/* Beta */}
              <motion.div
                variants={fadeUp}
                className="flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1"
              >
                <h3 className="text-lg font-semibold text-slate-900">Beta</h3>
                <p className="mt-1 text-base text-slate-600">
                  Everything you need while we&apos;re in beta — free forever for beta
                  users.
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="align-top text-2xl font-bold text-slate-900">$</span>
                  <span className="text-6xl font-bold tracking-tight text-slate-900">0</span>
                  <span className="ml-2 text-sm text-slate-500">free forever</span>
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {betaIncluded.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-500 text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* Pro */}
              <motion.div
                variants={fadeUp}
                className="flex flex-col rounded-3xl border-2 border-rose-500 bg-white p-8 shadow-sm shadow-rose-200/50 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Pro</h3>
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-rose-500">
                    Coming Soon
                  </span>
                </div>
                <p className="mt-1 text-base text-slate-600">
                  For families that want deeper insights and priority help.
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="align-top text-2xl font-bold text-slate-900">$</span>
                  <span className="text-6xl font-bold tracking-tight text-slate-900">9</span>
                  <span className="ml-2 text-sm text-slate-500">per month</span>
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {proIncluded.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-500 text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled
                  className="mt-8 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 py-3 font-semibold text-slate-400"
                >
                  Coming Soon
                </button>
              </motion.div>
            </motion.div>
          </div>
        </motion.section>

        {/* ---------- FAQ ---------- */}
        <motion.section
          id="faq"
          className="scroll-mt-16 bg-white py-20 md:py-28"
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
        >
          <div className="mx-auto max-w-3xl px-4">
            <motion.div variants={fadeUp} className="text-center">
              <p className={`${sectionLabel} mb-3`}>FAQ</p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Frequently asked questions
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                Everything you need to know about caring with CareOS.
              </p>
            </motion.div>
            <motion.div variants={stagger(0.08)} className="mx-auto mt-12 border-t border-slate-200">
              {faqs.map((f, i) => {
                const open = openFaq === i;
                return (
                  <motion.div key={f.q} variants={fadeUp} className="border-b border-slate-200 py-6">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      aria-controls={`faq-panel-${i}`}
                      className="flex w-full items-center justify-between gap-4 text-left"
                    >
                      <span className="text-lg font-semibold text-slate-900">{f.q}</span>
                      <motion.span
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="flex flex-shrink-0 items-center"
                      >
                        <ChevronDown
                          className={`h-5 w-5 ${open ? "text-rose-500" : "text-slate-400"}`}
                        />
                      </motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          key={`faq-panel-${i}`}
                          id={`faq-panel-${i}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: EASE }}
                          className="overflow-hidden"
                          aria-hidden={!open}
                        >
                          <p className="pt-3 text-slate-600 leading-relaxed">{f.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </motion.section>

        {/* ---------- Final CTA ---------- */}
        <motion.section
          className="relative overflow-hidden bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 py-24 md:py-32"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
        >
          {/* floating particles */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {particles.map((p, i) => (
              <div
                key={i}
                className={`absolute rounded-full bg-white/40 ${p.className}`}
                style={{
                  animation: `float-particle ${p.duration} ease-in-out infinite`,
                  animationDelay: p.delay,
                }}
              />
            ))}
          </div>
          <div className="relative mx-auto max-w-4xl px-4 text-center">
            <h2 className="text-5xl font-bold tracking-tight text-white md:text-7xl">
              Start caring, simpler.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-rose-100">
              Join your family&apos;s care team today — free during beta, no
              credit card required.
            </p>
            <button
              type="button"
              onClick={handleAuth}
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-10 py-4 text-lg font-bold text-rose-600 shadow-xl shadow-black/10 transition-all hover:scale-105 hover:shadow-2xl"
            >
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </motion.section>

        {/* ---------- Footer ---------- */}
        <motion.footer
          className="bg-slate-900 text-slate-300"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
        >
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="flex flex-col items-center justify-between gap-10 md:flex-row">
              <div className="flex flex-col items-center gap-3 text-center md:items-start md:text-left">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 shadow-sm shadow-rose-900/40">
                    <Heart className="h-5 w-5 text-white" fill="white" />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-white">CareOS</span>
                </div>
                <p className="text-sm leading-relaxed text-slate-400">
                  One shared space for the people you care for.
                </p>
                <p className="text-xs text-slate-400">
                  © {new Date().getFullYear()} CareOS. All rights reserved.
                </p>
              </div>
              <nav aria-label="Footer">
                <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                  {footerLinks.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        onClick={
                          l.href.startsWith("#")
                            ? (e) => scrollToId(e, l.href.slice(1))
                            : undefined
                        }
                        className="text-sm text-slate-400 transition-colors hover:text-white"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        </motion.footer>
      </motion.div>
    </MotionConfig>
  );
}
