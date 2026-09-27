/**
 * src/app/modules/events/services/event-lifecycle.service.ts
 *
 * Handles advanced operational lifecycle workflows for events:
 * 1. Concluding / Marking Completed (Locks attendance scanners & gate check-ins)
 * 2. Pre-archive readiness validation (Liquidation, Student Payables, Attendance)
 * 3. Archiving events (Seals historical records, preserves student dues)
 * 4. Soft-deleting archived events (Safe trash with 30-day restore guarantee)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';

import { db } from '../../../../services/firebase';
import { EVENTS_COLLECTION } from './event.service';
import { LIQUIDATIONS_COLLECTION } from '../../finance/services/liquidation.service';
import { PAYABLES_COLLECTION } from '../../finance/services/payable.service';
import { logAuditEvent } from '../../audit/services/audit.service';
import type { EventDocument, EventProposalHistoryLog } from '../types/event.types';
import { getEventTimingStatus } from '../utils/event-lifecycle.utils';

export interface EventArchiveReadinessSummary {
  eventTitle: string;
  isCompleted: boolean;
  liquidationStatus: 'approved' | 'pending' | 'none_required';
  unapprovedLiquidationsCount: number;
  totalLiquidationsCount: number;
  pendingRefundsCount: number;
  paidPayablesCount: number;
  unpaidPayablesCount: number;
  unpaidPayablesSum: number;
  attendanceCount: number;
  canArchive: boolean;
  blockingReasons: string[];
  warnings: string[];
}

export interface ArchiveEventOptions {
  reason: string;
  waiveUnpaidPayables?: boolean;
}

/**
 * Marks an event as officially Concluded / Completed.
 * Locks the live attendance scanner to prevent late/fraudulent check-ins.
 */
export async function concludeEvent(
  eventId: string,
  adminUid: string,
  adminName?: string,
  note?: string
): Promise<void> {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId);
  const snap = await getDoc(eventRef);

  if (!snap.exists()) {
    throw new Error('Event not found.');
  }

  const eventData = snap.data() as EventDocument;

  if (eventData.isArchived) {
    throw new Error('Archived events cannot be modified.');
  }

  const historyEntry: EventProposalHistoryLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    action: 'completed',
    performedBy: adminUid,
    performedByName: adminName || 'Administrator',
    performedAt: new Date(),
    reason: note || 'All sessions concluded. Event officially closed.',
  };

  await updateDoc(eventRef, {
    status: 'completed',
    proposalStatus: 'completed',
    completedAt: serverTimestamp(),
    completedBy: adminUid,
    completedByName: adminName || 'Administrator',
    attendanceLocked: true,
    updatedAt: serverTimestamp(),
    proposalHistory: arrayUnion(historyEntry),
  });

  try {
    await logAuditEvent({
      action: 'CONCLUDE_EVENT',
      actionType: 'UPDATE',
      details: `Event "${eventData.title || eventId}" was marked as completed and attendance scanner locked by ${adminName || 'Admin'}.`,
      performedBy: adminName || 'Admin',
      userRole: 'SAO Admin',
      targetId: eventId,
      targetName: eventData.title || 'Event',
    });
  } catch (auditErr) {
    console.warn('[concludeEvent] Non-critical audit log failure:', auditErr);
  }
}

/**
 * Validates whether an event satisfies all prerequisites to be safely archived.
 * Checks financial liquidation, pending student refunds, unpaid payables, and attendance.
 */
