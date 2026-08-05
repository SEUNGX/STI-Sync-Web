import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, where } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { EventDocument } from '../types/event.types';
import { EVENTS_COLLECTION } from '../services/event.service';

export function useAllEvents() {
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Get all events that are not drafts
    const q = collection(db, EVENTS_COLLECTION);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedEvents = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as EventDocument))
          .filter(e => e.proposalStatus !== 'draft');

        fetchedEvents.sort((a, b) => {
          const aTime = (a.createdAt as any)?.seconds ?? 0;
          const bTime = (b.createdAt as any)?.seconds ?? 0;
          return bTime - aTime;
        });

        setEvents(fetchedEvents);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching events:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { events, loading, error };
}

export function useEventById(eventId: string | undefined) {
  const [event, setEvent] = useState<EventDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      setLoading(false);
      return;
    }

    const docRef = doc(db, EVENTS_COLLECTION, eventId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setEvent({ id: snapshot.id, ...snapshot.data() } as EventDocument);
        } else {
          setEvent(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching event by ID:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [eventId]);

  return { event, loading, error };
}

export function useDraftEvents() {
  const [drafts, setDrafts] = useState<EventDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, EVENTS_COLLECTION),
      where('proposalStatus', '==', 'draft')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedDrafts = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as EventDocument)
        );
        fetchedDrafts.sort((a, b) => {
          const aTime = (a.updatedAt as any)?.seconds ?? 0;
          const bTime = (b.updatedAt as any)?.seconds ?? 0;
          return bTime - aTime;
        });
        setDrafts(fetchedDrafts);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching drafts:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { drafts, loading, error };
}

export function useOrgEvents(orgId: string | null | undefined) {
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = collection(db, EVENTS_COLLECTION);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let fetched = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as EventDocument)
        );

        if (orgId && orgId.trim()) {
          const cleanOrgId = orgId.trim().toLowerCase();
          fetched = fetched.filter((e: any) => {
            const orgFields = [
              e.hostingOrgId,
              e.organizationId,
              e.createdByOrgId,
              e.orgId,
              e.hostingOrgName,
              e.orgName,
            ];
            return orgFields.some(
              (f) => f && String(f).trim().toLowerCase().includes(cleanOrgId)
            );
          });
        }

        fetched.sort((a, b) => {
          const aTime = (a.createdAt as any)?.seconds ?? (a.updatedAt as any)?.seconds ?? 0;
          const bTime = (b.createdAt as any)?.seconds ?? (b.updatedAt as any)?.seconds ?? 0;
          return bTime - aTime;
        });

        setEvents(fetched);
        setLoading(false);
      },
      (err) => {
        console.error('[useOrgEvents] Error streaming org events:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orgId]);

  return { events, loading, error };
}

