import { useState, useMemo } from "react";

import { useOrgLedger } from '../../modules/finance/hooks/useFinanceStream';
import { addOrgLedgerTransaction } from '../../modules/finance/services/finance.service';
import { useSemesters } from '../../modules/academic/hooks/useAcademicStream';
import { useOrgPayables } from '../../modules/finance/hooks/usePayableStream';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import type { OrgLedgerDocument } from '../../modules/finance/types/finance.types';
import type { PayableDocument } from '../../modules/finance/types/payable.types';
import { Timestamp } from 'firebase/firestore';

import { GenerateDuesModal } from '../components/GenerateDuesModal';
import { AddPayableModal } from '../components/AddPayableModal';
import { RecordPaymentModal } from '../components/RecordPaymentModal';

import {
  Building2,
  TrendingUp,
  Wallet,
  Coins,
  CheckCircle,
  AlertCircle,
  Plus,
  Archive,
  Eye,
  X,
  Download,
  FileText,
  Users,
  History,
  ArrowRight,
  Shield,
  RefreshCw,
  Info,
  Minus,
} from "lucide-react";

type FinanceTab = "budget" | "payables" | "liquidation";
type PayableSubTab = "member" | "type" | "overdue";

import { useOrgLiquidations } from '../../modules/finance/hooks/useLiquidationStream';
import OfficerLiquidationModal from '../components/OfficerLiquidationModal';
import ReceiptLightboxModal from '../../modules/finance/components/ReceiptLightboxModal';
import type { LiquidationDocument, LiquidationStatus } from '../../modules/finance/types/liquidation.types';
import { Edit3 } from 'lucide-react';



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
    { label: "Club Total Funds (Income)", value: `₱${totalIncome.toLocaleString()}`, note: "this semester", color: "text-[#83358E]", icon: Building2 },
    { label: "Total Club Expenditures", value: `₱${totalExpenses.toLocaleString()}`, note: "this semester", color: "text-blue-600", icon: TrendingUp },
    { label: "Current Club Balance", value: `₱${currentBalance.toLocaleString()}`, note: "available funds", color: "text-green-600", icon: Wallet },
    { label: "Total Payables Assigned", value: `₱${totalPayables.toLocaleString()}`, note: `across ${payablesData.length} payable doc(s)`, color: "text-[#001A4D]", icon: Coins },
    { label: "Total Collected", value: `₱${totalCollected.toLocaleString()}`, note: "collected payments", color: "text-green-600", icon: CheckCircle },
    { label: "Total Outstanding", value: `₱${totalOutstanding.toLocaleString()}`, note: `outstanding balance`, color: "text-red-600", icon: AlertCircle },
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
        <div className="bg-[#83358E] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-white" />
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent"
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
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent"
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent resize-none"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <input type="checkbox" id="carryOver" checked={carryOver} onChange={(e) => setCarryOver(e.target.checked)} className="w-4 h-4 text-[#83358E] rounded focus:ring-[#83358E]" />
            <label htmlFor="carryOver" className="text-sm text-gray-700 font-medium">Mark as carry-over from previous semester</label>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2.5 bg-[#83358E] text-white rounded-lg text-sm font-medium hover:bg-[#6D2A78] transition-colors disabled:opacity-50"
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

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="border-l-4 border-[#83358E] pl-3">
            <h3 className="text-[#001A4D] font-bold text-sm">Organization Ledger</h3>
          </div>
          {!isPast && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddExpense(true)}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
              >
                <Minus className="w-3.5 h-3.5 text-blue-600" />
                Record Expense
              </button>
              <button
                onClick={() => setShowAddIncome(true)}
                className="px-3 py-1.5 bg-[#83358E] text-white text-xs rounded-lg hover:bg-[#6D2A78] transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Income
              </button>
            </div>
          )}
        </div>
        {isPast && (
          <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-200">
            <Archive className="w-4 h-4 text-amber-600" />
            <p className="text-amber-700 text-xs font-medium">Historical Data — All records are read-only.</p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {["Date", "Description", "Source", "Amount (₱)", "Balance (₱)"].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                    No transactions found for this semester.
                  </td>
                </tr>
              ) : (
                tableRows.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-sm">
                      {item.date?.toDate ? item.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-[#001A4D] text-sm">{item.description}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-medium capitalize">{item.source.replace('_', ' ')}</span>
                    </td>
                    <td className={`px-4 py-3 text-sm font-medium ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {item.type === 'income' ? '+' : '-'}₱{item.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-bold text-sm">₱{item.runningBalance.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
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
    const matchesSearch = m.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || m.schoolId.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
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
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="font-bold text-[#001A4D] text-base">Student Payables Overview</h3>
            <p className="text-gray-500 text-xs mt-0.5">Manage membership dues, fines, and event payables for active members.</p>
          </div>
          {!isPast && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGenerateDues(true)}
                className="px-3.5 py-2 bg-[#83358E] text-white rounded-lg text-xs font-bold hover:bg-[#6D2A78] transition-colors flex items-center gap-1.5"
              >
                <Coins className="w-4 h-4" />
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
            { label: "Total Payables Assigned", value: `₱${totalAssigned.toLocaleString()}`, color: "text-[#001A4D]" },
            { label: "Total Collected", value: `₱${totalCollected.toLocaleString()}`, color: "text-green-600" },
            { label: "Total Outstanding", value: `₱${totalOutstanding.toLocaleString()}`, color: "text-red-600" },
            { label: "Collection Rate", value: `${collectionRate}%`, color: "text-[#83358E]" },
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
            <div className="h-full bg-[#83358E] rounded-full" style={{ width: `${collectionRate}%` }} />
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
              subTab === key ? "border-[#83358E] text-[#83358E]" : "border-transparent text-gray-500 hover:text-gray-700"
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
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent outline-none"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent outline-none"
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
                              <span className="font-semibold text-gray-800">₱{p.assignedAmount}</span>
                            </div>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-sm font-semibold">₱{assigned.toLocaleString()}</td>
                        <td className="px-4 py-3 text-green-600 font-semibold text-sm">₱{paid.toLocaleString()}</td>
                        <td className="px-4 py-3 text-red-600 font-bold text-sm">₱{outstanding.toLocaleString()}</td>
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
                  <p className="text-[#83358E] font-bold text-lg">₱{pt.totalAssigned.toLocaleString()}</p>
                  <div className="flex justify-between text-xs mt-1 mb-2">
                    <span className="text-green-600">₱{pt.collected.toLocaleString()} collected</span>
                    <span className="text-red-600">₱{pt.outstanding.toLocaleString()} outstanding</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-[#83358E]" style={{ width: `${pct}%` }} />
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
                    const dueStr = p.dueDate?.toDate ? p.dueDate.toDate().toLocaleDateString('en-US') : 'Overdue';

                    return (
                      <tr key={p.id} className="hover:bg-red-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-[#001A4D] font-medium text-sm">{p.studentName}</p>
                          <p className="text-gray-400 text-xs">{p.studentSchoolId || p.studentId}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-sm font-medium">{p.label}</td>
                        <td className="px-4 py-3 text-red-600 font-bold text-sm">₱{outstanding.toLocaleString()}</td>
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
      <div className="p-4 bg-[#F3E8FF] border border-[#83358E]/30 rounded-xl">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[#83358E] flex-shrink-0 mt-0.5" />
          <p className="text-[#83358E] text-sm">
            Liquidation reports must account for budget items in your Club Budget Plan. The SAO Adviser will cross-reference your liquidations against your approved budget ceiling.
          </p>
        </div>
      </div>
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="border-l-4 border-[#83358E] pl-3">
            <h3 className="text-[#001A4D] font-bold text-sm">Liquidation Reports</h3>
          </div>
          {!isPast && (
            <button
              onClick={handleOpenCreate}
              className="px-3 py-1.5 bg-[#83358E] text-white text-xs rounded-lg flex items-center gap-1.5 font-medium hover:bg-[#6D2A78] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
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
                const submittedDate = l.submittedAt?.toDate
                  ? l.submittedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : l.createdAt?.toDate
                  ? l.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Draft';

                return (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-[#001A4D] font-bold text-sm">{l.eventTitle}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{submittedDate}</td>
                    <td className="px-4 py-3 text-gray-700 font-semibold text-sm">₱{(l.allocatedBudget || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-[#83358E] font-bold text-sm">₱{(l.totalActualSpending || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">{statusBadge(l.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setViewingDetailReport(l)}
                          className="text-blue-600 hover:underline text-xs flex items-center gap-1 font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Details
                        </button>
                        {!isPast && (l.status === 'draft' || l.status === 'returned') && (
                          <button
                            onClick={() => handleOpenEdit(l)}
                            className="text-[#83358E] hover:underline text-xs flex items-center gap-1 font-bold"
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
                className="p-1 hover:bg-white/10 rounded-lg text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg text-center">
                <div>
                  <div className="text-xs text-gray-500">Allocated Budget</div>
                  <div className="font-bold text-sm text-[#001A4D]">
                    ₱{viewingDetailReport.allocatedBudget.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Actual Spending</div>
                  <div className="font-bold text-sm text-[#83358E]">
                    ₱{viewingDetailReport.totalActualSpending.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Surplus / Deficit</div>
                  <div className={`font-bold text-sm ${viewingDetailReport.surplusOrDeficit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₱{viewingDetailReport.surplusOrDeficit.toLocaleString()}
                  </div>
                </div>
              </div>

              <h4 className="font-bold text-sm text-gray-900 pt-2">Line Items</h4>
              <div className="space-y-2">
                {viewingDetailReport.lineItems?.map((item, idx) => (
                  <div key={idx} className="p-3 border border-gray-200 rounded-lg text-xs space-y-1.5 bg-gray-50/50">
                    <div className="flex items-center justify-between font-bold text-gray-900">
                      <span>{item.description} ({item.category})</span>
                      <span className="text-[#83358E]">Actual Cost: ₱{item.totalCost.toLocaleString()}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-gray-600 gap-2">
                      <span>
                        <strong>Actual:</strong> {item.quantity} Qty × ₱{item.unitCost.toLocaleString()}
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
                          className="text-[#1E70E8] hover:underline font-semibold text-xs flex items-center gap-1"
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
                          <span className="text-[10px] text-gray-500">{new Date(rem.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-800">{rem.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-right">
              <button
                onClick={() => setViewingDetailReport(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
      <div className="w-[120px] h-[120px] bg-gradient-to-br from-[#001A4D] to-[#83358E] rounded-full flex items-center justify-center mb-6">
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
          <ArrowRight className="w-10 h-10 text-[#83358E] mx-auto mb-3" />
          <p className="text-[#83358E] font-bold text-base mb-1">Start New Semester</p>
          <p className="text-gray-500 text-sm mb-4">Begin working in 1st Semester A.Y. 2026–2027.</p>
          <button onClick={onStartNew} className="w-full py-2.5 bg-[#83358E] text-white rounded-lg text-sm font-medium hover:bg-[#6D2A78] transition-colors">
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
    { id: "officers", icon: Shield, color: "text-[#83358E]", bg: "bg-[#F3E8FF]", label: "Confirm Organization Officers", desc: "Verify that your organization's officer roster is up to date for this semester.", action: "Update Officers" },
    { id: "budget", icon: Wallet, color: "text-blue-600", bg: "bg-blue-50", label: "Set Club Budget Plan", desc: "Plan your organization's expenditures for the new semester.", action: "Set Budget Plan" },
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
                      : `border-[#83358E] text-[#83358E] hover:bg-[#83358E]/5`
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
              <div className="h-full bg-[#83358E] rounded-full transition-all" style={{ width: `${(doneCount / items.length) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={onContinue}
            disabled={doneCount === 0}
            className={`w-full py-3 rounded-xl text-sm font-bold mb-2 transition-colors ${
              doneCount > 0 ? "bg-[#83358E] text-white hover:bg-[#6D2A78]" : "bg-gray-100 text-gray-400 cursor-not-allowed"
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
          { label: "Total Collections", value: "₱21,250" },
          { label: "Total Outstanding", value: "₱3,500" },
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
            {activeOrgName && <span className="font-semibold ml-2 text-[#83358E]">({activeOrgName})</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedSemId}
            onChange={(e) => setSelectedSemId(e.target.value)}
            className="px-4 py-2 border border-[#E0E0E0] rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#83358E] focus:border-transparent outline-none"
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
      <MetricsRow isPast={isPast} ledgerData={ledgerData} semesterId={selectedSemId} payablesData={payablesData} />

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

      {/* Three-Tab Area */}
      <div>
        <div className="flex border-b border-gray-200 mb-4">
          {([["budget", "Budget Tracker"], ["payables", "Student Payables"], ["liquidation", "Liquidation Reports"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? "bg-[#001A4D] text-white border-[#FFD41C] -mb-px rounded-t-lg"
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

        {activeTab === "payables" && (
          <StudentPayablesTab
            isPast={isPast}
            payables={payablesData}
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
