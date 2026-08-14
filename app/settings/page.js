"use client";

import Navbar from "@/components/Navbar";
import ProfileSettings from "@/components/ProfileSettings";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900">Profile Settings</h1>
        <p className="text-slate-500 mt-1 mb-8">
          Manage your account, photo, and family preferences.
        </p>
        <ProfileSettings />
      </div>
    </div>
  );
}
