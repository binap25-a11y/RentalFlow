
import * as admin from 'firebase-admin';

/**
 * 🔐 Firebase Admin Engine
 * Secure server-side access to Firestore for automated plan upgrades and system tasks.
 * Prevents multiple initializations in Next.js hot-reload environment.
 */

if (!admin.apps.length) {
  try {
    // We use service account from env if available, or initialize with defaults for development
    // Note: In a production Firebase environment, defaults are usually sufficient.
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-3118242301-8f4fd",
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Failed:', error);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
