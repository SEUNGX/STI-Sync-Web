import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { AuditLogDocument, AuditActionType } from '../types/audit.types';

export const AUDIT_LOGS_COLLECTION = 'audit_logs';

/**
 * Records an audit log entry in Firestore.
 */
export async function logAuditEvent(params: {
  action: string;
  actionType: AuditActionType;
  details: string;
  performedBy?: string;
  userRole?: string;
  userEmail?: string;
  targetId?: string;
  targetName?: string;
  academicLevel?: 'COLLEGE' | 'SHS' | 'CAMPUS';
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<string> {
  try {
    const colRef = collection(db, AUDIT_LOGS_COLLECTION);
    const newDoc = doc(colRef);
    const now = Timestamp.now();

    const auditEntry: AuditLogDocument = {
      id: newDoc.id,
      action: params.action,
      actionType: params.actionType,
      details: params.details,
      performedBy: params.performedBy || 'System Administrator',
      userRole: params.userRole || 'SAO Admin',
      userEmail: params.userEmail,
      targetId: params.targetId,
      targetName: params.targetName,
      academicLevel: params.academicLevel || 'CAMPUS',
      metadata: params.metadata,
      ipAddress: params.ipAddress || '127.0.0.1',
      timestamp: now,
      createdAt: now,
    };

    await setDoc(newDoc, auditEntry);
    return newDoc.id;
  } catch (err) {
    console.warn('[logAuditEvent] Failed to write audit log:', err);
    return '';
  }
}

/**
 * Fetches recent audit logs.
 */
export async function getRecentAuditLogs(maxEntries = 200): Promise<AuditLogDocument[]> {
  try {
    const q = query(
      collection(db, AUDIT_LOGS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(maxEntries)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AuditLogDocument);
  } catch (err) {
    console.error('[getRecentAuditLogs] Error fetching audit logs:', err);
    return [];
  }
}
