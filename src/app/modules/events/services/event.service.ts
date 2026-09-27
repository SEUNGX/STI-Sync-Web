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
import type {
  EventDocument,
  EventFormData,
  EventProposalHistoryLog,
  EventCancellationPayload,
  EventCancellationResult,
} from '../types/event.types';
import { canCancelEvent } from '../utils/event-lifecycle.utils';
import { STUDENTS_COLLECTION } from '../../students/services/student.service';
import { deductApprovedEventBudget } from '../../finance/services/finance.service';
import { PAYABLES_COLLECTION } from '../../finance/services/payable.service';
import { LIQUIDATIONS_COLLECTION } from '../../finance/services/liquidation.service';
import { logAuditEvent } from '../../audit/services/audit.service';

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

    // Fetch courses for ID / Code / Name lookup
    let coursesList: any[] = [];
    try {
      const coursesSnap = await getDocs(collection(db, 'courses'));
      coursesList = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('[generatePayablesForEvent] Error fetching courses:', e);
    }

    // If org members only, fetch active members of hosting org
    const memberStudentIds = new Set<string>();
    if (eventData.targetAudienceScope === 'members' && eventData.hostingOrgId) {
      try {
        const orgMembersSnap = await getDocs(
          query(
            collection(db, 'organization_members'),
            where('organizationId', '==', eventData.hostingOrgId),
            where('status', '==', 'active')
          )
        );
        orgMembersSnap.docs.forEach((d) => {
          const m = d.data();
          if (m.studentId) memberStudentIds.add(String(m.studentId).trim());
          if (m.studentSchoolId) memberStudentIds.add(String(m.studentSchoolId).trim());
          if (m.authUid) memberStudentIds.add(String(m.authUid).trim());
        });
      } catch (e) {
        console.warn('[generatePayablesForEvent] Error fetching org members:', e);
      }
    }

    const targetYearLevels = eventData.targetYearLevels || [];
    const targetCourses = eventData.targetCourses || eventData.allowedCourses || [];
    const targetSections = eventData.targetSections || [];
    const targetDeptIds = eventData.targetDepartmentIds || [];

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

        // 1. Only ACTIVE students
        const isActive =
          !student.archived &&
          (student.status === 'ACTIVE' || (!student.status && !student.archived) || String(student.status).toUpperCase() === 'ACTIVE') &&
          student.status !== 'INACTIVE' &&
          student.status !== 'ARCHIVED' &&
          student.status !== 'RETURNED' &&
          student.status !== 'DROPPED' &&
          student.status !== 'SUSPENDED';

        if (!isActive) return false;

        // 2. Org Members constraint
        if (eventData.targetAudienceScope === 'members') {
          if (memberStudentIds.size > 0) {
            const isMember =
              memberStudentIds.has(student.id) ||
              memberStudentIds.has(student.authUid) ||
              memberStudentIds.has(student.studentId);
            if (!isMember) return false;
          }
        }

        // 3. Course Filter
        if (targetCourses.length > 0) {
          const matchesCourse =
            targetCourses.includes(student.courseId) ||
            targetCourses.includes(student.courseCode) ||
            targetCourses.some((cId: string) => {
              const c = coursesList.find((item) => item.id === cId);
              return c && (student.courseName === c.name || student.courseCode === c.code || student.courseId === c.id);
            });
          if (!matchesCourse) return false;
        }

        // 4. Year Level Filter
        if (targetYearLevels.length > 0) {
          const matchesYear = targetYearLevels.some((y: string) => {
            if (student.yearLevel === y) return true;
            if ((y === 'G11' || y === 'Grade 11') && (student.yearLevel === 'G11' || student.yearLevel === 'Grade 11' || student.yearLevel === 11 || student.yearLevel === '11')) return true;
            if ((y === 'G12' || y === 'Grade 12') && (student.yearLevel === 'G12' || student.yearLevel === 'Grade 12' || student.yearLevel === 12 || student.yearLevel === '12')) return true;
            if (y === '1st Year' && (student.yearLevel === '1st Year' || student.yearLevel === 1 || student.yearLevel === '1')) return true;
            if (y === '2nd Year' && (student.yearLevel === '2nd Year' || student.yearLevel === 2 || student.yearLevel === '2')) return true;
            if (y === '3rd Year' && (student.yearLevel === '3rd Year' || student.yearLevel === 3 || student.yearLevel === '3')) return true;
            if (y === '4th Year' && (student.yearLevel === '4th Year' || student.yearLevel === 4 || student.yearLevel === '4')) return true;
            return false;
          });
          if (!matchesYear) return false;
        }

        // 5. Section Filter
        if (targetSections.length > 0) {
          const matchesSection =
            targetSections.includes(student.section) ||
            targetSections.includes(student.id);
          if (!matchesSection) return false;
        }

        // 6. Department Filter
        if (targetDeptIds.length > 0) {
          const matchesDept = targetDeptIds.includes(student.departmentId);
          if (!matchesDept) return false;
        }

        return true;
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

const cleanUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) return obj.map(cleanUndefined).filter(v => v !== undefined);
  if (typeof obj === 'object' && typeof obj.toDate !== 'function' && !(obj instanceof Date)) {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined && val !== null) {
        const cleaned = cleanUndefined(val);
        if (cleaned !== undefined) {
          res[key] = cleaned;
        }
      }
    }
    return res;
  }
  return obj;
};

export const createEvent = async (
  data: EventFormData,
  uid: string,
  draftId?: string,
  isOfficerProposal = false,
  userName?: string
): Promise<string> => {
  const refId = data.referenceId || generateReferenceId();

  const scannerUserIds = data.scanners
    ? data.scanners
        .map((s) => s.officerUserId)
        .filter((id): id is string => id !== null && id !== undefined)
    : [];

  let isResubmission = false;
  let currentVersion = 1;
  let existingDocData: any = null;

  if (draftId) {
    const existingSnap = await getDoc(doc(db, EVENTS_COLLECTION, draftId));
    if (existingSnap.exists()) {
      existingDocData = existingSnap.data();
      const prevStatus = existingDocData?.proposalStatus;
      currentVersion = Number(existingDocData?.version || 1);
      if (prevStatus === 'rejected' || prevStatus === 'returned') {
        isResubmission = true;
      }
    }
  }

  // Version incrementing ONLY for returned/resubmitted proposals
  const newVersion = draftId && isResubmission ? currentVersion + 1 : currentVersion;
  const versionLabel = `v${newVersion}.0`;

  let actionType: EventProposalHistoryLog['action'] = 'submitted';
  let logRemarks = '';

  if (isResubmission) {
    actionType = 'resubmitted';
    logRemarks = `Revised proposal resubmitted for SAO review (${versionLabel})`;
  } else if (isOfficerProposal) {
    actionType = 'submitted';
    logRemarks = `Proposal submitted for review (${versionLabel})`;
  } else {
    actionType = 'approved';
    logRemarks = `Institutional Event created and published by SAS/SAO (${versionLabel})`;
  }

  const historyEntry: EventProposalHistoryLog = cleanUndefined({
    id: `log-${Date.now()}`,
    action: actionType,
    performedBy: uid,
    performedByName: userName || (isOfficerProposal ? 'Student Officer' : 'SAS / SAO Administrator'),
    performedAt: Timestamp.now(),
    version: newVersion,
    versionLabel,
    remarks: logRemarks,
  });

  const versionSnapshot: any = cleanUndefined({
    version: newVersion,
    versionLabel,
    savedAt: Timestamp.now(),
    savedBy: uid,
    savedByName: userName || (isOfficerProposal ? 'Student Officer' : 'SAS / SAO Administrator'),
    proposalStatus: isOfficerProposal ? 'pending_review' : 'approved',
    snapshot: buildEventSnapshot(data),
  });

  const isVisibleVal = data.isVisible !== false;
  let formattedVisibilityStart: any = null;
  if (isVisibleVal && data.visibilityStart) {
    formattedVisibilityStart = typeof data.visibilityStart === 'string'
      ? Timestamp.fromDate(new Date(data.visibilityStart))
      : data.visibilityStart;
  }

  const eventPayload: Partial<EventDocument> = cleanUndefined({
    ...data,
    isVisible: isVisibleVal,
    visibleToStudents: isVisibleVal,
    visibilityStart: formattedVisibilityStart,
    referenceId: refId,
    scannerUserIds,
    isOfficerProposal: Boolean(isOfficerProposal),
    proposalStatus: isOfficerProposal ? 'pending_review' : 'approved',
    version: newVersion,
    versionLabel,
    createdBy: uid,
    updatedAt: serverTimestamp() as any,
  });

  let docId = draftId;

  if (draftId) {
    const docRef = doc(db, EVENTS_COLLECTION, draftId);

    // If resubmitting a returned proposal, record version history & history log
    if (isResubmission) {
      await updateDoc(docRef, {
        ...eventPayload,
        proposalHistory: arrayUnion(historyEntry),
        versionHistory: arrayUnion(versionSnapshot),
      });
    } else {
      await updateDoc(docRef, {
        ...eventPayload,
        proposalHistory: arrayUnion(historyEntry),
      });
    }
  } else {
    eventPayload.createdAt = serverTimestamp() as any;
    eventPayload.proposalHistory = [historyEntry];
    if (isResubmission) {
      eventPayload.versionHistory = [versionSnapshot];
    }
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
  existingId?: string,
  userName?: string
): Promise<string> => {
  let currentVersion = 1;
  if (existingId) {
    const snap = await getDoc(doc(db, EVENTS_COLLECTION, existingId));
    if (snap.exists()) {
      currentVersion = Number(snap.data()?.version || 1);
    }
  }

  const versionLabel = `v${currentVersion}.0`;

  const isVisibleVal = data.isVisible !== false;
  let formattedVisibilityStart: any = null;
  if (isVisibleVal && data.visibilityStart) {
    formattedVisibilityStart = typeof data.visibilityStart === 'string'
      ? Timestamp.fromDate(new Date(data.visibilityStart))
      : data.visibilityStart;
  }

  const eventPayload: Partial<EventDocument> = cleanUndefined({
    ...data,
    isVisible: isVisibleVal,
    visibleToStudents: isVisibleVal,
    visibilityStart: formattedVisibilityStart,
    proposalStatus: 'draft',
    version: currentVersion,
    versionLabel,
    createdBy: uid,
    updatedAt: serverTimestamp() as any,
  });

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

  const historyEntry: EventProposalHistoryLog = cleanUndefined({
    id: `log-${Date.now()}`,
    action: 'approved',
    performedBy: adminUserId,
    performedAt: Timestamp.now(),
    remarks: remarks?.trim() || undefined,
  });

  await updateDoc(ref, {
    proposalStatus: 'approved',
    approvedBy: adminUserId,
    approvedAt: serverTimestamp(),
    adviserRemarks: remarks?.trim() || null,
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
    isVisible: data.isVisible !== false,
    visibleToStudents: data.isVisible !== false,
    visibilityStart: data.visibilityStart || null,
    description: data.description || '',
    tagline: data.tagline || '',
    eventTypeId: data.eventTypeId || '',
    eventCategoryId: data.eventCategoryId || '',
    objectives: data.objectives || [],
    bannerImageUrl: data.bannerImageUrl || '',
    hostingOrgId: data.hostingOrgId || '',
    enableQRTickets: Boolean(data.enableQRTickets === true || data.enableQR === true),
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

  const historyEntry: EventProposalHistoryLog = cleanUndefined({
    id: `log-${Date.now()}`,
    action: 'rejected',
    performedBy: adminUserId,
    performedAt: Timestamp.now(),
    reason: reason?.trim() || undefined,
    remarks: remarks?.trim() || undefined,
  });

  await updateDoc(ref, {
    proposalStatus: 'rejected',
    rejectedBy: adminUserId,
    rejectedAt: serverTimestamp(),
    rejectionReason: reason,
    adviserRemarks: remarks?.trim() || null,
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

  const historyEntry: EventProposalHistoryLog = cleanUndefined({
    id: `log-${Date.now()}`,
    action: 'returned',
    performedBy: adminUserId,
    performedAt: Timestamp.now(),
    returnFlags: flags || [],
    remarks: remarks?.trim() || undefined,
  });

  await updateDoc(ref, {
    proposalStatus: 'returned',
    returnedBy: adminUserId,
    returnedAt: serverTimestamp(),
    returnFlags: flags,
    returnDeadline: deadline || null,
    adviserRemarks: remarks?.trim() || null,
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

/**
 * Allows an officer to withdraw an event proposal that is currently in 'pending_review'
 * back to 'draft' status so that revisions can be made safely before SAO approves/rejects it.
 */
export const withdrawProposal = async (
  eventId: string,
  userId: string,
  userName?: string
): Promise<void> => {
  const ref = doc(db, EVENTS_COLLECTION, eventId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Event not found.');
  }

  const data = snap.data();
  if (data.proposalStatus !== 'pending_review' && data.proposalStatus !== 'pending') {
    throw new Error('Only proposals under review can be withdrawn.');
  }

  const historyEntry: EventProposalHistoryLog = cleanUndefined({
    id: `log-${Date.now()}`,
    action: 'edited',
    performedBy: userId,
    performedByName: userName || 'Officer',
    performedAt: Timestamp.now(),
    remarks: 'Proposal withdrawn back to draft by officer for revisions.',
  });

  await updateDoc(ref, {
    proposalStatus: 'draft',
    proposalHistory: arrayUnion(historyEntry),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Executes an atomic transactional cancellation of an event and triggers the
 * financial auto-waiver engine:
 * 1. Sets event status and proposalStatus to 'cancelled', records cancellation reason & actor.
 * 2. Invalidates scanner activation code and disables QR ticketing.
 * 3. Queries associated payables:
 *    - Unpaid records (pending, overdue, unpaid) are marked 'waived' with reason.
 *    - Paid records are flagged 'refund_pending' with refundDue calculated.
 *    - Gate pass qrTicketUnlocked is revoked across all records.
 * 4. Queries associated liquidations:
 *    - Pending/draft/returned liquidations are marked 'voided'.
 * 5. Logs the action in audit_logs.
 */
export const cancelEventTransaction = async (
  payload: EventCancellationPayload
): Promise<EventCancellationResult> => {
  const {
    eventId,
    cancelledBy,
    cancelledByName,
    cancelledByRole,
    cancellationReason,
    refundPolicy,
  } = payload;

  if (!eventId) {
    throw new Error('Event ID is required for cancellation.');
  }

  if (!cancellationReason || cancellationReason.trim().length < 10) {
    throw new Error('A detailed cancellation reason (at least 10 characters) is required.');
  }

  // 1. Validate target event
  const eventRef = doc(db, EVENTS_COLLECTION, eventId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) {
    throw new Error(`Event with ID "${eventId}" was not found.`);
  }

  const eventData = eventSnap.data() as EventDocument;

  // 2. Validate cancellation permissions
  const cancelCheck = canCancelEvent(eventData, cancelledByRole);
  if (!cancelCheck.canCancel) {
    throw new Error(cancelCheck.reason || 'This event cannot be cancelled.');
  }

  const now = Timestamp.now();
  const actorName = cancelledByName || (cancelledByRole === 'admin' ? 'SAO Admin' : 'Officer');

  // 3. Query all associated payables for this event
  const payablesCol = collection(db, PAYABLES_COLLECTION);
  const payablesQuery = query(payablesCol, where('eventId', '==', eventId));
  const payablesSnap = await getDocs(payablesQuery);

  let waivedCount = 0;
  let refundPendingCount = 0;

  // Prepare batch operations (max 450 per batch to stay safely under Firestore's 500 limit)
  type BatchOperation =
    | { type: 'update'; ref: any; data: Record<string, any> }
    | { type: 'set'; ref: any; data: Record<string, any> };

  const operations: BatchOperation[] = [];

  // Payables updates
  for (const docSnap of payablesSnap.docs) {
    const payable = docSnap.data();
    const pRef = docSnap.ref;
    const paidAmt = Number(payable.paidAmount || 0);
    const isPaid = payable.status === 'paid' || paidAmt > 0;
    const isAlreadyClosed = payable.status === 'waived' || payable.status === 'refunded';

    if (isAlreadyClosed) {
      // Ensure gate ticket is locked even if previously closed
      if (payable.qrTicketUnlocked !== false) {
        operations.push({
          type: 'update',
          ref: pRef,
          data: {
            qrTicketUnlocked: false,
            updatedAt: serverTimestamp(),
          },
        });
      }
      continue;
    }

    if (isPaid) {
      operations.push({
        type: 'update',
        ref: pRef,
        data: {
          status: 'refund_pending',
          refundDue: paidAmt > 0 ? paidAmt : Number(payable.assignedAmount || 0),
          refundReason: `Event Cancelled: ${cancellationReason}`,
          refundMethod: refundPolicy,
          qrTicketUnlocked: false,
          updatedAt: serverTimestamp(),
        },
      });
      refundPendingCount++;
    } else {
      operations.push({
        type: 'update',
        ref: pRef,
        data: {
          status: 'waived',
          waivedAt: serverTimestamp(),
          waivedReason: `Event Cancelled: ${cancellationReason}`,
          waivedBy: cancelledBy,
          waivedByName: actorName,
          qrTicketUnlocked: false,
          updatedAt: serverTimestamp(),
        },
      });
      waivedCount++;
    }
  }

  // 4. Query all associated liquidations for this event
  const liquidationsCol = collection(db, LIQUIDATIONS_COLLECTION);
  const liquidationsQuery = query(liquidationsCol, where('eventId', '==', eventId));
  const liquidationsSnap = await getDocs(liquidationsQuery);

  let voidedLiquidationsCount = 0;

  for (const docSnap of liquidationsSnap.docs) {
    const lData = docSnap.data();
    if (lData.status !== 'voided') {
      const voidRemark = cleanUndefined({
        id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        authorName: actorName,
        authorRole: cancelledByRole,
        action: 'voided',
        comment: `Liquidation voided: Parent event was cancelled (${cancellationReason}).`,
        timestamp: new Date().toISOString(),
      });

      operations.push({
        type: 'update',
        ref: docSnap.ref,
        data: {
          status: 'voided',
          voidedAt: serverTimestamp(),
          voidedBy: cancelledBy,
          voidedReason: `Parent event was cancelled: ${cancellationReason}`,
          remarksHistory: arrayUnion(voidRemark),
          updatedAt: serverTimestamp(),
        },
      });
      voidedLiquidationsCount++;
    }
  }

  // 5. Update Event Document
  const cancellationHistory: EventProposalHistoryLog = cleanUndefined({
    id: `log-${Date.now()}`,
    action: 'cancelled',
    performedBy: cancelledBy,
    performedByName: actorName,
    performedAt: now,
    remarks: `Event cancelled: ${cancellationReason}`,
  });

  const eventUpdates: Record<string, any> = {
    status: 'cancelled',
    proposalStatus: 'cancelled',
    cancellationReason: cancellationReason,
    cancelledBy: cancelledBy,
    cancelledByName: actorName,
    cancelledByRole: cancelledByRole,
    cancelledAt: serverTimestamp(),
    cancellationRefundPolicy: refundPolicy,
    refundStatus: refundPolicy === 'no_fees_collected' ? 'none' : 'pending',
    enableQRTickets: false,
    scannerActivationCode: '',
    proposalHistory: arrayUnion(cancellationHistory),
    updatedAt: serverTimestamp(),
  };

  operations.push({
    type: 'update',
    ref: eventRef,
    data: eventUpdates,
  });

  // 6. Commit operations in chunks of 450
  const CHUNK_SIZE = 450;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'update') {
        batch.update(op.ref, op.data);
      } else if (op.type === 'set') {
        batch.set(op.ref, op.data);
      }
    }
    await batch.commit();
  }

  // 7. Audit Logging
  try {
    await logAuditEvent({
      action: 'CANCEL_EVENT',
      actionType: 'DELETE',
      details: `Event "${eventData.title || eventId}" was cancelled. Reason: ${cancellationReason}. ${waivedCount} payables waived, ${refundPendingCount} flagged for refund, ${voidedLiquidationsCount} liquidations voided.`,
      performedBy: actorName,
      userRole: cancelledByRole === 'admin' ? 'SAO Admin' : 'Officer',
      targetId: eventId,
      targetName: eventData.title || 'Event',
      metadata: {
        eventId,
        cancellationReason,
        refundPolicy,
        waivedPayablesCount: waivedCount,
        refundPendingPayablesCount: refundPendingCount,
        voidedLiquidationsCount,
      },
    });
  } catch (auditErr) {
    console.warn('[cancelEventTransaction] Non-critical audit log failure:', auditErr);
  }

  return {
    eventId,
    waivedPayablesCount: waivedCount,
    refundPendingPayablesCount: refundPendingCount,
    voidedLiquidationsCount,
    qrTicketsRevoked: true,
    cancelledAt: new Date().toISOString(),
  };
};

/**
 * Restores an archived or soft-deleted event back to active lifecycle status.
 */
export async function restoreArchivedEvent(eventId: string, adminUid: string, adminName?: string): Promise<void> {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId);
  const snap = await getDoc(eventRef);
  if (!snap.exists()) {
    throw new Error('Event not found.');
  }
  const eventData = snap.data();

  await updateDoc(eventRef, {
    isArchived: false,
    isDeleted: false,
    restoredAt: serverTimestamp(),
    restoredBy: adminUid,
    updatedAt: serverTimestamp(),
  });

  try {
    await logAuditEvent({
      action: 'RESTORE_EVENT',
      actionType: 'UPDATE',
      details: `Archived event "${eventData.title || eventId}" was restored to active records by ${adminName || 'Admin'}.`,
      performedBy: adminName || 'SAO Admin',
      userRole: 'SAO Admin',
      targetId: eventId,
      targetName: eventData.title || 'Event',
    });
  } catch (auditErr) {
    console.warn('[restoreArchivedEvent] Audit log failed:', auditErr);
  }
}

/**
 * Permanently purges an event from the archive and cleans up associated sub-records.
 */
export async function purgeEventPermanently(eventId: string, adminUid: string, adminName?: string): Promise<void> {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId);
  const snap = await getDoc(eventRef);
  const title = snap.exists() ? snap.data().title : eventId;

  // Clean up payables if any dangling
  const payablesSnap = await getDocs(query(collection(db, PAYABLES_COLLECTION), where('eventId', '==', eventId)));
  const batch = writeBatch(db);
  payablesSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(eventRef);
  await batch.commit();

  try {
    await logAuditEvent({
      action: 'PERMANENT_PURGE_EVENT',
      actionType: 'DELETE',
      details: `Event "${title}" was permanently purged from the archive by ${adminName || 'Admin'}.`,
      performedBy: adminName || 'SAO Admin',
      userRole: 'SAO Admin',
      targetId: eventId,
      targetName: title,
    });
  } catch (auditErr) {
    console.warn('[purgeEventPermanently] Audit log failed:', auditErr);
  }
}


