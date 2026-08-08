"use client";

import { useAuth } from "@/components/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

// Routes anyone can visit without signing in (public marketing pages).
const PUBLIC_ROUTES = ["/", "/pricing"];

/**
 * Route guard:
 * - Logged-in users visiting a public route are sent to /dashboard.
 * - Logged-out users visiting any protected page are sent to "/".
 */
export default function AuthGate({ children }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (PUBLIC_ROUTES.includes(pathname)) {
      if (user) router.replace("/dashboard");
    } else if (!user) {
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
