import * as admin from 'firebase-admin';

/**
 * 🔐 Firebase Admin Engine
 * Secure server-side access to Firestore and Auth for automated plan upgrades.
 * Uses applicationDefault() for production stability.
 */

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-3118242301-8f4fd",
    });
    console.log('✅ Firebase Admin Initialized');
  } catch (error) {
    console.error('❌ Firebase Admin Initialization Failed:', error);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
