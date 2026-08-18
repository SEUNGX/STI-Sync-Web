import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { SaoLedgerDocument, OrgLedgerDocument } from '../types/finance.types';

export const SAO_LEDGER_COLLECTION = 'sao_ledger';
export const ORG_LEDGER_COLLECTION = 'organization_ledger';

/**
 * Adds a new transaction to the SAO school budget ledger.
 */
export async function addLedgerTransaction(data: Omit<SaoLedgerDocument, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'sao_ledger'), {
    ...data,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * Adds a new transaction to a specific organization's budget ledger.
 */
export async function addOrgLedgerTransaction(data: Omit<OrgLedgerDocument, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'organization_ledger'), {
    ...data,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * Deducts the approved event budget from the appropriate ledger:
 * - Admin / Institutional Event -> Deduct from /sao_ledger (SAO Institutional Budget)
 * - Officer / Club Event -> Deduct from /organization_ledger (Club Treasury)
 * 
 * Includes duplicate protection (checks if event_budget deduction already exists for this eventId).
 */
export async function deductApprovedEventBudget(
  eventData: any,
  eventId: string,
  adminUserId?: string
): Promise<string | null> {
  const budgetAmount = Number(eventData.totalApprovedBudget || eventData.allocatedBudget) || 0;
  if (budgetAmount <= 0) return null;

  const isSasAdminEvent =
    !eventData.hostingOrgId ||
    eventData.hostingOrgId === 'sas_admin' ||
    eventData.hostingOrgId === 'sas' ||
    eventData.hostingOrgId === 'sao_admin' ||
    eventData.hostingOrgId === 'sao' ||
    eventData.isOfficerProposal === false;

  const eventTitle = eventData.title || eventData.name || 'Approved Event';
  const semesterId = eventData.semesterId || null;

  if (isSasAdminEvent) {
    // 1. Check if deduction for this eventId already exists in sao_ledger
    const saoLedgerRef = collection(db, 'sao_ledger');
    const qDup = query(
      saoLedgerRef,
      where('eventId', '==', eventId),
      where('source', '==', 'event_budget')
    );
    const existingSnap = await getDocs(qDup);
    if (!existingSnap.empty) {
      console.log(`[deductApprovedEventBudget] Budget for SAO event ${eventId} already deducted. Skipping duplicate.`);
      return existingSnap.docs[0].id;
    }

    const docRef = await addDoc(saoLedgerRef, {
      semesterId,
      date: Timestamp.now(),
      description: `Approved Event Budget – ${eventTitle}`,
      eventId,
      type: 'expense' as const,
      source: 'event_budget' as const,
      amount: budgetAmount,
      addedBy: adminUserId || 'SAO Approval',
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } else {
    // 2. Check if deduction for this eventId already exists in organization_ledger
    const orgLedgerRef = collection(db, 'organization_ledger');
    const qDup = query(
      orgLedgerRef,
      where('eventId', '==', eventId),
      where('source', '==', 'event_budget')
    );
    const existingSnap = await getDocs(qDup);
    if (!existingSnap.empty) {
      console.log(`[deductApprovedEventBudget] Budget for Org event ${eventId} already deducted. Skipping duplicate.`);
      return existingSnap.docs[0].id;
    }

    const docRef = await addDoc(orgLedgerRef, {
      organizationId: eventData.hostingOrgId,
      semesterId,
      date: Timestamp.now(),
      description: `Approved Event Budget – ${eventTitle}`,
      eventId,
      type: 'expense' as const,
      source: 'event_budget' as const,
      amount: budgetAmount,
      addedBy: adminUserId || 'SAO Approval',
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }
}
