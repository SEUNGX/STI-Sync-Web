import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { AttendanceRecord, AttendanceStatus } from '../types/attendance.types';

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

/**
 * Checks if a session's check-in scanning window or start time cutoff has passed.
 */
export function isSessionCheckInPassed(
  session: {
    date?: string;
    startTime?: string;
    endTime?: string;
    timeInClose?: string;
    timeOutClose?: string;
  },
  graceMinutes = 15,
  lateThresholdMinutes = 60
): boolean {
  if (!session || !session.date || session.date === 'TBA' || session.date === 'TBD') {
    return false;
  }

  const dateStr = session.date.trim();
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return false;

  const [_, yStr, mStr, dStr] = dateMatch;
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10) - 1;
  const day = parseInt(dStr, 10);

  const now = new Date();

  // 1. If explicit timeInClose is specified (e.g. "00:20")
  if (session.timeInClose) {
    const [ch, cm] = session.timeInClose.split(':').map(Number);
    if (!isNaN(ch) && !isNaN(cm)) {
      const closeDate = new Date(year, month, day, ch, cm, 0);
      return now.getTime() >= closeDate.getTime();
    }
  }

  // 2. If session has startTime, check startTime + lateThresholdMinutes
  if (session.startTime) {
    const [sh, sm] = session.startTime.split(':').map(Number);
    if (!isNaN(sh) && !isNaN(sm)) {
      const totalMinutes = sh * 60 + sm + (lateThresholdMinutes || 60);
      const closeH = Math.floor(totalMinutes / 60);
      const closeM = totalMinutes % 60;
      const closeDate = new Date(year, month, day, closeH, closeM, 0);
      return now.getTime() >= closeDate.getTime();
    }
  }

  // 3. If session has endTime, check endTime
  if (session.endTime) {
    const [eh, em] = session.endTime.split(':').map(Number);
    if (!isNaN(eh) && !isNaN(em)) {
      const closeDate = new Date(year, month, day, eh, em, 0);
      return now.getTime() >= closeDate.getTime();
    }
  }

  // 4. Default: check if the session day has completed
  const endOfDay = new Date(year, month, day, 23, 59, 59);
  return now.getTime() >= endOfDay.getTime();
}

/**
 * Checks if a student is part of an event's target audience.
 */
export function isStudentTargetedForEvent(
  student: any,
  event: any,
  orgMembers?: any[]
): boolean {
  if (!student || !event) return false;

  // 1. Target Audience Scope (Members only vs All campus students)
  if (event.targetAudienceScope === 'members') {
    if (orgMembers && orgMembers.length > 0) {
      const isMember = orgMembers.some((m) => {
        const matchOrg = m.organizationId === event.hostingOrgId;
        const matchStudent =
          (m.studentId &&
            student.studentId &&
            m.studentId.trim().toLowerCase() === student.studentId.trim().toLowerCase()) ||
          (m.authUid &&
            student.authUid &&
            m.authUid.trim().toLowerCase() === student.authUid.trim().toLowerCase()) ||
          (m.studentSchoolId &&
            student.studentId &&
            m.studentSchoolId.trim().toLowerCase() === student.studentId.trim().toLowerCase());
        return matchOrg && matchStudent && m.status === 'active';
      });
      if (!isMember) return false;
    }
  }

  // 2. Target Academic Level (COLLEGE vs SHS)
  if (event.targetAcademicLevel && event.targetAcademicLevel !== 'BOTH') {
    const sLevel =
      student.academicLevel ||
      (String(student.yearLevel).toLowerCase().includes('grade') ? 'SHS' : 'COLLEGE');
    if (sLevel !== event.targetAcademicLevel) {
      return false;
    }
  }

  // 3. Target Departments (if specified)
  if (event.targetDepartments && event.targetDepartments.length > 0) {
    const sDept = (student.departmentId || student.departmentCode || '').trim();
    const matchesDept = event.targetDepartments.some(
      (d: string) => d.trim().toLowerCase() === sDept.toLowerCase()
    );
    if (!matchesDept) return false;
  }

  // 4. Target Courses / Programs (if specified)
  if (event.targetCourses && event.targetCourses.length > 0) {
    const sCourseId = (student.courseId || '').trim();
    const sCourseCode = (student.courseCode || '').trim();
    const matchesCourse = event.targetCourses.some(
      (c: string) =>
        c.trim().toLowerCase() === sCourseId.toLowerCase() ||
        c.trim().toLowerCase() === sCourseCode.toLowerCase()
    );
    if (!matchesCourse) return false;
  }

  // 5. Target Year Levels (if specified)
  if (event.targetYearLevels && event.targetYearLevels.length > 0) {
    const sYear = (student.yearLevel || '').trim();
    const matchesYear = event.targetYearLevels.some(
      (y: string) => y.trim().toLowerCase() === sYear.toLowerCase()
    );
    if (!matchesYear) return false;
  }

  // 6. Target Sections (if specified)
  if (event.targetSections && event.targetSections.length > 0) {
    const sSection = (student.section || student.sectionId || '').trim();
    const matchesSection = event.targetSections.some(
      (sec: string) => sec.trim().toLowerCase() === sSection.toLowerCase()
    );
    if (!matchesSection) return false;
  }

  return true;
}

