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
        // Robust path extraction for debugging overlay
        let path = 'unknown-collection';
        if (ref && 'path' in ref) {
          path = (ref as any).path;
        } else {
          // Attempt to extract from internal query structure if it's a Query object
          try {
            const internalRef = (ref as any);
            if (internalRef._query?.path?.segments) {
              path = internalRef._query.path.segments.join('/');
            } else if (internalRef.converter?.path) {
              path = internalRef.converter.path;
            }
          } catch (e) {
            path = 'collection-query';
          }
        }
        
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