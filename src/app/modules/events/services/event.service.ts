import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';

import { db } from '../../../../services/firebase';
import type { EventDocument, EventFormData, EventProposalHistoryLog } from '../types/event.types';
import { STUDENTS_COLLECTION } from '../../students/services/student.service';
import { deductApprovedEventBudget } from '../../finance/services/finance.service';

export const EVENTS_COLLECTION = 'events';

export const generateReferenceId = (): string => {
  const year = new Date().getFullYear();
  const sequence = Math.floor(1000 + Math.random() * 9000);
  return `EVT-ADM-${year}-${sequence}`;
};

export const generateScannerCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Helper to generate student payables documents when an event with fees is approved/created
 */
export async function generatePayablesForEvent(
  eventData: any,
  eventId: string,
  createdByUid: string
): Promise<void> {
  const feeAmount =
    Number(eventData.adminFeeOverride) ||
    Number(eventData.suggestedFeePerStudent) ||
    Number(eventData.feeAmount) ||
    Number(eventData.fee) ||
    0;

  if (!eventData.studentPayablesEnabled && feeAmount <= 0) {
    console.log('[generatePayablesForEvent] Skipping: payables not enabled or fee is 0', {
      studentPayablesEnabled: eventData.studentPayablesEnabled,
      feeAmount,
    });
    return;
  }

  const assignedFee = feeAmount > 0 ? feeAmount : (Number(eventData.adminFeeOverride) || 0);

  try {
    // Query existing payables for this event to deduplicate per student
    const existingQ = query(collection(db, 'payables'), where('eventId', '==', eventId));
    const existingSnap = await getDocs(existingQ);
    const existingStudentIds = new Set<string>();
    existingSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.studentId) existingStudentIds.add(data.studentId);
      if (data.studentSchoolId) existingStudentIds.add(data.studentSchoolId);
    });

    const q = query(collection(db, STUDENTS_COLLECTION));
    const snapshot = await getDocs(q);

    const targetYearLevels = eventData.targetYearLevels || [];
    const targetCourses = eventData.targetCourses || eventData.allowedCourses || [];
    const targetSections = eventData.targetSections || [];
    const targetDeptIds = eventData.targetDepartmentIds || [];
    const isAllStudents =
      eventData.targetAudienceScope === 'all' ||
      eventData.targetAudience === 'all' ||
      (!eventData.targetAudienceScope &&
        targetYearLevels.length === 0 &&
        targetCourses.length === 0 &&
        targetSections.length === 0 &&
        targetDeptIds.length === 0);

    const studentsToCharge = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((student: any) => {
        const studentIdentifier = student.id || student.authUid || student.studentId;
        const officialSchoolId = student.studentId || student.schoolId || '';

        // Skip if already charged
        if (
          existingStudentIds.has(studentIdentifier) ||
          (officialSchoolId && existingStudentIds.has(officialSchoolId))
        ) {
          return false;
        }

        // Accept students whose status is ACTIVE, active, or not explicitly INACTIVE/SUSPENDED/ARCHIVED
        if (
          student.status &&
          ['INACTIVE', 'SUSPENDED', 'ARCHIVED', 'RETURNED'].includes(
            String(student.status).toUpperCase()
          )
        ) {
          return false;
        }
        if (isAllStudents) return true;

        const matchesCourse =
          targetCourses.length === 0 ||
          targetCourses.includes(student.courseId) ||
          targetCourses.includes(student.courseCode);
        const matchesSection =
          targetSections.length === 0 ||
          targetSections.includes(student.section) ||
          targetSections.includes(student.id);
        const matchesDept =
          targetDeptIds.length === 0 || targetDeptIds.includes(student.departmentId);
        const matchesYear =
          targetYearLevels.length === 0 || targetYearLevels.includes(student.yearLevel);

        return matchesCourse && matchesSection && matchesDept && matchesYear;
      });

    console.log(
      '[generatePayablesForEvent] Charging students count:',
      studentsToCharge.length,
      'for event:',
      eventId
    );

    if (studentsToCharge.length > 0) {
      const chunks = [];
      for (let i = 0; i < studentsToCharge.length; i += 500) {
        chunks.push(studentsToCharge.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const student of chunk) {
          const payableRef = doc(collection(db, 'payables'));
          const studentFullName =
            `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
            student.name ||
            student.studentName ||
            'Student';
          const officialSchoolId =
            student.studentId || student.schoolId || student.studentNumber || '';

          batch.set(payableRef, {
            id: payableRef.id,
            studentId: student.id || student.authUid || student.studentId,
            studentName: studentFullName,
            studentSchoolId: officialSchoolId,
            type: 'event_fee',
            label: `Event Fee — ${eventData.title}`,
            description: `Fee for event: ${eventData.title}`,
            organizationId: eventData.hostingOrgId || null,
            organizationName: null,
            semesterId: eventData.semesterId || '',
            eventId: eventId,
            assignedAmount: assignedFee,
            paidAmount: 0,
            status: 'pending',
            qrTicketUnlocked: false,
            dueDate:
              eventData.sessions && eventData.sessions[0]?.date
                ? Timestamp.fromDate(new Date(eventData.sessions[0].date))
                : null,
            paidAt: null,
            recordedBy: null,
            paymentMethod: null,
            createdBy: createdByUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
    }
  } catch (err) {
    console.error('[generatePayablesForEvent] Error generating payables:', err);
  }
}

export const createEvent = async (
  data: EventFormData,
  uid: string,
  draftId?: string,
  isOfficerProposal = false
): Promise<string> => {
  const refId = data.referenceId || generateReferenceId();

  const scannerUserIds = data.scanners
    ? data.scanners
        .map((s) => s.officerUserId)
        .filter((id): id is string => id !== null && id !== undefined)
    : [];

  let isResubmission = false;
  if (draftId) {
    const existingSnap = await getDoc(doc(db, EVENTS_COLLECTION, draftId));
    if (existingSnap.exists()) {
      const prevStatus = existingSnap.data()?.proposalStatus;
      if (prevStatus === 'rejected' || prevStatus === 'returned') {
        isResubmission = true;
      }
    }
  }

  const actionType: EventProposalHistoryLog['action'] = isResubmission
    ? 'resubmitted'
    : isOfficerProposal
    ? 'submitted'
    : 'approved';

  const historyEntry: EventProposalHistoryLog = {
    id: `log-${Date.now()}`,
    action: actionType,
    performedBy: uid,
    performedAt: Timestamp.now(),
  };

  const eventPayload: Partial<EventDocument> = {
    ...data,
    referenceId: refId,
    scannerUserIds,
    isOfficerProposal: Boolean(isOfficerProposal),
    proposalStatus: isOfficerProposal ? 'pending' : 'approved',
    createdBy: uid,
    updatedAt: serverTimestamp() as any,
  };

  let docId = draftId;

  if (draftId) {
    const docRef = doc(db, EVENTS_COLLECTION, draftId);
    await updateDoc(docRef, {
      ...eventPayload,
      proposalHistory: arrayUnion(historyEntry),
    });
  } else {
    eventPayload.createdAt = serverTimestamp() as any;
    eventPayload.proposalHistory = [historyEntry];
    const docRef = await addDoc(collection(db, EVENTS_COLLECTION), eventPayload);
    docId = docRef.id;
  }

  // Handle payables creation and budget deduction if event is auto-approved
  if (eventPayload.proposalStatus === 'approved') {
    await generatePayablesForEvent(eventPayload, docId!, uid);
    try {
      await deductApprovedEventBudget(eventPayload, docId!, uid);
    } catch (err) {
      console.warn('[createEvent] Budget deduction error:', err);
    }
  }

  return docId!;
};

export const saveEventDraft = async (
  data: EventFormData,
  uid: string,
  existingId?: string
): Promise<string> => {
  const eventPayload: Partial<EventDocument> = {
    ...data,
    proposalStatus: 'draft',
    createdBy: uid,
    updatedAt: serverTimestamp() as any,
  };

  if (data.scanners) {
    eventPayload.scannerUserIds = data.scanners
      .map((s) => s.officerUserId)
      .filter((id): id is string => id !== null && id !== undefined);
  }

  if (!eventPayload.referenceId) {
    eventPayload.referenceId = generateReferenceId();
  }

  if (existingId) {
    const docRef = doc(db, EVENTS_COLLECTION, existingId);
    await updateDoc(docRef, eventPayload);
    return existingId;
  } else {
    eventPayload.createdAt = serverTimestamp() as any;
    const docRef = await addDoc(collection(db, EVENTS_COLLECTION), eventPayload);
    return docRef.id;
  }
};

export const approveEvent = async (
  eventId: string,
  adminUserId: string,
  remarks: string
): Promise<void> => {
  const ref = doc(db, EVENTS_COLLECTION, eventId);
  const snap = await getDoc(ref);
  const eventData = snap.exists() ? snap.data() : null;

  const historyEntry: EventProposalHistoryLog = {
    id: `log-${Date.now()}`,
    action: 'approved',
    performedBy: adminUserId,
    performedAt: Timestamp.now(),
    remarks: remarks || undefined,
  };

  await updateDoc(ref, {
    proposalStatus: 'approved',
    approvedBy: adminUserId,
    approvedAt: serverTimestamp(),
    adviserRemarks: remarks || null,
    proposalHistory: arrayUnion(historyEntry),
    updatedAt: serverTimestamp(),
  });

  if (eventData) {
    await generatePayablesForEvent(
      { ...eventData, proposalStatus: 'approved' },
      eventId,
      adminUserId
    );
    try {
      await deductApprovedEventBudget(
        { ...eventData, proposalStatus: 'approved' },
        eventId,
        adminUserId
      );
    } catch (err) {
      console.warn('[approveEvent] Budget deduction error:', err);
    }
  }
};

const buildEventSnapshot = (data: any) => {
  if (!data) return {};
  return {
    title: data.title || '',
    description: data.description || '',
    tagline: data.tagline || '',
    eventTypeId: data.eventTypeId || '',
    eventCategoryId: data.eventCategoryId || '',
    objectives: data.objectives || [],
    bannerImageUrl: data.bannerImageUrl || '',
    hostingOrgId: data.hostingOrgId || '',
    enableQRTickets: data.enableQRTickets !== false && data.enableQR !== false,
    semesterId: data.semesterId || '',
    schoolYear: data.schoolYear || '',
    venueId: data.venueId || '',
    customVenueName: data.customVenueName || null,
    eventFormat: data.eventFormat || '',
    gracePeriodMinutes: data.gracePeriodMinutes ?? null,
    lateThresholdMinutes: data.lateThresholdMinutes ?? null,
    sessions: data.sessions || [],
    targetAudienceScope: data.targetAudienceScope || 'all',
    targetCourses: data.targetCourses || data.allowedCourses || [],
    targetYearLevels: data.targetYearLevels || [],
    targetSections: data.targetSections || [],
    targetDepartmentIds: data.targetDepartmentIds || [],
    attendanceEnabled: data.attendanceEnabled !== false,
    certificatesEnabled: data.certificatesEnabled !== false,
    expectedParticipantCount: data.expectedParticipantCount || 0,
    scope: data.scope || '',
    maxAttendees: data.maxAttendees || 0,
    registrationDeadline: data.registrationDeadline || '',
    requiresRegistration: data.requiresRegistration !== false,
    allowedCourses: data.allowedCourses || data.targetCourses || [],
    allowedYearLevels: data.allowedYearLevels || data.targetYearLevels || [],
    eventHeadUid: data.eventHeadUid || '',
    officerInChargeUid: data.officerInChargeUid || '',
    scanners: data.scanners || [],
    scannerUserIds: data.scannerUserIds || [],
    sourceOfFunds: data.sourceOfFunds || '',
    totalRequestedBudget: data.totalRequestedBudget || 0,
    totalApprovedBudget: data.totalApprovedBudget || 0,
    studentPayablesEnabled: Boolean(data.studentPayablesEnabled),
    adminFeeOverride: data.adminFeeOverride || 0,
    budgetItems: data.budgetItems || [],
    documents: data.documents || [],
    attachedDocumentUrls: data.attachedDocumentUrls || [],
    documentIds: data.documentIds || [],
  };
};

export const rejectEvent = async (
  eventId: string,
  adminUserId: string,
  reason: string,
  remarks: string,
  allowResubmission: boolean = true
): Promise<void> => {
  const ref = doc(db, EVENTS_COLLECTION, eventId);
  const snap = await getDoc(ref);
  const currentData = snap.exists() ? snap.data() : null;
  const returnedSnapshot = buildEventSnapshot(currentData);

  const historyEntry: EventProposalHistoryLog = {
    id: `log-${Date.now()}`,
    action: 'rejected',
    performedBy: adminUserId,
    performedAt: Timestamp.now(),
    reason: reason || undefined,
    remarks: remarks || undefined,
  };

  await updateDoc(ref, {
    proposalStatus: 'rejected',
    rejectedBy: adminUserId,
    rejectedAt: serverTimestamp(),
    rejectionReason: reason,
    adviserRemarks: remarks || null,
    allowResubmission,
    returnedSnapshot,
    proposalHistory: arrayUnion(historyEntry),
    updatedAt: serverTimestamp(),
  });
};

export const returnEvent = async (
  eventId: string,
  adminUserId: string,
  flags: string[],
  deadline: string,
  remarks: string
): Promise<void> => {
  const ref = doc(db, EVENTS_COLLECTION, eventId);
  const snap = await getDoc(ref);
  const currentData = snap.exists() ? snap.data() : null;
  const returnedSnapshot = buildEventSnapshot(currentData);

  const historyEntry: EventProposalHistoryLog = {
    id: `log-${Date.now()}`,
    action: 'returned',
    performedBy: adminUserId,
    performedAt: Timestamp.now(),
    returnFlags: flags || [],
    remarks: remarks || undefined,
  };

  await updateDoc(ref, {
    proposalStatus: 'returned',
    returnedBy: adminUserId,
    returnedAt: serverTimestamp(),
    returnFlags: flags,
    returnDeadline: deadline || null,
    adviserRemarks: remarks || null,
    returnedSnapshot,
    proposalHistory: arrayUnion(historyEntry),
    updatedAt: serverTimestamp(),
  });
};

export const updateAdviserRemarks = async (
  eventId: string,
  remarks: string
): Promise<void> => {
  const ref = doc(db, EVENTS_COLLECTION, eventId);
  await updateDoc(ref, {
    adviserRemarks: remarks || null,
    updatedAt: serverTimestamp(),
  });
};

export const deleteEvent = async (eventId: string): Promise<void> => {
  const ref = doc(db, EVENTS_COLLECTION, eventId);
  await deleteDoc(ref);
};

