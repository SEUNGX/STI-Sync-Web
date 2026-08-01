import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, Download, Clock, CheckCircle, XCircle, RotateCcw,
  Info, Calendar, Users, Shield, Receipt, FileText, History,
  ChevronDown, ChevronUp, Eye, Mail, MessageSquare, Send,
  Gavel, Check, X, AlertTriangle, AlertCircle, Rocket,
  FileImage, Plus, Minus, Coins
} from 'lucide-react';
import type { EventDocument } from '../../modules/events/types/event.types';
import { approveEvent, rejectEvent, returnEvent } from '../../modules/events/services/event.service';
import { useAdviserProfile } from '../../modules/auth/hooks/useAdviserProfile';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useEventTypesStream, useVenuesStream } from '../../modules/events/hooks/useEventConfigStream';
import { EventPayablesQRControl } from '../../modules/finance/components/EventPayablesQRControl';

interface EventProposalReviewProps {
  event: EventDocument;
  onClose: () => void;
}

type Decision = 'none' | 'approved' | 'returned' | 'rejected';
type ActiveModal = 'none' | 'approve' | 'return' | 'reject';

const NAV_SECTIONS = [
  { id: 'overview', icon: Info, label: 'Event Overview', status: 'complete' },
  { id: 'schedule', icon: Calendar, label: 'Schedule & Venue', status: 'complete' },
  { id: 'participants', icon: Users, label: 'Participants & Audience', status: 'complete' },
  { id: 'team', icon: Shield, label: 'Event Team & Scanners', status: 'complete' },
  { id: 'budget', icon: Receipt, label: 'Budget Request', status: 'complete' },
  { id: 'documents', icon: FileText, label: 'Submitted Documents', status: 'complete' },
  { id: 'history', icon: History, label: 'Submission History', status: 'complete' },
];

