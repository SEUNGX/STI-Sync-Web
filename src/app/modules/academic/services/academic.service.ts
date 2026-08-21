import { doc, collection, setDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type {
  DepartmentDocument,
  CourseDocument,
  SectionDocument,
  SemesterDocument,
  AcademicLevel,
  AcademicTerm,
  AcademicTermType,
  SemesterTerm,
  TrimesterTerm,
} from '../types/academic.types';

export const DEPARTMENTS_COLLECTION = 'departments';
export const COURSES_COLLECTION     = 'courses';
export const SECTIONS_COLLECTION    = 'sections';
export const SEMESTERS_COLLECTION   = 'semesters';

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────

export async function createDepartment(data: Pick<DepartmentDocument, 'name' | 'code'> & { academicLevel?: AcademicLevel }): Promise<void> {
  const newRef = doc(collection(db, DEPARTMENTS_COLLECTION));
  await setDoc(newRef, {
    id: newRef.id,
    ...data,
    academicLevel: data.academicLevel || 'COLLEGE',
    archived: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export async function updateDepartment(id: string, data: Partial<Pick<DepartmentDocument, 'name' | 'code' | 'academicLevel' | 'archived'>>): Promise<void> {
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

export async function createCourse(data: Pick<CourseDocument, 'name' | 'code' | 'departmentId' | 'yearLevels'> & { academicLevel?: AcademicLevel }): Promise<void> {
  const newRef = doc(collection(db, COURSES_COLLECTION));
  await setDoc(newRef, {
    id: newRef.id,
    ...data,
    academicLevel: data.academicLevel || 'COLLEGE',
    archived: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export async function updateCourse(id: string, data: Partial<Pick<CourseDocument, 'name' | 'code' | 'departmentId' | 'yearLevels' | 'academicLevel' | 'archived'>>): Promise<void> {
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

// ─── SEMESTERS / ACADEMIC PERIODS ───────────────────────────────────────────

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
 * Checks existing semesters for a given academic year and academic level to determine term availability.
 */
export function getSemesterTermAvailability(
  academicYear: string,
  existingSemesters: SemesterDocument[],
  academicLevel: AcademicLevel = 'COLLEGE'
): {
  firstSemExists: boolean;
  secondSemExists: boolean;
  thirdSemExists?: boolean;
  allTermsExist: boolean;
  suggestedTerm: AcademicTerm | null;
} {
  const cleanAY = academicYear.replace(/[–—\s]/g, '-').trim().toLowerCase();
  const matching = existingSemesters.filter(
    (s) => {
      const sLevel = s.academicLevel || (String(s.semester).includes('Trimester') ? 'SHS' : 'COLLEGE');
      return (
        sLevel === academicLevel &&
        s.academicYear.replace(/[–—\s]/g, '-').trim().toLowerCase() === cleanAY &&
        !s.archived
      );
    }
  );

  if (academicLevel === 'SHS') {
    const firstTriExists = matching.some((s) => s.semester === '1st Trimester');
    const secondTriExists = matching.some((s) => s.semester === '2nd Trimester');
    const thirdTriExists = matching.some((s) => s.semester === '3rd Trimester');
    const allTermsExist = firstTriExists && secondTriExists && thirdTriExists;

    let suggestedTerm: TrimesterTerm | null = null;
    if (!firstTriExists) {
      suggestedTerm = '1st Trimester';
    } else if (!secondTriExists) {
      suggestedTerm = '2nd Trimester';
    } else if (!thirdTriExists) {
      suggestedTerm = '3rd Trimester';
    }

    return {
      firstSemExists: firstTriExists,
      secondSemExists: secondTriExists,
      thirdSemExists: thirdTriExists,
      allTermsExist,
      suggestedTerm,
    };
  }

  // College (Semesters)
  const firstSemExists = matching.some((s) => s.semester === '1st Semester');
  const secondSemExists = matching.some((s) => s.semester === '2nd Semester');
  const allTermsExist = firstSemExists && secondSemExists;

  let suggestedTerm: SemesterTerm | null = null;
  if (!firstSemExists) {
    suggestedTerm = '1st Semester';
  } else if (!secondSemExists) {
    suggestedTerm = '2nd Semester';
  }

  return { firstSemExists, secondSemExists, allTermsExist, suggestedTerm };
}

/**
 * Derives the standardised academic period label from the inputs.
 * Format: A.Y.{startYear}-{endYear}-{1S|2S|1T|2T|3T}
 * Example: A.Y.2026-2027-1S or A.Y.2026-2027-1T
 */
export function generateSemesterLabel(
  academicYear: string,
  semester: AcademicTerm,
  academicLevel?: AcademicLevel
): string {
  const clean = academicYear.replace(/\s/g, '').replace(/[–—]/g, '-');
  let suffix = '1S';
  if (semester === '1st Semester') suffix = '1S';
  else if (semester === '2nd Semester') suffix = '2S';
  else if (semester === 'Summer') suffix = 'SUM';
  else if (semester === '1st Trimester') suffix = '1T';
  else if (semester === '2nd Trimester') suffix = '2T';
  else if (semester === '3rd Trimester') suffix = '3T';

  const isShs = academicLevel === 'SHS' || String(semester).includes('Trimester');
  const prefix = isShs ? 'SHS-AY' : 'A.Y.';
  return `${prefix}${clean}-${suffix}`;
}

export async function createSemester(
  data: Pick<SemesterDocument, 'academicYear' | 'semester' | 'startDate' | 'endDate' | 'reenrollDeadline' | 'status'> & {
    academicLevel?: AcademicLevel;
    termType?: AcademicTermType;
  }
): Promise<void> {
  const newRef = doc(collection(db, SEMESTERS_COLLECTION));
  const isShs = data.academicLevel === 'SHS' || String(data.semester).includes('Trimester');
  const academicLevel: AcademicLevel = data.academicLevel || (isShs ? 'SHS' : 'COLLEGE');
  const termType: AcademicTermType = data.termType || (isShs ? 'TRIMESTER' : 'SEMESTER');
  const label = generateSemesterLabel(data.academicYear, data.semester, academicLevel);

  await setDoc(newRef, {
    id: newRef.id,
    ...data,
    academicLevel,
    termType,
    term: data.semester,
    label,
    events: 0,
    students: 0,
    archived: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  } satisfies SemesterDocument);
}

export async function updateSemester(
  id: string,
  data: Partial<Pick<SemesterDocument, 'academicYear' | 'semester' | 'startDate' | 'endDate' | 'reenrollDeadline' | 'status' | 'archived' | 'academicLevel' | 'termType'>>
): Promise<void> {
  const ref = doc(db, SEMESTERS_COLLECTION, id);
  const extra: Record<string, unknown> = { updatedAt: Timestamp.now() };
  
  if (data.academicYear && data.semester) {
    const isShs = data.academicLevel === 'SHS' || String(data.semester).includes('Trimester');
    const academicLevel: AcademicLevel = data.academicLevel || (isShs ? 'SHS' : 'COLLEGE');
    extra['label'] = generateSemesterLabel(data.academicYear, data.semester, academicLevel);
    extra['academicLevel'] = academicLevel;
    extra['termType'] = data.termType || (isShs ? 'TRIMESTER' : 'SEMESTER');
    extra['term'] = data.semester;
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
 * 1. Completes the currently active semester for the specified academic level.
 * 2. Activates the target upcoming semester for the specified academic level.
 * 3. Records an audit log entry.
 */
export async function executeSemesterRollover(
  closingSemester: SemesterDocument,
  targetSemester: SemesterDocument,
  options?: { academicLevel?: AcademicLevel; carryBudget?: boolean; autoInactivate?: boolean; flagOfficers?: boolean; resetCompliance?: boolean },
  adminUid?: string
): Promise<{ success: boolean; closingLabel: string; targetLabel: string }> {
  const batch = (await import('firebase/firestore')).writeBatch(db);

  const academicLevel = options?.academicLevel || closingSemester.academicLevel || (String(closingSemester.semester).includes('Trimester') ? 'SHS' : 'COLLEGE');

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
    academicLevel,
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

