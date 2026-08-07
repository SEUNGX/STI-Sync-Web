import { useState, type ElementType } from "react";
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
} from "lucide-react";
import { useSemesters } from "../../modules/academic/hooks/useAcademicStream";
import { useSaoLedger } from "../../modules/finance/hooks/useFinanceStream";
import { useAllEventPayablesStream } from "../../modules/finance/hooks/usePayableStream";
import { addLedgerTransaction } from "../../modules/finance/services/finance.service";
import { markEventPayablesTransferred } from "../../modules/finance/services/payable.service";
import type { SaoLedgerDocument, TransactionSource, TransactionType } from "../../modules/finance/types/finance.types";
import type { StudentEventCollectionGroup } from "../../modules/finance/types/payable.types";
import { Timestamp } from "firebase/firestore";

// ─── Add School Budget Allocation Modal (original) ────────────────────────────
function AddBudgetModal({ currentBalance, onClose, onSave }: {
  currentBalance: number;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, "id" | "balance">) => void;
}) {
  const { data: semesters } = useSemesters();
  const availableSemesters = semesters.filter(s => s.status === 'ACTIVE' || s.status === 'UPCOMING');

  const [carryOver, setCarryOver] = useState(false);
  const [form, setForm] = useState({ semesterId: "", amount: "", notes: "" });

  const selectedSemester = availableSemesters.find(s => s.id === form.semesterId);

  const handleSave = () => {
    if (!selectedSemester || !form.amount) return;
    const amt = parseFloat(form.amount);
    
    // If there is carry over checked and we have a balance, we add it to this allocation.
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
        <div className="bg-gradient-to-r from-[#001A4D] to-[#83358E] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-[#FFD41C]" />
            <h3 className="text-white font-bold text-base">Add School Budget Allocation</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Semester <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent"
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
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent"
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent resize-none"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className={`flex items-start gap-3 p-4 border rounded-lg ${currentBalance > 0 ? "bg-gray-50 border-gray-200" : "bg-gray-50/50 border-gray-100 opacity-60"}`}>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Carry Over Unspent Balance from Previous Semester</p>
              <p className="text-xs text-gray-500 mt-0.5">Unspent from previous semester: ₱{currentBalance.toLocaleString()}</p>
              {carryOver && currentBalance > 0 && (
                <p className="text-xs text-[#83358E] font-medium mt-1">
                  Total Effective Budget = ₱{(parseFloat(form.amount || "0") + currentBalance).toLocaleString()}
                </p>
              )}
            </div>
            <button
              disabled={currentBalance <= 0}
              onClick={() => setCarryOver(!carryOver)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${currentBalance <= 0 ? "bg-gray-200 cursor-not-allowed" : carryOver ? "bg-[#83358E]" : "bg-gray-300"}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${carryOver && currentBalance > 0 ? "translate-x-6" : ""}`} />
            </button>
          </div>

          <div className="p-4 bg-[#F3E8FF] border border-[#83358E]/30 rounded-xl">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-[#83358E] flex-shrink-0 mt-0.5" />
              <p className="text-[#83358E] text-xs">
                This adds an income entry to the school budget ledger. Club and organization budgets are managed independently by their own officers — this allocation is for SAO-level expenses only.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-[#001A4D] text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-[#001A4D]/90 transition-colors"
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
  alreadyTransferred,
  onClose,
  onTransfer,
}: {
  collection: StudentEventCollectionGroup;
  alreadyTransferred: boolean;
  onClose: () => void;
  onTransfer: () => void;
}) {
  const paid = collection.payments.filter((p) => p.status === "Paid");
  const pending = collection.payments.filter((p) => p.status === "Pending");
  const totalCollected = paid.reduce((s, p) => s + p.amount, 0);
  const collectionPct = collection.totalStudents > 0 
    ? Math.round((paid.length / collection.totalStudents) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[620px] overflow-hidden">
        <div className="bg-gradient-to-r from-[#001A4D] to-[#83358E] px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-base">{collection.eventName}</h3>
            <p className="text-[#FFD41C] text-xs mt-0.5">Student Payables Collection · {collection.eventDate}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Students", value: collection.totalStudents.toString(), color: "text-[#001A4D]" },
              { label: "Students Paid", value: `${paid.length}`, color: "text-green-600" },
              { label: "Total Collected", value: `₱${totalCollected.toLocaleString()}`, color: "text-[#83358E]" },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>{collectionPct}% collected</span>
              <span>₱{collection.payablePerStudent} per student</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${collectionPct}%` }} />
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <p className="text-[#001A4D] text-xs font-bold uppercase tracking-wide">Payment Breakdown</p>
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
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {["Student", "Student ID", "Amount", "Date Paid", "Status"].map((col) => (
                    <th key={col} className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {collection.payments.map((p) => (
                  <tr key={p.id} className={p.status === "Pending" ? "bg-amber-50/40" : "hover:bg-gray-50"}>
                    <td className="px-4 py-2.5 text-[#001A4D] text-sm font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-sm">{p.studentId}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-sm font-bold ${p.status === "Paid" ? "text-green-600" : "text-gray-400"}`}>
                        {p.status === "Paid" ? `₱${p.amount.toLocaleString()}` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-sm">{p.paidDate}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${p.status === "Paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={2} className="px-4 py-2.5 text-gray-600 text-xs font-bold">Total Collected</td>
                  <td className="px-4 py-2.5 text-green-600 font-bold text-sm">₱{totalCollected.toLocaleString()}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {pending.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-700 text-xs">
                {pending.length} student{pending.length > 1 ? "s have" : " has"} not yet paid. You can still transfer the currently collected amount, or wait until all payments are complete.
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
            Close
          </button>
          {alreadyTransferred ? (
            <div className="flex-1 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-bold text-center flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Transferred to Budget
            </div>
          ) : (
            <button
              onClick={() => { onTransfer(); onClose(); }}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Transfer ₱{totalCollected.toLocaleString()} to School Budget
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Manual Expense Modal ──────────────────────────────────────────────────
function AddExpenseModal({ activeSemesterId, onClose, onSave }: {
  activeSemesterId: string | null;
  onClose: () => void;
  onSave: (tx: Omit<SaoLedgerDocument, "id" | "createdAt">) => void;
}) {
  const [form, setForm] = useState({ description: "", event: "", amount: "", date: "" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden">
        <div className="bg-gradient-to-r from-[#001A4D] to-[#83358E] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArrowUpRight className="w-5 h-5 text-[#FFD41C]" />
            <h3 className="text-white font-bold text-base">Add Budget Expense</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₱) <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                <input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-red-500">*</span></label>
            <input type="text" placeholder="e.g. Expense – Tech Symposium 2026" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Related Event (optional)</label>
            <select value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent">
              <option value="">— No specific event —</option>
              <option>Tech Symposium 2026</option>
              <option>Sportsfest 2026</option>
              <option>Induction &amp; Recognition Night</option>
              <option>Leadership Summit 2026</option>
              <option>Foundation Day Celebration</option>
            </select>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
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
            className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-2"
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
  carry_over: "bg-purple-100 text-purple-700",
};
const sourceLabel: Record<TransactionSource, string> = {
  allocation: "School Allocation",
  student_collection: "Student Collection",
  manual_expense: "SAO Expense",
  carry_over: "Carry-Over",
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function BudgetFundSettings() {
  const [tab, setTab] = useState<MainTab>("ledger");
  const { data: rawTransactions, loading: ledgerLoading } = useSaoLedger();
  const { data: collections, loading: collectionsLoading } = useAllEventPayablesStream();
  const { data: semesters } = useSemesters();
  const activeSemester = semesters.find(s => s.status === 'ACTIVE') || null;
  
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [viewCollection, setViewCollection] = useState<StudentEventCollectionGroup | null>(null);
  
  const [txFilter, setTxFilter] = useState<"all" | "income" | "expense">("all");
  const [semesterFilter, setSemesterFilter] = useState<string>("all");

  const loading = ledgerLoading || collectionsLoading;

  // Calculate dynamic balances for the ledger
  const transactions = rawTransactions.map((tx, idx, arr) => {
    const runningBalance = arr.slice(0, idx + 1).reduce((s, curr) => {
      return curr.type === "income" ? s + curr.amount : s - curr.amount;
    }, 0);
    return { ...tx, balance: runningBalance };
  });

  const filteredTx = transactions.filter((t) => {
    const passType = txFilter === "all" ? true : t.type === txFilter;
    const passSem = semesterFilter === "all" ? true : t.semesterId === semesterFilter;
    return passType && passSem;
  });

  // Calculate totals based on the filtered transactions view
  const currentBalance = transactions[transactions.length - 1]?.balance ?? 0;
  const filteredIncome = filteredTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const filteredExpense = filteredTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  
  const pendingCollections = collections.filter((c) => !c.transferredToBudget);
  const pendingTotal = pendingCollections.reduce((s, c) => {
    const paid = c.payments.filter((p) => p.status === "Paid").reduce((a, p) => a + p.amount, 0);
    return s + paid;
  }, 0);

  const handleSaveTransaction = async (tx: Omit<SaoLedgerDocument, "id" | "createdAt">) => {
    try {
      await addLedgerTransaction(tx);
    } catch (err) {
      console.error("Failed to save transaction", err);
    }
  };

  const handleTransferCollection = async (collectionItem: StudentEventCollectionGroup) => {
    const totalCollected = collectionItem.payments
      .filter((p) => p.status === "Paid")
      .reduce((s, p) => s + p.amount, 0);

    await handleSaveTransaction({
      semesterId: activeSemester?.id || null,
      date: Timestamp.fromDate(new Date()),
      description: `Student Collections – ${collectionItem.eventName}`,
      eventId: collectionItem.eventId !== 'unassigned' ? collectionItem.eventId : null,
      type: "income",
      source: "student_collection",
      amount: totalCollected,
      addedBy: "Admin SAO",
      collectionId: collectionItem.id,
    });

    if (collectionItem.eventId && collectionItem.eventId !== 'unassigned') {
      await markEventPayablesTransferred(collectionItem.eventId);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading ledger...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">School Budget & Fund Management</h2>
          <p className="text-gray-500 text-sm">Settings › Budget & Fund Management</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddExpense(true)}
            className="px-4 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-red-50 transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
            Add Expense
          </button>
          <button
            onClick={() => setShowAddBudget(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#83358E] text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add School Budget Allocation
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-700 font-bold text-sm mb-0.5">SAO School Budget — Independent from Club Budgets</p>
          <p className="text-gray-700 text-sm">This is the institutional SAO fund managed by the school. Club and organization budgets are entirely self-managed by their own officers. When events collect student payables, you can view the collection detail and transfer the amount into this school budget.</p>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Global Current Balance</p>
            <Wallet className="w-4 h-4 text-[#83358E]" />
          </div>
          <p className="text-[#001A4D] text-2xl font-bold">₱{currentBalance.toLocaleString()}</p>
          <p className="text-gray-400 text-xs mt-1">Overall running balance</p>
        </div>
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Income (Filtered)</p>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-green-600 text-2xl font-bold">+₱{filteredIncome.toLocaleString()}</p>
          <p className="text-gray-400 text-xs mt-1">{filteredTx.filter((t) => t.type === "income").length} credit entries</p>
        </div>
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Expenses (Filtered)</p>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-red-500 text-2xl font-bold">−₱{filteredExpense.toLocaleString()}</p>
          <p className="text-gray-400 text-xs mt-1">{filteredTx.filter((t) => t.type === "expense").length} debit entries</p>
        </div>
        <div
          className={`rounded-2xl p-5 border cursor-pointer transition-colors ${pendingTotal > 0
              ? "bg-amber-50 border-amber-200 hover:bg-amber-100"
              : "bg-white border-[#E0E0E0]"
            }`}
          onClick={() => setTab("collections")}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Pending Transfers</p>
            <Clock className={`w-4 h-4 ${pendingTotal > 0 ? "text-amber-500" : "text-gray-400"}`} />
          </div>
          <p className={`text-2xl font-bold ${pendingTotal > 0 ? "text-amber-600" : "text-gray-400"}`}>
            ₱{pendingTotal.toLocaleString()}
          </p>
          <p className="text-gray-400 text-xs mt-1">{pendingCollections.length} events pending transfer</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: "ledger", label: "Budget Ledger", icon: FileText },
          { key: "collections", label: "Student Collections", icon: Users, badge: pendingCollections.length },
        ] as { key: MainTab; label: string; icon: ElementType; badge?: number }[]).map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${tab === key ? "bg-white text-[#001A4D] shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {badge ? (
              <span className="w-4 h-4 bg-amber-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Budget Ledger ── */}
      {tab === "ledger" && (
        <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="border-l-4 border-[#83358E] pl-3">
              <h3 className="text-[#001A4D] font-bold text-base">Transaction History</h3>
              <p className="text-gray-500 text-xs mt-0.5">All school budget income and expense entries</p>
            </div>
            <div className="flex gap-2">
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 border border-gray-200 text-gray-700 outline-none focus:ring-2 focus:ring-[#83358E]/20"
              >
                <option value="all">All Semesters</option>
                {semesters?.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <div className="w-px h-6 bg-gray-200 self-center mx-1"></div>
              {(["all", "income", "expense"] as const).map((f) => (
                <button key={f} onClick={() => setTxFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${txFilter === f ? "bg-[#001A4D] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}>
                  {f === "all" ? "All" : f === "income" ? "Income +" : "Expenses −"}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {["Date", "Description", "Related Event", "Source", "Amount", "Running Balance", ""].map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...filteredTx].reverse().map((tx) => {
                  const linkedCollection = tx.collectionId
                    ? collections.find((c) => c.id === tx.collectionId) ?? null
                    : null;

                  return (
                    <tr key={tx.id} className={`transition-colors ${tx.source === "student_collection" ? "bg-green-50/40 hover:bg-green-50" : "hover:bg-gray-50"
                      }`}>
                      <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                        {tx.date?.toDate ? tx.date.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[#001A4D] text-sm font-medium">{tx.description}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {tx.eventId ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${sourceBadgeMap[tx.source]}`}>
                          {sourceLabel[tx.source]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold flex items-center gap-1 ${tx.type === "income" ? "text-green-600" : "text-red-500"}`}>
                          {tx.type === "income" ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                          {tx.type === "income" ? "+" : "−"}₱{tx.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#001A4D] font-semibold text-sm">
                        ₱{tx.balance.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {linkedCollection && (
                          <button
                            onClick={() => setViewCollection(linkedCollection)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Details
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#001A4D]">
                  <td colSpan={4} className="px-4 py-3 text-white font-bold text-sm">Current Balance</td>
                  <td colSpan={3} className="px-4 py-3 text-[#FFD41C] font-bold text-lg">₱{currentBalance.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Student Collections ── */}
      {tab === "collections" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-amber-800 text-sm leading-relaxed">
              Events with student payables are listed here. Click <strong>View Details</strong> to see the full payment breakdown per student, then transfer the collected amount to the school budget as an income entry.
            </p>
          </div>

          <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="border-l-4 border-[#83358E] pl-3">
                <h3 className="text-[#001A4D] font-bold text-base">Student Payable Collections</h3>
                <p className="text-gray-500 text-xs mt-0.5">View collection details and transfer to school budget</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {["Event", "Date", "Fee / Student", "Total Students", "Paid", "Total Collected", "Status", "Action"].map((col) => (
                      <th key={col} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {collections.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                        No event payables collections found.
                      </td>
                    </tr>
                  ) : (
                    collections.map((c) => {
                      const paid = c.payments.filter((p) => p.status === "Paid");
                      const totalCollected = paid.reduce((s, p) => s + p.amount, 0);
                      const pct = c.totalStudents > 0 ? Math.round((paid.length / c.totalStudents) * 100) : 0;

                      return (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-[#001A4D] font-medium text-sm">{c.eventName}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">{c.eventDate}</td>
                          <td className="px-4 py-3 text-gray-700 text-sm font-medium">₱{c.payablePerStudent.toLocaleString()}</td>
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
                            <span className="text-green-700 font-bold text-sm">₱{totalCollected.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3">
                            {c.transferredToBudget ? (
                              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full font-medium w-fit whitespace-nowrap">
                                <CheckCircle className="w-3 h-3" />
                                Transferred {c.transferredDate}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-full font-medium w-fit">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setViewCollection(c)}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-300 text-blue-600 text-xs rounded-lg font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Details
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
      {showAddExpense && <AddExpenseModal activeSemesterId={activeSemester?.id || null} onClose={() => setShowAddExpense(false)} onSave={handleSaveTransaction} />}
      {viewCollection && (
        <CollectionDetailModal
          collection={viewCollection}
          alreadyTransferred={viewCollection.transferredToBudget}
          onClose={() => setViewCollection(null)}
          onTransfer={() => handleTransferCollection(viewCollection)}
        />
      )}
    </div>
  );
}