const RETURN_FLAGS = [
  'Event Information (title, description, objectives)',
  'Schedule or Venue',
  'Participant Settings',
  'Event Team Assignment',
  'Budget Request',
  'Submitted Documents',
  'Other',
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

function SectionHeader({ title, status, subtitle }: { title: string; status: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-[#83358E] rounded-full" />
          <h2 className="text-[#001A4D] font-bold text-lg">{title}</h2>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
          status === 'complete' ? 'bg-green-100 text-green-700' :
          status === 'warning' ? 'bg-amber-100 text-amber-700' :
          'bg-red-100 text-red-700'
        }`}>
          {status === 'complete' ? 'Complete' : status === 'warning' ? 'Incomplete' : 'Missing Required Data'}
        </span>
      </div>
      <p className="text-gray-500 text-sm ml-4">{subtitle}</p>
      <div className="mt-3 border-b border-[#E0E0E0]" />
    </div>
  );
}

export default function EventProposalReview({ event, onClose }: EventProposalReviewProps) {
  const [activeSection, setActiveSection] = useState('overview');
  const [visitedSections, setVisitedSections] = useState<Set<string>>(new Set(['overview']));
  const [remarks, setRemarks] = useState(event.adviserRemarks || '');
  const [remarksError, setRemarksError] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [undoVisible, setUndoVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Return modal state
  const [returnFlags, setReturnFlags] = useState<string[]>(event.returnFlags || []);
  const [returnDeadline, setReturnDeadline] = useState(event.returnDeadline || '');

  // Reject modal state
  const [rejectionReason, setRejectionReason] = useState(event.rejectionReason || '');
  const [allowResubmit, setAllowResubmit] = useState(true);
  const [resubmitDays, setResubmitDays] = useState(7);

  const { data: orgs } = useOrganizationStream();
  const { eventTypes } = useEventTypesStream();
  const { venues } = useVenuesStream();
  const { profile } = useAdviserProfile();

  const isDecided = event.proposalStatus !== 'pending_review' && event.proposalStatus !== 'draft';
  
  const initialDecision: Decision = 
    event.proposalStatus === 'approved' ? 'approved' :
    event.proposalStatus === 'rejected' ? 'rejected' :
    event.proposalStatus === 'returned' ? 'returned' : 'none';

  const [decision, setDecision] = useState<Decision>(initialDecision);

  // Budget adjustment
  const [approvedAmounts, setApprovedAmounts] = useState<Record<number, number>>(
    Object.fromEntries((event.budgetItems || []).map((i, idx) => [idx, i.amount || 0]))
  );

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const centerRef = useRef<HTMLDivElement>(null);

  const budgetItems = event.budgetItems || [];
  const totalRequested = budgetItems.reduce((s, i) => s + ((i.unitCost || 0) * (i.quantity || 0)), 0);
  const totalApproved = Object.values(approvedAmounts).reduce((a, b) => a + b, 0);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    setVisitedSections(prev => new Set([...prev, id]));
    const el = sectionRefs.current[id];
    if (el && centerRef.current) {
      centerRef.current.scrollTo({ top: el.offsetTop - 24, behavior: 'smooth' });
    }
  };

  const allVisited = NAV_SECTIONS.every(s => visitedSections.has(s.id));
  const remarksWritten = remarks.trim().length > 0;

  const handleDecision = (type: 'approve' | 'return' | 'reject') => {
    if (isDecided) return;
    if (type !== 'approve' && !remarksWritten) {
      setRemarksError(true);
      return;
    }
    setRemarksError(false);
    setActiveModal(type);
  };

  const confirmApprove = async () => {
    if (!profile?.uid) return;
    setSubmitting(true);
    try {
      await approveEvent(event.id, profile.uid, remarks);
      setDecision('approved');
      setActiveModal('none');
      setUndoVisible(true);
      setTimeout(() => setUndoVisible(false), 300000); // 5 min
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmReject = async () => {
    if (!profile?.uid) return;
    setSubmitting(true);
    try {
      await rejectEvent(event.id, profile.uid, rejectionReason, remarks);
      setDecision('rejected');
      setActiveModal('none');
      setUndoVisible(true);
      setTimeout(() => setUndoVisible(false), 300000); // 5 min
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmReturn = async () => {
    if (!profile?.uid) return;
    setSubmitting(true);
    try {
      await returnEvent(event.id, profile.uid, returnFlags, returnDeadline, remarks);
      setDecision('returned');
      setActiveModal('none');
      setUndoVisible(true);
      setTimeout(() => setUndoVisible(false), 300000); // 5 min
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const orgName = orgs.find(o => o.id === event.hostingOrgId)?.name || event.hostingOrgId;
  const orgAcronym = orgs.find(o => o.id === event.hostingOrgId)?.acronym || 'ORG';
  const eventTypeName = eventTypes.find(t => t.id === event.eventTypeId)?.name || 'Unknown Type';
  const venueName = venues.find(v => v.id === event.venueId)?.name || 'Unknown Venue';
  
  const createdDate = event.createdAt && typeof event.createdAt.toDate === 'function' ? event.createdAt.toDate().toLocaleDateString() : 'N/A';
  const firstSession = event.sessions && event.sessions.length > 0 ? event.sessions[0].date : 'TBD';

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* PAGE HEADER */}
      <div className="flex-shrink-0 h-16 bg-white border-b border-[#E0E0E0] flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button onClick={onClose}
            className="flex items-center gap-2 text-[#001A4D] hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Event Approvals
          </button>
          <div className="h-5 w-px bg-[#E0E0E0]" />
          <span className="text-xs text-gray-400">Dashboard &gt; Event Approvals &gt; <span className="text-gray-600">{event.title?.slice(0, 40) || 'Review'}</span></span>
        </div>
        <div className="flex items-center gap-4">
          <span className="px-3 py-1.5 bg-[#FFD41C] text-[#001A4D] font-mono font-bold text-xs rounded-full">{event.referenceId || 'N/A'}</span>
          {decision === 'none' ? (
            <span className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-white font-bold text-sm rounded-full">
              <Clock className="w-4 h-4" /> Pending Review
            </span>
          ) : decision === 'approved' ? (
            <span className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-sm rounded-full">
              <CheckCircle className="w-4 h-4" /> Approved
            </span>
          ) : decision === 'returned' ? (
            <span className="flex items-center gap-1.5 px-4 py-2 bg-[#1E70E8] text-white font-bold text-sm rounded-full">
              <RotateCcw className="w-4 h-4" /> Returned
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-600 text-white font-bold text-sm rounded-full">
              <XCircle className="w-4 h-4" /> Rejected
            </span>
          )}
          <button className="flex items-center gap-2 px-3 py-2 border border-[#001A4D] text-[#001A4D] rounded-lg text-sm hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* THREE-COLUMN BODY */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT COLUMN — Navigator (380px) */}
        <div className="w-[320px] flex-shrink-0 border-r border-[#E0E0E0] flex flex-col overflow-y-auto">
          <div className="p-5 space-y-5">
            {/* Nav list */}
            {/* Nav list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#001A4D] font-bold text-sm">Proposal Sections</span>
              </div>
              <div className="space-y-1">
                {[
                  ...NAV_SECTIONS,
                  ...(event.proposalStatus === 'approved' && event.studentPayablesEnabled !== false
                    ? [{ id: 'payables', icon: Coins, label: 'Payables & QR Tickets', status: 'complete' }]
                    : []),
                ].map(s => {
                  const Icon = s.icon;
                  const isActive = activeSection === s.id;
                  const isVisited = visitedSections.has(s.id);
                  return (
                    <button key={s.id} onClick={() => scrollTo(s.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative ${isActive ? 'bg-[#F3E8FF] text-[#83358E] font-bold' : 'text-[#001A4D] hover:bg-gray-50'}`}>
                      {isActive && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#83358E] rounded-l-lg" />}
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#83358E]' : 'text-gray-400'}`} />
                      <span className="flex-1 text-left">{s.label}</span>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        s.status === 'complete' && isVisited ? 'bg-green-500' :
                        s.status === 'warning' && isVisited ? 'bg-amber-400' :
                        !isVisited ? 'bg-gray-200' : 'bg-red-400'
                      }`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Review Progress */}
            <div className="bg-[#F3E8FF] border border-[#83358E]/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-[#83358E]" />
                <span className="text-[#83358E] font-bold text-sm">Review Progress</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Viewed all sections', done: allVisited },
                  { label: 'Remarks written', done: remarksWritten },
                  { label: 'Decision made', done: decision !== 'none' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${item.done ? 'bg-[#83358E] border-[#83358E]' : 'border-gray-300'}`}>
                      {item.done && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className={`text-xs ${item.done ? 'text-[#83358E] font-medium' : 'text-gray-500'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Officer Contact */}
            <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
              <p className="text-[#001A4D] font-bold text-sm mb-3">Submitting Officer</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-[#7F77DD] rounded-full flex items-center justify-center text-white font-bold text-sm">{(event.createdBy || "O").charAt(0).toUpperCase()}</div>
                <div>
                  <p className="font-bold text-[#001A4D] text-sm">UID: {event.createdBy || 'Unknown'}</p>
                  <p className="text-gray-400 text-xs">{orgAcronym}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN — Proposal Content */}
        <div ref={centerRef} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-10 w-full">

            {isDecided && (
              <div className={`p-4 rounded-xl border-l-4 ${decision === 'approved' ? 'bg-green-50 border-green-500' : decision === 'rejected' ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-500'}`}>
                <p className="text-sm font-bold text-gray-800">
                  {decision === 'approved' ? `This proposal was Approved on ${event.approvedAt && typeof event.approvedAt.toDate === 'function' ? event.approvedAt.toDate().toLocaleDateString() : 'N/A'}.` :
                   decision === 'rejected' ? `This proposal was Rejected on ${event.rejectedAt && typeof event.rejectedAt.toDate === 'function' ? event.rejectedAt.toDate().toLocaleDateString() : 'N/A'}. Reason: ${event.rejectionReason}` :
                   `This proposal was Returned on ${event.returnedAt && typeof event.returnedAt.toDate === 'function' ? event.returnedAt.toDate().toLocaleDateString() : 'N/A'}.`}
                </p>
              </div>
            )}

            {/* SECTION 1 — EVENT OVERVIEW */}
            <div ref={el => { sectionRefs.current['overview'] = el; }}
              onMouseEnter={() => { setActiveSection('overview'); setVisitedSections(p => new Set([...p, 'overview'])); }}>
              <SectionHeader title="Event Overview" status="complete" subtitle="Event identity, classification, and media assets submitted by the officer" />
              
              <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden mb-4">
                <div className="h-44 bg-gradient-to-br from-[#7F77DD] to-[#83358E] flex items-center justify-center">
                  <div className="text-center">
                    <FileImage className="w-12 h-12 text-white/40 mx-auto mb-2" />
                    <p className="text-white/50 text-sm">No banner uploaded</p>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs uppercase text-gray-400 font-semibold mb-1">Event Title</p>
                        <p className="text-[#001A4D] font-bold text-xl">{event.title}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-gray-400 font-semibold mb-1">Description</p>
                        <p className="text-[#001A4D] text-sm leading-relaxed">{event.description}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: 'Event Type', value: eventTypeName, pill: true, color: '#83358E' },
                        { label: 'Organization', value: orgName, pill: false },
                        { label: 'Event Format', value: event.eventFormat || 'N/A', pill: true, color: '#22C55E' },
                        { label: 'QR Tickets', value: event.enableQRTickets ? 'Enabled' : 'Disabled', pill: true, color: '#1E70E8' },
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-[#F0F0F0] last:border-0">
                          <span className="text-gray-400 text-xs">{row.label}</span>
                          {row.pill ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: row.color + '20', color: row.color }}>{row.value}</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 bg-[#7F77DD] rounded-full flex items-center justify-center text-white text-xs font-bold">{(row.value as string)[0]}</div>
                              <span className="text-[#83358E] font-bold text-sm">{row.value}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Objectives */}
              {event.objectives && event.objectives.length > 0 && (
                <div className="bg-[#F3E8FF] border-l-4 border-[#83358E] rounded-xl p-4">
                  <p className="text-[#83358E] font-bold text-sm mb-3">Event Objectives</p>
                  <div className="space-y-2">
                    {event.objectives.map((obj, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-[#83358E] text-white rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                        <p className="text-[#001A4D] text-sm">{obj}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2 — SCHEDULE & VENUE */}
            <div ref={el => { sectionRefs.current['schedule'] = el; }}
              onMouseEnter={() => { setActiveSection('schedule'); setVisitedSections(p => new Set([...p, 'schedule'])); }}>
              <SectionHeader title="Schedule & Venue" status="complete" subtitle="Academic context, session schedule, and venue logistics" />
              <div className="space-y-4">
                <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
                  <div className="grid grid-cols-2 divide-x divide-[#E0E0E0]">
                    {[
                      { label: 'School Year', value: event.schoolYear || 'N/A' },
                      { label: 'Submitted', value: createdDate },
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
                    <span className="px-2 py-0.5 bg-[#83358E] text-white text-xs rounded-full font-medium">{event.sessions?.length || 0} Sessions</span>
                  </div>
                  <div className="space-y-3">
                    {(event.sessions || []).map((s, i) => (
                      <div key={s.id || i} className="border-l-[3px] border-[#83358E] bg-white border border-[#E0E0E0] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[#83358E] font-bold text-xs">Session {i + 1}</span>
                          <span className="text-[#001A4D] font-bold text-sm">{s.title}</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-gray-400" />{s.date}</div>
                          <div className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-gray-400" />{s.startTime} - {s.endTime}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Venue */}
                <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs uppercase text-gray-400 font-semibold mb-2">Requested Venue</p>
                      <p className="text-[#001A4D] font-bold text-base">{venueName}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-gray-400 font-semibold mb-2">Event Format</p>
                      <span className="px-3 py-1 bg-[#83358E]/10 text-[#83358E] rounded-full text-sm font-medium">{event.eventFormat}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3 — PARTICIPANTS */}
            <div ref={el => { sectionRefs.current['participants'] = el; }}
              onMouseEnter={() => { setActiveSection('participants'); setVisitedSections(p => new Set([...p, 'participants'])); }}>
              <SectionHeader title="Participants & Audience" status="complete" subtitle="Target audience, reach estimate, and attendance configuration" />
              <div className="space-y-4">
                <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
                  <div className="grid grid-cols-2 divide-x divide-[#E0E0E0]">
                    {[
                      { label: 'Expected Attendance', value: event.expectedParticipantCount || 0 },
                      { label: 'Student Payables', value: event.studentPayablesEnabled ? `₱${event.suggestedFeePerStudent || 0} / student` : 'Disabled' },
                    ].map(c => (
                      <div key={c.label} className="px-5 first:pl-0 last:pr-0 text-center">
                        <p className="text-xs uppercase text-gray-400 font-semibold mb-1">{c.label}</p>
                        <p className="text-[#001A4D] font-bold text-xl">{c.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 space-y-4">
                  <div>
                    <p className="text-xs uppercase text-gray-400 font-semibold mb-2">Target Year Levels</p>
                    <div className="flex flex-wrap gap-2">
                      {(event.targetYearLevels || []).map(y => (
                        <span key={y} className="px-3 py-1 bg-[#001A4D] text-[#FFD41C] text-xs rounded-full font-medium">{y}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4 — TEAM */}
            <div ref={el => { sectionRefs.current['team'] = el; }}
              onMouseEnter={() => { setActiveSection('team'); setVisitedSections(p => new Set([...p, 'team'])); }}>
              <SectionHeader title="Event Team & Scanners" status="complete" subtitle="Proposed core team members and scanner officer assignments" />
              <div className="space-y-4">
                <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#E0E0E0] flex items-center justify-between">
                    <p className="text-[#001A4D] font-bold text-sm">Scanner Officers</p>
                    <span className="px-2 py-0.5 bg-[#83358E] text-white text-xs rounded-full font-medium">{(event.scanners || []).length} Assigned</span>
                  </div>
                  {(event.scanners || []).length > 0 ? (
                    <div className="divide-y divide-[#F0F0F0]">
                      {(event.scanners || []).map((scanner, i) => (
                        <div key={scanner.id || i} className="px-5 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-[#001A4D] font-semibold text-sm">{scanner.officerName || 'Unnamed Officer'}</p>
                            <p className="text-gray-400 text-xs mt-0.5">Student ID: {scanner.officerUserId || 'Not linked'}</p>
                          </div>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {scanner.fullAccess && <span className="px-2 py-0.5 bg-[#83358E]/10 text-[#83358E] text-xs rounded-full">Full Access</span>}
                            {!scanner.fullAccess && scanner.canCheckIn && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">Check-In</span>}
                            {!scanner.fullAccess && scanner.canCheckOut && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full">Check-Out</span>}
                            {!scanner.fullAccess && scanner.canViewList && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">View List</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-gray-500">No scanner officers assigned.</div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 5 — BUDGET */}
            <div ref={el => { sectionRefs.current['budget'] = el; }}
              onMouseEnter={() => { setActiveSection('budget'); setVisitedSections(p => new Set([...p, 'budget'])); }}>
              <SectionHeader title="Budget Request" status="complete" subtitle="Itemized budget breakdown and funding source allocation" />
              <div className="space-y-4">
                <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-[#E0E0E0]">
                      <tr>
                        {['#', 'Item / Description', 'Qty × Unit Cost', 'Total'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F0F0]">
                      {budgetItems.map((item, i) => (
                        <tr key={i} className="hover:bg-[#F3E8FF]/30 transition-colors">
                          <td className="px-3 py-3 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-3 py-3">
                            <p className="text-[#001A4D] font-medium">{item.item}</p>
                            {item.description && <p className="text-gray-400 text-xs mt-0.5">{item.description}</p>}
                          </td>
                          <td className="px-3 py-3 text-gray-600 text-sm">{item.quantity} × ₱{(item.unitCost || 0).toLocaleString()}</td>
                          <td className="px-3 py-3 font-bold text-[#001A4D]">₱{((item.unitCost || 0) * (item.quantity || 0)).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#001A4D]">
                        <td colSpan={3} className="px-3 py-3 text-white font-bold">Total Requested</td>
                        <td className="px-3 py-3 text-[#FFD41C] font-bold">₱{totalRequested.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* SECTION 6 — DOCUMENTS */}
            <div ref={el => { sectionRefs.current['documents'] = el; }}
              onMouseEnter={() => { setActiveSection('documents'); setVisitedSections(p => new Set([...p, 'documents'])); }}>
              <SectionHeader title="Submitted Documents" status="complete" subtitle="Official documents and supporting files submitted with the proposal" />
              <div className="grid grid-cols-2 gap-3">
                {(event.documents || []).map((doc, i) => (
                  <div key={doc.id || i} className="bg-white border border-[#E0E0E0] rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${doc.fileUrl ? 'bg-red-50' : 'bg-gray-100'}`}>
                        <FileText className={`w-6 h-6 ${doc.fileUrl ? 'text-red-500' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#001A4D] font-bold text-sm leading-tight">{doc.name}</p>
                        {doc.fileUrl ? (
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                            className="text-[#83358E] text-xs mt-0.5 hover:underline block truncate">View file ↗</a>
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
                  <p className="text-sm text-gray-500 col-span-2">No documents attached.</p>
                )}
              </div>
            </div>

            {/* SECTION 7 — HISTORY */}
            <div ref={el => { sectionRefs.current['history'] = el; }}
              onMouseEnter={() => { setActiveSection('history'); setVisitedSections(p => new Set([...p, 'history'])); }}>
              <SectionHeader title="Submission History" status="complete" subtitle="Complete proposal lifecycle and audit trail" />
              <div className="bg-white border border-[#E0E0E0] rounded-xl p-5">
                <div className="relative">
                  <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-[#E0E0E0]" />
                  <div className="space-y-6">
                    <div className="flex gap-4 relative">
                      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center z-10 bg-[#1E70E8]">
                        <Send className="w-3 h-3 text-white" />
                      </div>
                      <div>
                        <p className="text-[#001A4D] font-bold text-sm">Created</p>
                        <p className="text-gray-400 text-xs mt-0.5">{createdDate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 8 — PAYABLES & QR ACCESS CONTROL */}
            {event.proposalStatus === 'approved' && (
              <div
                ref={el => { sectionRefs.current['payables'] = el; }}
                onMouseEnter={() => { setActiveSection('payables'); setVisitedSections(p => new Set([...p, 'payables'])); }}
                className="pt-6"
              >
                <EventPayablesQRControl
                  eventId={event.id}
                  eventTitle={event.title}
                  adminFeeAmount={event.adminFeeOverride}
                  recordedByUid={profile?.uid || 'admin'}
                />
              </div>
            )}

          </div>
        </div>

        {/* RIGHT COLUMN — Decision Panel (300px) */}
        <div className="w-[300px] flex-shrink-0 border-l border-[#E0E0E0] flex flex-col overflow-y-auto">
          <div className="p-5 space-y-4">
            {decision === 'none' && !isDecided ? (
              <>
                <div className="flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-[#001A4D]" />
                  <div>
                    <p className="text-[#001A4D] font-bold text-base">Adviser Decision</p>
                    <p className="text-gray-400 text-xs">Review all sections before deciding.</p>
                  </div>
                </div>

                <div className={`bg-white border rounded-xl p-4 ${remarksError ? 'border-red-400' : 'border-[#E0E0E0]'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-4 bg-[#83358E] rounded-full" />
                    <p className="text-[#001A4D] font-bold text-sm">Adviser Remarks</p>
                  </div>
                  <textarea
                    value={remarks}
                    onChange={e => { setRemarks(e.target.value); if (e.target.value) setRemarksError(false); }}
                    rows={6}
                    disabled={isDecided}
                    placeholder="Write your remarks, feedback, or instructions for the officer here."
                    className="w-full text-sm resize-none border border-[#E0E0E0] rounded-lg p-3 focus:ring-2 focus:ring-[#83358E] focus:border-transparent outline-none leading-relaxed text-[#001A4D]"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-1.5">
                      <Eye className="w-3 h-3 text-[#83358E]" />
                      <span className="text-[#83358E] text-xs italic">Visible to submitting officer</span>
                    </div>
                    <span className="text-gray-400 text-xs">{remarks.length} / 1000</span>
                  </div>
                  {remarksError && (
                    <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />Remarks required when returning or rejecting.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <button onClick={() => handleDecision('approve')} disabled={isDecided}
                      className="w-full h-14 flex items-center justify-center gap-2 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white font-bold text-base rounded-xl hover:from-[#16A34A] hover:to-[#22C55E] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      <CheckCircle className="w-5 h-5" />
                      Approve Proposal
                    </button>
                  </div>
                  <div>
                    <button onClick={() => handleDecision('return')} disabled={isDecided}
                      className="w-full h-14 flex items-center justify-center gap-2 bg-[#FFC107] text-[#001A4D] font-bold text-base rounded-xl hover:bg-[#F59E0B] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      <RotateCcw className="w-5 h-5" />
                      Return for Revision
                    </button>
                  </div>
                  <div>
                    <button onClick={() => handleDecision('reject')} disabled={isDecided}
                      className="w-full h-[52px] flex items-center justify-center gap-2 bg-white border-[1.5px] border-[#EF4444] text-[#EF4444] font-bold text-sm rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <X className="w-4 h-4" />
                      Reject Proposal
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={`rounded-xl p-5 text-center ${
                  decision === 'approved' ? 'bg-gradient-to-br from-[#22C55E] to-[#16A34A]' :
                  decision === 'returned' ? 'bg-gradient-to-br from-[#FFC107] to-[#F59E0B]' :
                  'bg-gradient-to-br from-[#EF4444] to-[#F97316]'
                }`}>
                  {decision === 'approved' ? <CheckCircle className="w-10 h-10 text-white mx-auto mb-2" /> :
                   decision === 'returned' ? <RotateCcw className="w-10 h-10 text-[#001A4D] mx-auto mb-2" /> :
                   <XCircle className="w-10 h-10 text-white mx-auto mb-2" />}
                  <p className={`font-bold text-lg ${decision === 'returned' ? 'text-[#001A4D]' : 'text-white'}`}>
                    {decision === 'approved' ? 'Proposal Approved' : decision === 'returned' ? 'Returned for Revision' : 'Proposal Rejected'}
                  </p>
                </div>

                <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-4 bg-[#83358E] rounded-full" />
                    <p className="text-[#001A4D] font-bold text-sm">Adviser Remarks</p>
                  </div>
                  <textarea
                    value={remarks}
                    readOnly
                    rows={6}
                    className="w-full text-sm resize-none border border-[#E0E0E0] rounded-lg p-3 bg-gray-50 outline-none leading-relaxed text-gray-700"
                  />
                </div>

                <button onClick={onClose} className="w-full text-center text-[#001A4D] text-sm hover:underline mt-4">
                  Back to Event Approvals
                </button>
              </>
            )}
          </div>
        </div>
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
                  className="w-full text-sm border border-[#E0E0E0] rounded-lg p-3 focus:ring-2 focus:ring-green-400 outline-none resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setActiveModal('none')} disabled={submitting} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                <button onClick={confirmApprove} disabled={submitting}
                  className="flex-1 py-3 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white rounded-xl text-sm font-bold hover:from-[#16A34A] hover:to-[#22C55E] flex items-center justify-center gap-2 disabled:opacity-50">
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
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-[#FFC107] to-[#F59E0B] px-6 py-5 flex items-center gap-4">
              <div className="w-11 h-11 bg-[#001A4D]/20 rounded-full flex items-center justify-center">
                <RotateCcw className="w-6 h-6 text-[#001A4D]" />
              </div>
              <div>
                <h3 className="text-[#001A4D] font-bold text-lg">Return for Revision</h3>
                <p className="text-[#001A4D]/70 text-sm">{event.title}</p>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-[#83358E] rounded-full" />
                  <p className="text-[#001A4D] font-bold text-sm">Flagged Items to Correct</p>
                </div>
                <div className="space-y-2">
                  {RETURN_FLAGS.map(flag => (
                    <label key={flag} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={returnFlags.includes(flag)}
                        onChange={() => setReturnFlags(p => p.includes(flag) ? p.filter(f => f !== flag) : [...p, flag])}
                        className="accent-amber-500 w-4 h-4 rounded" />
                      <span className="text-sm text-gray-700">{flag}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setActiveModal('none')} disabled={submitting} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                <button onClick={confirmReturn} disabled={submitting}
                  className="flex-1 py-3 bg-gradient-to-r from-[#FFC107] to-[#F59E0B] text-[#001A4D] rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  <Send className="w-4 h-4" /> {submitting ? 'Returning...' : 'Return for Revision'}
                </button>
              </div>
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
            <div className="p-6">
              <div className="mb-5">
                <p className="text-[#001A4D] font-bold text-sm mb-1.5">Rejection Reason <span className="text-red-500">*</span></p>
                <select value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-transparent">
                  <option value="">Select rejection reason category...</option>
                  {REJECTION_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setActiveModal('none')} disabled={submitting} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                <button onClick={confirmReject} disabled={!rejectionReason || submitting}
                  className="flex-1 py-3 bg-gradient-to-r from-[#EF4444] to-[#F97316] text-white rounded-xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                  <X className="w-4 h-4" /> {submitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
