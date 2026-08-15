"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  Menu,
  X,
  ClipboardList,
  Calendar,
  Users,
  Zap,
  Check,
  CalendarDays,
  ChevronRight,
  FolderOpen,
  Settings,
  Bell,
  LogOut,
} from "lucide-react";
import { formatTime12h } from "@/lib/medUtils";

// Mirrors the dashboard page's getTimeOfDay() so the mobile greeting matches
// the desktop one exactly ("morning" | "afternoon" | "evening").
function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Parse a "yyyy-MM-dd" event date into { month: "Aug", day: 15 } without going
// through Date() (avoids UTC-offset drift when constructing dates from strings).
function dateParts(dateKey) {
  if (!dateKey) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { month: MONTHS[(m - 1) % 12] || "", day: d };
}

export default function MobileDashboard({
  user,
  familyGroup,
  medications,
  todayMeds,
  upcomingEvents,
}) {
  const router = useRouter();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const firstName =
    user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  const initial = (user?.displayName || user?.email || "?").trim().charAt(0).toUpperCase() || "?";

  // "Managing The {familyName} Family" — avoid "…Family Family" when the
  // stored group name already ends in "Family".
  const familyName = familyGroup?.name || "";
  const familyLabel = familyName.toLowerCase().endsWith(" family")
    ? familyName
    : familyName
    ? `The ${familyName} Family`
    : "";

  const stats = [
    {
      key: "meds-today",
      icon: ClipboardList,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-500",
      label: "Meds Today",
      value: medications.length,
      subtext:
        todayMeds.length === 0 ? (
          <span className="inline-flex items-center gap-1 text-teal-600">
            <Check className="w-3.5 h-3.5" />
            All caught up
          </span>
        ) : (
          <span className="text-amber-600">{todayMeds.length} remaining</span>
        ),
      onClick: () => router.push("/medications"),
    },
    {
      key: "upcoming",
      icon: Calendar,
      iconBg: "bg-sky-50",
      iconColor: "text-sky-500",
      label: "Upcoming",
      value: upcomingEvents.length,
      subtext: upcomingEvents.length === 0 ? "No events" : "This week",
      onClick: () => router.push("/calendar"),
    },
    {
      key: "members",
      icon: Users,
      iconBg: "bg-teal-50",
      iconColor: "text-teal-500",
      label: "Members",
      value: familyGroup?.members?.length || 0,
      subtext: "Active caregivers",
      onClick: () => router.push("/family"),
    },
    {
      key: "total-meds",
      icon: Zap,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-500",
      label: "Total Meds",
      value: medications.length,
      subtext: "Being tracked",
      onClick: () => router.push("/medications"),
    },
  ];

  const closeMenu = () => setMenuOpen(false);

  const go = (path) => {
    closeMenu();
    router.push(path);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur px-4 h-16 flex items-center justify-between border-b border-slate-100">
        <div
          className="flex items-center gap-2.5 cursor-pointer select-none"
          onClick={() => router.push("/dashboard")}
        >
          <Image
            src="/icons/kinos-logo.png"
            alt="KinOS"
            width={36}
            height={36}
            className="w-9 h-9 rounded-lg object-cover"
            priority
          />
          <span className="font-bold text-lg text-slate-900 tracking-tight">KinOS</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => router.push("/settings")}
            aria-label="Profile settings"
            className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center active:scale-95 transition-transform"
          >
            {initial}
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
          >
            {menuOpen ? (
              <X className="w-5 h-5 text-slate-700" />
            ) : (
              <Menu className="w-5 h-5 text-slate-700" />
            )}
          </button>
        </div>
      </header>

      {/* Hamburger menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={closeMenu} aria-hidden="true" />
          <div className="absolute right-4 top-16 z-40 bg-white rounded-2xl shadow-lg border border-slate-200 py-2 w-56">
            <button
              onClick={() => go("/vault")}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FolderOpen className="w-4 h-4 text-slate-500" />
              Vault
            </button>
            <button
              onClick={() => go("/notifications")}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Bell className="w-4 h-4 text-slate-500" />
              Notifications
            </button>
            <button
              onClick={() => go("/settings")}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              Profile Settings
            </button>
            <div className="border-t border-slate-100 my-1" />
            <button
              onClick={async () => {
                closeMenu();
                await logout();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </>
      )}

      {/* Greeting */}
      <div className="px-4 pt-5">
        <h1 className="text-2xl font-bold text-slate-900">
          Good {getTimeOfDay()}, {firstName}
        </h1>
        {familyLabel && (
          <p className="text-sm text-slate-500 mt-0.5">Managing {familyLabel}</p>
        )}
      </div>

      {/* Stats cards */}
      <div className="space-y-3 px-4 mt-5">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={s.onClick}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4 text-left active:scale-[0.98] transition-transform animate-slide-in-up"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${s.iconBg}`}
              >
                <Icon className={`w-5 h-5 ${s.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-500">{s.label}</p>
                <p className="text-2xl font-bold text-slate-900 leading-tight">{s.value}</p>
                <p className="text-sm text-slate-500">{s.subtext}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Upcoming events */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-sky-500" />
            <h2 className="font-semibold text-slate-900 text-base">Upcoming Events</h2>
          </div>
          <button
            onClick={() => router.push("/calendar")}
            className="text-sky-600 text-xs font-medium"
          >
            View all
          </button>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
            <p className="text-slate-400 text-sm">No upcoming events</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.slice(0, 2).map((ev, i) => {
              const parts = dateParts(ev.date);
              return (
                <button
                  key={ev.id}
                  onClick={() => router.push("/calendar")}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 text-left active:scale-[0.98] transition-transform animate-slide-in-up"
                  style={{ animationDelay: `${(4 + i) * 60}ms`, animationFillMode: "backwards" }}
                >
                  <div className="w-12 h-12 rounded-xl bg-orange-50 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-orange-500 uppercase leading-none">
                      {parts?.month}
                    </span>
                    <span className="text-lg font-bold text-orange-600 leading-none mt-0.5">
                      {parts?.day}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{ev.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatTime12h(ev.time) || "All day"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
