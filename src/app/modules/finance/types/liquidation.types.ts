import { Timestamp } from 'firebase/firestore';

export type LiquidationStatus = 'draft' | 'pending' | 'approved' | 'returned' | 'voided';

export interface ReceiptAttachment {
  id: string;
  url: string;
  name: string;
  fileType: 'image' | 'pdf' | 'document' | 'spreadsheet' | 'other';
  size?: number;
  publicId?: string;
}

export interface ExpenseLineItem {
  id: string;
  description: string;
  category: string; // 'Food & Catering' | 'Venue & Facilities' | 'Materials & Printing' | 'Honorarium' | 'Transportation' | 'Miscellaneous'
  allocatedCost?: number; // Pre-filled approved budget amount for this item
  proposedQuantity?: number; // Proposed quantity from proposal
  proposedUnitCost?: number; // Proposed unit cost from proposal
  isPreFilled?: boolean; // If true, description & category cannot be edited or deleted
  quantity: number;
  unitCost: number;
  totalCost: number;
  vendorName: string;
  receiptNumber?: string;
  receiptUrl?: string; // Cloudinary secure URL (primary/first receipt for backward compatibility)
  receiptPublicId?: string;
  receiptUrls?: string[]; // Multiple receipt URLs
  receiptFiles?: ReceiptAttachment[]; // Detailed receipt attachment objects
}

export interface LiquidationRemark {
  id: string;
  authorName: string;
  authorRole: 'admin' | 'officer';
  action: 'submitted' | 'returned' | 'approved' | 'draft_saved' | 'voided';
  comment: string;
  timestamp: string; // ISO string
}

export interface LiquidationDocument {
  id: string;
  eventId: string;
  eventTitle: string;
  organizationId: string;
  organizationName: string;
  createdById: string;
  createdByRole: 'admin' | 'officer';
  createdByName: string;
  allocatedBudget: number;      // Approved budget ceiling from event
  totalActualSpending: number;  // Sum of all line items
  surplusOrDeficit: number;     // allocatedBudget - totalActualSpending
  status: LiquidationStatus;
  lineItems: ExpenseLineItem[];
  remarksHistory?: LiquidationRemark[];
  submittedAt?: Timestamp | any;
  approvedAt?: Timestamp | any;
  approvedBy?: string;
  returnRemarks?: string;
  returnedAt?: Timestamp | any;
  voidedAt?: Timestamp | any;
  voidedBy?: string;
  voidedReason?: string;
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
}

export interface EventAttendanceSummary {
  id: string;
  event: string;
  registered: number;
  checkedIn: number;
  absent: number;
}
