import { useState, useMemo, useEffect } from "react";
import { toast } from 'sonner';

import { useOrgLedger, parseTimestampMillis } from '../../modules/finance/hooks/useFinanceStream';
import { addOrgLedgerTransaction } from '../../modules/finance/services/finance.service';
import { useSemesters } from '../../modules/academic/hooks/useAcademicStream';
import { useOrgPayables, useOrgCollectionsStream } from '../../modules/finance/hooks/usePayableStream';
import { transferCollectionGroupToLedger } from '../../modules/finance/services/payable.service';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useOrgMembers } from '../../modules/organizations/hooks/useOrgMembers';
import { useStudents } from '../../modules/students/hooks/useStudentStream';
import type { OrgLedgerDocument } from '../../modules/finance/types/finance.types';
import type { PayableDocument, StudentEventCollectionGroup } from '../../modules/finance/types/payable.types';
import { Timestamp } from 'firebase/firestore';

import { GenerateDuesModal } from '../components/GenerateDuesModal';
import { AddPayableModal } from '../components/AddPayableModal';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { formatCurrency, formatVariance } from '../../utils/currency';
import { formatAppDate, formatAppDateTime } from '../../utils/date';
import { uploadToCloudinary } from '../../../services/cloudinary';

import {
  Building2,
  TrendingUp,
  Wallet,
  Coins,
  CheckCircle,
  AlertCircle,
  Clock,
  Plus,
  Tag,
  Archive,
  Eye,
  X,
  Download,
  FileText,
  Users,
  History,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Shield,
  RefreshCw,
  Info,
  Minus,
  ChevronRight,
  ChevronLeft,
  Receipt,
  Search,
  Filter,
  DollarSign,
  Edit3,
  FileSpreadsheet,
  Upload,
  Trash2,
  Loader2,
  Layers,
} from "lucide-react";

type FinanceTab = "budget" | "collections";
type CollectionsSubView = "collections" | "members" | "overdue";

import TransactionDetailModal from '../../modules/finance/components/TransactionDetailModal';
import { useUserNameResolver } from '../../modules/finance/hooks/useUserNameResolver';



