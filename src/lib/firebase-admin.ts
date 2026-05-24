import * as admin from 'firebase-admin';

/**
 * 🔐 Firebase Admin Engine
 * Secure server-side access to Firestore and Auth.
 * Optimized for production safety and credential redaction compliance.
 */

if (!admin.apps.length) {
  const envServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (envServiceAccount) {
    try {
      const serviceAccount = JSON.parse(envServiceAccount);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      console.log('✅ Firebase Admin: Initialized with Environment Variable');
    } catch (e) {
      console.error('❌ Firebase Admin: Environment variable parsing failed', e);
    }
  } else {
    try {
      // Local development fallback
      const serviceAccount = require("./serviceAccountKey.json");
      
      if (serviceAccount.private_key && !serviceAccount.private_key.includes('REDACTED')) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id,
        });
        console.log('✅ Firebase Admin: Initialized with Local Key');
      } else {
        throw new Error("Placeholder key detected");
      }
    } catch (error) {
      console.warn('⚠️ Firebase Admin: Local key missing or redacted. Attempting applicationDefault()...');
      try {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: "studio-3118242301-8f4fd",
        });
        console.log('✅ Firebase Admin: Initialized with Application Default Credentials');
      } catch (fallbackError) {
        console.error('❌ Firebase Admin: Critical Failure. Admin services are offline.');
      }
    }
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();