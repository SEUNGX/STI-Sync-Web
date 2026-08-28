import { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Plus,
  Trash2,
  Settings2,
  Eye,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import type { LiquidationDocument } from '../types/liquidation.types';
import {
  exportOfficialStiLiquidationExcel,
  type StiSignatory,
} from '../utils/sti-liquidation-excel';
import { formatCurrency } from '../../../utils/currency';
import { formatAppDate } from '../../../utils/date';

interface LiquidationExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: LiquidationDocument | null;
}

const DEFAULT_STI_SIGNATORIES: StiSignatory[] = [
  { id: '1', type: 'Submitted By:', name: '', role: '(Name of Employee / Treasurer)' },
  { id: '2', type: 'Checked By:', name: '', role: '(Accountant / Auditor)' },
  { id: '3', type: 'Indorsed By:', name: '', role: '(Supervisor / Adviser)' },
  { id: '4', type: 'Recommending Approval:', name: '', role: '(Supervisor)' },
  { id: '5', type: 'Approved By:', name: '', role: '(Administrator / Academic Head)' },
  { id: '6', type: 'Noted By:', name: '', role: '(President)' },
];

export function LiquidationExportPreviewModal({
  isOpen,
  onClose,
  report,
}: LiquidationExportPreviewModalProps) {
  if (!isOpen || !report) return null;

  // Metadata form state
  const [officerName, setOfficerName] = useState(
    report.submittedByName || report.createdByName || ''
  );
  const [chequeNumber, setChequeNumber] = useState(
    report.id ? report.id.slice(0, 8).toUpperCase() : ''
  );
  const [activityEndDate, setActivityEndDate] = useState(
    formatAppDate(report.createdAt, '')
  );
  const [submissionDeadline, setSubmissionDeadline] = useState('');
  const [dateSubmitted, setDateSubmitted] = useState(
    formatAppDate(report.submittedAt || report.createdAt, new Date().toLocaleDateString())
  );
  const [dateReleased, setDateReleased] = useState('');
  const [amountAdvanced, setAmountAdvanced] = useState<number>(
    report.allocatedBudget || report.totalAllocatedBudget || report.totalActualSpending || 0
  );
  const [daysLapsed, setDaysLapsed] = useState('-o-');
  const [orNumber, setOrNumber] = useState(
    report.lineItems?.find((i) => i.receiptNumber)?.receiptNumber || ''
  );

  // Dynamic signatories state
  const [signatories, setSignatories] = useState<StiSignatory[]>(() => {
    return DEFAULT_STI_SIGNATORIES.map((sig, idx) =>
      idx === 0 ? { ...sig, name: officerName } : sig
    );
  });

  const [activeTab, setActiveTab] = useState<'preview' | 'signatories' | 'metadata'>('preview');
  const [isExporting, setIsExporting] = useState(false);

  // Categorized Items for Preview
  const categorizedItems = useMemo(() => {
    const map = new Map<string, typeof report.lineItems>();
    (report.lineItems || []).forEach((item) => {
      const cat = (item.category || 'General Expenses').trim();
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(item);
    });
    return Array.from(map.entries());
  }, [report.lineItems]);

  const isDeficit = (report.surplusOrDeficit || 0) < 0;
  const varianceAmount = Math.abs(report.surplusOrDeficit || 0);

  // Signatory Handlers
  const handleAddSignatory = () => {
    const newId = (signatories.length + 1).toString();
    setSignatories((prev) => [
      ...prev,
      {
        id: newId,
        type: 'Approved By:',
        name: '',
        role: '(Academic Head)',
      },
    ]);
  };

  const handleUpdateSignatory = (id: string, field: keyof StiSignatory, value: string) => {
    setSignatories((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleRemoveSignatory = (id: string) => {
    setSignatories((prev) => prev.filter((s) => s.id !== id));
  };

  const handleResetSignatories = () => {
    setSignatories(
      DEFAULT_STI_SIGNATORIES.map((sig, idx) =>
        idx === 0 ? { ...sig, name: officerName } : sig
      )
    );
    toast.info('Reset signatories to official standard format.');
  };

  // Export Action
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      exportOfficialStiLiquidationExcel(report, {
        officerName,
        chequeNumber,
        activityEndDate,
        submissionDeadline,
        dateSubmitted,
        dateReleased,
        amountAdvanced,
        daysLapsed,
        orNumber,
        signatories,
      });
      toast.success('Official STI Liquidation Excel exported successfully!');
      onClose();
    } catch (err) {
      console.error('Failed to export STI liquidation Excel', err);
      toast.error('Failed to generate official Excel file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-5xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        {/* Modal Header */}
        <header className="bg-[#001A4D] px-6 py-4 flex items-center justify-between flex-shrink-0 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0E4EBD] rounded-xl flex items-center justify-center text-[#FFD41C] shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white tracking-tight">
                  Official STI Liquidation Export Engine
                </h3>
                <span className="px-2 py-0.5 bg-[#FFD41C] text-[#001A4D] text-[10px] font-mono font-bold rounded-md uppercase">
                  LIQUIDATION-FORMAT v1.0
                </span>
              </div>
              <p className="text-xs text-white/70">
                STI College Official Financial Liquidation Template Generator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Tab Navigation & Status Bar */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-2.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-[#001A4D] text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>1. Clean Template Preview</span>
            </button>

            <button
              onClick={() => setActiveTab('signatories')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'signatories'
                  ? 'bg-[#001A4D] text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>2. Signatories Matrix ({signatories.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('metadata')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'metadata'
                  ? 'bg-[#001A4D] text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>3. Activity Header Details</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="text-gray-500">Total Actual Spent:</span>
            <span className="text-[#001A4D] font-mono text-sm">
              {formatCurrency(report.totalActualSpending || report.totalActualSpent || 0)}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70">
          {/* TAB 1: CLEAN MONOCHROME STI FORMAT PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="bg-white border-2 border-gray-400 rounded-lg shadow-sm p-6 font-sans text-xs space-y-6">
                {/* 1. Header Section */}
                <div className="border-b-2 border-black pb-4">
                  <h2 className="text-base font-bold text-black uppercase tracking-tight">
                    LIQUIDATION REPORT FOR {(report.eventTitle || 'Event Activity').toUpperCase()}
                  </h2>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mt-3 text-[11px] text-black">
                    <div className="flex justify-between border-b border-gray-200 py-0.5">
                      <span className="font-bold">Employee / Officer Name:</span>
                      <span>{officerName || '—'}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 py-0.5">
                      <span className="font-bold">Date Of Activity End:</span>
                      <span>{activityEndDate || '—'}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 py-0.5">
                      <span className="font-bold">Cheque Number:</span>
                      <span className="font-mono">{chequeNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 py-0.5">
                      <span className="font-bold">Deadline For The Liquidation Submissions:</span>
                      <span>{submissionDeadline || '—'}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 py-0.5">
                      <span className="font-bold">Purpose:</span>
                      <span>{report.eventTitle}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 py-0.5">
                      <span className="font-bold">Date Submitted:</span>
                      <span>{dateSubmitted}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 py-0.5">
                      <span className="font-bold">Amount:</span>
                      <span className="font-bold font-mono">{formatCurrency(amountAdvanced)}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 py-0.5">
                      <span className="font-bold">No. Of Days Lapse:</span>
                      <span>{daysLapsed}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Section Header */}
                <div className="text-[11px] font-bold text-black uppercase">
                  CHARGE TO EXPENSE/REFUNDABLE ACCOUNT:
                </div>

                {/* 3. Expenses Breakdown Table (Monochrome Grid matching original template) */}
                <div className="border border-black overflow-hidden">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-white text-black font-bold text-center border-b border-black">
                        <th className="p-2 border-r border-black w-[24%]">PARTICULAR</th>
                        <th className="p-2 border-r border-black w-[14%]">AMOUNT</th>
                        <th colSpan={3} className="p-2 border-r border-black">ACTUAL EXPENSES BREAKDOWN</th>
                        <th className="p-2 w-[18%]">Remarks</th>
                      </tr>
                      <tr className="bg-white text-black font-bold text-[10px] text-center border-b border-black">
                        <th className="p-1.5 border-r border-black font-normal">Breakdown For Cash Advances</th>
                        <th className="p-1.5 border-r border-black"></th>
                        <th className="p-1.5 border-r border-black">Amount</th>
                        <th className="p-1.5 border-r border-black">Total Amount</th>
                        <th className="p-1.5 border-r border-black">Variance</th>
                        <th className="p-1.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300 font-mono text-[11px]">
                      {categorizedItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-gray-400 font-sans">
                            No recorded liquidation line items.
                          </td>
                        </tr>
                      ) : (
                        categorizedItems.map(([category, items], catIdx) => {
                          const letter = String.fromCharCode(65 + catIdx);
                          const catAllocated = items.reduce((sum, i) => sum + (i.allocatedCost || 0), 0);

                          return items.map((item, itemIdx) => {
                            const isFirst = itemIdx === 0;
                            const itemVariance = (item.allocatedCost || 0) > 0
                              ? (item.allocatedCost || 0) - (item.totalCost || 0)
                              : 0;

                            return (
                              <tr key={item.id || `${catIdx}-${itemIdx}`}>
                                <td className="p-1.5 border-r border-black font-sans font-bold text-black">
                                  {isFirst ? `${letter}. ${category}` : ''}
                                </td>
                                <td className="p-1.5 border-r border-black text-right text-black">
                                  {isFirst ? (catAllocated > 0 ? formatCurrency(catAllocated) : '—') : ''}
                                </td>
                                <td className="p-1.5 border-r border-black font-sans text-black">
                                  {item.description || item.vendorName}
                                </td>
                                <td className="p-1.5 border-r border-black text-right text-black">
                                  {formatCurrency(item.totalCost || 0)}
                                </td>
                                <td className="p-1.5 border-r border-black text-right text-black">
                                  {formatCurrency(itemVariance)}
                                </td>
                                <td className="p-1.5 text-black font-sans text-[10px]">
                                  {item.receiptNumber ? `OR# ${item.receiptNumber}` : item.vendorName || '—'}
                                </td>
                              </tr>
                            );
                          });
                        })
                      )}

                      {/* Totals Row */}
                      <tr className="bg-white font-bold border-t-2 border-black text-black">
                        <td className="p-2 border-r border-black font-sans">Total Cash Advance</td>
                        <td className="p-2 border-r border-black text-right font-mono">
                          {formatCurrency(amountAdvanced)}
                        </td>
                        <td className="p-2 border-r border-black font-sans">Total Actual Expense</td>
                        <td className="p-2 border-r border-black text-right font-mono">
                          {formatCurrency(report.totalActualSpending || report.totalActualSpent || 0)}
                        </td>
                        <td className="p-2 border-r border-black text-right font-mono">
                          {formatCurrency(amountAdvanced - (report.totalActualSpending || report.totalActualSpent || 0))}
                        </td>
                        <td className="p-2 font-sans text-xs">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. Balance Summary Note Block */}
                <div className="bg-white p-4 border border-black space-y-1 text-[11px] text-black">
                  <div className="font-bold mb-1">Note: </div>
                  <div className="flex justify-between w-72">
                    <span className="font-medium">Amount Advanced:</span>
                    <span className="font-mono font-bold">{formatCurrency(amountAdvanced)}</span>
                  </div>
                  <div className="flex justify-between w-72">
                    <span className="font-medium">Total Actual Expense:</span>
                    <span className="font-mono font-bold">
                      {formatCurrency(report.totalActualSpending || report.totalActualSpent || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between w-72 pt-1 border-t border-black">
                    <span className="font-bold">Balance: </span>
                    <span className="font-mono font-bold underline">
                      {formatCurrency(amountAdvanced - (report.totalActualSpending || report.totalActualSpent || 0))}
                    </span>
                  </div>
                  {orNumber && (
                    <div className="text-[10px] pt-1">
                      OR NO: <strong>{orNumber}</strong>
                    </div>
                  )}
                </div>

                {/* 5. Dynamic Signatures Matrix */}
                <div className="pt-4 border-t border-gray-300">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-black">
                      Signatures ({signatories.length})
                    </h4>
                    <button
                      onClick={() => setActiveTab('signatories')}
                      className="text-xs text-[#0E4EBD] hover:underline font-bold"
                    >
                      Edit Signatures →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-2">
                    {signatories.map((sig) => (
                      <div key={sig.id} className="space-y-1">
                        <p className="text-[10px] font-bold text-black uppercase">{sig.type}</p>
                        <div className="pt-6 border-b border-black text-center font-bold text-[11px] text-black">
                          {sig.name || ''}
                        </div>
                        <div className="flex items-center justify-between text-[9.5px] text-gray-700">
                          <span>{sig.role}</span>
                          <span>(Date)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DYNAMIC SIGNATORIES MANAGER */}
          {activeTab === 'signatories' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="bg-white border border-gray-300 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#001A4D]">Manage Report Signatories</h4>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Customize who appears in the signature section of the exported Excel report.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetSignatories}
                    className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Standard</span>
                  </button>
                  <button
                    onClick={handleAddSignatory}
                    className="px-3.5 py-1.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Signatory</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {signatories.map((sig, idx) => (
                  <div
                    key={sig.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex items-center gap-3"
                  >
                    <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                      {idx + 1}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                      {/* Signatory Type */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">
                          Header / Action
                        </label>
                        <input
                          type="text"
                          value={sig.type}
                          onChange={(e) => handleUpdateSignatory(sig.id, 'type', e.target.value)}
                          placeholder="e.g. Approved By:"
                          className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold text-black focus:ring-1 focus:ring-[#0E4EBD] outline-none"
                        />
                      </div>

                      {/* Signatory Name */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">
                          Full Name (or blank for print)
                        </label>
                        <input
                          type="text"
                          value={sig.name}
                          onChange={(e) => handleUpdateSignatory(sig.id, 'name', e.target.value)}
                          placeholder="Leave blank for physical sign..."
                          className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-black focus:ring-1 focus:ring-[#0E4EBD] outline-none"
                        />
                      </div>

                      {/* Signatory Position/Role */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">
                          Position / Role
                        </label>
                        <input
                          type="text"
                          value={sig.role}
                          onChange={(e) => handleUpdateSignatory(sig.id, 'role', e.target.value)}
                          placeholder="e.g. (Academic Head)"
                          className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-700 focus:ring-1 focus:ring-[#0E4EBD] outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveSignatory(sig.id)}
                      disabled={signatories.length <= 1}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                      title="Remove Signatory"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ACTIVITY HEADER DETAILS */}
          {activeTab === 'metadata' && (
            <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
              <h4 className="font-bold text-sm text-[#001A4D] border-b border-gray-100 pb-2">
                Official Liquidation Header Parameters
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    Employee / Officer Name
                  </label>
                  <input
                    type="text"
                    value={officerName}
                    onChange={(e) => setOfficerName(e.target.value)}
                    placeholder="Officer name..."
                    className="w-full p-2 border border-gray-300 rounded-lg font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    Cheque Number
                  </label>
                  <input
                    type="text"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    placeholder="Cheque # / Ref #..."
                    className="w-full p-2 border border-gray-300 rounded-lg font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    Date Of Activity End
                  </label>
                  <input
                    type="text"
                    value={activityEndDate}
                    onChange={(e) => setActivityEndDate(e.target.value)}
                    placeholder="e.g. MAY 26, 2024"
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    Deadline For Submissions
                  </label>
                  <input
                    type="text"
                    value={submissionDeadline}
                    onChange={(e) => setSubmissionDeadline(e.target.value)}
                    placeholder="e.g. June 15, 2024"
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    Amount (Cash Advance ₱)
                  </label>
                  <input
                    type="number"
                    value={amountAdvanced}
                    onChange={(e) => setAmountAdvanced(Number(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded-lg font-mono font-bold text-black"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    No. Of Days Lapse
                  </label>
                  <input
                    type="text"
                    value={daysLapsed}
                    onChange={(e) => setDaysLapsed(e.target.value)}
                    placeholder="-o-"
                    className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    Official Receipt (OR) Number
                  </label>
                  <input
                    type="text"
                    value={orNumber}
                    onChange={(e) => setOrNumber(e.target.value)}
                    placeholder="OR Number..."
                    className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    Date Submitted
                  </label>
                  <input
                    type="text"
                    value={dateSubmitted}
                    onChange={(e) => setDateSubmitted(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span>
              Format ready: <strong>LIQUIDATION-FORMAT_v1.xlsx</strong> ({report.lineItems?.length || 0} line items).
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="px-6 py-2.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#FFD41C]" />
              <span>{isExporting ? 'Generating Official Excel...' : 'Download Official STI Excel (.xls)'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
