import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  arrayUnion
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
      await postToSaoLedger(docRef.id, payload as Partial<LiquidationDocument>, data.createdById);
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
 * Updates status to 'approved' and posts a financial entry to the /sao_ledger collection.
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

  // Post entry to SAO Ledger for financial tracking
  try {
    await postToSaoLedger(id, liquidationData, adminUserId);
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
 * Helper to post financial entry to /sao_ledger
 */
async function postToSaoLedger(
  liquidationId: string, 
  data?: Partial<LiquidationDocument>, 
  adminUserId?: string
) {
  const ledgerRef = collection(db, 'sao_ledger');
  const netAmount = data?.surplusOrDeficit ?? 0;
  const isSurplus = netAmount >= 0;

  await addDoc(ledgerRef, {
    referenceId: `LIQ-${liquidationId.slice(0, 8).toUpperCase()}`,
    eventId: data?.eventId || '',
    eventTitle: data?.eventTitle || 'Event Liquidation',
    organizationId: data?.organizationId || '',
    type: isSurplus ? 'REFUND_SURPLUS' : 'DEFICIT_EXPENSE',
    amount: Math.abs(netAmount),
    description: isSurplus
      ? `Liquidation surplus returned for ${data?.eventTitle || 'event'}`
      : `Liquidation deficit for ${data?.eventTitle || 'event'}`,
    approvedBy: adminUserId || 'sao_admin',
    createdAt: serverTimestamp(),
    date: new Date().toISOString().split('T')[0],
  });
}
