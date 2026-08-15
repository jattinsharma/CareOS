"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Pill, Calendar, Users } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/medications", label: "Meds", icon: Pill },
  { href: "/calendar", label: "Events", icon: Calendar },
  { href: "/family", label: "Members", icon: Users },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform ${
                active ? "text-slate-900" : "text-slate-400"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
