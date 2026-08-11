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
import type {
  PayableDocument,
  CreatePayablePayload,
  GenerateDuesPayload,
  PayableStatus,
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

  const membersToProcess: Array<{ studentId: string; studentName: string; studentSchoolId: string }> = [];

  snapshot.docs.forEach((d) => {
    const data = d.data();
    const studentId = data.studentId || d.id;
    if (memberIds === 'all' || memberIds.includes(studentId) || memberIds.includes(d.id)) {
      membersToProcess.push({
        studentId,
        studentName: data.studentName || 'Student',
        studentSchoolId: data.studentId || '',
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
  const existingStudentIds = new Set(
    existingSnapshot.docs.map((d) => d.data().studentId)
  );

  // Filter out already generated members
  const newMembers = membersToProcess.filter(
    (m) => !existingStudentIds.has(m.studentId)
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

  await setDoc(newDocRef, {
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
    dueDate: formattedDueDate,
    paidAt: null,
    recordedBy: null,
    paymentMethod: null,
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
  unlockQRTicket?: boolean
): Promise<void> {
  const payableRef = doc(db, PAYABLES_COLLECTION, payableId);
  const snap = await getDoc(payableRef);

  if (!snap.exists()) {
    throw new Error('Payable document not found');
  }

  const data = snap.data() as PayableDocument;
  const currentPaid = data.paidAmount || 0;
  const assigned = data.assignedAmount || 0;
  const newPaidAmount = currentPaid + paymentAmount;

  let newStatus: PayableStatus = 'partial';
  let paidAtTimestamp: Timestamp | null = data.paidAt || null;

  if (newPaidAmount >= assigned) {
    newStatus = 'paid';
    paidAtTimestamp = Timestamp.now();
  } else if (newPaidAmount > 0) {
    newStatus = 'partial';
  }

  const updates: Record<string, any> = {
    paidAmount: newPaidAmount,
    status: newStatus,
    paidAt: paidAtTimestamp,
    recordedBy,
    paymentMethod,
    updatedAt: serverTimestamp(),
  };

  if (typeof unlockQRTicket === 'boolean') {
    updates.qrTicketUnlocked = unlockQRTicket;
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

  const isSaoAdminEvent =
    eventData.hostingOrgId === 'sao_admin' ||
    eventData.hostingOrgId === 'sao' ||
    !isOfficer;

  const payableType: PayableType = isSaoAdminEvent ? 'admin_fine' : 'org_fine';
  const orgId = eventData.hostingOrgId || null;
  const orgName = eventData.hostingOrgName || eventData.org || null;
  const semesterId = eventData.semesterId || 'current';

  let createdCount = 0;
  let skippedCount = 0;

  const newPayablesToCreate: CreatePayablePayload[] = [];

  for (const rec of attendanceDocs) {
    const studentId = (rec.studentId || '').toString().trim();
    const studentName = rec.name || 'Student';
    const status = (rec.status || '').toString();

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

    if (!violationCategory || !studentId) continue;

    const fineKey = `${studentId}_${violationCategory}`;
    if (existingFineKeys.has(fineKey)) {
      skippedCount++;
      continue;
    }

    existingFineKeys.add(fineKey);
    newPayablesToCreate.push({
      studentId,
      studentName,
      studentSchoolId: studentId,
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
