import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { STUDENTS_COLLECTION } from '../services/student.service';
import type { StudentDocument } from '../types/student.types';

export function useStudents() {
  const [data, setData] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(db, STUDENTS_COLLECTION));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentDocument));
        docs.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
        setData(docs);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching students stream:', err);
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { data, loading, error };
}
