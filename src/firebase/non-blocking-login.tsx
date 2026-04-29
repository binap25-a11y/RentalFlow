'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';

/** 
 * Initiate anonymous sign-in (non-blocking). 
 * Errors will bubble up to the global error handler or development overlay.
 */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance);
}

/** 
 * Initiate email/password sign-up (non-blocking). 
 */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): void {
  createUserWithEmailAndPassword(authInstance, email, password);
}

/** 
 * Initiate email/password sign-in (non-blocking). 
 */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password);
}

/** 
 * Initiate Google sign-in (non-blocking). 
 */
export function initiateGoogleSignIn(authInstance: Auth): void {
  const provider = new GoogleAuthProvider();
  signInWithPopup(authInstance, provider);
}

/** 
 * Initiate password reset email (non-blocking). 
 */
export function initiatePasswordReset(authInstance: Auth, email: string): void {
  sendPasswordResetEmail(authInstance, email);
}

/** 
 * Initiate sign-out (non-blocking). 
 */
export function initiateSignOut(authInstance: Auth): void {
  signOut(authInstance);
}
