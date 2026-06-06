'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * 🔐 Hardened Firebase Initialization
 * Prevents circular dependencies and handles partial configuration strings safely.
 * Optimized for production stability within the Google Cloud Workstation environment.
 */
export function initializeFirebase() {
  // Ensure we don't attempt to initialize if projectId is missing (avoids trimEnd errors)
  if (!firebaseConfig.projectId) {
    console.error("CRITICAL: Firebase Project ID is missing from configuration.");
  }

  const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  
  // Enabling long polling resolves "Could not reach Cloud Firestore" errors
  // commonly caused by proxy/websocket restrictions in cloud workstation domains.
  const firestore = !getApps().length 
    ? initializeFirestore(firebaseApp, {
        experimentalForceLongPolling: true,
      })
    : getFirestore(firebaseApp);
  
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore,
    storage: getStorage(firebaseApp)
  };
}
