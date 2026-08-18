import { Timestamp } from 'firebase/firestore';

export type AttendanceStatus = 'Complete' | 'Checked In' | 'Absent' | 'Flagged' | 'Late';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  name: string;
  org: string;
  eventId?: string;
  event: string;
  sessionId?: string;
  checkIn: string;
  checkOut: string;
  status: AttendanceStatus;
  createdAt?: Timestamp | any;
  flaggedReason?: string;
  scannedBy?: string;
  scannedByName?: string;
}

export interface EnrichedAttendanceRecord extends AttendanceRecord {
  studentAuthUid?: string;
  studentSchoolId?: string;
  departmentId?: string;
  departmentName?: string;
  departmentCode?: string;
  courseId?: string;
  courseCode?: string;
  courseName?: string;
  section?: string;
  yearLevel?: string;
  sessionTitle?: string;
  duration?: string;
}

export interface EventAttendanceSummary {
  id: string;
  event: string;
  registered: number;
  checkedIn: number;
  absent: number;
}

export interface AttendanceFilterState {
  searchQuery: string;
  departmentId: string;
  courseId: string;
  section: string;
  yearLevel: string;
  sessionId: string;
  status: string;
}
