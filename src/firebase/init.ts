'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * 🔐 Isolated Firebase Initialization
 * Prevents circular dependencies in the module graph by keeping initialization
 * separate from the re-exporting barrel file.
 */
export function initializeFirebase() {
  const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
    storage: getStorage(firebaseApp)
  };
}
