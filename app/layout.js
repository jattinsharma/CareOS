import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import AuthGate from "@/components/AuthGate";
import RolePrompt from "@/components/RolePrompt";
import MobileLayoutWrapper from "@/components/layout/MobileLayoutWrapper";
import PWAUpdater from "@/components/PWAUpdater";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "KinOS — Family Care Coordination",
  description: "One shared space for medications, appointments, documents, and communication. Built for families caring for aging parents or managing chronic conditions.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KinOS",
  },
};

export const viewport = {
  themeColor: "#f43f5e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
          {/* Asks members without a family role to pick one (migration). */}
          <RolePrompt />
          {/* Mobile-only bottom navigation (auth + route gated) */}
          <MobileLayoutWrapper />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#fff',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '14px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              },
            }}
          />
        </AuthProvider>
        <PWAUpdater />
      </body>
    </html>
  );
}
