import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { AuditLogDocument } from '../types/audit.types';
import { AUDIT_LOGS_COLLECTION } from '../services/audit.service';

export function useAuditLogs(maxEntries = 150) {
  const [data, setData] = useState<AuditLogDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, AUDIT_LOGS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(maxEntries)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const logs: AuditLogDocument[] = [];
        snapshot.forEach((doc) => {
          logs.push(doc.data() as AuditLogDocument);
        });
        setData(logs);
        setLoading(false);
      },
      (err) => {
        console.warn('useAuditLogs snapshot error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [maxEntries]);

  return { data, loading, error };
}
