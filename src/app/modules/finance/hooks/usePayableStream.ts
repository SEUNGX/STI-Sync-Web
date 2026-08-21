import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { PayableDocument, StudentEventCollectionGroup } from '../types/payable.types';
import { formatAppDate, formatAppDateTime } from '../../../utils/date';

export function useAllPayables() {
  const [data, setData] = useState<PayableDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = collection(db, 'payables');
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
        console.error('Error fetching all payables:', err);
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { data, loading, error };
}

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
  const [data, setData] = useState<StudentEventCollectionGroup[]>([]);
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
          if (
            d.type === 'event_fee' &&
            (!d.organizationId ||
              d.organizationId === 'sas' ||
              d.organizationId === 'sas_admin' ||
              d.organizationId === 'sao' ||
              d.organizationId === 'sao_admin')
          ) {
            return true;
          }
          if (!d.organizationId && d.type !== 'membership_due' && d.type !== 'org_fine') {
            return true;
          }
          return false;
        });

        const groupsMap = new Map<string, StudentEventCollectionGroup>();

        for (const doc of institutionalDocs) {
          const groupId = doc.eventId ? `${doc.eventId}_${doc.type}` : (doc.label || 'unassigned');
          const eId = doc.eventId || 'unassigned';

          if (!groupsMap.has(groupId)) {
            groupsMap.set(groupId, {
              id: groupId,
              eventId: eId,
              eventName: doc.label || doc.description || (doc.type === 'admin_fine' ? 'Event Fine Collection' : 'Event Fee Collection'),
              eventDate: formatAppDateTime(doc.createdAt, formatAppDate(doc.createdAt, '—')),
              type: doc.type,
              organizationId: doc.organizationId || null,
              payablePerStudent: doc.assignedAmount || 0,
              totalStudents: 0,
              totalAssigned: 0,
              totalCollected: 0,
              transferredAmount: 0,
              untransferredAmount: 0,
              transferredToBudget: false,
              transferredDate: undefined,
              payments: [],
            });
          }

          const group = groupsMap.get(groupId)!;
          group.totalStudents += 1;
          group.totalAssigned = (group.totalAssigned || 0) + (Number(doc.assignedAmount) || 0);
          
          const statusLower = String(doc.status || '').toLowerCase();
          const isPaidStatus = statusLower === 'paid';
          const hasPaidAmount = (Number(doc.paidAmount) || 0) > 0;
          const assignedAmt = Number(doc.assignedAmount) || 0;
          const paidAmt = hasPaidAmount ? Number(doc.paidAmount) : (isPaidStatus ? assignedAmt : 0);
          const isPaid = isPaidStatus || hasPaidAmount;

          const docTransferredAmt = typeof doc.transferredAmount === 'number'
            ? Math.min(paidAmt, Math.max(0, doc.transferredAmount))
            : (doc.transferredToBudget ? paidAmt : 0);

          const docUntransferredAmt = Math.max(0, paidAmt - docTransferredAmt);
          const isDocFullyTransferred = paidAmt > 0 && docTransferredAmt >= paidAmt;

          group.totalCollected = (group.totalCollected || 0) + paidAmt;
          group.transferredAmount = (group.transferredAmount || 0) + docTransferredAmt;
          group.untransferredAmount = (group.untransferredAmount || 0) + docUntransferredAmt;

          if (docTransferredAmt > 0 && !group.transferredDate && doc.transferredAt) {
            group.transferredDate = formatAppDateTime(doc.transferredAt, formatAppDate(doc.transferredAt));
          }

          group.payments.push({
            id: doc.id,
            name: doc.studentName || 'Student',
            studentId: doc.studentSchoolId || doc.studentId,
            amount: paidAmt,
            paidDate: formatAppDateTime(doc.paidAt, formatAppDate(doc.paidAt, '—')),
            status: isPaid ? 'Paid' : 'Pending',
            transferredAmount: docTransferredAmt,
            untransferredAmount: docUntransferredAmt,
            transferredToBudget: isDocFullyTransferred,
            transferredAt: doc.transferredAt ? formatAppDateTime(doc.transferredAt, formatAppDate(doc.transferredAt)) : undefined,
            transferredBatchId: doc.transferredBatchId || undefined,
            paymentMethod: doc.paymentMethod || 'cash',
            fineViolations: doc.fineViolations || undefined,
            description: doc.description || doc.label,
          });
        }

        // Set transferredToBudget = true ONLY if all collected funds have been transferred
        groupsMap.forEach((group) => {
          const hasCollected = (group.totalCollected || 0) > 0;
          const hasUntransferred = (group.untransferredAmount || 0) > 0;
          group.transferredToBudget = hasCollected && !hasUntransferred;
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
  const [data, setData] = useState<StudentEventCollectionGroup[]>([]);
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

        const groupsMap = new Map<string, StudentEventCollectionGroup>();

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
              eventDate: formatAppDateTime(doc.createdAt, formatAppDate(doc.createdAt, '—')),
              type: doc.type,
              organizationId: doc.organizationId || null,
              payablePerStudent: doc.assignedAmount || 0,
              totalStudents: 0,
              totalAssigned: 0,
              totalCollected: 0,
              transferredAmount: 0,
              untransferredAmount: 0,
              transferredToBudget: false,
              transferredDate: undefined,
              payments: [],
            });
          }

          const group = groupsMap.get(groupId)!;
          group.totalStudents += 1;
          group.totalAssigned = (group.totalAssigned || 0) + (Number(doc.assignedAmount) || 0);

          const statusLower = String(doc.status || '').toLowerCase();
          const isPaidStatus = statusLower === 'paid';
          const hasPaidAmount = (Number(doc.paidAmount) || 0) > 0;
          const assignedAmt = Number(doc.assignedAmount) || 0;
          const paidAmt = hasPaidAmount ? Number(doc.paidAmount) : (isPaidStatus ? assignedAmt : 0);
          const isPaid = isPaidStatus || hasPaidAmount;

          const docTransferredAmt = typeof doc.transferredAmount === 'number'
            ? Math.min(paidAmt, Math.max(0, doc.transferredAmount))
            : (doc.transferredToBudget ? paidAmt : 0);

          const docUntransferredAmt = Math.max(0, paidAmt - docTransferredAmt);
          const isDocFullyTransferred = paidAmt > 0 && docTransferredAmt >= paidAmt;

          group.totalCollected = (group.totalCollected || 0) + paidAmt;
          group.transferredAmount = (group.transferredAmount || 0) + docTransferredAmt;
          group.untransferredAmount = (group.untransferredAmount || 0) + docUntransferredAmt;

          if (docTransferredAmt > 0 && !group.transferredDate && doc.transferredAt) {
            group.transferredDate = formatAppDateTime(doc.transferredAt, formatAppDate(doc.transferredAt));
          }

          group.payments.push({
            id: doc.id,
            name: doc.studentName || 'Student',
            studentId: doc.studentSchoolId || doc.studentId,
            amount: paidAmt,
            paidDate: formatAppDateTime(doc.paidAt, formatAppDate(doc.paidAt, '—')),
            status: isPaid ? 'Paid' : 'Pending',
            transferredAmount: docTransferredAmt,
            untransferredAmount: docUntransferredAmt,
            transferredToBudget: isDocFullyTransferred,
            transferredAt: doc.transferredAt ? formatAppDateTime(doc.transferredAt, formatAppDate(doc.transferredAt)) : undefined,
            transferredBatchId: doc.transferredBatchId || undefined,
            paymentMethod: doc.paymentMethod || 'cash',
            fineViolations: doc.fineViolations || undefined,
            description: doc.description || doc.label,
          });
        }

        // Set transferredToBudget = true ONLY if all collected funds have been transferred
        groupsMap.forEach((group) => {
          const hasCollected = (group.totalCollected || 0) > 0;
          const hasUntransferred = (group.untransferredAmount || 0) > 0;
          group.transferredToBudget = hasCollected && !hasUntransferred;
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
