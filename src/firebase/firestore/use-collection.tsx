'use client';

import { useEffect, useState } from 'react';
import {
  onSnapshot,
  Query,
  CollectionReference,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';

export type WithId<T> = T & { id: string };

/**
 * A clean, robust version of the useCollection hook.
 * Subscribes to a Firestore collection or query in real-time.
 */
export function useCollection<T = any>(
  ref: Query<DocumentData> | CollectionReference<DocumentData> | null | undefined
) {
  const [data, setData] = useState<WithId<T>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!ref) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      ref,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WithId<T>[];

        setData(results);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Firestore error:", err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ref]);

  return { data, isLoading, error };
}