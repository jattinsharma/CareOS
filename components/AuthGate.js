"use client";

import { useAuth } from "@/components/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

// Routes anyone can visit without signing in (public marketing + auth pages).
const PUBLIC_ROUTES = ["/", "/pricing", "/login"];

/**
 * Route guard:
 * - Logged-out users visiting any protected page are sent to "/".
 * - Logged-in users may stay on public routes (no auto-redirect). An
 *   immediate router.replace on mount can crash the Android WebAPK
 *   with "failed to start", so logged-in users reach /dashboard via
 *   the "Go to Dashboard" button on the landing page instead.
 */
export default function AuthGate({ children }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // No redirect for logged-in users on public routes (WebAPK crash fix).
    if (!PUBLIC_ROUTES.includes(pathname) && !user) {
      router.replace("/");
    }
  }, [loading, user, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
      </div>
    );
  }

  return children;
}
