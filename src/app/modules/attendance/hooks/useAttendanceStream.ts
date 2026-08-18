import { useState, useEffect } from 'react';
import { collectionGroup, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { AttendanceRecord } from '../types/attendance.types';
import { formatAppTime } from '../../../utils/date';

export function useAttendanceStream() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let normalRecords: AttendanceRecord[] = [];
    let flaggedRecords: AttendanceRecord[] = [];

    const formatTime = (timestamp: any): string => {
      return formatAppTime(timestamp, '—');
    };

    const updateCombinedRecords = () => {
      const recordMap = new Map<string, AttendanceRecord>();
      for (const r of [...normalRecords, ...flaggedRecords]) {
        if (!recordMap.has(r.id)) {
          recordMap.set(r.id, r);
        }
      }
      const combined = Array.from(recordMap.values());
      // Sort newest first
      combined.sort((a, b) => {
        const aTime = a.createdAt?.seconds ?? 0;
        const bTime = b.createdAt?.seconds ?? 0;
        return bTime - aTime;
      });
      setAttendance(combined);
      setLoading(false);
    };

    // 1. Listen to all /attendance subcollections & top-level collection
    const unsubAttendanceGroup = onSnapshot(
      collectionGroup(db, 'attendance'),
      (snapshot) => {
        normalRecords = snapshot.docs.map((doc) => {
          const data = doc.data();
          const scanTimeStr = formatTime(data.scannedAt || data.createdAt);
          const checkInTime = data.gateType === 'time_in' ? scanTimeStr : (data.checkIn || '—');
          const checkOutTime = data.gateType === 'time_out' ? scanTimeStr : (data.checkOut || '—');
          const mappedStatus = data.status === 'Present' ? 'Checked In' : (data.status || 'Checked In');

          return {
            id: doc.id,
            studentId: data.studentId || data.studentNumber || 'N/A',
            name: data.studentName || data.name || 'Unknown Student',
            org: data.organizationId || data.org || 'N/A',
            eventId: data.eventId || '',
            event: data.event || data.eventName || 'General Event',
            sessionId: data.sessionId || '',
            checkIn: checkInTime,
            checkOut: checkOutTime,
            status: mappedStatus as any,
            createdAt: data.createdAt || data.serverTimestamp,
            flaggedReason: data.flagNote || data.flaggedReason,
          };
        });
        updateCombinedRecords();
      },
      (err) => {
        console.warn('[useAttendanceStream] collectionGroup(attendance) warning:', err?.message);
        setLoading(false);
      }
    );

    // 2. Listen to all /flagged_attendance subcollections & top-level collection
    const unsubFlaggedGroup = onSnapshot(
      collectionGroup(db, 'flagged_attendance'),
      (snapshot) => {
        flaggedRecords = snapshot.docs.map((doc) => {
          const data = doc.data();
          const scanTimeStr = formatTime(data.scannedAt || data.createdAt);

          return {
            id: doc.id,
            studentId: data.studentId || data.studentNumber || 'N/A',
            name: data.studentName || data.name || 'Unknown Student',
            org: data.organizationId || data.org || 'N/A',
            eventId: data.eventId || '',
            event: data.event || data.eventName || 'General Event',
            sessionId: data.sessionId || '',
            checkIn: data.gateType === 'time_in' ? scanTimeStr : '—',
            checkOut: data.gateType === 'time_out' ? scanTimeStr : '—',
            status: 'Flagged',
            createdAt: data.createdAt,
            flaggedReason: data.flagReason || data.flagNote || 'Flagged Attendance',
          };
        });
        updateCombinedRecords();
      },
      (err) => {
        console.warn('[useAttendanceStream] collectionGroup(flagged_attendance) warning:', err?.message);
        setLoading(false);
      }
    );

    return () => {
      unsubAttendanceGroup();
      unsubFlaggedGroup();
    };
  }, []);

  return { attendance, loading, error };
}
