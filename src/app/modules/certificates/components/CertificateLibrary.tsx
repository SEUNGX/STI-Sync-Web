import React, { useState, useMemo } from "react";
import {
  Award, Search, Filter, Plus, CheckCircle, Clock, XCircle, FileText,
  Eye, Edit2, Trash2, Check, X, Send, Sparkles, Building2, Calendar, UserCheck,
  LayoutGrid, List
} from "lucide-react";
import { toast } from "sonner";
import { useCertificatesStream } from "../hooks/useCertificateStream";
import { updateCertificateStatus, deleteCertificate } from "../services/certificate.service";
import type { CertificateItem, CertificateStatus, CertificateCategory } from "../types/certificate.types";

interface Props {
  isAdmin: boolean;
  organizationId?: string;
  onEditTemplate: (id: string) => void;
  onCreateCertificate: () => void;
  onGenerateCertificates?: (eventId: string) => void;
}

const CATEGORIES: CertificateCategory[] = [
  'Participation',
  'Recognition',
  'Appreciation',
  'Achievement',
  'Completion',
  'Excellence',
];

const ORGANIZATIONS = [
  { id: 'all', name: 'All Organizations' },
  { id: 'admin', name: 'SAO Admin' },
  { id: 'jpcs', name: "JPCS - Junior People's Computer Society" },
  { id: 'aces', name: 'ACES - Association of Computer Engineering' },
  { id: 'cite', name: 'CITE - Council of IT Education' },
  { id: 'bshm', name: 'BSHM Student Council' },
  { id: 'athletics', name: 'Athletics & Sports Club' },
];

