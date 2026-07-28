import { Timestamp } from 'firebase/firestore';

export type AttendanceStatus = 'Complete' | 'Checked In' | 'Absent' | 'Flagged';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  name: string;
  org: string;
  eventId?: string;
  event: string;
  checkIn: string;
  checkOut: string;
  status: AttendanceStatus;
  createdAt?: Timestamp | any;
  flaggedReason?: string;
}

export interface EventAttendanceSummary {
  id: string;
  event: string;
  registered: number;
  checkedIn: number;
  absent: number;
}