// ─── Metrics Row (Clean 4-Card KPI Layout) ──────────────────────────────────

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
    return ledgerData.filter((t) => !t.semesterId || t.semesterId === semesterId);
  }, [ledgerData, semesterId]);

  const totalIncome = currentSemTransactions
    .filter((t) => String(t.type || '').toLowerCase() === "income")
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalExpenses = currentSemTransactions
    .filter((t) => String(t.type || '').toLowerCase() === "expense")
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const currentBalance = totalIncome - totalExpenses;

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${isPast ? "opacity-80" : ""}`}>
      {/* 1. Current Balance */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between text-gray-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Current Balance</span>
          <Wallet className="w-5 h-5 text-gray-400" />
        </div>
        <p className="text-2xl font-bold text-[#001A4D]">{formatCurrency(currentBalance)}</p>
        <p className="text-xs text-gray-400 mt-1">Available Club Funds</p>
      </div>

      {/* 2. Total Income */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between text-gray-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Total Income</span>
          <ArrowDownLeft className="w-5 h-5 text-green-500" />
        </div>
        <p className="text-2xl font-bold text-green-600">+{formatCurrency(totalIncome)}</p>
        <p className="text-xs text-gray-400 mt-1">Dues, Collections, Allocations</p>
      </div>

      {/* 3. Total Expenses */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between text-gray-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Total Expenses</span>
          <ArrowUpRight className="w-5 h-5 text-red-500" />
        </div>
        <p className="text-2xl font-bold text-red-600">−{formatCurrency(totalExpenses)}</p>
        <p className="text-xs text-gray-400 mt-1">Events, Operations, Deficits</p>
      </div>

      {/* 4. Pending Collections */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between text-gray-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Pending Dues</span>
          <Clock className="w-5 h-5 text-amber-500" />
        </div>
        <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalOutstanding)}</p>
        <p className="text-xs text-gray-400 mt-1">Across {payablesData.length} payable record(s)</p>
      </div>
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
  const [form, setForm] = useState({ amount: "", notes: "", semesterId: activeSemester?.id || "", receiptNumber: "" });
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [carryOver, setCarryOver] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await uploadToCloudinary(file, { folder: "finance/org_income_proofs" });
      setReceiptUrl(res.secureUrl);
      toast.success("Income proof / receipt photo uploaded successfully.");
    } catch (err: any) {
      console.error("Failed to upload proof photo:", err);
      toast.error(err?.message || "Failed to upload proof photo.");
    } finally {
      setIsUploading(false);
    }
  };

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
        receiptUrl: receiptUrl || undefined,
        proofUrl: receiptUrl || undefined,
        receiptNumber: form.receiptNumber?.trim() || undefined,
      });
      toast.success("Income transaction recorded successfully.");
      onSuccess();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to record income.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[520px] overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-[#FFD41C]" />
            <h3 className="text-white font-bold text-base">Add Club Income / Allocation</h3>
            <span className="px-2.5 py-0.5 bg-[#FFD41C] text-[#001A4D] text-xs font-bold rounded-full">{organizationName}</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
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

          {/* ── Proof of Income / Receipt Photo Upload ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-[#001A4D]" />
                Proof of Income / Receipt Evidence <span className="text-xs text-gray-400 font-normal">(Optional)</span>
              </span>
            </label>

            {receiptUrl ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <img
                  src={receiptUrl}
                  alt="Proof Preview"
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                    Proof Photo Attached
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Uploaded & ready to save with transaction</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReceiptUrl("")}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Remove photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-gray-300 hover:border-[#001A4D] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-gray-50/50 hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                />
                {isUploading ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#001A4D] py-1">
                    <Loader2 className="w-4 h-4 animate-spin text-[#0E4EBD]" />
                    Uploading proof to cloud...
                  </div>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#001A4D]">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-gray-700">Click to upload allocation proof / receipt photo</div>
                    <div className="text-[10px] text-gray-400">PNG, JPG, WEBP up to 5MB</div>
                  </>
                )}
              </label>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Official Receipt (OR) / Ref # (optional)</label>
            <input
              type="text"
              placeholder="e.g. OR-2026-0042 or Check #12345"
              value={form.receiptNumber}
              onChange={(e) => setForm({ ...form, receiptNumber: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D]"
            />
          </div>

          <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <input type="checkbox" id="carryOver" checked={carryOver} onChange={(e) => setCarryOver(e.target.checked)} className="w-4 h-4 text-[#0E4EBD] rounded focus:ring-[#0E4EBD]" />
            <label htmlFor="carryOver" className="text-sm text-gray-700 font-medium">Mark as carry-over from previous semester</label>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex justify-between flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer">Cancel</button>
          <button
            onClick={handleSave}
            disabled={loading || isUploading}
            className="px-5 py-2.5 bg-[#001A4D] hover:bg-[#002D72] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
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
  const [form, setForm] = useState({ amount: "", notes: "", eventId: "", receiptNumber: "" });
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await uploadToCloudinary(file, { folder: "finance/org_expense_receipts" });
      setReceiptUrl(res.secureUrl);
      toast.success("Expense receipt photo uploaded successfully.");
    } catch (err: any) {
      console.error("Failed to upload expense receipt:", err);
      toast.error(err?.message || "Failed to upload receipt photo.");
    } finally {
      setIsUploading(false);
    }
  };

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
        receiptUrl: receiptUrl || undefined,
        proofUrl: receiptUrl || undefined,
        receiptNumber: form.receiptNumber?.trim() || undefined,
      });
      toast.success("Expense recorded successfully.");
      onSuccess();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to record expense.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[520px] overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Minus className="w-5 h-5 text-white" />
            <h3 className="text-white font-bold text-base">Record Manual Expense</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₱) <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₱</span>
              <input
                type="number"
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D]"
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {/* ── Proof of Expense / Receipt Photo Upload ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-red-600" />
                Proof of Expense / Receipt Photo <span className="text-xs text-gray-400 font-normal">(Optional)</span>
              </span>
            </label>

            {receiptUrl ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <img
                  src={receiptUrl}
                  alt="Receipt Preview"
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                    Receipt Photo Attached
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Uploaded & ready to save with expense</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReceiptUrl("")}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Remove photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-gray-300 hover:border-[#001A4D] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-gray-50/50 hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                />
                {isUploading ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#001A4D] py-1">
                    <Loader2 className="w-4 h-4 animate-spin text-[#0E4EBD]" />
                    Uploading receipt to cloud...
                  </div>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-gray-700">Click to upload official receipt photo</div>
                    <div className="text-[10px] text-gray-400">PNG, JPG, WEBP up to 5MB</div>
                  </>
                )}
              </label>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Official Receipt (OR) / Invoice # (optional)</label>
            <input
              type="text"
              placeholder="e.g. OR# 987654 or Invoice #INV-2026"
              value={form.receiptNumber}
              onChange={(e) => setForm({ ...form, receiptNumber: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D]"
            />
          </div>

          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-blue-800 text-xs">
              Use this form to record expenses that were not processed through a formal Liquidation Report.
            </p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex justify-between flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer">Cancel</button>
          <button
            onClick={handleSave}
            disabled={loading || isUploading}
            className="px-5 py-2.5 bg-[#001A4D] hover:bg-[#002D72] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
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
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<OrgLedgerDocument | null>(null);
  const { resolveUserName } = useUserNameResolver();
  
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState(1);
  const LEDGER_PER_PAGE = 8;

  const currentSemTransactions = useMemo(() => {
    if (semesterId === "all") return ledgerData;
    return ledgerData.filter((t) => !t.semesterId || t.semesterId === semesterId);
  }, [ledgerData, semesterId]);

  // Sort chronological (oldest first) to compute running balance accurately
  const chronological = useMemo(() => {
    return [...currentSemTransactions].sort((a, b) => {
      const aTime = parseTimestampMillis(a.date) || parseTimestampMillis(a.createdAt) || 0;
      const bTime = parseTimestampMillis(b.date) || parseTimestampMillis(b.createdAt) || 0;
      return aTime - bTime;
    });
  }, [currentSemTransactions]);

  const tableRows = useMemo(() => {
    let running = 0;
    const withBalances = chronological.map((t) => {
      const amt = Number(t.amount) || 0;
      const isInc = String(t.type || '').toLowerCase() === 'income';
      if (isInc) running += amt;
      else running -= amt;
      return { ...t, amount: amt, runningBalance: running };
    });
    return withBalances.reverse(); // Newest first for table view
  }, [chronological]);

  const filteredRows = useMemo(() => {
    return tableRows.filter((item) => {
      const typeLower = (item.type || '').toLowerCase();
      const passType = txFilter === 'all' ? true : typeLower === txFilter;
      const passSource = sourceFilter === 'all' ? true : item.source === sourceFilter;
      
      const q = searchQuery.trim().toLowerCase();
      const passSearch = !q
        ? true
        : (item.description || '').toLowerCase().includes(q) ||
          (item.addedBy || '').toLowerCase().includes(q) ||
          (item.collectionId || '').toLowerCase().includes(q);

      return passType && passSource && passSearch;
    });
  }, [tableRows, txFilter, sourceFilter, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [txFilter, sourceFilter, searchQuery]);

  const totalPages = Math.ceil(filteredRows.length / LEDGER_PER_PAGE) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * LEDGER_PER_PAGE;
    return filteredRows.slice(start, start + LEDGER_PER_PAGE);
  }, [filteredRows, page]);

  const currentClubBalance = tableRows.length > 0 ? tableRows[0].runningBalance : 0;

  const handleExportCSV = () => {
    if (filteredRows.length === 0) {
      toast.error("No transactions to export for the current filters.");
      return;
    }

    const headers = ["Date", "Description", "Source", "Type", "Amount (PHP)", "Running Balance (PHP)", "Recorded By", "OR/Reference #"];
    const rows = filteredRows.map(tx => [
      `"${formatAppDate(tx.date, 'Unknown')}"`,
      `"${(tx.description || '').replace(/"/g, '""')}"`,
      `"${tx.source}"`,
      `"${tx.type}"`,
      `"${tx.amount}"`,
      `"${tx.runningBalance}"`,
      `"${(resolveUserName(tx.addedBy) || tx.addedBy || '').replace(/"/g, '""')}"`,
      `"${(tx.receiptNumber || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `STI_Sync_${organizationName.replace(/\s+/g, '_')}_Budget_Ledger_${txFilter.toUpperCase()}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredRows.length} filtered ledger records to CSV.`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="border-l-4 border-[#0E4EBD] pl-3">
            <h3 className="text-[#001A4D] font-bold text-sm">Budget Ledger Transactions</h3>
            <p className="text-gray-500 text-xs mt-0.5">Club treasury funds, income allocations, expenses, and transfers</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-52">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-gray-50 border border-gray-200 text-gray-700 outline-none focus:ring-2 focus:ring-[#0E4EBD]/20"
              />
            </div>

            {/* Source Filter */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-50 border border-gray-200 text-gray-700 outline-none focus:ring-2 focus:ring-[#0E4EBD]/20 cursor-pointer"
            >
              <option value="all">All Sources</option>
              <option value="allocation">Club Allocation</option>
              <option value="student_collection">Student Collections</option>
              <option value="event_budget">Event Budgets</option>
              <option value="liquidation_surplus">Liquidation Surplus</option>
              <option value="liquidation_deficit">Liquidation Deficit</option>
              <option value="manual_expense">Manual Expenses</option>
              <option value="carry_over">Carry-Over</option>
            </select>

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

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
              title="Export filtered transactions to CSV"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              <span>Export CSV</span>
            </button>

            {!isPast && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
                >
                  <Minus className="w-3.5 h-3.5 text-[#0E4EBD]" />
                  Record Expense
                </button>
                <button
                  onClick={() => setShowAddIncome(true)}
                  className="px-3 py-1.5 bg-[#001A4D] text-white text-xs rounded-lg hover:bg-[#002D72] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs font-medium"
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
        <div className="overflow-x-auto">
          <table className="w-full relative">
            <thead className="bg-gray-50 border-b border-[#E0E0E0]">
              <tr>
                {["Date", "Description", "Source", "Amount (₱)", "Balance (₱)", "Action"].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-[#E0E0E0]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                    No transactions found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-gray-500 font-mono text-xs whitespace-nowrap">
                      {formatAppDate(item.date, 'Unknown')}
                    </td>
                    <td className="px-4 py-3 text-[#001A4D] text-sm">
                      <p className="font-medium">{item.description}</p>
                      {(() => {
                        const creator = resolveUserName(item.addedBy);
                        return creator ? (
                          <p className="text-gray-400 text-[11px] mt-0.5">By {creator}</p>
                        ) : null;
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                        item.source === 'event_budget'
                          ? 'bg-blue-100 text-blue-800'
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
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedTxForDetail(item)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#0E4EBD] hover:text-white hover:bg-[#0E4EBD] border border-[#0E4EBD]/30 rounded-lg font-medium whitespace-nowrap cursor-pointer transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#001A4D] shadow-md">
                <td colSpan={4} className="px-4 py-3 text-white font-bold text-sm bg-[#001A4D]">Current Club Balance</td>
                <td colSpan={2} className="px-4 py-3 text-[#FFD41C] font-bold text-base bg-[#001A4D]">
                  {formatCurrency(currentClubBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Ledger Bottom Pagination ── */}
        {filteredRows.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-2 bg-gray-50">
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-700">{((page - 1) * LEDGER_PER_PAGE) + 1}</span> to{" "}
              <span className="font-semibold text-gray-700">{Math.min(page * LEDGER_PER_PAGE, filteredRows.length)}</span> of{" "}
              <span className="font-semibold text-gray-700">{filteredRows.length}</span> transactions
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="px-2 py-1 text-xs border border-gray-200 rounded-md bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 text-xs rounded-md font-semibold transition-colors cursor-pointer ${
                      page === p
                        ? "bg-[#001A4D] text-[#FFD41C]"
                        : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="px-2 py-1 text-xs border border-gray-200 rounded-md bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
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

      {selectedTxForDetail && (
        <TransactionDetailModal
          transaction={selectedTxForDetail}
          isOpen={true}
          onClose={() => setSelectedTxForDetail(null)}
          isOfficer={true}
        />
      )}
    </div>
  );
}

// ─── Student Collections & Treasury Transfers Tab ──────────────────────────────

function OrgCollectionDetailModal({
  collection,
  isPast,
  onClose,
  onTransfer,
}: {
  collection: StudentEventCollectionGroup;
  isPast: boolean;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[680px] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-bold text-base">{collection.eventName}</h3>
              <span className="px-2 py-0.5 bg-[#FFD41C] text-[#001A4D] rounded-full text-xs font-bold capitalize">
                {collection.type?.replace('_', ' ') || 'Collection'}
              </span>
            </div>
            <p className="text-blue-200 text-xs mt-0.5">Collection Breakdown & Treasury Transfer</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">Assigned / Student</p>
              <p className="text-base font-bold text-[#001A4D] mt-0.5">{formatCurrency(collection.payablePerStudent)}</p>
              <p className="text-[10px] text-gray-400">{collection.totalStudents} total</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-green-700">Total Collected</p>
              <p className="text-base font-bold text-green-700 mt-0.5">{formatCurrency(totalCollected)}</p>
              <p className="text-[10px] text-gray-400">{paid.length} paid</p>
            </div>
            <div className="bg-white border border-blue-200 rounded-xl p-3 text-center bg-blue-50/30">
              <p className="text-xs text-blue-700">In Club Treasury</p>
              <p className="text-base font-bold text-blue-700 mt-0.5">{formatCurrency(alreadyTransferredAmount)}</p>
              <p className="text-[10px] text-blue-600">{alreadyTransferred.length} transferred</p>
            </div>
            <div className="bg-white border border-amber-200 rounded-xl p-3 text-center bg-amber-50/40">
              <p className="text-xs text-amber-800">Ready to Transfer</p>
              <p className="text-base font-bold text-amber-700 mt-0.5">{formatCurrency(untransferredAmount)}</p>
              <p className="text-[10px] text-amber-600">{untransferred.length} newly paid</p>
            </div>
          </div>

          {/* Roster Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <p className="text-[#001A4D] text-xs font-bold uppercase tracking-wide">Student Payment Records</p>
              <div className="flex gap-2">
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
                        <td className="px-3.5 py-2.5 font-bold text-gray-700">
                          {isStudentPaid ? formatCurrency(p.amount) : "—"}
                        </td>
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
                <strong>Incremental Transfer:</strong> {formatCurrency(alreadyTransferredAmount)} was previously credited to your club treasury. You can now transfer the new {formatCurrency(untransferredAmount)} collected from {untransferred.length} additional student(s) without duplicate crediting.
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0 bg-white">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 cursor-pointer">
            Close
          </button>
          {isPast ? (
            <div className="flex-1 py-2.5 bg-amber-50 text-amber-700 rounded-xl text-sm font-medium text-center flex items-center justify-center gap-2 select-none">
              Read-Only Past Semester
            </div>
          ) : untransferredAmount > 0 ? (
            <button
              onClick={() => { onTransfer(); onClose(); }}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Transfer {formatCurrency(untransferredAmount)} to Club Treasury
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

// ─── Merged Student Collections & Payables Tab ─────────────────────────────────

function StudentCollectionsAndPayablesTab({
  isPast,
  payables,
  organizationId,
  organizationName,
  semesterId,
  officerStudentId,
}: {
  isPast: boolean;
  payables: PayableDocument[];
  organizationId: string;
  organizationName: string;
  semesterId: string;
  officerStudentId: string;
}) {
  const { data: rawCollections, loading: collectionsLoading } = useOrgCollectionsStream(organizationId, semesterId);
  const { members: orgMembers = [], loading: membersLoading } = useOrgMembers(organizationId);
  const { data: allStudents = [] } = useStudents();
  const [subView, setSubView] = useState<CollectionsSubView>("collections");

  // Modals
  const [viewCollection, setViewCollection] = useState<StudentEventCollectionGroup | null>(null);
  const [showGenerateDues, setShowGenerateDues] = useState(false);
  const [showAddPayable, setShowAddPayable] = useState(false);
  const [selectedPayableForPayment, setSelectedPayableForPayment] = useState<PayableDocument | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [collectionStatusFilter, setCollectionStatusFilter] = useState<string>("all");
  const [memberStatusFilter, setMemberStatusFilter] = useState<string>("All");

  // Pagination
  const PER_PAGE = 8;
  const [collectionsPage, setCollectionsPage] = useState(1);
  const [membersPage, setMembersPage] = useState(1);

  useEffect(() => {
    setCollectionsPage(1);
  }, [searchQuery, typeFilter, collectionStatusFilter]);

  useEffect(() => {
    setMembersPage(1);
  }, [searchQuery, memberStatusFilter]);

  // Active club members lookup
  const activeMembers = useMemo(() => {
    return orgMembers.filter((m) => m && m.status === 'active');
  }, [orgMembers]);

  const studentMap = useMemo(() => {
    const map = new Map<string, any>();
    allStudents.forEach((s) => {
      if (s.id) map.set(s.id.toLowerCase().trim(), s);
      if (s.authUid) map.set(s.authUid.toLowerCase().trim(), s);
      if (s.studentId) map.set(s.studentId.toLowerCase().trim(), s);
      if (s.email) map.set(s.email.toLowerCase().trim(), s);
    });
    return map;
  }, [allStudents]);

  // Build memberGroups strictly for active members of this club
  const memberGroups = useMemo(() => {
    return activeMembers.map((m) => {
      const sDoc =
        studentMap.get((m.studentId || '').toLowerCase().trim()) ||
        studentMap.get((m.id || '').toLowerCase().trim()) ||
        studentMap.get((m.email || '').toLowerCase().trim());

      const possibleIds = new Set<string>();
      if (m.studentId) possibleIds.add(m.studentId.toLowerCase().trim());
      if (m.id) possibleIds.add(m.id.toLowerCase().trim());
      if (sDoc?.id) possibleIds.add(sDoc.id.toLowerCase().trim());
      if (sDoc?.authUid) possibleIds.add(sDoc.authUid.toLowerCase().trim());
      if (sDoc?.studentId) possibleIds.add(sDoc.studentId.toLowerCase().trim());

      // Filter payables that belong to this member
      const memberPayables = payables.filter((p) => {
        const pStudentId = (p.studentId || '').toLowerCase().trim();
        const pSchoolId = (p.studentSchoolId || '').toLowerCase().trim();
        return (pStudentId && possibleIds.has(pStudentId)) || (pSchoolId && possibleIds.has(pSchoolId));
      });

      const officialName = sDoc
        ? [sDoc.firstName, sDoc.middleName, sDoc.lastName].filter(Boolean).join(' ')
        : (m.studentName || 'Member');
      const officialSchoolId = sDoc?.studentId || m.studentId || m.id;
      const officialCourse = m.course || sDoc?.course || sDoc?.courseCode || '';
      const officialYear = m.year || sDoc?.year || sDoc?.yearLevel || '';

      return {
        studentId: m.studentId || m.id,
        studentName: officialName,
        schoolId: officialSchoolId,
        courseCode: officialCourse,
        yearLevel: officialYear,
        payables: memberPayables,
      };
    });
  }, [activeMembers, studentMap, payables]);

  // Overall financial calculations scoped strictly to club members
  const totalAssigned = useMemo(() => {
    return memberGroups.reduce((sum, m) => sum + m.payables.reduce((a, p) => a + (p.assignedAmount || 0), 0), 0);
  }, [memberGroups]);

  const totalCollected = useMemo(() => {
    return memberGroups.reduce((sum, m) => sum + m.payables.reduce((a, p) => a + (p.paidAmount || 0), 0), 0);
  }, [memberGroups]);

  const totalOutstanding = totalAssigned - totalCollected;
  const pendingTransferTotal = rawCollections.reduce((s, c) => s + (c.untransferredAmount || 0), 0);

  // Filter collections
  const filteredCollections = useMemo(() => {
    return rawCollections.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.eventName.toLowerCase().includes(q) ||
        (c.type || "").toLowerCase().includes(q);

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "membership_due" && c.type === "membership_due") ||
        (typeFilter === "event_fee" && c.type === "event_fee") ||
        (typeFilter === "org_fine" && (c.type === "org_fine" || (c as any).type === "event_fine"));

      const paid = c.payments.filter((p) => p.status === "Paid");
      const untransferred = c.untransferredAmount || 0;

      let matchesStatus = true;
      if (collectionStatusFilter === "ready_transfer") {
        matchesStatus = untransferred > 0;
      } else if (collectionStatusFilter === "transferred") {
        matchesStatus = c.transferredToBudget === true && untransferred === 0;
      } else if (collectionStatusFilter === "no_payments") {
        matchesStatus = paid.length === 0;
      }

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [rawCollections, searchQuery, typeFilter, collectionStatusFilter]);

  const totalCollectionsPages = Math.max(1, Math.ceil(filteredCollections.length / PER_PAGE));
  const paginatedCollections = useMemo(() => {
    const start = (collectionsPage - 1) * PER_PAGE;
    return filteredCollections.slice(start, start + PER_PAGE);
  }, [filteredCollections, collectionsPage]);

  // Overdue payables strictly for active club members
  const now = Date.now();
  const overduePayables = useMemo(() => {
    const list: Array<PayableDocument & { memberName?: string; memberSchoolId?: string }> = [];
    memberGroups.forEach((m) => {
      m.payables.forEach((p) => {
        const isOverdue =
          p.status === "overdue" ||
          (p.status !== "paid" && p.status !== "waived" && p.dueDate?.toMillis && p.dueDate.toMillis() < now);
        if (isOverdue) {
          list.push({
            ...p,
            studentName: p.studentName || m.studentName,
            studentSchoolId: p.studentSchoolId || m.schoolId,
          });
        }
      });
    });
    return list;
  }, [memberGroups, now]);

  const filteredMembers = useMemo(() => {
    return memberGroups.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (m.studentName || "").toLowerCase().includes(q) ||
        (m.schoolId || "").toLowerCase().includes(q);

      const memberAssigned = m.payables.reduce((a, p) => a + (p.assignedAmount || 0), 0);
      const memberPaid = m.payables.reduce((a, p) => a + (p.paidAmount || 0), 0);

      let matchesStatus = true;
      if (memberStatusFilter === "Paid") matchesStatus = memberPaid >= memberAssigned && memberAssigned > 0;
      else if (memberStatusFilter === "Partial") matchesStatus = memberPaid > 0 && memberPaid < memberAssigned;
      else if (memberStatusFilter === "Unpaid") matchesStatus = memberPaid === 0 && memberAssigned > 0;
      else if (memberStatusFilter === "Overdue") {
        matchesStatus = m.payables.some(
          (p) => p.status === "overdue" || (p.dueDate?.toMillis && p.dueDate.toMillis() < now && p.status !== "paid")
        );
      }

      return matchesSearch && matchesStatus;
    });
  }, [memberGroups, searchQuery, memberStatusFilter, now]);

  const totalMemberPages = Math.max(1, Math.ceil(filteredMembers.length / PER_PAGE));
  const paginatedMembers = useMemo(() => {
    const start = (membersPage - 1) * PER_PAGE;
    return filteredMembers.slice(start, start + PER_PAGE);
  }, [filteredMembers, membersPage]);

  // Transfer collection to ledger
  const handleTransfer = async (item: StudentEventCollectionGroup) => {
    setIsTransferring(true);
    try {
      const res = await transferCollectionGroupToLedger({
        collectionGroupId: item.id,
        eventId: item.eventId !== "unassigned" ? item.eventId : null,
        type: item.type,
        organizationId,
        targetLedger: "org",
        semesterId: semesterId !== "all" ? semesterId : null,
        recordedByUid: officerStudentId,
        collectionName: item.eventName,
        payableIds: item.payments.map((p) => p.id),
      });

      if (res.transferredCount > 0) {
        toast.success(`Transferred ${formatCurrency(res.transferredAmount)} across ${res.transferredCount} payment(s) to Club Treasury.`);
      } else {
        toast.info("No pending paid collections available to transfer.");
      }
    } catch (err: any) {
      console.error("Failed to transfer collection to organization ledger:", err);
      toast.error(err?.message || "Failed to transfer collection.");
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Information Banner */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-900 font-bold text-sm">Centralized Student Collections, Dues & Treasury Transfer</p>
          <p className="text-amber-800 text-xs mt-0.5 leading-relaxed">
            Events with student payables, membership dues, and fine penalties are managed here. Click <strong>View & Transfer</strong> to review student payments and credit cash into your Club Budget Ledger.
          </p>
        </div>
      </div>

      {/* Overview & Action Bar */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="border-l-4 border-[#0E4EBD] pl-3">
            <h3 className="font-bold text-[#001A4D] text-base">Student Collections & Payables</h3>
            <p className="text-gray-500 text-xs mt-0.5">Membership Dues, Event Fees, Club Fines, and Member Assessments</p>
          </div>
          {!isPast && (
            <div className="flex items-center gap-2 flex-wrap">
              {pendingTransferTotal > 0 && (
                <div className="px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Ready to Transfer: {formatCurrency(pendingTransferTotal)}
                </div>
              )}
              <button
                onClick={() => setShowGenerateDues(true)}
                className="px-3.5 py-2 bg-[#0E4EBD] text-white rounded-lg text-xs font-bold hover:bg-[#0A3D94] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Coins className="w-4 h-4 text-[#FFD41C]" />
                Generate Membership Dues
              </button>
              <button
                onClick={() => setShowAddPayable(true)}
                className="px-3.5 py-2 bg-[#001A4D] hover:bg-[#002D72] text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-[#FFD41C]" />
                Add Payable / Fine
              </button>
            </div>
          )}
        </div>

        {/* 4-KPI Metric Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-200 gap-y-3 md:gap-y-0">
          <div className="px-4 first:pl-0 text-center">
            <p className="text-2xl font-bold text-[#001A4D]">{formatCurrency(totalAssigned)}</p>
            <p className="text-gray-400 text-xs mt-1">Total Assigned Dues</p>
          </div>
          <div className="px-4 text-center">
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCollected)}</p>
            <p className="text-gray-400 text-xs mt-1">Total Collected</p>
          </div>
          <div className="px-4 text-center">
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
            <p className="text-gray-400 text-xs mt-1">Total Outstanding</p>
          </div>
          <div className="px-4 last:pr-0 text-center">
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(pendingTransferTotal)}</p>
            <p className="text-gray-400 text-xs mt-1">Ready to Transfer to Treasury</p>
          </div>
        </div>
      </div>

      {/* Sub-View Navigation Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => {
            setSubView("collections");
            setSearchQuery("");
          }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            subView === "collections"
              ? "border-[#001A4D] text-[#001A4D] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Layers className="w-4 h-4" />
          Collection Groups ({rawCollections.length})
        </button>

        <button
          onClick={() => {
            setSubView("members");
            setSearchQuery("");
          }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            subView === "members"
              ? "border-[#001A4D] text-[#001A4D] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Users className="w-4 h-4" />
          Member Payables Roster ({memberGroups.length})
        </button>

        <button
          onClick={() => {
            setSubView("overdue");
            setSearchQuery("");
          }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            subView === "overdue"
              ? "border-[#001A4D] text-[#001A4D] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <AlertCircle className="w-4 h-4 text-red-500" />
          Overdue Payables
          {overduePayables.length > 0 && (
            <span className="w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
              {overduePayables.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Sub-view 1: Collection Groups (Admin-style Table) ── */}
      {subView === "collections" && (
        <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-xs space-y-0">
          {/* Filters Bar */}
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search collection name, event, or fee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-[#0E4EBD] outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none bg-white cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="membership_due">Membership Dues</option>
                <option value="event_fee">Event Fees</option>
                <option value="org_fine">Club Fines</option>
              </select>

              <select
                value={collectionStatusFilter}
                onChange={(e) => setCollectionStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none bg-white cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="ready_transfer">Ready to Transfer</option>
                <option value="transferred">Fully Transferred</option>
                <option value="no_payments">No Payments</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {["Collection / Event Name", "Type", "Assigned / Student", "Students", "Paid", "Collected (₱)", "Status", "Action"].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {collectionsLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0E4EBD]" />
                      Loading collection groups...
                    </td>
                  </tr>
                ) : paginatedCollections.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No collection groups found matching your filters.
                    </td>
                  </tr>
                ) : (
                  paginatedCollections.map((c) => {
                    const paid = c.payments.filter((p) => p.status === "Paid");
                    const totalCol = c.totalCollected || paid.reduce((s, p) => s + p.amount, 0);
                    const pct = c.totalStudents > 0 ? Math.round((paid.length / c.totalStudents) * 100) : 0;
                    const untransferred = c.untransferredAmount || 0;
                    const hasTransferred = (c.transferredAmount || 0) > 0;

                    const typeBadge =
                      c.type === "membership_due"
                        ? "bg-indigo-100 text-indigo-800"
                        : c.type === "org_fine"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-blue-100 text-blue-700";

                    const typeName =
                      c.type === "membership_due"
                        ? "Membership Due"
                        : c.type === "org_fine"
                        ? "Club Fine"
                        : "Event Fee";

                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-[#001A4D] font-bold text-sm">{c.eventName}</p>
                          <p className="text-gray-400 text-[11px]">{c.eventDate}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded-md font-semibold ${typeBadge}`}>
                            {typeName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-sm font-semibold">
                          {formatCurrency(c.payablePerStudent)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{c.totalStudents}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-green-600 text-xs font-bold">{paid.length}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-green-700 font-bold text-sm">{formatCurrency(totalCol)}</span>
                        </td>
                        <td className="px-4 py-3">
                          {untransferred > 0 && hasTransferred ? (
                            <span className="flex items-center gap-1 text-[11px] text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Partially Transferred (+{formatCurrency(untransferred)} new)
                            </span>
                          ) : untransferred > 0 ? (
                            <span className="flex items-center gap-1 text-[11px] text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Ready to Transfer ({formatCurrency(untransferred)})
                            </span>
                          ) : c.transferredToBudget ? (
                            <span className="flex items-center gap-1 text-[11px] text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                              <CheckCircle className="w-3 h-3" />
                              Fully Transferred
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                              No Payments
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setViewCollection(c)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-white text-xs rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
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

          {/* Collection Groups Pagination */}
          {filteredCollections.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50">
              <div className="text-xs text-gray-500 font-medium">
                Showing <span className="font-bold text-gray-800">{(collectionsPage - 1) * PER_PAGE + 1}</span> to{" "}
                <span className="font-bold text-gray-800">
                  {Math.min(collectionsPage * PER_PAGE, filteredCollections.length)}
                </span>{" "}
                of <span className="font-bold text-gray-800">{filteredCollections.length}</span> collection groups
              </div>

              {totalCollectionsPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCollectionsPage((p) => Math.max(1, p - 1))}
                    disabled={collectionsPage === 1}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalCollectionsPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalCollectionsPages || Math.abs(p - collectionsPage) <= 1)
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      return (
                        <span key={p} className="flex items-center gap-1">
                          {prev && p - prev > 1 && <span className="text-gray-400 text-xs px-1">...</span>}
                          <button
                            onClick={() => setCollectionsPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              collectionsPage === p
                                ? "bg-[#001A4D] text-white shadow-xs"
                                : "border border-gray-200 text-gray-600 hover:bg-white"
                            }`}
                          >
                            {p}
                          </button>
                        </span>
                      );
                    })}

                  <button
                    onClick={() => setCollectionsPage((p) => Math.min(totalCollectionsPages, p + 1))}
                    disabled={collectionsPage === totalCollectionsPages}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Sub-view 2: Member Payables Roster (Individual Student View) ── */}
      {subView === "members" && (
        <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-xs space-y-0">
          <div className="flex items-center gap-3 p-4 border-b border-gray-100">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search member by name or student ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-[#0E4EBD] outline-none"
              />
            </div>
            <select
              value={memberStatusFilter}
              onChange={(e) => setMemberStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-[#0E4EBD] outline-none bg-white cursor-pointer"
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
                  {["Member", "Assigned Payables", "Total Assigned", "Total Paid", "Outstanding", "Status", ...(!isPast ? ["Actions"] : [])].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {membersLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0E4EBD]" />
                      Loading club members roster...
                    </td>
                  </tr>
                ) : paginatedMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                      No active club members found matching your search.
                    </td>
                  </tr>
                ) : (
                  paginatedMembers.map((m) => {
                    const assigned = m.payables.reduce((a, p) => a + (p.assignedAmount || 0), 0);
                    const paid = m.payables.reduce((a, p) => a + (p.paidAmount || 0), 0);
                    const outstanding = assigned - paid;

                    let statusText = "No Dues";
                    let statusColor = "bg-gray-100 text-gray-600";

                    if (assigned > 0) {
                      if (outstanding <= 0) {
                        statusText = "Paid";
                        statusColor = "bg-green-100 text-green-700 font-semibold";
                      } else if (paid > 0) {
                        statusText = "Partial";
                        statusColor = "bg-amber-100 text-amber-700 font-semibold";
                      } else {
                        statusText = "Unpaid";
                        statusColor = "bg-rose-100 text-rose-700 font-semibold";
                      }
                    }

                    const hasOverdue = m.payables.some(
                      (p) => p.status === "overdue" || (p.dueDate?.toMillis && p.dueDate.toMillis() < now && p.status !== "paid")
                    );
                    if (hasOverdue) {
                      statusText = "Overdue";
                      statusColor = "bg-red-100 text-red-700 font-bold";
                    }

                    return (
                      <tr key={m.studentId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#001A4D]/10 text-[#001A4D] flex items-center justify-center text-xs font-bold">
                              {m.studentName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-[#001A4D] font-medium text-sm">{m.studentName}</p>
                              <p className="text-gray-400 text-xs font-mono">
                                {m.schoolId}
                                {m.courseCode && (
                                  <span className="ml-1 text-gray-500 font-sans font-medium">· {m.courseCode}</span>
                                )}
                                {m.yearLevel && (
                                  <span className="ml-1 text-gray-400 font-sans">· {m.yearLevel}</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 space-y-1">
                          {m.payables.length === 0 ? (
                            <span className="text-gray-400 italic text-[11px]">No payables assigned</span>
                          ) : (
                            m.payables.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between gap-2 border-b border-gray-100 last:border-0 pb-0.5"
                              >
                                <span className="truncate max-w-[160px]" title={p.label}>
                                  {p.label}
                                </span>
                                <span className="font-semibold text-gray-800">{formatCurrency(p.assignedAmount)}</span>
                              </div>
                            ))
                          )}
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
                                  const pendingPayable = m.payables.find(
                                    (p) => (p.assignedAmount || 0) > (p.paidAmount || 0)
                                  );
                                  if (pendingPayable) setSelectedPayableForPayment(pendingPayable);
                                }}
                                className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Record Payment
                              </button>
                            ) : assigned > 0 ? (
                              <span className="text-xs text-green-600 font-medium">✓ Settled</span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
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

          {/* Member Roster Pagination */}
          {filteredMembers.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50">
              <div className="text-xs text-gray-500 font-medium">
                Showing <span className="font-bold text-gray-800">{(membersPage - 1) * PER_PAGE + 1}</span> to{" "}
                <span className="font-bold text-gray-800">{Math.min(membersPage * PER_PAGE, filteredMembers.length)}</span>{" "}
                of <span className="font-bold text-gray-800">{filteredMembers.length}</span> members
              </div>

              {totalMemberPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setMembersPage((p) => Math.max(1, p - 1))}
                    disabled={membersPage === 1}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalMemberPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalMemberPages || Math.abs(p - membersPage) <= 1)
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      return (
                        <span key={p} className="flex items-center gap-1">
                          {prev && p - prev > 1 && <span className="text-gray-400 text-xs px-1">...</span>}
                          <button
                            onClick={() => setMembersPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              membersPage === p
                                ? "bg-[#001A4D] text-white shadow-xs"
                                : "border border-gray-200 text-gray-600 hover:bg-white"
                            }`}
                          >
                            {p}
                          </button>
                        </span>
                      );
                    })}

                  <button
                    onClick={() => setMembersPage((p) => Math.min(totalMemberPages, p + 1))}
                    disabled={membersPage === totalMemberPages}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Sub-view 3: Overdue Payables ── */}
      {subView === "overdue" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 font-bold text-sm mb-0.5">Overdue Payables ({overduePayables.length})</p>
              <p className="text-gray-700 text-xs">These member payables are past their due date and require collection action.</p>
            </div>
          </div>

          <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-xs">
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
              <tbody className="divide-y divide-gray-100 text-xs">
                {overduePayables.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                      🎉 Great job! There are no overdue payables at this time.
                    </td>
                  </tr>
                ) : (
                  overduePayables.map((p) => {
                    const outstanding = (p.assignedAmount || 0) - (p.paidAmount || 0);
                    const dueStr = formatAppDate(p.dueDate, "Overdue");

                    return (
                      <tr key={p.id} className="hover:bg-red-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-[#001A4D] font-medium text-sm">{p.studentName}</p>
                          <p className="text-gray-400 text-xs font-mono">{p.studentSchoolId || p.studentId}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-sm font-medium">{p.label}</td>
                        <td className="px-4 py-3 text-red-600 font-bold text-sm">{formatCurrency(outstanding)}</td>
                        <td className="px-4 py-3 text-[#001A4D] text-sm">{dueStr}</td>
                        {!isPast && (
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedPayableForPayment(p)}
                              className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
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
      {viewCollection && (
        <OrgCollectionDetailModal
          collection={viewCollection}
          isPast={isPast}
          onClose={() => setViewCollection(null)}
          onTransfer={() => {
            handleTransfer(viewCollection);
            setViewCollection(null);
          }}
        />
      )}

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
            Finance &rsaquo; {activeTab === "budget" ? "Budget Tracker" : "Student Collections & Payables"}
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

      {/* Three-Tab Area */}
      <div>
        <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
          {([
            ["budget", "Budget Tracker"],
            ["collections", "Student Collections & Payables"],
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
          <StudentCollectionsAndPayablesTab
            isPast={isPast}
            payables={orgNonEventPayables}
            organizationId={activeOrgId}
            organizationName={activeOrgName}
            semesterId={selectedSemId}
            officerStudentId={officerStudentId}
          />
        )}
      </div>
    </div>
  );
}
