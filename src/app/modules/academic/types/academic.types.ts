import { Timestamp } from 'firebase/firestore';

// ─── Semester ─────────────────────────────────────────────────────────────────
export type SemesterTerm = '1st Semester' | '2nd Semester';
export type SemesterStatus = 'ACTIVE' | 'UPCOMING' | 'COMPLETED';

export interface SemesterDocument {
  id: string;
  academicYear: string;       // e.g. "2026-2027"
  semester: SemesterTerm;    // '1st Semester' | '2nd Semester'
  label: string;             // auto-generated e.g. "A.Y.2026-2027-1S"
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

export interface DepartmentDocument {
  id: string;
  name: string;
  code: string;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CourseDocument {
  id: string;
  name: string;
  code: string;
  departmentId: string;
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
  carryBudget?: boolean;
  autoInactivate?: boolean;
  flagOfficers?: boolean;
  resetCompliance?: boolean;
}

export interface RolloverExecutionResult {
  success: boolean;
  closingSemesterLabel: string;
  targetSemesterLabel: string;
  timestamp: string;
  studentsAffected: number;
}

