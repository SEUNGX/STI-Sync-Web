import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft, Download, Clock, CheckCircle, CheckCircle2, XCircle, RotateCcw,
  Calendar, Users, Shield, Receipt, FileText, History,
  ChevronRight, Eye, Send, Gavel, Check, X, AlertTriangle, AlertCircle, Rocket,
  FileImage, Coins, FolderArchive, Trash2
} from 'lucide-react';
import type { EventDocument } from '../../modules/events/types/event.types';
import { approveEvent, rejectEvent, returnEvent, updateAdviserRemarks } from '../../modules/events/services/event.service';
import {
  CancelEventModal,
  canCancelEvent,
  ConcludeEventModal,
  ArchiveEventModal,
  DeleteArchivedEventModal,
  getEventTimingStatus
} from '../../modules/events';
import { useAdviserProfile } from '../../modules/auth/hooks/useAdviserProfile';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useEventTypesStream, useVenuesStream } from '../../modules/events/hooks/useEventConfigStream';
import { useDepartments } from '../../modules/academic/hooks/useAcademicStream';
import { EventPayablesQRControl } from '../../modules/finance/components/EventPayablesQRControl';
import { exportEventProposalPDF } from '../../modules/events/utils/event-proposal-pdf';
import { formatCurrency } from '../../utils/currency';
import { formatAppDate, formatAppDateTime, formatSessionDateTime } from '../../utils/date';

interface EventProposalReviewProps {
  event: EventDocument;
  onClose: () => void;
}

type Decision = 'none' | 'approved' | 'returned' | 'rejected';
type ActiveModal = 'none' | 'approve' | 'return' | 'reject';

const NAV_SECTIONS = [
  { id: 'overview', icon: FileText, label: 'Event Overview' },
  { id: 'schedule', icon: Calendar, label: 'Schedule & Sessions' },
  { id: 'participants', icon: Users, label: 'Target Audience' },
  { id: 'team', icon: Shield, label: 'Event Staff & Scanners' },
  { id: 'budget', icon: Receipt, label: 'Budget & Line Items' },
  { id: 'documents', icon: FileImage, label: 'Submitted Documents' },
  { id: 'payables', icon: Coins, label: 'Payables & QR Tickets' },
  { id: 'history', icon: History, label: 'Remarks & History' },
];

const RETURN_FLAGS_GROUPED = [
  { flag: 'Event Information (title, description, objectives)', label: 'Step 1: Event Details (title, description, objectives)' },
  { flag: 'Schedule or Venue', label: 'Step 2: Schedule & Venue' },
  { flag: 'Participant Settings', label: 'Step 3: Participant Settings & Audience' },
  { flag: 'Event Team Assignment', label: 'Step 4: Event Team & Staff Assignment' },
  { flag: 'Budget Request', label: 'Step 5: Budget Request & Line Items' },
  { flag: 'Submitted Documents', label: 'Step 6: Submitted Documents' },
];

const REJECTION_REASONS = [
  'Fraudulent or Misleading Information',
  'Insufficient Documentation',
  'Budget Exceeds Approved Limit',
  'Scheduling or Venue Conflict',
  'Policy Violation',
  'Event Not Aligned with Institutional Goals',
  'Duplicate Event',
  'Other',
];

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-1.5 h-6 bg-[#001A4D] rounded-full" />
        <h3 className="text-[#001A4D] font-bold text-lg">{title}</h3>
      </div>
      <p className="text-gray-500 text-xs ml-4.5">{subtitle}</p>
      <div className="mt-3 border-b border-gray-200" />
    </div>
  );
}

