import { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Edit,
  Trash2,
  Plus,
  Search,
  Eye,
  Filter,
  RotateCcw,
  Clock,
  Download
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
import { toast } from 'sonner';
import { TablePagination } from '../../components/common/TablePagination';

type EventStatusTab = 'all' | 'draft' | 'pending' | 'approved' | 'completed' | 'rejected' | 'returned';
const ITEMS_PER_PAGE = 8;

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

function formatShortDate(dateInput: any): string {
  const d = parseDateSafe(dateInput);
  if (!d) return 'TBD';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSubmittedDate(dateInput: any): string {
  const d = parseDateSafe(dateInput);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getEventTimestamp(event: EventDocument): number {
  const c = parseDateSafe(event.createdAt);
  if (c) return c.getTime();
  if (event.sessions && event.sessions[0]) {
    const s = parseDateSafe(event.sessions[0].date);
    if (s) return s.getTime();
  }
  const u = parseDateSafe(event.updatedAt);
  if (u) return u.getTime();
  return 0;
}

export default function EventManagement() {
  const [activeStatus, setActiveStatus] = useState<EventStatusTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterVenue, setFilterVenue] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

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

  const { events, loading } = useOrgEvents(activeOrgId);

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

  // Filtered & Sorted (LATEST FIRST by default)
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

        const matchesCategory = filterCategory === 'All' || event.eventCategoryId === filterCategory;
        const matchesVenue = filterVenue === 'All' || event.venueId === filterVenue;

        return statusMatch && matchesSearch && matchesCategory && matchesVenue;
      })
      .sort((a, b) => getEventTimestamp(b) - getEventTimestamp(a));
  }, [events, activeStatus, searchQuery, filterCategory, filterVenue]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEvents.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEvents, currentPage]);

  const handleTabChange = (tab: EventStatusTab) => {
    setActiveStatus(tab);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCategory, filterVenue]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this event proposal?')) return;
    setDeletingId(id);
    try {
      await deleteEvent(id);
      toast.success('Event proposal deleted.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete event proposal.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCSV = () => {
    if (filteredEvents.length === 0) {
      toast.info(`No ${activeStatus === 'all' ? '' : activeStatus + ' '}events to export.`);
      return;
    }
    const headers = ['Event Title', 'Category', 'Date', 'Venue', 'Total Budget', 'Submitted', 'Status'];
    const rows = filteredEvents.map((e) => {
      const firstDate = e.sessions && e.sessions[0] ? formatShortDate(e.sessions[0].date) : 'TBD';
      const venueName = venueMap.get(e.venueId || '') || e.eventFormat || 'On-Campus';
      const totalBudget = (e.budgetItems || []).reduce((sum, b) => sum + (Number(b.totalCost) || 0), 0);
      return [
        `"${(e.title || '').replace(/"/g, '""')}"`,
        `"${categoryMap.get(e.eventCategoryId || '') || 'General'}"`,
        `"${firstDate}"`,
        `"${venueName}"`,
        `"${totalBudget}"`,
        `"${formatSubmittedDate(e.createdAt)}"`,
        `"${e.proposalStatus || 'draft'}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeOrgAcronym}_Events_${activeStatus.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredEvents.length} ${activeStatus === 'all' ? '' : activeStatus + ' '}event(s) to CSV.`);
  };

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        );
      case 'pending':
      case 'pending_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pending Review
          </span>
        );
      case 'returned':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Returned
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Rejected
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Completed
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

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="space-y-5 w-full">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-gray-500 text-xs mb-1">
            Dashboard &gt; Event Management {activeOrgName && <span className="font-semibold text-[#001A4D]">({activeOrgName})</span>}
          </div>
          <h1 className="text-2xl font-bold text-[#001A4D] tracking-tight">
            Event Proposals &amp; Management
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Create, manage, and submit event proposals for Student Affairs review
          </p>

          {/* Metric Summary Badges */}
          <div className="flex flex-wrap items-center gap-2.5 mt-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50/80 border border-amber-200 rounded-lg text-xs font-bold text-amber-800">
              <span className="font-extrabold text-amber-900">{statusCounts.pending}</span> Pending Review
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800">
              <span className="font-extrabold text-emerald-900">{statusCounts.approved}</span> Approved
            </div>
            {statusCounts.returned > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50/80 border border-amber-300 rounded-lg text-xs font-bold text-amber-900">
                <span className="font-extrabold">{statusCounts.returned}</span> Returned
              </div>
            )}
            {statusCounts.rejected > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50/80 border border-red-200 rounded-lg text-xs font-bold text-red-800">
                <span className="font-extrabold text-red-900">{statusCounts.rejected}</span> Rejected
              </div>
            )}
          </div>
        </div>

        {/* Solid button without gradients */}
        <button
          onClick={() => {
            setEditingEvent(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#001A4D] hover:bg-[#002D72] text-white rounded-xl text-sm font-bold transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-[#FFD41C]" />
          Create Event Proposal
        </button>
      </div>

      {/* ── Main Container: Tabs + Search + Fixed Height Table + Pagination ── */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden">
        {/* Top Control Bar */}
        <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {[
              { key: 'all', label: 'All', count: statusCounts.all },
              { key: 'pending', label: 'Pending', count: statusCounts.pending },
              { key: 'approved', label: 'Approved', count: statusCounts.approved },
              { key: 'returned', label: 'Returned', count: statusCounts.returned },
              { key: 'completed', label: 'Completed', count: statusCounts.completed },
              { key: 'rejected', label: 'Rejected', count: statusCounts.rejected },
              { key: 'draft', label: 'Drafts', count: statusCounts.draft },
            ].map((tab) => {
              const isActive = activeStatus === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key as EventStatusTab)}
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
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#001A4D]/10 focus:border-[#001A4D]"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                showFilters || filterCategory !== 'All' || filterVenue !== 'All'
                  ? 'border-[#001A4D] bg-[#001A4D]/5 text-[#001A4D]'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {/* Export Button */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Export events to CSV"
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
              <span className="text-gray-500 font-semibold mr-1.5">Category:</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 outline-none focus:border-[#001A4D]"
              >
                <option value="All">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-gray-500 font-semibold mr-1.5">Venue:</span>
              <select
                value={filterVenue}
                onChange={(e) => setFilterVenue(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 outline-none focus:border-[#001A4D]"
              >
                <option value="All">All Venues</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            {(filterCategory !== 'All' || filterVenue !== 'All') && (
              <button
                onClick={() => {
                  setFilterCategory('All');
                  setFilterVenue('All');
                }}
                className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Filters
              </button>
            )}
          </div>
        )}

        {/* ── Table Container (No inner vertical scroll) ── */}
        <div className="overflow-x-auto relative">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Loading event proposals...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto" />
              <div className="font-bold text-gray-700 text-sm">No event proposals found</div>
              <p className="text-xs text-gray-400 max-w-sm">
                No events match the selected status or search filter. Click "+ Create Event Proposal" to get started.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50/90 text-gray-500 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200 sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Venue</th>
                  <th className="py-3 px-4">Budget</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-normal">
                {paginatedItems.map((event) => {
                  const categoryName = categoryMap.get(event.eventCategoryId || '') || 'General';
                  const venueName = venueMap.get(event.venueId || '') || event.eventFormat || 'On-Campus';
                  const totalBudget = (event.budgetItems || []).reduce((sum, b) => sum + (Number(b.totalCost) || 0), 0);
                  const firstSessionDate = event.sessions && event.sessions[0] ? formatShortDate(event.sessions[0].date) : 'TBD';

                  const isRejected = event.proposalStatus === 'rejected';
                  const isReturned = event.proposalStatus === 'returned';
                  const isDraft = event.proposalStatus === 'draft';
                  const isApproved = event.proposalStatus === 'approved';

                  return (
                    <tr key={event.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Event Title */}
                      <td className="py-3.5 px-4 max-w-[240px]">
                        <div className="font-bold text-gray-900 text-sm leading-snug truncate">
                          {event.title}
                        </div>
                        {(isRejected || isReturned) && event.rejectionReason ? (
                          <div className="text-[11px] text-red-600 font-medium truncate mt-0.5">
                            Note: {event.rejectionReason}
                          </div>
                        ) : event.referenceId ? (
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                            Ref: {event.referenceId}
                          </div>
                        ) : null}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 inline-block">
                          {categoryName}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-gray-600 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>{firstSessionDate}</span>
                        </div>
                      </td>

                      {/* Venue */}
                      <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap max-w-[160px] truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{venueName}</span>
                        </div>
                      </td>

                      {/* Budget */}
                      <td className="py-3.5 px-4 font-bold text-gray-900 whitespace-nowrap text-sm">
                        {formatCurrency(totalBudget)}
                      </td>

                      {/* Submitted */}
                      <td className="py-3.5 px-4 text-gray-500 text-xs whitespace-nowrap">
                        {formatSubmittedDate(event.createdAt)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(event.proposalStatus)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedEventId(event.id)}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-[#001A4D] hover:text-white text-gray-700 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="View Proposal Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          {(isDraft || isReturned || (isRejected && event.allowResubmission !== false)) && (
                            <button
                              onClick={() => {
                                setEditingEvent(event);
                                setShowCreateModal(true);
                              }}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#001A4D] border border-blue-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Edit Proposal"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          )}

                          {!isApproved && (
                            <button
                              onClick={() => handleDelete(event.id)}
                              disabled={deletingId === event.id}
                              className="p-1 hover:bg-red-50 text-red-600 rounded-lg transition-colors cursor-pointer"
                              title="Delete Proposal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredEvents.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          itemName="events"
        />
      </div>

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
