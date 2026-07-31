import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { PayableDocument } from '../types/payable.types';

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
