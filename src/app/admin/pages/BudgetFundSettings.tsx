import { useState, useMemo, type ElementType } from "react";
import {
  Plus,
  Building2,
  Info,
  Eye,
  Edit,
  X,
  Save,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  Clock,
  Users,
  DollarSign,
  FileText,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Receipt,
  Layers,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useSemesters } from "../../modules/academic/hooks/useAcademicStream";
import { useSaoLedger } from "../../modules/finance/hooks/useFinanceStream";
import { useAllEventPayablesStream } from "../../modules/finance/hooks/usePayableStream";
import { useAllEvents } from "../../modules/events/hooks/useEventStream";
import { addLedgerTransaction } from "../../modules/finance/services/finance.service";
import { transferCollectionGroupToLedger } from "../../modules/finance/services/payable.service";
import type { SaoLedgerDocument, TransactionSource, TransactionType } from "../../modules/finance/types/finance.types";
import type { StudentEventCollectionGroup } from "../../modules/finance/types/payable.types";
import { Timestamp } from "firebase/firestore";
import { formatCurrency } from "../../utils/currency";
import { formatAppDate, formatAppDateTime } from "../../utils/date";
import TransactionDetailModal from "../../modules/finance/components/TransactionDetailModal";
import { useUserNameResolver } from "../../modules/finance/hooks/useUserNameResolver";

