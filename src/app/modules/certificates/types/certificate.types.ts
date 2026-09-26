import { Timestamp } from 'firebase/firestore';

export type CertificateStatus = 'Published' | 'Draft' | 'Pending' | 'Approved' | 'Rejected';

export type CertificateCategory = 
  | 'Participation' 
  | 'Recognition' 
  | 'Appreciation' 
  | 'Achievement' 
  | 'Completion' 
  | 'Excellence';

export type CertificateDesignPreset = 
  | 'classic_gold' 
  | 'modern_blue' 
  | 'emerald_merit' 
  | 'purple_excellence' 
  | 'minimalist_navy';

export interface CertificatePosition {
  xPercent: number; // 0 to 100 percentage from left
  yPercent: number; // 0 to 100 percentage from top
  widthPercent: number; // percentage width for alignment box
  fontSizePt: number; // e.g. 32
  fontFamily: string; // e.g. 'Great Vibes', 'Montserrat', 'Arial'
  fontWeight: string; // 'Regular' | 'Bold' | 'Italic'
  textColor: string; // e.g. '#001A4D'
  textAlign: 'left' | 'center' | 'right';
}

export type PaperSize = 'a4' | 'short' | 'long' | 'letter' | 'legal' | 'custom';
export type PaperOrientation = 'landscape' | 'portrait';

export type CertificateElementType =
  | 'recipient_name'
  | 'title'
  | 'event_name'
  | 'body_text'
  | 'date'
  | 'signatory_1'
  | 'signatory_2'
  | 'custom_text';

export interface CertificateElement {
  id: string;
  type?: CertificateElementType | string;
  label?: string;
  text: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  fontSizePt: number;
  fontFamily: string;
  fontWeight: string;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  isLocked?: boolean;
}

export interface CertificateItem {
  id: string;
  title: string;
  name?: string; // fallback alias for title
  category: CertificateCategory;
  status: CertificateStatus;
  organizationId: string;
  organizationName: string;
  eventId?: string;
  eventName?: string;
  imageUrl?: string;
  designPreset?: CertificateDesignPreset;
  isDefault?: boolean;
  paperSize?: PaperSize;
  orientation?: PaperOrientation;
  namePosition: CertificatePosition;
  elements?: CertificateElement[];
  signatoryName?: string;
  signatoryTitle?: string;
  secondarySignatoryName?: string;
  secondarySignatoryTitle?: string;
  issuedCount?: number;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  createdByName?: string;
  rejectionReason?: string;
  approvalNotes?: string;
}

// Backward-compatible alias
export interface CertificateTemplate extends CertificateItem {
  name: string;
  imageUrl: string;
  createdBy: string;
}

export interface CertificateRecipient {
  id: string; // memberId / studentId or uuid
  name: string; // full student name
  studentId: string; // e.g. "2022-00456"
  course: string; // e.g. "BSIT-3A"
  source: 'attendance' | 'manual';
  status: 'Checked In' | 'Complete' | 'Late' | 'Flagged' | 'Manual';
  include: boolean;
}

export interface IssuedCertificateRecord {
  id: string;
  eventId: string;
  eventTitle: string;
  templateId: string;
  templateName: string;
  recipientName: string;
  studentId: string;
  course: string;
  issuedAt: Timestamp;
  issuedBy: string;
}

// Report export alias
export type CertificateDocument = IssuedCertificateRecord;