export async function checkEventArchiveReadiness(
  eventId: string
): Promise<EventArchiveReadinessSummary> {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId);
  const snap = await getDoc(eventRef);

  if (!snap.exists()) {
    throw new Error('Event not found.');
  }

  const eventData = snap.data() as EventDocument;
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  const isCompleted =
    eventData.status === 'completed' ||
    eventData.proposalStatus === 'completed' ||
    getEventTimingStatus(eventData) === 'completed';

  if (!isCompleted) {
    blockingReasons.push(
      'Event has not concluded yet. It must be completed before it can be archived.'
    );
  }

  // 1. Check Liquidations
  let liquidationStatus: 'approved' | 'pending' | 'none_required' = 'none_required';
  let unapprovedLiqs = 0;
  let totalLiqs = 0;

  try {
    const liqQ = query(
      collection(db, LIQUIDATIONS_COLLECTION),
      where('eventId', '==', eventId)
    );
    const liqSnap = await getDocs(liqQ);
    totalLiqs = liqSnap.docs.length;

    const activeLiqs = liqSnap.docs.map((d) => d.data());
    const unapproved = activeLiqs.filter(
      (l: any) =>
        l.status !== 'approved' &&
        l.status !== 'settled' &&
        l.status !== 'voided' &&
        l.status !== 'cancelled'
    );

    unapprovedLiqs = unapproved.length;

    const hasBudget =
      Number(eventData.totalApprovedBudget || 0) > 0 ||
      (eventData.budgetItems && eventData.budgetItems.length > 0);

    if (totalLiqs > 0 || hasBudget) {
      if (unapprovedLiqs > 0) {
        liquidationStatus = 'pending';
        blockingReasons.push(
          `Event has ${unapprovedLiqs} unapproved financial liquidation record(s). Liquidation must be reviewed and approved by SAO before archiving.`
        );
      } else {
        liquidationStatus = 'approved';
      }
    }
  } catch (err) {
    console.warn('[checkEventArchiveReadiness] Liquidation check failure:', err);
  }

  // 2. Check Student Payables
  let pendingRefunds = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let unpaidSum = 0;

  try {
    const payablesQ = query(
      collection(db, PAYABLES_COLLECTION),
      where('eventId', '==', eventId)
    );
    const payablesSnap = await getDocs(payablesQ);

    payablesSnap.docs.forEach((docItem) => {
      const p = docItem.data();
      if (p.status === 'refund_pending') {
        pendingRefunds++;
      } else if (p.status === 'paid') {
        paidCount++;
      } else if (p.status === 'unpaid' || p.status === 'pending') {
        unpaidCount++;
        unpaidSum += Number(p.assignedAmount || p.amount || 0);
      }
    });

    if (pendingRefunds > 0) {
      blockingReasons.push(
        `There are ${pendingRefunds} refund requests pending for this event. Disburse or cancel them before archiving.`
      );
    }

    if (unpaidCount > 0) {
      warnings.push(
        `${unpaidCount} student(s) still owe fees (₱${unpaidSum.toLocaleString()}). These dues will remain active on their student clearance ledgers.`
      );
    }
  } catch (err) {
    console.warn('[checkEventArchiveReadiness] Payables check failure:', err);
  }

  // 3. Attendance Log Count
  let attendanceCount = 0;
  try {
    const attSnap = await getDocs(
      collection(db, EVENTS_COLLECTION, eventId, 'attendance_logs')
    );
    attendanceCount = attSnap.docs.length;
  } catch (err) {
    console.warn('[checkEventArchiveReadiness] Attendance count failure:', err);
  }

  const canArchive = blockingReasons.length === 0;

  return {
    eventTitle: eventData.title || 'Untitled Event',
    isCompleted,
    liquidationStatus,
    unapprovedLiquidationsCount: unapprovedLiqs,
    totalLiquidationsCount: totalLiqs,
    pendingRefundsCount: pendingRefunds,
    paidPayablesCount: paidCount,
    unpaidPayablesCount: unpaidCount,
    unpaidPayablesSum: unpaidSum,
    attendanceCount,
    canArchive,
    blockingReasons,
    warnings,
  };
}

/**
 * Seals and archives an event.
 * Keeps student receivables intact unless waiveUnpaidPayables is chosen.
 */
