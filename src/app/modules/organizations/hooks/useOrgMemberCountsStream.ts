import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../services/firebase';

export function useOrgMemberCountsStream() {
  const [countsMap, setCountsMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'organization_members'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const orgId = data.organizationId;
          if (orgId) {
            counts[orgId] = (counts[orgId] || 0) + 1;
          }
        });

        setCountsMap(counts);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useOrgMemberCountsStream] Error fetching member counts:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { countsMap, loading, error };
}
