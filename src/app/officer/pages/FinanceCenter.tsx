import { useState, useMemo } from "react";
import { toast } from 'sonner';

import { useOrgLedger } from '../../modules/finance/hooks/useFinanceStream';
import { addOrgLedgerTransaction } from '../../modules/finance/services/finance.service';
import { useSemesters } from '../../modules/academic/hooks/useAcademicStream';
import { useOrgPayables, useOrgCollectionsStream } from '../../modules/finance/hooks/usePayableStream';
import { transferCollectionGroupToLedger } from '../../modules/finance/services/payable.service';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import type { OrgLedgerDocument } from '../../modules/finance/types/finance.types';
import type { PayableDocument, StudentEventCollectionGroup } from '../../modules/finance/types/payable.types';
import { Timestamp } from 'firebase/firestore';

import { GenerateDuesModal } from '../components/GenerateDuesModal';
import { AddPayableModal } from '../components/AddPayableModal';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { formatCurrency, formatVariance } from '../../utils/currency';
import { formatAppDate, formatAppDateTime } from '../../utils/date';

import {
  Building2,
  TrendingUp,
  Wallet,
  Coins,
  CheckCircle,
  AlertCircle,
  Clock,
  Plus,
  Archive,
  Eye,
  X,
  Download,
  FileText,
  Users,
  History,
  ArrowRight,
  ArrowDownLeft,
  Shield,
  RefreshCw,
  Info,
  Minus,
  ChevronRight,
  Receipt,
  Search,
  Filter,
  DollarSign,
  Edit3,
  FileSpreadsheet,
} from "lucide-react";

type FinanceTab = "budget" | "collections" | "payables" | "liquidation";
type PayableSubTab = "member" | "type" | "overdue";

import { useOrgLiquidations } from '../../modules/finance/hooks/useLiquidationStream';
import OfficerLiquidationModal from '../components/OfficerLiquidationModal';
import ReceiptLightboxModal from '../../modules/finance/components/ReceiptLightboxModal';
import { LiquidationExportPreviewModal } from '../../modules/finance/components/LiquidationExportPreviewModal';
import type { LiquidationDocument, LiquidationStatus } from '../../modules/finance/types/liquidation.types';



// ─── Metrics Row ───────────────────────────────────────────────────────────────

