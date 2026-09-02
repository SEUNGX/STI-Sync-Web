import { useState, useMemo, useEffect } from "react";
import { useOutletContext, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  Calendar, Plus, Eye, Search, ChevronLeft, ChevronRight,
  Filter, ChevronDown, RotateCcw, MapPin, Download,
  Clock, FileEdit, CheckCircle2, XCircle
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import SaoEventCreationModal from "../components/SaoEventCreationModal";
import EventProposalReview from "../components/EventProposalReview";

import { useAllEvents, useDraftEvents } from "../../modules/events/hooks/useEventStream";
import { useOrganizationStream } from "../../modules/organizations/hooks/useOrganizationStream";
import { useEventCategoriesStream, useVenuesStream } from "../../modules/events/hooks/useEventConfigStream";
import type { EventDocument } from "../../modules/events/types/event.types";
import { formatCurrency } from "../../utils/currency";
import { formatAppDateTime } from "../../utils/date";
import stiOrmocLogo from "../../../imports/STI_ORMOC_LOGO.jpg";
import { TablePagination } from "../../components/common/TablePagination";

const ITEMS_PER_PAGE = 8;

type TabValue = "all" | "pending" | "approved" | "completed" | "rejected" | "drafts";
type DateRangeOption = "all" | "this_week" | "this_month" | "custom";

function isWithinDateRange(
  dateStr: string | undefined,
  range: DateRangeOption,
  customFrom: string,
  customTo: string
): boolean {
  if (!dateStr || range === "all") return true;
  const date = new Date(dateStr);
  const today = new Date();

  if (range === "this_week") {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return date >= startOfWeek && date <= endOfWeek;
  }

  if (range === "this_month") {
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth()
    );
  }

  if (range === "custom") {
    const from = customFrom ? new Date(customFrom) : null;
    const to = customTo ? new Date(customTo) : null;
    if (from && date < from) return false;
    if (to) {
      const toEnd = new Date(to);
      toEnd.setHours(23, 59, 59, 999);
      if (date > toEnd) return false;
    }
    return true;
  }

  return true;
}

function getFirstSessionDate(event: EventDocument): string | undefined {
  return event.sessions && event.sessions.length > 0 ? event.sessions[0].date : undefined;
}

function getLastSessionDate(event: EventDocument): string | undefined {
  if (!event.sessions || event.sessions.length === 0) return undefined;
  return event.sessions[event.sessions.length - 1].date;
}

function isEventPast(event: EventDocument): boolean {
  const lastDate = getLastSessionDate(event);
  if (!lastDate) return false;
  return new Date(lastDate) < new Date(new Date().toDateString());
}

