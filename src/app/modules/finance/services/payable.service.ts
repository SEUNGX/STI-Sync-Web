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

  // Option A (Strict): Automatically unlock only when 100% fully paid, or if explicit boolean passed
  if (typeof unlockQRTicket === 'boolean') {
    updates.qrTicketUnlocked = unlockQRTicket;
  } else if (newStatus === 'paid') {
    updates.qrTicketUnlocked = true;
  }

  await updateDoc(payableRef, updates);

  // Auto-post payment to the appropriate independent ledger
  if (paymentAmount > 0) {
    try {
      const isClubPayable =
        data.organizationId &&
        data.organizationId !== 'sao_admin' &&
        data.organizationId !== 'sao';

      if (isClubPayable) {
        await addOrgLedgerTransaction({
          organizationId: data.organizationId!,
          semesterId: data.semesterId || null,
          date: Timestamp.now(),
          description: `Student Payment: ${data.studentName || 'Student'} — ${data.label}`,
          eventId: data.eventId || null,
          type: 'income',
          source: 'student_collection',
          amount: paymentAmount,
          addedBy: recordedBy,
          collectionId: payableId,
        });
      } else {
        await addLedgerTransaction({
          semesterId: data.semesterId || null,
          date: Timestamp.now(),
          description: `Student Payment: ${data.studentName || 'Student'} — ${data.label}`,
          eventId: data.eventId || null,
          type: 'income',
          source: 'student_collection',
          amount: paymentAmount,
          addedBy: recordedBy,
          collectionId: payableId,
        });
      }
    } catch (ledgerErr) {
      console.warn('[recordPayment] Non-fatal error posting to ledger:', ledgerErr);
    }
  }
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
    yearLevel?: string;
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
  const studentYear = student.yearLevel || '';

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

        const targetDeptIds = event.targetDepartmentIds || [];
        const targetYearLevels = event.targetYearLevels || [];
        const isAllStudents =
          event.targetAudience === 'all' ||
          !event.targetAudience ||
          (targetDeptIds.length === 0 && targetYearLevels.length === 0);

        if (isAllStudents) return true;

        const matchesDept =
          targetDeptIds.length === 0 ||
          (studentDeptId && targetDeptIds.includes(studentDeptId));
        const matchesYear =
          targetYearLevels.length === 0 ||
          (studentYear && targetYearLevels.includes(studentYear));

        return matchesDept && matchesYear;
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
