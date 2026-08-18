import { useState, useMemo, useEffect } from "react";
import { useOutletContext, useSearchParams } from "react-router";
import {
  CheckCircle2, XCircle, Calendar, Plus, Eye,
  Search, ChevronLeft, ChevronRight, FileEdit, Clock,
  Filter, ChevronDown, RotateCcw
} from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Input } from "../../components/ui/input";
import SaoEventCreationModal from "../components/SaoEventCreationModal";
import EventProposalReview from "../components/EventProposalReview";

import { useAllEvents, useDraftEvents } from "../../modules/events/hooks/useEventStream";
import { useOrganizationStream } from "../../modules/organizations/hooks/useOrganizationStream";
import { useEventCategoriesStream } from "../../modules/events/hooks/useEventConfigStream";
import { approveEvent, rejectEvent } from "../../modules/events/services/event.service";
import { useAdviserProfile } from "../../modules/auth/hooks/useAdviserProfile";
import type { EventDocument } from "../../modules/events/types/event.types";
import { formatCurrency } from "../../utils/currency";
import { formatAppDateTime } from "../../utils/date";

const ITEMS_PER_PAGE = 10;

type TabValue = "all" | "pending" | "approved" | "completed" | "rejected" | "drafts";
type DateRangeOption = "all" | "this_week" | "this_month" | "custom";

function getDateRangeLabel(option: DateRangeOption): string {
  switch (option) {
    case "this_week": return "This Week";
    case "this_month": return "This Month";
    case "custom": return "Custom Range";
    default: return "All Time";
  }
}

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

/** Estimate draft completion label based on filled fields */
function getDraftProgress(draft: EventDocument): { label: string; step: number } {
  if (draft.documents && draft.documents.length > 0) return { label: "Documents ready", step: 6 };
  if (draft.budgetItems && draft.budgetItems.length > 0) return { label: "Budget added", step: 5 };
  if (draft.scanners && draft.scanners.length > 0) return { label: "Staff assigned", step: 4 };
  if (draft.targetYearLevels && draft.targetYearLevels.length > 0) return { label: "Participants set", step: 3 };
  if (draft.sessions && draft.sessions.length > 0) return { label: "Schedule set", step: 2 };
  if (draft.title) return { label: "Event details added", step: 1 };
  return { label: "Just started", step: 1 };
}

function formatTimestamp(ts: any): string {
  return formatAppDateTime(ts, "Unknown");
}

// ─── Dropdown helper ────────────────────────────────────────────────────────

