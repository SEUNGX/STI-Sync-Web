import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Receipt,
  AlertCircle,
  Edit3,
  CheckCircle2,
  Clock,
  RotateCcw,
  Eye,
  FileText,
  FileSpreadsheet,
  Search,
  Download,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useOrgLiquidations } from '../../modules/finance/hooks/useLiquidationStream';
import ReceiptLightboxModal from '../../modules/finance/components/ReceiptLightboxModal';
import OfficerLiquidationModal from '../components/OfficerLiquidationModal';
import { LiquidationExportPreviewModal } from '../../modules/finance/components/LiquidationExportPreviewModal';
import type { LiquidationDocument, LiquidationStatus } from '../../modules/finance/types/liquidation.types';
import { formatCurrency, formatVariance } from '../../utils/currency';
import { formatAppDateTime } from '../../utils/date';
import { toast } from 'sonner';

type FilterTab = 'all' | 'pending' | 'approved' | 'returned' | 'draft';
const ITEMS_PER_PAGE = 8;

function getLiquidationTimestamp(liq: LiquidationDocument): number {
  if (liq.createdAt) {
    if (typeof (liq.createdAt as any).toDate === 'function') return (liq.createdAt as any).toDate().getTime();
    if (typeof (liq.createdAt as any).seconds === 'number') return (liq.createdAt as any).seconds * 1000;
    const d = new Date(liq.createdAt as any);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  if (liq.updatedAt) {
    if (typeof (liq.updatedAt as any).toDate === 'function') return (liq.updatedAt as any).toDate().getTime();
    if (typeof (liq.updatedAt as any).seconds === 'number') return (liq.updatedAt as any).seconds * 1000;
    const d = new Date(liq.updatedAt as any);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return 0;
}

function formatSubmittedDate(dateVal?: any): string {
  if (!dateVal) return '—';
  let d: Date | null = null;
  if (typeof dateVal.toDate === 'function') d = dateVal.toDate();
  else if (typeof dateVal.seconds === 'number') d = new Date(dateVal.seconds * 1000);
  else d = new Date(dateVal);

  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function FinancialLiquidation() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editingReport, setEditingReport] = useState<LiquidationDocument | null>(null);
  const [viewingDetailReport, setViewingDetailReport] = useState<LiquidationDocument | null>(null);
  const [exportReport, setExportReport] = useState<LiquidationDocument | null>(null);
  const [lightboxData, setLightboxData] = useState<{ url: string; title: string; vendor?: string; amount?: number } | null>(null);

  const { profile } = useOfficerProfile();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem('sti_sync_officer_session');
    if (raw) {
      try {
        setSession(JSON.parse(raw));
      } catch (_) {}
    }
  }, []);

  const orgId = profile?.activeOrganizationId || session?.activeOrganizationId || '';
  const orgName = profile?.studentName || session?.studentName ? `${profile?.studentName || session?.studentName}'s Org` : 'Student Organization';
  const userUid = profile?.studentId || session?.studentId || 'officer_user';
  const userName = profile?.studentName || session?.studentName || 'Officer';

  const { liquidations, loading } = useOrgLiquidations(orgId);

  // Filtered & Sorted Liquidations (LATEST FIRST by default)
  const filteredReports = useMemo(() => {
    return liquidations
      .filter((report) => {
        if (activeTab !== 'all' && report.status !== activeTab) return false;

        const q = searchQuery.toLowerCase().trim();
        if (q) {
          const eventMatch = (report.eventTitle || '').toLowerCase().includes(q);
          const officerMatch = (report.createdByName || '').toLowerCase().includes(q);
          const idMatch = (report.id || '').toLowerCase().includes(q);
          if (!eventMatch && !officerMatch && !idMatch) return false;
        }

        return true;
      })
      .sort((a, b) => getLiquidationTimestamp(b) - getLiquidationTimestamp(a));
  }, [liquidations, activeTab, searchQuery]);

  // Counts
  const counts = {
    all: liquidations.length,
    pending: liquidations.filter((r) => r.status === 'pending').length,
    approved: liquidations.filter((r) => r.status === 'approved').length,
    returned: liquidations.filter((r) => r.status === 'returned').length,
    draft: liquidations.filter((r) => r.status === 'draft').length,
  };

  // KPI calculations
  const pendingAmount = useMemo(() => {
    return liquidations
      .filter((l) => l.status === 'pending')
      .reduce((sum, item) => sum + (item.totalActualSpending || item.allocatedBudget || 0), 0);
  }, [liquidations]);

  const approvedAmount = useMemo(() => {
    return liquidations
      .filter((l) => l.status === 'approved')
      .reduce((sum, item) => sum + (item.totalActualSpending || item.allocatedBudget || 0), 0);
  }, [liquidations]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredReports.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredReports.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredReports, currentPage]);

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleOpenCreate = () => {
    setEditingReport(null);
    setShowModal(true);
  };

  const handleOpenEdit = (report: LiquidationDocument) => {
    setEditingReport(report);
    setShowModal(true);
  };

  const handleExportCSV = () => {
    if (filteredReports.length === 0) {
      toast.info(`No ${activeTab === 'all' ? '' : activeTab + ' '}liquidation reports to export.`);
      return;
    }
    const headers = ['Event Title', 'Submitted By', 'Actual Expenses', 'Allocated Budget', 'Variance', 'Receipts Count', 'Submitted Date', 'Status'];
    const rows = filteredReports.map((l) => [
      `"${(l.eventTitle || '').replace(/"/g, '""')}"`,
      `"${(l.createdByName || '').replace(/"/g, '""')}"`,
      `"${l.totalActualSpending || 0}"`,
      `"${l.allocatedBudget || 0}"`,
      `"${l.surplusOrDeficit || 0}"`,
      `"${l.lineItems?.length || 0}"`,
      `"${formatSubmittedDate(l.createdAt)}"`,
      `"${l.status || 'pending'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Officer_Liquidations_${activeTab.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredReports.length} ${activeTab === 'all' ? '' : activeTab + ' '}liquidation report(s) to CSV.`);
  };

  const statusBadge = (status: LiquidationStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pending Review
          </span>
        );
      case 'returned':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Returned
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 w-full">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-gray-500 text-xs mb-1">Dashboard &gt; Financial Liquidation</div>
          <h1 className="text-2xl font-bold text-[#001A4D] tracking-tight">Financial Liquidation Portal</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Submit actual spendings, receipt evidence, and track financial variance against approved event budgets
          </p>
        </div>

        {/* Solid button without gradients */}
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#001A4D] hover:bg-[#002D72] text-white rounded-xl text-sm font-bold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-[#FFD41C]" />
          New Liquidation Report
        </button>
      </div>

      {/* ── 3 KPI Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 flex-shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">Pending Review</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5 tracking-tight">
              {formatCurrency(pendingAmount)}
            </div>
            <div className="text-[11px] text-amber-700 font-medium">
              {counts.pending} report{counts.pending === 1 ? '' : 's'} awaiting adviser action
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">Approved Spendings</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5 tracking-tight">
              {formatCurrency(approvedAmount)}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium">
              {counts.approved} report{counts.approved === 1 ? '' : 's'} approved
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 flex-shrink-0">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">Returned for Revision</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5 tracking-tight">
              {counts.returned} {counts.returned === 1 ? 'report' : 'reports'}
            </div>
            <div className="text-[11px] text-red-700 font-medium">
              Requires update &amp; resubmission
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Container: Tabs + Search + Fixed Height Table + Pagination ── */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden">
        {/* Top Control Bar */}
        <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'pending', label: 'Pending', count: counts.pending },
              { key: 'approved', label: 'Approved', count: counts.approved },
              { key: 'returned', label: 'Returned', count: counts.returned },
              { key: 'draft', label: 'Drafts', count: counts.draft },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key as FilterTab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#001A4D] text-white shadow-xs'
                      : 'bg-gray-100/80 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-200/80 text-gray-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#001A4D]/10 focus:border-[#001A4D]"
              />
            </div>

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Export to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* ── Table Container (No inner vertical scroll) ── */}
        <div className="overflow-x-auto relative">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Loading liquidation reports...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto" />
              <div className="font-bold text-gray-700 text-sm">No liquidation reports found</div>
              <p className="text-xs text-gray-400 max-w-sm">
                Click &quot;+ New Liquidation Report&quot; to select an approved event and submit your expenses with receipts.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50/90 text-gray-500 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200 sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th className="py-3 px-4">Event Report</th>
                  <th className="py-3 px-4">Expenses</th>
                  <th className="py-3 px-4">Allocated</th>
                  <th className="py-3 px-4">Variance</th>
                  <th className="py-3 px-4">Receipts</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-normal">
                {paginatedItems.map((report) => {
                  const isReturned = report.status === 'returned';
                  const isDraft = report.status === 'draft';
                  const isApproved = report.status === 'approved';

                  const allocated = report.allocatedBudget || 0;
                  const spent = report.totalActualSpending || 0;
                  const variance = (report.surplusOrDeficit !== undefined) ? report.surplusOrDeficit : (allocated - spent);
                  const isDeficit = variance < 0;

                  const utilPct = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 100;
                  const isOverBudget = spent > allocated && allocated > 0;

                  return (
                    <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Event Report */}
                      <td className="py-3.5 px-4 max-w-[260px]">
                        <div className="font-bold text-gray-900 text-sm leading-snug truncate">
                          {report.eventTitle}
                        </div>
                        <div className="text-[11px] text-gray-500 font-medium truncate mt-0.5">
                          Report ID: {report.id.slice(0, 10)} • By {report.createdByName || 'Officer'}
                        </div>
                        {isReturned && report.returnRemarks && (
                          <div className="text-[11px] text-red-600 font-medium truncate mt-0.5">
                            Adviser: {report.returnRemarks}
                          </div>
                        )}
                      </td>

                      {/* Expenses */}
                      <td className="py-3.5 px-4 whitespace-nowrap min-w-[130px]">
                        <div className="font-bold text-gray-900 text-sm">
                          {formatCurrency(spent)}
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              isOverBudget ? 'bg-red-500' : 'bg-[#001A4D]'
                            }`}
                            style={{ width: `${utilPct}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                          {utilPct}% utilized
                        </div>
                      </td>

                      {/* Allocated */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-gray-700 text-xs">
                        {formatCurrency(allocated)}
                      </td>

                      {/* Variance */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1 font-bold text-xs ${
                          isDeficit ? 'text-red-600' : 'text-emerald-700'
                        }`}>
                          {isDeficit ? (
                            <TrendingDown className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingUp className="w-3.5 h-3.5" />
                          )}
                          <span>{formatVariance(variance)}</span>
                        </div>
                      </td>

                      {/* Receipts */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-gray-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-gray-400" />
                          <span>{report.lineItems?.length || 0}</span>
                        </div>
                      </td>

                      {/* Submitted */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-gray-500 text-xs">
                        {formatSubmittedDate(report.createdAt)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {statusBadge(report.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isApproved && (
                            <button
                              onClick={() => setExportReport(report)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Export Report"
                            >
                              <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                              <span>Export</span>
                            </button>
                          )}

                          <button
                            onClick={() => setViewingDetailReport(report)}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-[#001A4D] hover:text-white text-gray-700 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="View Report Details"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>

                          {(isDraft || isReturned) && (
                            <button
                              onClick={() => handleOpenEdit(report)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#001A4D] border border-blue-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title={isReturned ? 'Edit & Resubmit' : 'Edit Draft'}
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{isReturned ? 'Resubmit' : 'Edit'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Bottom Pagination Bar ── */}
        <div className="p-3.5 bg-gray-50/60 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div>
            {filteredReports.length === 0 ? (
              'Showing 0 reports'
            ) : (
              <span>
                Showing <strong className="text-gray-900 font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to{' '}
                <strong className="text-gray-900 font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filteredReports.length)}</strong> of{' '}
                <strong className="text-gray-900 font-bold">{filteredReports.length}</strong> reports
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  currentPage === pageNum
                    ? 'bg-[#001A4D] text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <OfficerLiquidationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          orgId={orgId}
          orgName={orgName}
          userUid={userUid}
          userName={userName}
          userRole="officer"
          editingReport={editingReport}
        />
      )}

      {/* Detail Viewer Modal */}
      {viewingDetailReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200">
            <div className="px-6 py-4 bg-[#001A4D] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">{viewingDetailReport.eventTitle}</h3>
                <div className="text-xs text-white/70">Liquidation Detail &amp; Receipts</div>
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
                  <div className="font-bold text-sm text-gray-900">
                    {formatCurrency(viewingDetailReport.totalActualSpending)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Surplus / Deficit</div>
                  <div className={`font-bold text-sm ${viewingDetailReport.surplusOrDeficit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {formatVariance(viewingDetailReport.surplusOrDeficit)}
                  </div>
                </div>
              </div>

              {viewingDetailReport.status === 'returned' && viewingDetailReport.returnRemarks && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 font-medium space-y-1">
                  <div className="font-bold text-[#991B1B] uppercase tracking-wider">SAO Adviser Return Remarks</div>
                  <p>{viewingDetailReport.returnRemarks}</p>
                </div>
              )}

              <h4 className="font-bold text-sm text-gray-900 pt-2">Line Items</h4>
              <div className="space-y-2">
                {viewingDetailReport.lineItems?.map((item, idx) => {
                  const itemAllocated = item.allocatedCost ?? 0;
                  const itemVariance = itemAllocated > 0 ? itemAllocated - item.totalCost : null;

                  return (
                    <div key={idx} className="p-3 border border-gray-200 rounded-lg text-xs space-y-1.5 bg-gray-50/50">
                      <div className="flex items-center justify-between font-bold text-gray-900">
                        <span>{item.description} ({item.category})</span>
                        <span className="text-[#001A4D]">Actual Cost: {formatCurrency(item.totalCost)}</span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-gray-600 gap-2">
                        <div className="flex items-center gap-3">
                          {itemAllocated > 0 && (
                            <span>
                              <strong>Proposed:</strong> {item.proposedQuantity || 1} Qty × {formatCurrency(item.proposedUnitCost || 0)} ({formatCurrency(itemAllocated)})
                            </span>
                          )}
                          <span>
                            <strong>Actual:</strong> {item.quantity} Qty × {formatCurrency(item.unitCost)}
                          </span>
                        </div>

                        {itemVariance !== null && (
                          <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                            itemVariance < 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {itemVariance < 0
                              ? `Deficit -${formatCurrency(Math.abs(itemVariance))}`
                              : `Surplus +${formatCurrency(itemVariance)}`}
                          </span>
                        )}
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
                            className="text-[#0E4EBD] hover:underline font-semibold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Uploaded Receipt Image ↗
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Remarks History */}
              {viewingDetailReport.remarksHistory && viewingDetailReport.remarksHistory.length > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <h4 className="font-bold text-sm text-[#001A4D] mb-2">Remarks &amp; Revision History</h4>
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
                    className="px-4 py-2 bg-[#001A4D] hover:bg-[#002D72] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#FFD41C]" /> Export Liquidation Report
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

      {/* Lightbox Modal */}
      <ReceiptLightboxModal
        isOpen={!!lightboxData}
        onClose={() => setLightboxData(null)}
        imageUrl={lightboxData?.url || ''}
        itemTitle={lightboxData?.title}
        vendorName={lightboxData?.vendor}
        amount={lightboxData?.amount}
      />

      {/* Liquidation Excel Export Preview Modal */}
      <LiquidationExportPreviewModal
        isOpen={!!exportReport}
        onClose={() => setExportReport(null)}
        report={exportReport}
      />
    </div>
  );
}
