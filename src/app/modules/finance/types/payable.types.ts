import { Timestamp } from 'firebase/firestore';

export type PayableType = 
  | 'membership_due'
  | 'event_fee'
  | 'org_fine'
  | 'admin_fine'
  | 'custom';

export type PayableStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'waived';

export interface PayableDocument {
  id: string;

  // ─── Who Owes ───
  studentId: string;
  studentName: string;
  studentSchoolId: string;

  // ─── What Is Owed ───
  type: PayableType;
  label: string;
  description: string;

  // ─── Context ───
  organizationId: string | null;
  organizationName: string | null;
  semesterId: string;
  eventId: string | null;

  // ─── Money ───
  assignedAmount: number;
  paidAmount: number;
  status: PayableStatus;
  dueDate: Timestamp | null;

  // ─── Payment Record & QR Access Control ───
  paidAt: Timestamp | null;
  recordedBy: string | null;
  paymentMethod: string | null;
  qrTicketUnlocked?: boolean;              // Explicit toggle: true = student event QR ticket unlocked for gate scan
  transferredAmount?: number;              // Amount from this payable already transferred to budget
  transferredToBudget?: boolean;           // True if event fee collection transferred to SAO budget
  transferredAt?: Timestamp | null;
  transferredBatchId?: string | null;
  fineViolations?: FineViolationDetail[];  // Granular breakdown of session fine violations

  // ─── Audit ───
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FineViolationDetail {
  sessionId: string;
  sessionTitle: string;
  violationType: 'time_in_absent' | 'time_in_late' | 'time_out_absent';
  amount: number;
  description: string;
}

export interface SessionFineRule {
  sessionId: string;
  sessionTitle: string;
  timeInAbsentAmount: number;     // ₱ fine for absent at time-in
  timeInLateAmount: number;       // ₱ fine for late check-in
  timeOutAbsentAmount: number;    // ₱ fine for missing time-out (if session has timeout)
  enableTimeInAbsent: boolean;
  enableTimeInLate: boolean;
  enableTimeOutAbsent: boolean;
}

export interface GenerateEventFinesPayload {
  eventId: string;
  eventTitle: string;
  semesterId: string;
  rules: SessionFineRule[];
  createdBy: string;
  isOfficer: boolean;
  hostingOrgId?: string | null;
  hostingOrgName?: string | null;
  dueDate?: Date | Timestamp | string | null;
  studentViolations?: Array<{
    studentId: string;
    studentName: string;
    studentSchoolId?: string;
    violations: FineViolationDetail[];
    totalFine: number;
  }>;
  rawAttendanceRecords?: any[];
}

export interface CollectionPaymentItem {
  id: string;
  name: string;
  studentId: string;
  amount: number;
  paidDate: string;
  status: "Paid" | "Pending";
  transferredAmount?: number;
  untransferredAmount?: number;
  transferredToBudget?: boolean;
  transferredAt?: string;
  transferredBatchId?: string;
  paymentMethod?: string;
  fineViolations?: FineViolationDetail[];
  description?: string;
}

export interface StudentEventCollectionGroup {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  type?: PayableType;
  organizationId?: string | null;
  payablePerStudent: number;
  totalStudents: number;
  totalAssigned?: number;
  totalCollected?: number;
  transferredAmount?: number;
  untransferredAmount?: number;
  transferredToBudget: boolean;
  transferredDate?: string;
  payments: CollectionPaymentItem[];
}

export interface CreatePayablePayload {
  studentId: string;
  studentName: string;
  studentSchoolId: string;
  type: PayableType;
  label: string;
  description?: string;
  organizationId?: string | null;
  organizationName?: string | null;
  semesterId: string;
  eventId?: string | null;
  assignedAmount: number;
  dueDate?: Date | Timestamp | null;
  createdBy: string;
  fineViolations?: FineViolationDetail[];
}

export interface GenerateDuesPayload {
  organizationId: string;
  organizationName: string;
  semesterId: string;
  membershipFee: number;
  memberIds: 'all' | string[];
  dueDate?: Date | null;
  createdBy: string;
}

export interface FineRuleDocument {
  id: string;
  violation: string;
  amount: number;
  per: 'incident' | 'day' | 'event';
  maxAmount: number | null;
  severity: 'low' | 'medium' | 'high';
  autoApply: boolean;
  gracePeriodDays: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
