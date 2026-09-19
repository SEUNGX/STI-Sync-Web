import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Helper mock of lifecycle rules to verify domain logic independently
function canCancelEvent(event, userRole, userOrgId) {
  if (!event) {
    return { canCancel: false, reason: 'No event specified.' };
  }
  if (event.isArchived) {
    return { canCancel: false, reason: 'Archived events cannot be cancelled.' };
  }
  if (event.status === 'cancelled' || event.proposalStatus === 'cancelled') {
    return { canCancel: false, reason: 'This event is already cancelled.' };
  }
  if (event.status === 'completed' || event.proposalStatus === 'completed') {
    return { canCancel: false, reason: 'Completed events cannot be cancelled. Initiate liquidation or archival instead.' };
  }
  if (event.status === 'ongoing') {
    return { canCancel: false, reason: 'Ongoing events cannot be cancelled while live in session. Only upcoming events can be cancelled.' };
  }
  if (userRole === 'officer') {
    if (event.hostingOrgId === 'sas') {
      return { canCancel: false, reason: 'Institutional SAO events can only be cancelled by SAO administration.' };
    }
    if (userOrgId && event.hostingOrgId && event.hostingOrgId !== userOrgId) {
      return { canCancel: false, reason: "Officers can only cancel their own organization's events." };
    }
    return { canCancel: true };
  }
  if (userRole === 'admin') {
    const status = (event.proposalStatus || event.status || '').toLowerCase();
    if (status === 'pending' || status === 'pending_review' || status === 'draft') {
      return {
        canCancel: false,
        reason: 'Pending proposals cannot be cancelled by Admin. Use the Review modal to Approve, Return, or Reject the proposal.',
      };
    }
    const isInstitutional =
      !event.hostingOrgId ||
      event.hostingOrgId === 'sas' ||
      event.hostingOrgId === 'sao' ||
      event.hostingOrgId === 'sas_admin' ||
      event.hostingOrgId === 'sao_admin' ||
      event.isOfficerProposal === false ||
      event.isInstitutional === true;

    if (!isInstitutional) {
      return {
        canCancel: false,
        reason: 'Admins cannot cancel student organization events. Only institutional, school, or SAS events can be cancelled by SAO administration.',
      };
    }
    return { canCancel: true };
  }
  return { canCancel: false, reason: 'Unauthorized role.' };
}

function processCancellationWaiver(event, payables, liquidations, payload) {
  const { cancellationReason, refundPolicy, cancelledBy, cancelledByName, cancelledByRole } = payload;
  const actorName = cancelledByName || (cancelledByRole === 'admin' ? 'SAO Admin' : 'Officer');

  let waivedCount = 0;
  let refundPendingCount = 0;
  const updatedPayables = payables.map(payable => {
    const paidAmt = Number(payable.paidAmount || 0);
    const isPaid = payable.status === 'paid' || paidAmt > 0;
    const isAlreadyClosed = payable.status === 'waived' || payable.status === 'refunded';

    if (isAlreadyClosed) {
      return { ...payable, qrTicketUnlocked: false };
    }

    if (isPaid) {
      refundPendingCount++;
      return {
        ...payable,
        status: 'refund_pending',
        refundDue: paidAmt > 0 ? paidAmt : Number(payable.assignedAmount || 0),
        refundReason: `Event Cancelled: ${cancellationReason}`,
        refundMethod: refundPolicy,
        qrTicketUnlocked: false,
      };
    } else {
      waivedCount++;
      return {
        ...payable,
        status: 'waived',
        waivedReason: `Event Cancelled: ${cancellationReason}`,
        waivedAt: '2026-09-18T12:00:00.000Z',
        waivedBy: cancelledBy,
        waivedByName: actorName,
        qrTicketUnlocked: false,
      };
    }
  });

  let voidedLiquidationsCount = 0;
  const updatedLiquidations = liquidations.map(liq => {
    if (liq.status !== 'voided') {
      voidedLiquidationsCount++;
      return {
        ...liq,
        status: 'voided',
        voidedReason: `Parent event was cancelled: ${cancellationReason}`,
        voidedAt: '2026-09-18T12:00:00.000Z',
        voidedBy: cancelledBy,
        remarksHistory: [
          ...(liq.remarksHistory || []),
          {
            authorName: actorName,
            authorRole: cancelledByRole,
            action: 'voided',
            comment: `Liquidation voided: Parent event was cancelled (${cancellationReason}).`,
          }
        ]
      };
    }
    return liq;
  });

  const updatedEvent = {
    ...event,
    status: 'cancelled',
    proposalStatus: 'cancelled',
    cancellationReason,
    cancelledBy,
    cancelledByName: actorName,
    cancelledByRole,
    cancellationRefundPolicy: refundPolicy,
    refundStatus: refundPolicy === 'no_fees_collected' ? 'none' : 'pending',
    enableQRTickets: false,
    scannerActivationCode: '',
  };

  return {
    updatedEvent,
    updatedPayables,
    updatedLiquidations,
    waivedCount,
    refundPendingCount,
    voidedLiquidationsCount,
  };
}

