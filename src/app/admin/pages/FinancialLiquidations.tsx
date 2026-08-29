import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  Receipt,
  CheckCircle2,
  RotateCcw,
  Clock,
  FileText,
  Eye,
  Plus,
  AlertCircle,
  Loader2,
  Check,
  X,
  ExternalLink,
  FileSpreadsheet,
  Search,
  Filter,
  Download,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAllLiquidations } from '../../modules/finance/hooks/useLiquidationStream';
import {
  approveLiquidationReport,
  returnLiquidationReport
} from '../../modules/finance/services/liquidation.service';
import OfficerLiquidationModal from '../../officer/components/OfficerLiquidationModal';
import ReceiptLightboxModal from '../../modules/finance/components/ReceiptLightboxModal';
import { LiquidationExportPreviewModal } from '../../modules/finance/components/LiquidationExportPreviewModal';
import type { LiquidationDocument, LiquidationStatus } from '../../modules/finance/types/liquidation.types';
import { formatCurrency, formatVariance } from '../../utils/currency';
import { formatAppDateTime } from '../../utils/date';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 8;
type TabValue = 'all' | 'pending' | 'approved' | 'returned';

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

export function FinancialLiquidations() {
  const { liquidations, loading } = useAllLiquidations();
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get('id') || searchParams.get('liquidationId');

  const [lightboxData, setLightboxData] = useState<{ url: string; title: string; vendor?: string; amount?: number } | null>(null);

  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [selectedReport, setSelectedReport] = useState<LiquidationDocument | null>(null);
  const [exportReport, setExportReport] = useState<LiquidationDocument | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAdminCreateModal, setShowAdminCreateModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filterOrg, setFilterOrg] = useState('all');

  useEffect(() => {
    if (targetId && liquidations.length > 0) {
      const found = liquidations.find((l) => l.id === targetId);
      if (found) {
        setSelectedReport(found);
      }
    }
  }, [targetId, liquidations]);

  // Unique orgs list for filtering
  const orgList = useMemo(() => {
    const set = new Set<string>();
    liquidations.forEach((l) => {
      if (l.organizationName) set.add(l.organizationName);
    });
    return Array.from(set);
  }, [liquidations]);

  // Filtered & Sorted Liquidations (LATEST FIRST by default)
  const filteredLiquidations = useMemo(() => {
    return liquidations
      .filter((liq) => {
        if (activeTab !== 'all' && liq.status !== activeTab) return false;
        if (filterOrg !== 'all' && liq.organizationName !== filterOrg) return false;

        const q = searchQuery.toLowerCase().trim();
        if (q) {
          const eventMatch = (liq.eventTitle || '').toLowerCase().includes(q);
          const orgMatch = (liq.organizationName || '').toLowerCase().includes(q);
          const officerMatch = (liq.createdByName || '').toLowerCase().includes(q);
          const idMatch = (liq.id || '').toLowerCase().includes(q);
          if (!eventMatch && !orgMatch && !officerMatch && !idMatch) return false;
        }

        return true;
      })
      .sort((a, b) => getLiquidationTimestamp(b) - getLiquidationTimestamp(a));
  }, [liquidations, activeTab, filterOrg, searchQuery]);

  // KPI calculations
  const pendingItems = useMemo(() => liquidations.filter((l) => l.status === 'pending'), [liquidations]);
  const approvedItems = useMemo(() => liquidations.filter((l) => l.status === 'approved'), [liquidations]);
  const returnedItems = useMemo(() => liquidations.filter((l) => l.status === 'returned'), [liquidations]);

  const pendingAmount = useMemo(() => {
    return pendingItems.reduce((sum, item) => sum + (item.totalActualSpending || item.allocatedBudget || 0), 0);
  }, [pendingItems]);

  const approvedAmount = useMemo(() => {
    return approvedItems.reduce((sum, item) => sum + (item.totalActualSpending || item.allocatedBudget || 0), 0);
  }, [approvedItems]);

  const pendingCount = pendingItems.length;
  const approvedCount = approvedItems.length;
  const returnedCount = returnedItems.length;
  const allCount = liquidations.length;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLiquidations.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLiquidations.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLiquidations, currentPage]);

  const handleTabChange = (tab: TabValue) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterOrg]);

  const handleApprove = async () => {
    if (!selectedReport) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await approveLiquidationReport(
        selectedReport.id,
        'sao_admin_user',
        reviewRemarks,
        selectedReport
      );
      toast.success(`Liquidation report for "${selectedReport.eventTitle}" approved.`);
      setSelectedReport(null);
      setReviewRemarks('');
    } catch (err: any) {
      console.error('[FinancialLiquidations] Approve failed:', err);
      setActionError(err?.message || 'Failed to approve liquidation report.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReturn = async () => {
    if (!selectedReport) return;
    if (!reviewRemarks.trim()) {
      setActionError('Please provide revision remarks explaining why the report is being returned.');
      return;
    }
    setIsProcessing(true);
    setActionError(null);
    try {
      await returnLiquidationReport(
        selectedReport.id,
        'sao_admin_user',
        reviewRemarks.trim()
      );
      toast.info(`Liquidation report returned for revision.`);
      setSelectedReport(null);
      setReviewRemarks('');
    } catch (err: any) {
      console.error('[FinancialLiquidations] Return failed:', err);
      setActionError(err?.message || 'Failed to return liquidation report.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportAllCSV = () => {
    if (filteredLiquidations.length === 0) {
      toast.info(`No ${activeTab === 'all' ? '' : activeTab + ' '}liquidation reports to export.`);
      return;
    }
    const headers = ['Report/Event', 'Organization', 'Submitted By', 'Actual Expenses', 'Allocated Budget', 'Variance', 'Receipts Count', 'Submitted Date', 'Status'];
    const rows = filteredLiquidations.map((l) => [
      `"${(l.eventTitle || '').replace(/"/g, '""')}"`,
      `"${(l.organizationName || '').replace(/"/g, '""')}"`,
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
    link.setAttribute('download', `STI_Sync_Liquidations_${activeTab.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredLiquidations.length} ${activeTab === 'all' ? '' : activeTab + ' '}liquidation report(s) to CSV.`);
  };

  const renderStatusBadge = (status: LiquidationStatus) => {
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

  const getOrgInitials = (name?: string) => {
    if (!name) return 'ORG';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  return (
    <div className="space-y-5 w-full">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#001A4D] tracking-tight">Financial Liquidations</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Review and process liquidation reports from student organizations
          </p>
        </div>

        {/* Solid button without gradients */}
        <Button
          onClick={() => setShowAdminCreateModal(true)}
          className="bg-[#001A4D] hover:bg-[#002D72] text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-[#FFD41C]" />
          Create Admin Liquidation
        </Button>
      </div>

      {/* ── Top 3 KPI Summary Cards (Matching Reference) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Pending Amount */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 flex-shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">Pending Amount</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5 tracking-tight">
              {formatCurrency(pendingAmount)}
            </div>
            <div className="text-[11px] text-amber-700 font-medium">
              {pendingCount} report{pendingCount === 1 ? '' : 's'} awaiting review
            </div>
          </div>
        </div>

        {/* Card 2: Approved This Period */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">Approved This Period</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5 tracking-tight">
              {formatCurrency(approvedAmount)}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium">
              {approvedCount} approved liquidation{approvedCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        {/* Card 3: Returned for Revision */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 flex-shrink-0">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">Returned for Revision</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5 tracking-tight">
              {returnedCount} {returnedCount === 1 ? 'report' : 'reports'}
            </div>
            <div className="text-[11px] text-red-700 font-medium">
              Requires officer resubmission
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Container: Tabs + Search/Export + Fixed Height Table + Pagination ── */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden">
        {/* Top Control Bar */}
        <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {[
              { key: 'all', label: 'All', count: allCount },
              { key: 'pending', label: 'Pending', count: pendingCount },
              { key: 'approved', label: 'Approved', count: approvedCount },
              { key: 'returned', label: 'Returned', count: returnedCount },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key as TabValue)}
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
            {/* Search Input */}
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

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                showFilters || filterOrg !== 'all'
                  ? 'border-[#001A4D] bg-[#001A4D]/5 text-[#001A4D]'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {/* Export Button */}
            <button
              onClick={handleExportAllCSV}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Export filtered reports to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Filter Drawer */}
        {showFilters && (
          <div className="p-4 bg-gray-50/60 border-b border-gray-200 flex flex-wrap items-center gap-3 text-xs">
            <div>
              <span className="text-gray-500 font-semibold mr-1.5">Organization:</span>
              <select
                value={filterOrg}
                onChange={(e) => setFilterOrg(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 outline-none focus:border-[#001A4D]"
              >
                <option value="all">All Organizations</option>
                {orgList.map((orgName) => (
                  <option key={orgName} value={orgName}>
                    {orgName}
                  </option>
                ))}
              </select>
            </div>

            {filterOrg !== 'all' && (
              <button
                onClick={() => setFilterOrg('all')}
                className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Org Filter
              </button>
            )}
          </div>
        )}

        {/* ── Table Container (No inner vertical scroll) ── */}
        <div className="overflow-x-auto relative">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Loading liquidations...
            </div>
          ) : filteredLiquidations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto" />
              <div className="font-bold text-gray-700 text-sm">No liquidation reports found</div>
              <p className="text-xs text-gray-400 max-w-sm">
                No liquidation reports match the active filter or search query.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50/90 text-gray-500 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200 sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th className="py-3 px-4">Report / Organization</th>
                  <th className="py-3 px-4">Event</th>
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
                {paginatedItems.map((liq) => {
                  const isReturned = liq.status === 'returned';
                  const isPending = liq.status === 'pending';
                  const isApproved = liq.status === 'approved';

                  const allocated = liq.allocatedBudget || 0;
                  const spent = liq.totalActualSpending || 0;
                  const variance = (liq.surplusOrDeficit !== undefined) ? liq.surplusOrDeficit : (allocated - spent);
                  const isDeficit = variance < 0;

                  // Utilization percentage
                  const utilPct = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 100;
                  const isOverBudget = spent > allocated && allocated > 0;

                  const orgInitials = getOrgInitials(liq.organizationName);

                  return (
                    <tr key={liq.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Report & Org */}
                      <td className="py-3.5 px-4 max-w-[240px]">
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#001A4D] text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                            {orgInitials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-sm leading-snug truncate">
                              {liq.eventTitle || 'Liquidation Report'}
                            </div>
                            <div className="text-[11px] text-gray-500 font-medium truncate">
                              {liq.organizationName || 'Student Org'}
                            </div>
                            {isReturned && liq.returnRemarks && (
                              <div className="text-[11px] text-red-600 font-medium truncate mt-0.5">
                                {liq.returnRemarks}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Event Title */}
                      <td className="py-3.5 px-4 max-w-[180px]">
                        <div className="font-medium text-gray-800 text-xs truncate">
                          {liq.eventTitle}
                        </div>
                      </td>

                      {/* Expenses + Progress Bar */}
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
                          <span>{liq.lineItems?.length || 0}</span>
                        </div>
                      </td>

                      {/* Submitted Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-gray-500 text-xs">
                        {formatSubmittedDate(liq.createdAt)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(liq.status)}
                      </td>

                      {/* Inline Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedReport(liq);
                                  setReviewRemarks('');
                                  setActionError(null);
                                }}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Approve this liquidation"
                              >
                                <Check className="w-3 h-3" />
                                <span>Approve</span>
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedReport(liq);
                                  setReviewRemarks(liq.returnRemarks || '');
                                  setActionError(null);
                                }}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Return for revision"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Return</span>
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <button
                              onClick={() => setExportReport(liq)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Export report to Excel/Preview"
                            >
                              <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                              <span>Export</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedReport(liq);
                              setReviewRemarks(liq.returnRemarks || '');
                              setActionError(null);
                            }}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-[#001A4D] hover:text-white text-gray-700 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="View Full Report"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>
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
            {filteredLiquidations.length === 0 ? (
              'Showing 0 reports'
            ) : (
              <span>
                Showing <strong className="text-gray-900 font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to{' '}
                <strong className="text-gray-900 font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filteredLiquidations.length)}</strong> of{' '}
                <strong className="text-gray-900 font-bold">{filteredLiquidations.length}</strong> reports
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

      {/* ── Review & Approval Modal ── */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200">
            {/* Modal Header: Solid #001A4D, no gradient */}
            <div className="px-6 py-4 bg-[#001A4D] text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {selectedReport.status === 'approved' ? 'Approved Liquidation Report' : 'Review Liquidation'}: {selectedReport.eventTitle}
                </h3>
                <div className="text-xs text-white/70 mt-0.5">
                  Host Organization: {selectedReport.organizationName} • Submitted by {selectedReport.createdByName || 'Officer'}
                </div>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Financial Math Bar */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-gray-500 font-medium">Approved Event Budget</div>
                  <div className="text-lg font-bold text-[#001A4D] mt-0.5">
                    {formatCurrency(selectedReport.allocatedBudget)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 font-medium">Total Actual Spending</div>
                  <div className="text-lg font-bold text-gray-900 mt-0.5">
                    {formatCurrency(selectedReport.totalActualSpending)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 font-medium">
                    {selectedReport.surplusOrDeficit < 0 ? 'Deficit (Over Budget)' : 'Surplus (Remaining)'}
                  </div>
                  <div
                    className={`text-lg font-bold mt-0.5 ${
                      selectedReport.surplusOrDeficit < 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {formatVariance(selectedReport.surplusOrDeficit)}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <h4 className="font-bold text-[#001A4D] text-sm mb-3">
                  Expense Line Items & Uploaded Receipts ({selectedReport.lineItems?.length || 0})
                </h4>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Item Description</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Allocated</th>
                        <th className="p-3">Actual Cost</th>
                        <th className="p-3">Variance</th>
                        <th className="p-3">Vendor / Receipt #</th>
                        <th className="p-3">Receipt Image</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedReport.lineItems?.map((item, idx) => {
                        const itemAllocated = item.allocatedCost ?? 0;
                        const itemVariance = itemAllocated > 0 ? itemAllocated - item.totalCost : null;

                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="p-3 font-bold text-gray-500">{idx + 1}</td>
                            <td className="p-3 font-semibold text-gray-900">{item.description}</td>
                            <td className="p-3 text-gray-600">{item.category}</td>
                            <td className="p-3">
                              {itemAllocated > 0 ? (
                                <div>
                                  <div className="font-bold text-gray-900">{formatCurrency(itemAllocated)}</div>
                                  <div className="text-[10px] text-gray-500">
                                    {item.proposedQuantity || 1} Qty × {formatCurrency(item.proposedUnitCost || 0)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="p-3">
                              <div>
                                <div className="font-bold text-gray-900">{formatCurrency(item.totalCost)}</div>
                                <div className="text-[10px] text-gray-500">
                                  {item.quantity} Qty × {formatCurrency(item.unitCost)}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 font-bold">
                              {itemVariance !== null ? (
                                <span className={`px-2 py-0.5 rounded text-[11px] ${
                                  itemVariance < 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {itemVariance < 0
                                    ? `Deficit -${formatCurrency(Math.abs(itemVariance))}`
                                    : `Surplus +${formatCurrency(itemVariance)}`}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="p-3 text-gray-600">
                              {item.vendorName || '—'} {item.receiptNumber ? `(${item.receiptNumber})` : ''}
                            </td>
                            <td className="p-3">
                              {item.receiptUrl ? (
                                <button
                                  onClick={() => setLightboxData({
                                    url: item.receiptUrl,
                                    title: item.description,
                                    vendor: item.vendorName,
                                    amount: item.totalCost,
                                  })}
                                  className="text-[#0E4EBD] hover:underline font-semibold text-xs flex items-center gap-1 cursor-pointer"
                                >
                                  View Image <ExternalLink className="w-3 h-3" />
                                </button>
                              ) : (
                                <span className="text-gray-400">No Image</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks History Log */}
              {selectedReport.remarksHistory && selectedReport.remarksHistory.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-200">
                  <h4 className="font-bold text-[#001A4D] text-xs uppercase tracking-wider">
                    Remarks & Action History
                  </h4>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {selectedReport.remarksHistory.map((rem, rIdx) => (
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

              {/* SAO Adviser Remarks */}
              {selectedReport.status !== 'approved' && (
                <div>
                  <label className="block text-sm font-bold text-[#001A4D] mb-1.5">
                    SAO Adviser Remarks / Revision Notes
                  </label>
                  <textarea
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    placeholder="Enter approval notes or specific instructions if returning for revision..."
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D] h-24"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setSelectedReport(null)}
                disabled={isProcessing}
                className="cursor-pointer"
              >
                Close
              </Button>

              {selectedReport.status === 'approved' ? (
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4" /> Approved by SAO Adviser
                  </span>
                  <Button
                    onClick={() => setExportReport(selectedReport)}
                    className="bg-[#001A4D] hover:bg-[#002D72] text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-1.5 text-[#FFD41C]" />
                    Export Liquidation Report
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleReturn}
                    disabled={isProcessing}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
                  >
                    {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Return for Revision
                  </Button>

                  <Button
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Approve Liquidation
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SAO Admin Create Liquidation Modal */}
      {showAdminCreateModal && (
        <OfficerLiquidationModal
          isOpen={showAdminCreateModal}
          onClose={() => setShowAdminCreateModal(false)}
          orgId="sao_admin"
          orgName="Student Affairs Office"
          userUid="sao_admin_user"
          userName="SAO Adviser"
          userRole="admin"
        />
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