function getEventTimestamp(event: EventDocument): number {
  if (event.createdAt) {
    if (typeof (event.createdAt as any).toDate === "function") return (event.createdAt as any).toDate().getTime();
    if (typeof (event.createdAt as any).seconds === "number") return (event.createdAt as any).seconds * 1000;
    const d = new Date(event.createdAt as any);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  const firstSession = getFirstSessionDate(event);
  if (firstSession) {
    const d = new Date(firstSession);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  if (event.updatedAt) {
    if (typeof (event.updatedAt as any).toDate === "function") return (event.updatedAt as any).toDate().getTime();
    if (typeof (event.updatedAt as any).seconds === "number") return (event.updatedAt as any).seconds * 1000;
    const d = new Date(event.updatedAt as any);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return 0;
}

function formatShortDate(dateStr?: any): string {
  if (!dateStr) return "TBD";
  let d: Date | null = null;
  if (typeof dateStr.toDate === "function") d = dateStr.toDate();
  else if (typeof dateStr.seconds === "number") d = new Date(dateStr.seconds * 1000);
  else d = new Date(dateStr);

  if (!d || isNaN(d.getTime())) return "TBD";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatSubmittedDate(dateStr?: any): string {
  if (!dateStr) return "—";
  let d: Date | null = null;
  if (typeof dateStr.toDate === "function") d = dateStr.toDate();
  else if (typeof dateStr.seconds === "number") d = new Date(dateStr.seconds * 1000);
  else d = new Date(dateStr);

  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function EventApprovals() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<EventDocument | null>(null);
  const [modalKey, setModalKey] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<EventDocument | null>(null);

  const { globalSearch } = useOutletContext<{ globalSearch: string }>() || { globalSearch: "" };
  const [localSearch, setLocalSearch] = useState("");
  const searchQuery = localSearch || globalSearch || "";

  const [searchParams] = useSearchParams();
  const targetId = searchParams.get("id") || searchParams.get("eventId");

  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [filterOrg, setFilterOrg] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<DateRangeOption>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // ── Data streams ─────────────────────────────────────────────────────────
  const { events, loading: eventsLoading } = useAllEvents();
  const { drafts, loading: draftsLoading } = useDraftEvents();
  const { data: orgs } = useOrganizationStream();
  const { categories } = useEventCategoriesStream();
  const { venues } = useVenuesStream();

  useEffect(() => {
    if (targetId && events.length > 0) {
      const target = events.find((e) => e.id === targetId);
      if (target) {
        setSelectedEvent(target);
      }
    }
  }, [targetId, events]);

  const handleTabChange = (value: TabValue) => {
    setActiveTab(value);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterOrg, filterDateRange, filterCategory, customFrom, customTo]);

  const getOrgName = (orgId: string) => {
    if (["sas", "sas_admin", "sao", "sao_admin"].includes(orgId)) return "Student Affairs & Services";
    const found = orgs.find((o) => o.id === orgId);
    return found ? (found.name || found.acronym || orgId) : orgId || "Student Org";
  };

  const getOrgAcronym = (orgId: string) => {
    if (["sas", "sas_admin", "sao", "sao_admin"].includes(orgId)) return "SAS";
    const found = orgs.find((o) => o.id === orgId);
    return found ? (found.acronym || found.name.slice(0, 4).toUpperCase()) : "ORG";
  };

  const getOrgLogo = (orgId: string) => {
    if (["sas", "sas_admin", "sao", "sao_admin"].includes(orgId) || !orgId) return stiOrmocLogo;
    return orgs.find((o) => o.id === orgId)?.logoUrl || null;
  };

  const getCategoryName = (catId: string) => categories.find((c) => c.id === catId)?.name || "General";
  const getVenueName = (venueId?: string) => {
    if (!venueId) return "Off-Campus";
    return venues.find((v) => v.id === venueId)?.name || venueId;
  };

  // Draft Deduplication
  const nonDraftRefs = useMemo(() => {
    const refs = new Set<string>();
    events.forEach((e) => {
      if (e.id) refs.add(e.id);
      if (e.referenceId) refs.add(e.referenceId);
      if (e.title) refs.add(e.title.trim().toLowerCase());
    });
    return refs;
  }, [events]);

  // Filtered event list (Sorted LATEST FIRST by default)
  const filteredEvents = useMemo(() => {
    return events
      .filter((event) => {
        // Tab filter
        if (activeTab === "pending" && event.proposalStatus !== "pending" && event.proposalStatus !== "pending_review") return false;
        if (activeTab === "approved" && (event.proposalStatus !== "approved" || isEventPast(event))) return false;
        if (activeTab === "completed" && (event.proposalStatus !== "approved" || !isEventPast(event))) return false;
        if (activeTab === "rejected" && event.proposalStatus !== "rejected") return false;
        if (activeTab === "drafts") return false;

        // Organization filter
        if (filterOrg !== "all" && event.hostingOrgId !== filterOrg) return false;

        // Category filter
        if (filterCategory !== "all" && event.eventCategoryId !== filterCategory) return false;

        // Date range filter
        const firstDate = getFirstSessionDate(event);
        if (!isWithinDateRange(firstDate, filterDateRange, customFrom, customTo)) return false;

        // Search filter
        const q = searchQuery.toLowerCase().trim();
        if (q) {
          const titleMatch = event.title?.toLowerCase().includes(q);
          const refMatch = event.referenceId?.toLowerCase().includes(q);
          const orgMatch = getOrgName(event.hostingOrgId).toLowerCase().includes(q);
          const venueMatch = getVenueName(event.venueId).toLowerCase().includes(q);
          if (!titleMatch && !refMatch && !orgMatch && !venueMatch) return false;
        }

        return true;
      })
      .sort((a, b) => getEventTimestamp(b) - getEventTimestamp(a));
  }, [events, searchQuery, activeTab, filterOrg, filterDateRange, filterCategory, customFrom, customTo]);

  // Filtered drafts list (Sorted LATEST FIRST)
  const filteredDrafts = useMemo(() => {
    return drafts
      .filter((draft) => {
        if (draft.id && nonDraftRefs.has(draft.id)) return false;
        if (draft.referenceId && nonDraftRefs.has(draft.referenceId)) return false;
        if (draft.title && nonDraftRefs.has(draft.title.trim().toLowerCase())) return false;

        if (filterOrg !== "all" && draft.hostingOrgId !== filterOrg) return false;
        if (filterCategory !== "all" && draft.eventCategoryId !== filterCategory) return false;
        const q = searchQuery.toLowerCase().trim();
        if (q && !draft.title?.toLowerCase().includes(q) && !draft.referenceId?.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => getEventTimestamp(b) - getEventTimestamp(a));
  }, [drafts, nonDraftRefs, filterOrg, filterCategory, searchQuery]);

  // Counts
  const allCount = events.length;
  const pendingCount = events.filter((e) => e.proposalStatus === "pending" || e.proposalStatus === "pending_review").length;
  const approvedCount = events.filter((e) => e.proposalStatus === "approved" && !isEventPast(e)).length;
  const completedCount = events.filter((e) => e.proposalStatus === "approved" && isEventPast(e)).length;
  const rejectedCount = events.filter((e) => e.proposalStatus === "rejected").length;
  const draftsCount = filteredDrafts.length;

  // Active list & Pagination
  const activeList = activeTab === "drafts" ? filteredDrafts : filteredEvents;
  const totalPages = Math.max(1, Math.ceil(activeList.length / ITEMS_PER_PAGE));

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return activeList.slice(start, start + ITEMS_PER_PAGE);
  }, [activeList, currentPage]);

  const handleResumeDraft = (draft: EventDocument) => {
    setResumeDraft(draft);
    setModalKey(Date.now());
    setIsModalOpen(true);
  };

  const handleExportCSV = () => {
    if (activeList.length === 0) {
      toast.info(`No ${activeTab === "all" ? "" : activeTab + " "}events to export.`);
      return;
    }
    const headers = ["Event Title", "Organization", "Category", "Date", "Venue", "Budget", "Submitted", "Status"];
    const rows = (activeList as EventDocument[]).map((e) => [
      `"${(e.title || "").replace(/"/g, '""')}"`,
      `"${getOrgAcronym(e.hostingOrgId || "")}"`,
      `"${getCategoryName(e.eventCategoryId || "")}"`,
      `"${getFirstSessionDate(e) || "TBD"}"`,
      `"${getVenueName(e.venueId)}"`,
      `"${e.totalRequestedBudget || e.totalApprovedBudget || 0}"`,
      `"${formatSubmittedDate(e.createdAt)}"`,
      `"${e.proposalStatus || (activeTab === "drafts" ? "draft" : "pending")}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `STI_Sync_Events_${activeTab.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${activeList.length} ${activeTab === "all" ? "" : activeTab + " "}event(s) to CSV.`);
  };

  const resetFilters = () => {
    setFilterOrg("all");
    setFilterDateRange("all");
    setFilterCategory("all");
    setCustomFrom("");
    setCustomTo("");
    setLocalSearch("");
  };

  const hasActiveFilters = filterOrg !== "all" || filterDateRange !== "all" || filterCategory !== "all" || searchQuery !== "";

  const renderStatusBadge = (status?: string, event?: EventDocument) => {
    if (activeTab === "drafts" || status === "draft") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          Draft
        </span>
      );
    }

    if (status === "pending" || status === "pending_review") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Pending
        </span>
      );
    }

    if (status === "approved") {
      if (event && isEventPast(event)) {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Completed
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Approved
        </span>
      );
    }

    if (status === "rejected") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Rejected
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        {status || "Unknown"}
      </span>
    );
  };

  const isLoading = activeTab === "drafts" ? draftsLoading : eventsLoading;

  return (
    <div className="space-y-5 w-full">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#001A4D] tracking-tight">Event Approvals</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Review and approve event proposals from student organizations
          </p>

          {/* Metric Summary Badges */}
          <div className="flex flex-wrap items-center gap-2.5 mt-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50/80 border border-amber-200 rounded-lg text-xs font-bold text-amber-800">
              <span className="font-extrabold text-amber-900">{pendingCount}</span> Pending Review
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800">
              <span className="font-extrabold text-emerald-900">{approvedCount}</span> Approved
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50/80 border border-red-200 rounded-lg text-xs font-bold text-red-800">
              <span className="font-extrabold text-red-900">{rejectedCount}</span> Rejected
            </div>
          </div>
        </div>

        {/* Solid button without gradients */}
        <Button
          onClick={() => {
            setResumeDraft(null);
            setModalKey(Date.now());
            setIsModalOpen(true);
          }}
          className="bg-[#001A4D] hover:bg-[#002D72] text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-[#FFD41C]" />
          Create SAO Event
        </Button>
      </div>

      {/* ── Main Container: Filters + Fixed Table + Pagination ── */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden">
        {/* Top Control Bar: Tabs on Left, Search & Actions on Right */}
        <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {[
              { key: "all", label: "All", count: allCount },
              { key: "pending", label: "Pending", count: pendingCount },
              { key: "approved", label: "Approved", count: approvedCount },
              { key: "rejected", label: "Rejected", count: rejectedCount },
              { key: "completed", label: "Completed", count: completedCount },
              { key: "drafts", label: "Drafts", count: draftsCount },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key as TabValue)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-[#001A4D] text-white shadow-xs"
                      : "bg-gray-100/80 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-gray-200/80 text-gray-700"
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
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#001A4D]/10 focus:border-[#001A4D]"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                showFilters || hasActiveFilters
                  ? "border-[#001A4D] bg-[#001A4D]/5 text-[#001A4D]"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {/* Export Button */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Export filtered list to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Expandable Filter Drawer */}
        {showFilters && (
          <div className="p-4 bg-gray-50/60 border-b border-gray-200 flex flex-wrap items-center gap-3 text-xs">
            <div>
              <span className="text-gray-500 font-semibold mr-1.5">Org:</span>
              <select
                value={filterOrg}
                onChange={(e) => setFilterOrg(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 outline-none focus:border-[#001A4D]"
              >
                <option value="all">All Organizations</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.acronym || o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-gray-500 font-semibold mr-1.5">Category:</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 outline-none focus:border-[#001A4D]"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-gray-500 font-semibold mr-1.5">Date:</span>
              <select
                value={filterDateRange}
                onChange={(e) => setFilterDateRange(e.target.value as DateRangeOption)}
                className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 outline-none focus:border-[#001A4D]"
              >
                <option value="all">All Time</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {filterDateRange === "custom" && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-32 h-7 text-xs bg-white"
                />
                <span className="text-gray-400">to</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-32 h-7 text-xs bg-white"
                />
              </div>
            )}

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="ml-auto text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Filters
              </button>
            )}
          </div>
        )}

        {/* ── Table Container (No inner vertical scroll) ── */}
        <div className="overflow-x-auto relative">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Loading events...
            </div>
          ) : activeList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto" />
              <div className="font-bold text-gray-700 text-sm">No events found</div>
              <p className="text-xs text-gray-400 max-w-sm">
                {activeTab === "drafts"
                  ? "No saved drafts. You can create a new SAO event and save as draft."
                  : "No events match the current filter or search criteria."}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50/90 text-gray-500 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200 sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Venue</th>
                  <th className="py-3 px-4">Budget</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-normal">
                {activeTab === "drafts" ? (
                  (paginatedItems as EventDocument[]).map((draft) => (
                    <tr key={draft.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 text-sm leading-snug">
                          {draft.title || "Untitled Draft"}
                        </div>
                        {draft.referenceId && (
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                            Ref: {draft.referenceId}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                            {getOrgAcronym(draft.hostingOrgId || "").slice(0, 2)}
                          </div>
                          <span className="font-semibold text-gray-800 text-xs">
                            {getOrgAcronym(draft.hostingOrgId || "")}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700">
                          {getCategoryName(draft.eventCategoryId || "")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>{formatShortDate(getFirstSessionDate(draft))}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span>{getVenueName(draft.venueId)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gray-900">
                        {formatCurrency(draft.totalRequestedBudget || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                        {formatSubmittedDate(draft.updatedAt || draft.createdAt)}
                      </td>
                      <td className="py-3.5 px-4">
                        {renderStatusBadge("draft", draft)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleResumeDraft(draft)}
                          className="bg-[#001A4D] hover:bg-[#002D72] text-white text-xs font-bold px-3 py-1 rounded-lg shadow-xs cursor-pointer"
                        >
                          Resume Draft
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  (paginatedItems as EventDocument[]).map((event) => {
                    const orgAcronym = getOrgAcronym(event.hostingOrgId);
                    const orgLogo = getOrgLogo(event.hostingOrgId);
                    const isRejected = event.proposalStatus === "rejected";

                    return (
                      <tr key={event.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Event Title */}
                        <td className="py-3.5 px-4 max-w-[220px]">
                          <div className="font-bold text-gray-900 text-sm leading-snug truncate">
                            {event.title}
                          </div>
                          {isRejected && event.rejectionReason ? (
                            <div className="text-[11px] text-red-600 font-medium truncate mt-0.5">
                              {event.rejectionReason}
                            </div>
                          ) : event.referenceId ? (
                            <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                              Ref: {event.referenceId}
                            </div>
                          ) : null}
                        </td>

                        {/* Organization */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            {orgLogo ? (
                              <img
                                src={orgLogo}
                                alt={orgAcronym}
                                className="w-6 h-6 rounded-full object-contain border border-gray-200 bg-white p-0.5 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-[#001A4D] text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                                {orgAcronym.slice(0, 2)}
                              </div>
                            )}
                            <span className="font-bold text-gray-800 text-xs">
                              {orgAcronym}
                            </span>
                          </div>
                        </td>

                        {/* Type / Category */}
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 inline-block">
                            {getCategoryName(event.eventCategoryId || "")}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-gray-600 font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span>{formatShortDate(getFirstSessionDate(event))}</span>
                          </div>
                        </td>

                        {/* Venue */}
                        <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap max-w-[160px] truncate">
                          <div className="flex items-center gap-1.5 truncate">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{getVenueName(event.venueId)}</span>
                          </div>
                        </td>

                        {/* Budget */}
                        <td className="py-3.5 px-4 font-bold text-gray-900 whitespace-nowrap text-sm">
                          {formatCurrency(event.totalRequestedBudget || event.totalApprovedBudget || 0)}
                        </td>

                        {/* Submitted */}
                        <td className="py-3.5 px-4 text-gray-500 text-xs whitespace-nowrap">
                          {formatSubmittedDate(event.createdAt)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {renderStatusBadge(event.proposalStatus, event)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedEvent(event)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-[#001A4D] hover:text-white text-gray-700 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={activeList.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          itemName="events"
        />
      </div>

      {/* SAO Event Creation / Resume Draft Modal */}
      <SaoEventCreationModal
        key={modalKey}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setResumeDraft(null);
        }}
        initialDraft={resumeDraft ?? undefined}
        draftId={resumeDraft?.id}
      />

      {/* Event Proposal Review */}
      {selectedEvent && (
        <EventProposalReview
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
