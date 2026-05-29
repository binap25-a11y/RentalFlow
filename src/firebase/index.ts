'use client';

/**
 * 📦 Firebase Barrel File
 * Re-exports core functionality and hooks from a centralized entry point.
 */

export * from './init';
export {
  useFirebase,
  useAuth,
  useFirestore,
  useStorage,
  useFirebaseApp,
  useMemoFirebase,
  useUser,
  FirebaseProvider,
  FirebaseContext,
} from './provider';

export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './firestore/query-builder';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
