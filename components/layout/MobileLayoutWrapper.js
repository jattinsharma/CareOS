"use client";

import { useAuth } from "@/components/AuthProvider";
import { usePathname } from "next/navigation";
import MobileBottomNav from "@/components/layout/MobileBottomNav";

// Routes where the mobile bottom nav appears. The landing page (/), login,
// and settings are intentionally excluded.
const APP_ROUTES = new Set([
  "/dashboard",
  "/medications",
  "/calendar",
  "/family",
  "/vault",
]);

export default function MobileLayoutWrapper() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading || !user || !APP_ROUTES.has(pathname)) return null;

  return <MobileBottomNav />;
}
