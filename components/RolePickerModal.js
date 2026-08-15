"use client";

import { useEffect, useState } from "react";
import { FAMILY_ROLES } from "@/lib/family";
import { X, Users } from "lucide-react";

/**
 * "Who are you in this family?" role selector.
 * Shared by the join flow and the migration prompt. (Creating a group never
 * opens this — the creator's role is auto-set to "admin".)
 *
 * Props:
 *  - open:        bool
 *  - title:       heading (defaults to `Join ${familyName}`)
 *  - familyName:  family group name shown in the title
 *  - ctaLabel:    submit button text
 *  - closable:    allow dismissing (defaults to true; migration keeps it off)
 *  - submitting:  disable the button while the Firestore write is in flight
 *  - allowNone:   render a "None" tile so members can join / save without a
 *                 role label (submitted as "none")
 *  - onSkip:      when provided, renders a "Skip for now" ghost button next
 *                 to the CTA (used by the migration prompt so it can be
 *                 dismissed without picking a role)
 *  - onClose / onSelect(role) — role is the enum id, "none", or the custom
 *                 "other" text
 */
export default function RolePickerModal({
  open,
  title,
  familyName,
  ctaLabel = "Continue",
  closable = true,
  submitting = false,
  allowNone = false,
  onClose,
  onSelect,
  onSkip,
}) {
  const [selected, setSelected] = useState(null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSelected(null);
      setCustom("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const heading = title || (familyName ? `Join ${familyName}` : "Join your family");

  function handleSubmit() {
    if (!selected) {
      setError("Please select who you are in this family.");
      return;
    }
    if (selected === "other" && !custom.trim()) {
      setError("Please tell us your relationship (e.g., Grandfather).");
      return;
    }
    onSelect(selected === "other" ? custom.trim() : selected);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={closable ? onClose : undefined}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-rose-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-rose-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{heading}</h2>
              <p className="text-sm text-slate-500 mt-0.5">Who are you in this family?</p>
            </div>
          </div>
          {closable && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5 mt-5">
          {FAMILY_ROLES.map((r) => {
            const active = selected === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelected(r.id);
                  setError("");
                }}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3.5 transition-all ${
                  active
                    ? "border-rose-400 bg-rose-50 ring-2 ring-rose-200"
                    : "border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50/40"
                }`}
              >
                <span className="text-2xl leading-none">{r.emoji}</span>
                <span
                  className={`text-xs font-semibold ${
                    active ? "text-rose-700" : "text-slate-600"
                  }`}
                >
                  {r.label}
                </span>
              </button>
            );
          })}
          {allowNone && (
            <button
              type="button"
              onClick={() => {
                setSelected("none");
                setError("");
              }}
              aria-pressed={selected === "none"}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3.5 transition-all ${
                selected === "none"
                  ? "border-rose-400 bg-rose-50 ring-2 ring-rose-200"
                  : "border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50/40"
              }`}
            >
              <span className="text-2xl leading-none">🙅</span>
              <span
                className={`text-xs font-semibold ${
                  selected === "none" ? "text-rose-700" : "text-slate-600"
                }`}
              >
                None
              </span>
            </button>
          )}
        </div>

        {selected === "other" && (
          <input
            type="text"
            autoFocus
            placeholder="e.g., Grandfather, Caregiver"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setError("");
            }}
            className="w-full mt-3 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
          />
        )}

        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        <div className="mt-5 flex items-center gap-3">
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={submitting}
              className="flex-1 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-60 py-3 rounded-xl font-semibold transition-colors"
            >
              Skip for now
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={`${
              onSkip ? "flex-1" : "w-full"
            } bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition-colors`}
          >
            {submitting ? "Saving…" : ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
