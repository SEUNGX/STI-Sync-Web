import { useState } from 'react';
import { X, CheckCircle, Lock, Unlock, Loader2, Coins } from 'lucide-react';
import type { PayableDocument } from '../types/payable.types';
import { recordPayment } from '../services/payable.service';
import { formatCurrency } from '../../../utils/currency';

interface AdminRecordPaymentModalProps {
  payable: PayableDocument;
  onClose: () => void;
  recordedByUid: string;
  resolvedName?: string;
  resolvedSchoolId?: string;
}

export function AdminRecordPaymentModal({
  payable,
  onClose,
  recordedByUid,
  resolvedName,
  resolvedSchoolId,
}: AdminRecordPaymentModalProps) {
  const remaining = Math.max(0, (payable.assignedAmount || 0) - (payable.paidAmount || 0));

  const displayName = resolvedName || payable.studentName || (payable as any).name || 'Student';
  const displaySchoolId = resolvedSchoolId || payable.studentSchoolId || (payable as any).schoolId || payable.studentId || 'N/A';

  const [paymentAmount, setPaymentAmount] = useState<number>(remaining);
  const [unlockQRTicket, setUnlockQRTicket] = useState<boolean>(
    payable.qrTicketUnlocked ?? true
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await recordPayment(
        payable.id,
        paymentAmount,
        recordedByUid || 'admin',
        'cash',
        unlockQRTicket
      );
      onClose();
    } catch (err) {
      console.error('Error recording payment:', err);
      alert('Failed to record payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-[#FFC107]" />
            <h3 className="font-bold text-base">Record Event Payment</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Student Banner */}
          <div className="bg-[#EEEDFE] border border-[#7F77DD]/30 rounded-lg p-3.5">
            <p className="text-xs font-semibold text-[#7F77DD] uppercase tracking-wide mb-0.5">
              Student Details
            </p>
            <p className="text-[#001A4D] font-bold text-sm">{displayName}</p>
            <p className="text-gray-500 font-mono text-xs">
              STI Student ID: {displaySchoolId}
            </p>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#7F77DD]/20 text-xs">
              <span className="text-gray-600">Total Fee: {formatCurrency(payable.assignedAmount)}</span>
              <span className="text-gray-600">Already Paid: {formatCurrency(payable.paidAmount || 0)}</span>
              <span className="font-bold text-[#001A4D]">Remaining: {formatCurrency(remaining)}</span>
            </div>
          </div>

          {/* Payment Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-[#001A4D] mb-1">
              Payment Amount (₱) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">
                ₱
              </span>
              <input
                type="number"
                required
                min={1}
                max={payable.assignedAmount * 2}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-[#001A4D] focus:ring-2 focus:ring-[#7F77DD] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setPaymentAmount(remaining)}
              className="text-[11px] text-[#7F77DD] font-medium hover:underline mt-1 block"
            >
              Fill full remaining balance ({formatCurrency(remaining)})
            </button>
          </div>

          {/* Admin Explicit QR Code Ticket Unlock Control (Only for pre-event / event fees where QR gate access is needed) */}
          {payable.type === 'event_fee' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {unlockQRTicket ? (
                    <Unlock className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Lock className="w-4 h-4 text-amber-700" />
                  )}
                  <span className="text-xs font-bold text-[#001A4D]">
                    QR Ticket Access Status
                  </span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    unlockQRTicket
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {unlockQRTicket ? 'Unlocked' : 'Locked'}
                </span>
              </div>

              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={unlockQRTicket}
                  onChange={(e) => setUnlockQRTicket(e.target.checked)}
                  className="w-4 h-4 text-[#7F77DD] rounded border-gray-300 mt-0.5"
                />
                <span className="text-xs text-gray-700 leading-tight">
                  <strong>Unlock Event QR Ticket immediately</strong> — allows the student to scan their QR ticket for gate entry.
                </span>
              </label>
            </div>
          )}

          {/* Notes / Reference */}
          <div>
            <label className="block text-xs font-semibold text-[#001A4D] mb-1">
              Notes / Receipt Reference (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Over-the-counter cash payment at SAO"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#7F77DD]"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || paymentAmount <= 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#001A4D] text-white rounded-lg text-xs font-bold hover:bg-[#001A4D]/90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 text-[#FFC107]" />
              )}
              Confirm & Save Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
