import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { addLedgerTransaction, addOrgLedgerTransaction } from './finance.service';
import type {
  PayableDocument,
  PayableType,
  CreatePayablePayload,
  GenerateDuesPayload,
  PayableStatus,
  GenerateEventFinesPayload,
  SessionFineRule,
  FineViolationDetail,
} from '../types/payable.types';

export const PAYABLES_COLLECTION = 'payables';

/**
 * Generate membership dues for org members.
 * Deduplicates automatically by checking existing membership_due payables.
 */
export async function generateMembershipDues(payload: GenerateDuesPayload): Promise<number> {
  const {
    organizationId,
    organizationName,
    semesterId,
    membershipFee,
    memberIds,
    dueDate,
    createdBy,
  } = payload;

  // 1. Fetch target members from organization_members
  const membersRef = collection(db, 'organization_members');
  const qMembers = query(
    membersRef,
    where('organizationId', '==', organizationId),
    where('status', '==', 'active')
  );
  const snapshot = await getDocs(qMembers);

  // Load students map for resolving Auth UID and 11-digit School ID
  const studentsLookup = new Map<string, any>();
  try {
    const studentsRef = collection(db, 'students');
    const studentsSnap = await getDocs(studentsRef);
    studentsSnap.docs.forEach((d) => {
      const sData = { id: d.id, ...d.data() };
      if (sData.studentId) studentsLookup.set(String(sData.studentId).trim().toLowerCase(), sData);
      if (sData.authUid) studentsLookup.set(String(sData.authUid).trim().toLowerCase(), sData);
      if (d.id) studentsLookup.set(d.id.trim().toLowerCase(), sData);
    });
  } catch (e) {
    console.warn('[generateMembershipDues] Could not pre-fetch students for ID resolution:', e);
  }

  const membersToProcess: Array<{ studentId: string; studentName: string; studentSchoolId: string }> = [];

  snapshot.docs.forEach((d) => {
    const data = d.data();
    const rawStudentId = (data.studentId || d.id || '').toString().trim();
    if (memberIds === 'all' || memberIds.includes(rawStudentId) || memberIds.includes(d.id)) {
      const matched =
        studentsLookup.get(rawStudentId.toLowerCase()) ||
        (data.studentSchoolId ? studentsLookup.get(String(data.studentSchoolId).trim().toLowerCase()) : undefined);
      const authUid = matched?.authUid || matched?.id || data.authUid || data.studentAuthUid || rawStudentId;
      const schoolId = matched?.studentId || data.studentSchoolId || data.studentId || rawStudentId;
      const fullName = data.studentName || (matched ? `${matched.firstName} ${matched.lastName}` : 'Student');

      membersToProcess.push({
        studentId: authUid,
        studentName: fullName,
        studentSchoolId: schoolId,
      });
    }
  });

  if (membersToProcess.length === 0) return 0;

  // 2. Query existing membership_due payables for this org + semester to deduplicate
  const payablesRef = collection(db, PAYABLES_COLLECTION);
  const qExisting = query(
    payablesRef,
    where('organizationId', '==', organizationId),
    where('semesterId', '==', semesterId),
    where('type', '==', 'membership_due')
  );
  const existingSnapshot = await getDocs(qExisting);
  const existingStudentIds = new Set<string>();
  existingSnapshot.docs.forEach((d) => {
    const dData = d.data();
    if (dData.studentId) existingStudentIds.add(String(dData.studentId).trim().toLowerCase());
    if (dData.studentSchoolId) existingStudentIds.add(String(dData.studentSchoolId).trim().toLowerCase());
  });

  // Filter out already generated members
  const newMembers = membersToProcess.filter(
    (m) =>
      !existingStudentIds.has(m.studentId.toLowerCase()) &&
      !existingStudentIds.has(m.studentSchoolId.toLowerCase())
  );

  if (newMembers.length === 0) return 0;

  // 3. Batch write new payables in chunks of 500
  const chunks = [];
  for (let i = 0; i < newMembers.length; i += 500) {
    chunks.push(newMembers.slice(i, i + 500));
  }

  let createdCount = 0;
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const member of chunk) {
      const newRef = doc(payablesRef);
      batch.set(newRef, {
        id: newRef.id,
        studentId: member.studentId,
        studentName: member.studentName,
        studentSchoolId: member.studentSchoolId,
        type: 'membership_due',
        label: `Membership Due (${organizationName})`,
        description: `Semester membership fee for ${organizationName}`,
        organizationId,
        organizationName,
        semesterId,
        eventId: null,
        assignedAmount: membershipFee,
        paidAmount: 0,
        status: 'pending',
        dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
        paidAt: null,
        recordedBy: null,
        paymentMethod: null,
        transferredToBudget: false,
        transferredAt: null,
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      createdCount++;
    }
    await batch.commit();
  }

  return createdCount;
}

/**
 * Create a single payable doc (fine, custom fee, event fee)
 */
