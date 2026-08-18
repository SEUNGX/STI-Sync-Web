import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { LiquidationDocument, LiquidationRemark } from '../types/liquidation.types';

export const LIQUIDATIONS_COLLECTION = 'liquidations';

/**
 * Creates a new Liquidation Report document in Firestore.
 * Auto-approves and posts to ledger if created by SAO Admin.
 */
export const createLiquidationReport = async (
  data: Omit<LiquidationDocument, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const lineItems = data.lineItems || [];
  const totalActualSpending = lineItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);
  const surplusOrDeficit = (data.allocatedBudget || 0) - totalActualSpending;

  const isAdmin = data.createdByRole === 'admin';
  const initialStatus = isAdmin ? 'approved' : (data.status || 'draft');

  const initialRemark: LiquidationRemark = {
    id: `rem-${Date.now()}`,
    authorName: data.createdByName || (isAdmin ? 'SAO Adviser' : 'Officer'),
    authorRole: data.createdByRole || 'officer',
    action: isAdmin ? 'approved' : (data.status === 'pending' ? 'submitted' : 'draft_saved'),
    comment: isAdmin
      ? 'Liquidation created and auto-approved by SAO Adviser.'
      : (data.status === 'pending' ? 'Liquidation report submitted for SAO Adviser review.' : 'Draft liquidation created.'),
    timestamp: new Date().toISOString(),
  };

  const payload: Partial<LiquidationDocument> = {
    ...data,
    totalActualSpending,
    surplusOrDeficit,
    status: initialStatus,
    remarksHistory: [initialRemark],
    ...(isAdmin ? { approvedAt: serverTimestamp() as any, approvedBy: data.createdById } : {}),
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  };

  const docRef = await addDoc(collection(db, LIQUIDATIONS_COLLECTION), payload);

  // If Admin created, auto-post to SAO Ledger
  if (isAdmin) {
    try {
      await postLiquidationToLedger(docRef.id, payload as Partial<LiquidationDocument>, data.createdById);
    } catch (err) {
      console.warn('[createLiquidationReport] Ledger write note:', err);
    }
  }

  return docRef.id;
};

/**
 * Updates an existing Liquidation Report. Recalculates total spending and surplus/deficit.
 */
export const updateLiquidationReport = async (
  id: string,
  data: Partial<LiquidationDocument>
): Promise<void> => {
  const docRef = doc(db, LIQUIDATIONS_COLLECTION, id);

  const payload: any = {
    ...data,
    updatedAt: serverTimestamp(),
  };

  if (data.lineItems !== undefined || data.allocatedBudget !== undefined) {
    const lineItems = data.lineItems || [];
    const totalActualSpending = lineItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    payload.totalActualSpending = totalActualSpending;

    if (data.allocatedBudget !== undefined) {
      payload.surplusOrDeficit = data.allocatedBudget - totalActualSpending;
    }
  }

  await updateDoc(docRef, payload);
};

/**
 * Changes status of a liquidation report to 'pending' (Submitted) and logs remark.
 */
export const submitLiquidationReport = async (
  id: string, 
  authorName?: string,
  commentText?: string
): Promise<void> => {
  const docRef = doc(db, LIQUIDATIONS_COLLECTION, id);

  const newRemark: LiquidationRemark = {
    id: `rem-${Date.now()}`,
    authorName: authorName || 'Officer',
    authorRole: 'officer',
    action: 'submitted',
    comment: commentText || 'Resubmitted liquidation report with updated line items and receipt evidence.',
    timestamp: new Date().toISOString(),
  };

  await updateDoc(docRef, {
    status: 'pending',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    remarksHistory: arrayUnion(newRemark),
  });
};

/**
 * Approves a liquidation report.
 * Updates status to 'approved' and posts financial surplus/deficit to the appropriate ledger.
 */
