"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Settings, Users, X } from "lucide-react";
import toast from "react-hot-toast";

// "JS" from "Jattin Sharma" — the fallback avatar initials, reused by the
// medications page Patient chip.
export function getInitials(name, email) {
  const source = (name || "").trim() || (email || "").split("@")[0] || "";
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || "";
  return (first + second).toUpperCase() || "?";
}

/**
 * Navbar profile avatar + dropdown.
 *
 * Desktop: a dropdown anchored under the avatar.
 * Mobile:  the same menu becomes a bottom sheet.
 * Both close on outside click or Escape (useRef + useEffect).
 */
export default function ProfileDropdown() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      const insideRoot = rootRef.current?.contains(e.target);
      const insideSheet = sheetRef.current?.contains(e.target);
      if (!insideRoot && !insideSheet) setOpen(false);
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  if (!user) return null;

  const displayName = user.displayName || user.email?.split("@")[0] || "User";
  const initials = getInitials(user.displayName, user.email);

  function navigate(href) {
    setOpen(false);
    router.push(href);
  }

  function handleLogout() {
    setOpen(false);
    logout();
  }

  function handleNotifications() {
    setOpen(false);
    toast("Notifications are coming soon", { icon: "🔔" });
  }

  // Shared by the desktop dropdown and the mobile bottom sheet.
  function menuContent() {
    return (
      <>
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <Avatar photoURL={user.photoURL} initials={initials} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{displayName}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
        <div className="h-px bg-slate-100 mx-4" />
        <div className="py-1.5">
          <MenuItem
            icon={Settings}
            label="Profile Settings"
            onClick={() => navigate("/settings")}
          />
          <MenuItem
            icon={Users}
            label="Manage Families"
            onClick={() => navigate("/family")}
          />
          <MenuItem icon={Bell} label="Notifications" onClick={handleNotifications} />
        </div>
        <div className="h-px bg-slate-100 mx-4" />
        <div className="py-1.5">
          <MenuItem icon={LogOut} label="Logout" onClick={handleLogout} danger />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Trigger — always visible in the top-right of the navbar */}
      <div className="relative" ref={rootRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-1 rounded-full p-1 pr-1.5 hover:bg-slate-50 transition-colors"
        >
          <Avatar photoURL={user.photoURL} initials={initials} size="md" />
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Desktop dropdown */}
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 hidden md:block z-50 overflow-hidden"
          >
            {menuContent()}
          </div>
        )}
      </div>

      {/* Mobile bottom sheet */}
      {open && (
        <div className="md:hidden fixed inset-0 z-[90]" ref={sheetRef}>
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-2xl pt-1 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            {menuContent()}
            <div className="px-4 pt-3">
              <button
                onClick={() => setOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                <X className="w-4 h-4" />
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Circular avatar — photo when available, otherwise pink initials.
function Avatar({ photoURL, initials, size }) {
  const dims = size === "lg" ? "w-11 h-11 text-base" : "w-9 h-9 text-sm";
  if (photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoURL}
        alt="Profile"
        referrerPolicy="no-referrer"
        className={`${dims} rounded-full object-cover border border-slate-200 flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dims} rounded-full bg-rose-500 text-white font-bold flex items-center justify-center flex-shrink-0 shadow-sm shadow-rose-200`}
    >
      {initials}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
        danger
          ? "text-rose-600 hover:bg-rose-50"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
