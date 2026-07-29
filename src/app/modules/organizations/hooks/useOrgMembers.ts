import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { OrganizationMemberDocument } from '../types/member.types';

export function useOrgMembers(orgId: string | null | undefined) {
  const [members, setMembers] = useState<OrganizationMemberDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!orgId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'organization_members'),
      where('organizationId', '==', orgId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as OrganizationMemberDocument[];
        
        // Sort in memory by studentName
        docs.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
        
        setMembers(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useOrgMembers] Error fetching members:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orgId]);

  return { members, loading, error };
}