export const approveLiquidationReport = async (
  id: string,
  adminUserId: string,
  remarks?: string,
  liquidationData?: Partial<LiquidationDocument>
): Promise<void> => {
  const docRef = doc(db, LIQUIDATIONS_COLLECTION, id);
  
  const approvalRemark: LiquidationRemark = {
    id: `rem-${Date.now()}`,
    authorName: 'SAO Adviser',
    authorRole: 'admin',
    action: 'approved',
    comment: remarks || 'Liquidation report approved. Financial ledger updated.',
    timestamp: new Date().toISOString(),
  };

  await updateDoc(docRef, {
    status: 'approved',
    approvedBy: adminUserId,
    approvedAt: serverTimestamp(),
    returnRemarks: remarks || null,
    updatedAt: serverTimestamp(),
    remarksHistory: arrayUnion(approvalRemark),
  });

  // Post entry to appropriate ledger (SAO or Club Treasury)
  try {
    await postLiquidationToLedger(id, liquidationData, adminUserId);
  } catch (err) {
    console.warn('[approveLiquidationReport] Ledger write note:', err);
  }
};

/**
 * Returns a liquidation report to the officer with revision remarks.
 */
export const returnLiquidationReport = async (
  id: string,
  adminUserId: string,
  remarks: string
): Promise<void> => {
  const docRef = doc(db, LIQUIDATIONS_COLLECTION, id);

  const returnRemark: LiquidationRemark = {
    id: `rem-${Date.now()}`,
    authorName: 'SAO Adviser',
    authorRole: 'admin',
    action: 'returned',
    comment: remarks,
    timestamp: new Date().toISOString(),
  };

  await updateDoc(docRef, {
    status: 'returned',
    returnRemarks: remarks,
    returnedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    remarksHistory: arrayUnion(returnRemark),
  });
};

/**
 * Helper to post liquidation financial entry (surplus refund or deficit expense) to the correct ledger:
 * - Admin/Institutional Liquidation -> /sao_ledger
 * - Officer/Organization Liquidation -> /organization_ledger
 */
async function postLiquidationToLedger(
  liquidationId: string, 
  data?: Partial<LiquidationDocument>, 
  adminUserId?: string
) {
  const netAmount = data?.surplusOrDeficit ?? ((data?.allocatedBudget ?? 0) - (data?.totalActualSpending ?? 0));
  if (netAmount === 0) return;

  const isSurplus = netAmount > 0;
  const absAmount = Math.abs(netAmount);
  const eventTitle = data?.eventTitle || 'Event Liquidation';
  const semesterId = data?.semesterId || null;
  const eventId = data?.eventId || null;

  const isClubLiquidation = Boolean(
    data?.organizationId &&
    data.organizationId !== 'sas' &&
    data.organizationId !== 'sas_admin' &&
    data.createdByRole !== 'admin'
  );

  const description = isSurplus
    ? `Liquidation Surplus Returned – ${eventTitle}`
    : `Liquidation Deficit / Overspend – ${eventTitle}`;

  if (isClubLiquidation) {
    const orgLedgerRef = collection(db, 'organization_ledger');
    // Check if this liquidation has already been posted to avoid duplicate transactions
    const qDup = query(orgLedgerRef, where('collectionId', '==', liquidationId));
    const existingSnap = await getDocs(qDup);
    if (!existingSnap.empty) {
      console.log(`[postLiquidationToLedger] Liquidation ${liquidationId} already posted to organization_ledger.`);
      return;
    }

    await addDoc(orgLedgerRef, {
      organizationId: data!.organizationId,
      semesterId,
      date: Timestamp.now(),
      description,
      eventId,
      type: isSurplus ? 'income' : 'expense',
      source: isSurplus ? 'liquidation_surplus' : 'liquidation_deficit',
      amount: absAmount,
      addedBy: adminUserId || 'SAO Adviser',
      collectionId: liquidationId,
      createdAt: serverTimestamp(),
    });
  } else {
    const saoLedgerRef = collection(db, 'sao_ledger');
    // Check if this liquidation has already been posted to avoid duplicate transactions
    const qDup = query(saoLedgerRef, where('collectionId', '==', liquidationId));
    const existingSnap = await getDocs(qDup);
    if (!existingSnap.empty) {
      console.log(`[postLiquidationToLedger] Liquidation ${liquidationId} already posted to sao_ledger.`);
      return;
    }

    await addDoc(saoLedgerRef, {
      semesterId,
      date: Timestamp.now(),
      description,
      eventId,
      type: isSurplus ? 'income' : 'expense',
      source: isSurplus ? 'liquidation_surplus' : 'liquidation_deficit',
      amount: absAmount,
      addedBy: adminUserId || 'SAO Adviser',
      collectionId: liquidationId,
      createdAt: serverTimestamp(),
    });
  }
}
