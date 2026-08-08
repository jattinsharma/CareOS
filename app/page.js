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
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!inView) return undefined;
    const controls = animate(0, target, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (v) => {
        const rounded = Math.round(v);
        setDisplay(format ? rounded.toLocaleString("en-US") : String(rounded));
      },
    });
    return () => controls.stop();
  }, [inView, target, format]);

  return (
    <p ref={ref} className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
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

const footerProduct = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Changelog", href: "#" },
];

const footerCompany = [
  { label: "About", href: "#" },
  { label: "Contact", href: "#" },
  { label: "Privacy", href: "#" },
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

  const ctaBtn =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-6 py-3 font-semibold text-white shadow-sm shadow-rose-200 transition-all hover:bg-rose-600 hover:shadow-md hover:shadow-rose-200 active:scale-[0.98] active:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed";

  const outlineBtn =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98]";

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white text-slate-900">
        <InstallPrompt />

        {/* ---------- Nav ---------- */}
        <header
          className={`sticky top-0 z-50 border-b border-slate-200/70 transition-all duration-300 ${
            scrolled
              ? "bg-white/90 shadow-lg shadow-slate-900/5 backdrop-blur-xl"
              : "bg-white/80 backdrop-blur-md"
          }`}
        >
          <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4" aria-label="Main">
            <a href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 shadow-sm shadow-rose-200">
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
                className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-rose-200 transition-colors hover:bg-rose-600 active:bg-rose-700 disabled:opacity-60"
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
                    className="w-full rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-rose-200 transition-colors hover:bg-rose-600 disabled:opacity-60"
                  >
                    Get Started
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-rose-100/60 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 top-40 h-80 w-80 rounded-full bg-pink-50 blur-3xl" />
          <div className="pointer-events-none absolute left-1/4 top-24 h-72 w-72 rounded-full bg-rose-200/30 blur-3xl animate-[blob-drift_9s_ease-in-out_infinite_alternate]" />
          <div className="pointer-events-none absolute bottom-10 right-1/4 h-80 w-80 rounded-full bg-pink-200/20 blur-3xl animate-[blob-drift_11s_ease-in-out_infinite_alternate]" />
          <div className="relative mx-auto max-w-6xl px-4 py-20 text-center md:py-28">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
              className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-4 py-1.5 text-sm font-medium text-rose-600"
            >
              <Star className="h-4 w-4 fill-rose-500 text-rose-500" />
              Free during beta
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
              className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl"
            >
              Caring for family,{" "}
              <span className="text-rose-500">simpler together.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
              className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500 md:text-xl"
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
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                animate={{
                  boxShadow: [
                    "0 4px 14px rgba(244, 63, 94, 0.35)",
                    "0 4px 26px rgba(244, 63, 94, 0.55)",
                    "0 4px 14px rgba(244, 63, 94, 0.35)",
                  ],
                }}
                transition={{ boxShadow: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}
                className={ctaBtn}
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
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
              className="mt-6 flex items-center justify-center gap-1.5 text-sm text-slate-500"
            >
              <Shield className="h-4 w-4 text-rose-500" />
              No credit card required · Setup takes minutes
            </motion.p>
          </div>
        </section>

        {/* ---------- Stats bar ---------- */}
        <motion.section
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="border-y border-slate-200/70 bg-slate-50/50"
        >
          <div className="mx-auto max-w-6xl px-4 py-12">
            <motion.div variants={stagger(0.1)} className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((s) => (
                <motion.div key={s.label} variants={fadeUp} className="text-center">
                  <CountUp
                    target={s.target}
                    prefix={s.prefix || ""}
                    suffix={s.suffix || ""}
                    format={s.format || false}
                  />
                  <p className="mt-1 text-sm text-slate-500">{s.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* ---------- How It Works ---------- */}
        <motion.section
          id="how-it-works"
          className="scroll-mt-16 py-20 md:py-28"
          variants={stagger(0.15)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
        >
          <div className="mx-auto max-w-6xl px-4">
            <motion.div variants={fadeUp} className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-rose-500">
                How it works
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Up and running in minutes
              </h2>
              <p className="mt-4 text-slate-500">
                Three simple steps bring your whole care team onto the same page.
              </p>
            </motion.div>
            <motion.div variants={stagger(0.15)} className="mt-14 grid gap-6 md:grid-cols-3">
              {steps.map((s) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.title}
                    variants={fadeUp}
                    className="group relative rounded-3xl border border-slate-200 bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-100"
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-50 text-sm font-bold text-rose-500 ring-1 ring-rose-100">
                        {s.step}
                      </span>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-sm shadow-rose-200 transition-transform duration-300 group-hover:scale-105">
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                    <h3 className="mt-6 text-lg font-semibold">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.desc}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </motion.section>

        {/* ---------- Features ---------- */}
        <motion.section
          id="features"
          className="scroll-mt-16 bg-slate-50 py-20 md:py-28"
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
        >
          <div className="mx-auto max-w-6xl px-4">
            <motion.div variants={fadeUp} className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-rose-500">
                Features
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Everything your family needs, in one place
              </h2>
              <p className="mt-4 text-slate-500">
                Powerful tools designed around real caregiving — simple enough for
                everyone.
              </p>
            </motion.div>
            <motion.div variants={stagger(0.1)} className="mt-14 grid gap-6 md:grid-cols-2">
              {features.map((f) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={f.title}
                    variants={fadeUp}
                    className="group rounded-3xl border border-slate-200 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-100"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 transition-all duration-300 group-hover:scale-105 group-hover:bg-rose-500 group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </motion.section>

        {/* ---------- Pricing ---------- */}
        <motion.section
          id="pricing"
          className="scroll-mt-16 py-20 md:py-28"
          variants={stagger(0.15)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
        >
          <div className="mx-auto max-w-6xl px-4">
            <motion.div variants={fadeUp} className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-rose-500">
                Pricing
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Simple, honest pricing
              </h2>
              <p className="mt-4 text-slate-500">
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
                className="flex flex-col rounded-3xl border border-slate-200 bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-100"
              >
                <h3 className="text-lg font-semibold">Beta</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Everything you need while we&apos;re in beta — free forever for beta
                  users.
                </p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight">$0</span>
                  <span className="text-sm text-slate-500">free forever</span>
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {betaIncluded.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
                <motion.button
                  type="button"
                  onClick={handleAuth}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={ctaBtn + " mt-8 w-full"}
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
              </motion.div>

              {/* Pro */}
              <motion.div
                variants={fadeUp}
                className="relative flex flex-col rounded-3xl border-2 border-rose-500 bg-white p-8 shadow-lg shadow-rose-100 transition-all duration-300 hover:-translate-y-1"
              >
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rose-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Coming Soon
                </span>
                <h3 className="text-lg font-semibold">Pro</h3>
                <p className="mt-1 text-sm text-slate-500">
                  For families that want deeper insights and priority help.
                </p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight">$9</span>
                  <span className="text-sm text-slate-500">per month</span>
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {proIncluded.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled
                  className="mt-8 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 font-semibold text-slate-400"
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
          className="scroll-mt-16 bg-slate-50 py-20 md:py-28"
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
        >
          <div className="mx-auto max-w-3xl px-4">
            <motion.div variants={fadeUp} className="text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-rose-500">
                FAQ
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Frequently asked questions
              </h2>
              <p className="mt-4 text-slate-500">
                Everything you need to know about caring with CareOS.
              </p>
            </motion.div>
            <motion.div variants={stagger(0.08)} className="mt-12 space-y-3">
              {faqs.map((f, i) => {
                const open = openFaq === i;
                return (
                  <motion.div
                    key={f.q}
                    variants={fadeUp}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors duration-300 hover:border-rose-200"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      aria-controls={`faq-panel-${i}`}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    >
                      <span className="font-semibold text-slate-900">{f.q}</span>
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
                          <p className="px-6 pb-5 text-sm leading-relaxed text-slate-500">
                            {f.a}
                          </p>
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
          className="py-20 md:py-28"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
        >
          <div className="mx-auto max-w-6xl px-4">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-16 text-center text-white md:py-20">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <h2 className="relative text-3xl font-bold tracking-tight md:text-4xl">
                Start caring, simpler.
              </h2>
              <p className="relative mx-auto mt-4 max-w-xl text-rose-50/90">
                Join your family&apos;s care team today — free during beta, no
                credit card required.
              </p>
              <motion.button
                type="button"
                onClick={handleAuth}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 font-semibold text-rose-600 shadow-lg shadow-rose-900/20 transition-all duration-300 hover:bg-rose-50 hover:shadow-xl active:scale-[0.98] disabled:opacity-60"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </div>
          </div>
        </motion.section>

        {/* ---------- Footer ---------- */}
        <motion.footer
          className="border-t border-slate-200 bg-white"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
        >
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
              <div className="max-w-sm lg:col-span-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 shadow-sm shadow-rose-200">
                    <Heart className="h-5 w-5 text-white" fill="white" />
                  </div>
                  <span className="text-xl font-bold tracking-tight">CareOS</span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-500">
                  One shared space for the people you care for — medications,
                  appointments, documents, and reminders for the whole family.
                </p>
                <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <Shield className="h-4 w-4 text-rose-500" />
                  Secure by design with Firebase Authentication
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
                  Product
                </h4>
                <ul className="mt-4 space-y-2.5">
                  {footerProduct.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-sm text-slate-500 transition-colors hover:text-rose-500"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
                  Company
                </h4>
                <ul className="mt-4 space-y-2.5">
                  {footerCompany.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-sm text-slate-500 transition-colors hover:text-rose-500"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 sm:flex-row">
              <p className="text-xs text-slate-500">
                © {new Date().getFullYear()} CareOS. All rights reserved.
              </p>
              <p className="text-xs text-slate-500">
                Made with care for families everywhere.
              </p>
            </div>
          </div>
        </motion.footer>
      </div>
    </MotionConfig>
  );
}
