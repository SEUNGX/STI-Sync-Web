import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  X,
  ShieldAlert,
  Coins,
  QrCode,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { toast } from 'sonner';
import { cancelEventTransaction } from '../services/event.service';
import { PAYABLES_COLLECTION } from '../../finance/services/payable.service';
import { LIQUIDATIONS_COLLECTION } from '../../finance/services/liquidation.service';
import type { EventDocument, EventCancellationResult } from '../types/event.types';
import { formatCurrency } from '../../../utils/currency';

export interface CancelEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventDocument | null;
  userRole?: 'admin' | 'officer';
  role?: 'admin' | 'officer';
  userId?: string;
  userName?: string;
  currentOrgId?: string;
  onCancelled?: (result: EventCancellationResult) => void;
  onSuccess?: () => void;
}

const PRESET_REASONS = [
  'Severe Weather / Typhoon Signal Campus Closure',
  'Venue Conflict or Facility Unavailability',
  'Emergency Campus Academic Suspension',
  'Speaker or Keynote Guest Cancellation',
  'Insufficient Participant Turnout & Rescheduling',
];

export function CancelEventModal({
  isOpen,
  onClose,
  event,
  userRole: propUserRole,
  role,
  userId = 'system-user',
  userName = 'System User',
  onCancelled,
  onSuccess,
}: CancelEventModalProps) {
  const userRole = propUserRole || role || 'officer';
  const [reason, setReason] = useState('');
  const [refundPolicy, setRefundPolicy] = useState<'refund_cash' | 'credit_next_event' | 'no_fees_collected'>('refund_cash');
  const [confirmedCheck, setConfirmedCheck] = useState(false);
  const [confirmKeyword, setConfirmKeyword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Impact Preview State
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [unpaidTotal, setUnpaidTotal] = useState(0);
  const [paidCount, setPaidCount] = useState(0);
  const [paidTotal, setPaidTotal] = useState(0);
  const [unlockedTicketsCount, setUnlockedTicketsCount] = useState(0);
  const [liquidationsCount, setLiquidationsCount] = useState(0);

  useEffect(() => {
    if (!isOpen || !event?.id) {
      setReason('');
      setConfirmedCheck(false);
      setConfirmKeyword('');
      return;
    }

    let isMounted = true;
    setLoadingImpact(true);

    const fetchImpactData = async () => {
      try {
        // 1. Fetch payables for this event
        const payablesQ = query(
          collection(db, PAYABLES_COLLECTION),
          where('eventId', '==', event.id)
        );
        const payablesSnap = await getDocs(payablesQ);

        let unpCount = 0;
        let unpSum = 0;
        let pCount = 0;
        let pSum = 0;
        let tickets = 0;

        payablesSnap.docs.forEach((d) => {
          const data = d.data();
          const paidAmt = Number(data.paidAmount || 0);
          const isPaid = data.status === 'paid' || paidAmt > 0;
          const isClosed = data.status === 'waived' || data.status === 'refunded';

          if (data.qrTicketUnlocked === true) {
            tickets++;
          }

          if (!isClosed) {
            if (isPaid) {
              pCount++;
              pSum += paidAmt > 0 ? paidAmt : Number(data.assignedAmount || 0);
            } else {
              unpCount++;
              unpSum += Number(data.assignedAmount || 0);
            }
          }
        });

        // 2. Fetch liquidations for this event
        const liquidationsQ = query(
          collection(db, LIQUIDATIONS_COLLECTION),
          where('eventId', '==', event.id)
        );
        const liquidationsSnap = await getDocs(liquidationsQ);
        const activeLiqs = liquidationsSnap.docs.filter((d) => d.data().status !== 'voided').length;

        if (isMounted) {
          setUnpaidCount(unpCount);
          setUnpaidTotal(unpSum);
          setPaidCount(pCount);
          setPaidTotal(pSum);
          setUnlockedTicketsCount(tickets);
          setLiquidationsCount(activeLiqs);

          if (pCount === 0 && unpCount === 0 && !event.studentPayablesEnabled) {
            setRefundPolicy('no_fees_collected');
          } else if (pCount > 0) {
            setRefundPolicy('refund_cash');
          } else {
            setRefundPolicy('no_fees_collected');
          }
        }
      } catch (err) {
        console.warn('[CancelEventModal] Error calculating impact preview:', err);
      } finally {
        if (isMounted) setLoadingImpact(false);
      }
    };

    fetchImpactData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, event?.id]);

  if (!isOpen || !event) return null;

  const isReasonValid = reason.trim().length >= 10;
  const isKeywordValid = confirmKeyword.trim().toUpperCase() === 'CANCEL';
  const canSubmit = isReasonValid && confirmedCheck && isKeywordValid && !isSubmitting;

  const handleCancelSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const result = await cancelEventTransaction({
        eventId: event.id,
        cancelledBy: userId,
        cancelledByName: userName,
        cancelledByRole: userRole,
        cancellationReason: reason.trim(),
        refundPolicy,
        notifyAttendees: true,
      });

      toast.success('Event Cancelled', {
        description: `Successfully cancelled "${event.title}". Waived ${result.waivedPayablesCount} payables and flagged ${result.refundPendingPayablesCount} for refund.`,
        duration: 6000,
      });

      if (onCancelled) {
        onCancelled(result);
      }
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('[CancelEventModal] Error:', err);
      toast.error('Failed to cancel event', {
        description: err.message || 'Please verify your network connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-red-200 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Danger Header */}
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-5 text-white flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/15 rounded-xl border border-white/20 backdrop-blur-xs">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">Cancel Event &amp; Auto-Waive Finances</h3>
                  <span className="px-2 py-0.5 bg-white/20 rounded text-[11px] font-mono uppercase tracking-wider font-semibold">
                    Irreversible
                  </span>
                </div>
                <p className="text-white/80 text-xs mt-0.5">
                  Event: <strong className="text-white">{event.title}</strong>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Impact Summary Matrix */}
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4.5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-rose-950 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Financial &amp; Operational Impact Preview
                </h4>
                {loadingImpact && (
                  <span className="text-[11px] text-rose-700 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Calculating...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Unpaid Payables / Fines */}
                <div className="bg-white p-3 rounded-lg border border-rose-100 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
                    <Coins className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Auto-Waived</span>
                  </div>
                  <p className="text-base font-extrabold text-gray-900 mt-1">
                    {unpaidCount} <span className="text-xs font-normal text-gray-500">records</span>
                  </p>
                  <p className="text-[11px] font-mono text-emerald-700 font-semibold">
                    {formatCurrency(unpaidTotal)}
                  </p>
                </div>

                {/* Paid Fees / Refunds */}
                <div className="bg-white p-3 rounded-lg border border-rose-100 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
                    <Coins className="w-3.5 h-3.5 text-amber-600" />
                    <span>Refund Pending</span>
                  </div>
                  <p className="text-base font-extrabold text-gray-900 mt-1">
                    {paidCount} <span className="text-xs font-normal text-gray-500">records</span>
                  </p>
                  <p className="text-[11px] font-mono text-amber-700 font-semibold">
                    {formatCurrency(paidTotal)}
                  </p>
                </div>

                {/* Revoked QR Tickets */}
                <div className="bg-white p-3 rounded-lg border border-rose-100 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
                    <QrCode className="w-3.5 h-3.5 text-blue-600" />
                    <span>Revoked Passes</span>
                  </div>
                  <p className="text-base font-extrabold text-gray-900 mt-1">
                    {unlockedTicketsCount} <span className="text-xs font-normal text-gray-500">tickets</span>
                  </p>
                  <p className="text-[11px] text-gray-500">Gate locked</p>
                </div>

                {/* Voided Liquidations */}
                <div className="bg-white p-3 rounded-lg border border-rose-100 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
                    <FileText className="w-3.5 h-3.5 text-purple-600" />
                    <span>Liquidations</span>
                  </div>
                  <p className="text-base font-extrabold text-gray-900 mt-1">
                    {liquidationsCount} <span className="text-xs font-normal text-gray-500">reports</span>
                  </p>
                  <p className="text-[11px] text-gray-500">Marked voided</p>
                </div>
              </div>

              <p className="text-[11px] text-rose-800 leading-relaxed pt-1">
                Executing cancellation will instantly purge active scanner codes, waive all unpaid fines, and queue any collected registration fees for student refunds in the Finance Center.
              </p>
            </div>

            {/* Cancellation Reason (Required, min 10 chars) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800">
                  Cancellation Reason <span className="text-red-500">*</span>
                </label>
                <span className={`text-[11px] font-mono ${reason.trim().length >= 10 ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                  {reason.trim().length} / 10 characters minimum
                </span>
              </div>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Explain why this event is being cancelled (e.g., Severe typhoon warning and campus closure announced by city government)..."
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs leading-relaxed focus:outline-none focus:ring-2 transition-all ${
                  reason.length > 0 && reason.trim().length < 10
                    ? 'border-red-300 focus:ring-red-200 bg-red-50/30'
                    : 'border-gray-300 focus:ring-rose-100 focus:border-rose-500 bg-white'
                }`}
              />

              {/* Preset Reason Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-gray-400 font-medium self-center mr-1">Quick Select:</span>
                {PRESET_REASONS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setReason(preset)}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-rose-50 hover:text-rose-700 text-gray-700 text-[11px] rounded-lg border border-gray-200 transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>



            {/* Safety Confirmation Verification */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-gray-800">
                <input
                  type="checkbox"
                  checked={confirmedCheck}
                  onChange={(e) => setConfirmedCheck(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                />
                <span>
                  I understand that cancelling this event will permanently set its status to <strong>Cancelled</strong>, waive active student fines, revoke QR passes, and abort attached liquidations.
                </span>
              </label>

              <div className="pt-2 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs text-gray-600">
                  Type <strong className="text-red-700 font-mono">CANCEL</strong> to unlock button:
                </span>
                <input
                  type="text"
                  value={confirmKeyword}
                  onChange={(e) => setConfirmKeyword(e.target.value)}
                  placeholder="CANCEL"
                  className="w-36 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono font-bold uppercase tracking-wider text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
            >
              Nevermind, Keep Event
            </button>

            <button
              type="button"
              onClick={handleCancelSubmit}
              disabled={!canSubmit}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Cancellation...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>Confirm &amp; Cancel Event</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CancelEventModal;
