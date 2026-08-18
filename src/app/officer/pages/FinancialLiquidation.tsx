import { useState, useEffect } from 'react';
import { Plus, Receipt, AlertCircle, Edit3, CheckCircle2, Clock, RotateCcw, Eye, FileText, FileSpreadsheet } from 'lucide-react';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useOrgLiquidations } from '../../modules/finance/hooks/useLiquidationStream';
import ReceiptLightboxModal from '../../modules/finance/components/ReceiptLightboxModal';
import OfficerLiquidationModal from '../components/OfficerLiquidationModal';
import { LiquidationExportPreviewModal } from '../../modules/finance/components/LiquidationExportPreviewModal';
import type { LiquidationDocument, LiquidationStatus } from '../../modules/finance/types/liquidation.types';
import { formatCurrency, formatVariance } from '../../utils/currency';
import { formatAppDateTime } from '../../utils/date';

type FilterTab = 'all' | 'draft' | 'pending' | 'approved' | 'returned';

export default function FinancialLiquidation() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
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

  const { liquidations, loading, error } = useOrgLiquidations(orgId);

  const filteredReports = liquidations.filter((report) => {
    if (activeTab === 'all') return true;
    return report.status === activeTab;
  });

  const counts = {
    all: liquidations.length,
    draft: liquidations.filter((r) => r.status === 'draft').length,
    pending: liquidations.filter((r) => r.status === 'pending').length,
    approved: liquidations.filter((r) => r.status === 'approved').length,
    returned: liquidations.filter((r) => r.status === 'returned').length,
  };

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
        return (
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'pending':
        return (
          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </span>
        );
      case 'returned':
        return (
          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Returned for Revision
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-gray-500 text-xs mb-1">Dashboard &gt; Financial Liquidation</div>
          <h1 className="text-[#001A4D] text-2xl font-bold">Financial Liquidation Portal</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Submit actual spendings, receipt evidence, and track financial variance against approved event budgets.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#83358E] text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          New Liquidation Report
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'All Reports' },
          { key: 'pending', label: 'Pending Review' },
          { key: 'approved', label: 'Approved' },
          { key: 'returned', label: 'Returned for Revision' },
          { key: 'draft', label: 'Drafts' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as FilterTab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-[#83358E] text-[#83358E] font-bold'
                : 'border-transparent text-gray-500 hover:text-[#001A4D]'
            }`}
          >
            {tab.label}
            <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-700">
              {counts[tab.key as FilterTab]}
            </span>
          </button>
        ))}
      </div>

      {/* Liquidation Reports List */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading liquidation reports...</div>
      ) : filteredReports.length === 0 ? (
        <div className="p-12 bg-white border border-gray-200 rounded-2xl text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-[#83358E]/10 flex items-center justify-center mx-auto text-[#83358E]">
            <Receipt className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No Liquidation Reports Found</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {activeTab === 'all'
              ? 'Click "+ New Liquidation Report" to select an approved event and submit your expense line items with receipts.'
              : `No reports matching "${activeTab}" status.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const isDeficit = (report.surplusOrDeficit || 0) < 0;
            const varianceAmount = Math.abs(report.surplusOrDeficit || 0);

            return (
              <div
                key={report.id}
                className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow space-y-4"
              >
                {/* Top Row: Event Title & Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-[#001A4D]">{report.eventTitle}</h3>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Report ID: {report.id.slice(0, 10)} • Created by {report.createdByName || 'Officer'}
                    </div>
                  </div>
                  {statusBadge(report.status)}
                </div>

                {/* Returned Remarks Banner */}
                {report.status === 'returned' && report.returnRemarks && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-800 text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
                    <div>
                      <div className="font-bold text-xs uppercase tracking-wider text-red-700 mb-0.5">
                        SAO Adviser Return Remarks
                      </div>
                      <p className="text-xs text-red-900">{report.returnRemarks}</p>
                    </div>
                  </div>
                )}

                {/* Financial Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div>
                    <div className="text-xs text-gray-500 font-medium">Approved Event Budget</div>
                    <div className="text-base font-bold text-[#001A4D] mt-0.5">
                      {formatCurrency(report.allocatedBudget)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 font-medium">Total Actual Spending</div>
                    <div className="text-base font-bold text-[#83358E] mt-0.5">
                      {formatCurrency(report.totalActualSpending)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 font-medium">
                      {isDeficit ? 'Net Deficit (Over Budget)' : 'Net Surplus (Remaining)'}
                    </div>
                    <div
                      className={`text-base font-bold mt-0.5 ${
                        isDeficit ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {formatVariance(varianceAmount)}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-gray-500">
                    {report.lineItems?.length || 0} receipt item(s) attached
                  </div>

                  <div className="flex items-center gap-2">
                    {report.status === 'approved' && (
                      <button
                        onClick={() => setExportReport(report)}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-[#83358E] to-[#001A4D] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm hover:opacity-90 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-[#FFC107]" /> Export Report
                      </button>
                    )}

                    <button
                      onClick={() => setViewingDetailReport(report)}
                      className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" /> View Details
                    </button>

                    {(report.status === 'draft' || report.status === 'returned') && (
                      <button
                        onClick={() => handleOpenEdit(report)}
                        className="px-4 py-1.5 bg-[#83358E] hover:bg-[#83358E]/90 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                        {report.status === 'returned' ? 'Edit & Resubmit' : 'Edit Draft'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                  <div className="font-bold text-sm text-[#83358E]">
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
                        <span className="text-[#83358E]">Actual Cost: {formatCurrency(item.totalCost)}</span>
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
                            itemVariance < 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
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
                            className="text-[#1E70E8] hover:underline font-semibold text-xs flex items-center gap-1 cursor-pointer"
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
                    className="px-4 py-2 bg-gradient-to-r from-[#83358E] to-[#001A4D] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
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
