'use client';

import { useEffect, useState } from 'react';
import {
  onSnapshot,
  Query,
  CollectionReference,
  DocumentData,
  QuerySnapshot,
  FirestoreError
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

/**
 * A robust hook to subscribe to a Firestore collection in real-time.
 * Emits contextual errors for security rule failures.
 */
export function useCollection<T = any>(
  ref: Query<DocumentData> | CollectionReference<DocumentData> | null
) {
  const [data, setData] = useState<WithId<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!ref) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      ref,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WithId<T>[];

        setData(results);
        setError(null);
        setLoading(false);
      },
      async (serverError: FirestoreError) => {
        // Attempt to extract the path from the reference for better error context
        const path = (ref as any).path || (ref as any)._query?.path?.segments?.join('/') || 'collection-group';
        
        // Construct rich, contextual error for the developer overlay
        const permissionError = new FirestorePermissionError({
          path: path,
          operation: 'list',
        } satisfies SecurityRuleContext);

        // Emit for central handling (FirebaseErrorListener)
        errorEmitter.emit('permission-error', permissionError);
        
        setError(permissionError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ref]);

  return { data, loading, error };
}