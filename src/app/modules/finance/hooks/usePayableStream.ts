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
    const q = query(collection(db, 'payables'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rawDocs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PayableDocument[];

        // Filter for institutional SAO / Admin collections (event fees & event fines)
        const institutionalDocs = rawDocs.filter((d) => {
          if (d.type === 'admin_fine') return true;
          if (d.type === 'event_fee' && (!d.organizationId || d.organizationId === 'sas' || d.organizationId === 'sas_admin')) {
            return true;
          }
          return false;
        });

        const groupsMap = new Map<string, import('../types/payable.types').StudentEventCollectionGroup>();

        for (const doc of institutionalDocs) {
          const groupId = doc.eventId ? `${doc.eventId}_${doc.type}` : (doc.label || 'unassigned');
          const eId = doc.eventId || 'unassigned';

          if (!groupsMap.has(groupId)) {
            groupsMap.set(groupId, {
              id: groupId,
              eventId: eId,
              eventName: doc.label || doc.description || (doc.type === 'admin_fine' ? 'Event Fine Collection' : 'Event Fee Collection'),
              eventDate: formatAppDate(doc.createdAt, '—'),
              type: doc.type,
              organizationId: doc.organizationId || null,
              payablePerStudent: doc.assignedAmount || 0,
              totalStudents: 0,
              totalAssigned: 0,
              totalCollected: 0,
              untransferredAmount: 0,
              transferredToBudget: false,
              transferredDate: undefined,
              payments: [],
            });
          }

          const group = groupsMap.get(groupId)!;
          group.totalStudents += 1;
          group.totalAssigned = (group.totalAssigned || 0) + (doc.assignedAmount || 0);
          
          const isPaid = doc.status === 'paid' || (doc.paidAmount || 0) >= (doc.assignedAmount || 0);
          const paidAmt = doc.paidAmount || 0;
          group.totalCollected = (group.totalCollected || 0) + paidAmt;

          if (!doc.transferredToBudget && paidAmt > 0) {
            group.untransferredAmount = (group.untransferredAmount || 0) + paidAmt;
          }

          if (doc.transferredToBudget && !group.transferredDate && doc.transferredAt) {
            group.transferredDate = formatAppDate(doc.transferredAt);
          }

          group.payments.push({
            id: doc.id,
            name: doc.studentName || 'Student',
            studentId: doc.studentSchoolId || doc.studentId,
            amount: paidAmt,
            paidDate: formatAppDate(doc.paidAt, '—'),
            status: isPaid ? 'Paid' : 'Pending',
          });
        }

        // Set transferredToBudget = true only if all paid items have been transferred
        groupsMap.forEach((group) => {
          const paidPayments = group.payments.filter((p) => p.status === 'Paid');
          group.transferredToBudget = paidPayments.length > 0 && (group.untransferredAmount === 0 || !group.untransferredAmount);
        });

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

/**
 * Streams student collections grouped by membership dues, event fees, and club fines for a specific organization.
 */
export function useOrgCollectionsStream(organizationId: string | null, semesterId?: string | null) {
  const [data, setData] = useState<import('../types/payable.types').StudentEventCollectionGroup[]>([]);
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
        const rawDocs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PayableDocument[];

        const groupsMap = new Map<string, import('../types/payable.types').StudentEventCollectionGroup>();

        for (const doc of rawDocs) {
          const groupId = doc.eventId
            ? `${doc.eventId}_${doc.type}`
            : (doc.type === 'membership_due' ? `membership_dues_${doc.semesterId || 'active'}` : doc.id);
          const eId = doc.eventId || 'unassigned';

          if (!groupsMap.has(groupId)) {
            groupsMap.set(groupId, {
              id: groupId,
              eventId: eId,
              eventName: doc.label || doc.description || (doc.type === 'membership_due' ? 'Membership Dues' : 'Club Payable'),
              eventDate: formatAppDate(doc.createdAt, '—'),
              type: doc.type,
              organizationId: doc.organizationId || null,
              payablePerStudent: doc.assignedAmount || 0,
              totalStudents: 0,
              totalAssigned: 0,
              totalCollected: 0,
              untransferredAmount: 0,
              transferredToBudget: false,
              transferredDate: undefined,
              payments: [],
            });
          }

          const group = groupsMap.get(groupId)!;
          group.totalStudents += 1;
          group.totalAssigned = (group.totalAssigned || 0) + (doc.assignedAmount || 0);

          const isPaid = doc.status === 'paid' || (doc.paidAmount || 0) >= (doc.assignedAmount || 0);
          const paidAmt = doc.paidAmount || 0;
          group.totalCollected = (group.totalCollected || 0) + paidAmt;

          if (!doc.transferredToBudget && paidAmt > 0) {
            group.untransferredAmount = (group.untransferredAmount || 0) + paidAmt;
          }

          if (doc.transferredToBudget && !group.transferredDate && doc.transferredAt) {
            group.transferredDate = formatAppDate(doc.transferredAt);
          }

          group.payments.push({
            id: doc.id,
            name: doc.studentName || 'Student',
            studentId: doc.studentSchoolId || doc.studentId,
            amount: paidAmt,
            paidDate: formatAppDate(doc.paidAt, '—'),
            status: isPaid ? 'Paid' : 'Pending',
          });
        }

        // Set transferredToBudget = true only if all paid items have been transferred
        groupsMap.forEach((group) => {
          const paidPayments = group.payments.filter((p) => p.status === 'Paid');
          group.transferredToBudget = paidPayments.length > 0 && (group.untransferredAmount === 0 || !group.untransferredAmount);
        });

        setData(Array.from(groupsMap.values()));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching org collections stream:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [organizationId, semesterId]);

  return { data, loading, error };
}
