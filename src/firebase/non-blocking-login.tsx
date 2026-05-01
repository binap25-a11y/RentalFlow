'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance);
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): Promise<void> {
  return createUserWithEmailAndPassword(authInstance, email, password).then(() => {});
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): Promise<void> {
  return signInWithEmailAndPassword(authInstance, email, password).then(() => {});
}

/** Initiate Google sign-in (non-blocking). */
export function initiateGoogleSignIn(authInstance: Auth): Promise<void> {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(authInstance, provider).then(() => {});
}

/** Initiate password reset (non-blocking). */
export function initiatePasswordReset(authInstance: Auth, email: string): Promise<void> {
  return sendPasswordResetEmail(authInstance, email);
}

/** Initiate sign-out (non-blocking). */
export function initiateSignOut(authInstance: Auth): Promise<void> {
  return signOut(authInstance);
}