import * as admin from 'firebase-admin';

/**
 * 🔐 Firebase Admin Engine
 * Secure server-side access to Firestore and Auth for automated plan upgrades.
 * Uses provided service account credentials for higher-level orchestration.
 */

if (!admin.apps.length) {
  try {
    // Attempt to use hardcoded service account for the provided pattern
    const serviceAccount = require("./serviceAccountKey.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || "studio-3118242301-8f4fd",
    });
    console.log('✅ Firebase Admin Initialized with Service Account');
  } catch (error) {
    console.warn('⚠️ Service Account Key missing, falling back to applicationDefault()');
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-3118242301-8f4fd",
      });
      console.log('✅ Firebase Admin Initialized with Default Credentials');
    } catch (fallbackError) {
      console.error('❌ Firebase Admin Initialization Failed:', fallbackError);
    }
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
