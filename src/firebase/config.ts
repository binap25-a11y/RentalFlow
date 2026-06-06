/**
 * 🔐 Unified Firebase Configuration
 * Hardened with fallbacks to ensure operational stability even if environment
 * variables are not yet synchronized with the production console.
 */
export const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-3118242301-8f4fd",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1020347077013:web:2bec83a6c6a40cc861a69c",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDaX9iSfsaD3jh-VCOOt0Zz0IkDl-bBkW4",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-3118242301-8f4fd.firebaseapp.com",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-3118242301-8f4fd.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1020347077013",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || ""
};
