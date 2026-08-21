import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { SaoLedgerDocument, OrgLedgerDocument } from '../types/finance.types';

export function parseTimestampMillis(date: any): number {
  if (!date) return 0;
  if (typeof date.toMillis === 'function') return date.toMillis();
  if (typeof date.seconds === 'number') return date.seconds * 1000;
  if (date instanceof Date) return date.getTime();
  if (typeof date === 'string') {
    const parsed = new Date(date).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function useSaoLedger() {
  const [data, setData] = useState<SaoLedgerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Query collection directly and sort in memory to avoid missing docs or composite index requirements
    const q = query(collection(db, 'sao_ledger'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as SaoLedgerDocument[];

        docs.sort((a, b) => {
          const aTime = parseTimestampMillis(a.date) || parseTimestampMillis(a.createdAt);
          const bTime = parseTimestampMillis(b.date) || parseTimestampMillis(b.createdAt);
          return aTime - bTime;
        });

        setData(docs);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching SAO ledger:', err);
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { data, loading, error };
}

export function useOrgLedger(organizationId: string | null) {
  const [data, setData] = useState<OrgLedgerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setData([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'organization_ledger'),
      where('organizationId', '==', organizationId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as OrgLedgerDocument[];
        
        // Sort locally by date ascending
        docs.sort((a, b) => {
          const aTime = parseTimestampMillis(a.date) || parseTimestampMillis(a.createdAt);
          const bTime = parseTimestampMillis(b.date) || parseTimestampMillis(b.createdAt);
          return aTime - bTime;
        });

        setData(docs);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching Org ledger:', err);
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [organizationId]);

  return { data, loading, error };
}
