"use client";

import { Eye, X } from "lucide-react";

/**
 * Sticky context banner shown below the navbar when a logged-in user is
 * viewing another family member's medications (viewerId !== patientId).
 *
 * Props:
 *  - patientName:  display name of the person whose meds are being viewed
 *  - viewerName:   display name of the logged-in viewer ("Logged in as …")
 *  - onDismiss:    called when the X is pressed — dismissal state lives in
 *                  the parent (useState, session-only by design)
 */
export default function CaregiverBanner({ patientName, viewerName, onDismiss }) {
  return (
    <div className="bg-rose-50 border-b border-rose-100 sticky top-16 z-40">
      <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <Eye className="w-4 h-4 text-rose-500 flex-shrink-0" />
        <p className="text-sm text-slate-700 flex-1 min-w-0">
          Viewing <span className="font-bold text-slate-900">{patientName}&apos;s</span>{" "}
          medications
          <span className="text-slate-500"> · Logged in as {viewerName}</span>
        </p>
        <button
          onClick={onDismiss}
          aria-label="Dismiss banner"
          className="p-1.5 -mr-1.5 hover:bg-rose-100 rounded-lg transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4 text-rose-400" />
        </button>
      </div>
    </div>
  );
}
