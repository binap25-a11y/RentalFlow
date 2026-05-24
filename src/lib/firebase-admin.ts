import * as admin from 'firebase-admin';

/**
 * 🔐 Firebase Admin Engine
 * Secure server-side access to Firestore and Auth for automated plan upgrades.
 * Configured to use the local serviceAccountKey.json for high-fidelity orchestration.
 */

if (!admin.apps.length) {
  try {
    const serviceAccount = require("./serviceAccountKey.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || "studio-3118242301-8f4fd",
    });
    console.log('✅ Firebase Admin Initialized with Private Key');
  } catch (error) {
    console.warn('⚠️ Service Account Key loading failed, attempting applicationDefault()');
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: "studio-3118242301-8f4fd",
      });
      console.log('✅ Firebase Admin Initialized with Default Credentials');
    } catch (fallbackError) {
      console.error('❌ Firebase Admin Critical Failure:', fallbackError);
    }
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();