import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
  DollarSign,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Eye,
  Paperclip,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { uploadToCloudinary } from '../../../services/cloudinary';
import { useAllEvents } from '../../modules/events/hooks/useEventStream';
import { useAllLiquidations } from '../../modules/finance/hooks/useLiquidationStream';
import { getEventTimingStatus } from '../../modules/events/utils/event-lifecycle.utils';
import {
  createLiquidationReport,
  updateLiquidationReport,
  submitLiquidationReport,
} from '../../modules/finance/services/liquidation.service';
import type {
  LiquidationDocument,
  ExpenseLineItem,
  ReceiptAttachment,
} from '../../modules/finance/types/liquidation.types';
import { formatCurrency, formatVariance } from '../../utils/currency';
import ReceiptLightboxModal from '../../modules/finance/components/ReceiptLightboxModal';
import { toast } from 'sonner';

interface OfficerLiquidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  orgName: string;
  userUid: string;
  userName: string;
  userRole: 'admin' | 'officer';
  editingReport?: LiquidationDocument | null;
  existingLiquidations?: LiquidationDocument[];
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

function getFileTypeCategory(fileName: string, mimeType?: string): 'image' | 'pdf' | 'document' | 'spreadsheet' | 'other' {
  const name = fileName.toLowerCase();
  const mime = (mimeType || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|bmp|heic)$/i.test(name)) return 'image';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.doc') || name.endsWith('.docx') || name.endsWith('.rtf') || name.endsWith('.odt') || name.endsWith('.txt')) return 'document';
  if (name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv') || name.endsWith('.ods')) return 'spreadsheet';
  return 'other';
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeLineItems(items: ExpenseLineItem[]): ExpenseLineItem[] {
  return items.map((item, idx) => {
    let files: ReceiptAttachment[] = item.receiptFiles ? [...item.receiptFiles] : [];
    if (files.length === 0) {
      if (Array.isArray(item.receiptUrls) && item.receiptUrls.length > 0) {
        files = item.receiptUrls.map((url, uIdx) => ({
          id: `receipt-url-${uIdx}-${Date.now()}`,
          url,
          name: `Receipt File ${uIdx + 1}`,
          fileType: getFileTypeCategory(url),
        }));
      } else if (item.receiptUrl) {
        files = [
          {
            id: `legacy-${Date.now()}-${idx}`,
            url: item.receiptUrl,
            name: 'Receipt Attachment',
            fileType: getFileTypeCategory(item.receiptUrl),
          },
        ];
      }
    }
    return {
      ...item,
      receiptFiles: files,
      receiptUrls: files.map((f) => f.url),
      receiptUrl: files.length > 0 ? files[0].url : '',
    };
  });
}

export default function OfficerLiquidationModal({
  isOpen,
  onClose,
  orgId,
  orgName,
  userUid,
  userName,
  userRole,
  editingReport,
  existingLiquidations,
}: OfficerLiquidationModalProps) {
  const { events: allEvents } = useAllEvents();
  const { liquidations: allLiquidations } = useAllLiquidations();

  const liquidationsList = existingLiquidations || allLiquidations || [];

  // Set of eventIds that already have an active liquidation
  const liquidatedEventIds = useMemo(() => {
    const set = new Set<string>();
    liquidationsList.forEach((l) => {
      // Exclude voided or cancelled liquidations from blocking an event
      if (l.eventId && l.status !== 'voided' && (l.status as any) !== 'cancelled') {
        set.add(l.eventId);
      }
    });
    return set;
  }, [liquidationsList]);

  // Helper to calculate total budget from any budget property or budgetItems array
  const calculateEventBudget = (e: any): number => {
    if (typeof e.totalApprovedBudget === 'number' && e.totalApprovedBudget > 0) return e.totalApprovedBudget;
    if (typeof e.allocatedBudget === 'number' && e.allocatedBudget > 0) return e.allocatedBudget;
    if (typeof e.adminFeeOverride === 'number' && e.adminFeeOverride > 0) return e.adminFeeOverride;
    if (typeof e.totalExpectedCollection === 'number' && e.totalExpectedCollection > 0) return e.totalExpectedCollection;
    if (typeof e.suggestedFeePerStudent === 'number' && e.suggestedFeePerStudent > 0) return e.suggestedFeePerStudent;
    if (typeof e.totalBudget === 'number' && e.totalBudget > 0) return e.totalBudget;
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
  // 1. Only events belonging to role/org (Admin = institutional/SAO only; Officer = their club only)
  // 2. Only completed events (status/proposalStatus/lifecycleStatus === 'completed' or timing completed)
  // 3. Exclude if event already has a liquidation (unless editing that existing report)
  const eligibleEvents = useMemo(() => {
    if (allEvents.length === 0) return [];

    return allEvents.filter((e: any) => {
      if (!e || e.isDeleted === true) return false;

      // When editing an existing report, always preserve the event currently linked to it
      if (editingReport && editingReport.eventId === e.id) return true;

      const isEditingThisEvent = editingReport && editingReport.eventId === e.id;

      // Basic validity & non-cancellation / non-draft / non-rejected check
      const pStatus = (e.proposalStatus || '').toString().toLowerCase();
      const eStatus = (e.status || '').toString().toLowerCase();
      const lStatus = (e.lifecycleStatus || '').toString().toLowerCase();
      const isCancelled = e.isCancelled === true || pStatus === 'cancelled' || eStatus === 'cancelled' || lStatus === 'cancelled';
      const isDraft = pStatus === 'draft';
      const isRejected = pStatus === 'rejected' || eStatus === 'rejected';

      if (isCancelled || isDraft || isRejected) return false;

      // Completion check: Only completed events can be liquidated
      const timingStatus = getEventTimingStatus(e);
      const isCompleted =
        eStatus === 'completed' ||
        pStatus === 'completed' ||
        lStatus === 'completed' ||
        lStatus === 'concluded' ||
        (e as any).isConcluded === true ||
        timingStatus === 'completed';

      if (!isCompleted) return false;

      // Role & Organization ownership scoping
      if (userRole === 'admin') {
        // Admin events only: must not be an officer proposal, must be institutional/SAO
        if (e.isOfficerProposal === true || e.submittedByOfficer === true) return false;

        const isInstitutional =
          e.isOfficerProposal === false ||
          (e as any).isInstitutional === true ||
          (e as any).isDirectPublished === true ||
          e.createdByRole === 'admin' ||
          !e.hostingOrgId ||
          ['sas', 'sao', 'sas_admin', 'sao_admin', 'student affairs office', 'student affairs services'].includes(
            (e.hostingOrgId || '').toString().trim().toLowerCase()
          );

        if (!isInstitutional) return false;

        // Exclude events that originated from student club proposals
        const hasSubmittedHistory =
          Array.isArray(e.proposalHistory) &&
          e.proposalHistory.some((h: any) => h?.action === 'submitted' || h?.action === 'resubmitted');
        if (hasSubmittedHistory && e.isOfficerProposal !== false) return false;
      } else {
        // Officer events only: must belong to the officer's organization
        const cleanOrgId = (orgId || '').trim().toLowerCase();
        const cleanOrgName = (orgName || '').trim().toLowerCase();

        // Must not be an institutional / admin event
        const isInstitutional =
          e.isOfficerProposal === false ||
          (e as any).isInstitutional === true ||
          ['sas', 'sao', 'sas_admin', 'sao_admin', 'student affairs office', 'student affairs services'].includes(
            (e.hostingOrgId || '').toString().trim().toLowerCase()
          );
        if (isInstitutional) return false;

        // Must match officer's organization ID or Name
        const eventOrgIds = [
          e.hostingOrgId,
          e.organizationId,
          e.createdByOrgId,
          e.orgId,
          e.org,
          e.organization,
        ].filter(Boolean).map((v) => String(v).trim().toLowerCase());

        const eventOrgNames = [
          e.hostingOrgName,
          e.orgName,
        ].filter(Boolean).map((v) => String(v).trim().toLowerCase());

        const matchesOrg =
          (cleanOrgId && eventOrgIds.includes(cleanOrgId)) ||
          (cleanOrgName && eventOrgNames.includes(cleanOrgName));

        if (!matchesOrg) return false;
      }

      // Liquidation exclusivity check: if already liquidated or has a liquidation, exclude
      const hasLiquidation =
        liquidatedEventIds.has(e.id) ||
        (e as any).isLiquidated === true ||
        (e as any).liquidationStatus === 'approved' ||
        (e as any).hasLiquidation === true;

      if (hasLiquidation && !isEditingThisEvent) {
        return false;
      }

      return true;
    });
  }, [allEvents, orgId, orgName, userRole, liquidatedEventIds, editingReport]);

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [allocatedBudget, setAllocatedBudget] = useState<number>(0);
  const [lineItems, setLineItems] = useState<ExpenseLineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightboxData, setLightboxData] = useState<{
    url: string;
    title: string;
    vendor?: string;
    amount?: number;
    fileName?: string;
    fileType?: string;
  } | null>(null);

  // Pre-fill if editing an existing / returned report
  useEffect(() => {
    if (editingReport) {
      setSelectedEventId(editingReport.eventId);
      setAllocatedBudget(editingReport.allocatedBudget || 0);
      setLineItems(normalizeLineItems(editingReport.lineItems || []));
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
          receiptUrls: [],
          receiptFiles: [],
        },
      ]);
    }
  }, [editingReport, isOpen]);

  // Update budget & auto-fetch budgetItems when event is selected
  const handleEventSelect = (eventId: string) => {
    setSelectedEventId(eventId);
    const event = eligibleEvents.find((e) => e.id === eventId) || allEvents.find((e) => e.id === eventId);
    if (event) {
      const budget = calculateEventBudget(event);
      setAllocatedBudget(budget);

      // Auto-fetch budgetItems from the event proposal if not editing existing report
      if (!editingReport && (event as any).budgetItems && (event as any).budgetItems.length > 0) {
        const fetchedItems: ExpenseLineItem[] = (event as any).budgetItems.map((bi: any, i: number) => {
          const allocatedCost = bi.approvedAmount || bi.quantity * bi.unitCost || bi.totalCost || 0;
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
            receiptUrls: [],
            receiptFiles: [],
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
        receiptUrls: [],
        receiptFiles: [],
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Upload one or more receipt files
  const handleReceiptUpload = async (index: number, files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploadingIndex(index);
    setError(null);

    try {
      const fileArray = Array.from(files);
      const newAttachments: ReceiptAttachment[] = [];

      for (const file of fileArray) {
        const res = await uploadToCloudinary(file, {
          folder: `liquidations/${selectedEventId || 'general'}`,
          acceptedTypes: ['*/*'],
        });

        newAttachments.push({
          id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          url: res.secureUrl,
          name: file.name,
          fileType: getFileTypeCategory(file.name, file.type),
          size: file.size,
          publicId: res.publicId,
        });
      }

      const updated = [...lineItems];
      const existingFiles = updated[index].receiptFiles || [];
      const mergedFiles = [...existingFiles, ...newAttachments];

      updated[index] = {
        ...updated[index],
        receiptFiles: mergedFiles,
        receiptUrls: mergedFiles.map((f) => f.url),
        receiptUrl: mergedFiles.length > 0 ? mergedFiles[0].url : '',
      };
      setLineItems(updated);
    } catch (err: any) {
      console.error('[OfficerLiquidationModal] Upload error:', err);
      setError(err?.message || 'Failed to upload receipt file(s). Please try again.');
    } finally {
      setUploadingIndex(null);
    }
  };

  // Remove a specific receipt file from an item
  const handleRemoveReceiptFile = (itemIndex: number, fileId: string) => {
    const updated = [...lineItems];
    const currentFiles = updated[itemIndex].receiptFiles || [];
    const filteredFiles = currentFiles.filter((f) => f.id !== fileId);

    updated[itemIndex] = {
      ...updated[itemIndex],
      receiptFiles: filteredFiles,
      receiptUrls: filteredFiles.map((f) => f.url),
      receiptUrl: filteredFiles.length > 0 ? filteredFiles[0].url : '',
    };
    setLineItems(updated);
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

    // Strict validation ONLY on final submission; save-as-draft is completely functional & flexible
    if (shouldSubmit) {
      if (lineItems.length === 0) {
        setError('Please add at least one expense line item before submitting.');
        return;
      }
      if (lineItems.some((item) => !item.description.trim())) {
        setError('Please provide a description for all expense line items before submitting.');
        return;
      }
      if (lineItems.some((item) => item.totalCost <= 0 || item.unitCost <= 0 || item.quantity <= 0)) {
        setError('All expense line items must have valid quantity, unit cost, and total cost greater than 0.');
        return;
      }
      const missingReceipts = lineItems.some(
        (item) =>
          (!item.receiptFiles || item.receiptFiles.length === 0) &&
          (!item.receiptUrls || item.receiptUrls.length === 0) &&
          !item.receiptUrl
      );
      if (missingReceipts) {
        setError('Please attach at least one valid receipt or proof document for every expense line item before submitting.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const selectedEvent = eligibleEvents.find((e) => e.id === selectedEventId) || allEvents.find((e) => e.id === selectedEventId);
      const eventTitle = selectedEvent ? selectedEvent.title : editingReport?.eventTitle || 'Event Liquidation';

      const isAdmin = userRole === 'admin';
      const nextStatus = shouldSubmit ? (isAdmin ? 'approved' : 'pending') : 'draft';

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
        toast.success(
          shouldSubmit
            ? (isAdmin ? 'Liquidation report approved and posted to ledger.' : 'Liquidation report submitted successfully for review.')
            : 'Draft liquidation report updated successfully.'
        );
      } else {
        await createLiquidationReport(payload);
        toast.success(
          shouldSubmit
            ? (isAdmin ? 'Liquidation report approved and posted to ledger.' : 'Liquidation report submitted successfully for review.')
            : 'Draft liquidation report saved successfully.'
        );
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
        <div className="px-6 py-4 bg-[#001A4D] text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {editingReport ? 'Edit Financial Liquidation Report' : 'Create Liquidation Report'}
            </h2>
            <p className="text-xs text-white/80 mt-0.5">
              Submit actual spendings, attach multiple receipt proofs/documents, and verify budget variance.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white cursor-pointer"
          >
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

          {/* Empty State Warning Alert */}
          {eligibleEvents.length === 0 && !editingReport && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">No eligible completed events found</span>
                <p className="text-amber-800 mt-0.5">
                  {userRole === 'admin'
                    ? 'Only concluded institutional / SAO events that have not yet been liquidated are available for administrative liquidation.'
                    : 'Only concluded events belonging to your organization that have not yet been liquidated are available for liquidation submission.'}
                </p>
              </div>
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
                disabled={!!editingReport || eligibleEvents.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] disabled:bg-gray-100 disabled:text-gray-500"
              >
                {eligibleEvents.length === 0 ? (
                  <option value="">No completed, unliquidated events available</option>
                ) : (
                  <>
                    <option value="">Select a completed event ({eligibleEvents.length} available)...</option>
                    {eligibleEvents.map((evt) => (
                      <option key={evt.id} value={evt.id}>
                        {evt.title} ({evt.eventFormat || 'Campus'})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Approved Budget Ceiling (Allocated)
                </label>
                <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Lock className="w-3 h-3 text-gray-400" /> Read-only
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₱</span>
                <input
                  type="number"
                  value={allocatedBudget}
                  readOnly
                  disabled
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 bg-gray-100/90 cursor-not-allowed select-none focus:outline-none"
                  placeholder="0.00"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Locked to the official approved budget ceiling for the linked event.
              </p>
            </div>
          </div>

          {/* Live Financial Variance Summary Card */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-white border border-gray-100 rounded-lg shadow-xs">
              <div className="text-xs text-gray-500 font-medium">Approved Budget</div>
              <div className="text-lg font-bold text-[#001A4D] mt-1">{formatCurrency(allocatedBudget)}</div>
            </div>

            <div className="p-3 bg-white border border-gray-100 rounded-lg shadow-xs">
              <div className="text-xs text-gray-500 font-medium">Total Actual Spendings</div>
              <div className="text-lg font-bold text-[#0E4EBD] mt-1">{formatCurrency(totalActualSpending)}</div>
            </div>

            <div
              className={`p-3 bg-white border rounded-lg shadow-xs ${
                isDeficit ? 'border-red-200' : 'border-green-200'
              }`}
            >
              <div className="text-xs text-gray-500 font-medium">
                {isDeficit ? 'Net Deficit (Over Budget)' : 'Net Surplus (Remaining)'}
              </div>
              <div className={`text-lg font-bold mt-1 ${isDeficit ? 'text-red-600' : 'text-green-600'}`}>
                {formatVariance(surplusOrDeficit)}
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[#001A4D]">Expense Line Items & Receipts</h3>
              <button
                onClick={handleAddLineItem}
                className="px-3 py-1.5 bg-[#1E70E8] text-white text-xs font-medium rounded-lg hover:bg-[#0E4EBD] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Line Item
              </button>
            </div>

            <div className="space-y-4">
              {lineItems.map((item, index) => {
                const attachedFiles = item.receiptFiles || [];

                return (
                  <div
                    key={item.id}
                    className="p-4 border border-gray-200 rounded-xl bg-white space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Item #{index + 1}
                        </span>
                        {item.isPreFilled && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-[#0E4EBD] rounded border border-blue-200 uppercase">
                            Proposal Budget Item
                          </span>
                        )}
                        {item.allocatedCost !== undefined && item.allocatedCost > 0 && (
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
                            Allocated: {formatCurrency(item.allocatedCost)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {item.allocatedCost !== undefined && item.allocatedCost > 0 && (
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded ${
                              item.allocatedCost - item.totalCost < 0
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {item.allocatedCost - item.totalCost < 0
                              ? `Item Deficit (-${formatCurrency(Math.abs(item.allocatedCost - item.totalCost))})`
                              : `Item Surplus (+${formatCurrency(item.allocatedCost - item.totalCost)})`}
                          </span>
                        )}
                        {!item.isPreFilled && lineItems.length > 1 && (
                          <button
                            onClick={() => handleRemoveLineItem(index)}
                            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
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
                          className={`w-full px-3 py-1.5 border border-gray-300 rounded text-sm ${
                            item.isPreFilled
                              ? 'bg-gray-100 font-semibold text-gray-700 cursor-not-allowed'
                              : 'focus:ring-1 focus:ring-[#0E4EBD]'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Category</label>
                        <select
                          value={item.category}
                          disabled={item.isPreFilled}
                          onChange={(e) => handleLineItemChange(index, 'category', e.target.value)}
                          className={`w-full px-3 py-1.5 border border-gray-300 rounded text-sm ${
                            item.isPreFilled
                              ? 'bg-gray-100 font-semibold text-gray-700 cursor-not-allowed'
                              : 'focus:ring-1 focus:ring-[#0E4EBD]'
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
                      <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-3">
                          <div>
                            <span className="text-gray-500 font-medium">Proposed Baseline:</span>
                            <span className="ml-1.5 font-bold text-[#001A4D]">
                              {item.proposedQuantity || item.quantity || 1} Qty ×{' '}
                              {formatCurrency(item.proposedUnitCost || 0)} = {formatCurrency(item.allocatedCost || 0)}
                            </span>
                          </div>
                          <span className="text-blue-300 hidden sm:inline">|</span>
                          <div>
                            <span className="text-gray-500 font-medium">Actual Input:</span>
                            <span className="ml-1.5 font-bold text-[#0E4EBD]">
                              {item.quantity} Qty × {formatCurrency(item.unitCost)} = {formatCurrency(item.totalCost)}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                            (item.allocatedCost || 0) - item.totalCost < 0
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {(item.allocatedCost || 0) - item.totalCost < 0
                            ? `Deficit: -${formatCurrency(Math.abs((item.allocatedCost || 0) - item.totalCost))}`
                            : `Surplus: +${formatCurrency((item.allocatedCost || 0) - item.totalCost)}`}
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
                          className="w-full px-3 py-1.5 border border-gray-200 bg-gray-50 rounded text-sm font-bold text-[#0E4EBD]"
                        />
                      </div>
                    </div>

                    {/* Vendor Name & Multi-Receipt Upload Section */}
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Vendor / Store Name *</label>
                          <input
                            type="text"
                            value={item.vendorName}
                            onChange={(e) => handleLineItemChange(index, 'vendorName', e.target.value)}
                            placeholder="e.g. Jollibee Ormoc, National Book Store"
                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Receipt / Invoice Ref Number (Optional)</label>
                          <input
                            type="text"
                            value={item.receiptNumber || ''}
                            onChange={(e) => handleLineItemChange(index, 'receiptNumber', e.target.value)}
                            placeholder="e.g. OR #104928"
                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      </div>

                      {/* Multi-file Receipt Proof Attachments */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-gray-700">
                            Receipts & Proof Documents ({attachedFiles.length})
                          </label>
                          <span className="text-[11px] text-gray-500">
                            Allowed: Images (PNG/JPG), PDF, Word, Excel/CSV, Text
                          </span>
                        </div>

                        {/* List of uploaded receipt files */}
                        {attachedFiles.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                            {attachedFiles.map((file) => {
                              const isImg = file.fileType === 'image';
                              const isPdf = file.fileType === 'pdf';
                              const isSheet = file.fileType === 'spreadsheet';
                              const isDoc = file.fileType === 'document';

                              return (
                                <div
                                  key={file.id}
                                  className="flex items-center justify-between gap-2 p-2 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-lg transition-colors group/file text-xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {isImg ? (
                                      <div className="w-7 h-7 rounded border border-gray-200 overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                                        <img
                                          src={file.url}
                                          alt={file.name}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                          }}
                                        />
                                      </div>
                                    ) : isPdf ? (
                                      <div className="w-7 h-7 rounded bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 border border-red-200">
                                        <FileText className="w-4 h-4" />
                                      </div>
                                    ) : isSheet ? (
                                      <div className="w-7 h-7 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-200">
                                        <FileSpreadsheet className="w-4 h-4" />
                                      </div>
                                    ) : isDoc ? (
                                      <div className="w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-200">
                                        <FileText className="w-4 h-4" />
                                      </div>
                                    ) : (
                                      <div className="w-7 h-7 rounded bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0 border border-gray-200">
                                        <File className="w-4 h-4" />
                                      </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                      <div
                                        className="font-semibold text-gray-800 truncate"
                                        title={file.name}
                                      >
                                        {file.name}
                                      </div>
                                      <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
                                        <span className="uppercase">{file.fileType}</span>
                                        {file.size ? (
                                          <>
                                            <span>•</span>
                                            <span>{formatFileSize(file.size)}</span>
                                          </>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setLightboxData({
                                          url: file.url,
                                          title: item.description || 'Receipt File',
                                          vendor: item.vendorName,
                                          amount: item.totalCost,
                                          fileName: file.name,
                                          fileType: file.fileType,
                                        })
                                      }
                                      className="p-1 text-gray-500 hover:text-[#0E4EBD] hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                      title="Preview Receipt"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>

                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 text-gray-500 hover:text-[#0E4EBD] hover:bg-blue-50 rounded transition-colors"
                                      title="Open in new tab"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveReceiptFile(index, file.id)}
                                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                      title="Remove file"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Upload trigger button / dropzone */}
                        <label className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 hover:border-[#1E70E8] rounded-xl hover:bg-blue-50/40 text-xs font-semibold text-gray-700 transition-colors">
                          {uploadingIndex === index ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-[#0E4EBD]" />
                              <span className="text-[#0E4EBD]">Uploading files to secure storage...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 text-[#1E70E8]" />
                              <span>
                                {attachedFiles.length > 0 ? '+ Upload Additional Receipts / Files' : 'Upload Receipt Files (Select multiple files)'}
                              </span>
                            </>
                          )}
                          <input
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf"
                            disabled={uploadingIndex === index}
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleReceiptUpload(index, e.target.files);
                                e.target.value = ''; // Reset input
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            * All liquidations require receipt proof/invoices for validation.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-lg text-sm font-bold transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin text-[#FFD41C]" />}
              Submit Liquidation
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox / Document Viewer */}
      {lightboxData && (
        <ReceiptLightboxModal
          isOpen={!!lightboxData}
          onClose={() => setLightboxData(null)}
          imageUrl={lightboxData.url}
          itemTitle={lightboxData.title}
          vendorName={lightboxData.vendor}
          amount={lightboxData.amount}
          fileName={lightboxData.fileName}
          fileType={lightboxData.fileType}
        />
      )}
    </div>
  );
}

