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

  // ─── Audit ───
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
