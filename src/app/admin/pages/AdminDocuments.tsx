import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Radio, Clock, CheckCircle, XCircle, Send, Building2,
  Eye, Download, Check, X, Search, Save, FileText,
  Upload, AlertCircle, ChevronDown, Users, Loader2,
} from "lucide-react";
import { useDocumentCategories } from '../../modules/documents/hooks/useDocumentCategories';
import { useIncomingDocuments, useSentDocuments } from '../../modules/documents/hooks/useDocumentStream';
import { createDocument, reviewDocument, getNextReferenceNumber } from '../../modules/documents/services/document.service';
import { DocumentPreviewModal } from '../../modules/documents/components/DocumentPreviewModal';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useOrganizationTypes } from '../../modules/organizations/hooks/useOrganizationTypes';
import { useAdviserProfile } from '../../modules/auth/hooks/useAdviserProfile';
import { useSemesters } from '../../modules/academic/hooks/useAcademicStream';
import { uploadToCloudinary } from '../../../services/cloudinary';
import { inferFileType, DOCUMENT_ACCEPTED_TYPES, DOCUMENT_MAX_BYTES } from '../../modules/documents/types/document.types';
import type { DocumentDocument, DocStatus } from '../../modules/documents/types/document.types';
import { formatDistanceToNow, format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  "Activity Letter": "bg-blue-50 text-[#0E4EBD]",
  "Accreditation Paper": "bg-blue-100 text-blue-700",
  "Waiver": "bg-amber-100 text-amber-700",
  "Financial Report": "bg-green-100 text-green-700",
  "Event Proposal": "bg-[#001A4D]/10 text-[#001A4D]",
  "Certificate Request": "bg-teal-100 text-teal-700",
  "Memorandum": "bg-gray-100 text-gray-600",
  "Approved Template": "bg-green-100 text-green-700",
  "Memo": "bg-gray-100 text-gray-600",
  "Guidelines": "bg-blue-100 text-blue-700",
};

function CategoryPill({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category] || "bg-gray-100 text-gray-600";
  return <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${cls}`}>{category}</span>;
}

function FileChip({ type }: { type: string }) {
  const isPdf = type === "PDF";
  return <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${isPdf ? "bg-red-500 text-white" : "bg-blue-600 text-white"}`}>{type}</span>;
}

