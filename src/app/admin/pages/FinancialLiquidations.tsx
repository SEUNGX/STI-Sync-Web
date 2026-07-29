import { useState } from 'react';
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
  ExternalLink
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { useAllLiquidations } from '../../modules/finance/hooks/useLiquidationStream';
import { 
  approveLiquidationReport, 
  returnLiquidationReport 
} from '../../modules/finance/services/liquidation.service';
import OfficerLiquidationModal from '../../officer/components/OfficerLiquidationModal';
import ReceiptLightboxModal from '../../modules/finance/components/ReceiptLightboxModal';
import type { LiquidationDocument, LiquidationStatus } from '../../modules/finance/types/liquidation.types';

export function FinancialLiquidations() {
  const { liquidations, loading, error } = useAllLiquidations();
  const [lightboxData, setLightboxData] = useState<{ url: string; title: string; vendor?: string; amount?: number } | null>(null);

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'returned' | 'all'>('pending');
  const [selectedReport, setSelectedReport] = useState<LiquidationDocument | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAdminCreateModal, setShowAdminCreateModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredLiquidations = liquidations.filter((liq) => {
    if (activeTab === 'all') return true;
    return liq.status === activeTab;
  });

  const pendingCount = liquidations.filter((l) => l.status === 'pending').length;
  const approvedCount = liquidations.filter((l) => l.status === 'approved').length;
  const returnedCount = liquidations.filter((l) => l.status === 'returned').length;

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
      setSelectedReport(null);
      setReviewRemarks('');
    } catch (err: any) {
      console.error('[FinancialLiquidations] Return failed:', err);
      setActionError(err?.message || 'Failed to return liquidation report.');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStatusBadge = (status: LiquidationStatus) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-[#639922] text-white">Approved</Badge>;
      case 'pending':
        return <Badge className="bg-[#FFC107] text-[#001A4D]">Pending Review</Badge>;
      case 'returned':
        return <Badge className="bg-[#E24B4A] text-white">Returned for Revision</Badge>;
      default:
        return <Badge className="bg-[#888780] text-white">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Financial Liquidations Review</h2>
          <p className="text-gray-500 text-sm">
            Review actual event spendings, inspect receipt evidence, and approve ledger postings.
          </p>
        </div>

        <Button
          onClick={() => setShowAdminCreateModal(true)}
          className="bg-gradient-to-r from-[#001A4D] to-[#83358E] text-white hover:opacity-90 font-bold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Admin Liquidation
        </Button>
      </div>

      {/* Status Tabs */}
      <Tabs defaultValue="pending" value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="bg-white border border-[#E0E0E0]">
          <TabsTrigger
            value="pending"
            className="data-[state=active]:bg-[#001A4D] data-[state=active]:text-white data-[state=active]:border-b-[3px] data-[state=active]:border-[#FFC107]"
          >
            Pending Review
            <Badge className="ml-2 bg-[#FFC107] text-[#001A4D] hover:bg-[#FFC107]">{pendingCount}</Badge>
          </TabsTrigger>

          <TabsTrigger
            value="approved"
            className="data-[state=active]:bg-[#001A4D] data-[state=active]:text-white data-[state=active]:border-b-[3px] data-[state=active]:border-[#FFC107]"
          >
            Approved
            <Badge className="ml-2 bg-green-100 text-green-800 hover:bg-green-100">{approvedCount}</Badge>
          </TabsTrigger>

          <TabsTrigger
            value="returned"
            className="data-[state=active]:bg-[#001A4D] data-[state=active]:text-white data-[state=active]:border-b-[3px] data-[state=active]:border-[#FFC107]"
          >
            Returned for Revision
            <Badge className="ml-2 bg-red-100 text-red-800 hover:bg-red-100">{returnedCount}</Badge>
          </TabsTrigger>

          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-[#001A4D] data-[state=active]:text-white data-[state=active]:border-b-[3px] data-[state=active]:border-[#FFC107]"
          >
            All Reports
            <Badge className="ml-2 bg-gray-100 text-gray-800 hover:bg-gray-100">{liquidations.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-6">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading liquidations...</div>
          ) : filteredLiquidations.length === 0 ? (
            <Card className="border-[#E0E0E0]">
              <CardContent className="p-12 text-center text-gray-500">
                No liquidation reports matching &quot;{activeTab}&quot; status.
              </CardContent>
            </Card>
          ) : (
            filteredLiquidations.map((liq) => {
              const isDeficit = (liq.surplusOrDeficit || 0) < 0;
              const varianceAmount = Math.abs(liq.surplusOrDeficit || 0);

              return (
                <Card key={liq.id} className="border-[#E0E0E0] hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-[#001A4D]">{liq.eventTitle}</h3>
                          {renderStatusBadge(liq.status)}
                        </div>

                        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-4">
                          <span>Org: <strong>{liq.organizationName || 'Student Org'}</strong></span>
                          <span>Submitted by: <strong>{liq.createdByName || 'Officer'}</strong></span>
                          <span>Line Items: <strong>{liq.lineItems?.length || 0}</strong></span>
                        </div>

                        {/* Financial Bar */}
                        <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <div>
                            <span className="text-gray-500">Approved Budget:</span>
                            <div className="font-bold text-[#001A4D] text-sm">
                              ₱{(liq.allocatedBudget || 0).toLocaleString()}
                            </div>
                          </div>

                          <div>
                            <span className="text-gray-500">Total Actual Spending:</span>
                            <div className="font-bold text-[#83358E] text-sm">
                              ₱{(liq.totalActualSpending || 0).toLocaleString()}
                            </div>
                          </div>

                          <div>
                            <span className="text-gray-500">
                              {isDeficit ? 'Deficit (Over Budget):' : 'Surplus (Remaining):'}
                            </span>
                            <div className={`font-bold text-sm ${isDeficit ? 'text-red-600' : 'text-green-600'}`}>
                              {isDeficit ? `-₱${varianceAmount.toLocaleString()}` : `+₱${varianceAmount.toLocaleString()}`}
                            </div>
                          </div>
                        </div>

                        {liq.status === 'returned' && liq.returnRemarks && (
                          <div className="text-xs bg-red-50 text-red-800 p-2 rounded border border-red-200 mt-2">
                            <strong>Return Remarks:</strong> {liq.returnRemarks}
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => {
                            setSelectedReport(liq);
                            setReviewRemarks(liq.returnRemarks || '');
                            setActionError(null);
                          }}
                          className="bg-[#0E4EBD] hover:bg-[#0E4EBD]/90 text-white font-medium text-xs"
                        >
                          <Eye className="w-4 h-4 mr-1.5" />
                          Review & Action
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Review & Approval Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#001A4D] to-[#83358E] text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Review Liquidation: {selectedReport.eventTitle}</h3>
                <div className="text-xs text-white/70">
                  Host Organization: {selectedReport.organizationName} • Submitted by {selectedReport.createdByName}
                </div>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
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
                    ₱{selectedReport.allocatedBudget.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 font-medium">Total Actual Spending</div>
                  <div className="text-lg font-bold text-[#83358E] mt-0.5">
                    ₱{selectedReport.totalActualSpending.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 font-medium">
                    {selectedReport.surplusOrDeficit < 0 ? 'Deficit (Over Budget)' : 'Surplus (Remaining)'}
                  </div>
                  <div
                    className={`text-lg font-bold mt-0.5 ${
                      selectedReport.surplusOrDeficit < 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {selectedReport.surplusOrDeficit < 0
                      ? `-₱${Math.abs(selectedReport.surplusOrDeficit).toLocaleString()}`
                      : `+₱${selectedReport.surplusOrDeficit.toLocaleString()}`}
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
                                  <div className="font-bold text-gray-900">₱{itemAllocated.toLocaleString()}</div>
                                  <div className="text-[10px] text-gray-500">
                                    {item.proposedQuantity || 1} Qty × ₱{(item.proposedUnitCost || 0).toLocaleString()}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="p-3">
                              <div>
                                <div className="font-bold text-[#83358E]">₱{item.totalCost.toLocaleString()}</div>
                                <div className="text-[10px] text-gray-500">
                                  {item.quantity} Qty × ₱{item.unitCost.toLocaleString()}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 font-bold">
                              {itemVariance !== null ? (
                                <span className={`px-2 py-0.5 rounded text-[11px] ${
                                  itemVariance < 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {itemVariance < 0
                                    ? `Deficit -₱${Math.abs(itemVariance).toLocaleString()}`
                                    : `Surplus +₱${itemVariance.toLocaleString()}`}
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
                                  className="text-[#1E70E8] hover:underline font-semibold text-xs flex items-center gap-1"
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
                          <span className="text-[10px] text-gray-500">{new Date(rem.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-800">{rem.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SAO Adviser Remarks */}
              <div>
                <label className="block text-sm font-bold text-[#001A4D] mb-1.5">
                  SAO Adviser Remarks / Revision Notes
                </label>
                <textarea
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder="Enter approval notes or specific instructions if returning for revision..."
                  className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent h-24"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setSelectedReport(null)}
                disabled={isProcessing}
              >
                Close
              </Button>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleReturn}
                  disabled={isProcessing}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Return for Revision
                </Button>

                <Button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold"
                >
                  {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Approve Liquidation
                </Button>
              </div>
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
    </div>
  );
}
