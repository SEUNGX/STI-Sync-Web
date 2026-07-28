import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { AttendanceRecord } from '../types/attendance.types';

export const ATTENDANCE_COLLECTION = 'attendance';

export const createAttendanceRecord = async (
  data: Omit<AttendanceRecord, 'id' | 'createdAt'>
): Promise<string> => {
  const docRef = await addDoc(collection(db, ATTENDANCE_COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};
