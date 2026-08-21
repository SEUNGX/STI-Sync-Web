import { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Users,
  CheckCircle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Eye,
  AlertCircle,
  ExternalLink,
  Layers,
  Shield,
  Tag
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { SaoLedgerDocument, OrgLedgerDocument, TransactionSource } from '../types/finance.types';
import type { PayableDocument } from '../types/payable.types';
import type { LiquidationDocument, ExpenseLineItem } from '../types/liquidation.types';
import type { EventDocument, BudgetLineItem } from '../../events/types/event.types';
import { formatCurrency } from '../../../utils/currency';
import { formatAppDate, formatAppDateTime } from '../../../utils/date';
import ReceiptLightboxModal from './ReceiptLightboxModal';
import { useUserNameResolver } from '../hooks/useUserNameResolver';

interface TransactionDetailModalProps {
  transaction: SaoLedgerDocument | OrgLedgerDocument | null;
  isOpen: boolean;
  onClose: () => void;
  isOfficer?: boolean;
}

const sourceBadgeMap: Record<string, { bg: string; text: string; label: string }> = {
  allocation: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Budget Allocation' },
  student_collection: { bg: 'bg-green-100', text: 'text-green-700', label: 'Student Collection Transfer' },
  manual_expense: { bg: 'bg-red-100', text: 'text-red-700', label: 'Manual Expense' },
  carry_over: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Carry-Over Fund' },
  event_budget: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Approved Event Budget' },
  liquidation_surplus: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Liquidation Surplus Refund' },
  liquidation_deficit: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Liquidation Deficit Expense' },
  sponsorship: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Sponsorship / Grant' },
};

export default function TransactionDetailModal({
  transaction,
  isOpen,
  onClose,
  isOfficer = false,
}: TransactionDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [payables, setPayables] = useState<PayableDocument[]>([]);
  const [eventData, setEventData] = useState<EventDocument | null>(null);
  const [liquidationData, setLiquidationData] = useState<LiquidationDocument | null>(null);
  const { resolveUserName } = useUserNameResolver();
  
  // Lightbox State
  const [selectedReceipt, setSelectedReceipt] = useState<{
    url: string;
    title?: string;
    amount?: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !transaction) {
      setPayables([]);
      setEventData(null);
      setLiquidationData(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    async function loadDetails() {
      try {
        const source = transaction?.source;
        const eventId = transaction?.eventId;
        const collectionId = transaction?.collectionId;

        // 1. Fetch ONLY Payables if Student Collection Transfer
        if (source === 'student_collection') {
          const payablesRef = collection(db, 'payables');
          let matchedPayables: PayableDocument[] = [];

          const descLower = String(transaction?.description || '').toLowerCase();
          const categoryLower = String(transaction?.category || '').toLowerCase();
          const isFineTransaction = descLower.includes('fine') || categoryLower.includes('fine');
          const isMembershipTransaction = descLower.includes('membership') || categoryLower.includes('membership');

          if (collectionId) {
            const qBatch = query(payablesRef, where('transferredBatchId', '==', collectionId));
            const snapBatch = await getDocs(qBatch);
            matchedPayables = snapBatch.docs.map(d => ({ id: d.id, ...d.data() } as PayableDocument));
          }

          // Fallback / Timestamp filter: Query by eventId or org and bound by transaction timestamp & type
          if (matchedPayables.length === 0 && eventId && eventId !== 'unassigned') {
            const targetType = isFineTransaction
              ? (isOfficer ? 'org_fine' : 'admin_fine')
              : (isMembershipTransaction ? 'membership_due' : 'event_fee');

            const qEvent = query(
              payablesRef,
              where('eventId', '==', eventId),
              where('type', '==', targetType)
            );
            const snapEvent = await getDocs(qEvent);
            const allEventPayables = snapEvent.docs.map(d => ({ id: d.id, ...d.data() } as PayableDocument));

            // Filter only those who paid on or before the transaction timestamp
            const txDateMs = transaction?.date?.toMillis ? transaction.date.toMillis() : (transaction?.date?.seconds ? transaction.date.seconds * 1000 : Date.now());
            
            const paidBeforeTx = allEventPayables.filter(p => {
              if (String(p.status || '').toLowerCase() !== 'paid' && (Number(p.paidAmount) || 0) <= 0) return false;
              if (p.paidAt) {
                const paidMs = p.paidAt.toMillis ? p.paidAt.toMillis() : (p.paidAt.seconds ? p.paidAt.seconds * 1000 : 0);
                return paidMs <= txDateMs + 60000; // 1 min buffer
              }
              return true;
            });

            // Sort chronologically
            paidBeforeTx.sort((a, b) => {
              const aMs = a.paidAt?.toMillis ? a.paidAt.toMillis() : (a.paidAt?.seconds ? a.paidAt.seconds * 1000 : 0);
              const bMs = b.paidAt?.toMillis ? b.paidAt.toMillis() : (b.paidAt?.seconds ? b.paidAt.seconds * 1000 : 0);
              return aMs - bMs;
            });

            // Slice records up to the transaction amount if multiple batches exist
            let accumulated = 0;
            const targetAmount = Number(transaction.amount) || 0;
            for (const p of paidBeforeTx) {
              const amt = Number(p.paidAmount) || Number(p.assignedAmount) || 0;
              matchedPayables.push(p);
              accumulated += amt;
              if (targetAmount > 0 && accumulated >= targetAmount) {
                break;
              }
            }
          }

          if (matchedPayables.length === 0 && 'organizationId' in transaction && transaction.organizationId) {
            const qOrg = query(
              payablesRef,
              where('organizationId', '==', transaction.organizationId),
              where('type', '==', isMembershipTransaction ? 'membership_due' : 'org_fine')
            );
            const snapOrg = await getDocs(qOrg);
            matchedPayables = snapOrg.docs.map(d => ({ id: d.id, ...d.data() } as PayableDocument));
          }

          if (isMounted) {
            setPayables(matchedPayables);
          }
        }

        // 2. Fetch ONLY Event Budget Line Items if event_budget
        else if (source === 'event_budget' && eventId && eventId !== 'unassigned') {
          const eventRef = doc(db, 'events', eventId);
          const eventSnap = await getDoc(eventRef);
          if (eventSnap.exists() && isMounted) {
            setEventData({ id: eventSnap.id, ...eventSnap.data() } as EventDocument);
          }
        }

        // 3. Fetch ONLY Liquidation Report if liquidation_surplus or liquidation_deficit
        else if (source === 'liquidation_surplus' || source === 'liquidation_deficit') {
          const liqRef = collection(db, 'liquidations');
          if (eventId && eventId !== 'unassigned') {
            const qLiq = query(liqRef, where('eventId', '==', eventId));
            const snapLiq = await getDocs(qLiq);
            if (!snapLiq.empty && isMounted) {
              setLiquidationData({ id: snapLiq.docs[0].id, ...snapLiq.docs[0].data() } as LiquidationDocument);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load transaction details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDetails();

    return () => {
      isMounted = false;
    };
  }, [isOpen, transaction]);

  if (!isOpen || !transaction) return null;

  const isIncome = String(transaction.type || '').toLowerCase() === 'income';
  const badgeInfo = sourceBadgeMap[transaction.source] || {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    label: (transaction.source as string)?.replace('_', ' ') || 'Transaction',
  };

  const formattedDate = formatAppDateTime(transaction.date, formatAppDate(transaction.date, '—'));
  const source = transaction.source;
  const creatorName = resolveUserName(transaction.addedBy);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in">
        
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isIncome ? 'bg-green-500/20 border border-green-400/40 text-green-300' : 'bg-red-500/20 border border-red-400/40 text-red-300'}`}>
              {isIncome ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Transaction Details</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeInfo.bg} ${badgeInfo.text}`}>
                  {badgeInfo.label}
                </span>
              </div>
              <p className="text-white/70 text-xs mt-0.5">
                {transaction.description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          
          {/* Top KPI Summary Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4.5 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium">Transaction Amount</p>
              <p className={`text-xl font-bold mt-0.5 ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                {isIncome ? `+${formatCurrency(transaction.amount)}` : `−${formatCurrency(transaction.amount)}`}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Exact Date & Time</p>
              <p className="text-xs font-bold text-gray-900 mt-1">{formattedDate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Recorded By</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{creatorName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Reference Batch</p>
              <p className="text-xs font-mono font-bold text-[#001A4D] mt-1 truncate">
                {transaction.collectionId || transaction.id.slice(0, 12)}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              Loading transaction financial breakdown...
            </div>
          ) : (
            <>
              {/* ── STRICT CASE 1: Student Collections & Fines ONLY ── */}
              {source === 'student_collection' && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#0E4EBD]" />
                      <h4 className="font-bold text-sm text-[#001A4D]">
                        Student Payment Records ({payables.length} student record{payables.length !== 1 ? 's' : ''})
                      </h4>
                    </div>
                    <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
                      Transferred Total: {formatCurrency(transaction.amount)}
                    </span>
                  </div>

                  {payables.length === 0 ? (
                    <div className="p-4 bg-gray-50 text-center text-xs text-gray-500 rounded-xl">
                      No individual student payable records found for this batch reference.
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-3.5 py-2.5">Student Name</th>
                            <th className="px-3.5 py-2.5">Student ID</th>
                            <th className="px-3.5 py-2.5">Type / Description</th>
                            <th className="px-3.5 py-2.5">Amount Paid</th>
                            <th className="px-3.5 py-2.5">Exact Date & Time Paid</th>
                            <th className="px-3.5 py-2.5">Method</th>
                            <th className="px-3.5 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                          {payables.map((p) => {
                            const isPaid = p.status === 'paid' || (Number(p.paidAmount) || 0) >= (Number(p.assignedAmount) || 0);
                            const exactPaidTime = p.paidAt
                              ? formatAppDateTime(p.paidAt, formatAppDate(p.paidAt, '—'))
                              : '—';

                            return (
                              <tr key={p.id} className="hover:bg-gray-50/80">
                                <td className="px-3.5 py-2.5 font-semibold text-gray-900">
                                  {p.studentName || 'Student'}
                                </td>
                                <td className="px-3.5 py-2.5 font-mono text-gray-500">
                                  {p.studentSchoolId || p.studentId}
                                </td>
                                <td className="px-3.5 py-2.5 text-gray-700">
                                  <span className="capitalize">{p.type?.replace('_', ' ')}</span>
                                  {p.label && p.label !== p.type && (
                                    <span className="text-[10px] text-gray-400 block truncate max-w-[140px]">{p.label}</span>
                                  )}
                                  {p.fineViolations && p.fineViolations.length > 0 && (
                                    <span className="text-[10px] text-rose-600 block mt-0.5">
                                      Violation: {p.fineViolations.map(v => v.description || v.violationType).join(', ')}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3.5 py-2.5 font-bold text-green-600">
                                  {formatCurrency(p.paidAmount || p.assignedAmount || 0)}
                                </td>
                                <td className="px-3.5 py-2.5 text-gray-600 whitespace-nowrap">
                                  {exactPaidTime}
                                </td>
                                <td className="px-3.5 py-2.5 text-gray-600 capitalize">
                                  {p.paymentMethod || 'cash'}
                                </td>
                                <td className="px-3.5 py-2.5">
                                  {p.transferredToBudget ? (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                                      <CheckCircle className="w-2.5 h-2.5" /> Transferred
                                    </span>
                                  ) : isPaid ? (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">
                                      Paid
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">
                                      Pending
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── STRICT CASE 2: Approved Event Budget ONLY ── */}
              {source === 'event_budget' && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#0E4EBD]" />
                      <h4 className="font-bold text-sm text-[#001A4D]">
                        Approved Event Budget Breakdown ({eventData?.title || 'Event'})
                      </h4>
                    </div>
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                      Approved Total: {formatCurrency(eventData?.totalApprovedBudget || transaction.amount)}
                    </span>
                  </div>

                  {(!eventData?.budgetItems || eventData.budgetItems.length === 0) ? (
                    <div className="p-4 bg-gray-50 text-center text-xs text-gray-500 rounded-xl">
                      No itemized budget line items found for this event.
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-3.5 py-2.5">Item Name</th>
                            <th className="px-3.5 py-2.5">Description</th>
                            <th className="px-3.5 py-2.5 text-center">Qty</th>
                            <th className="px-3.5 py-2.5">Unit Cost</th>
                            <th className="px-3.5 py-2.5 text-right">Approved Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                          {eventData.budgetItems.map((item: BudgetLineItem, idx: number) => {
                            const itemTotal = (Number(item.quantity) || 1) * (Number(item.unitCost) || 0);
                            return (
                              <tr key={item.id || idx} className="hover:bg-gray-50/80">
                                <td className="px-3.5 py-2.5 font-semibold text-gray-900">
                                  {item.item || `Line Item ${idx + 1}`}
                                </td>
                                <td className="px-3.5 py-2.5 text-gray-600 max-w-[200px] truncate">
                                  {item.description || '—'}
                                </td>
                                <td className="px-3.5 py-2.5 text-center text-gray-700 font-medium">
                                  {item.quantity || 1}
                                </td>
                                <td className="px-3.5 py-2.5 text-gray-700">
                                  {formatCurrency(item.unitCost || 0)}
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-bold text-[#001A4D]">
                                  {formatCurrency(itemTotal || item.approvedAmount || 0)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-200 font-bold text-xs text-gray-900">
                          <tr>
                            <td colSpan={4} className="px-3.5 py-2.5 text-right">Total Event Budget:</td>
                            <td className="px-3.5 py-2.5 text-right text-purple-700">
                              {formatCurrency(eventData.totalApprovedBudget || transaction.amount)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── STRICT CASE 3: Liquidation Report ONLY ── */}
              {(source === 'liquidation_surplus' || source === 'liquidation_deficit') && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-[#0E4EBD]" />
                      <h4 className="font-bold text-sm text-[#001A4D]">
                        Liquidation Report & Expense Evidence ({liquidationData?.eventTitle || 'Event'})
                      </h4>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      (liquidationData?.surplusOrDeficit || 0) >= 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {(liquidationData?.surplusOrDeficit || 0) >= 0 ? 'Surplus Refund: ' : 'Deficit Expense: '}
                      {formatCurrency(Math.abs(liquidationData?.surplusOrDeficit || transaction.amount))}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs">
                    <div>
                      <p className="text-gray-500 font-medium">Allocated Budget</p>
                      <p className="text-sm font-bold text-[#001A4D] mt-0.5">
                        {formatCurrency(liquidationData?.allocatedBudget || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Actual Total Spending</p>
                      <p className="text-sm font-bold text-red-600 mt-0.5">
                        {formatCurrency(liquidationData?.totalActualSpending || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Net Variance</p>
                      <p className={`text-sm font-bold mt-0.5 ${(liquidationData?.surplusOrDeficit || 0) >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                        {formatCurrency(liquidationData?.surplusOrDeficit || 0)}
                      </p>
                    </div>
                  </div>

                  {(!liquidationData?.lineItems || liquidationData.lineItems.length === 0) ? (
                    <div className="p-4 bg-gray-50 text-center text-xs text-gray-500 rounded-xl">
                      No expense line items or uploaded receipts found for this liquidation.
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-3.5 py-2.5">Expense Item</th>
                            <th className="px-3.5 py-2.5">Category</th>
                            <th className="px-3.5 py-2.5 text-center">Qty</th>
                            <th className="px-3.5 py-2.5">Total Cost</th>
                            <th className="px-3.5 py-2.5">Receipt / Invoice #</th>
                            <th className="px-3.5 py-2.5 text-center">Receipt Evidence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                          {liquidationData.lineItems.map((item: ExpenseLineItem, idx: number) => (
                            <tr key={item.id || idx} className="hover:bg-gray-50/80">
                              <td className="px-3.5 py-2.5 font-semibold text-gray-900">
                                {item.item || `Expense Item ${idx + 1}`}
                              </td>
                              <td className="px-3.5 py-2.5 text-gray-600">
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-medium">
                                  {item.category || 'General'}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-center text-gray-700">
                                {item.quantity || 1}
                              </td>
                              <td className="px-3.5 py-2.5 font-bold text-gray-900">
                                {formatCurrency(item.totalCost || (item.quantity * item.unitCost) || 0)}
                              </td>
                              <td className="px-3.5 py-2.5 font-mono text-gray-600">
                                {item.receiptNumber || '—'}
                              </td>
                              <td className="px-3.5 py-2.5 text-center">
                                {item.receiptUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedReceipt({
                                      url: item.receiptUrl!,
                                      title: item.item,
                                      amount: item.totalCost,
                                    })}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <Eye className="w-3 h-3" /> View
                                  </button>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">No Receipt</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── STRICT CASE 4: Allocation, Carry-Over, Manual Expense ── */}
              {source !== 'student_collection' && source !== 'event_budget' && source !== 'liquidation_surplus' && source !== 'liquidation_deficit' && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                    <FileText className="w-4 h-4 text-[#0E4EBD]" />
                    <h4 className="font-bold text-sm text-[#001A4D]">Transaction Documentation</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-gray-500 font-medium">Description / Notes</p>
                      <p className="text-sm font-semibold text-gray-800 mt-1">{transaction.description}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Source Type</p>
                      <p className="text-sm font-semibold text-gray-800 mt-1 capitalize">{badgeInfo.label}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#0E4EBD]" />
            <span>Immutable Financial Audit Record</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#001A4D] hover:bg-[#002B7F] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Lightbox for viewing receipts */}
      {selectedReceipt && (
        <ReceiptLightboxModal
          isOpen={true}
          onClose={() => setSelectedReceipt(null)}
          imageUrl={selectedReceipt.url}
          itemTitle={selectedReceipt.title}
          amount={selectedReceipt.amount}
        />
      )}
    </div>
  );
}
