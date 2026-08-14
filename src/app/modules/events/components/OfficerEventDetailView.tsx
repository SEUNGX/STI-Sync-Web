import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, X, Edit, Calendar, MapPin, Users, DollarSign, Shield,
  Receipt, FileText, History, Coins, Clock, CheckCircle2, AlertCircle,
  AlertTriangle, Download, Eye, Tag, Building2, Check, RotateCcw,
  XCircle, FileImage, Lock, Unlock, UserCheck, ChevronRight
} from 'lucide-react';
import type { EventDocument } from '../types/event.types';
import { useOfficerProfile } from '../../../auth/hooks/useOfficerProfile';
import { useOrganizationStream } from '../../organizations/hooks/useOrganizationStream';
import { useEventTypesStream, useVenuesStream } from '../hooks/useEventConfigStream';
import { useDepartments } from '../../academic/hooks/useAcademicStream';
import { EventPayablesQRControl } from '../../finance/components/EventPayablesQRControl';

interface OfficerEventDetailViewProps {
  event: EventDocument;
  onClose: () => void;
  onEdit?: () => void;
}

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

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-1.5 h-6 bg-[#83358E] rounded-full" />
        <h3 className="text-[#001A4D] font-bold text-lg">{title}</h3>
      </div>
      <p className="text-gray-500 text-xs ml-4.5">{subtitle}</p>
      <div className="mt-3 border-b border-gray-200" />
    </div>
  );
}

