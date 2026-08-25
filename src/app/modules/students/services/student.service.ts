/**
 * src/app/modules/students/services/student.service.ts
 *
 * Firestore CRUD operations for the `students` collection.
 * Also handles:
 *  - Student ID uniqueness validation
 *  - Email uniqueness validation (via Auth)
 *  - Firebase Auth account creation for manually-added students
 */

import {
  doc,
  collection,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, db } from '../../../../services/firebase';
import { sendStudentWelcomeCredentialsEmail } from '../../../../services/email.service';
import { formatCurrency } from '../../../utils/currency';
import { formatAppDate } from '../../../utils/date';
import { syncStudentPayablesForActiveEvents } from '../../finance/services/payable.service';
import type {
  StudentDocument,
  StudentStatus,
  StudentYearLevel,
  StudentSemester,
  StudentSex,
  AcademicLevel,
} from '../types/student.types';

// ─── Collection ───────────────────────────────────────────────────────────────
export const STUDENTS_COLLECTION = 'students';

// ─── Payload for manual registration ─────────────────────────────────────────
export interface ManualStudentPayload {
  // Step 1 — Personal Info
  lastName:      string;
  firstName:     string;
  middleName:    string;
  studentId:     string;
  dateOfBirth:   string;  // YYYY-MM-DD
  sex:           StudentSex;
  contactNumber: string;

  // Step 2 — Academic Info
  academicLevel?: AcademicLevel;
  courseId:      string;
  courseName:    string;
  courseCode:    string;
  departmentId:  string;
  departmentName: string;
  yearLevel:     StudentYearLevel;
  section:       string;
  schoolYear:    string;
  semester:      StudentSemester;

  // Step 3 — Account Credentials
  email:         string;
  password:      string;
  sendWelcomeEmail?: boolean;

