import { doc, collection, setDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { DepartmentDocument, CourseDocument, SectionDocument, SemesterDocument, SemesterTerm } from '../types/academic.types';

export const DEPARTMENTS_COLLECTION = 'departments';
export const COURSES_COLLECTION     = 'courses';
export const SECTIONS_COLLECTION    = 'sections';
export const SEMESTERS_COLLECTION   = 'semesters';

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────

export async function createDepartment(data: Pick<DepartmentDocument, 'name' | 'code'>): Promise<void> {
  const newRef = doc(collection(db, DEPARTMENTS_COLLECTION));
  await setDoc(newRef, {
    id: newRef.id,
    ...data,
    archived: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export async function updateDepartment(id: string, data: Partial<Pick<DepartmentDocument, 'name' | 'code' | 'archived'>>): Promise<void> {
  const ref = doc(db, DEPARTMENTS_COLLECTION, id);
  await updateDoc(ref, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteDepartment(id: string): Promise<void> {
  const ref = doc(db, DEPARTMENTS_COLLECTION, id);
  await deleteDoc(ref);
}

// ─── COURSES ─────────────────────────────────────────────────────────────────

export async function createCourse(data: Pick<CourseDocument, 'name' | 'code' | 'departmentId' | 'yearLevels'>): Promise<void> {
  const newRef = doc(collection(db, COURSES_COLLECTION));
  await setDoc(newRef, {
    id: newRef.id,
    ...data,
    archived: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export async function updateCourse(id: string, data: Partial<Pick<CourseDocument, 'name' | 'code' | 'departmentId' | 'yearLevels' | 'archived'>>): Promise<void> {
  const ref = doc(db, COURSES_COLLECTION, id);
  await updateDoc(ref, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteCourse(id: string): Promise<void> {
  const ref = doc(db, COURSES_COLLECTION, id);
  await deleteDoc(ref);
}

// ─── SECTIONS ────────────────────────────────────────────────────────────────

export async function createSection(data: Pick<SectionDocument, 'name' | 'courseId' | 'departmentId' | 'yearLevel'>): Promise<void> {
  const newRef = doc(collection(db, SECTIONS_COLLECTION));
  await setDoc(newRef, {
    id: newRef.id,
    ...data,
    archived: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export async function updateSection(id: string, data: Partial<Pick<SectionDocument, 'name' | 'courseId' | 'departmentId' | 'yearLevel' | 'archived'>>): Promise<void> {
  const ref = doc(db, SECTIONS_COLLECTION, id);
  await updateDoc(ref, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteSection(id: string): Promise<void> {
  const ref = doc(db, SECTIONS_COLLECTION, id);
  await deleteDoc(ref);
}

// ─── SEMESTERS ────────────────────────────────────────────────────────────────

/**
 * Generates smart Academic Year suggestions based on current date and existing records.
 * Returns e.g. ["2025-2026", "2026-2027", "2027-2028", "2028-2029"]
 */
export function getAcademicYearSuggestions(): string[] {
  const currentYear = new Date().getFullYear();
  const suggestions: string[] = [];
  for (let i = 0; i <= 3; i++) {
    const start = currentYear + i - 1;
    const end = start + 1;
    suggestions.push(`${start}-${end}`);
  }
  return suggestions;
}

/**
 * Checks existing semesters for a given academic year to determine term availability.
 */
export function getSemesterTermAvailability(
  academicYear: string,
  existingSemesters: SemesterDocument[]
): {
  firstSemExists: boolean;
  secondSemExists: boolean;
  bothExist: boolean;
  suggestedTerm: SemesterTerm | null;
} {
  const cleanAY = academicYear.replace(/[–—\s]/g, '-').trim().toLowerCase();
  const matching = existingSemesters.filter(
    (s) => s.academicYear.replace(/[–—\s]/g, '-').trim().toLowerCase() === cleanAY && !s.archived
  );

  const firstSemExists = matching.some((s) => s.semester === '1st Semester');
  const secondSemExists = matching.some((s) => s.semester === '2nd Semester');
  const bothExist = firstSemExists && secondSemExists;

  let suggestedTerm: SemesterTerm | null = null;
  if (!firstSemExists) {
    suggestedTerm = '1st Semester';
  } else if (!secondSemExists) {
    suggestedTerm = '2nd Semester';
  }

  return { firstSemExists, secondSemExists, bothExist, suggestedTerm };
}

/**
 * Derives the standardised semester label from the form inputs.
 * Format: A.Y.{startYear}-{endYear}-{1S|2S}
 * Example: A.Y.2026-2027-1S
 */
export function generateSemesterLabel(academicYear: string, semester: SemesterTerm): string {
  const clean = academicYear.replace(/\s/g, '').replace(/[–—]/g, '-');
  const suffix = semester === '1st Semester' ? '1S' : '2S';
  return `A.Y.${clean}-${suffix}`;
}

export async function createSemester(
  data: Pick<SemesterDocument, 'academicYear' | 'semester' | 'startDate' | 'endDate' | 'reenrollDeadline' | 'status'>
): Promise<void> {
  const newRef = doc(collection(db, SEMESTERS_COLLECTION));
  const label  = generateSemesterLabel(data.academicYear, data.semester);
  await setDoc(newRef, {
    id: newRef.id,
    ...data,
    label,
    events:   0,
    students: 0,
    archived: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  } satisfies SemesterDocument);
}

export async function updateSemester(
  id: string,
  data: Partial<Pick<SemesterDocument, 'academicYear' | 'semester' | 'startDate' | 'endDate' | 'reenrollDeadline' | 'status' | 'archived'>>
): Promise<void> {
  const ref = doc(db, SEMESTERS_COLLECTION, id);
  const extra: Record<string, unknown> = { updatedAt: Timestamp.now() };
  // Re-derive label if semester or academicYear changed
  if (data.academicYear || data.semester) {
    // We need both fields — caller must supply both when either changes
    if (data.academicYear && data.semester) {
      extra['label'] = generateSemesterLabel(data.academicYear, data.semester);
    }
  }
  await updateDoc(ref, { ...data, ...extra });
}

export async function archiveSemester(id: string): Promise<void> {
  const ref = doc(db, SEMESTERS_COLLECTION, id);
  await updateDoc(ref, { archived: true, status: 'COMPLETED', updatedAt: Timestamp.now() });
}

export async function deleteSemester(id: string): Promise<void> {
  const ref = doc(db, SEMESTERS_COLLECTION, id);
  await deleteDoc(ref);
}

/**
 * Executes a real Firestore Semester Rollover:
 * 1. Completes the currently active semester.
 * 2. Activates the target upcoming semester.
 * 3. Records an audit log entry.
 */
export async function executeSemesterRollover(
  closingSemester: SemesterDocument,
  targetSemester: SemesterDocument,
  options?: { carryBudget?: boolean; autoInactivate?: boolean; flagOfficers?: boolean; resetCompliance?: boolean },
  adminUid?: string
): Promise<{ success: boolean; closingLabel: string; targetLabel: string }> {
  const batch = (await import('firebase/firestore')).writeBatch(db);

  // 1. Close current active semester
  const closingRef = doc(db, SEMESTERS_COLLECTION, closingSemester.id);
  batch.update(closingRef, {
    status: 'COMPLETED',
    updatedAt: Timestamp.now(),
  });

  // 2. Activate target upcoming semester
  const targetRef = doc(db, SEMESTERS_COLLECTION, targetSemester.id);
  batch.update(targetRef, {
    status: 'ACTIVE',
    updatedAt: Timestamp.now(),
  });

  // 3. Write Audit Log
  const auditRef = doc(collection(db, 'audit_logs'));
  batch.set(auditRef, {
    id: auditRef.id,
    action: 'SEMESTER_ROLLOVER',
    performedBy: adminUid || 'admin',
    closingSemesterId: closingSemester.id,
    closingSemesterLabel: closingSemester.label,
    targetSemesterId: targetSemester.id,
    targetSemesterLabel: targetSemester.label,
    options: options || {},
    timestamp: Timestamp.now(),
    createdAt: Timestamp.now(),
  });

  await batch.commit();

  return {
    success: true,
    closingLabel: closingSemester.label,
    targetLabel: targetSemester.label,
  };
}

