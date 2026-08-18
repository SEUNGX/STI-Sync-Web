import { Timestamp } from 'firebase/firestore';

// ─── Document File Type ───────────────────────────────────────────────────────
export type DocFileType = 'PDF' | 'DOCX' | 'XLSX' | 'JPG' | 'PNG' | 'OTHER';
export type DocStatus = 'Pending' | 'Approved' | 'Rejected' | 'Resubmitted' | 'Draft';
export type DocDistribution = 'all' | 'specific' | 'type';

// ─── Core Document (submission + broadcast in one collection) ─────────────────
export interface DocumentDocument {
  id: string;

  // ─── Classification ───
  type: 'submission' | 'broadcast';
  title: string;
  description: string;
  category: string;
  categoryId: string;

  // ─── File ───
  fileUrl: string;
  fileName: string;
  fileType: DocFileType;
  fileSize: number;

  // ─── Academic Context ───
  semesterId: string;
  academicYear: string;
  semester: string;

  // ─── Reference ───
  referenceNumber: string;

  // ─── Submission-specific (type === 'submission') ───
  submittedBy: string;
  submittedByEmail: string;
  submittedByOrgId: string;
  submittedByOrgName: string;
  submittedByOrgAcronym: string;
  submittedByOrgTypeId: string;
  status: DocStatus;
  remarks: string | null;
  reviewedBy: string | null;
  reviewedAt: Timestamp | null;
  resubmissionOf: string | null;
  resubmissionNote: string | null;

  // ─── Broadcast-specific (type === 'broadcast') ───
  broadcastBy: string;
  broadcastByUid: string;
  distribution: DocDistribution;
  targetOrgIds: string[];
  targetOrgTypeId: string | null;
  readBy: Record<string, Timestamp>;

  // ─── Timestamps ───
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const FILE_EXT_MAP: Record<string, DocFileType> = {
  pdf: 'PDF',
  doc: 'DOCX',
  docx: 'DOCX',
  xlsx: 'XLSX',
  xls: 'XLSX',
  jpg: 'JPG',
  jpeg: 'JPG',
  png: 'PNG',
};

export function inferFileType(fileName: string): DocFileType {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return FILE_EXT_MAP[ext] ?? 'OTHER';
}

export const DOCUMENT_ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/jpeg',
  'image/png',
];

export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

// ─── Document Category ────────────────────────────────────────────────────────
export interface DocumentCategoryDocument {
  id: string;                              // Auto-generated Firestore document ID
  name: string;                            // e.g., "Activity Letter"
  color: string;                           // Tailwind classes e.g., "bg-blue-50 text-[#0E4EBD]"
  colorDot: string;                        // Dot color e.g., "bg-[#0E4EBD]"
  requiresRemarks: boolean;                // SAS must provide remarks when rejecting
  officerCanSubmit: boolean;               // Category visible in officer submission form
  active: boolean;                         // Whether category is enabled
  sortOrder: number;                       // For drag-to-reorder
  archived: boolean;                       // Soft delete flag

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DocumentSettingsDocument {
  // Reference Number Format
  refPrefix: string;                       // e.g., "DOC"
  refSeparator: string;                    // e.g., "-"
  refIncludeYear: boolean;
  refPadding: number;                      // e.g., 4

  // Retention & Archival
  retentionYears: number;
  autoArchiveCompleted: boolean;
  archiveAfterSemesters: number;
  allowOfficerDelete: boolean;
  draftExpiryDays: number;

  updatedAt: Timestamp;
}

// ─── Defaults ──────────────────────────────────────────────────────────────────
export const DEFAULT_DOCUMENT_SETTINGS: Omit<DocumentSettingsDocument, 'updatedAt'> = {
  refPrefix: 'DOC',
  refSeparator: '-',
  refIncludeYear: true,
  refPadding: 4,

  retentionYears: 5,
  autoArchiveCompleted: true,
  archiveAfterSemesters: 2,
  allowOfficerDelete: false,
  draftExpiryDays: 30,
};
