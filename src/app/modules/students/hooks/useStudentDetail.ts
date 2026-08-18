import { useState, useEffect } from 'react';
import { doc, collection, collectionGroup, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { StudentDocument } from '../types/student.types';
import type { OrganizationMemberDocument } from '../../organizations/types/member.types';
import type { OrganizationDocument } from '../../organizations/types/organization.types';
import type { PayableDocument } from '../../finance/types/payable.types';
import type { AttendanceRecord } from '../../attendance/types/attendance.types';
import { formatAppTime } from '../../../utils/date';

export interface EnrichedClubMembership {
  id: string;
  organizationId: string;
  clubName: string;
  clubAcronym: string;
  logoUrl: string | null;
  role: 'Officer' | 'Member';
  isOfficer: boolean;
  status: string;
  paymentStatus: 'paid' | 'outstanding';
  dateJoined: any;
}

export interface StudentDetailState {
  student: StudentDocument | null;
  memberships: EnrichedClubMembership[];
  payables: PayableDocument[];
  attendances: AttendanceRecord[];
  stats: {
    totalBilled: number;
    totalPaid: number;
    outstandingBalance: number;
    paymentStatus: 'Paid' | 'Outstanding' | 'None';
    eventsAttended: number;
    totalEvents: number;
    attendanceRate: number;
  };
  loading: boolean;
  error: Error | null;
}

export function useStudentDetail(studentDocOrId: StudentDocument | string | null): StudentDetailState {
  const [student, setStudent] = useState<StudentDocument | null>(
    typeof studentDocOrId === 'object' ? studentDocOrId : null
  );
  const [allRawMemberships, setAllRawMemberships] = useState<OrganizationMemberDocument[]>([]);
  const [allOrgs, setAllOrgs] = useState<OrganizationDocument[]>([]);
  const [payables, setPayables] = useState<PayableDocument[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const studentId = typeof studentDocOrId === 'string' ? studentDocOrId : studentDocOrId?.id;
  const schoolId = student?.studentId || (typeof studentDocOrId === 'object' ? studentDocOrId?.studentId : '');
  const email = student?.email?.trim().toLowerCase() || (typeof studentDocOrId === 'object' ? studentDocOrId?.email?.trim().toLowerCase() : '');
  const studentFullName = student ? `${student.firstName} ${student.lastName}`.trim().toLowerCase() : '';

  useEffect(() => {
    if (!studentId && !schoolId) {
      setStudent(null);
      setAllRawMemberships([]);
      setPayables([]);
      setAttendances([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubs: Array<() => void> = [];

    // 1. Subscribe to student document if ID provided
    if (typeof studentDocOrId === 'string' || !student) {
      const studentDocRef = doc(db, 'students', studentId || schoolId);
      const unsubStudent = onSnapshot(
        studentDocRef,
        (snap) => {
          if (snap.exists()) {
            setStudent({ id: snap.id, ...snap.data() } as StudentDocument);
          }
        },
        (err) => {
          console.warn('Error streaming student document:', err);
        }
      );
      unsubs.push(unsubStudent);
    } else {
      setStudent(studentDocOrId);
    }

    // 2. Subscribe to All Organizations to resolve club names, acronyms, and logos
    const unsubOrgs = onSnapshot(
      collection(db, 'organizations'),
      (snap) => {
        const orgDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrganizationDocument));
        setAllOrgs(orgDocs);
      },
      (err) => console.warn('Error streaming organizations:', err)
    );
    unsubs.push(unsubOrgs);

    // 3. Subscribe to Organization Memberships (get all memberships and filter in memory by id, schoolId, or email)
    const unsubMembers = onSnapshot(
      collection(db, 'organization_members'),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrganizationMemberDocument));
        setAllRawMemberships(docs);
      },
      (err) => console.warn('Error streaming organization members:', err)
    );
    unsubs.push(unsubMembers);

    // 4. Subscribe to Payables (listen to all payables and filter by id / schoolId)
    const unsubPayables = onSnapshot(
      collection(db, 'payables'),
      (snap) => {
        const allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PayableDocument));
        const matched = allDocs.filter((p) => {
          const matchId = studentId && p.studentId === studentId;
          const matchSchoolId = schoolId && (p.studentSchoolId === schoolId || p.studentId === schoolId);
          return matchId || matchSchoolId;
        });
        setPayables(matched);
      },
      (err) => console.warn('Error streaming student payables:', err)
    );
    unsubs.push(unsubPayables);

    // 5. Subscribe to Attendance Records across collection group 'attendance' and top-level 'attendance'
    const formatTime = (timestamp: any): string => {
      return formatAppTime(timestamp, '—');
    };

    const unsubAttendance = onSnapshot(
      collectionGroup(db, 'attendance'),
      (snap) => {
        const matchedAttendances: AttendanceRecord[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          const dStudentId = (data.studentId || data.studentNumber || '').trim();
          const dName = (data.studentName || data.name || '').trim().toLowerCase();

          const isMatch =
            (schoolId && dStudentId === schoolId) ||
            (studentId && dStudentId === studentId) ||
            (studentFullName && dName === studentFullName);

          if (isMatch) {
            const scanTimeStr = formatTime(data.scannedAt || data.createdAt);
            const checkInTime = data.gateType === 'time_in' ? scanTimeStr : (data.checkIn || '—');
            const checkOutTime = data.gateType === 'time_out' ? scanTimeStr : (data.checkOut || '—');
            const mappedStatus = data.status === 'Present' ? 'Checked In' : (data.status || 'Checked In');

            matchedAttendances.push({
              id: d.id,
              studentId: dStudentId || schoolId || studentId || '',
              name: data.studentName || data.name || studentFullName || 'Student',
              org: data.organizationName || data.organizationId || data.org || 'SAO Event',
              eventId: data.eventId || '',
              event: data.eventName || data.event || 'Campus Event',
              checkIn: checkInTime,
              checkOut: checkOutTime,
              status: mappedStatus,
              createdAt: data.createdAt || data.serverTimestamp,
              flaggedReason: data.flagNote || data.flaggedReason,
            });
          }
        });

        // Sort attendance newest first
        matchedAttendances.sort((a, b) => {
          const aTime = a.createdAt?.seconds ?? 0;
          const bTime = b.createdAt?.seconds ?? 0;
          return bTime - aTime;
        });

        setAttendances(matchedAttendances);
        setLoading(false);
      },
      (err) => {
        console.warn('Error streaming attendance logs:', err);
        setLoading(false);
      }
    );
    unsubs.push(unsubAttendance);

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [studentId, schoolId, email, studentFullName]);

  // Build Enriched Club Memberships
  const orgMap = new Map<string, OrganizationDocument>();
  allOrgs.forEach((o) => orgMap.set(o.id, o));

  const memberships: EnrichedClubMembership[] = allRawMemberships
    .filter((m) => {
      const matchId = studentId && m.studentId === studentId;
      const matchSchoolId = schoolId && (m.studentId === schoolId || (m as any).studentSchoolId === schoolId);
      const matchEmail = email && m.email?.trim().toLowerCase() === email;
      const matchName = studentFullName && m.studentName?.trim().toLowerCase() === studentFullName;
      return matchId || matchSchoolId || matchEmail || matchName;
    })
    .map((m) => {
      const org = orgMap.get(m.organizationId);
      const clubName = org?.name || m.department || 'Student Club';
      const clubAcronym = org?.acronym || (m.department?.length <= 6 ? m.department : '');
      const logoUrl = org?.logoUrl || null;

      return {
        id: m.id,
        organizationId: m.organizationId,
        clubName,
        clubAcronym,
        logoUrl,
        role: m.isOfficer ? 'Officer' : 'Member',
        isOfficer: Boolean(m.isOfficer),
        status: m.status || 'active',
        paymentStatus: m.paymentStatus || 'paid',
        dateJoined: m.dateJoined || m.createdAt,
      };
    });

  // Compute aggregated stats
  const totalBilled = payables.reduce((sum, p) => sum + (Number(p.assignedAmount) || 0), 0);
  const totalPaid = payables.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
  const outstandingBalance = Math.max(0, totalBilled - totalPaid);

  let paymentStatus: 'Paid' | 'Outstanding' | 'None' = 'None';
  if (payables.length > 0) {
    paymentStatus = outstandingBalance <= 0 ? 'Paid' : 'Outstanding';
  }

  const eventsAttended = attendances.filter(
    (a) => a.status === 'Complete' || a.status === 'Checked In' || a.status === 'Late'
  ).length;
  const totalEvents = attendances.length;
  const attendanceRate = totalEvents > 0 ? Math.round((eventsAttended / totalEvents) * 100) : 100;

  return {
    student,
    memberships,
    payables,
    attendances,
    stats: {
      totalBilled,
      totalPaid,
      outstandingBalance,
      paymentStatus,
      eventsAttended,
      totalEvents,
      attendanceRate,
    },
    loading,
    error,
  };
}
