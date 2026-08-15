"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { CheckCircle, Send, Star, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import toast from "react-hot-toast";

const RATING_LABELS = {
  1: "Needs improvement",
  2: "Below expectations",
  3: "Good",
  4: "Very good",
  5: "Excellent!",
};

/**
 * "Share Feedback" modal (opened from the Beta Access card on the dashboard).
 *
 * Writes one doc to /feedback/{docId} with the user's rating + answers,
 * tagged with their auth info and the page they were on. Reads are admin-only
 * (see firestore.rules), so only the write path is exposed to clients.
 *
 * Props:
 *  - open:     bool — show the modal
 *  - onClose:  () => void — dismiss (X, outside click, Escape, or 2s after success)
 */
export default function FeedbackModal({ open, onClose }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [likes, setLikes] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [improvements, setImprovements] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Reset form state every time the modal opens
  useEffect(() => {
    if (!open) return;
    setRating(0);
    setHoverRating(0);
    setLikes("");
    setDislikes("");
    setImprovements("");
    setSubmitting(false);
    setSubmitted(false);
  }, [open]);

  // Lock body scroll while the modal is open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit =
    rating > 0 && likes.trim().length > 0 && improvements.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "feedback"), {
        userId: user?.uid || "",
        userName: user?.displayName || "",
        userEmail: user?.email || "",
        rating,
        likes: likes.trim(),
        dislikes: dislikes.trim(),
        improvements: improvements.trim(),
        page: typeof window !== "undefined" ? window.location.pathname : "",
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
      setTimeout(onClose, 2000);
    } catch {
      setSubmitting(false);
      toast.error("Couldn't send your feedback. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        {submitted ? (
          <div className="py-10 text-center">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900">Thank you!</h2>
            <p className="text-slate-500 mt-1">
              Your feedback helps us build a better KinOS.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Share Feedback
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Help us make KinOS better for your family.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Star rating */}
            <div
              className="flex items-center justify-center gap-1.5"
              onMouseLeave={() => setHoverRating(0)}
            >
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = n <= (hoverRating || rating);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                    className="transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={`w-9 h-9 ${
                        filled
                          ? "text-rose-500 fill-rose-500"
                          : "text-slate-300"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <p
              className={`text-center text-sm font-semibold mt-2 ${
                rating > 0 ? "text-rose-600" : "text-slate-400"
              }`}
            >
              {rating > 0 ? RATING_LABELS[rating] : "Tap a star to rate"}
            </p>

            <div className="space-y-4 mt-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  What do you like about KinOS?{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={likes}
                  onChange={(e) => setLikes(e.target.value)}
                  placeholder="e.g., The med reminders keep everyone on schedule"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  What don&apos;t you like?{" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={dislikes}
                  onChange={(e) => setDislikes(e.target.value)}
                  placeholder="e.g., The calendar could use color coding"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  What should we improve?{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={improvements}
                  onChange={(e) => setImprovements(e.target.value)}
                  placeholder="e.g., Add SMS alerts when a dose is missed"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-900 placeholder:text-slate-400 resize-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={`w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-colors disabled:cursor-not-allowed ${
                submitting
                  ? "bg-rose-400 animate-pulse"
                  : "bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:opacity-50"
              }`}
            >
              {submitting ? (
                "Sending…"
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Feedback
                </>
              )}
            </button>

            {!canSubmit && !submitting && (
              <p className="mt-3 text-xs text-slate-400 text-center">
                {rating === 0
                  ? "Select a star rating to submit"
                  : "Fill in the required fields to submit"}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
