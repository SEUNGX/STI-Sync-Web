import React, { useState, useRef, useMemo } from "react";
import {
  Upload, Clock, CheckCircle, XCircle, Mail, ArrowUp, ArrowDown,
  Eye, Download, RefreshCw, Trash2, Search, Send, Save,
  FileText, X, MessageSquare, ChevronDown, ChevronUp,
  Mailbox, EyeOff, BellOff, Loader2, AlertCircle,
} from "lucide-react";
import { useDocumentCategories } from '../../modules/documents/hooks/useDocumentCategories';
import { useOfficerSubmissions, useOfficerInbox } from '../../modules/documents/hooks/useDocumentStream';
import { createDocument, getNextReferenceNumber, markDocumentRead } from '../../modules/documents/services/document.service';
import { DocumentPreviewModal } from '../../modules/documents/components/DocumentPreviewModal';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useSemesters } from '../../modules/academic/hooks/useAcademicStream';
import { uploadToCloudinary } from '../../../services/cloudinary';
import { inferFileType, DOCUMENT_ACCEPTED_TYPES, DOCUMENT_MAX_BYTES } from '../../modules/documents/types/document.types';
import type { DocumentDocument, DocStatus } from '../../modules/documents/types/document.types';
import { formatDistanceToNow, format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────
type MainTab = "submissions" | "inbox";

// ─── Helpers ───────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  "Activity Letter": "bg-indigo-50 text-indigo-700",
  "Accreditation Paper": "bg-blue-100 text-blue-700",
  "Waiver": "bg-amber-100 text-amber-700",
  "Financial Report": "bg-green-100 text-green-700",
  "Event Proposal": "bg-[#001A4D]/10 text-[#001A4D]",
  "Certificate Request": "bg-teal-100 text-teal-700",
  "Memorandum": "bg-gray-100 text-gray-600",
  "Approved Template": "bg-green-100 text-green-700",
  "Memo": "bg-gray-100 text-gray-600",
  "Guidelines": "bg-blue-100 text-blue-700",
  "Policy": "bg-[#001A4D]/10 text-[#001A4D]",
};

function CategoryPill({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category] || "bg-gray-100 text-gray-600";
  return <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${cls}`}>{category}</span>;
}

function FileChip({ type }: { type: string }) {
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${type === "PDF" ? "bg-red-500 text-white" : "bg-blue-600 text-white"}`}>
      {type}
    </span>
  );
}

