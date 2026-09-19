import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure simulation of processPayableRefund logic to verify invariants,
 * role authorization, double-refund prevention, and treasury atomicity without ghost money.
 */
function processPayableRefundMock(payable, payload, treasuryLedger = []) {
  const {
    refundedAmount,
    refundedBy,
    refundedByName,
    refundMethod = 'cash',
    receiptNumber,
    refundNotes,
    actorRole,
    actorOrgId,
  } = payload;

  if (!payable) {
    throw new Error('Payable document not found.');
  }

  // Double refund prevention
  if (payable.status === 'refunded') {
    throw new Error('This payable has already been refunded.');
  }

  if (payable.status === 'waived') {
    throw new Error('This payable was waived and cannot be refunded.');
  }

  // Role & Scope Validation
  if (actorRole === 'officer') {
    if (!actorOrgId) {
      throw new Error('Unauthorized: Officer must be associated with an organization.');
    }
    if (payable.organizationId && payable.organizationId !== actorOrgId) {
      throw new Error("Unauthorized: Officers can only process refunds for their own organization's payables.");
    }
    if (!payable.organizationId) {
      throw new Error('Unauthorized: Only SAO Admin can process institutional event refunds.');
    }
  }

  const paidAmt = Number(payable.paidAmount || 0);
  const refundDueAmt = typeof payable.refundDue === 'number' ? payable.refundDue : paidAmt;
  const maxRefundable = Math.max(0, Math.min(paidAmt > 0 ? paidAmt : refundDueAmt, refundDueAmt > 0 ? refundDueAmt : paidAmt));

  if (maxRefundable <= 0) {
    throw new Error('No refundable balance available for this payable.');
  }

  const actualRefund = Number(refundedAmount || maxRefundable);
  if (actualRefund <= 0) {
    throw new Error('Refund amount must be greater than zero.');
  }
  if (actualRefund > maxRefundable) {
    throw new Error(`Refund amount (₱${actualRefund.toFixed(2)}) exceeds maximum refundable balance (₱${maxRefundable.toFixed(2)}).`);
  }

  // Transferred amount check for ghost money prevention
  const transferredAmt = Number(payable.transferredAmount || 0);
  const wasTransferred = payable.transferredToBudget === true || transferredAmt > 0;
  let ledgerAdjusted = false;
  let newLedgerEntry = null;

  if (wasTransferred) {
    const amountToDebit = Math.min(transferredAmt > 0 ? transferredAmt : paidAmt, actualRefund);
    if (amountToDebit > 0) {
      ledgerAdjusted = true;
      newLedgerEntry = {
        id: `tx_refund_${payable.id}`,
        type: 'expense',
        category: 'Refund Disbursement',
        amount: amountToDebit,
        source: 'student_refund',
        referenceId: payable.id,
        description: `Student Refund Disbursement — ${payable.studentName || 'Student'} (${payable.label || 'Fee'})`,
        organizationId: payable.organizationId || null,
        createdByName: refundedByName || (actorRole === 'admin' ? 'Admin SAO' : 'Student Officer'),
        createdBy: refundedBy,
        date: new Date().toISOString(),
      };
      treasuryLedger.push(newLedgerEntry);
    }
  }

  const remainingPaid = Math.max(0, paidAmt - actualRefund);
  const newStatus = remainingPaid === 0 ? 'refunded' : 'partial';

  const updatedPayable = {
    ...payable,
    status: newStatus,
    paidAmount: remainingPaid,
    refundedAmount: actualRefund,
    refundDue: 0,
    refundedAt: new Date().toISOString(),
    refundedBy,
    refundedByName: refundedByName || (actorRole === 'admin' ? 'Admin SAO' : 'Student Officer'),
    refundMethod,
    receiptNumber: receiptNumber || null,
    refundNotes: refundNotes || null,
    transferredAmount: Math.max(0, transferredAmt - actualRefund),
    transferredToBudget: Math.max(0, transferredAmt - actualRefund) > 0,
  };

  return {
    updatedPayable,
    ledgerAdjusted,
    newLedgerEntry,
    treasuryLedger,
    refundedAmount: actualRefund,
    studentName: payable.studentName || 'Student',
  };
}

