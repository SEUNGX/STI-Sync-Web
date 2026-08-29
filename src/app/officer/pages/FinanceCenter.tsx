import { useState, useMemo } from "react";
import { toast } from 'sonner';

import { useOrgLedger, parseTimestampMillis } from '../../modules/finance/hooks/useFinanceStream';
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
} from "lucide-react";

type FinanceTab = "budget" | "collections" | "payables" | "liquidation";
type PayableSubTab = "member" | "type" | "overdue";

import { useOrgLiquidations } from '../../modules/finance/hooks/useLiquidationStream';
import OfficerLiquidationModal from '../components/OfficerLiquidationModal';
import ReceiptLightboxModal from '../../modules/finance/components/ReceiptLightboxModal';
import { LiquidationExportPreviewModal } from '../../modules/finance/components/LiquidationExportPreviewModal';
import TransactionDetailModal from '../../modules/finance/components/TransactionDetailModal';
import { useUserNameResolver } from '../../modules/finance/hooks/useUserNameResolver';
import type { LiquidationDocument, LiquidationStatus } from '../../modules/finance/types/liquidation.types';



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

  const pendingTransferTotal = collections.reduce((s, c) => s + (c.untransferredAmount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Informational banner */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-900 font-bold text-sm">Centralized Club Collections & Treasury Transfer</p>
          <p className="text-amber-800 text-xs mt-0.5 leading-relaxed">
            All student collections (Membership Dues, Event Fees, and Event Attendance Fines) recorded in Attendance Logs or Finance Center appear here. Click <strong>Transfer</strong> to atomically credit newly collected cash into your Club Budget Ledger.
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
              Ready to Transfer: {formatCurrency(pendingTransferTotal)}
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewCollection(c)}
                            className="flex items-center gap-1 px-2.5 py-1.5 border border-blue-300 text-blue-600 text-xs rounded-lg font-medium hover:bg-blue-50 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Details
                          </button>
                          {untransferred > 0 && !isPast && (
                            <button
                              onClick={() => handleTransfer(c)}
                              disabled={isTransferring}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg font-bold hover:bg-green-700 transition-colors cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              Transfer {formatCurrency(untransferred)}
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
