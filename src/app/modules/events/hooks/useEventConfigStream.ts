import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { EventTypeDocument, EventCategoryDocument, VenueDocument } from '../types/event-config.types';

export function useEventTypesStream() {
  const [eventTypes, setEventTypes] = useState<EventTypeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'event_types'),
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventTypeDocument));
        docs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setEventTypes(docs);
        setLoading(false);
      },
      (err) => {
        console.warn('Error fetching event types:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { eventTypes, loading, error };
}

export function useEventCategoriesStream() {
  const [categories, setCategories] = useState<EventCategoryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'event_categories'),
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventCategoryDocument));
        docs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setCategories(docs);
        setLoading(false);
      },
      (err) => {
        console.warn('Error fetching event categories:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { categories, loading, error };
}

export function useVenuesStream() {
  const [venues, setVenues] = useState<VenueDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'venues'),
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VenueDocument));
        docs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setVenues(docs);
        setLoading(false);
      },
      (err) => {
        console.warn('Error fetching venues:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { venues, loading, error };
}