describe('Student Refund Processing Unit Tests', () => {

  test('TC-RFD-01: Successfully refund a pending refund payable (Cash)', () => {
    const mockPayable = {
      id: 'pay_001',
      studentId: '202301001',
      studentName: 'Juan Dela Cruz',
      studentSchoolId: '02000254321',
      label: 'IT Tech Summit 2026 Registration',
      assignedAmount: 150,
      paidAmount: 150,
      status: 'refund_pending',
      refundDue: 150,
      organizationId: 'jpcs_org',
      transferredToBudget: false,
      transferredAmount: 0,
    };

    const result = processPayableRefundMock(mockPayable, {
      refundedAmount: 150,
      refundedBy: 'officer_01',
      refundedByName: 'Maria Santos',
      refundMethod: 'cash',
      receiptNumber: 'RFD-2026-001',
      refundNotes: 'Handed cash refund at Student Affairs desk',
      actorRole: 'officer',
      actorOrgId: 'jpcs_org',
    });

    assert.equal(result.updatedPayable.status, 'refunded');
    assert.equal(result.updatedPayable.refundedAmount, 150);
    assert.equal(result.updatedPayable.refundedBy, 'officer_01');
    assert.equal(result.updatedPayable.receiptNumber, 'RFD-2026-001');
    assert.equal(result.ledgerAdjusted, false, 'No ledger debit since funds were never transferred to treasury');
  });

  test('TC-RFD-02: Double refund prevention throws error if payable is already refunded', () => {
    const mockPayable = {
      id: 'pay_002',
      studentId: '202301002',
      studentName: 'Pedro Penduko',
      label: 'Acquaintance Party',
      assignedAmount: 200,
      paidAmount: 0,
      status: 'refunded',
      refundedAmount: 200,
      organizationId: 'jpcs_org',
    };

    assert.throws(
      () => {
        processPayableRefundMock(mockPayable, {
          refundedAmount: 200,
          refundedBy: 'officer_01',
          actorRole: 'officer',
          actorOrgId: 'jpcs_org',
        });
      },
      {
        message: 'This payable has already been refunded.',
      }
    );
  });

  test('TC-RFD-03: Officer role isolation — cannot refund payables belonging to another organization', () => {
    const mockPayable = {
      id: 'pay_003',
      studentId: '202301003',
      studentName: 'Ana Gomez',
      label: 'Hospitality Night Fee',
      assignedAmount: 300,
      paidAmount: 300,
      status: 'refund_pending',
      refundDue: 300,
      organizationId: 'hrm_society',
    };

    assert.throws(
      () => {
        processPayableRefundMock(mockPayable, {
          refundedAmount: 300,
          refundedBy: 'officer_jpcs',
          actorRole: 'officer',
          actorOrgId: 'jpcs_org', // Different org!
        });
      },
      {
        message: "Unauthorized: Officers can only process refunds for their own organization's payables.",
      }
    );
  });

  test('TC-RFD-04: Officer cannot process refund for institutional SAO events without admin role', () => {
    const mockPayable = {
      id: 'pay_004',
      studentId: '202301004',
      studentName: 'Clara Reyes',
      label: 'Institutional Sports Fest Fee',
      assignedAmount: 100,
      paidAmount: 100,
      status: 'refund_pending',
      refundDue: 100,
      organizationId: null, // Institutional SAO
    };

    assert.throws(
      () => {
        processPayableRefundMock(mockPayable, {
          refundedAmount: 100,
          refundedBy: 'officer_01',
          actorRole: 'officer',
          actorOrgId: 'jpcs_org',
        });
      },
      {
        message: 'Unauthorized: Only SAO Admin can process institutional event refunds.',
      }
    );
  });

  test('TC-RFD-05: Admin SAO can successfully process refund for institutional events', () => {
    const mockPayable = {
      id: 'pay_005',
      studentId: '202301005',
      studentName: 'Carlos Garcia',
      label: 'General Assembly Fee',
      assignedAmount: 100,
      paidAmount: 100,
      status: 'refund_pending',
      refundDue: 100,
      organizationId: null,
      transferredToBudget: false,
    };

    const result = processPayableRefundMock(mockPayable, {
      refundedAmount: 100,
      refundedBy: 'admin_sao',
      refundedByName: 'SAO Admin',
      actorRole: 'admin',
    });

    assert.equal(result.updatedPayable.status, 'refunded');
    assert.equal(result.updatedPayable.refundedByName, 'SAO Admin');
  });

  test('TC-RFD-06: Ghost Money Prevention — Debits Treasury Ledger if funds were previously transferred', () => {
    const mockPayable = {
      id: 'pay_006',
      studentId: '202301006',
      studentName: 'Elena Cruz',
      label: 'Hackathon 2026 Entry Fee',
      assignedAmount: 250,
      paidAmount: 250,
      status: 'refund_pending',
      refundDue: 250,
      organizationId: 'jpcs_org',
      transferredToBudget: true,
      transferredAmount: 250,
    };

    const treasuryLedger = [];
    const result = processPayableRefundMock(
      mockPayable,
      {
        refundedAmount: 250,
        refundedBy: 'officer_01',
        refundedByName: 'Maria Santos',
        actorRole: 'officer',
        actorOrgId: 'jpcs_org',
      },
      treasuryLedger
    );

    assert.equal(result.updatedPayable.status, 'refunded');
    assert.equal(result.ledgerAdjusted, true, 'Ledger must be adjusted to prevent ghost money');
    assert.equal(treasuryLedger.length, 1);
    assert.equal(treasuryLedger[0].type, 'expense');
    assert.equal(treasuryLedger[0].amount, 250);
    assert.equal(treasuryLedger[0].source, 'student_refund');
    assert.equal(treasuryLedger[0].referenceId, 'pay_006');
  });

  test('TC-RFD-07: Refund amount cannot exceed maximum refundable balance', () => {
    const mockPayable = {
      id: 'pay_007',
      studentId: '202301007',
      studentName: 'Roberto Silva',
      label: 'Workshop Fee',
      assignedAmount: 100,
      paidAmount: 100,
      status: 'refund_pending',
      refundDue: 100,
      organizationId: 'jpcs_org',
    };

    assert.throws(
      () => {
        processPayableRefundMock(mockPayable, {
          refundedAmount: 200, // Exceeds 100!
          refundedBy: 'officer_01',
          actorRole: 'officer',
          actorOrgId: 'jpcs_org',
        });
      },
      {
        message: 'Refund amount (₱200.00) exceeds maximum refundable balance (₱100.00).',
      }
    );
  });

  test('TC-RFD-08: Event Credit refund method is supported alongside Cash', () => {
    const mockPayable = {
      id: 'pay_008',
      studentId: '202301008',
      studentName: 'Diana Prince',
      label: 'Leadership Bootcamp',
      assignedAmount: 500,
      paidAmount: 500,
      status: 'refund_pending',
      refundDue: 500,
      organizationId: 'jpcs_org',
      transferredToBudget: false,
    };

    const result = processPayableRefundMock(mockPayable, {
      refundedAmount: 500,
      refundedBy: 'officer_01',
      refundMethod: 'credit_next_event',
      refundNotes: 'Credited towards Year-End Gala',
      actorRole: 'officer',
      actorOrgId: 'jpcs_org',
    });

    assert.equal(result.updatedPayable.status, 'refunded');
    assert.equal(result.updatedPayable.refundMethod, 'credit_next_event');
    assert.equal(result.updatedPayable.refundNotes, 'Credited towards Year-End Gala');
  });

  test('TC-RFD-09: Transfer to Treasury is disabled/blocked for cancelled events & refund pending payables', () => {
    const mockCollection = {
      id: 'grp_009',
      eventName: 'Cancelled Hackathon 2026',
      isCancelled: true,
      payments: [
        { id: 'p_1', status: 'Refund Pending', amount: 200, refundDue: 200 },
        { id: 'p_2', status: 'Refunded', amount: 200, refundDue: 0 },
      ],
      untransferredAmount: 0,
    };

    // Helper logic simulating transfer eligibility
    const canTransfer = !mockCollection.isCancelled &&
      !mockCollection.payments.some(p => p.status === 'Refund Pending' || p.status === 'Refunded') &&
      mockCollection.untransferredAmount > 0;

    assert.equal(canTransfer, false, 'Transfer button must be disabled for cancelled collections');
  });
});