export async function createPayable(payload: CreatePayablePayload): Promise<string> {
  const payablesRef = collection(db, PAYABLES_COLLECTION);
  const newDocRef = doc(payablesRef);

  let formattedDueDate: Timestamp | null = null;
  if (payload.dueDate) {
    if (payload.dueDate instanceof Timestamp) {
      formattedDueDate = payload.dueDate;
    } else {
      formattedDueDate = Timestamp.fromDate(payload.dueDate);
    }
  }

  const payableAmount = Number(payload.assignedAmount ?? payload.amount ?? 0);
  const payableTitle = (payload.title || payload.label || payload.feeTitle || 'Payable Fee').trim();

  await setDoc(newDocRef, {
    id: newDocRef.id,
    studentId: payload.studentId,
    studentName: payload.studentName,
    studentSchoolId: payload.studentSchoolId,
    type: payload.type,
    label: payableTitle,
    title: payableTitle,
    feeTitle: payableTitle,
    category: payload.category || (payload.type === 'admin_fine' || payload.type === 'org_fine' ? 'Fine' : 'Institutional Assessment'),
    description: payload.description || '',
    organizationId: payload.organizationId || null,
    organizationName: payload.organizationName || (payload.organizationId ? null : 'SAO Administration'),
    semesterId: payload.semesterId,
    semester: payload.semester || '',
    schoolYear: payload.schoolYear || '',
    eventId: payload.eventId || null,
    amount: payableAmount,
    assignedAmount: payableAmount,
    paidAmount: 0,
    status: 'pending' as PayableStatus,
    paymentStatus: 'UNPAID',
    qrTicketUnlocked: false,
    dueDate: formattedDueDate,
    courseCode: payload.courseCode || '',
    courseName: payload.courseName || '',
    departmentId: payload.departmentId || '',
    departmentName: payload.departmentName || '',
    yearLevel: payload.yearLevel || '',
    section: payload.section || '',
    academicLevel: payload.academicLevel || 'COLLEGE',
    paidAt: null,
    recordedBy: null,
    paymentMethod: null,
    transferredToBudget: false,
    transferredAt: null,
    createdBy: payload.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return newDocRef.id;
}

/**
 * Record a full or partial payment for a payable
 */
export async function recordPayment(
  payableId: string,
  paymentAmount: number,
  recordedBy: string,
  paymentMethod: string = 'cash',
  unlockQRTicket?: boolean,
  receiptNumber?: string,
  notes?: string
): Promise<void> {
  const payableRef = doc(db, PAYABLES_COLLECTION, payableId);
  const snap = await getDoc(payableRef);

  if (!snap.exists()) {
    throw new Error('Payable document not found');
  }

  const data = snap.data() as PayableDocument;
  const currentPaid = Number(data.paidAmount) || 0;
  const assigned = Number(data.assignedAmount) || 0;

  // GUARD: Reject if already fully paid
  if (data.status === 'paid' || (assigned > 0 && currentPaid >= assigned)) {
    throw new Error('This payable is already fully paid.');
  }

  // Calculate remaining balance to prevent double payments
  const remaining = assigned > 0 ? Math.max(0, assigned - currentPaid) : paymentAmount;
  const actualPayment = Math.min(paymentAmount, remaining);
  if (actualPayment <= 0) {
    throw new Error('This payable has no remaining balance to pay.');
  }

  const newPaidAmount = currentPaid + actualPayment;
  const transferredAmt = typeof data.transferredAmount === 'number' ? data.transferredAmount : 0;
  const isFullyTransferred = transferredAmt >= newPaidAmount && newPaidAmount > 0;

  let newStatus: PayableStatus = 'partial';
  let paidAtTimestamp: Timestamp | null = data.paidAt || null;

  if (newPaidAmount >= assigned) {
    newStatus = 'paid';
    paidAtTimestamp = Timestamp.now();
  } else if (newPaidAmount > 0) {
    newStatus = 'partial';
    if (!paidAtTimestamp) paidAtTimestamp = Timestamp.now();
  }

  const updates: Record<string, any> = {
    paidAmount: newPaidAmount,
    status: newStatus,
    paidAt: paidAtTimestamp,
    recordedBy,
    paymentMethod,
    transferredToBudget: isFullyTransferred,
    updatedAt: serverTimestamp(),
  };

  if (receiptNumber) updates.receiptNumber = receiptNumber;
  if (notes) updates.notes = notes;

  // Option A (Strict): Automatically unlock only when 100% fully paid, or if explicit boolean passed
  if (typeof unlockQRTicket === 'boolean') {
    updates.qrTicketUnlocked = unlockQRTicket;
  } else if (newStatus === 'paid') {
    updates.qrTicketUnlocked = true;
  }

  await updateDoc(payableRef, updates);
}

/**
 * Explicitly toggle QR Ticket Unlock status (unlocked vs locked)
 */
export async function toggleQRTicketUnlock(payableId: string, unlocked: boolean): Promise<void> {
  const payableRef = doc(db, PAYABLES_COLLECTION, payableId);
  await updateDoc(payableRef, {
    qrTicketUnlocked: unlocked,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Waive a payable
 */
export async function waivePayable(payableId: string, waivedBy: string): Promise<void> {
  const payableRef = doc(db, PAYABLES_COLLECTION, payableId);
  await updateDoc(payableRef, {
    status: 'waived' as PayableStatus,
    recordedBy: waivedBy,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Bulk record full payment for multiple payables
 */
export async function bulkRecordPayment(payableIds: string[], recordedBy: string): Promise<void> {
  if (payableIds.length === 0) return;

  const chunks = [];
  for (let i = 0; i < payableIds.length; i += 500) {
    chunks.push(payableIds.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const id of chunk) {
      const ref = doc(db, PAYABLES_COLLECTION, id);
      batch.update(ref, {
        status: 'paid' as PayableStatus,
        paidAt: serverTimestamp(),
        recordedBy,
        paymentMethod: 'cash',
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

/**
 * Delete a payable (only allowed if paidAmount is 0)
 */
export async function deletePayable(payableId: string): Promise<void> {
  const payableRef = doc(db, PAYABLES_COLLECTION, payableId);
  const snap = await getDoc(payableRef);

  if (snap.exists() && (snap.data().paidAmount || 0) > 0) {
    throw new Error('Cannot delete a payable that has recorded payments');
  }

  await deleteDoc(payableRef);
}

/**
 * Update payable due date
 */
export async function updatePayableDueDate(payableId: string, newDueDate: Date | null): Promise<void> {
  const payableRef = doc(db, PAYABLES_COLLECTION, payableId);
  await updateDoc(payableRef, {
    dueDate: newDueDate ? Timestamp.fromDate(newDueDate) : null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Bulk mark all event fee payables for an event as transferred to the SAO school budget
 */
export async function markEventPayablesTransferred(eventId: string): Promise<void> {
  const payablesRef = collection(db, PAYABLES_COLLECTION);
  const q = query(
    payablesRef,
    where('eventId', '==', eventId)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  const chunks = [];
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += 500) {
    chunks.push(docs.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const d of chunk) {
      batch.update(d.ref, {
        transferredToBudget: true,
        transferredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

/**
 * Automatically evaluate attendance records for an event and record fines (Absent, Late, Missed Scan)
 * based on event settings and rules configured by officers/admins.
 */
export async function recordEventFinePayables(
  eventId: string,
  createdBy: string,
  isOfficer: boolean = true
): Promise<{ created: number; skipped: number }> {
  const eventRef = doc(db, 'events', eventId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) {
    throw new Error('Event not found');
  }
  const eventData = eventSnap.data();
  const fineAmount = Number(eventData.latePenaltyAmount) || 50;

  const attendanceRef = collection(db, 'attendance');
  const qAttendance = query(attendanceRef, where('eventId', '==', eventId));
  const attendanceSnap = await getDocs(qAttendance);

  let attendanceDocs = attendanceSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (attendanceDocs.length === 0 && eventData.title) {
    const qByTitle = query(attendanceRef, where('event', '==', eventData.title));
    const titleSnap = await getDocs(qByTitle);
    attendanceDocs = titleSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  if (attendanceDocs.length === 0) {
    return { created: 0, skipped: 0 };
  }

  const payablesRef = collection(db, PAYABLES_COLLECTION);
  const qPayables = query(
    payablesRef,
    where('eventId', '==', eventId),
    where('type', 'in', ['org_fine', 'admin_fine'])
  );
  const existingPayablesSnap = await getDocs(qPayables);

  const existingFineKeys = new Set<string>();
  existingPayablesSnap.docs.forEach((d) => {
    const data = d.data();
    const studentId = (data.studentId || '').toString().trim();
    const label = (data.label || '').toString().toLowerCase();
    let category = 'absent';
    if (label.includes('late')) category = 'late';
    else if (label.includes('missed scan') || label.includes('flagged')) category = 'missed_scan';
    existingFineKeys.add(`${studentId}_${category}`);
  });

  const isSasAdminEvent =
    eventData.hostingOrgId === 'sas_admin' ||
    eventData.hostingOrgId === 'sas' ||
    eventData.hostingOrgId === 'sao_admin' ||
    eventData.hostingOrgId === 'sao' ||
    eventData.isOfficerProposal === false ||
    !isOfficer;

  const payableType: PayableType = isSasAdminEvent ? 'admin_fine' : 'org_fine';
  const orgId = isSasAdminEvent ? null : (eventData.hostingOrgId || null);
  const orgName = isSasAdminEvent ? 'Student Affairs and Services (SAS)' : (eventData.hostingOrgName || eventData.org || null);
  const semesterId = eventData.semesterId || 'current';

  let createdCount = 0;
  let skippedCount = 0;

  // Load students map for robust resolution between Auth UID and 11-digit Student ID
  const studentsLookup = new Map<string, any>();
  try {
    const studentsRef = collection(db, 'students');
    const studentsSnap = await getDocs(studentsRef);
    studentsSnap.docs.forEach((d) => {
      const sData = { id: d.id, ...d.data() };
      if (sData.studentId) studentsLookup.set(String(sData.studentId).trim().toLowerCase(), sData);
      if (sData.authUid) studentsLookup.set(String(sData.authUid).trim().toLowerCase(), sData);
      if (d.id) studentsLookup.set(d.id.trim().toLowerCase(), sData);
    });
  } catch (e) {
    console.warn('[recordEventFinePayables] Could not pre-fetch students for ID resolution:', e);
  }

  const newPayablesToCreate: CreatePayablePayload[] = [];

  for (const rec of attendanceDocs) {
    const rawStudentId = (rec.studentId || '').toString().trim();
    const rawSchoolId = ((rec as any).studentSchoolId || '').toString().trim();
    const status = (rec.status || '').toString();

    const matched =
      studentsLookup.get(rawStudentId.toLowerCase()) ||
      (rawSchoolId ? studentsLookup.get(rawSchoolId.toLowerCase()) : undefined);

    const authUid = matched?.authUid || matched?.id || (rec as any).studentAuthUid || rawStudentId;
    const schoolId = matched?.studentId || rawSchoolId || rawStudentId;
    const studentName = rec.name || (matched ? `${matched.firstName} ${matched.lastName}` : 'Student');

    let violationCategory: 'absent' | 'late' | 'missed_scan' | null = null;
    let label = '';
    let description = '';

    if (status === 'Absent') {
      violationCategory = 'absent';
      label = `Absent Fine — ${eventData.title}`;
      description = `Automatic fine for unexcused absence at ${eventData.title}`;
    } else if (status === 'Late') {
      violationCategory = 'late';
      label = `Late Arrival Fine — ${eventData.title}`;
      description = `Automatic fine for late check-in at ${eventData.title}`;
    } else if (status === 'Flagged' || (rec.checkIn && !rec.checkOut && eventData.sessions?.[0]?.hasTimeOut)) {
      violationCategory = 'missed_scan';
      label = `Missed Scan Fine — ${eventData.title}`;
      description = `Automatic fine for incomplete scan-in / scan-out at ${eventData.title}`;
    }

    if (!violationCategory || (!authUid && !schoolId)) continue;

    const fineKey = `${authUid}_${violationCategory}`;
    const fineSchoolKey = `${schoolId}_${violationCategory}`;
    if (existingFineKeys.has(fineKey) || existingFineKeys.has(fineSchoolKey)) {
      skippedCount++;
      continue;
    }

    existingFineKeys.add(fineKey);
    existingFineKeys.add(fineSchoolKey);
    newPayablesToCreate.push({
      studentId: authUid,
      studentName,
      studentSchoolId: schoolId,
      type: payableType,
      label,
      description,
      organizationId: orgId,
      organizationName: orgName,
      semesterId,
      eventId,
      assignedAmount: fineAmount,
      createdBy,
    });
  }

  if (newPayablesToCreate.length === 0) {
    return { created: 0, skipped: skippedCount };
  }

  const chunks = [];
  for (let i = 0; i < newPayablesToCreate.length; i += 500) {
    chunks.push(newPayablesToCreate.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const payload of chunk) {
      const newDocRef = doc(payablesRef);
      batch.set(newDocRef, {
        id: newDocRef.id,
        studentId: payload.studentId,
        studentName: payload.studentName,
        studentSchoolId: payload.studentSchoolId,
        type: payload.type,
        label: payload.label,
        description: payload.description || '',
        organizationId: payload.organizationId || null,
        organizationName: payload.organizationName || null,
        semesterId: payload.semesterId,
        eventId: payload.eventId || null,
        assignedAmount: payload.assignedAmount,
        paidAmount: 0,
        status: 'pending' as PayableStatus,
        dueDate: null,
        paidAt: null,
        recordedBy: null,
        paymentMethod: null,
        createdBy: payload.createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      createdCount++;
    }
    await batch.commit();
  }

  return { created: createdCount, skipped: skippedCount };
}

/**
 * Dynamically evaluate event attendance per session against custom fine rules
 * and batch-create/update fine payables.
 */
export async function generateDynamicEventFines(
  payload: GenerateEventFinesPayload
): Promise<{ created: number; updated: number; skipped: number; totalAmount: number }> {
  const {
    eventId,
    eventTitle,
    semesterId,
    rules,
    createdBy,
    isOfficer,
    hostingOrgId,
    hostingOrgName,
    dueDate,
    studentViolations,
    rawAttendanceRecords,
  } = payload;

  const parsedDueDate = dueDate
    ? dueDate instanceof Timestamp
      ? dueDate
      : Timestamp.fromDate(new Date(dueDate))
    : null;

  const eventRef = doc(db, 'events', eventId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) {
    throw new Error('Event not found');
  }
  const eventData = eventSnap.data();

  // 1. Determine if Admin / SAS event vs Club Event
  const isSasAdminEvent =
    !isOfficer ||
    eventData.hostingOrgId === 'sas_admin' ||
    eventData.hostingOrgId === 'sas' ||
    eventData.hostingOrgId === 'sao_admin' ||
    eventData.hostingOrgId === 'sao' ||
    eventData.isOfficerProposal === false;

  const payableType: PayableType = isSasAdminEvent ? 'admin_fine' : 'org_fine';
  const orgId = isSasAdminEvent ? null : (hostingOrgId || eventData.hostingOrgId || null);
  const orgName = isSasAdminEvent
    ? 'Student Affairs and Services (SAS)'
    : (hostingOrgName || eventData.hostingOrgName || eventData.org || null);

  // 2. Query existing fine payables for this event
  const payablesRef = collection(db, PAYABLES_COLLECTION);
  const qExisting = query(
    payablesRef,
    where('eventId', '==', eventId),
    where('type', '==', payableType)
  );
  const existingSnap = await getDocs(qExisting);
  const existingPayablesByStudent = new Map<string, { id: string; status: string; paidAmount: number }>();
  existingSnap.docs.forEach((d) => {
    const data = d.data();
    const sId = (data.studentId || '').toString().trim().toLowerCase();
    const schoolId = (data.studentSchoolId || '').toString().trim().toLowerCase();
    const val = {
      id: d.id,
      status: data.status,
      paidAmount: data.paidAmount || 0,
    };
    if (sId) existingPayablesByStudent.set(sId, val);
    if (schoolId) existingPayablesByStudent.set(schoolId, val);
  });

  // 3. Load students map for robust resolution between Auth UID and 11-digit Student ID
  const studentsLookup = new Map<string, any>();
  try {
    const studentsRef = collection(db, 'students');
    const studentsSnap = await getDocs(studentsRef);
    studentsSnap.docs.forEach((d) => {
      const sData = { id: d.id, ...d.data() };
      if (sData.studentId) studentsLookup.set(String(sData.studentId).trim().toLowerCase(), sData);
      if (sData.authUid) studentsLookup.set(String(sData.authUid).trim().toLowerCase(), sData);
      if (d.id) studentsLookup.set(d.id.trim().toLowerCase(), sData);
    });
  } catch (e) {
    console.warn('[generateDynamicEventFines] Could not pre-fetch students for ID resolution:', e);
  }

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let totalAssessedAmount = 0;

  const writeOps: Array<{
    type: 'create' | 'update';
    docId?: string;
    data: any;
  }> = [];

  // Case A: Precalculated student violations passed directly from the modal preview
  if (studentViolations && studentViolations.length > 0) {
    studentViolations.forEach((student) => {
      if (!student.violations || student.violations.length === 0 || student.totalFine <= 0) return;

      const rawStudentId = (student.studentId || '').toString().trim();
      const rawSchoolId = (student.studentSchoolId || '').toString().trim();
      if (!rawStudentId && !rawSchoolId) return;

      const matched =
        studentsLookup.get(rawStudentId.toLowerCase()) ||
        (rawSchoolId ? studentsLookup.get(rawSchoolId.toLowerCase()) : undefined);

      // studentId must be Auth UID (or Firestore student doc id) so Mobile App query (where('studentId', '==', authUid)) matches
      const authUid = matched?.authUid || matched?.id || student.studentAuthUid || rawStudentId;
      const schoolId = matched?.studentId || rawSchoolId || rawStudentId;
      const fullName = student.studentName || (matched ? `${matched.firstName} ${matched.lastName}` : 'Student');

      const existing = existingPayablesByStudent.get(authUid.toLowerCase()) || existingPayablesByStudent.get(schoolId.toLowerCase());
      if (existing && (existing.status === 'paid' || existing.status === 'waived' || existing.paidAmount > 0)) {
        skippedCount++;
        return;
      }

      const violationDescriptions = student.violations
        .map((v) => `${v.description} (₱${v.amount})`)
        .join(', ');

      if (existing) {
        writeOps.push({
          type: 'update',
          docId: existing.id,
          data: {
            assignedAmount: student.totalFine,
            description: `Event Violations: ${violationDescriptions}`,
            fineViolations: student.violations,
            updatedAt: serverTimestamp(),
          },
        });
        updatedCount++;
        totalAssessedAmount += student.totalFine;
      } else {
        writeOps.push({
          type: 'create',
          data: {
            studentId: authUid,
            studentSchoolId: schoolId,
            studentName: fullName,
            type: payableType,
            label: isSasAdminEvent ? `Event Fine — ${eventTitle}` : `Club Fine — ${eventTitle}`,
            description: `Event Violations: ${violationDescriptions}`,
            organizationId: orgId,
            organizationName: orgName,
            semesterId: semesterId || eventData.semesterId || 'active',
            eventId,
            assignedAmount: student.totalFine,
            paidAmount: 0,
            status: 'pending' as PayableStatus,
            dueDate: parsedDueDate,
            paidAt: null,
            recordedBy: null,
            paymentMethod: null,
            transferredToBudget: false,
            transferredAt: null,
            fineViolations: student.violations,
            createdBy,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
        createdCount++;
        totalAssessedAmount += student.totalFine;
      }
    });
  } else {
    // Case B: Evaluate against raw attendance records or query attendance from Firestore
    let attendanceDocs = rawAttendanceRecords || [];
    if (attendanceDocs.length === 0) {
      const attendanceRef = collection(db, 'attendance');
      const qAttendance = query(attendanceRef, where('eventId', '==', eventId));
      const attendanceSnap = await getDocs(qAttendance);
      attendanceDocs = attendanceSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (attendanceDocs.length === 0 && eventTitle) {
        const qByTitle = query(attendanceRef, where('event', '==', eventTitle));
        const titleSnap = await getDocs(qByTitle);
        attendanceDocs = titleSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
    }

    if (attendanceDocs.length === 0) {
      return { created: 0, updated: 0, skipped: 0, totalAmount: 0 };
    }

    const studentMap = new Map<string, {
      studentId: string;
      studentName: string;
      studentSchoolId: string;
      sessionRecords: Map<string, any>;
    }>();

    attendanceDocs.forEach((rec: any) => {
      const sId = (rec.studentId || '').toString().trim();
      if (!sId) return;

      if (!studentMap.has(sId)) {
        studentMap.set(sId, {
          studentId: sId,
          studentName: rec.name || 'Student',
          studentSchoolId: sId,
          sessionRecords: new Map(),
        });
      }

      const entry = studentMap.get(sId)!;
      const sessId = rec.sessionId || 'main';
      entry.sessionRecords.set(sessId, rec);
      if (!entry.sessionRecords.has('all')) {
        entry.sessionRecords.set('all', rec);
      }
    });

    studentMap.forEach((student) => {
      const violations: FineViolationDetail[] = [];
      let studentTotalFine = 0;

      rules.forEach((rule) => {
        const rec = student.sessionRecords.get(rule.sessionId) || student.sessionRecords.get('all');
        if (!rec) return;

        const status = (rec.status || '').toString();

        if (rule.enableTimeInAbsent && rule.timeInAbsentAmount > 0 && status === 'Absent') {
          violations.push({
            sessionId: rule.sessionId,
            sessionTitle: rule.sessionTitle,
            violationType: 'time_in_absent',
            amount: rule.timeInAbsentAmount,
            description: `${rule.sessionTitle}: Time-In Absent`,
          });
          studentTotalFine += rule.timeInAbsentAmount;
        }

        if (rule.enableTimeInLate && rule.timeInLateAmount > 0 && status === 'Late') {
          violations.push({
            sessionId: rule.sessionId,
            sessionTitle: rule.sessionTitle,
            violationType: 'time_in_late',
            amount: rule.timeInLateAmount,
            description: `${rule.sessionTitle}: Time-In Late`,
          });
          studentTotalFine += rule.timeInLateAmount;
        }

        if (
          rule.enableTimeOutAbsent &&
          rule.timeOutAbsentAmount > 0 &&
          (status === 'Flagged' || (rec.checkIn && (!rec.checkOut || rec.checkOut === '—')))
        ) {
          violations.push({
            sessionId: rule.sessionId,
            sessionTitle: rule.sessionTitle,
            violationType: 'time_out_absent',
            amount: rule.timeOutAbsentAmount,
            description: `${rule.sessionTitle}: Time-Out Missed / Absent`,
          });
          studentTotalFine += rule.timeOutAbsentAmount;
        }
      });

      if (violations.length === 0 || studentTotalFine <= 0) return;

      const rawStudentId = (student.studentId || '').toString().trim();
      const rawSchoolId = (student.studentSchoolId || '').toString().trim();

      const matched =
        studentsLookup.get(rawStudentId.toLowerCase()) ||
        (rawSchoolId ? studentsLookup.get(rawSchoolId.toLowerCase()) : undefined);

      const authUid = matched?.authUid || matched?.id || rawStudentId;
      const schoolId = matched?.studentId || rawSchoolId || rawStudentId;
      const fullName = student.studentName || (matched ? `${matched.firstName} ${matched.lastName}` : 'Student');

      const existing = existingPayablesByStudent.get(authUid.toLowerCase()) || existingPayablesByStudent.get(schoolId.toLowerCase());
      if (existing && (existing.status === 'paid' || existing.status === 'waived' || existing.paidAmount > 0)) {
        skippedCount++;
        return;
      }

      const violationDescriptions = violations.map((v) => `${v.description} (₱${v.amount})`).join(', ');

      if (existing) {
        writeOps.push({
          type: 'update',
          docId: existing.id,
          data: {
            assignedAmount: studentTotalFine,
            description: `Event Violations: ${violationDescriptions}`,
            fineViolations: violations,
            updatedAt: serverTimestamp(),
          },
        });
        updatedCount++;
        totalAssessedAmount += studentTotalFine;
      } else {
        writeOps.push({
          type: 'create',
          data: {
            studentId: authUid,
            studentSchoolId: schoolId,
            studentName: fullName,
            type: payableType,
            label: isSasAdminEvent ? `Event Fine — ${eventTitle}` : `Club Fine — ${eventTitle}`,
            description: `Event Violations: ${violationDescriptions}`,
            organizationId: orgId,
            organizationName: orgName,
            semesterId: semesterId || eventData.semesterId || 'active',
            eventId,
            assignedAmount: studentTotalFine,
            paidAmount: 0,
            status: 'pending' as PayableStatus,
            dueDate: parsedDueDate,
            paidAt: null,
            recordedBy: null,
            paymentMethod: null,
            transferredToBudget: false,
            transferredAt: null,
            fineViolations: violations,
            createdBy,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
        createdCount++;
        totalAssessedAmount += studentTotalFine;
      }
    });
  }

  // Commit batch
  if (writeOps.length > 0) {
    const chunks = [];
    for (let i = 0; i < writeOps.length; i += 500) {
      chunks.push(writeOps.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const op of chunk) {
        if (op.type === 'create') {
          const newDocRef = doc(payablesRef);
          batch.set(newDocRef, { ...op.data, id: newDocRef.id });
        } else if (op.type === 'update' && op.docId) {
          const docRef = doc(payablesRef, op.docId);
          batch.update(docRef, op.data);
        }
      }
      await batch.commit();
    }

    // Update event doc
    try {
      await updateDoc(eventRef, {
        finesAssessed: true,
        finesAssessedAt: serverTimestamp(),
        finesAssessedBy: createdBy,
        finesRuleMatrix: rules,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('[generateDynamicEventFines] Could not update event doc fines status:', e);
    }
  }

  return {
    created: createdCount,
    updated: updatedCount,
    skipped: skippedCount,
    totalAmount: totalAssessedAmount,
  };
}

/**
 * Transfer all collected event fines directly into designated target ledger:
 * - Admin/Institutional Event -> /sao_ledger (Institutional Balance)
 * - Officer/Organization Event -> /organization_ledger (Club Balance)
 */
export async function transferEventFinesToBudget(
  eventId: string,
  eventTitle: string,
  isOfficer: boolean,
  orgId?: string | null,
  semesterId?: string
): Promise<{ transferredCount: number; totalAmount: number }> {
  const targetType = isOfficer ? 'org_fine' : 'admin_fine';
  const targetLedger = isOfficer ? 'org' : 'sao';

  const res = await transferCollectionGroupToLedger({
    collectionGroupId: eventId,
    eventId,
    type: targetType,
    organizationId: orgId,
    targetLedger,
    semesterId,
    recordedByUid: isOfficer ? 'Officer' : 'Admin SAO',
    collectionName: `Event Fines — ${eventTitle}`,
  });

  return {
    transferredCount: res.transferredCount,
    totalAmount: res.transferredAmount,
  };
}

/**
 * Dynamically synchronizes missing event payables and membership dues for a student.
 * Useful when a student registers late, is approved to ACTIVE status, or joins a club/department.
 */
export async function syncStudentPayablesForActiveEvents(
  student: {
    id: string;
    studentId?: string;
    schoolId?: string;
    authUid?: string;
    firstName?: string;
    lastName?: string;
    studentName?: string;
    departmentId?: string;
    courseId?: string;
    courseCode?: string;
    courseName?: string;
    academicLevel?: string;
    section?: string;
    yearLevel?: string;
    schoolYear?: string;
    semester?: string;
  },
  createdBy: string = 'system_sync'
): Promise<number> {
  const studentDocId = student.id || student.authUid || student.studentId;
  if (!studentDocId) return 0;

  const officialSchoolId = student.studentId || student.schoolId || '';
  const fullName =
    student.studentName ||
    `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
    'Student';
  const studentDeptId = student.departmentId || '';
  const studentCourseId = student.courseId || '';
  const studentCourseCode = student.courseCode || '';
  const studentSection = (student.section || '').trim().toLowerCase();
  const studentYear = student.yearLevel || '';
  const studentSemester = student.semester || '';
  const studentAcademicLevel = student.academicLevel || '';

  let createdCount = 0;

  try {
    // 1. Fetch approved events
    const eventsRef = collection(db, 'events');
    const qEvents = query(eventsRef, where('proposalStatus', '==', 'approved'));
    const eventsSnap = await getDocs(qEvents);

    const eligibleEvents = eventsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((event: any) => {
        const feeAmount =
          Number(event.adminFeeOverride) ||
          Number(event.suggestedFeePerStudent) ||
          Number(event.feeAmount) ||
          Number(event.fee) ||
          0;
        if (!event.studentPayablesEnabled && feeAmount <= 0) return false;

        // Semester filter (if event is tied to a specific semester/school year)
        if (event.schoolYear && student.schoolYear && event.schoolYear !== student.schoolYear) {
          return false;
        }
        if (event.semester && studentSemester && event.semester !== studentSemester) {
          return false;
        }

        const targetDeptIds = event.targetDepartmentIds || [];
        const targetYearLevels = event.targetYearLevels || [];
        const targetCourseIds = event.targetCourseIds || event.targetCourses || [];
        const targetSections = (event.targetSections || event.targetSectionNames || []).map((s: string) => String(s).trim().toLowerCase());

        const isAllStudents =
          event.targetAudience === 'all' ||
          !event.targetAudience ||
          (targetDeptIds.length === 0 && targetYearLevels.length === 0 && targetCourseIds.length === 0 && targetSections.length === 0);

        if (isAllStudents) return true;

        const matchesDept =
          targetDeptIds.length === 0 ||
          (studentDeptId && targetDeptIds.includes(studentDeptId));
        
        const matchesCourse =
          targetCourseIds.length === 0 ||
          (studentCourseId && targetCourseIds.includes(studentCourseId)) ||
          (studentCourseCode && targetCourseIds.includes(studentCourseCode));

        const matchesYear =
          targetYearLevels.length === 0 ||
          (studentYear && targetYearLevels.includes(studentYear));

        const matchesSection =
          targetSections.length === 0 ||
          (studentSection && targetSections.includes(studentSection));

        return matchesDept && matchesCourse && matchesYear && matchesSection;
      });

    // 2. Query existing payables for this student to deduplicate
    const payablesRef = collection(db, PAYABLES_COLLECTION);
    const qStudentPayables = query(
      payablesRef,
      where('studentId', 'in', [studentDocId, officialSchoolId].filter(Boolean))
    );
    const studentPayablesSnap = await getDocs(qStudentPayables);

    const existingEventIds = new Set<string>();
    const existingMembershipOrgIds = new Set<string>();

    studentPayablesSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.eventId) existingEventIds.add(data.eventId);
      if (data.type === 'membership_due' && data.organizationId) {
        existingMembershipOrgIds.add(data.organizationId);
      }
    });

    const newPayablesToCreate: any[] = [];

    for (const evt of eligibleEvents) {
      if (existingEventIds.has(evt.id)) continue;

      const fee =
        Number(evt.adminFeeOverride) ||
        Number(evt.suggestedFeePerStudent) ||
        Number(evt.feeAmount) ||
        Number(evt.fee) ||
        0;

      if (fee <= 0) continue;

      newPayablesToCreate.push({
        studentId: studentDocId,
        studentName: fullName,
        studentSchoolId: officialSchoolId,
        type: 'event_fee',
        label: `Event Fee — ${evt.title || 'Event'}`,
        description: `Fee for event: ${evt.title || ''}`,
        organizationId:
          evt.hostingOrgId &&
          evt.hostingOrgId !== 'sas_admin' &&
          evt.hostingOrgId !== 'sas' &&
          evt.hostingOrgId !== 'sao_admin' &&
          evt.hostingOrgId !== 'sao'
            ? evt.hostingOrgId
            : null,
        organizationName:
          evt.hostingOrgId === 'sas' || evt.hostingOrgId === 'sas_admin'
            ? 'Student Affairs and Services (SAS)'
            : (evt.hostingOrgName || evt.org || null),
        semesterId: evt.semesterId || '',
        eventId: evt.id,
        assignedAmount: fee,
        paidAmount: 0,
        status: 'pending',
        qrTicketUnlocked: false,
        dueDate:
          evt.sessions && evt.sessions[0]?.date
            ? Timestamp.fromDate(new Date(evt.sessions[0].date))
            : null,
        paidAt: null,
        recordedBy: null,
        paymentMethod: null,
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      existingEventIds.add(evt.id);
    }

    // 3. Check active club memberships in organization_members
    const membersRef = collection(db, 'organization_members');
    const memberIdentifiers = [studentDocId, officialSchoolId].filter(Boolean);
    for (const ident of memberIdentifiers) {
      const qMemberships = query(
        membersRef,
        where('studentId', '==', ident),
        where('status', '==', 'active')
      );
      const membersSnap = await getDocs(qMemberships);

      for (const mDoc of membersSnap.docs) {
        const mData = mDoc.data();
        const orgId = mData.organizationId;
        if (!orgId || existingMembershipOrgIds.has(orgId)) continue;

        newPayablesToCreate.push({
          studentId: studentDocId,
          studentName: fullName,
          studentSchoolId: officialSchoolId,
          type: 'membership_due',
          label: `Membership Due (${mData.organizationName || 'Club'})`,
          description: `Semester membership fee for ${mData.organizationName || 'Organization'}`,
          organizationId: orgId,
          organizationName: mData.organizationName || null,
          semesterId: mData.semesterId || 'active',
          eventId: null,
          assignedAmount: Number(mData.membershipFee) || 50,
          paidAmount: 0,
          status: 'pending',
          qrTicketUnlocked: false,
          dueDate: null,
          paidAt: null,
          recordedBy: null,
          paymentMethod: null,
          createdBy,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        existingMembershipOrgIds.add(orgId);
      }
    }

    // 4. Batch commit in chunks of 500
    if (newPayablesToCreate.length > 0) {
      const chunks = [];
      for (let i = 0; i < newPayablesToCreate.length; i += 500) {
        chunks.push(newPayablesToCreate.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const p of chunk) {
          const newRef = doc(payablesRef);
          batch.set(newRef, { ...p, id: newRef.id });
          createdCount++;
        }
        await batch.commit();
      }
    }
  } catch (err) {
    console.error('[syncStudentPayablesForActiveEvents] Error syncing payables:', err);
  }

  return createdCount;
}

/**
 * Centralized transfer function: Transfers all collected payments in a collection group to the designated ledger.
 * - If targetLedger === 'sao' -> credits /sao_ledger
 * - If targetLedger === 'org' -> credits /organization_ledger
 * 
 * Atomically marks payables as transferredToBudget: true, transferredAt: serverTimestamp(), transferredBatchId: batchId.
 * Guarantees zero ghost money: only strictly sums paidAmount of records with paidAmount > 0 and status === 'paid'.
 */
export async function transferCollectionGroupToLedger(params: {
  collectionGroupId: string;
  eventId?: string | null;
  type?: PayableType;
  organizationId?: string | null;
  targetLedger: 'sao' | 'org';
  semesterId?: string | null;
  recordedByUid?: string;
  collectionName?: string;
  payableIds?: string[];
}): Promise<{ transferredCount: number; transferredAmount: number }> {
  const {
    collectionGroupId,
    eventId,
    type,
    organizationId,
    targetLedger,
    semesterId,
    recordedByUid,
    collectionName,
    payableIds,
  } = params;

  const payablesRef = collection(db, PAYABLES_COLLECTION);
  let eligibleDocs: any[] = [];

  if (payableIds && payableIds.length > 0) {
    // Fetch directly by document IDs for precision
    const fetchedDocs = await Promise.all(
      payableIds.map((id) => getDoc(doc(payablesRef, id)))
    );
    eligibleDocs = fetchedDocs
      .filter((d) => d.exists())
      .filter((d) => {
        const data = d.data()!;
        const isPaidStatus = String(data.status || '').toLowerCase() === 'paid';
        const hasPaid = (Number(data.paidAmount) || 0) > 0;
        const assignedAmt = Number(data.assignedAmount) || 0;
        const effectivePaid = hasPaid ? Number(data.paidAmount) : (isPaidStatus ? assignedAmt : 0);
        const alreadyTransferred = typeof data.transferredAmount === 'number'
          ? Math.max(0, data.transferredAmount)
          : (data.transferredToBudget ? effectivePaid : 0);
        const untransferredDelta = Math.max(0, effectivePaid - alreadyTransferred);
        return untransferredDelta > 0;
      }) as any;
  } else {
    let qDocs;
    if (eventId && eventId !== 'unassigned') {
      if (type) {
        qDocs = query(
          payablesRef,
          where('eventId', '==', eventId),
          where('type', '==', type)
        );
      } else {
        qDocs = query(payablesRef, where('eventId', '==', eventId));
      }
    } else if (organizationId && type === 'membership_due') {
      qDocs = query(
        payablesRef,
        where('organizationId', '==', organizationId),
        where('type', '==', 'membership_due')
      );
    } else if (organizationId) {
      qDocs = query(payablesRef, where('organizationId', '==', organizationId));
    } else if (type) {
      qDocs = query(payablesRef, where('type', '==', type));
    } else {
      qDocs = query(payablesRef, where('type', 'in', ['admin_fine', 'event_fee', 'custom']));
    }

    const snap = await getDocs(qDocs);
    eligibleDocs = snap.docs.filter((d) => {
      const data = d.data();
      const isPaidStatus = String(data.status || '').toLowerCase() === 'paid';
      const hasPaid = (Number(data.paidAmount) || 0) > 0;
      const assignedAmt = Number(data.assignedAmount) || 0;
      const effectivePaid = hasPaid ? Number(data.paidAmount) : (isPaidStatus ? assignedAmt : 0);
      const alreadyTransferred = typeof data.transferredAmount === 'number'
        ? Math.max(0, data.transferredAmount)
        : (data.transferredToBudget ? effectivePaid : 0);
      const untransferredDelta = Math.max(0, effectivePaid - alreadyTransferred);
      return untransferredDelta > 0;
    });
  }

  // Fallback: If no docs matched query, check if collectionGroupId is a direct payable document ID
  if (eligibleDocs.length === 0 && collectionGroupId && collectionGroupId !== 'unassigned') {
    try {
      const singleDocRef = doc(payablesRef, collectionGroupId);
      const singleSnap = await getDoc(singleDocRef);
      if (singleSnap.exists()) {
        const sData = singleSnap.data();
        const isPaidStatus = String(sData.status || '').toLowerCase() === 'paid';
        const hasPaid = (Number(sData.paidAmount) || 0) > 0;
        const assignedAmt = Number(sData.assignedAmount) || 0;
        const effectivePaid = hasPaid ? Number(sData.paidAmount) : (isPaidStatus ? assignedAmt : 0);
        const alreadyTransferred = typeof sData.transferredAmount === 'number'
          ? Math.max(0, sData.transferredAmount)
          : (sData.transferredToBudget ? effectivePaid : 0);
        const untransferredDelta = Math.max(0, effectivePaid - alreadyTransferred);
        if (untransferredDelta > 0) {
          eligibleDocs = [singleSnap as any];
        }
      }
    } catch (e) {
      console.warn('[transferCollectionGroupToLedger] singleDoc lookup error:', e);
    }
  }

  if (eligibleDocs.length === 0) {
    return { transferredCount: 0, transferredAmount: 0 };
  }

  const totalTransferDelta = eligibleDocs.reduce((sum, d) => {
    const data = d.data();
    const isPaidStatus = String(data.status || '').toLowerCase() === 'paid';
    const hasPaid = (Number(data.paidAmount) || 0) > 0;
    const assignedAmt = Number(data.assignedAmount) || 0;
    const effectivePaid = hasPaid ? Number(data.paidAmount) : (isPaidStatus ? assignedAmt : 0);
    const alreadyTransferred = typeof data.transferredAmount === 'number'
      ? Math.max(0, data.transferredAmount)
      : (data.transferredToBudget ? effectivePaid : 0);
    const untransferredDelta = Math.max(0, effectivePaid - alreadyTransferred);
    return sum + untransferredDelta;
  }, 0);

  const batchId = `TRANS-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // Batch commit in chunks of 500
  const chunks = [];
  for (let i = 0; i < eligibleDocs.length; i += 500) {
    chunks.push(eligibleDocs.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const docSnap of chunk) {
      const dData = docSnap.data();
      const isPaidStatus = String(dData.status || '').toLowerCase() === 'paid';
      const hasPaid = (Number(dData.paidAmount) || 0) > 0;
      const assignedAmt = Number(dData.assignedAmount) || 0;
      const effectivePaid = hasPaid ? Number(dData.paidAmount) : (isPaidStatus ? assignedAmt : 0);

      batch.update(docSnap.ref, {
        paidAmount: effectivePaid,
        transferredAmount: effectivePaid,
        transferredToBudget: true,
        transferredAt: serverTimestamp(),
        transferredBatchId: batchId,
        status: 'paid',
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  // Insert ledger income entry
  const displayTitle = collectionName || (eventId ? `Event Collection (${eventId})` : 'Student Collection');
  if (targetLedger === 'org' && organizationId) {
    await addDoc(collection(db, 'organization_ledger'), {
      organizationId,
      semesterId: semesterId || null,
      date: Timestamp.now(),
      description: `Student Collections – ${displayTitle}`,
      eventId: eventId && eventId !== 'unassigned' ? eventId : null,
      type: 'income' as const,
      source: 'student_collection' as const,
      amount: totalTransferDelta,
      addedBy: recordedByUid || 'Officer',
      collectionId: batchId,
      createdAt: serverTimestamp(),
    });
  } else {
    await addDoc(collection(db, 'sao_ledger'), {
      semesterId: semesterId || null,
      date: Timestamp.now(),
      description: `Student Collections – ${displayTitle}`,
      eventId: eventId && eventId !== 'unassigned' ? eventId : null,
      type: 'income' as const,
      source: 'student_collection' as const,
      amount: totalTransferDelta,
      addedBy: recordedByUid || 'Admin SAO',
      collectionId: batchId,
      createdAt: serverTimestamp(),
    });
  }

  return {
    transferredCount: eligibleDocs.length,
    transferredAmount: totalTransferDelta,
  };
}