export default function OfficerEventDetailView({
  event,
  onClose,
  onEdit,
}: OfficerEventDetailViewProps) {
  const [activeSection, setActiveSection] = useState('overview');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const centerRef = useRef<HTMLDivElement | null>(null);

  const { profile } = useOfficerProfile();
  const { data: orgs } = useOrganizationStream();
  const { eventTypes } = useEventTypesStream();
  const { venues } = useVenuesStream();
  const { data: departments } = useDepartments();

  const isEditable =
    event.proposalStatus === 'draft' ||
    event.proposalStatus === 'returned' ||
    (event.proposalStatus === 'rejected' && event.allowResubmission !== false);

  const orgObj = orgs.find((o) => o.id === event.hostingOrgId);
  const orgName = orgObj ? orgObj.name : event.hostingOrgId || 'My Organization';
  const orgAcronym = orgObj?.acronym || 'Club';
  const eventTypeName = eventTypes.find((t) => t.id === event.eventTypeId)?.name || 'General Event';
  const venueObj = venues.find((v) => v.id === event.venueId);
  const venueName = venueObj ? venueObj.name : event.venueId || 'On-Campus Venue';

  const budgetItems = event.budgetItems || [];
  const totalRequested = budgetItems.reduce((acc, item) => {
    const cost = Number(item.approvedAmount || item.unitCost * item.quantity || 0);
    return acc + cost;
  }, 0);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const el = sectionRefs.current[id];
    if (el && centerRef.current) {
      const top = el.offsetTop - 20;
      centerRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const statusColors: Record<string, { bg: string; text: string; label: string; icon: any }> = {
    draft: { bg: 'bg-gray-100 text-gray-700 border-gray-300', text: 'text-gray-700', label: 'Draft Proposal', icon: Clock },
    pending: { bg: 'bg-amber-50 text-amber-800 border-amber-300', text: 'text-amber-700', label: 'Pending Review', icon: Clock },
    pending_review: { bg: 'bg-amber-50 text-amber-800 border-amber-300', text: 'text-amber-700', label: 'Pending Review', icon: Clock },
    approved: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-300', text: 'text-emerald-700', label: 'Approved & Active', icon: CheckCircle2 },
    completed: { bg: 'bg-blue-50 text-blue-800 border-blue-300', text: 'text-blue-700', label: 'Completed Event', icon: CheckCircle2 },
    returned: { bg: 'bg-purple-50 text-purple-800 border-purple-300', text: 'text-purple-700', label: 'Returned for Revision', icon: RotateCcw },
    rejected: { bg: 'bg-red-50 text-red-800 border-red-300', text: 'text-red-700', label: 'Rejected Proposal', icon: XCircle },
  };

  const currentStatusKey = (event.proposalStatus || 'draft').toLowerCase();
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
      {/* Top Navigation Bar */}
      <header className="h-16 bg-[#001A4D] border-b border-[#0E4EBD]/30 flex items-center justify-between px-6 flex-shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Event Management</span>
          </button>
          <div className="h-5 w-px bg-white/20" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#FFD41C]">
                {event.referenceId || 'EVT-PROP'}
              </span>
              <span className="text-white/40">·</span>
              <span className="text-white font-bold text-sm truncate max-w-[320px] lg:max-w-md">
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

          {/* Edit Proposal Action */}
          {isEditable && onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-1.5 bg-[#83358E] text-white hover:bg-[#6D2A78] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Revise / Edit Proposal</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar: Section Navigator */}
        <aside className="w-64 lg:w-72 flex-shrink-0 border-r border-gray-200 bg-gray-50/70 flex flex-col overflow-y-auto p-4 space-y-6">
          {/* Organization Badge */}
          <div className="p-3.5 bg-white border border-gray-200 rounded-xl shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#83358E] to-[#0E4EBD] flex items-center justify-center text-white font-bold text-xs shadow-xs">
                {orgAcronym.slice(0, 3)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 truncate">{orgName}</p>
                <p className="text-[11px] text-gray-500 truncate">Host Organization</p>
              </div>
            </div>
          </div>

          {/* Section Navigation List */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">
              Event Sections
            </p>
            {NAV_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  onClick={() => scrollTo(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left relative ${
                    isActive
                      ? 'bg-[#F3E8FF] text-[#83358E] shadow-xs'
                      : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#83358E] rounded-r-full" />
                  )}
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? 'text-[#83358E]' : 'text-gray-400'
                    }`}
                  />
                  <span className="flex-1 truncate">{section.label}</span>
                  {section.id === 'payables' && event.studentPayablesEnabled !== false && (
                    <span className="px-1.5 py-0.2 bg-[#83358E] text-white text-[10px] font-bold rounded-full">
                      Payables
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Info Box */}
          <div className="p-3.5 bg-gradient-to-br from-[#001A4D] to-[#83358E] rounded-xl text-white text-xs space-y-2 mt-auto shadow-xs">
            <div className="flex items-center gap-1.5 text-[#FFD41C] font-bold">
              <Shield className="w-3.5 h-3.5" />
              <span>Gate Access Notice</span>
            </div>
            <p className="text-[11px] text-white/80 leading-relaxed">
              Paid events enforce Option A gate lock. Unlocking occurs automatically when student event fees are recorded.
            </p>
          </div>
        </aside>

        {/* Center Content Pane */}
        <main ref={centerRef} className="flex-1 overflow-y-auto bg-gray-50/30 p-6 lg:p-8 space-y-8">
          {/* Status Feedback Banners */}
          {event.proposalStatus === 'returned' && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-[#83358E] font-bold text-sm">
                <RotateCcw className="w-5 h-5" />
                <span>Proposal Returned for Revision by SAS Adviser</span>
              </div>
              {event.adviserRemarks && (
                <div className="bg-white p-3.5 rounded-xl border border-purple-100 text-xs text-gray-800 leading-relaxed shadow-2xs">
                  <strong className="text-[#83358E]">Adviser Feedback:</strong> {event.adviserRemarks}
                </div>
              )}
              {event.returnFlags && event.returnFlags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-semibold text-purple-900">Flagged Sections:</span>
                  {event.returnFlags.map((flag, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 bg-purple-200 text-purple-900 text-xs rounded-full font-bold"
                    >
                      ⚠ {flag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {event.proposalStatus === 'rejected' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                  <XCircle className="w-5 h-5" />
                  <span>Proposal Rejected by SAS</span>
                </div>
                {event.allowResubmission !== false ? (
                  <span className="px-2.5 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-bold">
                    Revision Allowed
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-red-200 text-red-900 text-xs rounded-full font-bold">
                    Resubmission Locked
                  </span>
                )}
              </div>

              {event.rejectionReason && (
                <p className="text-xs text-red-900 font-medium">
                  <strong>Reason Category:</strong> {event.rejectionReason}
                </p>
              )}

              {event.adviserRemarks && (
                <div className="bg-white p-3.5 rounded-xl border border-red-100 text-xs text-gray-800 leading-relaxed shadow-2xs">
                  <strong className="text-red-700">Remarks:</strong> {event.adviserRemarks}
                </div>
              )}
            </div>
          )}

          {/* SECTION 1: OVERVIEW */}
          <section
            ref={(el) => { sectionRefs.current['overview'] = el; }}
            className="space-y-4"
          >
            <SectionHeader
              title="1. Event Overview"
              subtitle="Event identity, category classification, tagline, objectives, and visibility"
            />

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-6">
              {/* Media Banner */}
              <div className="aspect-[21/9] max-h-56 w-full bg-gradient-to-br from-[#001A4D] to-[#83358E] rounded-xl overflow-hidden flex items-center justify-center relative shadow-inner">
                {event.bannerImageUrl ? (
                  <img
                    src={event.bannerImageUrl}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center text-white/50 space-y-1">
                    <FileImage className="w-10 h-10 mx-auto" />
                    <span className="text-xs font-semibold">No custom banner uploaded</span>
                  </div>
                )}
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-white text-xs font-semibold rounded-lg">
                    {event.eventFormat || 'On-Campus'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Event Title
                    </label>
                    <p className="text-lg font-bold text-[#001A4D] mt-0.5">{event.title}</p>
                    {event.tagline && (
                      <p className="text-xs text-[#83358E] font-semibold mt-0.5 italic">
                        "{event.tagline}"
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Description
                    </label>
                    <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-3.5 rounded-xl border border-gray-100 mt-1 whitespace-pre-wrap">
                      {event.description || 'No description provided.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5 bg-gray-50/60 p-4 rounded-xl border border-gray-200/80">
                  <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 text-xs">
                    <span className="text-gray-500 font-medium">Event Type</span>
                    <span className="font-bold text-[#83358E] bg-purple-100/70 px-2.5 py-0.5 rounded-md">
                      {eventTypeName}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 text-xs">
                    <span className="text-gray-500 font-medium">Host Organization</span>
                    <span className="font-bold text-[#001A4D]">{orgName}</span>
                  </div>

                  <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 text-xs">
                    <span className="text-gray-500 font-medium">QR Gate Tickets</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-md ${
                        event.enableQRTickets !== false
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {event.enableQRTickets !== false ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Feed Visibility</span>
                    <span className="font-bold text-gray-800">
                      {event.isVisible !== false ? 'Visible in Mobile App' : 'Hidden'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Objectives */}
              {event.objectives && event.objectives.length > 0 && (
                <div className="bg-[#F3E8FF]/60 border border-[#83358E]/30 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-[#83358E] uppercase tracking-wider">
                    Key Event Objectives
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {event.objectives.map((obj, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-800">
                        <div className="w-5 h-5 rounded-full bg-[#83358E] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <span>{obj}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* SECTION 2: SCHEDULE & SESSIONS */}
          <section
            ref={(el) => { sectionRefs.current['schedule'] = el; }}
            className="space-y-4"
          >
            <SectionHeader
              title="2. Schedule & Multi-Session Breakdown"
              subtitle="Academic calendar, venue assignment, and session time-in/out windows"
            />

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-center">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">School Year</span>
                  <p className="text-sm font-bold text-[#001A4D] mt-0.5">{event.schoolYear || 'SY 2025-2026'}</p>
                </div>
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-center">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">Requested Venue</span>
                  <p className="text-sm font-bold text-[#83358E] mt-0.5">{venueName}</p>
                </div>
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-center">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">Format</span>
                  <p className="text-sm font-bold text-emerald-700 mt-0.5">{event.eventFormat || 'On-Campus'}</p>
                </div>
              </div>

              {/* Sessions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#001A4D] uppercase tracking-wider">
                    Configured Sessions ({event.sessions?.length || 0})
                  </h4>
                </div>

                <div className="space-y-3">
                  {(event.sessions || []).map((session, idx) => (
                    <div
                      key={session.id || idx}
                      className="border-l-4 border-[#83358E] bg-gray-50/70 border border-gray-200 rounded-xl p-4 space-y-2 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-[#83358E] text-white text-[10px] font-bold rounded-md uppercase">
                            Session {idx + 1}
                          </span>
                          <span className="font-bold text-sm text-[#001A4D]">{session.title}</span>
                        </div>
                        <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {session.date}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-gray-200/80">
                        <div>
                          <span className="text-gray-500">Duration:</span>{' '}
                          <strong className="text-gray-800">{session.startTime} - {session.endTime}</strong>
                        </div>
                        <div>
                          <span className="text-gray-500">Time-In Window:</span>{' '}
                          <strong className="text-emerald-700">{session.timeInOpen || '—'} to {session.timeInClose || '—'}</strong>
                        </div>
                        <div>
                          <span className="text-gray-500">Time-Out Window:</span>{' '}
                          <strong className="text-indigo-700">
                            {session.hasTimeOut ? `${session.timeOutOpen || '—'} to ${session.timeOutClose || '—'}` : 'Not Required'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!event.sessions || event.sessions.length === 0) && (
                    <p className="text-xs text-gray-400 text-center py-4">No sessions scheduled.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: TARGET AUDIENCE */}
          <section
            ref={(el) => { sectionRefs.current['participants'] = el; }}
            className="space-y-4"
          >
            <SectionHeader
              title="3. Target Audience & Participant Policies"
              subtitle="Target departments, year levels, expected count, and attendance fine rules"
            />

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">Expected Participants</span>
                  <p className="text-xl font-bold text-[#83358E] mt-0.5">{event.expectedParticipantCount || 0} students</p>
                </div>
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">Attendance Policy</span>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">
                    {event.attendanceEnabled !== false ? 'Required Attendance' : 'Optional'}
                  </p>
                </div>
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">Late / Absent Penalty</span>
                  <p className="text-sm font-bold text-red-600 mt-0.5">
                    {event.latePenaltyAmount ? `₱${event.latePenaltyAmount}.00` : 'None / Default'}
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                    Target Year Levels
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(event.targetYearLevels || []).map((year) => (
                      <span
                        key={year}
                        className="px-3 py-1 bg-[#001A4D] text-[#FFD41C] text-xs font-bold rounded-lg shadow-2xs"
                      >
                        {year}
                      </span>
                    ))}
                    {(!event.targetYearLevels || event.targetYearLevels.length === 0) && (
                      <span className="text-xs text-gray-500 italic">All Year Levels</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                    Target Academic Departments
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {targetDeptNames.map((dept, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-purple-50 text-[#83358E] border border-purple-200 text-xs font-semibold rounded-lg"
                      >
                        {dept}
                      </span>
                    ))}
                    {targetDeptNames.length === 0 && (
                      <span className="text-xs text-gray-500 italic">All Campus Departments</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: EVENT TEAM & SCANNERS */}
          <section
            ref={(el) => { sectionRefs.current['team'] = el; }}
            className="space-y-4"
          >
            <SectionHeader
              title="4. Event Team & Attendance Scanners"
              subtitle="Adviser supervisor and assigned officer scanners with permissions"
            />

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="p-4 bg-gradient-to-br from-[#001A4D] to-[#83358E] rounded-xl text-white flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                    S
                  </div>
                  <div>
                    <p className="font-bold text-sm">SAS Event Supervisor</p>
                    <p className="text-xs text-white/70">Student Affairs and Services Oversight</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-[#FFC107] text-[#001A4D] text-[11px] font-bold rounded-md">
                  Institutional Oversight
                </span>
              </div>

              {/* Scanners Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#001A4D] uppercase tracking-wider">
                    Assigned Scanner Officers ({(event.scanners || []).length})
                  </h4>
                </div>

                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                  {(event.scanners || []).map((scanner, i) => (
                    <div key={scanner.id || i} className="p-3.5 bg-white flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-gray-900">{scanner.officerName || `Scanner Officer ${i + 1}`}</p>
                        <p className="text-gray-400 font-mono text-[11px]">
                          ID: {scanner.officerUserId || 'N/A'} {scanner.organizationName ? `· ${scanner.organizationName}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {scanner.fullAccess ? (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded-md text-[10px]">
                            Full Access
                          </span>
                        ) : (
                          <>
                            {scanner.canCheckIn && (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px]">
                                Check-In
                              </span>
                            )}
                            {scanner.canCheckOut && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px]">
                                Check-Out
                              </span>
                            )}
                            {scanner.allowManualAttendance && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[10px]">
                                Manual Entry
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!event.scanners || event.scanners.length === 0) && (
                    <p className="p-4 text-xs text-gray-400 text-center">No scanner officers assigned.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: BUDGET & FEES */}
          <section
            ref={(el) => { sectionRefs.current['budget'] = el; }}
            className="space-y-4"
          >
            <SectionHeader
              title="5. Budget & Event Fees"
              subtitle="Itemized budget proposal, unit costs, and student fee collections"
            />

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">Total Proposed Budget</span>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">₱{totalRequested.toLocaleString()}</p>
                </div>
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">Student Payables Fee</span>
                  <p className="text-sm font-bold text-[#83358E] mt-0.5">
                    {event.studentPayablesEnabled !== false
                      ? `₱${event.adminFeeOverride || event.suggestedFeePerStudent || 0} / student`
                      : 'Free / Disabled'}
                  </p>
                </div>
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">Approved Budget Ceiling</span>
                  <p className="text-sm font-bold text-[#001A4D] mt-0.5">
                    ₱{(event.totalApprovedBudget || totalRequested).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Budget Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100 font-bold text-gray-700">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Item / Description</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Unit Cost</th>
                      <th className="p-3 text-right">Approved Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {budgetItems.map((bi, i) => (
                      <tr key={i} className="hover:bg-gray-50/80">
                        <td className="p-3 text-gray-400">{i + 1}</td>
                        <td className="p-3">
                          <p className="font-bold text-gray-900">{bi.item}</p>
                          {bi.description && <p className="text-[11px] text-gray-500">{bi.description}</p>}
                        </td>
                        <td className="p-3 text-center">{bi.quantity}</td>
                        <td className="p-3 text-right">₱{(bi.unitCost || 0).toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-[#83358E]">
                          ₱{(bi.approvedAmount || bi.unitCost * bi.quantity || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {budgetItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-400 text-xs">
                          No budget line items proposed.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {budgetItems.length > 0 && (
                    <tfoot className="bg-[#001A4D] text-white font-bold">
                      <tr>
                        <td colSpan={4} className="p-3">Total Requested Budget</td>
                        <td className="p-3 text-right text-[#FFD41C]">₱{totalRequested.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </section>

          {/* SECTION 6: SUBMITTED DOCUMENTS */}
          <section
            ref={(el) => { sectionRefs.current['documents'] = el; }}
            className="space-y-4"
          >
            <SectionHeader
              title="6. Submitted Compliance Documents"
              subtitle="Checklist of official forms, letters, and attached files"
            />

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(event.documents || []).map((doc, idx) => (
                  <div
                    key={doc.id || idx}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-purple-100 text-[#83358E] flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{doc.name}</p>
                        <p className="text-[11px] text-gray-500">
                          {doc.required ? 'Required Compliance File' : 'Supporting Document'}
                        </p>
                      </div>
                    </div>

                    {doc.fileUrl ? (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-[#83358E] text-white hover:bg-[#6D2A78] rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </a>
                    ) : (
                      <span className="text-gray-400 italic text-[11px]">Not uploaded</span>
                    )}
                  </div>
                ))}
                {(!event.documents || event.documents.length === 0) && (
                  <p className="text-xs text-gray-400 col-span-2 text-center py-4">No documents submitted.</p>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 7: PAYABLES & QR GATE TICKETS */}
          <section
            ref={(el) => { sectionRefs.current['payables'] = el; }}
            className="space-y-4"
          >
            <SectionHeader
              title="7. Event Payables & QR Ticket Access Control"
              subtitle="Target participant collection roster, payment settlement, and QR ticket unlocking"
            />

            <div className="space-y-4">
              <EventPayablesQRControl
                eventId={event.id}
                eventTitle={event.title}
                adminFeeAmount={event.adminFeeOverride || event.suggestedFeePerStudent || totalRequested}
                recordedByUid={profile?.studentId || profile?.id || 'officer'}
                isOfficer={true}
                isClubEvent={true}
                hostingOrgName={orgName}
              />
            </div>
          </section>

          {/* SECTION 8: PROPOSAL HISTORY & REMARKS */}
          <section
            ref={(el) => { sectionRefs.current['history'] = el; }}
            className="space-y-4"
          >
            <SectionHeader
              title="8. Proposal History & Review Trail"
              subtitle="Chronological audit history of submissions, adviser reviews, and decisions"
            />

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
              {event.proposalHistory && event.proposalHistory.length > 0 ? (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {event.proposalHistory.map((item, idx) => {
                    const itemDate =
                      item.performedAt && typeof item.performedAt.toDate === 'function'
                        ? item.performedAt.toDate().toLocaleString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—';

                    return (
                      <div key={item.id || idx} className="relative space-y-1.5 text-xs">
                        <div
                          className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 border-white ${
                            item.action === 'approved'
                              ? 'bg-emerald-500'
                              : item.action === 'rejected'
                              ? 'bg-red-500'
                              : item.action === 'returned'
                              ? 'bg-purple-600'
                              : 'bg-blue-500'
                          }`}
                        />
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900 uppercase tracking-wide">
                            {item.action}
                          </span>
                          <span className="text-gray-400 font-mono text-[11px]">{itemDate}</span>
                        </div>
                        {item.reason && (
                          <p className="text-gray-700">
                            <strong>Reason:</strong> {item.reason}
                          </p>
                        )}
                        {item.remarks && (
                          <p className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-gray-700 italic">
                            "{item.remarks}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">No audit logs recorded yet.</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
