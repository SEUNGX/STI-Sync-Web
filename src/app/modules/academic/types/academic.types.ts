import { Timestamp } from 'firebase/firestore';

// ─── Academic Levels & Terms ───────────────────────────────────────────────────
export type AcademicLevel = 'COLLEGE' | 'SHS';
export type SemesterTerm = '1st Semester' | '2nd Semester' | 'Summer';
export type TrimesterTerm = '1st Trimester' | '2nd Trimester' | '3rd Trimester';
export type AcademicTerm = SemesterTerm | TrimesterTerm;
export type AcademicTermType = 'SEMESTER' | 'TRIMESTER';
export type SemesterStatus = 'ACTIVE' | 'UPCOMING' | 'COMPLETED';
export type AcademicPeriodStatus = SemesterStatus;

export interface SemesterDocument {
  id: string;
  academicYear: string;       // e.g. "2026-2027"
  academicLevel?: AcademicLevel; // 'COLLEGE' | 'SHS' (defaults to 'COLLEGE')
  termType?: AcademicTermType;   // 'SEMESTER' | 'TRIMESTER'
  semester: AcademicTerm;    // '1st Semester' | '2nd Semester' | '1st Trimester', etc.
  term?: AcademicTerm;       // alias for semester
  label: string;             // auto-generated e.g. "A.Y.2026-2027-1S" or "A.Y.2026-2027-1T"
  startDate: string;         // ISO date string  YYYY-MM-DD
  endDate: string;           // ISO date string  YYYY-MM-DD
  reenrollDeadline: string;  // ISO date string
  status: SemesterStatus;
  events: number;
  students: number;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AcademicPeriodDocument = SemesterDocument;

export interface DepartmentDocument {
  id: string;
  name: string;
  code: string;
  academicLevel?: AcademicLevel; // 'COLLEGE' | 'SHS' (defaults to 'COLLEGE')
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CourseDocument {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  academicLevel?: AcademicLevel; // Inherited from department or assigned
  yearLevels: number;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SectionDocument {
  id: string;
  name: string;
  courseId: string;
  departmentId: string;
  yearLevel: number;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Rollover Interfaces ──────────────────────────────────────────────────────
export interface RolloverOptions {
  academicLevel?: AcademicLevel;
  carryBudget?: boolean;
  autoInactivate?: boolean;
  flagOfficers?: boolean;
  resetCompliance?: boolean;
}

export interface RolloverExecutionResult {
  success: boolean;
  academicLevel?: AcademicLevel;
  closingSemesterLabel: string;
  targetSemesterLabel: string;
  timestamp: string;
  studentsAffected: number;
}