export default function CertificateLibrary({
  isAdmin,
  organizationId,
  onEditTemplate,
  onCreateCertificate,
  onGenerateCertificates,
}: Props) {
  const { certificates = [], loading } = useCertificatesStream(organizationId, isAdmin);

  // View Mode: 'card' (default) or 'table'
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  // Filters State
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<CertificateStatus | "all">("all");
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title" | "issued">("newest");

  // Modals state
  const [previewItem, setPreviewItem] = useState<CertificateItem | null>(null);
  const [rejectingItem, setRejectingItem] = useState<CertificateItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Filtered & Sorted certificates
  const filtered = useMemo(() => {
    const list = certificates || [];
    return list.filter((c) => {
      // Search
      const matchSearch =
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        (c.eventName && c.eventName.toLowerCase().includes(search.toLowerCase())) ||
        (c.organizationName && c.organizationName.toLowerCase().includes(search.toLowerCase())) ||
        (c.signatoryName && c.signatoryName.toLowerCase().includes(search.toLowerCase()));

      if (!matchSearch) return false;

      // Status
      if (selectedStatus !== "all" && c.status !== selectedStatus) return false;

      // Org
      if (selectedOrg !== "all") {
        if (selectedOrg === "admin" && c.organizationId !== "admin") return false;
        if (selectedOrg !== "admin" && c.organizationId !== selectedOrg) return false;
      }

      // Category
      if (selectedCategory !== "all" && c.category !== selectedCategory) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "issued") return (b.issuedCount || 0) - (a.issuedCount || 0);
      if (sortBy === "oldest") return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [certificates, search, selectedStatus, selectedOrg, selectedCategory, sortBy]);

  // Counts
  const counts = useMemo(() => {
    const safe = certificates || [];
    return {
      all: safe.length,
      Published: safe.filter((c) => c.status === "Published").length,
      Approved: safe.filter((c) => c.status === "Approved").length,
      Pending: safe.filter((c) => c.status === "Pending").length,
      Draft: safe.filter((c) => c.status === "Draft").length,
      Rejected: safe.filter((c) => c.status === "Rejected").length,
    };
  }, [certificates]);

  // Status Handlers
  const handleApprove = async (id: string, title: string) => {
    setActionLoading(true);
    try {
      await updateCertificateStatus(id, "Approved", "Approved by Admin Review");
      toast.success(`"${title}" has been approved!`);
    } catch {
      toast.error("Failed to approve certificate.");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async (id: string, title: string) => {
    setActionLoading(true);
    try {
      await updateCertificateStatus(id, "Published");
      toast.success(`"${title}" is now published and active!`);
    } catch {
      toast.error("Failed to publish certificate.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingItem) return;
    if (!rejectionReason.trim()) {
      toast.error("Please enter a reason for rejection.");
      return;
    }
    setActionLoading(true);
    try {
      await updateCertificateStatus(rejectingItem.id, "Rejected", rejectionReason.trim());
      toast.success(`Certificate returned with feedback.`);
      setRejectingItem(null);
      setRejectionReason("");
    } catch {
      toast.error("Failed to reject certificate.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCertificate(id);
      toast.success("Certificate deleted successfully.");
      setDeletingId(null);
    } catch {
      toast.error("Failed to delete certificate.");
    }
  };

  const getStatusBadge = (status: CertificateStatus) => {
    switch (status) {
      case "Published":
        return <span className="bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> Published</span>;
      case "Approved":
        return <span className="bg-[#0E4EBD]/10 text-[#0E4EBD] border border-[#0E4EBD]/20 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Sparkles className="w-3 h-3" /> Approved</span>;
      case "Pending":
        return <span className="bg-[#FFC107]/15 text-[#B8860B] border border-[#FFC107]/30 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse w-fit"><Clock className="w-3 h-3" /> Pending Review</span>;
      case "Draft":
        return <span className="bg-gray-100 text-gray-600 border border-gray-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><FileText className="w-3 h-3" /> Draft</span>;
      case "Rejected":
        return <span className="bg-red-50 text-red-600 border border-red-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> Returned</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl border border-[#E0E0E0] p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[#888780] text-xs font-semibold">Total Certificates</p>
            <p className="text-[#001A4D] font-bold text-2xl mt-0.5">{counts.all}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0E4EBD] flex items-center justify-center font-bold text-sm">
            <Award className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E0E0E0] p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[#888780] text-xs font-semibold">Published</p>
            <p className="text-[#22C55E] font-bold text-2xl mt-0.5">{counts.Published}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#22C55E] flex items-center justify-center font-bold text-sm">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E0E0E0] p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[#888780] text-xs font-semibold">Pending Approval</p>
            <p className="text-[#B8860B] font-bold text-2xl mt-0.5">{counts.Pending}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#B8860B] flex items-center justify-center font-bold text-sm">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E0E0E0] p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[#888780] text-xs font-semibold">Approved</p>
            <p className="text-[#0E4EBD] font-bold text-2xl mt-0.5">{counts.Approved}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#0E4EBD] flex items-center justify-center font-bold text-sm">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E0E0E0] p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[#888780] text-xs font-semibold">Drafts & Returned</p>
            <p className="text-gray-600 font-bold text-2xl mt-0.5">{counts.Draft + counts.Rejected}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-sm">
            <FileText className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-[#E0E0E0] p-4 space-y-4 shadow-2xs">
        {/* Row 1: Search, Dropdowns, View Switcher & Create Button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888780]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search certificates..."
              className="w-full pl-10 pr-4 py-2 border border-[#E0E0E0] rounded-xl text-sm focus:outline-none focus:border-[#001A4D]"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">


            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-[#E0E0E0] rounded-xl text-xs font-semibold text-[#001A4D] bg-white focus:outline-none focus:border-[#001A4D]"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-[#E0E0E0] rounded-xl text-xs font-semibold text-[#001A4D] bg-white focus:outline-none focus:border-[#001A4D]"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="title">Sort: Title A-Z</option>
              <option value="issued">Sort: Most Issued</option>
            </select>

            {/* View Mode Switcher (Card vs Table) */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-[#E0E0E0]">
              <button
                onClick={() => setViewMode("card")}
                title="Card View"
                className={`p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                  viewMode === "card"
                    ? "bg-white text-[#001A4D] shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                onClick={() => setViewMode("table")}
                title="Table List View"
                className={`p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-[#001A4D] shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Status Tabs */}
        <div className="flex items-center gap-2 border-t border-[#E0E0E0] pt-3 overflow-x-auto">
          <span className="text-xs font-bold text-[#888780] mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          {(
            [
              ["all", `All (${counts.all})`],
              ["Published", `Published (${counts.Published})`],
              ["Approved", `Approved (${counts.Approved})`],
              ["Pending", `Pending Review (${counts.Pending})`],
              ["Draft", `Drafts (${counts.Draft})`],
              ["Rejected", `Returned (${counts.Rejected})`],
            ] as const
          ).map(([st, label]) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                selectedStatus === st
                  ? isAdmin
                    ? "bg-[#001A4D] text-white"
                    : "bg-[#83358E] text-white"
                  : "bg-gray-100 text-[#888780] hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content (Card View vs Table/List View) */}
      {loading ? (
        <div className="py-20 text-center text-gray-500 text-sm">Loading certificates from Firestore...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-[#E0E0E0]">
          <Award className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-[#001A4D] font-bold text-lg">No certificates found</p>
          <p className="text-[#888780] text-sm mt-1 mb-5">
            {search || selectedStatus !== "all" || selectedOrg !== "all" || selectedCategory !== "all"
              ? "Try adjusting your search or filters."
              : "Create your first certificate in the library."}
          </p>
          <button
            onClick={onCreateCertificate}
            className="bg-[#001A4D] hover:bg-[#0E4EBD] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Certificate
          </button>
        </div>
      ) : viewMode === "card" ? (
        /* CARD VIEW */
        <div className="grid grid-cols-3 gap-5">
          {filtered.map((cert) => (
            <div
              key={cert.id}
              className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col group"
            >
              {/* Card Image Display */}
              <div className="relative w-full h-48 bg-slate-900 overflow-hidden flex items-center justify-center">
                {cert.imageUrl ? (
                  <img
                    src={cert.imageUrl}
                    alt={cert.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  /* Styled certificate background if no image uploaded */
                  <div className="w-full h-full bg-gradient-to-br from-[#001A4D] via-[#0E4EBD] to-[#001A4D] p-4 flex flex-col justify-between relative">
                    <div className="absolute inset-2 border border-[#FFD41C]/30 rounded pointer-events-none" />
                    <div className="text-center my-auto space-y-1 z-10">
                      <p className="text-[#FFD41C] text-[10px] font-bold uppercase tracking-widest">STI College Ormoc</p>
                      <p className="text-white font-serif font-bold text-sm leading-tight line-clamp-2">{cert.title}</p>
                    </div>
                  </div>
                )}

                {/* Overlays on Image */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
                  <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/20">
                    {cert.category}
                  </span>
                  {getStatusBadge(cert.status)}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 space-y-3 flex flex-col">
                <div className="space-y-1">
                  <p
                    onClick={() => onEditTemplate(cert.id)}
                    className="text-[#001A4D] font-bold text-sm leading-snug line-clamp-1 cursor-pointer hover:text-[#0E4EBD] hover:underline transition-colors"
                    title="Click to edit template"
                  >
                    {cert.title}
                  </p>
                  <div className="flex items-center justify-between text-xs text-[#888780]">
                    <span className="flex items-center gap-1 truncate max-w-[170px]">
                      <Building2 className="w-3.5 h-3.5 text-[#0E4EBD]" />
                      {cert.organizationName || "SAO"}
                    </span>
                    <span className="font-semibold text-[#001A4D] flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-[#22C55E]" /> {cert.issuedCount || 0} Issued
                    </span>
                  </div>
                </div>

                {cert.eventName && (
                  <p className="text-xs text-gray-600 flex items-center gap-1.5 truncate">
                    <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    {cert.eventName}
                  </p>
                )}

                {cert.signatoryName && (
                  <div className="text-xs text-[#888780] bg-gray-50 rounded-xl p-2.5 border border-gray-100 space-y-0.5">
                    <p className="font-semibold text-[#001A4D] truncate">
                      Signatory: <span className="font-normal text-gray-700">{cert.signatoryName}</span>
                    </p>
                    {cert.signatoryTitle && <p className="text-[11px] text-gray-500 truncate">{cert.signatoryTitle}</p>}
                  </div>
                )}

                {cert.rejectionReason && cert.status === "Rejected" && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-xs text-red-700">
                    <span className="font-bold">Feedback:</span> {cert.rejectionReason}
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="pt-2 border-t border-[#E0E0E0] mt-auto space-y-2">
                  {/* Admin review approval actions */}
                  {isAdmin && cert.status === "Pending" && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleApprove(cert.id, cert.title)}
                        disabled={actionLoading}
                        className="w-full py-1.5 bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => {
                          setRejectingItem(cert);
                          setRejectionReason("");
                        }}
                        disabled={actionLoading}
                        className="w-full py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}

                  {/* Publish button if Approved or Draft */}
                  {(cert.status === "Approved" || cert.status === "Draft") && (
                    <button
                      onClick={() => handlePublish(cert.id, cert.title)}
                      disabled={actionLoading}
                      className="w-full py-1.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 text-[#FFD41C]" /> Publish Certificate
                    </button>
                  )}

                  {/* Standard Action Row */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPreviewItem(cert)}
                      className="flex-1 py-1.5 border border-[#E0E0E0] hover:bg-gray-50 text-[#001A4D] text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#0E4EBD]" /> Preview
                    </button>

                    <button
                      onClick={() => onEditTemplate(cert.id)}
                      className="p-1.5 border border-[#E0E0E0] hover:bg-gray-50 text-gray-600 rounded-lg transition-colors cursor-pointer"
                      title="Edit Certificate Layout"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setDeletingId(cert.id)}
                      className="p-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg transition-colors cursor-pointer"
                      title="Delete Certificate"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE / LIST VIEW */
        <div className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-[#E0E0E0] text-xs font-bold text-[#888780] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Certificate</th>
                  <th className="py-3.5 px-4">Organization</th>
                  <th className="py-3.5 px-4">Linked Event</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Signatory</th>
                  <th className="py-3.5 px-4 text-center">Issued</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0] text-sm">
                {filtered.map((cert) => (
                  <tr key={cert.id} className="hover:bg-gray-50/80 transition-colors group">
                    {/* Image & Title Column */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => setPreviewItem(cert)}
                          className="w-16 h-11 rounded-lg border border-[#E0E0E0] bg-slate-900 overflow-hidden flex-shrink-0 cursor-pointer relative shadow-2xs group-hover:border-[#001A4D]"
                        >
                          {cert.imageUrl ? (
                            <img src={cert.imageUrl} alt={cert.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] flex items-center justify-center">
                              <Award className="w-4 h-4 text-[#FFD41C]" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p
                              className="font-bold text-[#001A4D] text-xs leading-tight hover:underline cursor-pointer"
                              onClick={() => onEditTemplate(cert.id)}
                              title="Click to edit template"
                            >
                              {cert.title}
                            </p>
                          </div>
                          <p className="text-[11px] text-[#888780]">{cert.category}</p>
                        </div>
                      </div>
                    </td>

                    {/* Organization Column */}
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold text-[#001A4D] flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#0E4EBD]" />
                        {cert.organizationName || "SAO"}
                      </span>
                    </td>

                    {/* Event Column */}
                    <td className="py-3 px-4 text-xs text-gray-600">
                      {cert.eventName ? (
                        <span className="flex items-center gap-1 truncate max-w-[180px]">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {cert.eventName}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Status Column */}
                    <td className="py-3 px-4">
                      {getStatusBadge(cert.status)}
                    </td>

                    {/* Signatory Column */}
                    <td className="py-3 px-4 text-xs">
                      <p className="font-semibold text-[#001A4D]">{cert.signatoryName || "—"}</p>
                      {cert.signatoryTitle && <p className="text-[10px] text-gray-500">{cert.signatoryTitle}</p>}
                    </td>

                    {/* Issued Count Column */}
                    <td className="py-3 px-4 text-center">
                      <span className="bg-emerald-50 text-[#16A34A] font-bold text-xs px-2.5 py-1 rounded-full border border-emerald-200">
                        {cert.issuedCount || 0}
                      </span>
                    </td>

                    {/* Actions Column */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Admin review approval actions */}
                        {isAdmin && cert.status === "Pending" && (
                          <>
                            <button
                              onClick={() => handleApprove(cert.id, cert.title)}
                              className="p-1.5 bg-[#22C55E] text-white rounded-lg hover:bg-[#16A34A] transition-colors cursor-pointer"
                              title="Approve"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setRejectingItem(cert);
                                setRejectionReason("");
                              }}
                              className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                              title="Reject"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {(cert.status === "Approved" || cert.status === "Draft") && (
                          <button
                            onClick={() => handlePublish(cert.id, cert.title)}
                            className="p-1.5 bg-[#001A4D] text-white rounded-lg hover:bg-[#0E4EBD] transition-colors cursor-pointer"
                            title="Publish"
                          >
                            <Send className="w-3.5 h-3.5 text-[#FFD41C]" />
                          </button>
                        )}

                        <button
                          onClick={() => setPreviewItem(cert)}
                          className="p-1.5 border border-[#E0E0E0] hover:bg-gray-100 text-[#001A4D] rounded-lg transition-colors cursor-pointer"
                          title="Preview"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#0E4EBD]" />
                        </button>

                        <button
                          onClick={() => onEditTemplate(cert.id)}
                          className="p-1.5 border border-[#E0E0E0] hover:bg-gray-100 text-gray-600 rounded-lg transition-colors cursor-pointer"
                          title="Edit Layout"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeletingId(cert.id)}
                          className="p-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- PREVIEW MODAL --- */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E0E0E0] w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#FFD41C]" />
                <h3 className="font-bold text-base">{previewItem.title}</h3>
              </div>
              <button onClick={() => setPreviewItem(null)} className="p-1 hover:bg-white/20 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* High Quality Landscape Certificate Canvas with Actual Image */}
              <div className="relative w-full rounded-xl overflow-hidden border-4 border-[#FFD41C] shadow-lg flex flex-col justify-between min-h-[360px] bg-slate-900">
                {previewItem.imageUrl ? (
                  <img
                    src={previewItem.imageUrl}
                    alt={previewItem.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#001A4D] via-[#0E4EBD] to-[#001A4D]" />
                )}

                {/* Overlaid text matching position */}
                <div className="relative z-10 p-8 flex flex-col justify-between h-full min-h-[360px]">
                  {!previewItem.imageUrl && (
                    <div className="space-y-1 text-center text-white">
                      <p className="text-[#FFD41C] text-xs font-bold uppercase tracking-widest">STI College Ormoc</p>
                      <p className="text-white/80 text-[11px]">Official Student Recognition Document</p>
                      <p className="text-[#FFD41C] font-serif italic text-2xl pt-2">Certificate of {previewItem.category}</p>
                    </div>
                  )}

                  {/* Dynamic Elements Overlay */}
                  {previewItem.elements && previewItem.elements.length > 0 ? (
                    previewItem.elements.map((elem) => {
                      const text = (elem.text || '').replace(/{recipientName}|{name}/g, 'Juan Dela Cruz');
                      const isBold = elem.fontWeight?.toLowerCase().includes('bold');
                      const isItalic = elem.fontWeight?.toLowerCase().includes('italic');
                      return (
                        <div
                          key={elem.id}
                          className="absolute flex items-center justify-center pointer-events-none"
                          style={{
                            left: `${elem.xPercent}%`,
                            top: `${elem.yPercent}%`,
                            width: `${elem.widthPercent}%`,
                            transform: 'translate(-50%, -50%)',
                            color: elem.textColor || '#001A4D',
                            fontFamily: elem.fontFamily || 'Arial',
                            fontSize: `${elem.fontSizePt || 16}px`,
                            fontWeight: isBold ? 'bold' : 'normal',
                            fontStyle: isItalic ? 'italic' : 'normal',
                            textAlign: elem.textAlign || 'center',
                            whiteSpace: 'pre-line',
                            lineHeight: 1.25,
                          }}
                        >
                          <div className="w-full" style={{ textAlign: elem.textAlign || 'center' }}>
                            {text}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    /* Fallback Single Name Overlay */
                    <div
                      className="absolute flex items-center justify-center pointer-events-none"
                      style={{
                        left: `${previewItem.namePosition?.xPercent || 50}%`,
                        top: `${previewItem.namePosition?.yPercent || 48}%`,
                        transform: 'translate(-50%, -50%)',
                        color: previewItem.namePosition?.textColor || '#001A4D',
                        fontFamily: previewItem.namePosition?.fontFamily || 'Great Vibes',
                        fontSize: `${previewItem.namePosition?.fontSizePt || 32}px`,
                        fontWeight: previewItem.namePosition?.fontWeight?.includes('Bold') ? 'bold' : 'normal',
                        textAlign: previewItem.namePosition?.textAlign || 'center',
                      }}
                    >
                      Juan Dela Cruz
                    </div>
                  )}

                  {!previewItem.imageUrl && (
                    <div className="flex items-end justify-between pt-6 border-t border-white/20 text-xs text-white">
                      <div className="text-left">
                        <p className="font-bold">{previewItem.signatoryName || "Dr. Maria Santos"}</p>
                        <p className="text-white/70 text-[10px]">{previewItem.signatoryTitle || "SAO Director"}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full border-2 border-[#FFD41C] flex items-center justify-center bg-white/10 font-bold text-[9px] text-[#FFD41C]">
                        OFFICIAL
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{previewItem.organizationName}</p>
                        <p className="text-white/70 text-[10px]">Academic Year 2025–2026</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status details */}
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-[#E0E0E0] text-xs">
                <div>
                  <p className="font-semibold text-[#001A4D]">Organization: {previewItem.organizationName}</p>
                  <p className="text-gray-500">Linked Event: {previewItem.eventName || "Campus-Wide / General"}</p>
                </div>
                <div>{getStatusBadge(previewItem.status)}</div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-3 border-t border-[#E0E0E0] flex justify-end gap-3">
              <button onClick={() => setPreviewItem(null)} className="px-4 py-2 border border-[#E0E0E0] rounded-xl text-xs font-semibold hover:bg-gray-100 cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- REJECTION REASON MODAL --- */}
      {rejectingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E0E0E0] w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="text-[#001A4D] font-bold text-base">Return Certificate for Revision</h3>
            <p className="text-[#888780] text-xs">
              Provide feedback to <span className="font-bold text-[#001A4D]">{rejectingItem.organizationName}</span> regarding why this certificate proposal was returned.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Please update the signatory title..."
              className="w-full h-28 p-3 border border-[#E0E0E0] rounded-xl text-sm focus:outline-none focus:border-[#001A4D]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setRejectingItem(null)} className="px-4 py-2 text-xs font-semibold border border-[#E0E0E0] rounded-xl hover:bg-gray-50 cursor-pointer">
                Cancel
              </button>
              <button onClick={handleConfirmReject} disabled={actionLoading} className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl cursor-pointer">
                {actionLoading ? "Returning..." : "Confirm Return"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE MODAL --- */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E0E0E0] w-full max-w-sm p-6 space-y-4 shadow-xl text-center">
            <Trash2 className="w-10 h-10 text-red-500 mx-auto" />
            <h3 className="text-[#001A4D] font-bold text-base">Delete Certificate?</h3>
            <p className="text-[#888780] text-xs">This action cannot be undone. Are you sure you want to delete this certificate document from Firestore?</p>
            <div className="flex justify-center gap-2 pt-2">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 text-xs font-semibold border border-[#E0E0E0] rounded-xl hover:bg-gray-50 cursor-pointer">
                Cancel
              </button>
              <button onClick={() => handleDelete(deletingId)} className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
