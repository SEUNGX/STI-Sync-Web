import { Timestamp } from 'firebase/firestore';

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

export interface CertificateTemplate {
  id: string;
  name: string;
  imageUrl: string;
  isDefault: boolean;
  namePosition: CertificatePosition;
  createdBy: string;
  organizationId?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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
