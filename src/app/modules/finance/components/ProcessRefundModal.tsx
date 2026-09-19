import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Banknote, CreditCard, Receipt, User, Hash, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { PayableDocument } from '../types/payable.types';
import { processPayableRefund } from '../services/payable.service';
import { formatCurrency } from '../../../utils/currency';
import { toast } from 'sonner';

interface ProcessRefundModalProps {
  payable: PayableDocument;
  onClose: () => void;
  onRefunded?: () => void;
  actorId: string;
  actorName?: string;
  actorRole: 'admin' | 'officer';
  actorOrgId?: string | null;
}

export function ProcessRefundModal({
  payable,
  onClose,
  onRefunded,
  actorId,
  actorName,
  actorRole,
  actorOrgId,
}: ProcessRefundModalProps) {
  const paidAmt = Number(payable.paidAmount || 0);
  const refundDue = typeof payable.refundDue === 'number' ? payable.refundDue : paidAmt;
  const maxRefundable = Math.max(0, Math.min(paidAmt > 0 ? paidAmt : refundDue, refundDue > 0 ? refundDue : paidAmt));

  const [refundAmount, setRefundAmount] = useState<number>(maxRefundable);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'credit_next_event'>('cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayName = payable.studentName || 'Student';
  const displaySchoolId = payable.studentSchoolId || payable.studentId || 'N/A';
  const displayLabel = payable.label || payable.feeTitle || payable.title || 'Event Fee';

  // Was already transferred to treasury?
  const transferredAmt = Number(payable.transferredAmount || 0);
  const wasTransferred = payable.transferredToBudget === true || transferredAmt > 0;

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (refundAmount <= 0 || refundAmount > maxRefundable) return;

    setIsSubmitting(true);
    try {
      const result = await processPayableRefund({
        payableId: payable.id,
        refundedAmount: refundAmount,
        refundedBy: actorId,
        refundedByName: actorName,
        refundMethod,
        receiptNumber: receiptNumber.trim() || undefined,
        refundNotes: notes.trim() || undefined,
        actorRole,
        actorOrgId,
      });

      toast.success(
        `Refund of ${formatCurrency(result.refundedAmount)} disbursed to ${result.studentName}.${result.ledgerAdjusted ? ' Treasury balance adjusted.' : ''}`,
        { duration: 5000 }
      );

      onRefunded?.();
      onClose();
    } catch (err: any) {
      console.error('[ProcessRefundModal] Error:', err);
      toast.error(err?.message || 'Failed to process refund. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = refundAmount > 0 && refundAmount <= maxRefundable;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 to-purple-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-purple-200" />
            </div>
            <div>
              <h3 className="font-bold text-base">Process Student Refund</h3>
              <p className="text-xs text-purple-200">Disburse cancelled event fee</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Student Info Banner */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-purple-600 flex-shrink-0" />
              <p className="text-sm font-bold text-purple-900">{displayName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <p className="text-xs text-purple-700 font-mono">{displaySchoolId}</p>
            </div>
            <div className="pt-1 border-t border-purple-100 mt-1.5">
              <p className="text-[11px] text-purple-600">{displayLabel}</p>
              {payable.organizationName && (
                <p className="text-[11px] text-purple-500">{payable.organizationName}</p>
              )}
            </div>
          </div>

          {/* Amount Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Original Fee</p>
              <p className="text-base font-bold text-gray-800">{formatCurrency(payable.assignedAmount || 0)}</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-purple-600 uppercase tracking-wide">Refund Due</p>
              <p className="text-base font-bold text-purple-800">{formatCurrency(maxRefundable)}</p>
            </div>
          </div>

          {/* Ghost Money Warning */}
          {wasTransferred && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 leading-relaxed">
                <strong>Treasury Adjustment Required:</strong> {formatCurrency(transferredAmt)} from this student's payment was previously transferred to the
                {payable.organizationId ? ' Club' : ' SAO'} treasury. Processing this refund will automatically debit {formatCurrency(Math.min(transferredAmt, refundAmount))} from the ledger to prevent ghost money.
              </div>
            </div>
          )}

          {/* Refund Amount */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Refund Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₱</span>
              <input
                type="number"
                step="0.01"
                min={0.01}
                max={maxRefundable}
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
                className={`w-full pl-8 pr-3 py-2.5 border rounded-xl text-sm font-bold focus:outline-none focus:ring-2 transition-all ${
                  refundAmount > maxRefundable
                    ? 'border-red-300 focus:ring-red-200 text-red-700 bg-red-50/30'
                    : 'border-gray-300 focus:ring-purple-200 focus:border-purple-500 text-gray-900'
                }`}
              />
            </div>
            {refundAmount > maxRefundable && (
              <p className="text-red-600 text-[11px] mt-1 font-medium">
                Cannot exceed refundable balance of {formatCurrency(maxRefundable)}
              </p>
            )}
          </div>

          {/* Refund Method */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Refund Method</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRefundMethod('cash')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  refundMethod === 'cash'
                    ? 'border-purple-500 bg-purple-50 text-purple-800 ring-2 ring-purple-200'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <Banknote className="w-4 h-4" />
                Cash Refund
              </button>
              <button
                type="button"
                onClick={() => setRefundMethod('credit_next_event')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  refundMethod === 'credit_next_event'
                    ? 'border-purple-500 bg-purple-50 text-purple-800 ring-2 ring-purple-200'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Event Credit
              </button>
            </div>
          </div>

          {/* Receipt / Voucher Number */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              <span className="flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-gray-400" />
                Receipt / Voucher Number
                <span className="text-gray-400 font-normal">(optional)</span>
              </span>
            </label>
            <input
              type="text"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="e.g. RFD-2026-001"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Remarks <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes about this refund disbursement..."
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isValid}
              className="flex-1 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {isSubmitting ? 'Processing...' : `Disburse ${formatCurrency(refundAmount)}`}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
