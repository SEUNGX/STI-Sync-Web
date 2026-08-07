import { Timestamp } from 'firebase/firestore';

export interface EventDocument {
  // ─── Identity ───
  id: string;
  referenceId: string;                     // e.g., "EVT-ADM-2026-0018"
  title: string;
  tagline: string | null;
  description: string;
  objectives: string[];
  bannerImageUrl: string | null;
  isVisible: boolean;
  visibilityStart: string | null; // ISO string for form, converted to Timestamp in service

  // ─── Classification ───
  eventTypeId: string;                     // FK → /event_types
  eventCategoryId: string;                 // FK → /event_categories
  hostingOrgId: string;                    // FK → /organizations

  // ─── Academic Context ───
  semesterId: string;                      // FK → /semesters
  schoolYear: string;                      // auto-derived from active semester

  // ─── Schedule ───
  sessions: EventSession[];
  venueId: string;                         // FK → /venues
  eventFormat: 'On-Campus' | 'Online' | 'Hybrid';

  // ─── Participants ───
  targetYearLevels: string[];
  targetDepartmentIds: string[];           // FK[] → /departments
  expectedParticipantCount: number;

  // ─── Attendance ───
  attendanceEnabled: boolean;              // toggle: Required / Not Required
  minAttendancePercent: number | null;
  lateThresholdMinutes: number | null;
  gracePeriodMinutes: number | null;
  latePenaltyAmount: number | null;        // ₱ — replaces "Attendance Weight"

  // ─── Certificates ───
  certificatesEnabled: boolean;            // toggle: Required / Not Required
  autoIssueCertificates: boolean;
  certificateSignatory: string | null;

  // ─── Payables ───
  studentPayablesEnabled: boolean;
  suggestedFeePerStudent: number | null;
  adminFeeOverride: number | null;
  totalExpectedCollection: number | null;

  // ─── Staff ───
  supervisorId: string;                    // SAO Adviser UID
  scanners: EventScanner[];
  scannerUserIds: string[];                // denormalized officerUserIds for mobile query

  // ─── Budget ───
  budgetItems: BudgetLineItem[];
  totalApprovedBudget: number;

  // ─── Documents ───
  documents: EventDocumentFile[];

  // ─── Settings ───
  enableQRTickets: boolean;
  mandatoryAttendance: boolean;
  lockAfterApproval: boolean;
  scannerActivationCode: string;           // auto-generated 6-digit code

  // ─── Lifecycle ───
  proposalStatus: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'returned';
  createdBy: string;                       // SAO Adviser UID
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // ─── Review Metadata ───
  approvedBy?: string | null;
  approvedAt?: Timestamp | null;
  rejectedBy?: string | null;
  rejectedAt?: Timestamp | null;
  rejectionReason?: string | null;
  adviserRemarks?: string | null;
  allowResubmission?: boolean;
  returnedAt?: Timestamp | null;
  returnedBy?: string | null;
  returnFlags?: string[];
  returnDeadline?: string | null;
  proposalHistory?: EventProposalHistoryLog[];
}

export interface EventProposalHistoryLog {
  id: string;
  action: 'created' | 'submitted' | 'approved' | 'returned' | 'rejected' | 'resubmitted';
  performedBy: string;
  performedByName?: string;
  performedAt: Timestamp;
  reason?: string;
  remarks?: string;
  returnFlags?: string[];
}

export interface EventSession {
  id: string; // Will use timestamp strings for unique IDs
  title: string;
  date: string;                            // ISO YYYY-MM-DD
  startTime: string;                       // HH:mm
  endTime: string;                         // HH:mm
  timeInOpen: string;
  timeInClose: string;
  hasTimeOut: boolean;
  timeOutOpen: string;                     // Using empty string if disabled
  timeOutClose: string;
}

export interface EventScanner {
  id: string;
  officerName: string;
  officerUserId: string | null;
  fullAccess: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  canViewList: boolean;
  canEditRecords: boolean;
  allowManualAttendance: boolean;
}

export interface BudgetLineItem {
  id: string;
  item: string;
  description: string;
  quantity: number;
  unitCost: number;
  approvedAmount: number;
  status: 'approved' | 'reduced' | 'rejected' | 'pending';
}

export interface EventDocumentFile {
  id: string;
  name: string;
  fileUrl: string | null;
  required: boolean;
}

// In-memory shape for the wizard form
export type EventFormData = Partial<EventDocument>;