export default function EventProposalReview({ event, onClose }: EventProposalReviewProps) {
  const [activeSection, setActiveSection] = useState('overview');
  const [visitedSections, setVisitedSections] = useState<Set<string>>(new Set(['overview']));
  const [remarks, setRemarks] = useState(event.adviserRemarks || '');
  const [remarksError, setRemarksError] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Return modal state
  const [returnFlags, setReturnFlags] = useState<string[]>(event.returnFlags || []);
  const [returnDeadline, setReturnDeadline] = useState(event.returnDeadline || '');

  // Reject modal state
  const [rejectionReason, setRejectionReason] = useState(event.rejectionReason || '');

  const { data: orgs } = useOrganizationStream();
  const { eventTypes } = useEventTypesStream();
  const { venues } = useVenuesStream();
  const { data: departments = [] } = useDepartments();
  const { profile } = useAdviserProfile();

  const isCancelled = event.isCancelled || event.lifecycleStatus === 'cancelled' || event.status === 'cancelled' || event.proposalStatus === 'cancelled';
  const cancelCheck = canCancelEvent(event, 'admin');

  const isApproved =
    event.proposalStatus === 'approved' ||
    event.status === 'approved' ||
    event.lifecycleStatus === 'approved';

  const isDecided =
    event.proposalStatus !== 'pending_review' &&
    event.proposalStatus !== 'pending' &&
    event.proposalStatus !== 'draft';

  const initialDecision: Decision =
    isApproved ? 'approved' :
    event.proposalStatus === 'rejected' ? 'rejected' :
    event.proposalStatus === 'returned' ? 'returned' : 'none';

  const [decision, setDecision] = useState<Decision>(initialDecision);
  const [showConcludeModal, setShowConcludeModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const timing = getEventTimingStatus(event);

  // Budget calculations
  const budgetItems = event.budgetItems || [];
  const totalRequested = budgetItems.reduce((s, i) => s + ((i.unitCost || 0) * (i.quantity || 0)), 0);
  const totalApproved = budgetItems.reduce((s, i) => s + (Number(i.approvedAmount || ((i.unitCost || 0) * (i.quantity || 0)))), 0);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const centerRef = useRef<HTMLDivElement>(null);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    setVisitedSections(prev => new Set([...prev, id]));
    const el = sectionRefs.current[id];
    if (el && centerRef.current) {
      centerRef.current.scrollTo({ top: el.offsetTop - 24, behavior: 'smooth' });
    }
  };

  const navItems = NAV_SECTIONS.filter(s => {
    if (s.id === 'payables') {
      return (isApproved || isCancelled) && event.studentPayablesEnabled !== false;
    }
    return true;
  });

  const allVisited = navItems.every(s => visitedSections.has(s.id));
  const remarksWritten = remarks.trim().length > 0;

  const [savingRemarks, setSavingRemarks] = useState(false);

  const handleSaveRemarks = async () => {
    if (!event?.id) return;
    setSavingRemarks(true);
    try {
      await updateAdviserRemarks(event.id, remarks);
      toast.success('Adviser remarks updated successfully!');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to save remarks.');
    } finally {
      setSavingRemarks(false);
    }
  };

  const handleDecision = (type: 'approve' | 'return' | 'reject') => {
    setRemarksError(false);
    if (type === 'approve') {
      confirmApprove();
    } else {
      setActiveModal(type);
    }
  };

  const confirmApprove = async () => {
    if (!profile?.uid) {
      toast.error('SAO Admin authentication is required to approve proposals. Please re-login as Admin.');
      return;
    }
    setSubmitting(true);
    try {
      await approveEvent(event.id, profile.uid, remarks || '');
      setDecision('approved');
      setActiveModal('none');
      toast.success('Proposal approved successfully!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to approve proposal.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmReject = async () => {
    if (!profile?.uid) {
      toast.error('SAO Admin authentication is required to reject proposals. Please re-login as Admin.');
      return;
    }
    if (!rejectionReason) {
      toast.error('Please select a rejection reason category.');
      return;
    }
    if (!remarks.trim()) {
      setRemarksError(true);
      toast.error('Please provide remarks/feedback for the officer explaining the rejection.');
      return;
    }
    setSubmitting(true);
    try {
      await rejectEvent(event.id, profile.uid, rejectionReason, remarks, false);
      setDecision('rejected');
      setActiveModal('none');
      toast.success('Proposal rejected successfully.');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to reject proposal.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmReturn = async () => {
    if (!profile?.uid) {
      toast.error('SAO Admin authentication is required to return proposals. Please re-login as Admin.');
      return;
    }
    if (returnFlags.length === 0) {
      toast.error('Please select at least one flagged item to correct.');
      return;
    }
    if (!remarks.trim()) {
      setRemarksError(true);
      toast.error('Please provide remarks explaining what needs to be revised.');
      return;
    }
    setSubmitting(true);
    try {
      await returnEvent(event.id, profile.uid, returnFlags, returnDeadline, remarks);
      setDecision('returned');
      setActiveModal('none');
      toast.success('Proposal returned for revision.');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to return proposal.');
    } finally {
      setSubmitting(false);
    }
  };

  const isSas = !event.hostingOrgId || event.hostingOrgId === 'sas';
  const orgObj = orgs.find(o => o.id === event.hostingOrgId);
  const orgName = isSas ? 'Student Affairs & Services (SAS)' : (orgObj?.name || event.hostingOrgId || 'Student Organization');
  const orgAcronym = isSas ? 'SAS' : (orgObj?.acronym || 'Club');
  const orgLogo = isSas ? null : (orgObj?.logoUrl || orgObj?.logo || null);
  const eventTypeName = eventTypes.find(t => t.id === event.eventTypeId)?.name || 'General Event';
  const venueObj = venues.find(v => v.id === event.venueId);
  const venueName = venueObj ? venueObj.name : event.customVenueName || event.venueId || 'On-Campus Venue';

  const createdDate = formatAppDate(event.createdAt, 'N/A');

  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      await exportEventProposalPDF(event, {
        org: orgObj,
        eventTypeName,
        venueName,
        approverName: profile?.displayName || 'SAO Head',
      });
      toast.success('Event proposal PDF exported successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to export PDF proposal.');
    } finally {
      setExportingPdf(false);
    }
  };

  const statusColors: Record<string, { bg: string; text: string; label: string; icon: any }> = {
    draft: { bg: 'bg-gray-100 text-gray-700 border-gray-300', text: 'text-gray-700', label: 'Draft Proposal', icon: Clock },
    pending: { bg: 'bg-amber-50 text-amber-800 border-amber-300', text: 'text-amber-700', label: 'Pending Review', icon: Clock },
    pending_review: { bg: 'bg-amber-50 text-amber-800 border-amber-300', text: 'text-amber-700', label: 'Pending Review', icon: Clock },
    approved: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-300', text: 'text-emerald-700', label: 'Approved & Active', icon: CheckCircle2 },
    completed: { bg: 'bg-blue-50 text-blue-800 border-blue-300', text: 'text-blue-700', label: 'Completed Event', icon: CheckCircle2 },
    returned: { bg: 'bg-amber-50 text-amber-800 border-amber-300', text: 'text-amber-700', label: 'Returned for Revision', icon: RotateCcw },
    rejected: { bg: 'bg-red-50 text-red-800 border-red-300', text: 'text-red-700', label: 'Rejected Proposal', icon: XCircle },
    cancelled: { bg: 'bg-red-50 text-red-800 border-red-300', text: 'text-red-700', label: 'Cancelled Event', icon: XCircle },
  };

  const currentStatusKey = isCancelled
    ? 'cancelled'
    : (event.proposalStatus || (isApproved ? 'approved' : 'draft')).toLowerCase();
  const currentStatus = statusColors[currentStatusKey] || statusColors.draft;
  const StatusIcon = currentStatus.icon;

  const targetDeptNames = (event.targetDepartmentIds || [])
    .map((dId) => {
      const match = departments.find((d) => d.id === dId || d.code === dId);
      return match ? `${match.name} (${match.code})` : dId;
    })
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Top Navigation Bar — Clean Navy Look */}
      <header className="h-16 bg-[#001A4D] border-b border-[#0E4EBD]/30 flex items-center justify-between px-6 flex-shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Event Approvals</span>
          </button>
          <div className="h-5 w-px bg-white/20" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#FFD41C]">
                {event.referenceId || 'EVT-PROP'}
              </span>
              <span className="text-white/40">·</span>
              <span className="text-white font-bold text-sm truncate max-w-[280px] lg:max-w-md">
                {event.title}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${currentStatus.bg}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{currentStatus.label}</span>
          </div>

          {/* Export PDF */}
          <button
            onClick={handleExportPDF}
            disabled={exportingPdf}
            className="px-3.5 py-1.5 bg-[#FFD41C] text-[#001A4D] hover:bg-amber-400 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exportingPdf ? 'Exporting...' : 'Export PDF'}</span>
          </button>

          {/* Conclude Event Action (if approved and not yet completed) */}
          {event.proposalStatus === 'approved' && event.status !== 'completed' && !event.isArchived && (
            <button
              type="button"
              onClick={() => setShowConcludeModal(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Conclude event and lock attendance scanner"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Conclude Event</span>
            </button>
          )}

          {/* Archive Event Action (if completed and not archived) */}
          {(event.status === 'completed' || event.proposalStatus === 'completed' || timing === 'completed') && !event.isArchived && (
            <button
              type="button"
              onClick={() => setShowArchiveModal(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Archive completed event"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Archive Event</span>
            </button>
          )}

          {/* Delete Action (if already archived) */}
          {event.isArchived && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Delete archived event"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Event</span>
            </button>
          )}

          {/* Cancel Event Action */}
          {!isCancelled && cancelCheck.canCancel && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Cancel this event and auto-waive student liabilities"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Cancel Event</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main 3-Pane Layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar: Section Navigator */}
        <aside className="w-64 lg:w-72 flex-shrink-0 border-r border-gray-200 bg-gray-50/70 flex flex-col overflow-y-auto p-4 space-y-6">
          {/* Organization / Issuer Badge */}
          <div className="p-3.5 bg-white border border-gray-200 rounded-xl shadow-xs">
            <div className="flex items-center gap-2.5">
              {isSas ? (
                <div className="w-9 h-9 rounded-lg bg-[#001A4D] flex items-center justify-center text-[#FFD41C] font-bold text-xs shadow-xs">
                  SAS
                </div>
              ) : orgLogo ? (
                <img
                  src={orgLogo}
                  alt={orgAcronym}
                  className="w-9 h-9 rounded-lg object-cover border border-blue-200 shadow-xs"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] flex items-center justify-center text-white font-bold text-xs shadow-xs">
                  {orgAcronym.slice(0, 3)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 truncate">{orgName}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {isSas ? 'Student Affairs & Services' : (event.createdByName || 'Student Officer')}
                </p>
              </div>
            </div>
          </div>

          {/* Section Navigation List */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">
              Proposal Sections
            </p>
            {navItems.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;

              return (
                <button
                  key={sec.id}
                  onClick={() => scrollTo(sec.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left relative cursor-pointer ${
                    isActive
                      ? 'bg-blue-50/80 text-[#0E4EBD] shadow-xs'
                      : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#0E4EBD] rounded-r-full" />
                  )}
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? 'text-[#0E4EBD]' : 'text-gray-400'
                    }`}
                  />
                  <span className="flex-1 truncate">{sec.label}</span>
                  {sec.id === 'payables' && (
                    <span className="px-1.5 py-0.2 bg-[#001A4D] text-white text-[10px] font-bold rounded-full">
                      Payables
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Review Progress (For pending proposals) */}
          {!isApproved && !isCancelled && (
            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-xs">
              <div className="flex items-center gap-2 mb-2.5">
                <CheckCircle className="w-4 h-4 text-[#0E4EBD]" />
                <span className="text-[#001A4D] font-bold text-xs">Review Progress</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Viewed all sections', done: allVisited },
                  { label: 'Remarks entered', done: remarksWritten },
                  { label: 'Decision chosen', done: decision !== 'none' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${item.done ? 'bg-[#0E4EBD] border-[#0E4EBD]' : 'border-gray-300'}`}>
                      {item.done && <Check className="w-2 h-2 text-white" />}
                    </div>
                    <span className={`text-[11px] ${item.done ? 'text-[#001A4D] font-semibold' : 'text-gray-500'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Notice Card */}
          <div className="p-3.5 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-xl text-white text-xs space-y-2 mt-auto shadow-xs">
            <div className="flex items-center gap-1.5 text-[#FFD41C] font-bold">
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Oversight</span>
            </div>
            <p className="text-[11px] text-white/80 leading-relaxed">
              Official institutional record. Approvals release event listings, gate tickets, and budget line allocations.
            </p>
          </div>
        </aside>

        {/* Center Column: Proposal Content */}
        <main ref={centerRef} className="flex-1 overflow-y-auto bg-gray-50/30 p-6 lg:p-8 space-y-8">
          {isCancelled ? (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-red-900 text-base">This Event has been Cancelled</h3>
                  {event.refundPolicy && (
                    <span className="text-xs px-2.5 py-1 bg-red-200 text-red-800 font-semibold rounded-full uppercase tracking-wider">
                      Refund Policy: {event.refundPolicy.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-red-800 mt-2">
                  <span className="font-semibold text-red-900">Cancellation Reason:</span> {event.cancellationReason || 'No reason specified'}
                </p>
                <div className="text-xs text-red-600 mt-2 flex flex-wrap items-center gap-3">
                  <span>Cancelled by: <strong className="text-red-700">{event.cancelledBy || 'SAO Administrator'}</strong></span>
                  {event.cancelledAt && <span>• {formatAppDateTime(event.cancelledAt)}</span>}
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    ✓ All pending student payables/fines waived
                  </span>
                </div>
              </div>
            </div>
          ) : isDecided && !isApproved ? (
            <div className={`p-4 rounded-xl border-l-4 ${decision === 'rejected' ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-500'}`}>
              <p className="text-sm font-bold text-gray-800">
                {decision === 'rejected' ? `This proposal was Rejected on ${formatAppDate(event.rejectedAt, 'N/A')}. Reason: ${event.rejectionReason}` :
                 `This proposal was Returned on ${formatAppDate(event.returnedAt, 'N/A')}.`}
              </p>
            </div>
          ) : null}

          {/* SECTION 1 — EVENT OVERVIEW */}
          <section
            ref={el => { sectionRefs.current['overview'] = el; }}
            onMouseEnter={() => { setActiveSection('overview'); setVisitedSections(p => new Set([...p, 'overview'])); }}
            className="space-y-4"
          >
            <SectionHeader title="1. Event Overview" subtitle="Event identity, classification, and media assets submitted by the officer" />
            
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
              {event.bannerImageUrl ? (
                <div className="h-56 sm:h-72 w-full overflow-hidden bg-slate-900 relative">
                  <img
                    src={event.bannerImageUrl}
                    alt={event.title || 'Event Banner'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
                  <div className="absolute bottom-3 left-3 text-white flex items-center gap-2">
                    <span className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-xs font-bold border border-white/20">
                      Event Banner
                    </span>
                    <span className="px-3 py-1 bg-[#0E4EBD]/80 backdrop-blur-md rounded-full text-xs font-bold border border-white/20">
                      {eventTypeName}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-44 bg-gradient-to-br from-[#001A4D] via-[#002B7F] to-[#0E4EBD] flex items-center justify-center">
                  <div className="text-center">
                    <FileImage className="w-12 h-12 text-white/40 mx-auto mb-2" />
                    <p className="text-white/50 text-sm">No banner uploaded</p>
                  </div>
                </div>
              )}
              <div className="p-6">
                {/* Highlighted Event Title Banner */}
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50/80 via-white to-amber-50/40 rounded-xl border-l-4 border-[#0E4EBD] shadow-xs">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E4EBD]">
                      Official Event Title
                    </span>
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 bg-[#FFD41C] text-[#001A4D] rounded-md">
                      {event.referenceId || 'EVT-REF'}
                    </span>
                  </div>
                  <h1 className="text-2xl font-extrabold text-[#001A4D] tracking-tight">
                    {event.title}
                  </h1>
                  {event.tagline && (
                    <p className="text-sm font-semibold text-[#0E4EBD] mt-1 italic">
                      "{event.tagline}"
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase text-gray-400 font-bold mb-1.5">Description</p>
                      <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50/80 p-3.5 rounded-xl border border-gray-100">
                        {event.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 bg-gray-50/60 p-4 rounded-xl border border-gray-200/70">
                    {/* Host */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500 text-xs font-medium">
                        {isSas ? 'Issuer / Host' : 'Host Organization'}
                      </span>
                      <div className="flex items-center gap-2">
                        {isSas ? (
                          <div className="w-5 h-5 bg-[#001A4D] text-[#FFD41C] rounded-full flex items-center justify-center text-[9px] font-bold">
                            SAS
                          </div>
                        ) : orgLogo ? (
                          <img src={orgLogo} alt={orgAcronym} className="w-5 h-5 rounded-full object-cover border" />
                        ) : (
                          <div className="w-5 h-5 bg-[#001A4D] rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                            {orgAcronym.charAt(0)}
                          </div>
                        )}
                        <span className="text-[#001A4D] font-bold text-xs">{orgName}</span>
                      </div>
                    </div>

                    {/* Event Type */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500 text-xs font-medium">Event Type</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-[#0E4EBD]">
                        {eventTypeName}
                      </span>
                    </div>

                    {/* QR Tickets */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500 text-xs font-medium">QR Gate Tickets</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        event.enableQRTickets !== false ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {event.enableQRTickets !== false ? 'Enabled (Option A)' : 'Disabled'}
                      </span>
                    </div>

                    {/* Feed Visibility */}
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-500 text-xs font-medium">Feed Visibility</span>
                      <span className="font-bold text-xs text-gray-800">
                        {event.isVisible !== false ? 'Visible in Student App' : 'Hidden'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Objectives */}
            {event.objectives && event.objectives.length > 0 && (
              <div className="bg-blue-50/60 border-l-4 border-[#0E4EBD] rounded-xl p-4 shadow-xs">
                <p className="text-[#001A4D] font-bold text-sm mb-3">Event Objectives</p>
                <div className="space-y-2">
                  {event.objectives.map((obj, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-[#0E4EBD] text-white rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                      <p className="text-[#001A4D] text-sm">{obj}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* SECTION 2 — SCHEDULE & VENUE */}
          <section
            ref={el => { sectionRefs.current['schedule'] = el; }}
            onMouseEnter={() => { setActiveSection('schedule'); setVisitedSections(p => new Set([...p, 'schedule'])); }}
            className="space-y-4"
          >
            <SectionHeader title="2. Schedule & Venue Logistics" subtitle="Academic context, session schedule, and venue logistics" />
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
                <div className="grid grid-cols-2 divide-x divide-gray-200">
                  {[
                    { label: 'School Year', value: event.schoolYear || 'N/A' },
                    { label: 'Submitted Date', value: createdDate },
                  ].map(c => (
                    <div key={c.label} className="px-5 first:pl-0 last:pr-0 text-center">
                      <p className="text-xs uppercase text-gray-400 font-semibold mb-1">{c.label}</p>
                      <p className="text-[#001A4D] font-bold text-base">{c.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sessions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-[#001A4D] font-bold text-sm">Event Sessions</p>
                  <span className="px-2.5 py-0.5 bg-[#001A4D] text-[#FFD41C] text-xs rounded-full font-bold">{event.sessions?.length || 0} Sessions</span>
                </div>
                <div className="space-y-3">
                  {(event.sessions || []).map((s, i) => (
                    <div key={s.id || i} className="border-l-4 border-[#0E4EBD] bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[#0E4EBD] font-black text-xs uppercase tracking-wider">Session {i + 1}</span>
                        <span className="text-[#001A4D] font-extrabold text-base">{s.title || `Session ${i + 1}`}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-800 font-bold">
                        <Calendar className="w-4 h-4 text-[#0E4EBD]" />
                        <span>{formatSessionDateTime(s.date, s.startTime, s.endTime)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Venue & Academic Period */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs uppercase text-gray-400 font-bold mb-1">Requested Venue</p>
                    <p className="text-[#001A4D] font-bold text-base">{venueName}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 font-bold mb-1">Academic Period</p>
                    <p className="text-[#0E4EBD] font-bold text-sm">
                      {event.schoolYear || 'SY 2025–2026'} · {event.semester || 'Active Semester'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3 — PARTICIPANTS */}
          <section
            ref={el => { sectionRefs.current['participants'] = el; }}
            onMouseEnter={() => { setActiveSection('participants'); setVisitedSections(p => new Set([...p, 'participants'])); }}
            className="space-y-4"
          >
            <SectionHeader title="3. Target Audience & Attendance" subtitle="Target audience, reach estimate, and attendance configuration" />
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
                <div className="grid grid-cols-2 divide-x divide-gray-200">
                  {[
                    { label: 'Expected Attendance', value: event.expectedParticipantCount || 0 },
                    { label: 'Student Payables', value: event.studentPayablesEnabled ? `${formatCurrency(event.suggestedFeePerStudent || 0)} / student` : 'Disabled / Free' },
                  ].map(c => (
                    <div key={c.label} className="px-5 first:pl-0 last:pr-0 text-center">
                      <p className="text-xs uppercase text-gray-400 font-semibold mb-1">{c.label}</p>
                      <p className="text-[#001A4D] font-bold text-xl">{c.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4 shadow-xs">
                <div>
                  <p className="text-xs uppercase text-gray-400 font-semibold mb-2">Target Year Levels</p>
                  <div className="flex flex-wrap gap-2">
                    {(event.targetYearLevels || []).map(y => (
                      <span key={y} className="px-3 py-1 bg-[#001A4D] text-[#FFD41C] text-xs rounded-full font-medium">{y}</span>
                    ))}
                    {(!event.targetYearLevels || event.targetYearLevels.length === 0) && (
                      <span className="text-xs text-gray-500 italic">All year levels eligible</span>
                    )}
                  </div>
                </div>

                {targetDeptNames.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs uppercase text-gray-400 font-semibold mb-2">Target Academic Departments</p>
                    <div className="flex flex-wrap gap-2">
                      {targetDeptNames.map((d, i) => (
                        <span key={i} className="px-3 py-1 bg-blue-50 text-[#0E4EBD] border border-blue-200 text-xs rounded-full font-semibold">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 4 — TEAM */}
          <section
            ref={el => { sectionRefs.current['team'] = el; }}
            onMouseEnter={() => { setActiveSection('team'); setVisitedSections(p => new Set([...p, 'team'])); }}
            className="space-y-4"
          >
            <SectionHeader title="4. Event Staff & Scanner Officers" subtitle="Proposed core team members and scanner officer assignments" />
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                  <p className="text-[#001A4D] font-bold text-sm">Scanner Officers</p>
                  {event.enableQRTickets !== false && (event as any).enableQR !== false ? (
                    <span className="px-2.5 py-0.5 bg-[#001A4D] text-[#FFD41C] text-xs rounded-full font-bold">{(event.scanners || []).length} Assigned</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full font-medium uppercase">QR Disabled</span>
                  )}
                </div>
                {event.enableQRTickets !== false && (event as any).enableQR !== false ? (
                  (event.scanners || []).length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {(event.scanners || []).map((scanner, i) => (
                        <div key={scanner.id || i} className="px-5 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-[#001A4D] font-semibold text-sm">{scanner.officerName || 'Unnamed Officer'}</p>
                            <p className="text-gray-400 text-xs mt-0.5">Student ID: {scanner.officerUserId || 'Not linked'}</p>
                          </div>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {scanner.fullAccess && <span className="px-2 py-0.5 bg-blue-50 text-[#0E4EBD] border border-blue-100 text-xs font-semibold rounded-full">Full Access</span>}
                            {!scanner.fullAccess && scanner.canCheckIn && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">Check-In</span>}
                            {!scanner.fullAccess && scanner.canCheckOut && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full">Check-Out</span>}
                            {!scanner.fullAccess && scanner.canViewList && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">View List</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-gray-500">No scanner officers assigned.</div>
                  )
                ) : (
                  <div className="p-4 text-sm text-gray-500 italic">
                    QR Tickets & Attendance Scanning is disabled for this event. No scanner officers required.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 5 — BUDGET */}
          <section
            ref={el => { sectionRefs.current['budget'] = el; }}
            onMouseEnter={() => { setActiveSection('budget'); setVisitedSections(p => new Set([...p, 'budget'])); }}
            className="space-y-4"
          >
            <SectionHeader title="5. Budget Request & Line Items" subtitle="Itemized budget breakdown and funding source allocation" />
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['#', 'Item / Description', 'Qty × Unit Cost', 'Total'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {budgetItems.map((item, i) => (
                      <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3">
                          <p className="text-[#001A4D] font-medium">{item.item}</p>
                          {item.description && <p className="text-gray-400 text-xs mt-0.5">{item.description}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{item.quantity} × {formatCurrency(item.unitCost || 0)}</td>
                        <td className="px-4 py-3 font-bold text-[#001A4D]">{formatCurrency((item.unitCost || 0) * (item.quantity || 0))}</td>
                      </tr>
                    ))}
                    {budgetItems.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-xs">No budget line items submitted.</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#001A4D]">
                      <td colSpan={3} className="px-4 py-3.5 text-white font-bold text-xs uppercase tracking-wider">Total Requested Budget</td>
                      <td className="px-4 py-3.5 text-[#FFD41C] font-bold text-base">{formatCurrency(totalRequested)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>

          {/* SECTION 6 — DOCUMENTS */}
          <section
            ref={el => { sectionRefs.current['documents'] = el; }}
            onMouseEnter={() => { setActiveSection('documents'); setVisitedSections(p => new Set([...p, 'documents'])); }}
            className="space-y-4"
          >
            <SectionHeader title="6. Submitted Documents" subtitle="Official documents and supporting files submitted with the proposal" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(event.documents || []).map((doc, i) => (
                <div key={doc.id || i} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${doc.fileUrl ? 'bg-red-50' : 'bg-gray-100'}`}>
                      <FileText className={`w-6 h-6 ${doc.fileUrl ? 'text-red-500' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#001A4D] font-bold text-sm leading-tight">{doc.name}</p>
                      {doc.fileUrl ? (
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[#0E4EBD] text-xs mt-0.5 hover:underline block truncate font-medium">View file ↗</a>
                      ) : (
                        <span className={`text-xs mt-0.5 block ${doc.required ? 'text-red-400' : 'text-gray-400'}`}>
                          {doc.required ? 'Required — not yet uploaded' : 'Not uploaded'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!event.documents || event.documents.length === 0) && (
                <p className="text-sm text-gray-500 col-span-2 text-center py-6 bg-white rounded-2xl border border-gray-200">No documents attached.</p>
              )}
            </div>
          </section>

          {/* SECTION 7 — PAYABLES & QR ACCESS CONTROL (For Approved/Cancelled Events) */}
          {(isApproved || isCancelled) && (
            <section
              ref={el => { sectionRefs.current['payables'] = el; }}
              onMouseEnter={() => { setActiveSection('payables'); setVisitedSections(p => new Set([...p, 'payables'])); }}
              className="space-y-4"
            >
              <SectionHeader
                title="7. Event Payables & QR Ticket Access Control"
                subtitle={
                  isCancelled
                    ? "Event cancelled — Collections closed, fees auto-waived, and gate passes revoked"
                    : "Participant fees, collection status, and gate pass lock controls"
                }
              />
              <div className="space-y-4">
                <EventPayablesQRControl
                  eventId={event.id}
                  eventTitle={event.title}
                  adminFeeAmount={event.adminFeeOverride || event.suggestedFeePerStudent || totalRequested}
                  recordedByUid={profile?.uid || 'admin'}
                  isOfficer={false}
                  isClubEvent={
                    event.isOfficerProposal === true ||
                    (!!event.hostingOrgId &&
                      event.hostingOrgId !== 'sas' &&
                      event.hostingOrgId !== 'sas_admin' &&
                      event.hostingOrgId !== 'sao' &&
                      event.hostingOrgId !== 'sao_admin')
                  }
                  hostingOrgName={orgName}
                  isCancelled={isCancelled}
                />
              </div>
            </section>
          )}

          {/* SECTION 8 — SUBMISSION HISTORY & AUDIT TRAIL */}
          <section
            ref={el => { sectionRefs.current['history'] = el; }}
            onMouseEnter={() => { setActiveSection('history'); setVisitedSections(p => new Set([...p, 'history'])); }}
            className="space-y-4"
          >
            <SectionHeader title={`${isApproved ? '8' : '7'}. Submission History & Review Trail`} subtitle="Complete proposal lifecycle, admin decisions, and resubmission audit trail" />
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
              {event.proposalHistory && event.proposalHistory.length > 0 ? (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {event.proposalHistory.map((item, idx) => {
                    const itemDate = formatAppDateTime(item.performedAt, '—');

                    const isRejected = item.action === 'rejected';
                    const isApprovedAction = item.action === 'approved';
                    const isReturned = item.action === 'returned';
                    const isResubmitted = item.action === 'resubmitted';

                    const dotBg = isApprovedAction ? 'bg-emerald-500'
                      : isRejected ? 'bg-red-500'
                      : isReturned ? 'bg-amber-500'
                      : isResubmitted ? 'bg-[#0E4EBD]'
                      : 'bg-[#001A4D]';

                    return (
                      <div key={item.id || idx} className="relative flex items-start gap-3">
                        <div className={`absolute -left-[19px] top-1 w-3.5 h-3.5 rounded-full ${dotBg} ring-4 ring-white`} />
                        <div className="flex-1 bg-gray-50/70 border border-gray-200 rounded-xl p-3.5 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs uppercase tracking-wide text-[#001A4D]">
                                {item.action === 'created' ? 'Proposal Created' :
                                 item.action === 'submitted' ? 'Submitted for SAO Review' :
                                 item.action === 'approved' ? 'Proposal Approved' :
                                 item.action === 'rejected' ? 'Proposal Rejected' :
                                 item.action === 'returned' ? 'Returned for Revision' :
                                 item.action === 'resubmitted' ? 'Proposal Resubmitted by Officer' :
                                 item.action === 'edited' ? 'Edited & Updated' :
                                 item.action === 'draft_saved' ? 'Draft Saved' :
                                 item.action}
                              </span>
                              {(item.versionLabel || item.version) && (
                                <span className="px-2 py-0.5 bg-blue-100 text-[#0E4EBD] font-mono text-[10px] font-bold rounded-md">
                                  {item.versionLabel || `v${item.version}.0`}
                                </span>
                              )}
                            </div>
                            <span className="text-gray-400 text-xs font-mono">{itemDate}</span>
                          </div>

                          {item.performedByName && (
                            <p className="text-gray-500 text-[11px]">
                              By: <strong className="text-gray-700 font-semibold">{item.performedByName}</strong>
                            </p>
                          )}

                          {item.reason && (
                            <p className="text-xs text-red-600 font-semibold mt-1">
                              Reason: {item.reason}
                            </p>
                          )}

                          {item.remarks && (
                            <p className="text-xs text-gray-700 bg-white p-2.5 rounded-lg border border-gray-200 mt-1 italic">
                              "{item.remarks}"
                            </p>
                          )}

                          {item.returnFlags && item.returnFlags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {item.returnFlags.map((flag, fIdx) => (
                                <span key={fIdx} className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] rounded-full font-medium">
                                  ⚠ {flag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 text-xs">
                  No previous revision history recorded.
                </div>
              )}
            </div>
          </section>
        </main>

        {/* RIGHT COLUMN — 3rd Pane: Decision & Execution Side */}
        <aside className="w-80 lg:w-96 flex-shrink-0 border-l border-gray-200 bg-gray-50/70 flex flex-col overflow-y-auto p-5 space-y-5">
          {isCancelled ? (
            /* CANCELLED EVENT STATE */
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-[#001A4D] font-bold text-base">Cancelled Event</p>
                  <p className="text-gray-500 text-xs">Official cancellation notice.</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-600 to-rose-700 rounded-2xl p-5 text-white shadow-xs space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <XCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-white">Event Cancelled</h4>
                    <p className="text-xs text-red-100">All student payables auto-waived</p>
                  </div>
                </div>
                {event.cancelledAt && (
                  <div className="pt-2 border-t border-white/20 flex items-center justify-between text-xs text-white/90">
                    <span>Cancelled Date:</span>
                    <span className="font-semibold font-mono">{formatAppDateTime(event.cancelledAt)}</span>
                  </div>
                )}
              </div>

              {event.cancellationReason && (
                <div className="bg-white border border-red-200 rounded-2xl p-4 text-xs text-red-900 shadow-xs">
                  <p className="font-bold text-red-950 mb-1">Cancellation Reason:</p>
                  <p className="leading-relaxed">{event.cancellationReason}</p>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-[#001A4D] text-white hover:bg-[#001A4D]/90 rounded-xl font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                Close & Back to Event Approvals
              </button>
            </div>
          ) : isApproved ? (
            /* APPROVED EVENT STATE — Clean look with adviser decision controls completely removed */
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-[#001A4D] font-bold text-base">Approved Event</p>
                  <p className="text-gray-500 text-xs">Event proposal is active and published.</p>
                </div>
              </div>

              {/* Emerald Approved Banner */}
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-xs space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-white">Event Approved & Active</h4>
                    <p className="text-xs text-emerald-100">Official SAO Approval</p>
                  </div>
                </div>
                {event.approvedAt && (
                  <div className="pt-2 border-t border-white/20 flex items-center justify-between text-xs text-white/90">
                    <span>Approved Date:</span>
                    <span className="font-semibold font-mono">{formatAppDateTime(event.approvedAt)}</span>
                  </div>
                )}
              </div>

              {/* Approved Parameters Summary Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Approved Parameters
                </p>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Approved Budget</span>
                    <span className="font-bold text-[#001A4D]">{formatCurrency(totalApproved || event.approvedBudget || totalRequested)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Expected Attendance</span>
                    <span className="font-bold text-[#001A4D]">{event.expectedParticipantCount || 0} Students</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Sessions</span>
                    <span className="font-bold text-[#001A4D]">{event.sessions?.length || 1} Session{(event.sessions?.length || 1) > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Venue</span>
                    <span className="font-bold text-[#001A4D] truncate max-w-[150px]">{venueName}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Gate Pass Mode</span>
                    <span className="font-bold text-[#0E4EBD]">
                      {event.enableQRTickets !== false ? 'QR Gate Passes' : 'Manual Attendance'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500">Student Payables</span>
                    <span className="font-bold text-gray-800">
                      {event.studentPayablesEnabled ? `${formatCurrency(event.suggestedFeePerStudent || 0)} / student` : 'Free / No Fee'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Read-Only Adviser Remarks if available */}
              {event.adviserRemarks && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-[#001A4D] font-bold text-xs">
                    <Shield className="w-3.5 h-3.5 text-[#0E4EBD]" />
                    <span>Adviser Approval Remarks</span>
                  </div>
                  <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed whitespace-pre-wrap">
                    {event.adviserRemarks}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleExportPDF}
                  disabled={exportingPdf}
                  className="w-full py-2.5 bg-[#FFD41C] text-[#001A4D] hover:bg-amber-400 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{exportingPdf ? 'Exporting PDF...' : 'Download Official PDF'}</span>
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 bg-[#001A4D] text-white hover:bg-[#001A4D]/90 rounded-xl font-bold text-xs transition-colors shadow-xs cursor-pointer"
                >
                  Close & Back to Approvals
                </button>
              </div>
            </div>
          ) : (
            /* PENDING / RETURNED / REJECTED PROPOSALS — Active Decision Controls */
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-[#001A4D]" />
                <div>
                  <p className="text-[#001A4D] font-bold text-base">Adviser Decision</p>
                  <p className="text-gray-500 text-xs">Review sections & manage status.</p>
                </div>
              </div>

              {decision !== 'none' && (
                <div className={`rounded-2xl p-4 text-center ${
                  decision === 'returned' ? 'bg-gradient-to-br from-[#FFC107] to-[#F59E0B]' :
                  'bg-gradient-to-br from-[#EF4444] to-[#F97316]'
                }`}>
                  {decision === 'returned' ? <RotateCcw className="w-8 h-8 text-[#001A4D] mx-auto mb-1" /> :
                   <XCircle className="w-8 h-8 text-white mx-auto mb-1" />}
                  <p className={`font-bold text-base ${decision === 'returned' ? 'text-[#001A4D]' : 'text-white'}`}>
                    {decision === 'returned' ? 'Returned for Revision' : 'Proposal Rejected'}
                  </p>
                  <p className="text-xs text-white/80 mt-1">Status set by SAO Adviser</p>
                </div>
              )}

              {/* Adviser Remarks Field */}
              <div className={`bg-white border rounded-2xl p-4 shadow-xs ${remarksError ? 'border-red-400' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-[#0E4EBD] rounded-full" />
                    <p className="text-[#001A4D] font-bold text-sm">Adviser Remarks</p>
                  </div>
                </div>
                <textarea
                  value={remarks}
                  onChange={e => { setRemarks(e.target.value); if (e.target.value) setRemarksError(false); }}
                  rows={5}
                  placeholder="Write your remarks, feedback, or instructions for the officer here..."
                  className="w-full text-sm resize-none border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none leading-relaxed text-[#001A4D]"
                />
                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-3 h-3 text-[#0E4EBD]" />
                    <span className="text-[#0E4EBD] text-xs italic font-medium">Visible to officer</span>
                  </div>
                  <span className="text-gray-400 text-xs">{remarks.length} / 1000</span>
                </div>
                {remarksError && (
                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />Remarks required when returning or rejecting.
                  </p>
                )}
                {event?.id && (
                  <button
                    onClick={handleSaveRemarks}
                    disabled={savingRemarks}
                    className="w-full mt-3 py-2 bg-gray-100 border border-gray-200 text-[#001A4D] rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {savingRemarks ? 'Saving...' : 'Save Updated Remarks'}
                  </button>
                )}
              </div>

              {/* Decision Action Buttons */}
              <div className="space-y-2.5 pt-1">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {decision !== 'none' ? 'Change Decision' : 'Select Decision'}
                </p>
                <div>
                  <button onClick={() => handleDecision('approve')}
                    className="w-full h-11 flex items-center justify-center gap-2 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white font-bold text-xs rounded-xl hover:from-[#16A34A] hover:to-[#22C55E] transition-all shadow-xs cursor-pointer">
                    <CheckCircle className="w-4 h-4" />
                    Approve Proposal
                  </button>
                </div>
                <div>
                  <button onClick={() => handleDecision('return')}
                    className="w-full h-11 flex items-center justify-center gap-2 bg-[#FFC107] text-[#001A4D] font-bold text-xs rounded-xl hover:bg-[#F59E0B] transition-colors shadow-xs cursor-pointer">
                    <RotateCcw className="w-4 h-4" />
                    {decision === 'returned' ? 'Update Return Flags' : 'Return for Revision'}
                  </button>
                </div>
                <div>
                  <button onClick={() => handleDecision('reject')}
                    className="w-full h-11 flex items-center justify-center gap-2 bg-white border border-[#EF4444] text-[#EF4444] font-bold text-xs rounded-xl hover:bg-red-50 transition-colors cursor-pointer">
                    <X className="w-4 h-4" />
                    {decision === 'rejected' ? 'Update Rejection / Remarks' : 'Reject Proposal'}
                  </button>
                </div>
              </div>

              <button onClick={onClose} className="w-full text-center text-gray-500 text-xs hover:underline pt-2 cursor-pointer">
                Close & Back to Event Approvals
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* ===== CONFIRMATION MODALS ===== */}

      {/* APPROVE MODAL */}
      {activeModal === 'approve' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setActiveModal('none')} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-[#22C55E] to-[#16A34A] px-6 py-5 flex items-center gap-4">
              <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Confirm Approval</h3>
                <p className="text-[#FFD41C] text-sm">{event.title}</p>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-5">
                <p className="text-gray-500 text-xs mb-1.5">Optional remarks for the officer (included with approval notification)</p>
                <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-green-400 outline-none resize-none text-[#001A4D]" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setActiveModal('none')} disabled={submitting} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 cursor-pointer">Cancel</button>
                <button onClick={confirmApprove} disabled={submitting}
                  className="flex-1 py-3 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white rounded-xl text-sm font-bold hover:from-[#16A34A] hover:to-[#22C55E] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                  <Rocket className="w-4 h-4" /> {submitting ? 'Approving...' : 'Approve & Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RETURN MODAL */}
      {activeModal === 'return' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setActiveModal('none')} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-[#FFC107] to-[#F59E0B] px-6 py-5 flex items-center gap-4 flex-shrink-0">
              <div className="w-11 h-11 bg-[#001A4D]/20 rounded-full flex items-center justify-center">
                <RotateCcw className="w-6 h-6 text-[#001A4D]" />
              </div>
              <div>
                <h3 className="text-[#001A4D] font-bold text-lg">Return Proposal for Revision</h3>
                <p className="text-[#001A4D]/70 text-sm truncate max-w-xs">{event.title}</p>
              </div>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-[#0E4EBD] rounded-full" />
                  <p className="text-[#001A4D] font-bold text-sm">Flagged Items to Correct (Grouped by Step) <span className="text-red-500">*</span></p>
                </div>
                <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  {RETURN_FLAGS_GROUPED.map((item, idx) => (
                    <label key={idx} className="flex items-start gap-2.5 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200">
                      <input
                        type="checkbox"
                        checked={returnFlags.includes(item.flag)}
                        onChange={() => setReturnFlags(p => p.includes(item.flag) ? p.filter(f => f !== item.flag) : [...p, item.flag])}
                        className="accent-amber-500 w-4 h-4 rounded mt-0.5"
                      />
                      <span className="text-xs font-semibold text-[#001A4D] mt-0.5">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-[#0E4EBD] rounded-full" />
                  <p className="text-[#001A4D] font-bold text-sm">Adviser Revision Remarks / Instructions <span className="text-red-500">*</span></p>
                </div>
                <textarea
                  value={remarks}
                  onChange={e => { setRemarks(e.target.value); if (e.target.value) setRemarksError(false); }}
                  rows={4}
                  placeholder="Explain what specific corrections are required for the flagged items..."
                  className="w-full text-sm border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none resize-none text-[#001A4D]"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-white flex gap-3 flex-shrink-0">
              <button onClick={() => setActiveModal('none')} disabled={submitting} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 cursor-pointer">Cancel</button>
              <button onClick={confirmReturn} disabled={submitting || returnFlags.length === 0 || !remarks.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-[#FFC107] to-[#F59E0B] text-[#001A4D] rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                <Send className="w-4 h-4" /> {submitting ? 'Returning...' : 'Return for Revision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {activeModal === 'reject' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setActiveModal('none')} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-[#EF4444] to-[#F97316] px-6 py-5 flex items-center gap-4">
              <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center">
                <X className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Confirm Rejection</h3>
                <p className="text-[#FFD41C] text-sm">{event.title}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[#001A4D] font-bold text-sm mb-1.5">Rejection Reason Category <span className="text-red-500">*</span></p>
                <select value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-transparent">
                  <option value="">Select rejection reason category...</option>
                  {REJECTION_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <p className="text-[#001A4D] font-bold text-sm mb-1.5">Adviser Remarks / Feedback for Officer</p>
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  rows={4}
                  placeholder="Provide details explaining the rejection and what needs to be changed..."
                  className="w-full text-sm border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setActiveModal('none')} disabled={submitting} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 cursor-pointer">Cancel</button>
                <button onClick={confirmReject} disabled={submitting}
                  className="flex-1 py-3 bg-gradient-to-r from-[#EF4444] to-[#F97316] text-white rounded-xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer">
                  <X className="w-4 h-4" /> {submitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL EVENT MODAL */}
      {showCancelModal && (
        <CancelEventModal
          event={event}
          role="admin"
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onSuccess={() => {
            setShowCancelModal(false);
            onClose();
          }}
        />
      )}

      {/* CONCLUDE EVENT MODAL */}
      {showConcludeModal && (
        <ConcludeEventModal
          event={event}
          isOpen={showConcludeModal}
          onClose={() => setShowConcludeModal(false)}
          adminUid={profile?.uid || 'admin-user'}
          adminName={profile?.displayName || 'SAO Admin'}
          onSuccess={() => {
            setShowConcludeModal(false);
            onClose();
          }}
        />
      )}

      {/* ARCHIVE EVENT MODAL */}
      {showArchiveModal && (
        <ArchiveEventModal
          event={event}
          isOpen={showArchiveModal}
          onClose={() => setShowArchiveModal(false)}
          adminUid={profile?.uid || 'admin-user'}
          adminName={profile?.displayName || 'SAO Admin'}
          onSuccess={() => {
            setShowArchiveModal(false);
            onClose();
          }}
        />
      )}

      {/* DELETE ARCHIVED EVENT MODAL */}
      {showDeleteModal && (
        <DeleteArchivedEventModal
          event={event}
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          adminUid={profile?.uid || 'admin-user'}
          adminName={profile?.displayName || 'SAO Admin'}
          onSuccess={() => {
            setShowDeleteModal(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}