function MetricsRow({
  isPast,
  ledgerData,
  semesterId,
  payablesData,
}: {
  isPast: boolean;
  ledgerData: OrgLedgerDocument[];
  semesterId: string;
  payablesData: PayableDocument[];
}) {
  const totalPayables = payablesData.reduce((a, p) => a + (p.assignedAmount || 0), 0);
  const totalCollected = payablesData.reduce((a, p) => a + (p.paidAmount || 0), 0);
  const totalOutstanding = totalPayables - totalCollected;

  const currentSemTransactions = useMemo(() => {
    if (semesterId === "all") return ledgerData;
    return ledgerData.filter((t) => t.semesterId === semesterId);
  }, [ledgerData, semesterId]);

  const totalIncome = currentSemTransactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpenses = currentSemTransactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const currentBalance = totalIncome - totalExpenses;

  const cards = [
    { label: "Club Total Funds (Income)", value: formatCurrency(totalIncome), note: "this semester", color: "text-[#001A4D]", icon: Building2 },
    { label: "Total Club Expenditures", value: formatCurrency(totalExpenses), note: "this semester", color: "text-blue-600", icon: TrendingUp },
    { label: "Current Club Balance", value: formatCurrency(currentBalance), note: "available funds", color: "text-green-600", icon: Wallet },
    { label: "Total Payables Assigned", value: formatCurrency(totalPayables), note: `across ${payablesData.length} payable doc(s)`, color: "text-[#001A4D]", icon: Coins },
    { label: "Total Collected", value: formatCurrency(totalCollected), note: "collected payments", color: "text-green-600", icon: CheckCircle },
    { label: "Total Outstanding", value: formatCurrency(totalOutstanding), note: `outstanding balance`, color: "text-red-600", icon: AlertCircle },
  ];

  return (
    <div className={`grid grid-cols-3 gap-4 ${isPast ? "opacity-80" : ""}`}>
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="bg-white border border-[#E0E0E0] rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-gray-500 text-xs">{c.label}</p>
              <Icon className="w-5 h-5 text-gray-300" />
            </div>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{c.note}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Budget Tracker Tab ────────────────────────────────────────────────────────

function AddOrgIncomeModal({
  organizationId,
  organizationName,
  officerStudentId,
  onClose,
  onSuccess,
}: {
  organizationId: string;
  organizationName: string;
  officerStudentId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data: semesters } = useSemesters();
  const availableSemesters = semesters.filter((s) => s.status === 'ACTIVE' || s.status === 'UPCOMING');
  const activeSemester = semesters.find((s) => s.status === 'ACTIVE');
  const [form, setForm] = useState({ amount: "", notes: "", semesterId: activeSemester?.id || "" });
  const [carryOver, setCarryOver] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!form.amount || isNaN(Number(form.amount))) return;
    setLoading(true);
    try {
      await addOrgLedgerTransaction({
        organizationId,
        semesterId: form.semesterId || null,
        date: Timestamp.now(),
        description: carryOver ? "Carry-over from previous semester" : (form.notes || "Budget Allocation/Income"),
        eventId: null,
        type: "income",
        source: carryOver ? "carry_over" : "allocation",
        amount: parseFloat(form.amount),
        addedBy: officerStudentId,
      });
      onSuccess();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[520px] overflow-hidden">
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-[#FFD41C]" />
            <h3 className="text-white font-bold text-base">Add Club Income / Allocation</h3>
            <span className="px-2.5 py-0.5 bg-[#FFD41C] text-[#001A4D] text-xs font-bold rounded-full">{organizationName}</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Academic Semester <span className="text-red-500">*</span></label>
            <select
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent"
              value={form.semesterId}
              onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
            >
              <option value="">Select semester...</option>
              {availableSemesters.map((sem) => (
                <option key={sem.id} value={sem.id}>{sem.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₱) <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₱</span>
              <input
                type="number"
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes / Justification</label>
            <textarea
              rows={2}
              placeholder="Why is this income added? (e.g. Sponsorship, Allocation)"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent resize-none"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <input type="checkbox" id="carryOver" checked={carryOver} onChange={(e) => setCarryOver(e.target.checked)} className="w-4 h-4 text-[#0E4EBD] rounded focus:ring-[#0E4EBD]" />
            <label htmlFor="carryOver" className="text-sm text-gray-700 font-medium">Mark as carry-over from previous semester</label>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Income"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddOrgExpenseModal({
  organizationId,
  officerStudentId,
  onClose,
  onSuccess,
}: {
  organizationId: string;
  officerStudentId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data: semesters } = useSemesters();
  const activeSemester = semesters.find((s) => s.status === 'ACTIVE');
  const [form, setForm] = useState({ amount: "", notes: "", eventId: "" });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!form.amount || isNaN(Number(form.amount))) return;
    setLoading(true);
    try {
      await addOrgLedgerTransaction({
        organizationId,
        semesterId: activeSemester?.id || null,
        date: Timestamp.now(),
        description: form.notes || "Manual Expense",
        eventId: form.eventId || null,
        type: "expense",
        source: "manual_expense",
        amount: parseFloat(form.amount),
        addedBy: officerStudentId,
      });
      onSuccess();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[520px] overflow-hidden">
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Minus className="w-5 h-5 text-white" />
            <h3 className="text-white font-bold text-base">Record Manual Expense</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₱) <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₱</span>
              <input
                type="number"
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="e.g. Purchased supplies for event"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-blue-800 text-xs">
              Use this form to record expenses that were not processed through a formal Liquidation Report.
            </p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : "Record Expense"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BudgetTrackerTab({
  isPast,
  ledgerData,
  semesterId,
  organizationId,
  organizationName,
  officerStudentId,
}: {
  isPast: boolean;
  ledgerData: OrgLedgerDocument[];
  semesterId: string;
  organizationId: string;
  organizationName: string;
  officerStudentId: string;
}) {
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense'>('all');

  const currentSemTransactions = useMemo(() => {
    if (semesterId === "all") return ledgerData;
    return ledgerData.filter((t) => t.semesterId === semesterId);
  }, [ledgerData, semesterId]);

  let runningBalance = 0;
  const tableRows = currentSemTransactions
    .map((t) => {
      if (t.type === 'income') runningBalance += t.amount;
      else runningBalance -= t.amount;
      return { ...t, runningBalance };
    })
    .reverse();

  const filteredRows = useMemo(() => {
    return tableRows.filter((item) => {
      if (txFilter === 'all') return true;
      return (item.type || '').toLowerCase() === txFilter;
    });
  }, [tableRows, txFilter]);

  const currentClubBalance = useMemo(() => {
    const inc = currentSemTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = currentSemTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return inc - exp;
  }, [currentSemTransactions]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="border-l-4 border-[#0E4EBD] pl-3">
            <h3 className="text-[#001A4D] font-bold text-sm">Budget Ledger Transactions</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              {(['all', 'income', 'expense'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTxFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-colors cursor-pointer ${
                    txFilter === f
                      ? 'bg-[#001A4D] text-[#FFD41C] shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'income' ? 'Income +' : 'Expenses −'}
                </button>
              ))}
            </div>
            {!isPast && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5 text-[#0E4EBD]" />
                  Record Expense
                </button>
                <button
                  onClick={() => setShowAddIncome(true)}
                  className="px-3 py-1.5 bg-[#001A4D] text-white text-xs rounded-lg hover:bg-[#002B7F] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-[#FFD41C]" />
                  Add Income
                </button>
              </div>
            )}
          </div>
        </div>
        {isPast && (
          <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-200">
            <Archive className="w-4 h-4 text-amber-600" />
            <p className="text-amber-700 text-xs font-medium">Historical Data — All records are read-only.</p>
          </div>
        )}
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full relative">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-xs border-b border-[#E0E0E0]">
              <tr>
                {["Date", "Description", "Source", "Amount (₱)", "Balance (₱)"].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-[#E0E0E0]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                    No {txFilter === 'all' ? '' : txFilter} transactions found for this semester.
                  </td>
                </tr>
              ) : (
                filteredRows.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">
                      {formatAppDate(item.date, 'Unknown')}
                    </td>
                    <td className="px-4 py-3 text-[#001A4D] text-sm">{item.description}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                        item.source === 'event_budget'
                          ? 'bg-purple-100 text-purple-700'
                          : item.source === 'student_collection'
                          ? 'bg-green-100 text-green-700'
                          : item.source === 'liquidation_surplus'
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.source === 'liquidation_deficit'
                          ? 'bg-rose-100 text-rose-700'
                          : item.source === 'manual_expense'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {item.source === 'event_budget'
                          ? 'Event Budget Allocation'
                          : item.source === 'liquidation_surplus'
                          ? 'Liquidation Surplus Refund'
                          : item.source === 'liquidation_deficit'
                          ? 'Liquidation Deficit Expense'
                          : item.source === 'student_collection'
                          ? 'Student Collection'
                          : item.source.replace('_', ' ')}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm font-medium ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {item.type === 'income' ? `+${formatCurrency(item.amount)}` : `-${formatCurrency(item.amount)}`}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-bold text-sm">{formatCurrency(item.runningBalance)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-[#001A4D] shadow-md">
                <td colSpan={3} className="px-4 py-3 text-white font-bold text-sm bg-[#001A4D]">Current Club Balance</td>
                <td colSpan={2} className="px-4 py-3 text-[#FFD41C] font-bold text-base bg-[#001A4D]">
                  {formatCurrency(currentClubBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {showAddIncome && (
        <AddOrgIncomeModal
          organizationId={organizationId}
          organizationName={organizationName}
          officerStudentId={officerStudentId}
          onClose={() => setShowAddIncome(false)}
          onSuccess={() => setShowAddIncome(false)}
        />
      )}
      {showAddExpense && (
        <AddOrgExpenseModal
          organizationId={organizationId}
          officerStudentId={officerStudentId}
          onClose={() => setShowAddExpense(false)}
          onSuccess={() => setShowAddExpense(false)}
        />
      )}
    </div>
  );
}

// ─── Student Collections & Treasury Transfers Tab ──────────────────────────────

function OrgCollectionDetailModal({
  collection,
  alreadyTransferred,
  isPast,
  onClose,
  onTransfer,
}: {
  collection: StudentEventCollectionGroup;
  alreadyTransferred: boolean;
  isPast: boolean;
  onClose: () => void;
  onTransfer: () => void;
}) {
  const paid = collection.payments.filter((p) => p.status === "Paid");
  const pending = collection.payments.filter((p) => p.status === "Pending");
  const totalCollected = paid.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[620px] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-white font-bold text-base">{collection.eventName}</h3>
            <p className="text-blue-200 text-xs mt-0.5">Collection Breakdown & Treasury Transfer</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Summary KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">Assigned / Student</p>
              <p className="text-base font-bold text-[#001A4D] mt-0.5">{formatCurrency(collection.payablePerStudent)}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-xs text-green-700">Total Collected</p>
              <p className="text-base font-bold text-green-700 mt-0.5">{formatCurrency(totalCollected)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-xs text-[#0E4EBD]">Completion</p>
              <p className="text-base font-bold text-[#0E4EBD] mt-0.5">
                {collection.totalStudents > 0 ? Math.round((paid.length / collection.totalStudents) * 100) : 0}%
              </p>
            </div>
          </div>

          {/* Roster Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <p className="text-[#001A4D] text-xs font-bold uppercase tracking-wide">Student Payment Records</p>
              <div className="flex gap-2">
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle className="w-3 h-3" />{paid.length} Paid
                </span>
                {pending.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                    <Clock className="w-3 h-3" />{pending.length} Pending
                  </span>
                )}
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {["Student", "Student ID", "Amount", "Status"].map((col) => (
                      <th key={col} className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {collection.payments.map((p) => (
                    <tr key={p.id} className={p.status === "Pending" ? "bg-amber-50/30" : "hover:bg-gray-50"}>
                      <td className="px-4 py-2 text-[#001A4D] text-sm font-medium">{p.name}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs font-mono">{p.studentId}</td>
                      <td className="px-4 py-2 text-sm font-bold text-gray-700">
                        {p.status === "Paid" ? formatCurrency(p.amount) : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          p.status === "Paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 cursor-pointer">
            Close
          </button>
          {alreadyTransferred ? (
            <div className="flex-1 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-bold text-center flex items-center justify-center gap-2 select-none">
              <CheckCircle className="w-4 h-4" />
              Transferred to Treasury
            </div>
          ) : totalCollected <= 0 ? (
            <div className="flex-1 py-2.5 bg-gray-100 text-gray-400 rounded-xl text-sm font-medium text-center flex items-center justify-center gap-2 select-none">
              No Collected Cash to Transfer
            </div>
          ) : isPast ? (
            <div className="flex-1 py-2.5 bg-amber-50 text-amber-700 rounded-xl text-sm font-medium text-center flex items-center justify-center gap-2 select-none">
              Read-Only Past Semester
            </div>
          ) : (
            <button
              onClick={() => { onTransfer(); onClose(); }}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Transfer {formatCurrency(totalCollected)} to Club Treasury
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OrgCollectionsTab({
  isPast,
  organizationId,
  organizationName,
  semesterId,
  officerStudentId,
}: {
  isPast: boolean;
  organizationId: string;
  organizationName: string;
  semesterId: string;
  officerStudentId: string;
}) {
  const { data: collections, loading } = useOrgCollectionsStream(organizationId, semesterId);
  const [viewCollection, setViewCollection] = useState<StudentEventCollectionGroup | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const handleTransfer = async (item: StudentEventCollectionGroup) => {
    setIsTransferring(true);
    try {
      const res = await transferCollectionGroupToLedger({
        collectionGroupId: item.id,
        eventId: item.eventId !== 'unassigned' ? item.eventId : null,
        type: item.type,
        organizationId,
        targetLedger: 'org',
        semesterId: semesterId !== 'all' ? semesterId : null,
        recordedByUid: officerStudentId,
        collectionName: item.eventName,
      });

      if (res.transferredCount > 0) {
        toast.success(`Transferred ${formatCurrency(res.transferredAmount)} across ${res.transferredCount} payment(s) to Club Treasury.`);
      } else {
        toast.info('No pending paid collections available to transfer.');
      }
    } catch (err: any) {
      console.error('Failed to transfer collection to organization ledger:', err);
      toast.error(err?.message || 'Failed to transfer collection.');
    } finally {
      setIsTransferring(false);
    }
  };

  const pendingTransferTotal = collections
    .filter((c) => !c.transferredToBudget)
    .reduce((s, c) => s + (c.untransferredAmount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Informational banner */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-900 font-bold text-sm">Centralized Club Collections & Treasury Transfer</p>
          <p className="text-amber-800 text-xs mt-0.5 leading-relaxed">
            All student collections (Membership Dues, Event Fees, and Event Attendance Fines) recorded in Attendance Logs or Finance Center appear here. Click <strong>Transfer</strong> to atomically credit the collected cash into your Club Budget Ledger.
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="border-l-4 border-[#0E4EBD] pl-3">
            <h3 className="text-[#001A4D] font-bold text-base">Club Payable Collections</h3>
            <p className="text-gray-500 text-xs mt-0.5">Membership Dues, Event Fees, and Event Fines</p>
          </div>
          {pendingTransferTotal > 0 && !isPast && (
            <div className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              Pending Transfer: {formatCurrency(pendingTransferTotal)}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {["Collection Name", "Type", "Assigned / Student", "Students", "Paid", "Collected (₱)", "Status", "Action"].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Loading student collections...
                  </td>
                </tr>
              ) : collections.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                    No student collections found for this organization.
                  </td>
                </tr>
              ) : (
                collections.map((c) => {
                  const paid = c.payments.filter((p) => p.status === "Paid");
                  const totalCollected = c.totalCollected || paid.reduce((s, p) => s + p.amount, 0);
                  const pct = c.totalStudents > 0 ? Math.round((paid.length / c.totalStudents) * 100) : 0;

                  const typeBadge =
                    c.type === "membership_due"
                      ? "bg-purple-100 text-purple-700"
                      : c.type === "org_fine"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-blue-100 text-blue-700";

                  const typeName =
                    c.type === "membership_due"
                      ? "Membership Due"
                      : c.type === "org_fine"
                      ? "Event Fine"
                      : "Event Fee";

                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[#001A4D] font-medium text-sm">{c.eventName}</p>
                        <p className="text-gray-400 text-xs">{c.eventDate}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-md font-semibold ${typeBadge}`}>
                          {typeName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm font-medium">
                        {formatCurrency(c.payablePerStudent)}
                      </td>
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
                        {c.transferredToBudget ? (
                          <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full font-medium w-fit whitespace-nowrap">
                            <CheckCircle className="w-3 h-3" />
                            Transferred {c.transferredDate}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-full font-medium w-fit whitespace-nowrap">
                            <Clock className="w-3 h-3" />
                            Pending Transfer
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewCollection(c)}
                            className="flex items-center gap-1 px-2.5 py-1.5 border border-blue-300 text-blue-600 text-xs rounded-lg font-medium hover:bg-blue-50 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Details
                          </button>
                          {!c.transferredToBudget && totalCollected > 0 && !isPast && (
                            <button
                              onClick={() => handleTransfer(c)}
                              disabled={isTransferring}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg font-bold hover:bg-green-700 transition-colors cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              Transfer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewCollection && (
        <OrgCollectionDetailModal
          collection={viewCollection}
          alreadyTransferred={viewCollection.transferredToBudget}
          isPast={isPast}
          onClose={() => setViewCollection(null)}
          onTransfer={() => {
            handleTransfer(viewCollection);
            setViewCollection(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Student Payables Tab (Real Firestore Backend) ──────────────────────────────

function StudentPayablesTab({
  isPast,
  payables,
  organizationId,
  organizationName,
  officerStudentId,
}: {
  isPast: boolean;
  payables: PayableDocument[];
  organizationId: string;
  organizationName: string;
  officerStudentId: string;
}) {
  const [subTab, setSubTab] = useState<PayableSubTab>("member");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showGenerateDues, setShowGenerateDues] = useState(false);
  const [showAddPayable, setShowAddPayable] = useState(false);
  const [selectedPayableForPayment, setSelectedPayableForPayment] = useState<PayableDocument | null>(null);

  const totalAssigned = payables.reduce((a, p) => a + (p.assignedAmount || 0), 0);
  const totalCollected = payables.reduce((a, p) => a + (p.paidAmount || 0), 0);
  const totalOutstanding = totalAssigned - totalCollected;
  const collectionRate = totalAssigned > 0 ? Math.round((totalCollected / totalAssigned) * 100) : 0;

  // Overdue detection
  const now = Date.now();
  const overduePayables = payables.filter((p) => {
    if (p.status === 'overdue') return true;
    if (p.status === 'paid' || p.status === 'waived') return false;
    if (p.dueDate?.toMillis && p.dueDate.toMillis() < now) return true;
    return false;
  });

  // Grouping by student for "By Member"
  const memberGroups = useMemo(() => {
    const map = new Map<string, { studentId: string; studentName: string; schoolId: string; payables: PayableDocument[] }>();
    payables.forEach((p) => {
      const key = p.studentId;
      if (!map.has(key)) {
        map.set(key, {
          studentId: p.studentId,
          studentName: p.studentName || 'Student',
          schoolId: p.studentSchoolId || p.studentId,
          payables: [],
        });
      }
      map.get(key)!.payables.push(p);
    });
    return Array.from(map.values());
  }, [payables]);

  // Grouping by type for "By Payable Type"
  const typeGroups = useMemo(() => {
    const map = new Map<string, { label: string; type: string; totalAssigned: number; collected: number; outstanding: number; memberCount: number }>();
    payables.forEach((p) => {
      const key = `${p.type}_${p.label}`;
      if (!map.has(key)) {
        map.set(key, {
          label: p.label,
          type: p.type.replace('_', ' '),
          totalAssigned: 0,
          collected: 0,
          outstanding: 0,
          memberCount: 0,
        });
      }
      const g = map.get(key)!;
      g.totalAssigned += p.assignedAmount || 0;
      g.collected += p.paidAmount || 0;
      g.outstanding += (p.assignedAmount || 0) - (p.paidAmount || 0);
      g.memberCount += 1;
    });
    return Array.from(map.values());
  }, [payables]);

  const filteredMembers = memberGroups.filter((m) => {
    if (!m) return false;
    const q = (searchQuery || '').trim().toLowerCase();
    const nameMatch = (m.studentName || '').toLowerCase().includes(q);
    const idMatch = (m.schoolId || m.studentId || '').toLowerCase().includes(q);
    if (q && !nameMatch && !idMatch) return false;
    if (statusFilter === 'All') return true;

    const memberAssigned = m.payables.reduce((a, p) => a + p.assignedAmount, 0);
    const memberPaid = m.payables.reduce((a, p) => a + p.paidAmount, 0);

    if (statusFilter === 'Paid') return memberPaid >= memberAssigned && memberAssigned > 0;
    if (statusFilter === 'Partial') return memberPaid > 0 && memberPaid < memberAssigned;
    if (statusFilter === 'Unpaid') return memberPaid === 0 && memberAssigned > 0;
    if (statusFilter === 'Overdue') return m.payables.some((p) => p.status === 'overdue' || (p.dueDate?.toMillis && p.dueDate.toMillis() < now && p.status !== 'paid'));
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Overview & Action Bar */}
      <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 shadow-xs">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#0E4EBD] flex-shrink-0" />
          <span>
            This tab manages organizational dues and club fines. <strong>Event ticket payables & QR passes</strong> are managed and collected directly under each event in <strong>Event Management</strong>.
          </span>
        </div>
        <a
          href="/officer/events"
          className="px-3 py-1.5 bg-[#001A4D] text-[#FFD41C] font-bold rounded-lg hover:bg-[#001A4D]/90 whitespace-nowrap ml-3 transition-colors shadow-xs"
        >
          Manage Event Payables →
        </a>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="font-bold text-[#001A4D] text-base">Club Payables & Membership Dues</h3>
            <p className="text-gray-500 text-xs mt-0.5">Manage membership dues and non-event club payables for active members.</p>
          </div>
          {!isPast && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGenerateDues(true)}
                className="px-3.5 py-2 bg-[#0E4EBD] text-white rounded-lg text-xs font-bold hover:bg-[#0A3D94] transition-colors flex items-center gap-1.5"
              >
                <Coins className="w-4 h-4 text-[#FFD41C]" />
                Generate Membership Dues
              </button>
              <button
                onClick={() => setShowAddPayable(true)}
                className="px-3.5 py-2 bg-[#001A4D] text-white rounded-lg text-xs font-bold hover:bg-[#001A4D]/90 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-[#FFD41C]" />
                Add Payable / Fine
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 divide-x divide-gray-200">
          {[
            { label: "Total Payables Assigned", value: formatCurrency(totalAssigned), color: "text-[#001A4D]" },
            { label: "Total Collected", value: formatCurrency(totalCollected), color: "text-green-600" },
            { label: "Total Outstanding", value: formatCurrency(totalOutstanding), color: "text-red-600" },
            { label: "Collection Rate", value: `${collectionRate}%`, color: "text-[#0E4EBD]" },
          ].map((s) => (
            <div key={s.label} className="px-5 first:pl-0 last:pr-0 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-gray-400 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <p className="text-gray-500 text-xs">{collectionRate}% of total payables collected this semester</p>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] rounded-full" style={{ width: `${collectionRate}%` }} />
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([["member", "By Member"], ["type", "By Payable Type"], ["overdue", `Overdue`]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              subTab === key ? "border-[#001A4D] text-[#001A4D] font-bold" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
            {key === "overdue" && overduePayables.length > 0 && (
              <span className="w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                {overduePayables.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sub-tab 1: By Member */}
      {subTab === "member" && (
        <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-gray-100">
            <input
              type="text"
              placeholder="Search member by name or student ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent outline-none"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent outline-none"
            >
              <option value="All">All Status</option>
              <option value="Paid">Fully Paid</option>
              <option value="Partial">Partial</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {["Member", "Assigned Payables", "Total Assigned", "Total Paid", "Outstanding", "Status", ...(!isPast ? ["Actions"] : [])].map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                      No student payables found. Click <strong>Generate Membership Dues</strong> or <strong>Add Payable</strong> to assign fees.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => {
                    const assigned = m.payables.reduce((a, p) => a + (p.assignedAmount || 0), 0);
                    const paid = m.payables.reduce((a, p) => a + (p.paidAmount || 0), 0);
                    const outstanding = assigned - paid;

                    let statusText = 'Paid';
                    let statusColor = 'bg-green-100 text-green-700';

                    if (outstanding > 0) {
                      if (paid > 0) {
                        statusText = 'Partial';
                        statusColor = 'bg-amber-100 text-amber-700';
                      } else {
                        statusText = 'Unpaid';
                        statusColor = 'bg-gray-100 text-gray-700';
                      }
                    }

                    const hasOverdue = m.payables.some((p) => p.status === 'overdue' || (p.dueDate?.toMillis && p.dueDate.toMillis() < now && p.status !== 'paid'));
                    if (hasOverdue) {
                      statusText = 'Overdue';
                      statusColor = 'bg-red-100 text-red-700';
                    }

                    return (
                      <tr key={m.studentId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#001A4D]/10 text-[#001A4D] flex items-center justify-center text-xs font-bold">
                              {m.studentName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-[#001A4D] font-medium text-sm">{m.studentName}</p>
                              <p className="text-gray-400 text-xs">{m.schoolId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 space-y-1">
                          {m.payables.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-2 border-b border-gray-100 last:border-0 pb-0.5">
                              <span className="truncate max-w-[160px]" title={p.label}>{p.label}</span>
                              <span className="font-semibold text-gray-800">{formatCurrency(p.assignedAmount)}</span>
                            </div>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-sm font-semibold">{formatCurrency(assigned)}</td>
                        <td className="px-4 py-3 text-green-600 font-semibold text-sm">{formatCurrency(paid)}</td>
                        <td className="px-4 py-3 text-red-600 font-bold text-sm">{formatCurrency(outstanding)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusColor}`}>
                            {statusText}
                          </span>
                        </td>
                        {!isPast && (
                          <td className="px-4 py-3">
                            {outstanding > 0 ? (
                              <button
                                onClick={() => {
                                  const pendingPayable = m.payables.find((p) => (p.assignedAmount || 0) > (p.paidAmount || 0));
                                  if (pendingPayable) setSelectedPayableForPayment(pendingPayable);
                                }}
                                className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors flex items-center gap-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Record Payment
                              </button>
                            ) : (
                              <span className="text-xs text-green-600 font-medium">✓ Settled</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 2: By Payable Type */}
      {subTab === "type" && (
        <div className="grid grid-cols-3 gap-4">
          {typeGroups.length === 0 ? (
            <div className="col-span-3 bg-white border border-[#E0E0E0] rounded-xl p-8 text-center text-gray-500 text-sm">
              No payable categories defined yet. Generate dues or add a payable to get started.
            </div>
          ) : (
            typeGroups.map((pt, idx) => {
              const pct = pt.totalAssigned > 0 ? Math.round((pt.collected / pt.totalAssigned) * 100) : 0;
              return (
                <div key={idx} className="bg-white border border-[#E0E0E0] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[#001A4D] font-bold text-sm truncate" title={pt.label}>{pt.label}</p>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-medium capitalize">{pt.type}</span>
                  </div>
                  <p className="text-[#0E4EBD] font-bold text-lg">{formatCurrency(pt.totalAssigned)}</p>
                  <div className="flex justify-between text-xs mt-1 mb-2">
                    <span className="text-green-600">{formatCurrency(pt.collected)} collected</span>
                    <span className="text-red-600">{formatCurrency(pt.outstanding)} outstanding</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-[#0E4EBD]" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-gray-400 text-xs">{pt.memberCount} member(s)</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Sub-tab 3: Overdue */}
      {subTab === "overdue" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 font-bold text-sm mb-0.5">Overdue Payables ({overduePayables.length})</p>
              <p className="text-gray-700 text-sm">These member payables are past their due date and require collection action.</p>
            </div>
          </div>

          <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {["Member", "Payable", "Outstanding", "Due Date", ...(!isPast ? ["Actions"] : [])].map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {overduePayables.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                      🎉 Great job! There are no overdue payables at this time.
                    </td>
                  </tr>
                ) : (
                  overduePayables.map((p) => {
                    const outstanding = (p.assignedAmount || 0) - (p.paidAmount || 0);
                    const dueStr = formatAppDate(p.dueDate, 'Overdue');

                    return (
                      <tr key={p.id} className="hover:bg-red-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-[#001A4D] font-medium text-sm">{p.studentName}</p>
                          <p className="text-gray-400 text-xs">{p.studentSchoolId || p.studentId}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-sm font-medium">{p.label}</td>
                        <td className="px-4 py-3 text-red-600 font-bold text-sm">{formatCurrency(outstanding)}</td>
                        <td className="px-4 py-3 text-[#001A4D] text-sm">{dueStr}</td>
                        {!isPast && (
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedPayableForPayment(p)}
                              className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Record Payment
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Modals */}
      {showGenerateDues && (
        <GenerateDuesModal
          isOpen={showGenerateDues}
          onClose={() => setShowGenerateDues(false)}
          organizationId={organizationId}
          organizationName={organizationName}
          addedBy={officerStudentId}
        />
      )}

      {showAddPayable && (
        <AddPayableModal
          isOpen={showAddPayable}
          onClose={() => setShowAddPayable(false)}
          organizationId={organizationId}
          organizationName={organizationName}
          addedBy={officerStudentId}
        />
      )}

      {selectedPayableForPayment && (
        <RecordPaymentModal
          isOpen={!!selectedPayableForPayment}
          onClose={() => setSelectedPayableForPayment(null)}
          payable={selectedPayableForPayment}
          recordedBy={officerStudentId}
        />
      )}
    </div>
  );
}

// ─── Liquidation Tab ───────────────────────────────────────────────────────────
function LiquidationTab({
  isPast,
  organizationId,
  organizationName,
  officerStudentId,
  officerStudentName,
}: {
  isPast: boolean;
  organizationId: string;
  organizationName: string;
  officerStudentId: string;
  officerStudentName: string;
}) {
  const { liquidations, loading } = useOrgLiquidations(organizationId);
  const [showModal, setShowModal] = useState(false);
  const [editingReport, setEditingReport] = useState<LiquidationDocument | null>(null);
  const [viewingDetailReport, setViewingDetailReport] = useState<LiquidationDocument | null>(null);
  const [exportReport, setExportReport] = useState<LiquidationDocument | null>(null);
  const [lightboxData, setLightboxData] = useState<{ url: string; title: string; vendor?: string; amount?: number } | null>(null);

  const handleOpenCreate = () => {
    setEditingReport(null);
    setShowModal(true);
  };

  const handleOpenEdit = (report: LiquidationDocument) => {
    setEditingReport(report);
    setShowModal(true);
  };

  const statusBadge = (status: LiquidationStatus) => {
    switch (status) {
      case 'approved':
        return <span className="px-2.5 py-0.5 text-xs rounded-full font-bold bg-green-100 text-green-800">Approved</span>;
      case 'pending':
        return <span className="px-2.5 py-0.5 text-xs rounded-full font-bold bg-amber-100 text-amber-800">Pending Review</span>;
      case 'returned':
        return <span className="px-2.5 py-0.5 text-xs rounded-full font-bold bg-red-100 text-red-800">Returned</span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs rounded-full font-bold bg-gray-100 text-gray-700">Draft</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[#0E4EBD] flex-shrink-0 mt-0.5" />
          <p className="text-blue-900 text-sm">
            Liquidation reports must account for budget items in your Club Budget Plan. The SAO Adviser will cross-reference your liquidations against your approved budget ceiling.
          </p>
        </div>
      </div>
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="border-l-4 border-[#0E4EBD] pl-3">
            <h3 className="text-[#001A4D] font-bold text-sm">Liquidation Reports</h3>
          </div>
          {!isPast && (
            <button
              onClick={handleOpenCreate}
              className="px-3 py-1.5 bg-[#001A4D] text-white text-xs rounded-lg flex items-center gap-1.5 font-medium hover:bg-[#002B7F] transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#FFD41C]" />
              New Liquidation Report
            </button>
          )}
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {["Event Title", "Submitted", "Allocated Budget", "Actual Spending", "Status", "Actions"].map((col) => (
                <th key={col} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                  Loading liquidation reports from database...
                </td>
              </tr>
            ) : liquidations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                  No liquidation reports found. Click <strong>New Liquidation Report</strong> to submit expenses.
                </td>
              </tr>
            ) : (
              liquidations.map((l) => {
                const submittedDate = formatAppDate(l.submittedAt || l.createdAt, 'Draft');

                return (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-[#001A4D] font-bold text-sm">{l.eventTitle}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{submittedDate}</td>
                    <td className="px-4 py-3 text-gray-700 font-semibold text-sm">{formatCurrency(l.allocatedBudget)}</td>
                    <td className="px-4 py-3 text-[#001A4D] font-bold text-sm">{formatCurrency(l.totalActualSpending)}</td>
                    <td className="px-4 py-3">{statusBadge(l.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {l.status === 'approved' && (
                          <button
                            onClick={() => setExportReport(l)}
                            className="text-[#0E4EBD] hover:underline text-xs flex items-center gap-1 font-bold cursor-pointer"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-[#FFC107]" /> Export
                          </button>
                        )}
                        <button
                          onClick={() => setViewingDetailReport(l)}
                          className="text-blue-600 hover:underline text-xs flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Details
                        </button>
                        {!isPast && (l.status === 'draft' || l.status === 'returned') && (
                          <button
                            onClick={() => handleOpenEdit(l)}
                            className="text-[#0E4EBD] hover:underline text-xs flex items-center gap-1 font-bold cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <OfficerLiquidationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          orgId={organizationId}
          orgName={organizationName}
          userUid={officerStudentId}
          userName={officerStudentName}
          userRole="officer"
          editingReport={editingReport}
        />
      )}

      {viewingDetailReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
            <div className="px-6 py-4 bg-[#001A4D] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">{viewingDetailReport.eventTitle}</h3>
                <div className="text-xs text-white/70">Liquidation Detail & Receipts</div>
              </div>
              <button
                onClick={() => setViewingDetailReport(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg text-center">
                <div>
                  <div className="text-xs text-gray-500">Allocated Budget</div>
                  <div className="font-bold text-sm text-[#001A4D]">
                    {formatCurrency(viewingDetailReport.allocatedBudget)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Actual Spending</div>
                  <div className="font-bold text-sm text-[#001A4D]">
                    {formatCurrency(viewingDetailReport.totalActualSpending)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Surplus / Deficit</div>
                  <div className={`font-bold text-sm ${viewingDetailReport.surplusOrDeficit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatVariance(viewingDetailReport.surplusOrDeficit)}
                  </div>
                </div>
              </div>

              {viewingDetailReport.status === 'approved' && (
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                  viewingDetailReport.surplusOrDeficit > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : viewingDetailReport.surplusOrDeficit < 0
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <div>
                    <span className="font-bold block">
                      {viewingDetailReport.surplusOrDeficit > 0
                        ? `✓ Treasury Surplus Refund: +${formatCurrency(viewingDetailReport.surplusOrDeficit)} credited to Club Treasury`
                        : viewingDetailReport.surplusOrDeficit < 0
                        ? `⚠ Treasury Deficit Overspend: −${formatCurrency(Math.abs(viewingDetailReport.surplusOrDeficit))} debited from Club Treasury`
                        : '✓ Budget Fully Balanced: Spent exactly the allocated amount'}
                    </span>
                    <span className="text-[11px] opacity-80">
                      Approved by SAO Adviser and automatically reconciled with your organization budget ledger.
                    </span>
                  </div>
                </div>
              )}

              {viewingDetailReport.status === 'returned' && viewingDetailReport.returnRemarks && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 font-medium space-y-1">
                  <div className="font-bold text-[#991B1B] uppercase tracking-wider">SAO Adviser Return Remarks</div>
                  <p>{viewingDetailReport.returnRemarks}</p>
                </div>
              )}

              <h4 className="font-bold text-sm text-gray-900 pt-2">Line Items</h4>
              <div className="space-y-2">
                {viewingDetailReport.lineItems?.map((item, idx) => (
                  <div key={idx} className="p-3 border border-gray-200 rounded-lg text-xs space-y-1.5 bg-gray-50/50">
                    <div className="flex items-center justify-between font-bold text-gray-900">
                      <span>{item.description} ({item.category})</span>
                      <span className="text-[#001A4D]">Actual Cost: {formatCurrency(item.totalCost)}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-gray-600 gap-2">
                      <span>
                        <strong>Actual:</strong> {item.quantity} Qty × {formatCurrency(item.unitCost)}
                      </span>
                    </div>

                    {item.vendorName && <div className="text-gray-500 text-[11px]">Vendor: <strong>{item.vendorName}</strong></div>}

                    {item.receiptUrl && (
                      <div className="pt-1">
                        <button
                          onClick={() => setLightboxData({
                            url: item.receiptUrl,
                            title: item.description,
                            vendor: item.vendorName,
                            amount: item.totalCost,
                          })}
                          className="text-[#1E70E8] hover:underline font-semibold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Uploaded Receipt Image ↗
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {viewingDetailReport.remarksHistory && viewingDetailReport.remarksHistory.length > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <h4 className="font-bold text-sm text-[#001A4D] mb-2">Remarks & Revision History</h4>
                  <div className="space-y-2">
                    {viewingDetailReport.remarksHistory.map((rem, rIdx) => (
                      <div key={rIdx} className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between text-gray-700 font-semibold">
                          <span>{rem.authorName} ({rem.authorRole === 'admin' ? 'SAO Adviser' : 'Officer'})</span>
                          <span className="text-[10px] text-gray-500">{formatAppDateTime(rem.timestamp)}</span>
                        </div>
                        <p className="text-gray-800">{rem.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div>
                {viewingDetailReport.status === 'approved' && (
                  <button
                    onClick={() => {
                      setExportReport(viewingDetailReport);
                      setViewingDetailReport(null);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#FFC107]" /> Export Liquidation Report
                  </button>
                )}
              </div>
              <button
                onClick={() => setViewingDetailReport(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liquidation Excel Export Preview Modal */}
      <LiquidationExportPreviewModal
        isOpen={!!exportReport}
        onClose={() => setExportReport(null)}
        report={exportReport}
      />

      <ReceiptLightboxModal
        isOpen={!!lightboxData}
        onClose={() => setLightboxData(null)}
        imageUrl={lightboxData?.url || ''}
        itemTitle={lightboxData?.title}
        vendorName={lightboxData?.vendor}
        amount={lightboxData?.amount}
      />
    </div>
  );
}

// ─── Semester Transition Screens ───────────────────────────────────────────────
function SemesterEndedScreen({ onViewPast, onStartNew }: { onViewPast: () => void; onStartNew: () => void }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8">
      <div className="w-[120px] h-[120px] bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-full flex items-center justify-center mb-6">
        <RefreshCw className="w-16 h-16 text-[#FFD41C]" style={{ animation: "spin 6s linear infinite" }} />
      </div>
      <h1 className="text-[#001A4D] font-bold text-3xl mb-2">Semester Has Ended</h1>
      <p className="text-gray-500 text-base mb-8">2nd Semester · A.Y. 2025–2026 has concluded.</p>

      <div className="grid grid-cols-2 gap-5 w-full max-w-2xl mb-6">
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-6 text-center">
          <History className="w-10 h-10 text-blue-600 mx-auto mb-3" />
          <p className="text-blue-600 font-bold text-base mb-1">View Past Semester</p>
          <p className="text-gray-500 text-sm mb-4">Browse events, attendance, finances, and payables from the completed semester.</p>
          <button onClick={onViewPast} className="w-full py-2.5 border border-blue-600 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
            View 2nd Semester Data
          </button>
        </div>
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-6 text-center">
          <ArrowRight className="w-10 h-10 text-[#0E4EBD] mx-auto mb-3" />
          <p className="text-[#001A4D] font-bold text-base mb-1">Start New Semester</p>
          <p className="text-gray-500 text-sm mb-4">Begin working in 1st Semester A.Y. 2026–2027.</p>
          <button onClick={onStartNew} className="w-full py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Go to New Semester Dashboard
          </button>
        </div>
      </div>
      <button className="text-gray-400 text-sm hover:text-gray-600 transition-colors">I'll decide later</button>
    </div>
  );
}

function SemesterSetupChecklist({ onContinue }: { onContinue: () => void }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const items = [
    { id: "officers", icon: Shield, color: "text-[#0E4EBD]", bg: "bg-blue-50", label: "Confirm Organization Officers", desc: "Verify that your organization's officer roster is up to date for this semester.", action: "Update Officers" },
    { id: "budget", icon: Wallet, color: "text-[#0E4EBD]", bg: "bg-blue-50", label: "Set Club Budget Plan", desc: "Plan your organization's expenditures for the new semester.", action: "Set Budget Plan" },
    { id: "dues", icon: Coins, color: "text-amber-600", bg: "bg-amber-50", label: "Set Up Member Dues", desc: "Configure the dues and registration fees for your members this semester.", action: "Set Up Dues" },
    { id: "assign", icon: Users, color: "text-green-600", bg: "bg-green-50", label: "Assign Dues to Members", desc: "Once dues are configured, assign them to your active members.", action: "Assign Dues", disabled: !done["dues"] },
  ];
  const doneCount = Object.values(done).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-white px-8 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-[#001A4D] font-bold text-2xl mb-1">Set Up Your Organization for 1st Semester A.Y. 2026–2027</h1>
        <p className="text-gray-500 text-sm mb-6">Complete these steps to get your organization ready for the new semester.</p>

        <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden mb-6">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className={`flex items-center gap-4 px-5 py-4 ${i < items.length - 1 ? "border-b border-[#E0E0E0]" : ""} ${item.disabled ? "opacity-50" : ""}`}>
                <button
                  onClick={() => !item.disabled && setDone({ ...done, [item.id]: !done[item.id] })}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${done[item.id] ? "bg-green-500 border-green-500" : "border-gray-300"}`}
                >
                  {done[item.id] && <CheckCircle className="w-4 h-4 text-white" />}
                </button>
                <div className={`w-10 h-10 ${item.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-[#001A4D] font-bold text-sm">{item.label}</p>
                  <p className="text-gray-500 text-xs">{item.desc}</p>
                </div>
                <button
                  disabled={!!item.disabled}
                  className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${
                    done[item.id]
                      ? "border-green-200 text-green-600 bg-green-50"
                      : item.disabled
                      ? "border-gray-200 text-gray-400 cursor-not-allowed"
                      : `border-[#0E4EBD] text-[#0E4EBD] hover:bg-blue-50`
                  }`}
                >
                  {done[item.id] ? "✓ Done" : item.action}
                </button>
              </div>
            );
          })}

          <div className="px-5 py-3 bg-gray-50 border-t border-[#E0E0E0]">
            <div className="flex justify-between items-center mb-1">
              <p className="text-gray-500 text-xs">{doneCount} of {items.length} setup steps completed</p>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] rounded-full transition-all" style={{ width: `${(doneCount / items.length) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={onContinue}
            disabled={doneCount === 0}
            className={`w-full py-3 rounded-xl text-sm font-bold mb-2 transition-colors ${
              doneCount > 0 ? "bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white hover:opacity-90" : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            Continue to Dashboard →
          </button>
          <p className="text-gray-400 text-xs mb-4">You can complete remaining steps from your dashboard.</p>
          <button onClick={onContinue} className="text-gray-400 text-sm hover:text-gray-600 transition-colors">Skip Setup — I'll do this later</button>
        </div>
      </div>
    </div>
  );
}

// ─── Historical Finance Summary ────────────────────────────────────────────────
function HistoricalSummaryCard() {
  return (
    <div className="p-4 bg-[#001A4D] rounded-xl">
      <p className="text-white/70 text-xs mb-3">Final Financial Record</p>
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Final Budget Utilization", value: "91%" },
          { label: "Total Collections", value: "₱21,250.00" },
          { label: "Total Outstanding", value: "₱3,500.00" },
          { label: "Total Liquidations Filed", value: "6" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-[#FFD41C] font-bold text-xl">{s.value}</p>
            <p className="text-white/70 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="text-white/50 text-xs italic mt-3">This is the final financial record for this semester.</p>
    </div>
  );
}

// ─── Main FinanceCenter Page ───────────────────────────────────────────────────
export default function FinanceCenter() {
  const { profile } = useOfficerProfile();
  const { data: orgs } = useOrganizationStream();

  const activeOrgId = profile?.activeOrganizationId || '';
  const currentOrg = orgs.find((o) => o.id === activeOrgId);
  const activeOrgName = currentOrg ? currentOrg.name : 'My Organization';
  const officerStudentId = profile?.studentId || 'officer';

  const { data: ledgerData } = useOrgLedger(activeOrgId);
  const { data: semesters } = useSemesters();
  const availableSemesters = semesters.filter((s) => s.status === 'ACTIVE' || s.status === 'UPCOMING');
  const [selectedSemId, setSelectedSemId] = useState<string>("all");

  const { data: payablesData } = useOrgPayables(activeOrgId, selectedSemId);

  // Strictly isolate non-event payables (membership dues, club fines, custom dues)
  // Event ticket fees & payables are managed under Event Management (/officer/events)
  const orgNonEventPayables = useMemo(() => {
    return payablesData.filter((p) => p.type !== 'event_fee' && !p.eventId);
  }, [payablesData]);

  const [activeTab, setActiveTab] = useState<FinanceTab>("budget");
  const [showTransition, setShowTransition] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const selectedSemesterObj = semesters.find((s) => s.id === selectedSemId);
  const isPast = selectedSemesterObj?.status === 'COMPLETED';

  // Demo: simulate transition screens
  if (showSetup) {
    return <SemesterSetupChecklist onContinue={() => setShowSetup(false)} />;
  }
  if (showTransition) {
    return (
      <SemesterEndedScreen
        onViewPast={() => { setShowTransition(false); setSelectedSemId("all"); }}
        onStartNew={() => { setShowTransition(false); setShowSetup(true); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Finance Center</h2>
          <p className="text-gray-500 text-sm">
            Finance &rsaquo; {activeTab === "budget" ? "Budget Tracker" : activeTab === "payables" ? "Student Payables" : "Liquidation Reports"}
            {activeOrgName && <span className="font-semibold ml-2 text-[#0E4EBD]">({activeOrgName})</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedSemId}
            onChange={(e) => setSelectedSemId(e.target.value)}
            className="px-4 py-2 border border-[#E0E0E0] rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent outline-none"
          >
            <option value="all">All Semesters</option>
            {availableSemesters.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          <button className="px-4 py-2 bg-[#001A4D] text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-[#001A4D]/90 transition-colors">
            <Download className="w-4 h-4" />
            Export Financial Report
          </button>
          <button
            onClick={() => setShowTransition(true)}
            className="px-3 py-2 border border-gray-300 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition-colors"
            title="Demo: Semester Transition Screen"
          >
            Demo Transition
          </button>
        </div>
      </div>

      {/* Past Semester Banner */}
      {isPast && (
        <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-600" />
            <span className="text-amber-700 font-bold text-sm">Viewing: {selectedSemesterObj?.label || 'All Semesters'} — Read-Only Historical Data.</span>
          </div>
          <button onClick={() => setSelectedSemId("all")} className="text-[#001A4D] text-xs font-medium hover:underline">
            Return to Current Semester
          </button>
        </div>
      )}

      {/* Past semester historical summary */}
      {isPast && <HistoricalSummaryCard />}

      {/* Metric Cards */}
      <MetricsRow isPast={isPast} ledgerData={ledgerData} semesterId={selectedSemId} payablesData={orgNonEventPayables} />

      {/* Export row for past semester */}
      {isPast && (
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-[#001A4D] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-[#001A4D]/90 transition-colors">
            <Download className="w-3.5 h-3.5" />
            Export This Semester's Report (PDF)
          </button>
          <button className="px-4 py-2 border border-[#0E4EBD] text-[#0E4EBD] rounded-lg text-xs hover:bg-blue-50 transition-colors flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Export Payables Summary (Excel)
          </button>
        </div>
      )}

      {/* Four-Tab Area */}
      <div>
        <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
          {([
            ["budget", "Budget Tracker"],
            ["collections", "Student Collections"],
            ["payables", "Student Payables"],
            ["liquidation", "Liquidation Reports"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === key
                  ? "bg-[#001A4D] text-white border-[#FFD41C] -mb-px rounded-t-lg font-bold"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "budget" && (
          <BudgetTrackerTab
            isPast={isPast}
            ledgerData={ledgerData}
            semesterId={selectedSemId}
            organizationId={activeOrgId}
            organizationName={activeOrgName}
            officerStudentId={officerStudentId}
          />
        )}

        {activeTab === "collections" && (
          <OrgCollectionsTab
            isPast={isPast}
            organizationId={activeOrgId}
            organizationName={activeOrgName}
            semesterId={selectedSemId}
            officerStudentId={officerStudentId}
          />
        )}

        {activeTab === "payables" && (
          <StudentPayablesTab
            isPast={isPast}
            payables={orgNonEventPayables}
            organizationId={activeOrgId}
            organizationName={activeOrgName}
            officerStudentId={officerStudentId}
          />
        )}

        {activeTab === "liquidation" && (
          <LiquidationTab
            isPast={isPast}
            organizationId={activeOrgId}
            organizationName={activeOrgName}
            officerStudentId={officerStudentId}
            officerStudentName={profile?.studentName || 'Officer'}
          />
        )}
      </div>
    </div>
  );
}
