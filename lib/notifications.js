// Helpers for the per-user notifications inbox.
//
// The /notifications collection holds two shapes:
//   - Cloud Function (scheduled reminders): { userId, medicationId, title,
//     body, date, sentAt, read }
//   - Client-created (createNotification below): { userId, title, message,
//     type, read, createdAt }
// The inbox page reads both: message ?? body, createdAt ?? sentAt.

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// Saves an in-app notification for a user. "type" is 'med' | 'event' | 'general'.
export async function createNotification(userId, { title, message, type }) {
  await addDoc(collection(db, "notifications"), {
    userId,
    title,
    message,
    type,
    read: false,
    createdAt: serverTimestamp(),
  });
}
