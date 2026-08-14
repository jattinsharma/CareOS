"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import {
  Heart,
  LayoutDashboard,
  Users,
  Pill,
  CalendarDays,
  FolderOpen,
  Menu,
  X,
} from "lucide-react";
import ProfileDropdown from "@/components/ProfileDropdown";
import NotificationPrompt from "@/components/NotificationPrompt";

export default function Navbar() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/family", label: "Family", icon: Users },
    { href: "/medications", label: "Medications", icon: Pill },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/vault", label: "Vault", icon: FolderOpen },
  ];

  if (!user) return null;

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between h-16 items-center">
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => router.push("/dashboard")}
          >
            <div className="w-9 h-9 bg-rose-500 rounded-xl flex items-center justify-center shadow-sm shadow-rose-200">
              <Heart className="w-5 h-5 text-white" fill="white" />
            </div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">KinOS</span>
          </div>

          <div className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-rose-50 text-rose-600"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
            <div className="w-px h-6 bg-slate-200 mx-2" />
            {/* Avatar + profile dropdown (replaces the plain logout icon) */}
            <ProfileDropdown />
          </div>

          {/* Mobile: avatar (opens the bottom sheet) + hamburger */}
          <div className="flex items-center gap-1 md:hidden">
            <ProfileDropdown />
            <button
              className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="w-5 h-5 text-slate-700" />
              ) : (
                <Menu className="w-5 h-5 text-slate-700" />
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  setMobileOpen(false);
                }}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-rose-50 text-rose-600"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Polite FCM permission request (renders nothing until applicable) */}
      <NotificationPrompt />
    </nav>
  );
}
