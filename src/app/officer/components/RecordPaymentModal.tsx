import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, CheckCircle, Wallet, Tag, CreditCard, Receipt, AlertCircle, Info, Coins, Banknote, Calendar } from 'lucide-react';
import { recordPayment } from '../../modules/finance/services/payable.service';
import type { PayableDocument } from '../../modules/finance/types/payable.types';
import { formatCurrency } from '../../utils/currency';
import { formatAppDate, parseDateSafe } from '../../utils/date';
import { toast } from 'sonner';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payable?: PayableDocument | null;
  payables?: PayableDocument[];
  defaultPayableId?: string;
  studentName?: string;
  studentSchoolId?: string;
  recordedBy: string;
  onSuccess?: (payableId: string) => void;
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  payable,
  payables,
  defaultPayableId,
  studentName: propStudentName,
  studentSchoolId: propSchoolId,
  recordedBy,
  onSuccess,
}: RecordPaymentModalProps) {
  // Combine single payable or multiple payables into a single list
  const allPayables = useMemo(() => {
    if (payables && payables.length > 0) return payables;
    if (payable) return [payable];
    return [];
  }, [payables, payable]);

  // Filter valid candidate payables (exclude waived, fully refunded)
  const candidatePayables = useMemo(() => {
    return allPayables.filter(
      (p) => p.status !== 'waived' && p.status !== 'refund_pending' && p.status !== 'refunded'
    );
  }, [allPayables]);

  const [selectedPayableId, setSelectedPayableId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize selected payable
  useEffect(() => {
    if (!isOpen) return;

    if (defaultPayableId && candidatePayables.some((p) => p.id === defaultPayableId)) {
      setSelectedPayableId(defaultPayableId);
      return;
    }

    if (payable && candidatePayables.some((p) => p.id === payable.id)) {
      setSelectedPayableId(payable.id);
      return;
    }

    // Default to the first payable that has an unpaid balance
    const firstPending = candidatePayables.find(
      (p) => (p.assignedAmount || 0) > (p.paidAmount || 0)
    );
    if (firstPending) {
      setSelectedPayableId(firstPending.id);
    } else if (candidatePayables.length > 0) {
      setSelectedPayableId(candidatePayables[0].id);
    }
  }, [isOpen, defaultPayableId, payable, candidatePayables]);

  const currentPayable = useMemo(() => {
    return candidatePayables.find((p) => p.id === selectedPayableId) || candidatePayables[0] || payable || null;
  }, [candidatePayables, selectedPayableId, payable]);

  const assignedAmount = currentPayable?.assignedAmount || currentPayable?.amount || 0;
  const paidAmount = currentPayable?.paidAmount || 0;
  const remainingBalance = Math.max(0, assignedAmount - paidAmount);

  const isCurrentOverdue = useMemo(() => {
    if (!currentPayable?.dueDate || currentPayable.status === 'paid' || currentPayable.status === 'waived') return false;
    if (currentPayable.status === 'overdue') return true;
    const dueTime = parseDateSafe(currentPayable.dueDate)?.getTime();
    return typeof dueTime === 'number' && dueTime < Date.now();
  }, [currentPayable]);

  // Auto-populate remaining balance into amount input when selected payable changes
  useEffect(() => {
    if (currentPayable) {
      setPaymentAmount(remainingBalance > 0 ? remainingBalance : 0);
    }
  }, [selectedPayableId, remainingBalance]);

  if (!isOpen || (!currentPayable && candidatePayables.length === 0)) return null;

  const displayName = propStudentName || currentPayable?.studentName || 'Club Member';
  const displaySchoolId = propSchoolId || currentPayable?.studentSchoolId || currentPayable?.studentId || '—';

  const numAmount = Number(paymentAmount) || 0;
  const isPartial = numAmount > 0 && numAmount < remainingBalance;
  const isFull = numAmount >= remainingBalance && remainingBalance > 0;
  const newRemaining = Math.max(0, remainingBalance - numAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPayable) {
      toast.error('Please select a fee or fine to pay.');
      return;
    }

    if (!numAmount || numAmount <= 0) {
      toast.error('Please enter a valid payment amount greater than ₱0.');
      return;
    }

    if (numAmount > remainingBalance && remainingBalance > 0) {
      const confirmOverpay = window.confirm(
        `Payment amount (${formatCurrency(numAmount)}) exceeds the remaining balance (${formatCurrency(remainingBalance)}). Do you wish to proceed?`
      );
      if (!confirmOverpay) return;
    }

    setIsSubmitting(true);

    try {
      await recordPayment(
        currentPayable.id,
        numAmount,
        recordedBy,
        paymentMethod,
        undefined,
        receiptNumber.trim() || undefined,
        notes.trim() || undefined
      );

      const feeName = currentPayable.label || currentPayable.title || 'Fee';
      if (isPartial) {
        toast.success(`Partial payment of ${formatCurrency(numAmount)} recorded for ${displayName} (${feeName}). Remaining balance: ${formatCurrency(newRemaining)}.`);
      } else {
        toast.success(`Payment of ${formatCurrency(numAmount)} successfully recorded for ${displayName} (${feeName}). Marked as Paid!`);
      }

      onSuccess?.(currentPayable.id);
      onClose();
    } catch (err: any) {
      console.error('[RecordPaymentModal] Error recording payment:', err);
      toast.error(err?.message || 'Failed to record payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[540px] shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Coins className="w-5 h-5 text-[#FFD41C]" />
            <div>
              <h2 className="font-bold text-base text-white">Record Member Payment</h2>
              <p className="text-white/70 text-xs">
                {displayName} <span className="font-mono text-white/50">({displaySchoolId})</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Fee / Fine Selection */}
          {candidatePayables.length > 1 ? (
            <div>
              <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#0E4EBD]" />
                  Select Fee / Fine to Pay <span className="text-red-500">*</span>
                </span>
                <span className="text-[11px] text-gray-400 font-normal">
                  {candidatePayables.length} item(s) found
                </span>
              </label>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {candidatePayables.map((p) => {
                  const pAssigned = p.assignedAmount || p.amount || 0;
                  const pPaid = p.paidAmount || 0;
                  const pRem = Math.max(0, pAssigned - pPaid);
                  const isSelected = p.id === selectedPayableId;

                  const pDueTime = parseDateSafe(p.dueDate)?.getTime();
                  const pIsOverdue =
                    (p.status === 'overdue' || (typeof pDueTime === 'number' && pDueTime < Date.now())) &&
                    pRem > 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPayableId(p.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs ${
                        isSelected
                          ? 'border-[#0E4EBD] bg-blue-50/70 shadow-2xs font-semibold'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className={`truncate ${isSelected ? 'text-[#001A4D] font-bold' : 'text-gray-800'}`}>
                            {p.label || p.title || 'Payable Fee'}
                          </p>
                          <span className="px-1.5 py-0.2 bg-gray-200/70 text-gray-600 text-[10px] rounded capitalize">
                            {(p.category || p.type || '').replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 flex-wrap">
                          <span>
                            Assigned: {formatCurrency(pAssigned)} · Paid: {formatCurrency(pPaid)}
                          </span>
                          <span className="text-gray-300">·</span>
                          <span
                            className={`inline-flex items-center gap-1 ${
                              pIsOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            Deadline: {formatAppDate(p.dueDate, 'No deadline')}
                            {pIsOverdue && (
                              <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1 py-0.2 rounded uppercase">
                                Overdue
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span
                          className={`text-xs font-bold ${
                            pRem === 0
                              ? 'text-green-600'
                              : isSelected
                              ? 'text-red-600'
                              : 'text-gray-700'
                          }`}
                        >
                          {pRem === 0 ? '✓ Paid' : `Rem: ${formatCurrency(pRem)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Assigned Fee / Fine
                </span>
                <p className="text-sm font-bold text-[#001A4D] mt-0.5">
                  {currentPayable?.label || currentPayable?.title || 'Club Payable'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 capitalize">
                    {(currentPayable?.category || currentPayable?.type || '').replace('_', ' ')}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span
                    className={`text-xs inline-flex items-center gap-1 ${
                      isCurrentOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Deadline: {formatAppDate(currentPayable?.dueDate, 'No deadline set')}
                    {isCurrentOverdue && (
                      <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1 py-0.2 rounded uppercase">
                        Overdue
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-blue-100 text-[#0E4EBD] text-xs font-bold rounded-lg">
                {formatCurrency(assignedAmount)}
              </span>
            </div>
          )}

          {/* Financial Breakdown Card with Payment Deadline */}
          <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-3.5 space-y-2.5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-2xs">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Fee</p>
                <p className="text-xs sm:text-sm font-bold text-gray-900 mt-0.5">
                  {formatCurrency(assignedAmount)}
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-2xs">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Already Paid</p>
                <p className="text-xs sm:text-sm font-bold text-green-600 mt-0.5">
                  {formatCurrency(paidAmount)}
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-red-100 bg-red-50/30 shadow-2xs">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Remaining Balance</p>
                <p className="text-xs sm:text-sm font-bold text-red-600 mt-0.5">
                  {formatCurrency(remainingBalance)}
                </p>
              </div>
            </div>

            {/* Payment Due Date / Deadline Banner */}
            <div className="pt-2 border-t border-gray-200/70 flex items-center justify-between text-xs px-0.5">
              <div className="flex items-center gap-1.5 text-gray-600">
                <Calendar
                  className={`w-3.5 h-3.5 ${isCurrentOverdue ? 'text-red-500' : 'text-gray-400'}`}
                />
                <span className="font-medium">Payment Deadline:</span>
                <span className={`font-semibold ${isCurrentOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatAppDate(currentPayable?.dueDate, 'No deadline set')}
                </span>
              </div>
              {isCurrentOverdue ? (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase">
                  Overdue
                </span>
              ) : currentPayable?.dueDate ? (
                <span className="px-2 py-0.5 bg-blue-50 text-[#0E4EBD] text-[10px] font-medium rounded-full">
                  Due {formatAppDate(currentPayable.dueDate)}
                </span>
              ) : (
                <span className="text-[11px] text-gray-400 italic">No set deadline</span>
              )}
            </div>
          </div>

          {/* Payment Amount & Partial Options */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#001A4D] uppercase tracking-wider">
                Payment Amount (PHP) <span className="text-red-500">*</span>
              </label>
              {remainingBalance > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(remainingBalance)}
                    className="text-[11px] font-bold text-[#0E4EBD] hover:underline cursor-pointer bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200"
                  >
                    Full Balance ({formatCurrency(remainingBalance)})
                  </button>
                  {remainingBalance > 10 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(Math.round((remainingBalance / 2) * 100) / 100)}
                      className="text-[11px] font-semibold text-gray-600 hover:text-gray-900 cursor-pointer bg-gray-100 px-2 py-0.5 rounded-md hover:bg-gray-200"
                    >
                      50% Partial ({formatCurrency(remainingBalance / 2)})
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₱</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#0E4EBD]/20 focus:border-[#0E4EBD] outline-none transition-all"
                required
              />
            </div>

            {/* Dynamic Partial / Full Settlement Banner */}
            <div className="mt-2">
              {isPartial && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    <strong>Partial Payment:</strong> {formatCurrency(numAmount)} will be recorded. Remaining balance of{' '}
                    <strong>{formatCurrency(newRemaining)}</strong> will stay active until settled.
                  </span>
                </div>
              )}
              {isFull && (
                <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-xs text-green-800">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>
                    <strong>Full Settlement:</strong> This fee/fine will be completely paid and marked as settled.
                  </span>
                </div>
              )}
              {numAmount > remainingBalance && remainingBalance > 0 && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-800">
                  <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>
                    Entered amount exceeds the remaining balance of {formatCurrency(remainingBalance)}.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method & OR # */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1.5">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#0E4EBD]/20 focus:border-[#0E4EBD] bg-white cursor-pointer"
              >
                <option value="cash">Cash (Over the Counter)</option>
                <option value="gcash">GCash (e-Wallet)</option>
                <option value="maya">Maya (e-Wallet)</option>
                <option value="bank_transfer">Bank Deposit / Transfer</option>
                <option value="other">Other Official Receipt</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1.5">
                OR # / Ref # <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. OR# 10482 or GCash Ref"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#0E4EBD]/20 focus:border-[#0E4EBD]"
              />
            </div>
          </div>

          {/* Remarks / Justification (Optional) */}
          <div>
            <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1.5">
              Remarks / Notes <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 1st installment, paid during General Assembly"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#0E4EBD]/20 focus:border-[#0E4EBD]"
            />
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || numAmount <= 0}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording Payment...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>
                    {isPartial ? 'Record Partial Payment' : 'Confirm Payment'} ({formatCurrency(numAmount)})
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
