import { Timestamp } from 'firebase/firestore';

export type TransactionType = 'income' | 'expense';
export type TransactionSource =
  | 'allocation'
  | 'student_collection'
  | 'manual_expense'
  | 'carry_over'
  | 'event_budget'
  | 'liquidation_surplus'
  | 'liquidation_deficit';

export interface SaoLedgerDocument {
  id: string;
  semesterId: string | null;     // FK → /semesters
  date: Timestamp;
  description: string;
  eventId: string | null;        // Optional FK → /events
  type: TransactionType;
  source: TransactionSource;
  amount: number;
  addedBy: string;               // Admin Name
  collectionId?: string;         // FK → /payables/collections
  createdAt: Timestamp;
}

export interface OrgLedgerDocument {
  id: string;
  organizationId: string;        // FK → /organizations
  semesterId: string | null;     // FK → /semesters
  date: Timestamp;
  description: string;
  eventId: string | null;        // Optional FK → /events
  type: TransactionType;
  source: TransactionSource | 'sponsorship';
  amount: number;
  addedBy: string;               // Officer's Name
  collectionId?: string;         // FK → /payables/collections
  createdAt: Timestamp;
}
