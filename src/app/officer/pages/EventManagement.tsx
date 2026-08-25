import { useState, useMemo } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  Edit,
  Trash2,
  Plus,
  Search,
  X,
  Check,
  Clock,
  AlertCircle,
  Tag,
  FileText,
  Eye,
  RotateCcw,
  ArrowUpAZ,
  ArrowDownAZ,
  Coins,
  Building2,
} from 'lucide-react';
import OfficerEventProposalModal from '../components/OfficerEventProposalModal';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useOrgEvents } from '../../modules/events/hooks/useEventStream';
import {
  useEventCategoriesStream,
  useVenuesStream,
} from '../../modules/events/hooks/useEventConfigStream';
import { deleteEvent } from '../../modules/events/services/event.service';
import type { EventDocument } from '../../modules/events/types/event.types';
import { OfficerEventDetailView } from '../../modules/events';
import { formatCurrency } from '../../utils/currency';

type EventStatusTab = 'all' | 'draft' | 'pending' | 'approved' | 'completed' | 'rejected' | 'returned';

// ─── COMPLETE DATE FORMATTING UTILITIES ─────────────────────────────────────
function parseDateSafe(input: any): Date | null {
  if (!input) return null;
  if (typeof input.toDate === 'function') {
    try {
      const d = input.toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  if (typeof input.seconds === 'number') {
    const d = new Date(input.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === 'string') {
    const parsed = new Date(input.trim());
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatFullAppDate(date: any, fallback = 'TBD'): string {
  const parsed = parseDateSafe(date);
  if (!parsed) return fallback;
  try {
    return parsed.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return fallback;
  }
}

function format12HourTime(timeStr?: string): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/i);
  if (!match) return trimmed;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = match[3] ? match[3].toUpperCase() : hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

function formatFullSessionDateTime(dateInput: any, startTime?: string, endTime?: string): string {
  const fullDate = formatFullAppDate(dateInput, 'TBD');
  const startFormatted = format12HourTime(startTime);
  const endFormatted = format12HourTime(endTime);

  if (startFormatted && endFormatted) {
    return `${fullDate} (${startFormatted} - ${endFormatted})`;
  } else if (startFormatted) {
    return `${fullDate} at ${startFormatted}`;
  }
  return fullDate;
}

export default function EventManagement() {
  const [activeStatus, setActiveStatus] = useState<EventStatusTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterVenue, setFilterVenue] = useState('All');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'referenceId' | 'created'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { profile } = useOfficerProfile();
  const { data: orgs } = useOrganizationStream();
  const { categories = [] } = useEventCategoriesStream();
  const { venues = [] } = useVenuesStream();

  const activeOrgId = profile?.activeOrganizationId || '';
  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const activeOrgName = activeOrg ? activeOrg.name : 'My Organization';
  const activeOrgAcronym = activeOrg ? activeOrg.acronym || activeOrg.name.slice(0, 4).toUpperCase() : 'ORG';
  const activeOrgLogo = activeOrg ? (activeOrg as any).logoUrl || (activeOrg as any).logo || '' : '';

  const { events, loading } = useOrgEvents(activeOrgId);

  // Helper maps for Category & Venue names
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const venueMap = useMemo(() => {
    const map = new Map<string, string>();
    venues.forEach((v) => map.set(v.id, v.name));
    return map;
  }, [venues]);

  const statusCounts = {
    all: events.length,
    draft: events.filter((e) => e.proposalStatus === 'draft').length,
    pending: events.filter((e) => e.proposalStatus === 'pending' || e.proposalStatus === 'pending_review').length,
    approved: events.filter((e) => e.proposalStatus === 'approved').length,
    completed: events.filter((e) => e.proposalStatus === 'completed').length,
    rejected: events.filter((e) => e.proposalStatus === 'rejected').length,
    returned: events.filter((e) => e.proposalStatus === 'returned').length,
  };

  // ─── Filter & Sort Events ──────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    return events
      .filter((event) => {
        let statusMatch = true;
        const currentStatus = (event.proposalStatus || 'draft').toLowerCase();

        if (activeStatus === 'draft') statusMatch = currentStatus === 'draft';
        else if (activeStatus === 'pending') statusMatch = currentStatus === 'pending' || currentStatus === 'pending_review';
        else if (activeStatus === 'approved') statusMatch = currentStatus === 'approved';
        else if (activeStatus === 'completed') statusMatch = currentStatus === 'completed';
        else if (activeStatus === 'rejected') statusMatch = currentStatus === 'rejected';
        else if (activeStatus === 'returned') statusMatch = currentStatus === 'returned';

        const q = (searchQuery || '').toLowerCase().trim();
        const titleMatch = !q || (event.title || '').toLowerCase().includes(q);
        const refMatch = (event.referenceId || '').toLowerCase().includes(q);
        const taglineMatch = (event.tagline || '').toLowerCase().includes(q);
        const matchesSearch = titleMatch || refMatch || taglineMatch;

        const matchesCategory =
          filterCategory === 'All' || event.eventCategoryId === filterCategory;

        const matchesVenue =
          filterVenue === 'All' || event.venueId === filterVenue;

        return statusMatch && matchesSearch && matchesCategory && matchesVenue;
      })
      .sort((a, b) => {
        if (sortBy === 'title') {
          const tA = (a.title || '').toLowerCase();
          const tB = (b.title || '').toLowerCase();
          return sortOrder === 'asc' ? tA.localeCompare(tB) : tB.localeCompare(tA);
        } else if (sortBy === 'referenceId') {
          const rA = (a.referenceId || '').toLowerCase();
          const rB = (b.referenceId || '').toLowerCase();
          return sortOrder === 'asc' ? rA.localeCompare(rB) : rB.localeCompare(rA);
        } else if (sortBy === 'created') {
          const cA = (a.createdAt as any)?.seconds || 0;
          const cB = (b.createdAt as any)?.seconds || 0;
          return sortOrder === 'asc' ? cA - cB : cB - cA;
        } else {
          // Default: Event Date (first session date)
          const dateA = a.sessions && a.sessions[0] ? parseDateSafe(a.sessions[0].date)?.getTime() || 0 : 0;
          const dateB = b.sessions && b.sessions[0] ? parseDateSafe(b.sessions[0].date)?.getTime() || 0 : 0;
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        }
      });
  }, [events, activeStatus, searchQuery, filterCategory, filterVenue, sortBy, sortOrder]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this event proposal?')) return;
    setDeletingId(id);
    try {
      await deleteEvent(id);
    } catch (e) {
      console.error(e);
      alert('Failed to delete event proposal.');
    } finally {
      setDeletingId(null);
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="text-gray-500 text-[13px] mb-1">
            Dashboard &gt; Event Management {activeOrgName && <span className="font-semibold text-[#0E4EBD]">({activeOrgName})</span>}
          </div>
          <h1 className="text-[#001A4D] text-2xl md:text-3xl font-extrabold tracking-tight">
            Event Proposals &amp; Management
          </h1>
        </div>
        <button
          onClick={() => {
            setEditingEvent(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-xl text-sm font-bold transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-5 h-5 text-[#FFD41C]" />
          Create Event Proposal
        </button>
      </div>

      {/* ─── Search & Comprehensive Filters Bar ──────────────────────────────── */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input — Placeholder says "Search" */}
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#E0E0E0] rounded-xl text-sm focus:border-[#0E4EBD] focus:ring-2 focus:ring-[#0E4EBD]/20 outline-none"
            />
          </div>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-[#E0E0E0] rounded-xl text-xs font-semibold text-[#001A4D] bg-white outline-none focus:ring-2 focus:ring-[#0E4EBD]/20 cursor-pointer"
          >
            <option value="All">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Venue Filter */}
          <select
            value={filterVenue}
            onChange={(e) => setFilterVenue(e.target.value)}
            className="px-3 py-2 border border-[#E0E0E0] rounded-lg text-xs font-semibold text-[#001A4D] bg-white outline-none focus:ring-2 focus:ring-[#0E4EBD]/20 cursor-pointer"
          >
            <option value="All">All Venues</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          {/* Sort Control */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-[#E0E0E0] rounded-xl px-3 py-1.5">
            <span className="text-xs text-gray-500 font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-[#001A4D] outline-none cursor-pointer"
            >
              <option value="date">Event Date</option>
              <option value="title">Title</option>
              <option value="referenceId">Reference ID</option>
              <option value="created">Created Date</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 hover:bg-gray-200 rounded transition-colors text-[#0E4EBD] font-bold text-xs flex items-center gap-1 cursor-pointer"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? <ArrowUpAZ className="w-4 h-4" /> : <ArrowDownAZ className="w-4 h-4" />}
              <span>{sortOrder === 'asc' ? 'ASC' : 'DESC'}</span>
            </button>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-t border-gray-100 pt-3">
          {[
            { key: 'all', label: 'All Events' },
            { key: 'draft', label: 'Drafts' },
            { key: 'pending', label: 'Pending Review' },
            { key: 'returned', label: 'Returned' },
            { key: 'approved', label: 'Approved' },
            { key: 'completed', label: 'Completed' },
            { key: 'rejected', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key as EventStatusTab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeStatus === tab.key
                  ? 'bg-[#001A4D] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-[#0E4EBD]'
              }`}
            >
              {tab.label} ({statusCounts[tab.key as EventStatusTab]})
            </button>
          ))}
        </div>
      </div>

      {/* ─── EVENT CARDS GRID (ADMIN APPROVALS STYLE) ─────────────────────────── */}
      {loading ? (
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-12 text-center text-gray-500 shadow-xs">
          Loading event proposals from database...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-12 text-center shadow-xs">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-3" />
          <h3 className="font-bold text-[#001A4D] text-base">No Event Proposals Found</h3>
          <p className="text-gray-500 text-xs mt-1">
            No events match your current filter and search settings.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => {
            const isPending = event.proposalStatus === 'pending_review' || event.proposalStatus === 'pending';
            const isApproved = event.proposalStatus === 'approved';
            const isRejected = event.proposalStatus === 'rejected';
            const isReturned = event.proposalStatus === 'returned';
            const isDraft = event.proposalStatus === 'draft';
            const isCompleted = event.proposalStatus === 'completed';

            const categoryName = categoryMap.get(event.eventCategoryId || '') || event.eventCategoryId || '';
            const venueName = venueMap.get(event.venueId || '') || event.eventFormat || 'On-Campus';
            const totalBudget = (event.budgetItems || []).reduce((sum, b) => sum + (Number(b.totalCost) || 0), 0);

            return (
              <div
                key={event.id}
                className="border border-[#E5E7EB] hover:border-[#0E4EBD]/40 hover:shadow-lg transition-all duration-200 bg-white overflow-hidden rounded-xl shadow-2xs"
              >
                {/* ── Top Organization Header & Status Bar ── */}
                <div className="px-4 py-3 sm:px-5 sm:py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-slate-50/80">
                  <div className="flex items-center gap-3.5">
                    {activeOrgLogo ? (
                      <img
                        src={activeOrgLogo}
                        alt={activeOrgAcronym}
                        className="w-11 h-11 rounded-xl object-contain border border-gray-200 shadow-2xs flex-shrink-0 bg-white p-0.5"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shadow-2xs flex-shrink-0 bg-gradient-to-br from-[#001A4D] via-[#002B7F] to-[#0E4EBD] text-[#FFD41C]">
                        {activeOrgAcronym.slice(0, 3)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-base sm:text-lg text-[#001A4D] tracking-tight">
                          {activeOrgName}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-black rounded-md bg-blue-100/90 text-[#0E4EBD]">
                          {activeOrgAcronym}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 font-medium mt-0.5">
                        <span>
                          Ref ID:{' '}
                          <strong className="font-mono text-gray-900 font-bold">
                            {event.referenceId || event.id.slice(0, 10)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Proposal Status Badge */}
                  <span
                    className={`px-4 py-1 text-xs font-black rounded-full shadow-2xs ${
                      isPending
                        ? 'bg-amber-400 text-[#001A4D]'
                        : isApproved
                        ? 'bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white'
                        : isRejected
                        ? 'bg-gradient-to-r from-[#EF4444] to-[#F97316] text-white'
                        : isReturned
                        ? 'bg-amber-500 text-white'
                        : isCompleted
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {isPending
                      ? 'Pending Review'
                      : isApproved
                      ? 'Approved'
                      : isRejected
                      ? 'Rejected'
                      : isReturned
                      ? 'Returned for Revision'
                      : isDraft
                      ? 'Draft Proposal'
                      : event.proposalStatus}
                  </span>
                </div>

                {/* ── Main Content Body ── */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Event Title & Badges */}
                  <div className="space-y-1.5">
                    <h3 className="font-black text-[#001A4D] text-lg sm:text-xl tracking-tight leading-snug">
                      {event.title}
                    </h3>
                    {event.tagline && (
                      <p className="text-xs sm:text-sm text-gray-700 italic font-medium">
                        "{event.tagline}"
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {categoryName && (
                        <span className="bg-slate-100 text-gray-800 text-xs font-bold px-3 py-1 rounded-md border border-slate-300 inline-flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-[#0E4EBD]" />
                          {categoryName}
                        </span>
                      )}
                      {event.sessions && event.sessions.length > 0 && (
                        <span className="bg-purple-50 text-purple-800 text-xs font-bold px-3 py-1 rounded-md border border-purple-300 inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-purple-600" />
                          {event.sessions.length} Session{event.sessions.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {event.enableQRTickets && (
                        <span className="bg-blue-50 text-blue-800 text-xs font-bold px-3 py-1 rounded-md border border-blue-300">
                          QR Tickets Enabled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rejection / Returned Reason Alert Box */}
                  {(isRejected || isReturned) && event.rejectionReason && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg text-xs text-red-800 font-medium">
                      <span className="font-bold">Officer Action Note:</span> {event.rejectionReason}
                    </div>
                  )}

                  {/* Complete Format Sessions Schedule & Key Info Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-800 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                    {/* Event Schedule & Sessions (Complete Date Format) */}
                    <div className="col-span-full space-y-2">
                      <span className="text-[11px] uppercase text-gray-500 font-black tracking-wider flex items-center gap-1.5">
                        <Calendar
                          className={`w-3.5 h-3.5 ${
                            isPending
                              ? 'text-[#0E4EBD]'
                              : isApproved
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        />
                        Event Schedule &amp; Sessions ({event.sessions?.length || 0})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {event.sessions && event.sessions.length > 0 ? (
                          event.sessions.map((sess, idx) => (
                            <div
                              key={sess.id || idx}
                              className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-center"
                            >
                              <span className="font-extrabold text-[#001A4D] text-xs">
                                {sess.title || `Session ${idx + 1}`}
                              </span>
                              {/* Complete Date Format */}
                              <span className="text-gray-700 font-bold font-mono text-[11px] mt-0.5">
                                {formatFullSessionDateTime(sess.date, sess.startTime, sess.endTime)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs text-gray-500 italic">
                            No session schedule set
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Venue */}
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      <div>
                        <span className="text-[10px] uppercase text-gray-500 font-extrabold block tracking-wider">
                          Venue
                        </span>
                        <strong className="text-gray-900 font-bold text-xs">{venueName}</strong>
                      </div>
                    </div>

                    {/* Expected Reach */}
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <span className="text-[10px] uppercase text-gray-500 font-extrabold block tracking-wider">
                          Expected Reach
                        </span>
                        <strong className="text-gray-900 font-bold text-xs">
                          {event.expectedParticipantCount || 0} Participants
                        </strong>
                      </div>
                    </div>

                    {/* Submitted Documents */}
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <div>
                        <span className="text-[10px] uppercase text-gray-500 font-extrabold block tracking-wider">
                          Attached Files
                        </span>
                        <strong className="text-gray-900 font-bold text-xs">
                          {event.documents?.length || 0} File(s)
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Footer Actions */}
                  <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100">
                    <button
                      onClick={() => setSelectedEventId(event.id)}
                      className="px-4 py-2 bg-[#001A4D] hover:bg-[#0E4EBD] text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-[#FFD41C]" /> View Full Proposal Details
                    </button>

                    <div className="flex items-center gap-3 ml-auto">
                      {totalBudget > 0 && (
                        <div className="px-3 py-1 bg-green-50 border border-green-200 rounded-lg text-right">
                          <span className="text-[10px] uppercase text-green-700 font-bold block">Total Budget</span>
                          <span className="text-xs font-black font-mono text-green-800">
                            {formatCurrency(totalBudget)}
                          </span>
                        </div>
                      )}

                      {(isDraft || isReturned || (isRejected && event.allowResubmission !== false)) && (
                        <button
                          onClick={() => {
                            setEditingEvent(event);
                            setShowCreateModal(true);
                          }}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#0E4EBD] rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title={
                            isReturned
                              ? "Revise & Resubmit Proposal"
                              : "Edit Proposal"
                          }
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit Proposal
                        </button>
                      )}

                      {!isApproved && (
                        <button
                          onClick={() => handleDelete(event.id)}
                          disabled={deletingId === event.id}
                          className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Delete Proposal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Event Modal */}
      {showCreateModal && (
        <OfficerEventProposalModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditingEvent(null);
          }}
          initialDraft={editingEvent || undefined}
          draftId={editingEvent?.id}
        />
      )}

      {/* Rich Officer Event Detail View */}
      {selectedEvent && (
        <OfficerEventDetailView
          event={selectedEvent}
          onClose={() => setSelectedEventId(null)}
          onEdit={() => {
            setEditingEvent(selectedEvent);
            setSelectedEventId(null);
            setShowCreateModal(true);
          }}
        />
      )}
    </div>
  );
}
