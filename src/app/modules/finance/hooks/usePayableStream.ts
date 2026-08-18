import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { PayableDocument } from '../types/payable.types';
import { formatAppDate } from '../../../utils/date';

export function useOrgPayables(organizationId: string | null, semesterId?: string | null) {
  const [data, setData] = useState<PayableDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setData([]);
      setLoading(false);
      return;
    }

    let q = query(
      collection(db, 'payables'),
      where('organizationId', '==', organizationId)
    );

    if (semesterId && semesterId !== 'all') {
      q = query(
        collection(db, 'payables'),
        where('organizationId', '==', organizationId),
        where('semesterId', '==', semesterId)
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PayableDocument[];

        setData(docs);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching org payables:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [organizationId, semesterId]);

  return { data, loading, error };
}

export function useStudentPayables(studentId: string | null, semesterId?: string | null) {
  const [data, setData] = useState<PayableDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!studentId) {
      setData([]);
      setLoading(false);
      return;
    }

    let q = query(
      collection(db, 'payables'),
      where('studentId', '==', studentId)
    );

    if (semesterId && semesterId !== 'all') {
      q = query(
        collection(db, 'payables'),
        where('studentId', '==', studentId),
        where('semesterId', '==', semesterId)
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PayableDocument[];

        setData(docs);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching student payables:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [studentId, semesterId]);

  return { data, loading, error };
}

export function usePayableById(payableId: string | null) {
  const [data, setData] = useState<PayableDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!payableId) {
      setData(null);
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'payables', payableId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as PayableDocument);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching payable by id:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [payableId]);

  return { data, loading, error };
}

export function useEventPayablesStream(eventId: string | null) {
  const [data, setData] = useState<PayableDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!eventId) {
      setData([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'payables'),
      where('eventId', '==', eventId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PayableDocument[];

        setData(docs);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching event payables:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [eventId]);

  return { data, loading, error };
}

export function useAllEventPayablesStream() {
  const [data, setData] = useState<import('../types/payable.types').StudentEventCollectionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'payables'),
      where('type', '==', 'event_fee')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rawDocs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PayableDocument[];

        const groupsMap = new Map<string, import('../types/payable.types').StudentEventCollectionGroup>();

        for (const doc of rawDocs) {
          const eId = doc.eventId || 'unassigned';
          if (!groupsMap.has(eId)) {
            groupsMap.set(eId, {
              id: eId,
              eventId: eId,
              eventName: doc.label || doc.description || 'Event Payable',
              eventDate: formatAppDate(doc.createdAt, '—'),
              payablePerStudent: doc.assignedAmount || 0,
              totalStudents: 0,
              transferredToBudget: Boolean(doc.transferredToBudget),
              transferredDate: doc.transferredAt ? formatAppDate(doc.transferredAt) : undefined,
              payments: [],
            });
          }

          const group = groupsMap.get(eId)!;
          group.totalStudents += 1;
          if (doc.transferredToBudget) {
            group.transferredToBudget = true;
            if (doc.transferredAt && !group.transferredDate) {
              group.transferredDate = formatAppDate(doc.transferredAt);
            }
          }

          const isPaid = doc.status === 'paid' || (doc.paidAmount || 0) >= (doc.assignedAmount || 0);
          group.payments.push({
            id: doc.id,
            name: doc.studentName || 'Student',
            studentId: doc.studentSchoolId || doc.studentId,
            amount: doc.paidAmount || 0,
            paidDate: formatAppDate(doc.paidAt, '—'),
            status: isPaid ? 'Paid' : 'Pending',
          });
        }

        setData(Array.from(groupsMap.values()));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching all event payables stream:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { data, loading, error };
}
