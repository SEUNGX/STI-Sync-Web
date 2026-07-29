import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, query, where } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { LiquidationDocument } from '../types/liquidation.types';
import { LIQUIDATIONS_COLLECTION } from '../services/liquidation.service';

/**
 * Real-time stream of all Liquidation documents (for SAO Admin view).
 * Performs in-memory sorting by updatedAt descending to prevent index errors.
 */
export function useAllLiquidations() {
  const [liquidations, setLiquidations] = useState<LiquidationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = collection(db, LIQUIDATIONS_COLLECTION);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as LiquidationDocument)
        );
        // Sort newest first
        fetched.sort((a, b) => {
          const aTime = (a.updatedAt as any)?.seconds ?? 0;
          const bTime = (b.updatedAt as any)?.seconds ?? 0;
          return bTime - aTime;
        });
        setLiquidations(fetched);
        setLoading(false);
      },
      (err) => {
        console.error('[useAllLiquidations] Error streaming liquidations:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { liquidations, loading, error };
}

/**
 * Real-time stream of Liquidation documents for a specific organization (Officer View).
 */
export function useOrgLiquidations(orgId: string | null | undefined) {
  const [liquidations, setLiquidations] = useState<LiquidationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!orgId) {
      setLiquidations([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, LIQUIDATIONS_COLLECTION),
      where('organizationId', '==', orgId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as LiquidationDocument)
        );
        fetched.sort((a, b) => {
          const aTime = (a.updatedAt as any)?.seconds ?? 0;
          const bTime = (b.updatedAt as any)?.seconds ?? 0;
          return bTime - aTime;
        });
        setLiquidations(fetched);
        setLoading(false);
      },
      (err) => {
        console.error('[useOrgLiquidations] Error streaming org liquidations:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orgId]);

  return { liquidations, loading, error };
}

/**
 * Real-time stream of a single Liquidation document by ID.
 */
export function useLiquidationById(id: string | null | undefined) {
  const [liquidation, setLiquidation] = useState<LiquidationDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setLiquidation(null);
      setLoading(false);
      return;
    }

    const docRef = doc(db, LIQUIDATIONS_COLLECTION, id);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setLiquidation({ id: snapshot.id, ...snapshot.data() } as LiquidationDocument);
        } else {
          setLiquidation(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('[useLiquidationById] Error fetching liquidation:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  return { liquidation, loading, error };
}
