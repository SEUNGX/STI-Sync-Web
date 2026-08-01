import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { AnnouncementDocument } from '../types/announcement.types';
import { ANNOUNCEMENTS_COLLECTION } from '../services/announcement.service';

export function useAnnouncementStream(organizationId?: string | null) {
  const [announcements, setAnnouncements] = useState<AnnouncementDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, ANNOUNCEMENTS_COLLECTION),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnnouncementDocument));
        
        // If an organizationId filter is provided (e.g. Officer context), filter for relevant announcements
        if (organizationId) {
          docs = docs.filter(a => {
            const isCampusOrAllOrgs = a.audience === 'campus-wide' || a.audience === 'all-organizations';
            const isTargetedToMyOrg = Array.isArray(a.targetOrgIds) && a.targetOrgIds.includes(organizationId);
            const isMyOrgAuthored = a.organizationId === organizationId;
            return isCampusOrAllOrgs || isTargetedToMyOrg || isMyOrgAuthored;
          });
        }

        // Sort locally: pinned items first, then maintains createdAt desc
        const sorted = docs.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return 0;
        });

        setAnnouncements(sorted);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching announcements:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [organizationId]);

  return { announcements, loading, error };
}
