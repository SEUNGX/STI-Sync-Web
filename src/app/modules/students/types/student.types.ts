import { Timestamp } from 'firebase/firestore';

// ─── Student ──────────────────────────────────────────────────────────────────

export type AcademicLevel    = 'COLLEGE' | 'SHS';
export type StudentSex       = 'Male' | 'Female';
export type StudentYearLevel = 'Grade 11' | 'Grade 12' | '1st Year' | '2nd Year' | '3rd Year' | '4th Year';
export type StudentSemester  = '1st Semester' | '2nd Semester' | 'Summer' | '1st Trimester' | '2nd Trimester' | '3rd Trimester';
export type StudentTerm      = StudentSemester;
export type StudentStatus    = 'ACTIVE' | 'PENDING' | 'RETURNED' | 'INACTIVE' | 'ARCHIVED';

export interface StudentDocument {
  // ── Identity ──────────────────────────────────────────────────────────────
  id:           string;       // Firestore doc id
  lastName:     string;
  firstName:    string;
  middleName:   string;       // empty string if not provided
  studentId:    string;       // official STI student ID e.g. "2023-0001"
  dateOfBirth:  string;       // ISO date string YYYY-MM-DD
  sex:          StudentSex;
  contactNumber: string;      // digits only, no country code

  // ── Academic ──────────────────────────────────────────────────────────────
  academicLevel?: AcademicLevel; // 'COLLEGE' | 'SHS' (defaults to 'COLLEGE')
  courseId:     string;       // ref → courses collection
  courseName:   string;       // denormalised for query speed
  courseCode:   string;
  departmentId: string;       // ref → departments collection
  departmentName: string;     // denormalised
  yearLevel:    StudentYearLevel;
  section:      string;
  schoolYear:   string;       // e.g. "2026-2027"
  semester:     StudentSemester;
  term?:        StudentTerm;  // alias for semester

  // ── Account ───────────────────────────────────────────────────────────────
  email:        string;
  /** hashed password stored by Firebase Auth — NOT in Firestore directly.
   *  We keep the email here; Auth is created separately via createUserWithEmailAndPassword. */
  authUid:      string;       // Firebase Auth UID, filled after account creation
  requiresPasswordChange?: boolean; // Set true when admin creates temporary credentials
  requiresChangePassword?: boolean; // Alias for mobile app compatibility

  // ── Media ─────────────────────────────────────────────────────────────────
  profilePhotoUrl: string;    // Cloudinary URL, '' if not yet uploaded
  schoolIdPhotoUrl: string;   // Cloudinary URL, '' if not yet uploaded

  // ── Registry ──────────────────────────────────────────────────────────────
  status:       StudentStatus;
  registrationSource: 'MANUAL' | 'SELF_REGISTER'; // how the account was created
  addedBy:      string;       // admin UID who created the record manually
  rejectionReason?: string;   // if status is RETURNED, admin reason for return

  // ── Archival ──────────────────────────────────────────────────────────────
  archiveReason?: string;     // e.g. "Graduated", "Transferred", "Dropped", "Manual"
  archivedAt?:    Timestamp;
  archivedBy?:    string;

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt:    Timestamp;
  updatedAt:    Timestamp;
}

export interface StudentArchivalValidation {
  canArchive: boolean;
  blockers: string[];
  unpaidPayables: Array<{
    id: string;
    label: string;
    type: string;
    organizationName?: string | null;
    assignedAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    status: string;
    dueDate?: string | null;
  }>;
  activeOfficerRoles: Array<{
    id: string;
    organizationId: string;
    organizationName?: string;
    roleName?: string;
  }>;
}