describe('Phase 3: Event Cancellation & Financial Auto-Waiver Engine', () => {

  describe('1. Permission & Authority Gates (canCancelEvent)', () => {
    test('SAO Admin can cancel upcoming approved institutional/SAS/school events', () => {
      const sasEvent = { id: 'evt-1', status: 'approved', proposalStatus: 'approved', hostingOrgId: 'sas' };
      const schoolEvent = { id: 'evt-1b', status: 'approved', proposalStatus: 'approved', hostingOrgId: undefined };
      assert.equal(canCancelEvent(sasEvent, 'admin').canCancel, true);
      assert.equal(canCancelEvent(schoolEvent, 'admin').canCancel, true);
    });

    test('SAO Admin CANNOT cancel student organization events', () => {
      const orgEvent = { id: 'evt-org', status: 'approved', proposalStatus: 'approved', hostingOrgId: 'org-cs' };
      const res = canCancelEvent(orgEvent, 'admin');
      assert.equal(res.canCancel, false);
      assert.match(res.reason, /student organization/i);
    });

    test('SAO Admin CANNOT cancel pending proposals (must use Review modal instead)', () => {
      const pendingEvent = { id: 'evt-p1', status: 'pending', proposalStatus: 'pending', hostingOrgId: 'org-cs' };
      const pendingReviewEvent = { id: 'evt-p2', status: 'pending', proposalStatus: 'pending_review', hostingOrgId: 'org-cs' };
      
      const res1 = canCancelEvent(pendingEvent, 'admin');
      assert.equal(res1.canCancel, false);
      assert.match(res1.reason, /Review modal/i);

      const res2 = canCancelEvent(pendingReviewEvent, 'admin');
      assert.equal(res2.canCancel, false);
      assert.match(res2.reason, /Review modal/i);
    });

    test('Officer can cancel their own pending/approved proposal', () => {
      const event = { id: 'evt-2', status: 'approved', hostingOrgId: 'org-cs' };
      const res = canCancelEvent(event, 'officer', 'org-cs');
      assert.equal(res.canCancel, true);
    });

    test('Officer cannot cancel an event belonging to another organization', () => {
      const event = { id: 'evt-3', status: 'approved', hostingOrgId: 'org-jpcs' };
      const res = canCancelEvent(event, 'officer', 'org-cs');
      assert.equal(res.canCancel, false);
      assert.match(res.reason, /own organization/i);
    });

    test('Neither Admin nor Officer can cancel an ongoing event', () => {
      const event = { id: 'evt-4', status: 'ongoing', hostingOrgId: 'org-cs' };
      const resOfficer = canCancelEvent(event, 'officer', 'org-cs');
      assert.equal(resOfficer.canCancel, false);
      assert.match(resOfficer.reason, /ongoing/i);

      const resAdmin = canCancelEvent(event, 'admin');
      assert.equal(resAdmin.canCancel, false);
      assert.match(resAdmin.reason, /ongoing/i);
    });

    test('Neither Admin nor Officer can cancel an already completed event', () => {
      const event = { id: 'evt-5', status: 'completed', hostingOrgId: 'org-cs' };
      assert.equal(canCancelEvent(event, 'admin').canCancel, false);
      assert.equal(canCancelEvent(event, 'officer', 'org-cs').canCancel, false);
    });

    test('Cannot cancel an already cancelled event', () => {
      const event = { id: 'evt-6', status: 'cancelled', hostingOrgId: 'org-cs' };
      const res = canCancelEvent(event, 'admin');
      assert.equal(res.canCancel, false);
      assert.match(res.reason, /already cancelled/i);
    });
  });

  describe('2. Payables Financial Auto-Waiver', () => {
    test('Unpaid event payables and fines are automatically waived with zero leftover pending liabilities', () => {
      const event = { id: 'evt-100', title: 'Tech Summit 2026', status: 'approved' };
      const payables = [
        { id: 'p1', eventId: 'evt-100', status: 'pending', assignedAmount: 150, paidAmount: 0, qrTicketUnlocked: true },
        { id: 'p2', eventId: 'evt-100', status: 'overdue', assignedAmount: 150, paidAmount: 0, qrTicketUnlocked: false },
        { id: 'p3', eventId: 'evt-100', status: 'pending', assignedAmount: 200, paidAmount: 0, qrTicketUnlocked: true },
      ];

      const result = processCancellationWaiver(event, payables, [], {
        eventId: 'evt-100',
        cancelledBy: 'admin-1',
        cancelledByName: 'SAO Adviser',
        cancelledByRole: 'admin',
        cancellationReason: 'Typhoon Signal No. 3 Campus Closure',
        refundPolicy: 'no_fees_collected',
      });

      assert.equal(result.waivedCount, 3);
      assert.equal(result.refundPendingCount, 0);

      // Verify each payable status is 'waived'
      result.updatedPayables.forEach(p => {
        assert.equal(p.status, 'waived');
        assert.equal(p.qrTicketUnlocked, false);
        assert.match(p.waivedReason, /Typhoon Signal No. 3/);
      });

      // Assert zero leftover active/pending liabilities
      const activeLiabilities = result.updatedPayables.filter(p => p.status === 'pending' || p.status === 'overdue');
      assert.equal(activeLiabilities.length, 0);
    });

    test('Collected payments are flagged for refund without dangling balances', () => {
      const event = { id: 'evt-101', title: 'Leadership Bootcamp', status: 'approved' };
      const payables = [
        { id: 'p4', eventId: 'evt-101', status: 'paid', assignedAmount: 300, paidAmount: 300, qrTicketUnlocked: true },
        { id: 'p5', eventId: 'evt-101', status: 'pending', assignedAmount: 300, paidAmount: 0, qrTicketUnlocked: true },
      ];

      const result = processCancellationWaiver(event, payables, [], {
        eventId: 'evt-101',
        cancelledBy: 'admin-1',
        cancelledByName: 'SAO Adviser',
        cancelledByRole: 'admin',
        cancellationReason: 'Guest speaker medical emergency',
        refundPolicy: 'refund_cash',
      });

      assert.equal(result.waivedCount, 1);
      assert.equal(result.refundPendingCount, 1);

      const paidRecord = result.updatedPayables.find(p => p.id === 'p4');
      assert.equal(paidRecord.status, 'refund_pending');
      assert.equal(paidRecord.refundDue, 300);
      assert.equal(paidRecord.refundMethod, 'refund_cash');
      assert.equal(paidRecord.qrTicketUnlocked, false);
    });
  });

  describe('3. Ticket & Scanner Pass Invalidation', () => {
    test('Gate passes are revoked and scanner activation code is purged', () => {
      const event = {
        id: 'evt-102',
        title: 'Campus Esports Clash',
        status: 'approved',
        enableQRTickets: true,
        scannerActivationCode: '948271',
      };
      const payables = [
        { id: 'p6', eventId: 'evt-102', status: 'paid', paidAmount: 100, qrTicketUnlocked: true },
      ];

      const result = processCancellationWaiver(event, payables, [], {
        eventId: 'evt-102',
        cancelledBy: 'officer-1',
        cancelledByName: 'Club President',
        cancelledByRole: 'officer',
        cancellationReason: 'Network infrastructure maintenance conflict',
        refundPolicy: 'credit_next_event',
      });

      assert.equal(result.updatedEvent.enableQRTickets, false);
      assert.equal(result.updatedEvent.scannerActivationCode, '');
      assert.equal(result.updatedEvent.status, 'cancelled');
      assert.equal(result.updatedPayables[0].qrTicketUnlocked, false);
    });
  });

  describe('4. Liquidation Abort & Voiding', () => {
    test('Pending or draft liquidations are marked voided', () => {
      const event = { id: 'evt-103', status: 'approved' };
      const liquidations = [
        { id: 'liq-1', eventId: 'evt-103', status: 'draft', remarksHistory: [] },
        { id: 'liq-2', eventId: 'evt-103', status: 'pending', remarksHistory: [] },
      ];

      const result = processCancellationWaiver(event, [], liquidations, {
        eventId: 'evt-103',
        cancelledBy: 'admin-1',
        cancelledByRole: 'admin',
        cancellationReason: 'Event schedule cancelled by SAS',
        refundPolicy: 'no_fees_collected',
      });

      assert.equal(result.voidedLiquidationsCount, 2);
      result.updatedLiquidations.forEach(liq => {
        assert.equal(liq.status, 'voided');
        assert.match(liq.voidedReason, /Parent event was cancelled/);
        assert.equal(liq.remarksHistory.length, 1);
        assert.equal(liq.remarksHistory[0].action, 'voided');
      });
    });
  });

  describe('Phase 4: UI Implementation & Polish Rules', () => {
    // Phase 4.1: CancelEventModal validation rules
    function validateCancellationInput({ reason, confirmationText, isConfirmed, paidCount, refundPolicy }) {
      const errors = [];
      const trimmedReason = (reason || '').trim();
      if (trimmedReason.length < 10) {
        errors.push('Cancellation reason must be at least 10 characters.');
      }
      if (!isConfirmed) {
        errors.push('Must confirm awareness of irreversible financial auto-waiver.');
      }
      if ((confirmationText || '').trim().toUpperCase() !== 'CANCEL') {
        errors.push('Must type CANCEL to verify intent.');
      }
      if (paidCount > 0 && !refundPolicy) {
        errors.push('Must select a refund policy for collected payments.');
      }
      return {
        isValid: errors.length === 0,
        errors,
      };
    }

    test('Reason input must be at least 10 non-whitespace characters', () => {
      assert.equal(validateCancellationInput({ reason: 'Short', confirmationText: 'CANCEL', isConfirmed: true }).isValid, false);
      assert.equal(validateCancellationInput({ reason: '         ', confirmationText: 'CANCEL', isConfirmed: true }).isValid, false);
      assert.equal(validateCancellationInput({ reason: 'Inclement weather campus closure', confirmationText: 'CANCEL', isConfirmed: true }).isValid, true);
    });

    test('Confirmation text barrier enforces exact keyword "CANCEL"', () => {
      const checkWrong = validateCancellationInput({ reason: 'Official typhoon signal #3', confirmationText: 'cancel_me', isConfirmed: true });
      assert.equal(checkWrong.isValid, false);
      assert.match(checkWrong.errors[0], /type CANCEL/);

      const checkRight = validateCancellationInput({ reason: 'Official typhoon signal #3', confirmationText: 'CANCEL', isConfirmed: true });
      assert.equal(checkRight.isValid, true);
    });

    test('Collected student fees enforce mandatory refund policy selection', () => {
      const checkMissingPolicy = validateCancellationInput({
        reason: 'Event venue unavailable',
        confirmationText: 'CANCEL',
        isConfirmed: true,
        paidCount: 5,
        refundPolicy: '',
      });
      assert.equal(checkMissingPolicy.isValid, false);
      assert.match(checkMissingPolicy.errors[0], /Must select a refund policy/);

      const checkWithPolicy = validateCancellationInput({
        reason: 'Event venue unavailable',
        confirmationText: 'CANCEL',
        isConfirmed: true,
        paidCount: 5,
        refundPolicy: 'refund_cash',
      });
      assert.equal(checkWithPolicy.isValid, true);
    });

    test('Student outstanding balance calculation excludes waived fees', () => {
      const payables = [
        { id: 'pay-1', assignedAmount: 250, paidAmount: 0, status: 'waived', waivedReason: 'Event Cancelled: Storm' },
        { id: 'pay-2', assignedAmount: 150, paidAmount: 0, status: 'pending' },
        { id: 'pay-3', assignedAmount: 100, paidAmount: 100, status: 'paid' },
      ];

      const activePayables = payables.filter(p => p.status !== 'waived');
      const totalBilled = activePayables.reduce((sum, p) => sum + p.assignedAmount, 0);
      const totalPaid = payables.reduce((sum, p) => sum + p.paidAmount, 0);
      const outstandingBalance = Math.max(0, totalBilled - totalPaid);

      // Total active billed = 150 (pay-2 pending) + 100 (pay-3 paid) = 250.
      // Pay-3 was paid (100). Outstanding = 250 - 100 = 150.
      // Notice pay-1 (250 waived) was completely excluded from active billed (otherwise it would have been 500 billed and 400 outstanding).
      assert.equal(totalBilled, 250);
      assert.equal(outstandingBalance, 150);
    });

    test('Table tab filtering accurately separates Cancelled events', () => {
      const events = [
        { id: 'e1', title: 'Tech Summit', proposalStatus: 'pending_review' },
        { id: 'e2', title: 'Culture Fest', proposalStatus: 'approved', status: 'approved' },
        { id: 'e3', title: 'Cancelled Hackathon', proposalStatus: 'cancelled', isCancelled: true },
        { id: 'e4', title: 'Grad Ball', proposalStatus: 'completed', status: 'completed' },
      ];

      function filterEvents(tab) {
        return events.filter(e => {
          const isCancelled = e.isCancelled || e.proposalStatus === 'cancelled' || e.status === 'cancelled';
          if (tab === 'cancelled') return isCancelled;
          if (isCancelled) return false;
          if (tab === 'pending') return e.proposalStatus === 'pending_review';
          if (tab === 'approved') return e.proposalStatus === 'approved' && e.status !== 'completed';
          if (tab === 'completed') return e.status === 'completed';
          return true;
        });
      }

      assert.equal(filterEvents('cancelled').length, 1);
      assert.equal(filterEvents('cancelled')[0].id, 'e3');
      assert.equal(filterEvents('pending').length, 1);
      assert.equal(filterEvents('pending')[0].id, 'e1');
      assert.equal(filterEvents('approved').length, 1);
      assert.equal(filterEvents('approved')[0].id, 'e2');
      assert.equal(filterEvents('completed').length, 1);
      assert.equal(filterEvents('completed')[0].id, 'e4');
    });
  });

  describe('Phase 5: Archiving Hub & Semester Rollover Integration', () => {
    // Helper function simulating semester rollover completed events archiving logic
    function processRolloverArchiving(closingSemester, events) {
      let eventsArchivedCount = 0;
      const updatedEvents = events.map(evt => {
        const matchesSemester = evt.semesterId === closingSemester.id || evt.schoolYear === closingSemester.academicYear;
        const isCompleted = evt.status === 'completed' || evt.proposalStatus === 'completed';

        if (matchesSemester && isCompleted && !evt.isArchived) {
          eventsArchivedCount++;
          return {
            ...evt,
            isArchived: true,
            archivedAt: '2026-09-18T12:00:00.000Z',
            archivedReason: `Semester Rollover: ${closingSemester.label}`,
          };
        }
        return evt;
      });

      return {
        eventsArchivedCount,
        updatedEvents,
      };
    }

    test('Completed events for the closing semester are automatically archived upon rollover', () => {
      const closingSemester = {
        id: 'sem-2025-2',
        label: '2nd Semester 2025-2026',
        academicYear: '2025-2026',
      };

      const events = [
        { id: 'ev-comp-1', title: 'Tech Colloquium', semesterId: 'sem-2025-2', status: 'completed', isArchived: false },
        { id: 'ev-comp-2', title: 'Career Fair', semesterId: 'sem-2025-2', status: 'completed', isArchived: false },
        { id: 'ev-draft-1', title: 'Pending Proposal', semesterId: 'sem-2025-2', status: 'draft', isArchived: false },
        { id: 'ev-other-1', title: 'Next Sem Kickoff', semesterId: 'sem-2026-1', status: 'completed', isArchived: false },
      ];

      const result = processRolloverArchiving(closingSemester, events);

      assert.equal(result.eventsArchivedCount, 2);
      const archived1 = result.updatedEvents.find(e => e.id === 'ev-comp-1');
      assert.equal(archived1.isArchived, true);
      assert.equal(archived1.archivedReason, 'Semester Rollover: 2nd Semester 2025-2026');

      const draftEvt = result.updatedEvents.find(e => e.id === 'ev-draft-1');
      assert.equal(draftEvt.isArchived, false);

      const otherSemEvt = result.updatedEvents.find(e => e.id === 'ev-other-1');
      assert.equal(otherSemEvt.isArchived, false);
    });

    test('Restore action clears isArchived and isDeleted flags and stamps restoration metadata', () => {
      const archivedRecord = {
        id: 'ev-archived-99',
        title: 'Freshmen Orientation 2025',
        isArchived: true,
        isDeleted: true,
        archivedReason: 'Semester Rollover: 1st Semester 2025-2026',
      };

      function restoreRecord(rec, adminUid) {
        return {
          ...rec,
          isArchived: false,
          isDeleted: false,
          restoredAt: '2026-09-18T12:30:00.000Z',
          restoredBy: adminUid,
        };
      }

      const restored = restoreRecord(archivedRecord, 'admin-001');
      assert.equal(restored.isArchived, false);
      assert.equal(restored.isDeleted, false);
      assert.equal(restored.restoredBy, 'admin-001');
      assert.ok(restored.restoredAt);
    });

    test('Permanent purge safety barrier requires exact keyword "PURGE"', () => {
      function validatePurgeKeyword(input) {
        return (input || '').trim().toUpperCase() === 'PURGE';
      }

      assert.equal(validatePurgeKeyword('delete'), false);
      assert.equal(validatePurgeKeyword('purge_me'), false);
      assert.equal(validatePurgeKeyword('   '), false);
      assert.equal(validatePurgeKeyword('PURGE'), true);
      assert.equal(validatePurgeKeyword('purge'), true);
    });
  });

  describe('Bug Fix Regression Tests: Approval arrayUnion and Proposal Withdrawal', () => {
    const cleanUndefined = (obj) => {
      if (obj === null || obj === undefined) return undefined;
      if (Array.isArray(obj)) return obj.map(cleanUndefined).filter(v => v !== undefined);
      if (typeof obj === 'object' && typeof obj.toDate !== 'function' && !(obj instanceof Date)) {
        const res = {};
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          if (val !== undefined && val !== null) {
            const cleaned = cleanUndefined(val);
            if (cleaned !== undefined) {
              res[key] = cleaned;
            }
          }
        }
        return res;
      }
      return obj;
    };

    function canWithdrawProposal(event) {
      if (!event) return { canWithdraw: false, reason: 'Event not found.' };
      const status = (event.proposalStatus || event.status || '').toLowerCase();
      if (status !== 'pending_review' && status !== 'pending') {
        return {
          canWithdraw: false,
          reason: 'Only proposals currently in pending review can be withdrawn.',
        };
      }
      if (event.hostingOrgId === 'sas') {
        return {
          canWithdraw: false,
          reason: 'Institutional SAO events cannot be withdrawn.',
        };
      }
      return { canWithdraw: true };
    }

    test('canWithdrawProposal allows withdrawal for both "pending" and "pending_review"', () => {
      const pendingEvent = { id: 'evt-1', proposalStatus: 'pending', hostingOrgId: 'cpe-club' };
      const pendingReviewEvent = { id: 'evt-2', proposalStatus: 'pending_review', hostingOrgId: 'cpe-club' };
      const approvedEvent = { id: 'evt-3', proposalStatus: 'approved', hostingOrgId: 'cpe-club' };
      const draftEvent = { id: 'evt-4', proposalStatus: 'draft', hostingOrgId: 'cpe-club' };
      const institutionalPending = { id: 'evt-5', proposalStatus: 'pending', hostingOrgId: 'sas' };

      assert.equal(canWithdrawProposal(pendingEvent).canWithdraw, true);
      assert.equal(canWithdrawProposal(pendingReviewEvent).canWithdraw, true);
      assert.equal(canWithdrawProposal(approvedEvent).canWithdraw, false);
      assert.equal(canWithdrawProposal(draftEvent).canWithdraw, false);
      assert.equal(canWithdrawProposal(institutionalPending).canWithdraw, false);
    });

    test('cleanUndefined removes undefined remarks to prevent Firestore arrayUnion crash', () => {
      const remarks = ''; // User approved with empty remarks
      const historyEntry = cleanUndefined({
        id: 'log-12345',
        action: 'approved',
        performedBy: 'admin-001',
        performedAt: { toDate: () => new Date() },
        remarks: remarks?.trim() || undefined,
      });

      // Must not contain 'remarks' property with undefined
      assert.equal(Object.prototype.hasOwnProperty.call(historyEntry, 'remarks'), false);
      assert.equal(historyEntry.id, 'log-12345');
      assert.equal(historyEntry.action, 'approved');
      assert.equal(historyEntry.performedBy, 'admin-001');
      assert.ok(historyEntry.performedAt);

      // Verify no keys have undefined values (which triggers Firestore arrayUnion error)
      for (const [k, v] of Object.entries(historyEntry)) {
        assert.notEqual(v, undefined, `Key ${k} has undefined value!`);
      }
    });

    test('cleanUndefined preserves non-empty remarks when provided', () => {
      const remarks = 'Approved with budget modifications.';
      const historyEntry = cleanUndefined({
        id: 'log-12346',
        action: 'approved',
        performedBy: 'admin-001',
        performedAt: { toDate: () => new Date() },
        remarks: remarks?.trim() || undefined,
      });

      assert.equal(historyEntry.remarks, 'Approved with budget modifications.');
    });
  });

  describe('6. Event Editability & Major Field Locks (isEventEditable & isMajorFieldLocked)', () => {
    const MAJOR_FIELDS = [
      'sessions', 'venueId', 'venue', 'customVenueName', 'eventFormat',
      'studentPayablesEnabled', 'suggestedFeePerStudent', 'adminFeeOverride',
      'budgetItems', 'totalApprovedBudget', 'targetCourses', 'targetYearLevels',
      'targetSections', 'targetAudienceScope', 'semesterId', 'eventTypeId', 'eventCategoryId'
    ];

    function isEventEditable(event, userRole = 'officer') {
      if (!event) return { editable: false, lockLevel: 'locked' };
      if (event.isArchived || event.isDeleted || event.status === 'cancelled' || event.proposalStatus === 'cancelled') {
        return { editable: false, lockLevel: 'locked' };
      }
      if (event.status === 'completed' || event.proposalStatus === 'completed' || event.timingStatus === 'completed') {
        return { editable: false, lockLevel: 'locked', reason: 'Completed events cannot be edited.' };
      }
      if (event.status === 'ongoing' || event.timingStatus === 'ongoing') {
        return { editable: false, lockLevel: 'locked', reason: 'Ongoing events cannot be edited.' };
      }
      const status = event.proposalStatus || 'draft';
      if (status === 'draft' || status === 'returned') {
        return { editable: true, lockLevel: 'unlocked', allowedFieldTypes: 'all' };
      }
      if (status === 'approved') {
        return { editable: true, lockLevel: 'restricted', allowedFieldTypes: 'minor_only' };
      }
      if (status === 'pending' || status === 'pending_review') {
        if (userRole === 'admin') return { editable: true, lockLevel: 'restricted', allowedFieldTypes: 'all' };
        return { editable: false, lockLevel: 'locked' };
      }
      return { editable: false, lockLevel: 'locked' };
    }

    function isMajorFieldLocked(first, second, userRole = 'officer') {
      const field = typeof first === 'string' ? first : second;
      const evt = typeof first === 'string' ? second : first;
      const check = isEventEditable(evt, userRole);
      if (check.lockLevel === 'locked') return true;
      if (check.lockLevel === 'unlocked') return false;
      if (check.lockLevel === 'restricted') return MAJOR_FIELDS.includes(field);
      return false;
    }

    test('Completed events CANNOT be edited under any circumstance', () => {
      const completedByStatus = { id: 'evt-c1', status: 'completed', proposalStatus: 'approved' };
      const completedByProposal = { id: 'evt-c2', status: 'approved', proposalStatus: 'completed' };
      const completedByTiming = { id: 'evt-c3', status: 'approved', proposalStatus: 'approved', timingStatus: 'completed' };

      assert.equal(isEventEditable(completedByStatus, 'officer').editable, false);
      assert.equal(isEventEditable(completedByStatus, 'admin').editable, false);
      assert.equal(isEventEditable(completedByProposal, 'officer').editable, false);
      assert.equal(isEventEditable(completedByTiming, 'officer').editable, false);
      assert.equal(isEventEditable(completedByTiming, 'admin').editable, false);
    });

    test('Ongoing events CANNOT be edited while in session', () => {
      const ongoingEvent = { id: 'evt-o1', status: 'ongoing', proposalStatus: 'approved' };
      const ongoingTiming = { id: 'evt-o2', status: 'approved', proposalStatus: 'approved', timingStatus: 'ongoing' };

      assert.equal(isEventEditable(ongoingEvent, 'officer').editable, false);
      assert.equal(isEventEditable(ongoingTiming, 'admin').editable, false);
    });

    test('Approved events allow minor edits but lock major fields', () => {
      const approvedEvent = { id: 'evt-a1', status: 'approved', proposalStatus: 'approved' };
      const check = isEventEditable(approvedEvent, 'officer');

      assert.equal(check.editable, true);
      assert.equal(check.lockLevel, 'restricted');
      assert.equal(check.allowedFieldTypes, 'minor_only');

      // Major fields must be locked
      assert.equal(isMajorFieldLocked('venueId', approvedEvent), true);
      assert.equal(isMajorFieldLocked('sessions', approvedEvent), true);
      assert.equal(isMajorFieldLocked('budgetItems', approvedEvent), true);
      assert.equal(isMajorFieldLocked('targetCourses', approvedEvent), true);
      assert.equal(isMajorFieldLocked('eventTypeId', approvedEvent), true);

      // Argument order resilience: isMajorFieldLocked(event, field)
      assert.equal(isMajorFieldLocked(approvedEvent, 'venueId'), true);

      // Minor descriptive fields are not in major fields
      assert.equal(isMajorFieldLocked('description', approvedEvent), false);
      assert.equal(isMajorFieldLocked('tagline', approvedEvent), false);
      assert.equal(isMajorFieldLocked('objectives', approvedEvent), false);
    });

    test('Draft and returned events are fully unlocked', () => {
      const draftEvent = { id: 'evt-d1', proposalStatus: 'draft' };
      const returnedEvent = { id: 'evt-r1', proposalStatus: 'returned' };

      assert.equal(isEventEditable(draftEvent).lockLevel, 'unlocked');
      assert.equal(isMajorFieldLocked('venueId', draftEvent), false);

      assert.equal(isEventEditable(returnedEvent).lockLevel, 'unlocked');
      assert.equal(isMajorFieldLocked('budgetItems', returnedEvent), false);
    });
  });
});
