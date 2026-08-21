import { Timestamp } from 'firebase/firestore';

export type AuditActionType =
  | 'Event Actions'
  | 'Financial Actions'
  | 'Account Actions'
  | 'Academic Actions'
  | 'Organization Actions'
  | 'Document Actions'
  | 'System Actions';

export interface AuditLogDocument {
  id: string;
  action: string;
  actionType: AuditActionType;
  details: string;
  performedBy: string;
  userRole?: string;
  userEmail?: string;
  targetId?: string;
  targetName?: string;
  academicLevel?: 'COLLEGE' | 'SHS' | 'CAMPUS';
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  timestamp: Timestamp;
  createdAt: Timestamp;
}
