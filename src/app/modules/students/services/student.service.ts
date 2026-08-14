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
import { db, auth } from '../../../../services/firebase';
import { syncStudentPayablesForActiveEvents } from '../../finance/services/payable.service';
import type {
  StudentDocument,
  StudentStatus,
  StudentYearLevel,
  StudentSemester,
  StudentSex,
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

/** Returns true if a student with this email already exists in Firestore. */
export async function isEmailTaken(email: string): Promise<boolean> {
  const q = query(
    collection(db, STUDENTS_COLLECTION),
    where('email', '==', email.trim().toLowerCase())
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Manually registers a student from the admin panel.
 * Steps:
 *  1. Validates studentId and email uniqueness.
 *  2. Creates a Firebase Auth account with the provided credentials.
 *  3. Writes the Firestore student document using the Auth UID.
 *  4. Sends a password reset / welcome email so the student can set their own password.
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

  // ── 4. Write Firestore document ─────────────────────────────────────────
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

    courseId:        payload.courseId,
    courseName:      payload.courseName,
    courseCode:      payload.courseCode,
    departmentId:    payload.departmentId,
    departmentName:  payload.departmentName,
    yearLevel:       payload.yearLevel,
    section:         payload.section.trim(),
    schoolYear:      payload.schoolYear,
    semester:        payload.semester,

    email:           payload.email.trim().toLowerCase(),
    authUid,

    profilePhotoUrl:  payload.profilePhotoUrl,
    schoolIdPhotoUrl: payload.schoolIdPhotoUrl,

    status:              'ACTIVE',
    registrationSource:  'MANUAL',
    addedBy:             addedByUid,

    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(docRef, studentDoc);

  // ── 4. Auto-sync payables for active events & dues ───────────────────────
  try {
    await syncStudentPayablesForActiveEvents(studentDoc, addedByUid);
  } catch (syncErr) {
    console.warn('Could not auto-sync payables for new student:', syncErr);
  }

  // ── 5. Send welcome / password email ────────────────────────────────────
  try {
    await sendPasswordResetEmail(auth, payload.email.trim().toLowerCase());
  } catch {
    // Non-fatal: the account and document are already created.
    console.warn('Could not send welcome email — student account is still active.');
  }

  return authUid;
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
  updates?: Partial<Pick<StudentDocument, 'yearLevel' | 'section' | 'courseId' | 'courseName' | 'courseCode'>>
): Promise<void> {
  const ref = doc(db, STUDENTS_COLLECTION, id);
  await updateDoc(ref, {
    schoolYear: targetAcademicYear,
    semester: targetSemester,
    status: 'ACTIVE',
    ...(updates || {}),
    updatedAt: Timestamp.now(),
  });
}

export async function bulkReEnrollStudents(
  studentIds: string[],
  targetAcademicYear: string,
  targetSemester: StudentSemester
): Promise<void> {
  const batch = (await import('firebase/firestore')).writeBatch(db);
  for (const id of studentIds) {
    const ref = doc(db, STUDENTS_COLLECTION, id);
    batch.update(ref, {
      schoolYear: targetAcademicYear,
      semester: targetSemester,
      status: 'ACTIVE',
      updatedAt: Timestamp.now(),
    });
  }
  await batch.commit();
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