function StatusPill({ status }: { status: DocStatus }) {
  const map: Record<DocStatus, { cls: string; icon: React.ReactNode; label: string }> = {
    Pending: { cls: "bg-amber-500 text-white", icon: <Clock className="w-3 h-3" />, label: "Pending Review" },
    Approved: { cls: "bg-green-500 text-white", icon: <CheckCircle className="w-3 h-3" />, label: "Approved" },
    Rejected: { cls: "bg-red-500 text-white", icon: <XCircle className="w-3 h-3" />, label: "Rejected" },
    Resubmitted: { cls: "bg-blue-600 text-white", icon: <RefreshCw className="w-3 h-3" />, label: "Resubmitted" },
    Draft: { cls: "bg-gray-400 text-white", icon: <FileText className="w-3 h-3" />, label: "Draft" },
  };
  const { cls, icon, label } = map[status] ?? { cls: "bg-gray-400 text-white", icon: null, label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${cls}`}>
      {icon} {label}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function toDate(ts: Timestamp | undefined | null): Date | null {
  if (!ts) return null;
  return ts.toDate();
}

// ─── Submit Document Modal ─────────────────────────────────────────────────────
function SubmitDocModal({ onClose, orgId, orgName, orgAcronym, orgTypeId, officerName, officerEmail }: {
  onClose: () => void;
  orgId: string;
  orgName: string;
  orgAcronym: string;
  orgTypeId: string;
  officerName: string;
  officerEmail: string;
}) {
  const { data: docCategories } = useDocumentCategories();
  const activeCategories = docCategories.filter(c => c.active && c.officerCanSubmit);
  const { data: semesters } = useSemesters();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [semesterLabel, setSemesterLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitRef, setSubmitRef] = useState("");

  // File upload
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = title.trim() && category && uploadedFile && semesterId && !submitting;

  const handleFileSelect = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const result = await uploadToCloudinary(file, {
        folder: 'documents/submissions',
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

  const handleSemesterChange = (id: string) => {
    setSemesterId(id);
    const sem = semesters.find(s => s.id === id);
    if (sem) {
      setAcademicYear(sem.academicYear);
      setSemesterLabel(sem.semester);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !uploadedFile) return;
    setSubmitting(true);
    try {
      const refNum = await getNextReferenceNumber('DOC');
      await createDocument({
        type: 'submission',
        title,
        description: notes,
        category,
        categoryId,
        fileUrl: uploadedFile.url,
        fileName: uploadedFile.name,
        fileType: inferFileType(uploadedFile.name),
        fileSize: uploadedFile.size,
        semesterId,
        academicYear,
        semester: semesterLabel,
        referenceNumber: refNum,
        submittedBy: officerName,
        submittedByEmail: officerEmail,
        submittedByOrgId: orgId,
        submittedByOrgName: orgName,
        submittedByOrgAcronym: orgAcronym,
        submittedByOrgTypeId: orgTypeId,
        status: 'Pending',
        remarks: null,
        reviewedBy: null,
        reviewedAt: null,
        resubmissionOf: null,
        resubmissionNote: null,
        broadcastBy: '',
        broadcastByUid: '',
        distribution: 'all',
        targetOrgIds: [],
        targetOrgTypeId: null,
        readBy: {},
      });
      setSubmitRef(refNum);
      setSubmitted(true);
    } catch (err) {
      console.error('Submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[600px] max-h-[88vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">Submit Document to SAS</p>
              <p className="text-white/80 text-xs">Student Affairs Services — STI College Ormoc</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>

        {submitted ? (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 bg-gradient-to-b from-green-500 to-green-600 flex flex-col items-center justify-center p-8 text-center">
              <CheckCircle className="w-14 h-14 text-white mb-4" />
              <p className="text-white font-bold text-xl mb-1">Document Submitted Successfully!</p>
              <p className="text-[#FFD41C] font-bold text-base font-mono mb-2">{submitRef}</p>
              <p className="text-white/90 text-sm">The SAS Adviser has been notified and will review your submission.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 border border-[#0E4EBD] text-[#0E4EBD] rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">Submit Another</button>
              <button onClick={onClose} className="flex-1 py-2.5 bg-[#001A4D] text-[#FFD41C] rounded-lg text-sm font-bold hover:bg-[#001A4D]/90 transition-colors">View My Submissions</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Document Details */}
              <div>
                <div className="border-l-4 border-[#0E4EBD] pl-3 mb-4">
                  <p className="text-[#001A4D] font-bold text-sm">Document Details</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Document Title <span className="text-red-500">*</span></label>
                    <input type="text" maxLength={150} placeholder="e.g. Activity Letter for IT Guild GenAss 2026" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
                    <p className="text-right text-xs text-gray-400 mt-0.5">{title.length}/150</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent text-sm" value={category} onChange={(e) => {
                      setCategory(e.target.value);
                      const cat = activeCategories.find(c => c.name === e.target.value);
                      setCategoryId(cat?.id ?? '');
                    }}>
                      <option value="">Select document category...</option>
                      {activeCategories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Semester <span className="text-red-500">*</span></label>
                      <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent text-sm" value={semesterId} onChange={(e) => handleSemesterChange(e.target.value)}>
                        <option value="">Select semester...</option>
                        {semesters.filter(s => !s.archived).map(s => (
                          <option key={s.id} value={s.id}>{s.semester} — A.Y. {s.academicYear}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Academic Year</label>
                      <input type="text" readOnly className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-600" value={academicYear ? `A.Y. ${academicYear}` : 'Auto-filled from semester'} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Submission Notes</label>
                    <textarea rows={3} placeholder="Add any context or instructions for the SAS Adviser reviewing this document... (optional)" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent resize-none text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
                    <p className="text-xs text-gray-400 mt-0.5">These notes are visible to the SAS Adviser during review.</p>
                  </div>
                </div>
              </div>

              {/* File Attachment */}
              <div>
                <div className="border-l-4 border-[#0E4EBD] pl-3 mb-4">
                  <p className="text-[#001A4D] font-bold text-sm">Attach Document</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />

                {uploadedFile ? (
                  <div className="flex items-center gap-4 p-4 bg-white border-2 border-[#0E4EBD] rounded-xl">
                    <div className="w-14 h-14 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#001A4D] font-bold text-sm truncate">{uploadedFile.name}</p>
                      <p className="text-gray-400 text-xs">{formatBytes(uploadedFile.size)}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-green-600 text-xs font-medium">Ready to submit</span>
                      </div>
                    </div>
                    <button onClick={() => setUploadedFile(null)} className="text-red-500 hover:text-red-700 p-1.5 cursor-pointer"><X className="w-5 h-5" /></button>
                  </div>
                ) : uploading ? (
                  <div className="w-full h-[140px] flex flex-col items-center justify-center border-2 border-dashed border-[#0E4EBD]/40 bg-blue-50/50 rounded-xl">
                    <Loader2 className="w-12 h-12 text-[#0E4EBD] mb-2 animate-spin" />
                    <p className="text-[#001A4D] font-bold text-sm">Uploading...</p>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFileSelect(f); }}
                    className={`w-full h-[140px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-colors ${dragging ? "border-[#0E4EBD] bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-[#0E4EBD] hover:bg-blue-50/40"}`}
                  >
                    <Upload className="w-12 h-12 text-[#0E4EBD] mb-2" />
                    <p className="text-[#001A4D] font-bold text-sm">Drag and drop your file here</p>
                    <p className="text-gray-500 text-xs mb-1">or</p>
                    <span className="text-[#0E4EBD] text-sm font-semibold underline cursor-pointer">Browse Files</span>
                    <p className="text-gray-400 text-xs italic mt-2">PDF, DOCX, DOC, XLSX, JPG, PNG · Max 25MB</p>
                  </div>
                )}
                {uploadError && <p className="text-red-500 text-xs mt-2"><AlertCircle className="w-3 h-3 inline mr-1" />{uploadError}</p>}
              </div>

              {/* Reference Preview */}
              {canSubmit && (
                <div className="flex items-center gap-3 p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <FileText className="w-4 h-4 text-[#0E4EBD] flex-shrink-0" />
                  <div>
                    <p className="text-[#0E4EBD] text-xs font-semibold">Your submission will be assigned a reference number upon submit.</p>
                    <p className="text-gray-500 text-xs italic">This reference number will be used to track your document.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">
                <Save className="w-4 h-4" />
                Save as Draft
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors cursor-pointer ${canSubmit ? "bg-[#001A4D] hover:bg-[#0E4EBD] text-white shadow-xs" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-[#FFD41C]" />}
                Submit to SAS
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Resubmit Modal ────────────────────────────────────────────────────────────
function ResubmitModal({ doc, onClose, orgId, orgName, orgAcronym, orgTypeId, officerName, officerEmail }: {
  doc: DocumentDocument;
  onClose: () => void;
  orgId: string;
  orgName: string;
  orgAcronym: string;
  orgTypeId: string;
  officerName: string;
  officerEmail: string;
}) {
  const [changes, setChanges] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // File upload
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const result = await uploadToCloudinary(file, {
        folder: 'documents/submissions',
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

  const handleResubmit = async () => {
    if (!changes.trim() || !uploadedFile) return;
    setSubmitting(true);
    try {
      const refNum = await getNextReferenceNumber('DOC');
      await createDocument({
        type: 'submission',
        title: doc.title,
        description: changes,
        category: doc.category,
        categoryId: doc.categoryId,
        fileUrl: uploadedFile.url,
        fileName: uploadedFile.name,
        fileType: inferFileType(uploadedFile.name),
        fileSize: uploadedFile.size,
        semesterId: doc.semesterId,
        academicYear: doc.academicYear,
        semester: doc.semester,
        referenceNumber: refNum,
        submittedBy: officerName,
        submittedByEmail: officerEmail,
        submittedByOrgId: orgId,
        submittedByOrgName: orgName,
        submittedByOrgAcronym: orgAcronym,
        submittedByOrgTypeId: orgTypeId,
        status: 'Resubmitted',
        remarks: null,
        reviewedBy: null,
        reviewedAt: null,
        resubmissionOf: doc.id,
        resubmissionNote: changes,
        broadcastBy: '',
        broadcastByUid: '',
        distribution: 'all',
        targetOrgIds: [],
        targetOrgTypeId: null,
        readBy: {},
      });
      onClose();
    } catch (err) {
      console.error('Resubmit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[88vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-white" />
            <div>
              <p className="text-white font-bold text-base">Resubmit Document</p>
              <p className="text-white/80 text-xs">Addressing SAS Feedback</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {doc.remarks && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-red-600" />
                <p className="text-red-600 font-bold text-xs">Rejection Reason</p>
              </div>
              <p className="text-[#001A4D] text-sm italic">{doc.remarks}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">What Changed? <span className="text-red-500">*</span></label>
            <textarea rows={4} placeholder="Describe what you changed or corrected in the new version... (required)" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] resize-none text-sm" value={changes} onChange={(e) => setChanges(e.target.value)} />
            <p className="text-xs text-gray-400 mt-0.5">This message is sent to the SAS Adviser alongside your resubmission.</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Upload Corrected Document</p>
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
            {uploadedFile ? (
              <div className="flex items-center gap-3 p-3 bg-white border-2 border-[#0E4EBD] rounded-xl">
                <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[#001A4D] font-medium text-sm">{uploadedFile.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-green-600 text-xs">Ready</span>
                  </div>
                </div>
                <button onClick={() => setUploadedFile(null)} className="text-red-500 p-1 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            ) : uploading ? (
              <div className="w-full h-28 flex flex-col items-center justify-center border-2 border-dashed border-[#0E4EBD]/40 bg-blue-50/50 rounded-xl">
                <Loader2 className="w-8 h-8 text-[#0E4EBD] mb-1 animate-spin" />
                <p className="text-sm text-gray-600">Uploading...</p>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="w-full h-28 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 bg-gray-50 rounded-xl cursor-pointer hover:border-[#0E4EBD] hover:bg-blue-50/40 transition-colors">
                <Upload className="w-8 h-8 text-[#0E4EBD] mb-1" />
                <p className="text-sm text-gray-600">Click to upload corrected document</p>
              </div>
            )}
            {uploadError && <p className="text-red-500 text-xs mt-2"><AlertCircle className="w-3 h-3 inline mr-1" />{uploadError}</p>}
            <div className="flex items-center gap-2 mt-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <p className="text-amber-700 text-xs">The original rejected file is preserved for records. Only upload the corrected version.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <span className="px-2.5 py-1 bg-blue-50 text-[#0E4EBD] border border-blue-200 text-xs rounded-full font-medium">{doc.title.slice(0, 30)}...</span>
            <CategoryPill category={doc.category} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex justify-between flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer">Cancel</button>
          <button
            disabled={!changes.trim() || !uploadedFile || submitting}
            onClick={handleResubmit}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors cursor-pointer ${changes.trim() && uploadedFile ? "bg-[#001A4D] hover:bg-[#0E4EBD] text-white shadow-xs" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-[#FFD41C]" />}
            Submit Corrected Document
          </button>
        </div>
      </div>
    </div>
  );
}

// InboxDetailModal removed in favor of universal DocumentPreviewModal

// ─── Row Expansion ────────────────────────────────────────────────────────────
function ExpandedRow({ doc }: { doc: DocumentDocument }) {
  const steps = [
    { label: "Submitted to SAS", done: true, color: "bg-blue-600" },
    { label: "Under Review", done: doc.status !== "Pending", color: "bg-amber-500" },
    { label: doc.status === "Approved" ? "Approved" : doc.status === "Rejected" ? "Rejected" : "Decision Pending", done: doc.status === "Approved" || doc.status === "Rejected", color: doc.status === "Approved" ? "bg-green-500" : "bg-red-500" },
  ];

  return (
    <tr className="bg-[#F3E8FF]/30">
      <td colSpan={8} className="px-6 py-4">
        <div className="flex gap-6">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${doc.fileType === "PDF" ? "bg-red-500" : "bg-blue-600"}`}>
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-[#001A4D] font-bold text-sm">{doc.title}</p>
              <p className="text-gray-400 text-xs">{formatBytes(doc.fileSize)} · {doc.fileType}</p>
            </div>
          </div>
          {doc.description && (
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 mb-1">Submission Notes</p>
              <p className="text-[#001A4D] text-sm italic">{doc.description}</p>
            </div>
          )}
          {doc.remarks && (
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 mb-1">SAS Remarks</p>
              <p className={`text-sm ${doc.status === "Rejected" ? "text-red-700" : "text-green-700"}`}>{doc.remarks}</p>
            </div>
          )}
          <div className="flex-shrink-0">
            <p className="text-xs font-medium text-gray-500 mb-2">Timeline</p>
            <div className="flex items-center gap-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${s.done ? s.color : "bg-gray-200"}`}>
                    {s.done && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`text-xs ${s.done ? "text-[#001A4D]" : "text-gray-400"} whitespace-nowrap`}>{s.label}</span>
                  {i < steps.length - 1 && <div className={`w-6 h-px ${s.done ? "bg-gray-400" : "bg-gray-200"}`} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── My Submissions Tab ────────────────────────────────────────────────────────
function SubmissionsTab({ orgId, orgName, orgAcronym, orgTypeId, officerName, officerEmail }: {
  orgId: string; orgName: string; orgAcronym: string; orgTypeId: string; officerName: string; officerEmail: string;
}) {
  const { data: submissions, loading } = useOfficerSubmissions(orgId);
  const { data: docCategories } = useDocumentCategories();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resubmitDoc, setResubmitDoc] = useState<DocumentDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentDocument | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const statuses: DocStatus[] = ["Pending", "Approved", "Rejected", "Resubmitted", "Draft"];

  const filtered = useMemo(() => {
    let list = submissions;
    if (statusFilter !== "All") list = list.filter(d => d.status === statusFilter);
    if (categoryFilter !== "All") list = list.filter(d => d.category === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d => d.title.toLowerCase().includes(q) || d.referenceNumber.toLowerCase().includes(q));
    }
    return list;
  }, [submissions, statusFilter, categoryFilter, searchQuery]);

  const uniqueCategories = useMemo(() => [...new Set(submissions.map(d => d.category))], [submissions]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-[#0E4EBD] animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 flex items-center gap-3 flex-wrap shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by document title or reference..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="All">All Categories</option>
          {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex gap-1">
          {["All", ...statuses].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${statusFilter === s ? "bg-[#001A4D] text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{s}</button>
          ))}
        </div>
        <p className="text-gray-400 text-xs ml-auto">Showing {filtered.length} documents</p>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-[#001A4D] font-bold text-lg mb-1">No submissions yet</p>
            <p className="text-gray-500 text-sm">Documents you submit to SAS will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-[#E0E0E0]">
                <tr>
                  {["Reference #", "Document Title", "Category", "Date Submitted", "Last Updated", "Status", "SAS Remarks", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => {
                  const createdDate = toDate(doc.createdAt);
                  const updatedDate = toDate(doc.updatedAt);
                  return (
                    <React.Fragment key={doc.id}>
                      <tr className="border-b border-[#E0E0E0] hover:bg-blue-50/40 transition-colors cursor-pointer group" onClick={() => setExpanded(expanded === doc.id ? null : doc.id)}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {doc.status === "Pending" && <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse flex-shrink-0" />}
                            {doc.referenceNumber}
                          </div>
                        </td>
                        <td className="px-4 py-3 min-w-[200px]">
                          <p className="text-[#001A4D] font-bold text-sm leading-tight">{doc.title}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <FileChip type={doc.fileType} />
                            <span className="text-gray-400 text-xs">{formatBytes(doc.fileSize)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><CategoryPill category={doc.category} /></td>
                        <td className="px-4 py-3">
                          {createdDate && (
                            <>
                              <p className="text-gray-600 text-sm">{format(createdDate, 'MMM dd, yyyy')}</p>
                              <p className="text-gray-400 text-xs italic">{formatDistanceToNow(createdDate, { addSuffix: true })}</p>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm whitespace-nowrap">{updatedDate ? format(updatedDate, 'MMM dd, yyyy') : '—'}</td>
                        <td className="px-4 py-3"><StatusPill status={doc.status} /></td>
                        <td className="px-4 py-3">
                          {!doc.remarks ? (
                            <span className="text-gray-400 text-sm italic">—</span>
                          ) : doc.status === "Approved" ? (
                            <button className="flex items-center gap-1 text-green-600 text-xs font-medium hover:underline"><MessageSquare className="w-3.5 h-3.5" /> View</button>
                          ) : (
                            <button className="flex items-center gap-1 text-red-600 text-xs font-medium underline"><MessageSquare className="w-3.5 h-3.5" /> View Reason</button>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setPreviewDoc(doc)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 transition-colors cursor-pointer" title="View Document"><Eye className="w-4 h-4" /></button>
                            <a href={doc.fileUrl} download className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 text-[#001A4D] transition-colors"><Download className="w-4 h-4" /></a>
                            {(doc.status === "Rejected" || doc.status === "Draft") && (
                              <button onClick={() => setResubmitDoc(doc)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-[#0E4EBD] transition-colors cursor-pointer"><RefreshCw className="w-4 h-4" /></button>
                            )}
                            {expanded === doc.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          </div>
                        </td>
                      </tr>
                      {expanded === doc.id && <ExpandedRow doc={doc} />}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resubmitDoc && <ResubmitModal doc={resubmitDoc} onClose={() => setResubmitDoc(null)} orgId={orgId} orgName={orgName} orgAcronym={orgAcronym} orgTypeId={orgTypeId} officerName={officerName} officerEmail={officerEmail} />}
      {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

// ─── Inbox Tab ─────────────────────────────────────────────────────────────────
function InboxTab({ orgId }: { orgId: string }) {
  const { data: inbox, loading } = useOfficerInbox(orgId);
  const [previewDoc, setPreviewDoc] = useState<DocumentDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = inbox;
    if (showUnreadOnly) list = list.filter(d => !d.readBy?.[orgId]);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d => d.title.toLowerCase().includes(q));
    }
    return list;
  }, [inbox, showUnreadOnly, searchQuery, orgId]);

  const unreadCount = inbox.filter(d => !d.readBy?.[orgId]).length;

  const handleOpenDoc = async (doc: DocumentDocument) => {
    setPreviewDoc(doc);
    if (!doc.readBy?.[orgId]) {
      await markDocumentRead(doc.id, orgId);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-[#0E4EBD] animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Context card */}
      <div className="flex items-start justify-between p-4 bg-blue-50/70 border border-blue-200 rounded-xl shadow-xs">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-700 font-bold text-sm mb-0.5">Official Documents from SAS</p>
            <p className="text-gray-700 text-sm">These are official memos, guidelines, approved forms, and files sent directly to your organization by the Student Affairs Services.</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 flex items-center gap-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search documents from SAS..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" className="accent-[#0E4EBD]" checked={showUnreadOnly} onChange={(e) => setShowUnreadOnly(e.target.checked)} />
          Show Unread Only
        </label>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#E0E0E0] rounded-2xl shadow-xs">
          <Mailbox className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <p className="text-[#001A4D] font-bold text-lg mb-1">
            {inbox.length === 0 ? "Your inbox is empty" : "No matching documents"}
          </p>
          <p className="text-gray-500 text-sm">Documents sent to your organization by the SAS will appear here.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-[#E0E0E0]">
                <tr>
                  {["Document Title", "Sent By", "Category", "Date Sent", "For", "Opened", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {filtered.map((doc) => {
                  const isRead = !!doc.readBy?.[orgId];
                  const createdDate = toDate(doc.createdAt);
                  return (
                    <tr key={doc.id} className={`hover:bg-gray-50 transition-colors group ${!isRead ? "bg-blue-50/50" : ""}`}>
                      <td className="px-4 py-3 min-w-[200px]">
                        <div className="flex items-start gap-2">
                          {!isRead && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
                          <div>
                            <p className="text-[#001A4D] font-bold text-sm leading-tight">{doc.title}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <FileChip type={doc.fileType} />
                              <span className="text-gray-400 text-xs">{formatBytes(doc.fileSize)}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-[#0E4EBD] to-[#1E70E8] rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {doc.broadcastBy.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <span className="text-gray-500 text-xs">{doc.broadcastBy}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><CategoryPill category={doc.category} /></td>
                      <td className="px-4 py-3">
                        {createdDate && (
                          <>
                            <p className="text-gray-600 text-sm">{format(createdDate, 'MMM dd, yyyy')}</p>
                            <p className="text-gray-400 text-xs italic">{formatDistanceToNow(createdDate, { addSuffix: true })}</p>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {doc.distribution === "all" ? (
                          <span className="px-2 py-0.5 bg-[#001A4D]/10 text-[#001A4D] text-xs rounded-full font-medium">All Organizations</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-50 text-[#0E4EBD] border border-blue-200 text-xs rounded-full font-medium">Your Organization</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isRead ? (
                          <div className="flex items-center gap-1.5">
                            <Eye className="w-4 h-4 text-green-500" />
                            <span className="text-gray-400 text-xs">Opened</span>
                          </div>
                        ) : (
                          <EyeOff className="w-4 h-4 text-amber-500" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenDoc(doc)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 transition-colors cursor-pointer" title="View Document"><Eye className="w-4 h-4" /></button>
                          <a href={doc.fileUrl} download className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 text-[#001A4D] transition-colors"><Download className="w-4 h-4" /></a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function OfficerDocuments() {
  const [tab, setTab] = useState<MainTab>("submissions");
  const [showSubmit, setShowSubmit] = useState(false);

  const { profile } = useOfficerProfile();
  const { data: orgs } = useOrganizationStream();

  const orgId = profile?.activeOrganizationId ?? '';
  const org = orgs.find(o => o.id === orgId);
  const orgName = org?.name ?? '';
  const orgAcronym = org?.acronym ?? '';
  const orgTypeId = org?.typeId ?? '';
  const officerName = profile?.studentName ?? '';
  const officerEmail = profile?.email ?? '';

  const { data: submissions } = useOfficerSubmissions(orgId || null);
  const { data: inbox } = useOfficerInbox(orgId || null);

  const pendingCount = submissions.filter(d => d.status === "Pending").length;
  const approvedCount = submissions.filter(d => d.status === "Approved").length;
  const rejectedCount = submissions.filter(d => d.status === "Rejected").length;
  const unreadInbox = inbox.filter(d => !d.readBy?.[orgId]).length;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Documents</h2>
          <p className="text-gray-500 text-sm">Dashboard &rsaquo; Documents</p>
        </div>
        <button
          onClick={() => setShowSubmit(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-xl font-bold text-sm transition-colors cursor-pointer shadow-xs"
        >
          <Upload className="w-4 h-4 text-[#FFD41C]" />
          Submit Document
        </button>
      </div>

      {/* Context Banner */}
      <div className="flex items-center justify-between p-4 bg-blue-50/70 border border-blue-200 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-[#0E4EBD]" />
          <div>
            <p className="text-[#0E4EBD] font-bold text-sm">Electronic Document Management System</p>
            <p className="text-[#001A4D] text-xs leading-relaxed">Submit documents to the SAS for approval and receive official files, memos, and guidelines directly from the Student Affairs Services.</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-blue-200 rounded-lg">
            <ArrowUp className="w-3.5 h-3.5 text-[#0E4EBD]" />
            <span className="text-[#001A4D] text-xs font-semibold">{submissions.length} Submitted</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-blue-200 rounded-lg">
            <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[#001A4D] text-xs font-semibold">{inbox.length} Received from SAS</span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Pending Review", value: pendingCount, note: "awaiting SAS decision", color: "text-amber-500", Icon: Clock },
          { label: "Approved", value: approvedCount, note: "this semester", color: "text-green-600", Icon: CheckCircle },
          { label: "Rejected", value: rejectedCount, note: "require resubmission", color: "text-red-600", Icon: XCircle },
          { label: "From SAS (Unread)", value: unreadInbox, note: "new documents from SAS", color: "text-blue-600", Icon: Mail, pulse: unreadInbox > 0 },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-[#E0E0E0] rounded-xl p-5 shadow-xs">
            <div className="flex items-start justify-between mb-3">
              <p className="text-gray-500 text-xs">{card.label}</p>
              <div className="relative">
                <card.Icon className={`w-5 h-5 ${card.color}`} />
                {card.pulse && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
              </div>
            </div>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-gray-400 text-xs mt-1">{card.note}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2 pb-2">
        {([["submissions", "My Submissions"], ["inbox", "From SAS — Inbox"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative px-5 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer ${
              tab === key
                ? "bg-[#001A4D] text-white shadow-xs"
                : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {label}
            {key === "inbox" && unreadInbox > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">
                {unreadInbox}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "submissions"
        ? <SubmissionsTab orgId={orgId} orgName={orgName} orgAcronym={orgAcronym} orgTypeId={orgTypeId} officerName={officerName} officerEmail={officerEmail} />
        : <InboxTab orgId={orgId} />}

      {showSubmit && <SubmitDocModal onClose={() => setShowSubmit(false)} orgId={orgId} orgName={orgName} orgAcronym={orgAcronym} orgTypeId={orgTypeId} officerName={officerName} officerEmail={officerEmail} />}
    </div>
  );
}