export async function archiveEvent(
  eventId: string,
  adminUid: string,
  adminName?: string,
  options: ArchiveEventOptions = { reason: 'Event Concluded & Sealed' }
): Promise<void> {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId);
  const snap = await getDoc(eventRef);

  if (!snap.exists()) {
    throw new Error('Event not found.');
  }

  const eventData = snap.data() as EventDocument;

  // If user requested to waive remaining unpaid payables
  if (options.waiveUnpaidPayables) {
    try {
      const unpaidQ = query(
        collection(db, PAYABLES_COLLECTION),
        where('eventId', '==', eventId),
        where('status', '==', 'unpaid')
      );
      const unpaidSnap = await getDocs(unpaidQ);

      if (!unpaidSnap.empty) {
        const batch = writeBatch(db);
        unpaidSnap.docs.forEach((docSnap) => {
          batch.update(docSnap.ref, {
            status: 'waived',
            waivedAt: serverTimestamp(),
            waivedBy: adminUid,
            waivedByName: adminName || 'Admin',
            waivedReason: `Event Archived: ${options.reason}`,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
    } catch (waiveErr) {
      console.warn('[archiveEvent] Error waiving unpaid payables:', waiveErr);
    }
  }

  const historyEntry: EventProposalHistoryLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    action: 'archived',
    performedBy: adminUid,
    performedByName: adminName || 'Administrator',
    performedAt: new Date(),
    reason: options.reason,
  };

  await updateDoc(eventRef, {
    isArchived: true,
    archivedAt: serverTimestamp(),
    archivedBy: adminUid,
    archivedByName: adminName || 'Administrator',
    archivedReason: options.reason,
    status: 'completed',
    proposalStatus: 'completed',
    attendanceLocked: true,
    updatedAt: serverTimestamp(),
    proposalHistory: arrayUnion(historyEntry),
  });

  try {
    await logAuditEvent({
      action: 'ARCHIVE_EVENT',
      actionType: 'UPDATE',
      details: `Event "${eventData.title || eventId}" was archived by ${adminName || 'Admin'}. Reason: ${options.reason}`,
      performedBy: adminName || 'Admin',
      userRole: 'SAO Admin',
      targetId: eventId,
      targetName: eventData.title || 'Event',
    });
  } catch (auditErr) {
    console.warn('[archiveEvent] Non-critical audit log failure:', auditErr);
  }
}

/**
 * Soft-deletes an already archived event.
 * Moves to Archive Center Trash with 30-day recovery.
 */
export async function softDeleteArchivedEvent(
  eventId: string,
  adminUid: string,
  adminName?: string,
  reason?: string
): Promise<void> {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId);
  const snap = await getDoc(eventRef);

  if (!snap.exists()) {
    throw new Error('Event not found.');
  }

  const eventData = snap.data() as EventDocument;

  if (!eventData.isArchived) {
    throw new Error('Only archived events can be deleted. Please archive the event first.');
  }

  const historyEntry: EventProposalHistoryLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    action: 'deleted',
    performedBy: adminUid,
    performedByName: adminName || 'Administrator',
    performedAt: new Date(),
    reason: reason || 'Archived event sent to Archive Center Trash.',
  };

  await updateDoc(eventRef, {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: adminUid,
    deletedByName: adminName || 'Administrator',
    deleteReason: reason || 'Soft-deleted from archive.',
    updatedAt: serverTimestamp(),
    proposalHistory: arrayUnion(historyEntry),
  });

  try {
    await logAuditEvent({
      action: 'DELETE_EVENT',
      actionType: 'DELETE',
      details: `Archived event "${eventData.title || eventId}" was moved to trash by ${adminName || 'Admin'}. Reason: ${reason || 'Soft-delete'}`,
      performedBy: adminName || 'Admin',
      userRole: 'SAO Admin',
      targetId: eventId,
      targetName: eventData.title || 'Event',
    });
  } catch (auditErr) {
    console.warn('[softDeleteArchivedEvent] Non-critical audit log failure:', auditErr);
  }
}
