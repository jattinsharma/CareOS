"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { ArrowLeft, Bell, CalendarDays, Pill, Check } from "lucide-react";

const TYPE_ICONS = {
  med: Pill,
  event: CalendarDays,
  general: Bell,
};

const TYPE_STYLES = {
  med: "bg-rose-50 text-rose-500",
  event: "bg-sky-50 text-sky-500",
  general: "bg-slate-100 text-slate-500",
};

// Infer the icon type from the notification shape: client-created ones carry
// an explicit "type"; Cloud Function reminders ("medicationId") are meds.
function resolveType(n) {
  if (n.type === "med" || n.type === "event" || n.type === "general") return n.type;
  if (n.medicationId) return "med";
  return "general";
}

function notifTitle(n) {
  return n.title || "Notification";
}

function notifMessage(n) {
  return n.message || n.body || "";
}

// createdAt (client) or sentAt (Cloud Function) -> relative "2 min ago".
function timeAgo(n) {
  const ts = n.createdAt || n.sentAt;
  if (!ts) return "";
  const ms = typeof ts.toMillis === "function" ? ts.toMillis() : new Date(ts).getTime();
  if (Number.isNaN(ms)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(ms).toLocaleDateString();
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const at = (n) =>
            typeof n.createdAt?.toMillis === "function"
              ? n.createdAt.toMillis()
              : typeof n.sentAt?.toMillis === "function"
              ? n.sentAt.toMillis()
              : 0;
          return at(b) - at(a);
        });
      setNotifications(items);
    } catch {
      // Firestore rules or network hiccup — show the empty state.
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(n) {
    if (n.read) return;
    // Optimistic update so the dot disappears immediately.
    setNotifications((cur) =>
      cur.map((x) => (x.id === n.id ? { ...x, read: true } : x))
    );
    try {
      await updateDoc(doc(db, "notifications", n.id), { read: true });
    } catch {
      // Non-fatal — the dot will reappear on next load if it failed.
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur px-4 h-16 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push("/dashboard")}
            aria-label="Back to dashboard"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <span className="font-bold text-lg text-slate-900 tracking-tight">
            Notifications
          </span>
          {unreadCount > 0 && (
            <span className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-full px-2 py-0.5">
              {unreadCount} new
            </span>
          )}
        </div>
      </header>

      {/* Inbox */}
      <div className="px-4 mt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center mt-2">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="font-medium text-slate-500">No notifications yet</p>
            <p className="text-sm text-slate-400 mt-1">
              Medication reminders and family updates will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => {
              const TypeIcon = TYPE_ICONS[resolveType(n)] || Bell;
              const style = TYPE_STYLES[resolveType(n)] || TYPE_STYLES.general;
              const unread = !n.read;
              return (
                <button
                  key={n.id}
                  onClick={() => markRead(n)}
                  className={`w-full bg-white rounded-2xl p-4 shadow-sm border text-left flex items-start gap-3 active:scale-[0.98] transition-transform ${
                    unread ? "border-rose-100" : "border-slate-100"
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${style}`}
                  >
                    <TypeIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`flex-1 min-w-0 truncate text-sm ${
                          unread
                            ? "font-bold text-slate-900"
                            : "font-semibold text-slate-500"
                        }`}
                      >
                        {notifTitle(n)}
                      </p>
                      {unread && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                      )}
                    </div>
                    {notifMessage(n) && (
                      <p
                        className={`text-sm mt-0.5 ${
                          unread ? "text-slate-600" : "text-slate-400"
                        }`}
                      >
                        {notifMessage(n)}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                      {timeAgo(n)}
                      {n.read && (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600">
                          <Check className="w-3 h-3" />
                          Read
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