// ─── Add School Budget Allocation Modal ───────────────────────────────────────
function AddBudgetModal({ currentBalance, onClose, onSave }: {
  currentBalance: number;
  onClose: () => void;
  onSave: (tx: Omit<SaoLedgerDocument, "id" | "createdAt">) => void;
}) {
  const { data: semesters } = useSemesters();
  const availableSemesters = semesters.filter(s => s.status === 'ACTIVE' || s.status === 'UPCOMING');

  const [carryOver, setCarryOver] = useState(false);
  const [form, setForm] = useState({ semesterId: "", amount: "", notes: "" });

  const selectedSemester = availableSemesters.find(s => s.id === form.semesterId);

  const handleSave = () => {
    if (!selectedSemester || !form.amount) return;
    const amt = parseFloat(form.amount);
    
    // If carry over is checked and there's a positive balance, add it to this allocation
    const finalAmount = carryOver ? amt + currentBalance : amt;

    onSave({
      semesterId: selectedSemester.id,
      date: Timestamp.fromDate(new Date()),
      description: `SAO Institutional Fund – ${selectedSemester.label}${form.notes ? ` (${form.notes})` : ""}`,
      eventId: null,
      type: "income",
      source: "allocation",
      amount: finalAmount,
      addedBy: "Admin SAO",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[560px] overflow-hidden">
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-[#FFD41C]" />
            <h3 className="text-white font-bold text-base">Add School Budget Allocation</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Semester <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
              value={form.semesterId}
              onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
            >
              <option value="">Select semester...</option>
              {availableSemesters.map(sem => (
                <option key={sem.id} value={sem.id}>{sem.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">School Year</label>
            <input
              type="text"
              value={selectedSemester?.academicYear || ""}
              readOnly
              className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-lg text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Total School Budget for This Semester (₱) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
              <input
                type="number"
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">This is the total SAS fund available for student organization activities this semester.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes / Source of Funds</label>
            <textarea
              rows={2}
              placeholder="e.g. Annual institutional allocation from school administration"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] resize-none"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className={`flex items-start gap-3 p-4 border rounded-lg ${currentBalance > 0 ? "bg-gray-50 border-gray-200" : "bg-gray-50/50 border-gray-100 opacity-60"}`}>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Carry Over Unspent Balance from Previous Semester</p>
              <p className="text-xs text-gray-500 mt-0.5">Unspent from previous semester: {formatCurrency(currentBalance)}</p>
              {carryOver && currentBalance > 0 && (
                <p className="text-xs text-[#0E4EBD] font-medium mt-1">
                  Total Effective Budget = {formatCurrency(parseFloat(form.amount || "0") + currentBalance)}
                </p>
              )}
            </div>
            <button
              disabled={currentBalance <= 0}
              onClick={() => setCarryOver(!carryOver)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer ${currentBalance <= 0 ? "bg-gray-200 cursor-not-allowed" : carryOver ? "bg-[#0E4EBD]" : "bg-gray-300"}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${carryOver && currentBalance > 0 ? "translate-x-6" : ""}`} />
            </button>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-blue-800 text-xs">
                This adds an income entry to the school budget ledger. Club and organization budgets are managed independently by their own officers — this allocation is for SAO-level expenses only.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer">Cancel</button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-[#001A4D] text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-[#001A4D]/90 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save Budget Allocation
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Collection Detail / Transfer Modal ───────────────────────────────────────
function CollectionDetailModal({
  collection,
  onClose,
  onTransfer,
}: {
  collection: StudentEventCollectionGroup;
  onClose: () => void;
  onTransfer: () => void;
}) {
  const paid = collection.payments.filter((p) => p.status === "Paid");
  const pending = collection.payments.filter((p) => p.status === "Pending");
  const totalCollected = paid.reduce((s, p) => s + p.amount, 0);
  
  const alreadyTransferred = paid.filter((p) => p.transferredToBudget);
  const alreadyTransferredAmount = collection.payments.reduce((s, p) => s + (p.transferredAmount !== undefined ? p.transferredAmount : (p.transferredToBudget ? p.amount : 0)), 0);
  
  const untransferred = paid.filter((p) => !p.transferredToBudget);
  const untransferredAmount = collection.payments.reduce((s, p) => s + (p.untransferredAmount !== undefined ? p.untransferredAmount : (p.status === 'Paid' && !p.transferredToBudget ? p.amount : 0)), 0);

  const collectionPct = collection.totalStudents > 0 
    ? Math.round((paid.length / collection.totalStudents) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[680px] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-bold text-base">{collection.eventName}</h3>
              <span className="px-2 py-0.5 bg-[#FFD41C] text-[#001A4D] rounded-full text-xs font-bold capitalize">
                {collection.type?.replace('_', ' ') || 'Collection'}
              </span>
            </div>
            <p className="text-blue-100 text-xs mt-0.5">Student Payables & Fines Collection Breakdown · {collection.eventDate}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-xs font-medium">Total Students</p>
              <p className="text-lg font-bold text-[#001A4D] mt-0.5">{collection.totalStudents}</p>
              <p className="text-[10px] text-gray-400">{collectionPct}% Paid</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-xs font-medium">Total Collected</p>
              <p className="text-lg font-bold text-green-700 mt-0.5">{formatCurrency(totalCollected)}</p>
              <p className="text-[10px] text-gray-400">{paid.length} student(s)</p>
            </div>
            <div className="bg-white border border-blue-200 rounded-xl p-3 text-center bg-blue-50/30">
              <p className="text-blue-700 text-xs font-medium">In School Budget</p>
              <p className="text-lg font-bold text-blue-700 mt-0.5">{formatCurrency(alreadyTransferredAmount)}</p>
              <p className="text-[10px] text-blue-600">{alreadyTransferred.length} transferred</p>
            </div>
            <div className="bg-white border border-amber-200 rounded-xl p-3 text-center bg-amber-50/40">
              <p className="text-amber-800 text-xs font-medium">Ready to Transfer</p>
              <p className="text-lg font-bold text-amber-700 mt-0.5">{formatCurrency(untransferredAmount)}</p>
              <p className="text-[10px] text-amber-600">{untransferred.length} newly paid</p>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <p className="text-[#001A4D] text-xs font-bold uppercase tracking-wide">Individual Student Payment Records</p>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-green-700 font-medium bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                  <CheckCircle className="w-3 h-3" />{paid.length} Paid
                </span>
                {pending.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    <Clock className="w-3 h-3" />{pending.length} Pending
                  </span>
                )}
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3.5 py-2">Student</th>
                    <th className="px-3.5 py-2">Student ID</th>
                    <th className="px-3.5 py-2">Amount</th>
                    <th className="px-3.5 py-2">Date Paid</th>
                    <th className="px-3.5 py-2">Transfer State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {collection.payments.map((p) => {
                    const isStudentPaid = p.status === "Paid";
                    return (
                      <tr key={p.id} className={!isStudentPaid ? "bg-amber-50/30" : "hover:bg-gray-50"}>
                        <td className="px-3.5 py-2.5 text-[#001A4D] font-medium">{p.name}</td>
                        <td className="px-3.5 py-2.5 text-gray-500 font-mono">{p.studentId}</td>
                        <td className="px-3.5 py-2.5">
                          <span className={`font-bold ${isStudentPaid ? "text-green-600" : "text-gray-400"}`}>
                            {isStudentPaid ? formatCurrency(p.amount) : "—"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-gray-500 whitespace-nowrap">{p.paidDate}</td>
                        <td className="px-3.5 py-2.5">
                          {isStudentPaid && p.transferredToBudget ? (
                            <span className="px-2 py-0.5 text-[11px] rounded-full font-bold bg-blue-100 text-blue-700 inline-flex items-center gap-1">
                              <CheckCircle className="w-2.5 h-2.5" /> Transferred {p.transferredAt ? `(${p.transferredAt})` : ''}
                            </span>
                          ) : isStudentPaid && (p.transferredAmount || 0) > 0 ? (
                            <span className="px-2 py-0.5 text-[11px] rounded-full font-bold bg-indigo-100 text-indigo-700 inline-flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> Partially Transferred (+{formatCurrency(p.untransferredAmount || 0)} new)
                            </span>
                          ) : isStudentPaid ? (
                            <span className="px-2 py-0.5 text-[11px] rounded-full font-bold bg-green-100 text-green-700 inline-flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> Newly Paid · Ready to Transfer
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[11px] rounded-full font-medium bg-amber-100 text-amber-700">
                              Pending Payment
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {untransferredAmount > 0 && alreadyTransferredAmount > 0 && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-blue-800 text-xs leading-relaxed">
                <strong>Incremental Transfer:</strong> {formatCurrency(alreadyTransferredAmount)} was previously credited to the school budget. You can now transfer the new {formatCurrency(untransferredAmount)} collected from {untransferred.length} additional student(s) without duplicating past records.
              </p>
            </div>
          )}

          {pending.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-xs leading-relaxed">
                {pending.length} student{pending.length > 1 ? "s have" : " has"} not yet paid. You can transfer the currently collected amount now, and transfer any future student payments later at any time.
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0 bg-white">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 cursor-pointer">
            Close
          </button>
          
          {untransferredAmount > 0 ? (
            <button
              onClick={() => { onTransfer(); onClose(); }}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Transfer {formatCurrency(untransferredAmount)} to School Budget
            </button>
          ) : totalCollected > 0 ? (
            <div className="flex-1 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm font-bold text-center flex items-center justify-center gap-2 select-none">
              <CheckCircle className="w-4 h-4" />
              All Paid Collections Transferred ({formatCurrency(totalCollected)})
            </div>
          ) : (
            <div className="flex-1 py-2.5 bg-gray-100 text-gray-400 rounded-xl text-sm font-medium text-center flex items-center justify-center gap-2 select-none">
              No Collected Cash to Transfer
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Manual Expense Modal ──────────────────────────────────────────────────
function AddExpenseModal({ activeSemesterId, events, onClose, onSave }: {
  activeSemesterId: string | null;
  events: any[];
  onClose: () => void;
  onSave: (tx: Omit<SaoLedgerDocument, "id" | "createdAt">) => void;
}) {
  const [form, setForm] = useState({ description: "", event: "", amount: "", date: new Date().toISOString().split("T")[0] });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden">
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArrowUpRight className="w-5 h-5 text-[#FFD41C]" />
            <h3 className="text-white font-bold text-base">Add Budget Expense</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₱) <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                <input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-red-500">*</span></label>
            <input type="text" placeholder="e.g. Expense – Tech Symposium 2026" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Related Event (optional)</label>
            <select value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]">
              <option value="">— No specific event —</option>
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>{evt.title}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 cursor-pointer">Cancel</button>
          <button
            onClick={() => {
              if (!form.description || !form.amount || !form.date) return;
              onSave({
                semesterId: activeSemesterId,
                date: Timestamp.fromDate(new Date(form.date)),
                description: form.description,
                eventId: form.event || null,
                type: "expense",
                source: "manual_expense",
                amount: parseFloat(form.amount),
                addedBy: "Admin SAO",
              });
              onClose();
            }}
            className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save Expense
          </button>
        </div>
      </div>
    </div>
  );
}

type MainTab = "ledger" | "collections";

// ─── Source badge helpers ──────────────────────────────────────────────────────
const sourceBadgeMap: Record<TransactionSource, string> = {
  allocation: "bg-blue-100 text-blue-700",
  student_collection: "bg-green-100 text-green-700",
  manual_expense: "bg-red-100 text-red-600",
  carry_over: "bg-blue-50 text-[#001A4D] font-bold border border-blue-100",
  event_budget: "bg-purple-100 text-purple-700",
  liquidation_surplus: "bg-emerald-100 text-emerald-700",
  liquidation_deficit: "bg-rose-100 text-rose-700",
};

const sourceLabel: Record<TransactionSource, string> = {
  allocation: "School Allocation",
  student_collection: "Student Collection",
  manual_expense: "SAO Expense",
  carry_over: "Carry-Over",
  event_budget: "Event Budget Allocation",
  liquidation_surplus: "Liquidation Surplus Refund",
  liquidation_deficit: "Liquidation Deficit Expense",
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function BudgetFundSettings() {
  const [tab, setTab] = useState<MainTab>("ledger");
  const { data: rawTransactions, loading: ledgerLoading } = useSaoLedger();
  const { data: collections, loading: collectionsLoading } = useAllEventPayablesStream();
  const { events: dbEvents, loading: eventsLoading } = useAllEvents();
  const { data: semesters } = useSemesters();
  const activeSemester = semesters.find(s => s.status === 'ACTIVE') || null;
  const { resolveUserName } = useUserNameResolver();
  
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [viewCollection, setViewCollection] = useState<StudentEventCollectionGroup | null>(null);
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<SaoLedgerDocument | null>(null);
  
  const [txFilter, setTxFilter] = useState<"all" | "income" | "expense">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [semesterFilter, setSemesterFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loading = ledgerLoading || collectionsLoading || eventsLoading;

  const eventMap = useMemo(() => {
    const map = new Map<string, string>();
    (dbEvents || []).forEach((e) => {
      if (e.id && e.title) map.set(e.id, e.title);
    });
    return map;
  }, [dbEvents]);

  // Calculate running dynamic balances for the ledger
  const transactions = useMemo(() => {
    let running = 0;
    return rawTransactions.map((tx) => {
      const amt = Number(tx.amount) || 0;
      const isInc = String(tx.type || '').toLowerCase() === "income";
      if (isInc) running += amt;
      else running -= amt;
      return { ...tx, amount: amt, balance: running };
    });
  }, [rawTransactions]);

  const filteredTx = useMemo(() => {
    return transactions.filter((t) => {
      const typeLower = (t.type || '').toLowerCase();
      const passType =
        txFilter === "all"
          ? true
          : txFilter === "income"
          ? typeLower === "income"
          : typeLower === "expense";

      const passSource = sourceFilter === "all" ? true : t.source === sourceFilter;
      const passSem = semesterFilter === "all" ? true : (!t.semesterId || t.semesterId === semesterFilter);
      
      const q = searchQuery.trim().toLowerCase();
      const displayEvent = t.eventId ? (eventMap.get(t.eventId) || '') : '';
      const passSearch = !q
        ? true
        : (t.description || '').toLowerCase().includes(q) ||
          displayEvent.toLowerCase().includes(q) ||
          (t.addedBy || '').toLowerCase().includes(q) ||
          (t.collectionId || '').toLowerCase().includes(q);

      return passType && passSource && passSem && passSearch;
    });
  }, [transactions, txFilter, sourceFilter, semesterFilter, searchQuery, eventMap]);

  // Calculate totals based on the ledger transactions
  const currentBalance = transactions.length > 0 ? (transactions[transactions.length - 1]?.balance ?? 0) : 0;
  const filteredIncome = filteredTx.filter((t) => String(t.type || '').toLowerCase() === "income").reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const filteredExpense = filteredTx.filter((t) => String(t.type || '').toLowerCase() === "expense").reduce((s, t) => s + (Number(t.amount) || 0), 0);
  
  // Pending collections calculations
  const pendingCollections = collections.filter((c) => (c.untransferredAmount || 0) > 0 || !c.transferredToBudget);
  const pendingTotal = collections.reduce((s, c) => s + (c.untransferredAmount || 0), 0);

  const handleSaveTransaction = async (tx: Omit<SaoLedgerDocument, "id" | "createdAt">) => {
    try {
      await addLedgerTransaction(tx);
      toast.success("Transaction saved successfully.");
    } catch (err) {
      console.error("Failed to save transaction", err);
      toast.error("Failed to save transaction.");
    }
  };

  const handleTransferCollection = async (collectionItem: StudentEventCollectionGroup) => {
    try {
      const res = await transferCollectionGroupToLedger({
        collectionGroupId: collectionItem.id,
        eventId: collectionItem.eventId !== 'unassigned' ? collectionItem.eventId : null,
        type: collectionItem.type,
        targetLedger: 'sao',
        semesterId: activeSemester?.id || null,
        recordedByUid: 'Admin SAO',
        collectionName: collectionItem.eventName,
      });

      if (res.transferredCount > 0) {
        toast.success(`Transferred ${formatCurrency(res.transferredAmount)} across ${res.transferredCount} payment(s) to SAO School Budget.`);
      } else {
        toast.info('No pending paid collections available to transfer.');
      }
    } catch (err: any) {
      console.error('Failed to transfer collection to school budget:', err);
      toast.error(err?.message || 'Failed to transfer collection.');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading school budget ledger...</div>;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">School Budget & Fund Management</h2>
          <p className="text-gray-500 text-sm">
            Finance &rsaquo; {tab === "ledger" ? "Budget Tracker" : "Student Collections"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddExpense(true)}
            className="px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            Add Expense
          </button>
          <button
            onClick={() => setShowAddBudget(true)}
            className="px-4 py-2.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#FFD41C]" />
            Add School Budget
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Current Balance</span>
            <Wallet className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-[#001A4D]">{formatCurrency(currentBalance)}</p>
          <p className="text-xs text-gray-400 mt-1">Total Available School Budget</p>
        </div>

        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Income</span>
            <ArrowDownLeft className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">+{formatCurrency(filteredIncome)}</p>
          <p className="text-xs text-gray-400 mt-1">Allocations, Collections, Refunds</p>
        </div>

        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Expenses</span>
            <ArrowUpRight className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">−{formatCurrency(filteredExpense)}</p>
          <p className="text-xs text-gray-400 mt-1">Expenses, Events, Deficits</p>
        </div>

        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Collections</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(pendingTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">{pendingCollections.length} Collection Group(s) with untransferred funds</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-gray-200 gap-1">
        {([
          { id: "ledger" as MainTab, label: "Budget Tracker & Transaction Details" },
          { id: "collections" as MainTab, label: "Student Collections & Payables", badge: pendingTotal > 0 ? `${formatCurrency(pendingTotal)} ready` : undefined },
        ]).map(({ id, label, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              tab === id
                ? "bg-[#001A4D] text-white border-[#FFD41C] -mb-px rounded-t-xl"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
            {badge ? (
              <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                tab === id ? "bg-[#FFD41C] text-[#001A4D]" : "bg-amber-100 text-amber-800"
              }`}>
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Budget Ledger & Tracker ── */}
      {tab === "ledger" && (
        <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
            <div className="border-l-4 border-[#0E4EBD] pl-3">
              <h3 className="text-[#001A4D] font-bold text-base">Transaction History & Ledger</h3>
              <p className="text-gray-500 text-xs mt-0.5">Comprehensive audit log of school budget income and expenses</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Search */}
              <div className="relative flex-1 md:w-56">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-gray-50 border border-gray-200 text-gray-700 outline-none focus:ring-2 focus:ring-[#0E4EBD]/20"
                />
              </div>

              {/* Semester Filter */}
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 border border-gray-200 text-gray-700 outline-none focus:ring-2 focus:ring-[#0E4EBD]/20 cursor-pointer"
              >
                <option value="all">All Semesters</option>
                {semesters?.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>

              {/* Source Filter */}
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 border border-gray-200 text-gray-700 outline-none focus:ring-2 focus:ring-[#0E4EBD]/20 cursor-pointer"
              >
                <option value="all">All Sources</option>
                <option value="allocation">School Allocation</option>
                <option value="student_collection">Student Collections</option>
                <option value="event_budget">Event Budgets</option>
                <option value="liquidation_surplus">Liquidation Surplus</option>
                <option value="liquidation_deficit">Liquidation Deficit</option>
                <option value="manual_expense">SAO Expenses</option>
              </select>

              <div className="w-px h-6 bg-gray-200 self-center hidden md:block"></div>

              {/* Income / Expense Tabs */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                {(["all", "income", "expense"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setTxFilter(f)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors cursor-pointer ${
                      txFilter === f
                        ? "bg-[#001A4D] text-[#FFD41C] shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {f === "all" ? "All" : f === "income" ? "Income +" : "Expenses −"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[520px] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full relative">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-xs border-b border-[#E0E0E0]">
                <tr>
                  {["Date", "Description", "Related Event", "Source", "Amount", "Running Balance", "Action"].map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-[#E0E0E0]">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTx.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                      No transactions found matching your filters.
                    </td>
                  </tr>
                ) : (
                  [...filteredTx].reverse().map((tx) => {
                    const linkedCollection = tx.collectionId
                      ? collections.find((c) => c.id === tx.collectionId || c.id.includes(tx.collectionId!)) ?? null
                      : null;

                    const displayEventName = tx.eventId
                      ? (eventMap.get(tx.eventId) || tx.eventId)
                      : (linkedCollection?.eventName ?? null);

                    return (
                      <tr key={tx.id} className={`transition-colors ${tx.source === "student_collection" ? "bg-green-50/30 hover:bg-green-50/60" : "hover:bg-gray-50"}`}>
                        <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                          {formatAppDate(tx.date, "—")}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[#001A4D] text-sm font-medium">{tx.description}</p>
                          {(() => {
                            const creator = resolveUserName(tx.addedBy);
                            return creator ? (
                              <p className="text-gray-400 text-[11px] mt-0.5">By {creator}</p>
                            ) : null;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium text-sm">
                          {displayEventName ? displayEventName : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${sourceBadgeMap[tx.source] || "bg-gray-100 text-gray-700"}`}>
                            {sourceLabel[tx.source] || tx.source}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold flex items-center gap-1 ${tx.type === "income" ? "text-green-600" : "text-red-500"}`}>
                            {tx.type === "income" ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                            {tx.type === "income" ? `+${formatCurrency(tx.amount)}` : `−${formatCurrency(tx.amount)}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#001A4D] font-semibold text-sm">
                          {formatCurrency(tx.balance)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedTxForDetail(tx)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#0E4EBD] hover:text-white hover:bg-[#0E4EBD] border border-[#0E4EBD]/30 rounded-lg font-medium whitespace-nowrap cursor-pointer transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-[#001A4D] shadow-md">
                  <td colSpan={4} className="px-4 py-3 text-white font-bold text-sm bg-[#001A4D]">Current School Budget Balance</td>
                  <td colSpan={3} className="px-4 py-3 text-[#FFD41C] font-bold text-lg bg-[#001A4D]">{formatCurrency(currentBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Student Collections Tab ── */}
      {tab === "collections" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-900 font-bold text-sm">Centralized Student Collections & Fines</p>
              <p className="text-amber-800 text-xs mt-0.5 leading-relaxed">
                Events with student payables and attendance fines are listed below. Click <strong>View Details</strong> to see student-level payments and transfer newly collected funds into the school budget.
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="border-l-4 border-[#0E4EBD] pl-3">
                <h3 className="text-[#001A4D] font-bold text-base">Student Collections & Payables</h3>
                <p className="text-gray-500 text-xs mt-0.5">Event registration fees, fines, and activities</p>
              </div>
              {pendingTotal > 0 && (
                <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Ready to Transfer: {formatCurrency(pendingTotal)}
                </span>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {["Event / Payable Name", "Type", "Fee / Student", "Students", "Paid", "Total Collected", "Status", "Action"].map((col) => (
                      <th key={col} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {collections.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                        No student payable collections found.
                      </td>
                    </tr>
                  ) : (
                    collections.map((c) => {
                      const paid = c.payments.filter((p) => p.status === "Paid");
                      const totalCollected = paid.reduce((s, p) => s + p.amount, 0);
                      const pct = c.totalStudents > 0 ? Math.round((paid.length / c.totalStudents) * 100) : 0;
                      const untransferred = c.untransferredAmount || 0;
                      const hasTransferred = (c.transferredAmount || 0) > 0;

                      return (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-[#001A4D] font-medium text-sm">{c.eventName}</p>
                            <p className="text-gray-400 text-xs">{c.eventDate}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium capitalize">
                              {c.type?.replace('_', ' ') || 'Event Fee'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 text-sm font-medium">{formatCurrency(c.payablePerStudent)}</td>
                          <td className="px-4 py-3 text-gray-600 text-sm">{c.totalStudents}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-green-600 text-sm font-medium">{paid.length}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-green-700 font-bold text-sm">{formatCurrency(totalCollected)}</span>
                          </td>
                          <td className="px-4 py-3">
                            {untransferred > 0 && hasTransferred ? (
                              <span className="flex items-center gap-1 text-xs text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Partially Transferred (+{formatCurrency(untransferred)} new)
                              </span>
                            ) : untransferred > 0 ? (
                              <span className="flex items-center gap-1 text-xs text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Ready to Transfer ({formatCurrency(untransferred)})
                              </span>
                            ) : c.transferredToBudget ? (
                              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                                <CheckCircle className="w-3 h-3" />
                                Fully Transferred
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                No Payments
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setViewCollection(c)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-white text-xs rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View & Transfer
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddBudget && (
        <AddBudgetModal
          currentBalance={currentBalance}
          onClose={() => setShowAddBudget(false)}
          onSave={handleSaveTransaction}
        />
      )}
      
      {showAddExpense && (
        <AddExpenseModal
          activeSemesterId={activeSemester?.id || null}
          events={dbEvents}
          onClose={() => setShowAddExpense(false)}
          onSave={handleSaveTransaction}
        />
      )}
      
      {viewCollection && (
        <CollectionDetailModal
          collection={viewCollection}
          onClose={() => setViewCollection(null)}
          onTransfer={() => handleTransferCollection(viewCollection)}
        />
      )}

      {selectedTxForDetail && (
        <TransactionDetailModal
          transaction={selectedTxForDetail}
          isOpen={true}
          onClose={() => setSelectedTxForDetail(null)}
          isOfficer={false}
        />
      )}
    </div>
  );
}