interface FilterDropdownProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E0E0E0] rounded-lg text-sm text-gray-700 hover:border-[#001A4D] transition-colors min-w-[160px] justify-between"
      >
        <span className="truncate">
          <span className="text-gray-400 text-xs mr-1">{label}:</span>
          <span className="font-medium">{selected?.label ?? label}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-[#E0E0E0] rounded-lg shadow-lg min-w-full overflow-hidden">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors ${
                  opt.value === value ? "bg-[#001A4D]/5 text-[#001A4D] font-medium" : "text-gray-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function EventApprovals() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<EventDocument | null>(null);
  const [modalKey, setModalKey] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<EventDocument | null>(null);

  const { globalSearch } = useOutletContext<{ globalSearch: string }>();
  const searchQuery = globalSearch || "";

  const [searchParams] = useSearchParams();
  const targetId = searchParams.get("id") || searchParams.get("eventId");

  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [filterOrg, setFilterOrg] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<DateRangeOption>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // ── Data streams ─────────────────────────────────────────────────────────
  const { events, loading: eventsLoading } = useAllEvents();

  useEffect(() => {
    if (targetId && events.length > 0) {
      const target = events.find((e) => e.id === targetId);
      if (target) {
        setSelectedEvent(target);
      }
    }
  }, [targetId, events]);
  const { drafts, loading: draftsLoading } = useDraftEvents();
  const { data: orgs } = useOrganizationStream();
  const { categories } = useEventCategoriesStream();
  const { profile } = useAdviserProfile();

  // Reset pagination when filters / tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue);
    setCurrentPage(1);
    setPageInput("1");
  };

  useEffect(() => {
    setCurrentPage(1);
    setPageInput("1");
  }, [searchQuery, filterOrg, filterDateRange, filterCategory, customFrom, customTo]);

  const getOrgName = (orgId: string) => orgs.find(o => o.id === orgId)?.acronym || orgId;
  const getCategoryName = (catId: string) => categories.find(c => c.id === catId)?.name || catId;

  // ── Set of Non-Draft Event Identifiers for Draft Deduplication ────────────
  const nonDraftRefs = useMemo(() => {
    const refs = new Set<string>();
    events.forEach(e => {
      if (e.id) refs.add(e.id);
      if (e.referenceId) refs.add(e.referenceId);
      if (e.title) refs.add(e.title.trim().toLowerCase());
    });
    return refs;
  }, [events]);

  // ── Filtered event list (non-drafts) ─────────────────────────────────────
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Tab filter
      if (activeTab === "pending" && event.proposalStatus !== "pending" && event.proposalStatus !== "pending_review") return false;
      if (activeTab === "approved" && (event.proposalStatus !== "approved" || isEventPast(event))) return false;
      if (activeTab === "completed" && (event.proposalStatus !== "approved" || !isEventPast(event))) return false;
      if (activeTab === "rejected" && event.proposalStatus !== "rejected") return false;
      if (activeTab === "drafts") return false; // drafts rendered separately

      // Organisation filter
      if (filterOrg !== "all" && event.hostingOrgId !== filterOrg) return false;

      // Category filter
      if (filterCategory !== "all" && event.eventCategoryId !== filterCategory) return false;

      // Date range filter (based on first session date)
      const firstDate = getFirstSessionDate(event);
      if (!isWithinDateRange(firstDate, filterDateRange, customFrom, customTo)) return false;

      // Search
      const q = searchQuery.toLowerCase();
      if (q) {
        const titleMatch = event.title?.toLowerCase().includes(q);
        const refMatch = event.referenceId?.toLowerCase().includes(q);
        const orgMatch = getOrgName(event.hostingOrgId).toLowerCase().includes(q);
        if (!titleMatch && !refMatch && !orgMatch) return false;
      }

      return true;
    });
  }, [events, searchQuery, activeTab, filterOrg, filterDateRange, filterCategory, customFrom, customTo]);

  // ── Filtered drafts (excluding approved/published events) ───────────────
  const filteredDrafts = useMemo(() => {
    return drafts.filter(draft => {
      // Exclude if an approved / pending event with same ID, referenceId, or title exists
      if (draft.id && nonDraftRefs.has(draft.id)) return false;
      if (draft.referenceId && nonDraftRefs.has(draft.referenceId)) return false;
      if (draft.title && nonDraftRefs.has(draft.title.trim().toLowerCase())) return false;

      if (filterOrg !== "all" && draft.hostingOrgId !== filterOrg) return false;
      if (filterCategory !== "all" && draft.eventCategoryId !== filterCategory) return false;
      const q = searchQuery.toLowerCase();
      if (q && !draft.title?.toLowerCase().includes(q) && !draft.referenceId?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [drafts, nonDraftRefs, filterOrg, filterCategory, searchQuery]);

  // ── Badge counts ──────────────────────────────────────────────────────────
  const allCount = events.length;
  const pendingCount = events.filter(e => e.proposalStatus === "pending" || e.proposalStatus === "pending_review").length;
  const approvedCount = events.filter(e => e.proposalStatus === "approved" && !isEventPast(e)).length;
  const completedCount = events.filter(e => e.proposalStatus === "approved" && isEventPast(e)).length;
  const rejectedCount = events.filter(e => e.proposalStatus === "rejected").length;
  const draftsCount = filteredDrafts.length;

  // ── Pagination ────────────────────────────────────────────────────────────
  const activeList = activeTab === "drafts" ? filteredDrafts : filteredEvents;
  const totalPages = Math.max(1, Math.ceil(activeList.length / ITEMS_PER_PAGE));

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return activeList.slice(start, start + ITEMS_PER_PAGE);
  }, [activeList, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      setPageInput(newPage.toString());
    }
  };

  const handlePageInputSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = parseInt(pageInput);
      if (!isNaN(val) && val >= 1 && val <= totalPages) {
        setCurrentPage(val);
      } else {
        setPageInput(currentPage.toString());
      }
    }
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleQuickApprove = async (event: EventDocument) => {
    if (!profile?.uid) return;
    setSubmittingId(event.id);
    try {
      await approveEvent(event.id, profile.uid, "Quick approved from dashboard.");
    } catch (error) {
      console.error(error);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleQuickReject = (event: EventDocument) => {
    setSelectedEvent(event);
  };

  const handleResumeDraft = (draft: EventDocument) => {
    setResumeDraft(draft);
    setModalKey(Date.now());
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setResumeDraft(null);
  };

  // ── Dropdown option lists ─────────────────────────────────────────────────
  const orgOptions = [
    { value: "all", label: "All Organizations" },
    ...orgs.map(o => ({ value: o.id, label: o.acronym || o.name || o.id }))
  ];

  const dateOptions: { value: DateRangeOption; label: string }[] = [
    { value: "all", label: "All Time" },
    { value: "this_week", label: "This Week" },
    { value: "this_month", label: "This Month" },
    { value: "custom", label: "Custom Range" },
  ];

  const categoryOptions = [
    { value: "all", label: "All Categories" },
    ...categories
      .filter(c => !c.archived)
      .map(c => ({ value: c.id, label: c.name }))
  ];

  const isLoading = activeTab === "drafts" ? draftsLoading : eventsLoading;
  const hasActiveFilters = filterOrg !== "all" || filterDateRange !== "all" || filterCategory !== "all";

  const resetFilters = () => {
    setFilterOrg("all");
    setFilterDateRange("all");
    setFilterCategory("all");
    setCustomFrom("");
    setCustomTo("");
  };

  // ── Tab trigger helper ────────────────────────────────────────────────────
  const TAB_CONFIG: { value: TabValue; label: string; count: number }[] = [
    { value: "all", label: "All Events", count: allCount },
    { value: "pending", label: "Pending", count: pendingCount },
    { value: "approved", label: "Approved", count: approvedCount },
    { value: "completed", label: "Completed", count: completedCount },
    { value: "rejected", label: "Rejected", count: rejectedCount },
    { value: "drafts", label: "Drafts", count: draftsCount },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Event Approvals</h2>
          <p className="text-gray-500 text-sm">Review and approve event proposals from student organizations</p>
        </div>
        <Button
          onClick={() => { setResumeDraft(null); setModalKey(Date.now()); setIsModalOpen(true); }}
          className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] hover:opacity-90 text-white font-bold shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Event (SAO)
        </Button>
      </div>

      {/* Tabs + Filter Bar */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Tab Strip */}
          <TabsList className="bg-white border border-[#E0E0E0] flex-shrink-0 flex-wrap h-auto gap-1 p-1">
            {TAB_CONFIG.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-[#001A4D] data-[state=active]:text-white data-[state=active]:border-b-[3px] data-[state=active]:border-[#FFC107] relative"
              >
                {tab.label}
                <Badge
                  className={`ml-2 hover:bg-[#FFC107] ${
                    tab.value === "drafts"
                      ? "bg-amber-500 text-white hover:bg-amber-500"
                      : "bg-[#FFC107] text-[#001A4D]"
                  }`}
                >
                  {tab.count}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium mr-1">
              <Filter className="w-3.5 h-3.5" />
              Filter
            </div>

            <FilterDropdown
              label="Org"
              value={filterOrg}
              options={orgOptions}
              onChange={setFilterOrg}
            />
            <FilterDropdown
              label="Date"
              value={filterDateRange}
              options={dateOptions}
              onChange={(v) => setFilterDateRange(v as DateRangeOption)}
            />
            <FilterDropdown
              label="Category"
              value={filterCategory}
              options={categoryOptions}
              onChange={setFilterCategory}
            />

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-500 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {filterDateRange === "custom" && (
          <div className="flex items-center gap-3 mt-3 p-3 bg-gray-50 border border-[#E0E0E0] rounded-lg w-fit">
            <span className="text-sm text-gray-500 font-medium">From</span>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-40 h-8 text-sm"
            />
            <span className="text-sm text-gray-500 font-medium">To</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-40 h-8 text-sm"
            />
          </div>
        )}

        {/* Event List */}
        <div className="mt-6 space-y-4">
          {isLoading ? (
            <p className="text-gray-500 py-8 text-center">Loading events...</p>
          ) : activeTab === "drafts" ? (
            /* ── DRAFTS TAB ──────────────────────────────────────────────── */
            paginatedItems.length === 0 ? (
              <div className="py-16 text-center">
                <FileEdit className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No drafts found</p>
                <p className="text-gray-400 text-sm mt-1">
                  Click "Create Event (SAO)" and save as draft to continue later.
                </p>
              </div>
            ) : (
              (paginatedItems as EventDocument[]).map((draft) => {
                const progress = getDraftProgress(draft);
                const totalSteps = 7;
                const progressPct = Math.round((progress.step / totalSteps) * 100);

                return (
                  <Card key={draft.id} className="border-amber-200 hover:shadow-md transition-shadow bg-amber-50/30">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-2 h-2 rounded-full mt-2 bg-amber-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="font-bold text-[#001A4D] text-lg">
                                {draft.title || "Untitled Draft"}
                              </h3>
                              <p className="text-gray-500 text-sm">
                                {draft.hostingOrgId ? getOrgName(draft.hostingOrgId) : "No organization set"}
                              </p>
                            </div>
                            <Badge className="bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100">
                              Draft
                            </Badge>
                          </div>

                          {/* Progress bar */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-500">
                                Progress: <span className="font-medium text-[#001A4D]">{progress.label}</span>
                              </span>
                              <span className="text-xs text-gray-400">Step {progress.step} of {totalSteps}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-gradient-to-r from-amber-400 to-amber-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Last saved: {formatTimestamp(draft.updatedAt)}</span>
                            </div>
                            {draft.referenceId && (
                              <span>Ref: {draft.referenceId}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => handleResumeDraft(draft)}
                              className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] hover:opacity-90 text-white font-bold shadow-xs"
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Resume Draft
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )
          ) : (
            /* ── NON-DRAFT TABS ──────────────────────────────────────────── */
            paginatedItems.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">No events found matching the criteria.</p>
            ) : (
              (paginatedItems as EventDocument[]).map((event) => {
                const isPending = event.proposalStatus === "pending_review";
                const isApproved = event.proposalStatus === "approved";
                const isRejected = event.proposalStatus === "rejected";
                const firstSession = getFirstSessionDate(event) ?? "TBD";

                return (
                  <Card key={event.id} className="border-[#E0E0E0] hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                            isPending ? "bg-[#FFC107]"
                            : isApproved ? "bg-green-500"
                            : isRejected ? "bg-red-500"
                            : "bg-gray-400"
                          }`}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-bold text-[#001A4D] text-lg">{event.title}</h3>
                              <p className="text-gray-500 text-sm">{getOrgName(event.hostingOrgId)}</p>
                            </div>
                            <Badge
                              className={`${
                                isPending
                                  ? "bg-[#FFC107] text-[#001A4D] hover:bg-[#FFC107]"
                                  : isApproved
                                  ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white border-0"
                                  : isRejected
                                  ? "bg-gradient-to-r from-[#EF4444] to-[#F97316] text-white border-0"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {isPending ? "Pending" : isApproved ? "Approved" : isRejected ? "Rejected" : event.proposalStatus}
                            </Badge>
                          </div>

                          {isRejected && event.rejectionReason && (
                            <div className="bg-red-50 border-l-2 border-red-500 p-4 mb-4 rounded">
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Rejection Reason:</span> {event.rejectionReason}
                              </p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className={`w-4 h-4 ${isPending ? "text-[#0E4EBD]" : isApproved ? "text-green-600" : "text-red-600"}`} />
                              <span>{firstSession}</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Ref ID:</span> {event.referenceId}
                            </div>
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Format:</span> {event.eventFormat}
                            </div>
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Budget:</span> {formatCurrency(event.totalApprovedBudget || 0)}
                            </div>
                          </div>

                          {event.eventCategoryId && (
                            <div className="mb-3">
                              <Badge className="bg-[#E0E0E0] text-gray-600 hover:bg-[#E0E0E0] text-xs">
                                {getCategoryName(event.eventCategoryId)}
                              </Badge>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            {isPending && (
                              <>
                                <Button
                                  disabled={submittingId === event.id}
                                  onClick={() => handleQuickApprove(event)}
                                  className="bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:from-[#16A34A] hover:to-[#22C55E] text-white"
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Approve
                                </Button>
                                <Button
                                  disabled={submittingId === event.id}
                                  onClick={() => handleQuickReject(event)}
                                  className="bg-gradient-to-r from-[#EF4444] to-[#F97316] hover:from-[#F97316] hover:to-[#EF4444] text-white"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Reject
                                </Button>
                              </>
                            )}
                            <Button
                              variant="outline"
                              className="border-[#0E4EBD] text-[#0E4EBD] hover:bg-[#E0E0E0]/50"
                              onClick={() => setSelectedEvent(event)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6 bg-white p-4 rounded-xl border border-[#E0E0E0]">
          <p className="text-sm text-gray-500">
            {activeList.length === 0
              ? "No events found"
              : `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1} to ${Math.min(currentPage * ITEMS_PER_PAGE, activeList.length)} of ${activeList.length} ${activeTab === "drafts" ? "drafts" : "events"}`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 px-2">
              <span className="text-sm text-gray-600">Page</span>
              <Input
                className="w-12 h-8 text-center px-1"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={handlePageInputSubmit}
                onBlur={() => setPageInput(currentPage.toString())}
              />
              <span className="text-sm text-gray-600">of {totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Tabs>

      {/* SAO Event Creation / Resume Draft Modal */}
      <SaoEventCreationModal
        key={modalKey}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
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
