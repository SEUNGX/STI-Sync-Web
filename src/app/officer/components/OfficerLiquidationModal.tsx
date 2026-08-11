import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Upload, AlertCircle, CheckCircle2, Loader2, DollarSign } from 'lucide-react';
import { uploadToCloudinary } from '../../../services/cloudinary';
import { useAllEvents } from '../../modules/events/hooks/useEventStream';
import {
  createLiquidationReport,
  updateLiquidationReport,
  submitLiquidationReport
} from '../../modules/finance/services/liquidation.service';
import type {
  LiquidationDocument,
  ExpenseLineItem
} from '../../modules/finance/types/liquidation.types';

interface OfficerLiquidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  orgName: string;
  userUid: string;
  userName: string;
  userRole: 'admin' | 'officer';
  editingReport?: LiquidationDocument | null;
}

const EXPENSE_CATEGORIES = [
  'Food & Catering',
  'Venue & Facilities',
  'Materials & Printing',
  'Honorarium & Speakers',
  'Transportation & Travel',
  'Equipment Rental',
  'Miscellaneous',
];

export default function OfficerLiquidationModal({
  isOpen,
  onClose,
  orgId,
  orgName,
  userUid,
  userName,
  userRole,
  editingReport,
}: OfficerLiquidationModalProps) {
  const { events: allEvents } = useAllEvents();

  // Helper to calculate total budget from any budget property or budgetItems array
  const calculateEventBudget = (e: any): number => {
    if (typeof e.totalApprovedBudget === 'number' && e.totalApprovedBudget > 0) return e.totalApprovedBudget;
    if (typeof e.adminFeeOverride === 'number' && e.adminFeeOverride > 0) return e.adminFeeOverride;
    if (typeof e.totalExpectedCollection === 'number' && e.totalExpectedCollection > 0) return e.totalExpectedCollection;
    if (typeof e.suggestedFeePerStudent === 'number' && e.suggestedFeePerStudent > 0) return e.suggestedFeePerStudent;
    if (Array.isArray(e.budgetItems) && e.budgetItems.length > 0) {
      const sum = e.budgetItems.reduce((acc: number, item: any) => {
        const itemCost = Number(item.approvedAmount || item.totalCost || (Number(item.quantity || 1) * Number(item.unitCost || 0)) || 0);
        return acc + itemCost;
      }, 0);
      if (sum > 0) return sum;
    }
    return 0;
  };

  // Filter events eligible for liquidation:
  const eligibleEvents = useMemo(() => {
    if (allEvents.length === 0) return [];

    const nonDrafts = allEvents.filter((e: any) => (e.proposalStatus || '').toString().toLowerCase() !== 'draft');

    if (userRole === 'admin') {
      return nonDrafts.filter((e: any) => {
        if (e.isOfficerProposal === true || e.submittedByOfficer === true) return false;

        // Exclude events that went through proposal approval workflow (have approvedBy or submitted history)
        const hasApprovedBy = Boolean(e.approvedBy);
        const hasSubmittedHistory = Array.isArray(e.proposalHistory) &&
          e.proposalHistory.some((h: any) => h?.action === 'submitted' || h?.action === 'resubmitted');

        if (hasApprovedBy || hasSubmittedHistory) return false;

        return true;
      });
    }

    const cleanOrgId = (orgId || '').trim().toLowerCase();
    if (!cleanOrgId) return nonDrafts;

    return nonDrafts.filter((e: any) => {
      const orgFields = [
        e.hostingOrgId,
        e.organizationId,
        e.createdByOrgId,
        e.orgId,
        e.org,
        e.organization,
        e.hostingOrgName,
        e.orgName,
      ];
      return orgFields.some((f) => f && String(f).trim().toLowerCase().includes(cleanOrgId));
    });
  }, [allEvents, orgId, userRole]);

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [allocatedBudget, setAllocatedBudget] = useState<number>(0);
  const [lineItems, setLineItems] = useState<ExpenseLineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill if editing an existing / returned report
  useEffect(() => {
    if (editingReport) {
      setSelectedEventId(editingReport.eventId);
      setAllocatedBudget(editingReport.allocatedBudget || 0);
      setLineItems(editingReport.lineItems || []);
    } else {
      setSelectedEventId('');
      setAllocatedBudget(0);
      setLineItems([
        {
          id: Date.now().toString(),
          description: '',
          category: EXPENSE_CATEGORIES[0],
          quantity: 1,
          unitCost: 0,
          totalCost: 0,
          vendorName: '',
          receiptNumber: '',
          receiptUrl: '',
        },
      ]);
    }
  }, [editingReport, isOpen]);

  // Update budget & auto-fetch budgetItems when event is selected
  const handleEventSelect = (eventId: string) => {
    setSelectedEventId(eventId);
    const event = eligibleEvents.find((e) => e.id === eventId);
    if (event) {
      const budget = calculateEventBudget(event) || 10000;
      setAllocatedBudget(budget);

      // Auto-fetch budgetItems from the event proposal if not editing existing report
      if (!editingReport && (event as any).budgetItems && (event as any).budgetItems.length > 0) {
        const fetchedItems: ExpenseLineItem[] = (event as any).budgetItems.map((bi: any, i: number) => {
          const allocatedCost = bi.approvedAmount || (bi.quantity * bi.unitCost) || bi.totalCost || 0;
          const propQty = bi.quantity || 1;
          const propUnit = bi.unitCost || (allocatedCost > 0 ? Math.round(allocatedCost / propQty) : 0);

          return {
            id: `item-${i}-${Date.now()}`,
            description: bi.item || bi.description || `Budget Item ${i + 1}`,
            category: bi.category || EXPENSE_CATEGORIES[0],
            allocatedCost: allocatedCost,
            proposedQuantity: propQty,
            proposedUnitCost: propUnit,
            isPreFilled: true,
            quantity: propQty,
            unitCost: 0,
            totalCost: 0,
            vendorName: '',
            receiptUrl: '',
          };
        });
        setLineItems(fetchedItems);
      }
    }
  };

  const handleLineItemChange = (index: number, field: keyof ExpenseLineItem, value: any) => {
    const updated = [...lineItems];
    const item = { ...updated[index], [field]: value };

    if (field === 'quantity' || field === 'unitCost') {
      const qty = field === 'quantity' ? Number(value) : item.quantity;
      const cost = field === 'unitCost' ? Number(value) : item.unitCost;
      item.totalCost = qty * cost;
    }

    updated[index] = item;
    setLineItems(updated);
  };

  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: Date.now().toString(),
        description: '',
        category: 'Miscellaneous',
        isPreFilled: false,
        quantity: 1,
        unitCost: 0,
        totalCost: 0,
        vendorName: '',
        receiptUrl: '',
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleReceiptUpload = async (index: number, file: File) => {
    if (!file) return;
    setUploadingIndex(index);
    try {
      const res = await uploadToCloudinary(file, { folder: `liquidations/${selectedEventId || 'general'}` });
      handleLineItemChange(index, 'receiptUrl', res.secureUrl);
    } catch (err: any) {
      setError('Failed to upload receipt image. Please try again.');
    } finally {
      setUploadingIndex(null);
    }
  };

  // Live Calculations
  const totalActualSpending = lineItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);
  const surplusOrDeficit = allocatedBudget - totalActualSpending;
  const isDeficit = surplusOrDeficit < 0;

  const handleSave = async (shouldSubmit: boolean) => {
    if (!selectedEventId) {
      setError('Please select an event for this liquidation report.');
      return;
    }

    if (lineItems.some((item) => !item.description.trim() || item.totalCost <= 0)) {
      setError('Please fill out all line item descriptions and valid costs.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const selectedEvent = eligibleEvents.find((e) => e.id === selectedEventId);
      const eventTitle = selectedEvent ? selectedEvent.title : editingReport?.eventTitle || 'Event Liquidation';

      const isAdmin = userRole === 'admin';
      const nextStatus = isAdmin ? 'approved' : (shouldSubmit ? 'pending' : 'draft');

      const payload: Omit<LiquidationDocument, 'id' | 'createdAt' | 'updatedAt'> = {
        eventId: selectedEventId,
        eventTitle,
        organizationId: orgId,
        organizationName: orgName,
        createdById: userUid,
        createdByRole: userRole,
        createdByName: userName,
        allocatedBudget,
        totalActualSpending,
        surplusOrDeficit,
        status: nextStatus,
        lineItems,
      };

      if (editingReport) {
        await updateLiquidationReport(editingReport.id, {
          ...payload,
          status: nextStatus,
          ...(shouldSubmit ? { submittedAt: new Date() } : {}),
        });
      } else {
        await createLiquidationReport(payload);
      }

      onClose();
    } catch (err: any) {
      console.error('[OfficerLiquidationModal] Save failed:', err);
      setError(err?.message || 'Failed to save liquidation report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">

        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#001A4D] to-[#83358E] text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {editingReport ? 'Edit Financial Liquidation Report' : 'Create Liquidation Report'}
            </h2>
            <p className="text-xs text-white/70 mt-0.5">
              Submit actual spendings, attach receipt evidence, and verify budget variance.
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {editingReport?.status === 'returned' && editingReport.returnRemarks && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl text-red-900 text-xs font-medium space-y-1">
              <div className="flex items-center gap-2 font-bold text-red-700 text-sm uppercase tracking-wider">
                <AlertCircle className="w-4.5 h-4.5 text-red-600" />
                SAO Adviser Return Remarks
              </div>
              <p className="text-red-900 text-xs font-semibold pl-6.5">{editingReport.returnRemarks}</p>
            </div>
          )}

          {/* Event Selection & Allocated Budget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Linked Event <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => handleEventSelect(e.target.value)}
                disabled={!!editingReport}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">Select an approved event...</option>
                {eligibleEvents.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.title} ({evt.eventFormat || 'Campus'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Approved Budget Ceiling (Allocated)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₱</span>
                <input
                  type="number"
                  value={allocatedBudget}
                  onChange={(e) => setAllocatedBudget(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#83358E]"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Live Financial Variance Summary Card */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
              <div className="text-xs text-gray-500 font-medium">Approved Budget</div>
              <div className="text-lg font-bold text-[#001A4D] mt-1">₱{allocatedBudget.toLocaleString()}</div>
            </div>

            <div className="p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
              <div className="text-xs text-gray-500 font-medium">Total Actual Spendings</div>
              <div className="text-lg font-bold text-[#83358E] mt-1">₱{totalActualSpending.toLocaleString()}</div>
            </div>

            <div className={`p-3 bg-white border rounded-lg shadow-sm ${isDeficit ? 'border-red-200' : 'border-green-200'}`}>
              <div className="text-xs text-gray-500 font-medium">
                {isDeficit ? 'Net Deficit (Over Budget)' : 'Net Surplus (Remaining)'}
              </div>
              <div className={`text-lg font-bold mt-1 ${isDeficit ? 'text-red-600' : 'text-green-600'}`}>
                {isDeficit ? `-₱${Math.abs(surplusOrDeficit).toLocaleString()}` : `+₱${surplusOrDeficit.toLocaleString()}`}
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[#001A4D]">Expense Line Items & Receipts</h3>
              <button
                onClick={handleAddLineItem}
                className="px-3 py-1.5 bg-[#1E70E8] text-white text-xs font-medium rounded-lg hover:bg-[#0E4EBD] flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Line Item
              </button>
            </div>

            <div className="space-y-4">
              {lineItems.map((item, index) => (
                <div key={item.id} className="p-4 border border-gray-200 rounded-xl bg-white space-y-3 relative group">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Item #{index + 1}
                      </span>
                      {item.isPreFilled && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-[#83358E] rounded border border-purple-200 uppercase">
                          Proposal Budget Item
                        </span>
                      )}
                      {item.allocatedCost !== undefined && item.allocatedCost > 0 && (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
                          Allocated: ₱{item.allocatedCost.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {item.allocatedCost !== undefined && item.allocatedCost > 0 && (
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded ${(item.allocatedCost - item.totalCost) < 0
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                          }`}>
                          {(item.allocatedCost - item.totalCost) < 0
                            ? `Item Deficit (-₱${Math.abs(item.allocatedCost - item.totalCost).toLocaleString()})`
                            : `Item Surplus (+₱${(item.allocatedCost - item.totalCost).toLocaleString()})`}
                        </span>
                      )}
                      {!item.isPreFilled && lineItems.length > 1 && (
                        <button
                          onClick={() => handleRemoveLineItem(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove custom item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">Description / Item Name *</label>
                      <input
                        type="text"
                        value={item.description}
                        disabled={item.isPreFilled}
                        onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                        placeholder="e.g. Lunch Catering for 50 Pax"
                        className={`w-full px-3 py-1.5 border border-gray-300 rounded text-sm ${item.isPreFilled ? 'bg-gray-100 font-semibold text-gray-700 cursor-not-allowed' : 'focus:ring-1 focus:ring-[#83358E]'
                          }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Category</label>
                      <select
                        value={item.category}
                        disabled={item.isPreFilled}
                        onChange={(e) => handleLineItemChange(index, 'category', e.target.value)}
                        className={`w-full px-3 py-1.5 border border-gray-300 rounded text-sm ${item.isPreFilled ? 'bg-gray-100 font-semibold text-gray-700 cursor-not-allowed' : 'focus:ring-1 focus:ring-[#83358E]'
                          }`}
                      >
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Side-by-Side Proposed vs Actual Comparison Banner */}
                  {item.allocatedCost !== undefined && item.allocatedCost > 0 && (
                    <div className="p-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-3">
                        <div>
                          <span className="text-gray-500 font-medium">Proposed Baseline:</span>
                          <span className="ml-1.5 font-bold text-[#001A4D]">
                            {item.proposedQuantity || item.quantity || 1} Qty × ₱{(item.proposedUnitCost || 0).toLocaleString()} = ₱{(item.allocatedCost || 0).toLocaleString()}
                          </span>
                        </div>
                        <span className="text-blue-300 hidden sm:inline">|</span>
                        <div>
                          <span className="text-gray-500 font-medium">Actual Input:</span>
                          <span className="ml-1.5 font-bold text-[#83358E]">
                            {item.quantity} Qty × ₱{item.unitCost.toLocaleString()} = ₱{item.totalCost.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className={`font-bold px-2 py-0.5 rounded text-[11px] ${((item.allocatedCost || 0) - item.totalCost) < 0
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                        }`}>
                        {((item.allocatedCost || 0) - item.totalCost) < 0
                          ? `Deficit: -₱${Math.abs((item.allocatedCost || 0) - item.totalCost).toLocaleString()}`
                          : `Surplus: +₱${((item.allocatedCost || 0) - item.totalCost).toLocaleString()}`}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Actual Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Actual Unit Cost (₱)</label>
                      <input
                        type="number"
                        min="0"
                        value={item.unitCost}
                        onChange={(e) => handleLineItemChange(index, 'unitCost', e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm font-medium text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Total Actual Cost (₱)</label>
                      <input
                        type="number"
                        readOnly
                        value={item.totalCost}
                        className="w-full px-3 py-1.5 border border-gray-200 bg-gray-50 rounded text-sm font-bold text-[#83358E]"
                      />
                    </div>
                  </div>

                  {/* Vendor Name & Receipt Upload */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-gray-100">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Vendor / Store Name *</label>
                      <input
                        type="text"
                        value={item.vendorName}
                        onChange={(e) => handleLineItemChange(index, 'vendorName', e.target.value)}
                        placeholder="e.g. Jollibee Ormoc"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Upload Receipt Image *</label>
                      <div className="flex items-center gap-2">
                        {item.receiptUrl ? (
                          <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded text-xs text-green-700 flex-1">
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <a
                              href={item.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline truncate font-medium"
                            >
                              Receipt Uploaded ↗
                            </a>
                          </div>
                        ) : (
                          <label className="cursor-pointer flex items-center justify-center gap-2 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 text-xs font-medium text-gray-600 flex-1 transition-colors">
                            {uploadingIndex === index ? (
                              <Loader2 className="w-4 h-4 animate-spin text-[#83358E]" />
                            ) : (
                              <Upload className="w-4 h-4 text-gray-500" />
                            )}
                            <span>{uploadingIndex === index ? 'Uploading...' : 'Upload Receipt'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleReceiptUpload(index, e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            * All liquidations require receipt proof for approval.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-[#001A4D] to-[#83358E] text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity shadow-md flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Liquidation
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
