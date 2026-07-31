import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, Wallet } from 'lucide-react';
import { recordPayment } from '../../modules/finance/services/payable.service';
import type { PayableDocument } from '../../modules/finance/types/payable.types';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payable: PayableDocument | null;
  recordedBy: string;
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  payable,
  recordedBy,
}: RecordPaymentModalProps) {
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (payable) {
      const remaining = payable.assignedAmount - (payable.paidAmount || 0);
      setPaymentAmount(remaining > 0 ? remaining : 0);
    }
  }, [payable]);

  if (!isOpen || !payable) return null;

  const remainingBalance = payable.assignedAmount - (payable.paidAmount || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    if (amount > remainingBalance) {
      const confirmOverpay = confirm(
        `Payment amount (₱${amount}) exceeds the remaining balance (₱${remainingBalance}). Are you sure?`
      );
      if (!confirmOverpay) return;
    }

    setIsSubmitting(true);

    try {
      await recordPayment(payable.id, amount, recordedBy, paymentMethod);
      alert(`Payment of ₱${amount.toLocaleString()} successfully recorded for ${payable.studentName}.`);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to record payment: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[480px] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-green-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <CheckCircle className="w-5 h-5 text-[#FFD41C]" />
            <h2 className="font-semibold text-lg">Record Payment</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Card */}
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-[#001A4D] text-base">{payable.studentName}</p>
                <p className="text-xs text-gray-500">{payable.studentSchoolId || payable.studentId}</p>
              </div>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full capitalize">
                {payable.type.replace('_', ' ')}
              </span>
            </div>

            <p className="text-sm font-medium text-gray-700 pt-1">{payable.label}</p>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200 text-center">
              <div>
                <p className="text-[11px] text-gray-500">Assigned</p>
                <p className="text-sm font-bold text-gray-900">₱{payable.assignedAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">Already Paid</p>
                <p className="text-sm font-bold text-green-600">₱{(payable.paidAmount || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">Remaining</p>
                <p className="text-sm font-bold text-red-600">₱{remainingBalance.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form id="record-payment-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Amount (₱) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₱</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) =>
                    setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  className="w-full pl-7 pr-4 py-2 border border-[#E0E0E0] rounded-lg text-sm font-bold text-gray-900 focus:ring-2 focus:ring-green-600 outline-none"
                />
              </div>
              {Number(paymentAmount) < remainingBalance && Number(paymentAmount) > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  * This will be recorded as a <strong>partial payment</strong>. Remaining balance will be ₱
                  {(remainingBalance - Number(paymentAmount)).toLocaleString()}.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-green-600 outline-none"
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer / Over the Counter</option>
                <option value="online">Online / e-Wallet (GCash/Maya)</option>
              </select>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-[#E0E0E0] px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="record-payment-form"
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Recording...' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
