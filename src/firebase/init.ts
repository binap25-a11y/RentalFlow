'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * 🔐 Isolated Firebase Initialization
 * Prevents circular dependencies in the module graph by keeping initialization
 * separate from the re-exporting barrel file.
 */
export function initializeFirebase() {
  const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  
  // Hardened Firestore initialization for Cloud Workstations
  // Enabling long polling resolves "Could not reach Cloud Firestore backend" errors
  // often caused by proxy/websocket restrictions in restricted environments.
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