  // Step 4 & 5 — Media (optional at creation; URLs filled after upload)
  profilePhotoUrl:  string;
  schoolIdPhotoUrl: string;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

/** Returns true if a student with this studentId already exists in Firestore. */
export async function isStudentIdTaken(studentId: string): Promise<boolean> {
  const q = query(
    collection(db, STUDENTS_COLLECTION),
    where('studentId', '==', studentId.trim())
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/** Returns true if an email is already registered across any user role (students, sas_admins, organization_advisers, organization_officers). */
export async function isEmailTaken(email: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return false;

  try {
    const [studentsSnap, adminsSnap, advisersSnap, officersSnap] = await Promise.all([
      getDocs(query(collection(db, STUDENTS_COLLECTION), where('email', '==', cleanEmail))),
      getDocs(query(collection(db, 'sas_admins'), where('email', '==', cleanEmail))),
      getDocs(query(collection(db, 'organization_advisers'), where('email', '==', cleanEmail))),
      getDocs(query(collection(db, 'organization_officers'), where('email', '==', cleanEmail))),
    ]);

    return (
      !studentsSnap.empty ||
      !adminsSnap.empty ||
      !advisersSnap.empty ||
      !officersSnap.empty
    );
  } catch (err) {
    console.warn('[isEmailTaken] Error checking user email uniqueness:', err);
    return false;
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Manually registers a student from the admin panel.
 * Steps:
 *  1. Validates studentId and email uniqueness.
 *  2. Creates a Firebase Auth account with the provided credentials.
 *  3. Writes the Firestore student document using the Auth UID.
 *  4. Syncs event payables and sends credentials email in background if enabled.
 *
 * @throws Error with a human-readable `.message` on any validation or Firebase failure.
 */
export async function createStudentManually(
  payload: ManualStudentPayload,
  addedByUid: string
): Promise<string> {
  // ── 1. Uniqueness guards ────────────────────────────────────────────────
  const [idTaken, emailTaken] = await Promise.all([
    isStudentIdTaken(payload.studentId),
    isEmailTaken(payload.email),
  ]);
  if (idTaken) {
    throw new Error(`Student ID "${payload.studentId}" is already registered.`);
  }
  if (emailTaken) {
    throw new Error(`Email "${payload.email}" is already associated with another account.`);
  }

  // ── 2. Create Firebase Auth account ────────────────────────────────────
  let authUid: string;
  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      payload.email.trim().toLowerCase(),
      payload.password
    );
    authUid = credential.user.uid;
  } catch (authErr: unknown) {
    const code = (authErr as { code?: string }).code ?? '';
    if (code === 'auth/email-already-in-use') {
      throw new Error(`Email "${payload.email}" is already in use by another account.`);
    }
    if (code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please choose a stronger password.');
    }
    throw new Error('Failed to create account. Please try again.');
  }

  // ── 3. Write Firestore document ─────────────────────────────────────────
  const docRef = doc(db, STUDENTS_COLLECTION, authUid);

  const studentDoc: StudentDocument = {
    id:              authUid,
    lastName:        payload.lastName.trim(),
    firstName:       payload.firstName.trim(),
    middleName:      payload.middleName.trim(),
    studentId:       payload.studentId.trim(),
    dateOfBirth:     payload.dateOfBirth,
    sex:             payload.sex,
    contactNumber:   payload.contactNumber.trim(),

    academicLevel:   payload.academicLevel || (String(payload.semester).includes('Trimester') ? 'SHS' : 'COLLEGE'),
    courseId:        payload.courseId,
    courseName:      payload.courseName,
    courseCode:      payload.courseCode,
    departmentId:    payload.departmentId,
    departmentName:  payload.departmentName,
    yearLevel:       payload.yearLevel,
    section:         payload.section.trim(),
    schoolYear:      payload.schoolYear,
    semester:        payload.semester,
    term:            payload.semester,

    email:           payload.email.trim().toLowerCase(),
    authUid,
    requiresPasswordChange: true,
    requiresChangePassword: true,

    profilePhotoUrl:  payload.profilePhotoUrl,
    schoolIdPhotoUrl: payload.schoolIdPhotoUrl,

    status:              'ACTIVE',
    registrationSource:  'MANUAL',
    addedBy:             addedByUid,

    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(docRef, studentDoc);

  // ── 4 & 5. Background Asynchronous Tasks (Payables Sync & Credentials Email) ──
  // Run non-blocking so the admin registration completes immediately (<300ms)
  void (async () => {
    try {
      await syncStudentPayablesForActiveEvents(studentDoc, addedByUid);
    } catch (syncErr) {
      console.warn('Could not auto-sync payables for new student:', syncErr);
    }

    if (payload.sendWelcomeEmail !== false) {
      try {
        await sendStudentWelcomeCredentialsEmail({
          to: payload.email.trim().toLowerCase(),
          studentName: `${payload.firstName} ${payload.lastName}`.trim(),
          studentId: payload.studentId.trim(),
          temporaryPassword: payload.password,
          courseName: payload.courseName || payload.courseCode,
          yearLevel: payload.yearLevel,
          section: payload.section,
        });
      } catch (emailErr) {
        console.warn('Could not send student credentials email:', emailErr);
      }

      try {
        await sendPasswordResetEmail(auth, payload.email.trim().toLowerCase());
      } catch {
        console.warn('Could not send password reset email — student account is still active.');
      }
    }
  })();

  return authUid;
}

/**
 * Automatically syncs a student's institutional status (ACTIVE vs INACTIVE)
 * to their organization membership document(s) in `organization_members`.
 */
export async function syncOrgMembersOnStudentStatusChange(
  studentId: string,
  newStatus: StudentStatus
): Promise<void> {
  try {
    const studentRef = doc(db, STUDENTS_COLLECTION, studentId);
    const snap = await getDoc(studentRef);
    if (!snap.exists()) return;
    const student = snap.data() as StudentDocument;

    const membersRef = collection(db, 'organization_members');
    const queries = [
      query(membersRef, where('studentId', '==', student.id)),
    ];
    if (student.studentId) {
      queries.push(query(membersRef, where('studentId', '==', student.studentId)));
    }

    const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
    const matchingDocs: import('firebase/firestore').QueryDocumentSnapshot[] = [];
    const seenIds = new Set<string>();

    snapshots.forEach((s) => {
      s.docs.forEach((d) => {
        if (!seenIds.has(d.id)) {
          seenIds.add(d.id);
          matchingDocs.push(d);
        }
      });
    });

    if (matchingDocs.length === 0) return;

    const batch = (await import('firebase/firestore')).writeBatch(db);
    const orgMemberStatus = newStatus === 'ACTIVE' ? 'active' : 'inactive';

    matchingDocs.forEach((mDoc) => {
      batch.update(mDoc.ref, {
        status: orgMemberStatus,
        updatedAt: Timestamp.now(),
      });
    });

    await batch.commit();
  } catch (err) {
    console.warn('Failed to sync organization membership status:', err);
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateStudent(
  id: string,
  data: Partial<Omit<StudentDocument, 'id' | 'authUid' | 'createdAt' | 'registrationSource' | 'addedBy'>>
): Promise<void> {
  const ref = doc(db, STUDENTS_COLLECTION, id);
  await updateDoc(ref, { ...data, updatedAt: Timestamp.now() });
}

export async function updateStudentStatus(
  id: string,
  status: StudentStatus
): Promise<void> {
  const ref = doc(db, STUDENTS_COLLECTION, id);
  await updateDoc(ref, { status, updatedAt: Timestamp.now() });

  // Sync organization membership status automatically
  await syncOrgMembersOnStudentStatusChange(id, status);

  if (status === 'ACTIVE') {
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const studentData = { id: snap.id, ...snap.data() } as StudentDocument;
        await syncStudentPayablesForActiveEvents(studentData, 'admin_approval');
      }
    } catch (syncErr) {
      console.warn('Could not sync payables upon activating student:', syncErr);
    }
  }
}

export async function returnStudent(
  id: string,
  reason: string
): Promise<void> {
  const ref = doc(db, STUDENTS_COLLECTION, id);
  await updateDoc(ref, { 
    status: 'RETURNED', 
    rejectionReason: reason,
    updatedAt: Timestamp.now() 
  });
}

// ─── Re-enrollment ─────────────────────────────────────────────────────────────

export async function reEnrollStudent(
  id: string,
  targetAcademicYear: string,
  targetSemester: StudentSemester,
  updates?: Partial<Pick<StudentDocument, 'yearLevel' | 'section' | 'courseId' | 'courseName' | 'courseCode' | 'departmentId' | 'departmentName'>>
): Promise<void> {
  const ref = doc(db, STUDENTS_COLLECTION, id);
  await updateDoc(ref, {
    schoolYear: targetAcademicYear,
    semester: targetSemester,
    status: 'ACTIVE',
    ...(updates || {}),
    updatedAt: Timestamp.now(),
  });
  
  await syncOrgMembersOnStudentStatusChange(id, 'ACTIVE');
}

export async function bulkReEnrollStudents(
  studentIds: string[],
  targetAcademicYear: string,
  targetSemester: StudentSemester,
  promotions?: {
    targetYearLevel?: StudentYearLevel;
    targetSection?: string;
    courseId?: string;
    courseCode?: string;
    courseName?: string;
    departmentId?: string;
    departmentName?: string;
  }
): Promise<void> {
  const batch = (await import('firebase/firestore')).writeBatch(db);
  const extraUpdates: Record<string, any> = {};
  if (promotions?.targetYearLevel) extraUpdates.yearLevel = promotions.targetYearLevel;
  if (promotions?.targetSection) extraUpdates.section = promotions.targetSection.trim();
  if (promotions?.courseId) extraUpdates.courseId = promotions.courseId;
  if (promotions?.courseCode) extraUpdates.courseCode = promotions.courseCode;
  if (promotions?.courseName) extraUpdates.courseName = promotions.courseName;
  if (promotions?.departmentId) extraUpdates.departmentId = promotions.departmentId;
  if (promotions?.departmentName) extraUpdates.departmentName = promotions.departmentName;

  for (const id of studentIds) {
    const ref = doc(db, STUDENTS_COLLECTION, id);
    batch.update(ref, {
      schoolYear: targetAcademicYear,
      semester: targetSemester,
      status: 'ACTIVE',
      ...extraUpdates,
      updatedAt: Timestamp.now(),
    });
  }
  await batch.commit();

  // Sync org membership status to active for promoted students
  for (const id of studentIds) {
    await syncOrgMembersOnStudentStatusChange(id, 'ACTIVE');
  }
}

export async function inactivateOverdueStudents(studentIds: string[]): Promise<void> {
  const batch = (await import('firebase/firestore')).writeBatch(db);
  for (const id of studentIds) {
    const ref = doc(db, STUDENTS_COLLECTION, id);
    batch.update(ref, {
      status: 'INACTIVE',
      updatedAt: Timestamp.now(),
    });
  }
  await batch.commit();
}

// ─── Archival & Deletion ───────────────────────────────────────────────────────

/**
 * Pre-flight validation before archiving a student.
 * Checks for:
 *  1. Any unpaid or partially paid payables (fines, dues, event fees).
 *  2. Any active officer positions held in student organizations.
 */
export async function validateStudentArchival(
  studentDoc: StudentDocument
): Promise<import('../types/student.types').StudentArchivalValidation> {
  const blockers: string[] = [];
  const unpaidPayables: import('../types/student.types').StudentArchivalValidation['unpaidPayables'] = [];
  const activeOfficerRoles: import('../types/student.types').StudentArchivalValidation['activeOfficerRoles'] = [];

  try {
    // 1. Query payables for this student (by doc ID and school ID)
    const payablesRef = collection(db, 'payables');
    const [qById, qBySchoolId] = await Promise.all([
      getDocs(query(payablesRef, where('studentId', '==', studentDoc.id))),
      studentDoc.studentId 
        ? getDocs(query(payablesRef, where('studentSchoolId', '==', studentDoc.studentId)))
        : { docs: [] }
    ]);

    const seenPayableIds = new Set<string>();
    const allPayableDocs = [...qById.docs, ...qBySchoolId.docs];

    for (const pDoc of allPayableDocs) {
      if (seenPayableIds.has(pDoc.id)) continue;
      seenPayableIds.add(pDoc.id);

      const data = pDoc.data() as import('../../finance/types/payable.types').PayableDocument;
      const assigned = Number(data.assignedAmount || 0);
      const paid = Number(data.paidAmount || 0);
      const outstanding = assigned - paid;
      const isSettled = data.status === 'paid' || data.status === 'waived' || outstanding <= 0;

      if (!isSettled) {
        unpaidPayables.push({
          id: pDoc.id,
          label: data.label || 'Payable',
          type: data.type || 'custom',
          organizationName: data.organizationName || 'SAO / Admin',
          assignedAmount: assigned,
          paidAmount: paid,
          outstandingAmount: outstanding,
          status: data.status || 'pending',
          dueDate: formatAppDate(data.dueDate, null as any),
        });
      }
    }

    if (unpaidPayables.length > 0) {
      const totalOutstanding = unpaidPayables.reduce((sum, p) => sum + p.outstandingAmount, 0);
      blockers.push(
        `Student has ${unpaidPayables.length} unpaid payable(s) amounting to ${formatCurrency(totalOutstanding)}. Settle or waive all payables before archiving.`
      );
    }

    // 2. Query active officer roles
    const officersRef = collection(db, 'organization_officers');
    const [officersById, officersBySchoolId, officersByEmail] = await Promise.all([
      getDocs(query(officersRef, where('studentId', '==', studentDoc.id), where('isActive', '==', true))),
      studentDoc.studentId
        ? getDocs(query(officersRef, where('studentId', '==', studentDoc.studentId), where('isActive', '==', true)))
        : { docs: [] },
      studentDoc.email
        ? getDocs(query(officersRef, where('email', '==', studentDoc.email.trim().toLowerCase()), where('isActive', '==', true)))
        : { docs: [] }
    ]);

    const seenOfficerIds = new Set<string>();
    const allOfficerDocs = [...officersById.docs, ...officersBySchoolId.docs, ...officersByEmail.docs];

    for (const oDoc of allOfficerDocs) {
      if (seenOfficerIds.has(oDoc.id)) continue;
      seenOfficerIds.add(oDoc.id);

      const oData = oDoc.data();
      activeOfficerRoles.push({
        id: oDoc.id,
        organizationId: oData.organizationId || '',
        organizationName: oData.organizationName || 'Organization',
        roleName: oData.roleId || 'Officer',
      });
    }

  } catch (err: any) {
    console.error('Error validating student archival:', err);
    blockers.push(`Failed to verify student clearance status: ${err.message}`);
  }

  return {
    canArchive: blockers.length === 0,
    blockers,
    unpaidPayables,
    activeOfficerRoles,
  };
}

/**
 * Archives a student.
 * Ensures pre-flight clearance, sets status to ARCHIVED, and deactivates any active officer positions.
 */
export async function archiveStudent(
  studentDoc: StudentDocument,
  reason: string,
  adminUid: string
): Promise<void> {
  const validation = await validateStudentArchival(studentDoc);
  if (!validation.canArchive) {
    throw new Error(validation.blockers.join(' '));
  }

  const { writeBatch } = await import('firebase/firestore');
  const batch = writeBatch(db);

  // 1. Update student document to ARCHIVED
  const studentRef = doc(db, STUDENTS_COLLECTION, studentDoc.id);
  batch.update(studentRef, {
    status: 'ARCHIVED',
    archiveReason: reason.trim(),
    archivedAt: Timestamp.now(),
    archivedBy: adminUid,
    updatedAt: Timestamp.now(),
  });

  // 2. Deactivate any active officer positions
  for (const role of validation.activeOfficerRoles) {
    const officerRef = doc(db, 'organization_officers', role.id);
    batch.update(officerRef, {
      isActive: false,
      updatedAt: Timestamp.now(),
    });
  }

  await batch.commit();
}

/**
 * Restores an archived student back to ACTIVE status.
 */
export async function restoreStudent(studentId: string, _adminUid: string): Promise<void> {
  const studentRef = doc(db, STUDENTS_COLLECTION, studentId);
  await updateDoc(studentRef, {
    status: 'ACTIVE',
    updatedAt: Timestamp.now(),
  });
}

/**
 * Permanently deletes a student from the archive.
 * Purges:
 *  - `/students/{studentId}`
 *  - Associated `/organization_members`
 *  - Associated `/organization_officers`
 */
export async function deleteStudentPermanently(studentDoc: StudentDocument): Promise<void> {
  const { writeBatch, deleteDoc } = await import('firebase/firestore');
  const batch = writeBatch(db);

  // 1. Find and delete organization_members
  const membersRef = collection(db, 'organization_members');
  const [membersById, membersBySchoolId, membersByEmail] = await Promise.all([
    getDocs(query(membersRef, where('studentId', '==', studentDoc.id))),
    studentDoc.studentId ? getDocs(query(membersRef, where('studentId', '==', studentDoc.studentId))) : { docs: [] },
    studentDoc.email ? getDocs(query(membersRef, where('email', '==', studentDoc.email.trim().toLowerCase()))) : { docs: [] },
  ]);

  const seenMemberDocIds = new Set<string>();
  for (const mDoc of [...membersById.docs, ...membersBySchoolId.docs, ...membersByEmail.docs]) {
    if (!seenMemberDocIds.has(mDoc.id)) {
      seenMemberDocIds.add(mDoc.id);
      batch.delete(mDoc.ref);
    }
  }

  // 2. Find and delete organization_officers
  const officersRef = collection(db, 'organization_officers');
  const [officersById, officersBySchoolId, officersByEmail] = await Promise.all([
    getDocs(query(officersRef, where('studentId', '==', studentDoc.id))),
    studentDoc.studentId ? getDocs(query(officersRef, where('studentId', '==', studentDoc.studentId))) : { docs: [] },
    studentDoc.email ? getDocs(query(officersRef, where('email', '==', studentDoc.email.trim().toLowerCase()))) : { docs: [] },
  ]);

  const seenOfficerDocIds = new Set<string>();
  for (const oDoc of [...officersById.docs, ...officersBySchoolId.docs, ...officersByEmail.docs]) {
    if (!seenOfficerDocIds.has(oDoc.id)) {
      seenOfficerDocIds.add(oDoc.id);
      batch.delete(oDoc.ref);
    }
  }

  // 3. Delete student doc
  const studentRef = doc(db, STUDENTS_COLLECTION, studentDoc.id);
  batch.delete(studentRef);

  await batch.commit();
}