function StatusPill({ status }: { status: DocStatus }) {
  const map: Record<DocStatus, { cls: string; label: string }> = {
    Pending: { cls: "bg-amber-100 text-amber-700 animate-pulse", label: "Pending" },
    Approved: { cls: "bg-green-100 text-green-700", label: "Approved" },
    Rejected: { cls: "bg-red-100 text-red-700", label: "Rejected" },
    Resubmitted: { cls: "bg-blue-100 text-blue-700", label: "Resubmitted" },
    Draft: { cls: "bg-gray-100 text-gray-600", label: "Draft" },
  };
  const { cls, label } = map[status] ?? { cls: "bg-gray-100 text-gray-600", label: status };
  return <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${cls}`}>{label}</span>;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function toDate(ts: Timestamp | undefined | null): Date | null {
  if (!ts) return null;
  return ts.toDate();
}

// ─── Quick Action Popovers ─────────────────────────────────────────────────────
function QuickApprovePopover({ doc, onClose, onApprove }: { doc: DocumentDocument; onClose: () => void; onApprove: (remarks: string) => void }) {
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-[#E0E0E0] rounded-xl shadow-lg z-30 overflow-hidden">
      <div className="h-8 bg-gradient-to-r from-green-500 to-green-400 flex items-center gap-2 px-3">
        <Check className="w-3.5 h-3.5 text-white" />
        <p className="text-white font-bold text-xs">Quick Approve?</p>
      </div>
      <div className="p-3 space-y-3">
        <p className="text-[#001A4D] text-xs">Approve <strong>{doc.title.slice(0, 30)}...</strong> from <strong>{doc.submittedByOrgName}</strong>?</p>
        <textarea rows={3} placeholder="Optional approval remarks..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] resize-none" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="text-gray-500 text-xs hover:text-gray-700">Cancel</button>
          <button disabled={saving} onClick={async () => { setSaving(true); await onApprove(remarks); setSaving(false); }} className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-400 text-white text-xs font-bold rounded-lg disabled:opacity-50">
            {saving ? "Approving..." : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickRejectPopover({ doc, onClose, onReject }: { doc: DocumentDocument; onClose: () => void; onReject: (remarks: string) => void }) {
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const canReject = remarks.trim().length > 0;
  return (
    <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-[#E0E0E0] rounded-xl shadow-lg z-30 overflow-hidden">
      <div className="h-8 bg-gradient-to-r from-red-500 to-orange-500 flex items-center gap-2 px-3">
        <X className="w-3.5 h-3.5 text-white" />
        <p className="text-white font-bold text-xs">Quick Reject</p>
      </div>
      <div className="p-3 space-y-3">
        <p className="text-[#001A4D] text-xs"><strong>{doc.title.slice(0, 30)}...</strong> · {doc.submittedByOrgName}</p>
        <textarea rows={3} placeholder="Rejection reason — required..." className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] resize-none border-gray-300" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="text-gray-500 text-xs hover:text-gray-700">Cancel</button>
          <button
            disabled={!canReject || saving}
            onClick={async () => { setSaving(true); await onReject(remarks); setSaving(false); }}
            className={`px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-colors ${canReject ? "bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
          >
            {saving ? "Rejecting..." : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Broadcast Modal ───────────────────────────────────────────────────────────
function BroadcastModal({ onClose }: { onClose: () => void }) {
  const { data: docCategories } = useDocumentCategories();
  const activeCategories = docCategories.filter(c => c.active);
  const { data: orgs } = useOrganizationStream();
  const { data: orgTypes } = useOrganizationTypes();
  const { profile: adminProfile } = useAdviserProfile();
  const { data: semesters } = useSemesters();
  const activeSemester = semesters.find(s => s.status === 'ACTIVE');

  const [distribution, setDistribution] = useState<"all" | "specific" | "type">("all");
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [pushNotif, setPushNotif] = useState(true);
  const [broadcast, setBroadcast] = useState(false);
  const [broadcastRef, setBroadcastRef] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeOrgs = orgs.filter(o => o.status === 'active');

  const filteredOrgs = useMemo(() => {
    let list = activeOrgs;
    if (distribution === "type" && selectedTypeId) {
      list = list.filter(o => o.typeId === selectedTypeId);
    }
    if (orgSearch.trim()) {
      const s = orgSearch.toLowerCase();
      list = list.filter(o => o.name.toLowerCase().includes(s) || o.acronym.toLowerCase().includes(s));
    }
    return list;
  }, [activeOrgs, distribution, selectedTypeId, orgSearch]);

  const targetOrgCount = distribution === "all"
    ? activeOrgs.length
    : distribution === "specific"
      ? selectedOrgs.length
      : selectedOrgs.length || filteredOrgs.length;

  const canBroadcast = title && uploadedFile && targetOrgCount > 0 && !broadcasting;

  const toggleOrg = (id: string) => setSelectedOrgs(p => p.includes(id) ? p.filter(o => o !== id) : [...p, id]);

  const handleFileSelect = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const result = await uploadToCloudinary(file, {
        folder: 'documents/broadcast',
        acceptedTypes: DOCUMENT_ACCEPTED_TYPES,
        maxBytes: DOCUMENT_MAX_BYTES,
      });
      setUploadedFile({ url: result.secureUrl, name: file.name, size: file.size });
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleBroadcast = async () => {
    if (!canBroadcast || !uploadedFile || !adminProfile) return;
    setBroadcasting(true);
    try {
      const refNum = await getNextReferenceNumber('SAS');
      const resolvedTargetOrgIds = distribution === "all"
        ? activeOrgs.map(o => o.id)
        : distribution === "type"
          ? (selectedOrgs.length > 0 ? selectedOrgs : filteredOrgs.map(o => o.id))
          : selectedOrgs;

      await createDocument({
        type: 'broadcast',
        title,
        description,
        category: category || '',
        categoryId: categoryId || '',
        fileUrl: uploadedFile.url,
        fileName: uploadedFile.name,
        fileType: inferFileType(uploadedFile.name),
        fileSize: uploadedFile.size,
        semesterId: activeSemester?.id ?? '',
        academicYear: activeSemester?.academicYear ?? '',
        semester: activeSemester?.semester ?? '',
        referenceNumber: refNum,
        // submission fields (unused for broadcast)
        submittedBy: '',
        submittedByEmail: '',
        submittedByOrgId: '',
        submittedByOrgName: '',
        submittedByOrgAcronym: '',
        submittedByOrgTypeId: '',
        status: 'Approved',
        remarks: null,
        reviewedBy: null,
        reviewedAt: null,
        resubmissionOf: null,
        resubmissionNote: null,
        // broadcast fields
        broadcastBy: adminProfile.displayName,
        broadcastByUid: adminProfile.uid,
        distribution,
        targetOrgIds: resolvedTargetOrgIds,
        targetOrgTypeId: distribution === 'type' ? selectedTypeId : null,
        readBy: {},
      });
      setBroadcastRef(refNum);
      setBroadcast(true);
    } catch (err) {
      console.error('Broadcast failed:', err);
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[88vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Radio className="w-6 h-6 text-[#FFD41C]" />
            <div>
              <p className="text-white font-bold text-lg">Broadcast Document to Clubs</p>
              <p className="text-white/80 text-xs">Student Affairs Services → Student Organizations</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>

        {broadcast ? (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 bg-gradient-to-b from-[#001A4D] to-[#0E4EBD] flex flex-col items-center justify-center p-8 text-center">
              <Radio className="w-14 h-14 text-[#FFD41C] mb-4" />
              <p className="text-white font-bold text-xl mb-1">Document Broadcast Successful!</p>
              <p className="text-white/90 text-sm mb-2">{targetOrgCount} organizations notified.</p>
              <p className="text-[#FFD41C] font-bold font-mono text-base">{broadcastRef}</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 border border-white/50 text-white bg-[#001A4D] rounded-lg text-sm font-medium hover:bg-[#001A4D]/90 transition-colors">Broadcast Another</button>
              <button onClick={onClose} className="flex-1 py-2.5 bg-[#FFD41C] text-[#001A4D] rounded-lg text-sm font-bold hover:bg-[#FFD41C]/90 transition-colors">View Sent Documents</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Section A — Document Details */}
              <div>
                <div className="border-l-4 border-[#0E4EBD] pl-3 mb-4">
                  <p className="text-[#001A4D] font-bold text-sm">Document Details</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Document Title <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="e.g. Updated Activity Letter Template / Campus Policy Memo No. 12-2026" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]" value={category} onChange={(e) => {
                      setCategory(e.target.value);
                      const cat = activeCategories.find(c => c.name === e.target.value);
                      setCategoryId(cat?.id ?? '');
                    }}>
                      <option value="">Select category...</option>
                      {activeCategories.map((cat) => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description / Message to Clubs</label>
                    <textarea rows={3} placeholder="Add a message to accompany this document — clubs will see this in their inbox alongside the file." className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Section B — File */}
              <div>
                <div className="border-l-4 border-[#0E4EBD] pl-3 mb-3">
                  <p className="text-[#001A4D] font-bold text-sm">File Attachment</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
                {uploadedFile ? (
                  <div className="flex items-center gap-4 p-4 bg-white border-2 border-[#0E4EBD] rounded-xl">
                    <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[#001A4D] font-bold text-sm">{uploadedFile.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-green-600 text-xs">Uploaded · {formatBytes(uploadedFile.size)}</span>
                      </div>
                    </div>
                    <button onClick={() => setUploadedFile(null)} className="text-red-500 p-1"><X className="w-4 h-4" /></button>
                  </div>
                ) : uploading ? (
                  <div className="w-full h-28 flex flex-col items-center justify-center border-2 border-dashed border-[#0E4EBD]/40 bg-blue-50/40 rounded-xl">
                    <Loader2 className="w-8 h-8 text-[#0E4EBD] mb-1 animate-spin" />
                    <p className="text-sm text-gray-600">Uploading...</p>
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()} className="w-full h-28 flex flex-col items-center justify-center border-2 border-dashed border-[#0E4EBD]/40 bg-blue-50/40 rounded-xl cursor-pointer hover:border-[#0E4EBD] hover:bg-blue-50 transition-colors">
                    <Upload className="w-8 h-8 text-[#0E4EBD] mb-1" />
                    <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                    <p className="text-gray-400 text-xs italic">PDF, DOCX, XLSX, JPG, PNG · Max 25MB</p>
                  </div>
                )}
                {uploadError && <p className="text-red-500 text-xs mt-2"><AlertCircle className="w-3 h-3 inline mr-1" />{uploadError}</p>}
              </div>

              {/* Section C — Distribution */}
              <div>
                <div className="border-l-4 border-[#0E4EBD] pl-3 mb-3">
                  <p className="text-[#001A4D] font-bold text-sm">Send To</p>
                </div>
                <div className="space-y-2">
                  {([
                    { key: "all" as const, icon: Building2, label: "All Organizations", desc: `Broadcast to all ${activeOrgs.length} active student organizations`, borderColor: "border-[#0E4EBD]", bg: "bg-[#E8F0FF]" },
                    { key: "specific" as const, icon: Building2, label: "Specific Organizations", desc: "Choose which clubs receive this document", borderColor: "border-blue-500", bg: "bg-blue-50" },
                    { key: "type" as const, icon: Users, label: "By Organization Type", desc: "Filter by type, then pick clubs", borderColor: "border-[#0E4EBD]", bg: "bg-[#E8F0FF]" },
                  ]).map((opt) => (
                    <div key={opt.key}>
                      <button
                        onClick={() => { setDistribution(opt.key); setSelectedOrgs([]); setSelectedTypeId(""); }}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-colors ${distribution === opt.key ? `${opt.borderColor} ${opt.bg}` : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <opt.icon className={`w-5 h-5 flex-shrink-0 ${distribution === opt.key ? "text-[#0E4EBD]" : "text-gray-400"}`} />
                        <div>
                          <p className="text-[#001A4D] font-bold text-sm">{opt.label}</p>
                          <p className="text-gray-500 text-xs">{opt.desc}</p>
                        </div>
                      </button>

                      {/* Type selector */}
                      {opt.key === "type" && distribution === "type" && (
                        <div className="mt-2 space-y-2">
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent"
                            value={selectedTypeId}
                            onChange={(e) => { setSelectedTypeId(e.target.value); setSelectedOrgs([]); }}
                          >
                            <option value="">Select organization type...</option>
                            {orgTypes.filter(t => !t.archived).map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          {selectedTypeId && (
                            <OrgChecklist orgs={filteredOrgs} selectedOrgs={selectedOrgs} toggleOrg={toggleOrg} setSelectedOrgs={setSelectedOrgs} search={orgSearch} setSearch={setOrgSearch} />
                          )}
                        </div>
                      )}

                      {/* Specific org list */}
                      {opt.key === "specific" && distribution === "specific" && (
                        <div className="mt-2">
                          <OrgChecklist orgs={filteredOrgs} selectedOrgs={selectedOrgs} toggleOrg={toggleOrg} setSelectedOrgs={setSelectedOrgs} search={orgSearch} setSearch={setOrgSearch} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="p-3 bg-[#E8F0FF] border border-[#0E4EBD]/30 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-[#0E4EBD]" />
                  <p className="text-[#0E4EBD] font-bold text-xs">Broadcast Preview</p>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-100">
                  <div className="w-6 h-6 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {adminProfile ? adminProfile.firstName.charAt(0) + adminProfile.lastName.charAt(0) : 'SA'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#001A4D] font-bold text-xs truncate">{title || "Document Title"}</p>
                    <p className="text-gray-400 text-[10px]">SAS Admin · {adminProfile?.displayName ?? 'Admin'} · Just now</p>
                  </div>
                  {category && <CategoryPill category={category} />}
                  <span className="w-2 h-2 bg-[#0E4EBD] rounded-full flex-shrink-0" />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
              <button className="flex items-center gap-2 px-4 py-2 border border-[#0E4EBD] text-[#0E4EBD] rounded-lg text-sm font-medium hover:bg-[#0E4EBD]/5 transition-colors">
                <Save className="w-4 h-4" />
                Save as Draft
              </button>
              <button
                onClick={handleBroadcast}
                disabled={!canBroadcast}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${canBroadcast ? "bg-[#001A4D] text-[#FFD41C] hover:bg-[#001A4D]/90" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
              >
                {broadcasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                Broadcast to {targetOrgCount} Organization{targetOrgCount !== 1 ? "s" : ""}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Org Checklist (reused by specific + type distribution) ──────────────────
function OrgChecklist({ orgs, selectedOrgs, toggleOrg, setSelectedOrgs, search, setSearch }: {
  orgs: { id: string; name: string; acronym: string; typeId: string }[];
  selectedOrgs: string[];
  toggleOrg: (id: string) => void;
  setSelectedOrgs: (ids: string[]) => void;
  search: string;
  setSearch: (s: string) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-100">
        <input type="text" placeholder="Search organization name..." className="w-full text-sm border-none outline-none" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="max-h-40 overflow-y-auto">
        {orgs.length === 0 ? (
          <p className="px-4 py-3 text-gray-400 text-sm text-center">No organizations found</p>
        ) : orgs.map((org) => (
          <label key={org.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={selectedOrgs.includes(org.id)} onChange={() => toggleOrg(org.id)} className="accent-[#0E4EBD]" />
            <div className="w-7 h-7 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{org.acronym.slice(0, 2)}</div>
            <div>
              <p className="text-sm text-[#001A4D] font-medium">{org.name}</p>
              <p className="text-xs text-gray-400">{org.acronym}</p>
            </div>
          </label>
        ))}
      </div>
      {selectedOrgs.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100">
          <span className="text-[#0E4EBD] text-xs font-medium">{selectedOrgs.length} organizations selected</span>
          <button onClick={() => setSelectedOrgs([])} className="text-gray-400 text-xs hover:text-gray-600">Clear All</button>
        </div>
      )}
    </div>
  );
}

// ─── Incoming Queue Tab ────────────────────────────────────────────────────────
function IncomingQueueTab() {
  const navigate = useNavigate();
  const { data: incoming, loading } = useIncomingDocuments();
  const { data: orgs } = useOrganizationStream();
  const { profile: adminProfile } = useAdviserProfile();
  const [approvePopover, setApprovePopover] = useState<string | null>(null);
  const [rejectPopover, setRejectPopover] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentDocument | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState("All");

  const filtered = useMemo(() => {
    let list = incoming;
    if (statusFilter !== "All") list = list.filter(d => d.status === statusFilter);
    if (orgFilter !== "All") list = list.filter(d => d.submittedByOrgId === orgFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d => d.title.toLowerCase().includes(q) || d.referenceNumber.toLowerCase().includes(q) || d.submittedByOrgName.toLowerCase().includes(q));
    }
    return list;
  }, [incoming, statusFilter, orgFilter, searchQuery]);

  const handleApprove = async (docId: string, remarks: string) => {
    if (!adminProfile) return;
    await reviewDocument(docId, 'Approved', adminProfile.uid, remarks || null);
    setApprovePopover(null);
  };

  const handleReject = async (docId: string, remarks: string) => {
    if (!adminProfile) return;
    await reviewDocument(docId, 'Rejected', adminProfile.uid, remarks);
    setRejectPopover(null);
  };

  const toggleSelect = (id: string) => setSelected(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]);

  const uniqueOrgs = useMemo(() => {
    const map = new Map<string, string>();
    incoming.forEach(d => { if (d.submittedByOrgId) map.set(d.submittedByOrgId, d.submittedByOrgName); });
    return Array.from(map.entries());
  }, [incoming]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-[#0E4EBD] animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search document title, org name, or reference..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent" value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
          <option value="All">All Organizations</option>
          {uniqueOrgs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <div className="flex gap-1">
          {["All", "Pending", "Approved", "Rejected", "Resubmitted"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? "bg-[#001A4D] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{s}</button>
          ))}
        </div>
        <p className="text-gray-400 text-xs ml-auto">Showing {filtered.length} documents</p>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-[#001A4D] font-bold text-lg mb-1">No documents found</p>
            <p className="text-gray-500 text-sm">
              {incoming.length === 0 ? "No submissions yet. Officer documents will appear here." : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-[#E0E0E0]">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" className="accent-[#0E4EBD]" onChange={(e) => setSelected(e.target.checked ? filtered.map(d => d.id) : [])} />
                  </th>
                  {["Reference #", "Document Title", "Organization", "Category", "Submitted By", "Date Submitted", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => {
                  const isPending = doc.status === "Pending" || doc.status === "Resubmitted";
                  const createdDate = toDate(doc.createdAt);
                  const daysInQueue = createdDate ? Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                  return (
                    <tr key={doc.id} className={`border-b border-[#E0E0E0] hover:bg-[#E8F0FF]/20 transition-colors group ${isPending ? "border-l-4 border-l-[#FFD41C]" : ""}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.includes(doc.id)} onChange={() => toggleSelect(doc.id)} className="accent-[#0E4EBD]" />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isPending && <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse flex-shrink-0" />}
                          {doc.referenceNumber}
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[180px]">
                        <p className="text-[#001A4D] font-bold text-sm leading-tight">{doc.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <FileChip type={doc.fileType} />
                          <span className="text-gray-400 text-xs">{formatBytes(doc.fileSize)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{doc.submittedByOrgAcronym?.slice(0, 2) || '??'}</div>
                          <div>
                            <p className="text-[#001A4D] text-xs font-medium leading-tight">{doc.submittedByOrgName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><CategoryPill category={doc.category} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 bg-[#E8F0FF] rounded-full flex items-center justify-center text-[#0E4EBD] text-[10px] font-bold flex-shrink-0">
                            {doc.submittedBy.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-gray-600 text-xs">{doc.submittedBy}</p>
                            <span className="px-1 py-0.5 bg-[#E8F0FF] text-[#0E4EBD] text-[9px] rounded font-medium">Officer</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {createdDate && (
                          <>
                            <p className="text-gray-600 text-xs">{format(createdDate, 'MMM dd, yyyy')}</p>
                            <p className="text-gray-400 text-[10px] italic">{formatDistanceToNow(createdDate, { addSuffix: true })}</p>
                            {isPending && daysInQueue > 2 && <p className="text-amber-600 text-[10px] italic">{daysInQueue} days in queue</p>}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusPill status={doc.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 relative">
                          <button onClick={() => setPreviewDoc(doc)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 transition-colors" title="Quick Preview"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => navigate(`/home/documents/${doc.id}/review`)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E8F0FF] text-[#0E4EBD] transition-colors" title="Full Review"><FileText className="w-4 h-4" /></button>
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 text-[#001A4D] transition-colors" title="Download"><Download className="w-4 h-4" /></a>
                          {(doc.status === "Pending" || doc.status === "Resubmitted") && (
                            <>
                              <button onClick={() => { setApprovePopover(approvePopover === doc.id ? null : doc.id); setRejectPopover(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-50 text-green-600 transition-colors"><Check className="w-4 h-4" /></button>
                              <button onClick={() => { setRejectPopover(rejectPopover === doc.id ? null : doc.id); setApprovePopover(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-600 transition-colors"><X className="w-4 h-4" /></button>
                            </>
                          )}
                          {approvePopover === doc.id && <QuickApprovePopover doc={doc} onClose={() => setApprovePopover(null)} onApprove={(r) => handleApprove(doc.id, r)} />}
                          {rejectPopover === doc.id && <QuickRejectPopover doc={doc} onClose={() => setRejectPopover(null)} onReject={(r) => handleReject(doc.id, r)} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-5 py-3 bg-[#001A4D] rounded-2xl shadow-2xl z-20">
          <p className="text-white text-sm font-medium">{selected.length} documents selected</p>
          <button className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-400 text-white text-xs font-bold rounded-lg">Approve Selected</button>
          <button className="px-4 py-2 border border-white/30 text-white text-xs rounded-lg hover:bg-white/10 transition-colors">Export Selected</button>
          <button onClick={() => setSelected([])} className="text-white/60 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

// ─── Sent Tab ──────────────────────────────────────────────────────────────────
function SentTab() {
  const { data: sent, loading } = useSentDocuments();
  const { data: orgs } = useOrganizationStream();
  const [previewDoc, setPreviewDoc] = useState<DocumentDocument | null>(null);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-[#0E4EBD] animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search sent documents..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent" />
        </div>
        <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm"><option>All Categories</option></select>
      </div>

      {sent.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#E0E0E0] rounded-2xl">
          <Radio className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-[#001A4D] font-bold text-lg mb-1">No broadcasts yet</p>
          <p className="text-gray-500 text-sm">Documents you broadcast to clubs will appear here.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-[#E0E0E0]">
              <tr>
                {["Reference #", "Document Title", "Category", "Date Sent", "Sent To", "Read By", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sent.map((doc) => {
                const readCount = doc.readBy ? Object.keys(doc.readBy).length : 0;
                const totalTargets = doc.distribution === 'all' ? orgs.filter(o => o.status === 'active').length : doc.targetOrgIds.length;
                const createdDate = toDate(doc.createdAt);
                return (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{doc.referenceNumber}</td>
                    <td className="px-4 py-3">
                      <p className="text-[#001A4D] font-bold text-sm">{doc.title}</p>
                      <div className="flex items-center gap-1.5 mt-1"><FileChip type={doc.fileType} /></div>
                    </td>
                    <td className="px-4 py-3"><CategoryPill category={doc.category} /></td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{createdDate ? format(createdDate, 'MMM dd, yyyy') : '—'}</td>
                    <td className="px-4 py-3">
                      {doc.distribution === "all" ? (
                        <span className="px-2 py-0.5 bg-[#001A4D]/10 text-[#001A4D] text-xs rounded-full font-medium">All Organizations ({totalTargets})</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-[#E8F0FF] text-[#0E4EBD] text-xs rounded-full font-medium">{doc.targetOrgIds.length} Organizations</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-400 text-xs">{readCount} of {totalTargets} orgs opened</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setPreviewDoc(doc)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 transition-colors" title="View Document"><Eye className="w-3.5 h-3.5" /></button>
                        <a href={doc.fileUrl} download className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-50 text-[#001A4D] transition-colors"><Download className="w-3.5 h-3.5" /></a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function AdminDocuments() {
  const [tab, setTab] = useState<"incoming" | "sent">("incoming");
  const [showBroadcast, setShowBroadcast] = useState(false);

  const { data: incoming } = useIncomingDocuments();
  const { data: sent } = useSentDocuments();

  const pendingCount = incoming.filter(d => d.status === "Pending" || d.status === "Resubmitted").length;
  const approvedCount = incoming.filter(d => d.status === "Approved").length;
  const rejectedCount = incoming.filter(d => d.status === "Rejected").length;
  const uniqueOrgs = new Set(incoming.map(d => d.submittedByOrgId)).size;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Document Management</h2>
          <p className="text-gray-500 text-sm">Dashboard &rsaquo; Document Management</p>
        </div>
        <button
          onClick={() => setShowBroadcast(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#001A4D] text-[#FFD41C] rounded-lg font-bold text-sm hover:bg-[#001A4D]/90 transition-colors"
        >
          <Radio className="w-4 h-4" />
          Broadcast Document to Clubs
        </button>
      </div>

      {/* Context banner */}
      <div className="flex items-center justify-between p-5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] rounded-2xl">
        <div className="flex items-center gap-4">
          <FileText className="w-8 h-8 text-[#FFD41C]" />
          <div>
            <p className="text-white font-bold text-base">Electronic Document Management System</p>
            <p className="text-white/80 text-sm leading-relaxed">Centralized document routing between Student Organizations and the Student Affairs Services. Review incoming submissions and broadcast official documents to clubs.</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 bg-white/15 rounded-xl">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-white text-xs font-medium">{pendingCount} Pending Review</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white/15 rounded-xl">
            <Send className="w-4 h-4 text-blue-300" />
            <span className="text-white text-xs font-medium">{sent.length} Sent This Semester</span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Pending Documents", value: pendingCount, note: "requires your review", gradient: "from-amber-500 to-amber-400", Icon: Clock, pulse: pendingCount > 0 },
          { label: "Approved This Semester", value: approvedCount, note: "approved submissions", gradient: "from-green-500 to-green-400", Icon: CheckCircle },
          { label: "Rejected", value: rejectedCount, note: "awaiting resubmission", gradient: "from-red-500 to-orange-400", Icon: XCircle },
          { label: "Broadcast to Clubs", value: sent.length, note: "sent by SAS this semester", gradient: "from-blue-600 to-blue-400", Icon: Radio },
          { label: "Organizations Submitting", value: uniqueOrgs, note: "active submitters", gradient: "from-[#001A4D] to-[#0E4EBD]", Icon: Building2 },
        ].map((card) => (
          <div key={card.label} className={`bg-gradient-to-br ${card.gradient} rounded-xl p-4 text-white relative`}>
            {card.pulse && <span className="absolute top-3 right-3 w-2 h-2 bg-white rounded-full animate-ping" />}
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mb-3">
              <card.Icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-3xl font-bold mb-0.5">{card.value}</p>
            <p className="text-white/90 text-xs">{card.label}</p>
            <p className="text-white/70 text-[10px] mt-0.5">{card.note}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([["incoming", "Incoming Queue"], ["sent", "Sent to Clubs"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === key ? "bg-[#001A4D] text-white border-[#FFD41C] -mb-px rounded-t-lg" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {label}
            {key === "incoming" && pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "incoming" ? <IncomingQueueTab /> : <SentTab />}

      {showBroadcast && <BroadcastModal onClose={() => setShowBroadcast(false)} />}
    </div>
  );
}