/**
 * Automatically creates and writes missing Absent attendance records in Firestore for
 * eligible students who did not scan in for sessions that have already passed.
 */
export async function syncEventAbsenteeRecords(
  event: any,
  eligibleStudents: any[]
): Promise<number> {
  if (!event || !event.id) return 0;
  const sessions = event.sessions && event.sessions.length > 0 ? event.sessions : [
    {
      id: `${event.id}-main`,
      title: 'Main Session',
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
    }
  ];

  // 1. Fetch current attendance records for this event
  const attRef = collection(db, ATTENDANCE_COLLECTION);
  const q = query(attRef, where('eventId', '==', event.id));
  const snap = await getDocs(q);
  const existingRecords = snap.docs.map((d) => ({ id: d.id, ...(d.data() as AttendanceRecord) }));

  const newRecords: Array<Omit<AttendanceRecord, 'id' | 'createdAt'>> = [];

  // 2. Loop through sessions
  sessions.forEach((session: any) => {
    const isPassed = isSessionCheckInPassed(
      session,
      event.gracePeriodMinutes,
      event.lateThresholdMinutes
    );
    if (!isPassed && event.proposalStatus !== 'completed' && event.status !== 'Completed') {
      return;
    }

    const sId = session.id || `${event.id}-main`;

    eligibleStudents.forEach((student) => {
      const studentSchoolId = (student.studentId || '').trim();
      const studentAuthUid = (student.authUid || student.id || '').trim();

      const alreadyHas = existingRecords.some((r) => {
        const rSession = r.sessionId || `${event.id}-main`;
        const matchSession =
          rSession === sId || (!r.sessionId && sId === sessions[0]?.id);
        const matchStudent =
          (studentSchoolId &&
            r.studentId &&
            r.studentId.trim().toLowerCase() === studentSchoolId.toLowerCase()) ||
          (studentAuthUid &&
            (r as any).studentAuthUid &&
            (r as any).studentAuthUid.trim().toLowerCase() === studentAuthUid.toLowerCase()) ||
          (studentAuthUid &&
            r.studentId &&
            r.studentId.trim().toLowerCase() === studentAuthUid.toLowerCase());
        return matchSession && matchStudent;
      });

      if (!alreadyHas) {
        newRecords.push({
          studentId: studentSchoolId || studentAuthUid,
          name: `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student',
          org: event.hostingOrgName || event.hostingOrgId || event.org || 'Organization',
          eventId: event.id,
          event: event.title || event.name || 'Event',
          sessionId: sId,
          checkIn: '—',
          checkOut: '—',
          status: 'Absent',
        });
      }
    });
  });

  if (newRecords.length === 0) return 0;

  // Batch write new absent attendance records in chunks of 450
  const CHUNK_SIZE = 450;
  for (let i = 0; i < newRecords.length; i += CHUNK_SIZE) {
    const chunk = newRecords.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((rec) => {
      const docRef = doc(collection(db, ATTENDANCE_COLLECTION));
      batch.set(docRef, {
        ...rec,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return newRecords.length;
}
