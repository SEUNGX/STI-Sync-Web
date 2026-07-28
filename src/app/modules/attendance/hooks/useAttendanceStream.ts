import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { ATTENDANCE_COLLECTION } from '../services/attendance.service';
import type { AttendanceRecord } from '../types/attendance.types';

export function useAttendanceStream() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            studentId: data.studentId || 'N/A',
            name: data.name || data.studentName || 'Unknown Student',
            org: data.org || data.organization || 'N/A',
            eventId: data.eventId || '',
            event: data.event || data.eventName || 'General Event',
            checkIn: data.checkIn || data.checkInTime || '—',
            checkOut: data.checkOut || data.checkOutTime || '—',
            status: data.status || 'Checked In',
            createdAt: data.createdAt,
            flaggedReason: data.flaggedReason,
          } as AttendanceRecord;
        });
        setAttendance(records);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching attendance stream:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { attendance, loading, error };
}
