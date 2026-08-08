import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Download, Gavel,
  CheckCircle, X, HelpCircle, Clock, FileText, Hash,
  Tag, Calendar, Building2, File, StickyNote, Send,
  ZoomIn, ZoomOut, Maximize2, RefreshCw, MessageSquare,
  ExternalLink, Eye, Loader2
} from "lucide-react";
import { useDocument } from "../../modules/documents/hooks/useDocumentStream";
import { reviewDocument } from "../../modules/documents/services/document.service";
import { useAdviserProfile } from "../../modules/auth/hooks/useAdviserProfile";
import { formatDistanceToNow, format } from "date-fns";
import type { DocumentDocument } from "../../modules/documents/types/document.types";

// ─── Approve Confirmation Modal ────────────────────────────────────────────────
function ApproveModal({ doc, remarks, onClose, onConfirm, submitting }: { doc: DocumentDocument; remarks: string; onClose: () => void; onConfirm: (r: string) => void; submitting: boolean }) {
  const [editedRemarks, setEditedRemarks] = useState(remarks);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[640px] overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-green-400 px-6 py-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg">Confirm Document Approval</p>
            <p className="text-[#FFD41C] text-sm">{doc.title}</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-[#001A4D] font-bold text-sm">You are approving this document. The following will happen:</p>
            </div>
            <ul className="space-y-1.5">
              {[
                "Document status → Approved",
                `${doc.submittedBy} notified via in-app + push notification`,
                "Document available for download in officer's submissions log",
                "Approval timestamp recorded with your name",
                "Audit log entry created",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-[#001A4D]">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Optional Approval Remarks</label>
            <textarea
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent resize-none text-sm"
              value={editedRemarks}
              onChange={(e) => setEditedRemarks(e.target.value)}
            />
            <p className="text-gray-400 text-xs mt-0.5">These will be sent to the officer with the approval notification.</p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={() => onConfirm(editedRemarks)} disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-400 text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? "Approving..." : "Confirm Approval"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reject Confirmation Modal ─────────────────────────────────────────────────
function RejectModal({ doc, remarks, onClose, onConfirm, submitting }: { doc: DocumentDocument; remarks: string; onClose: () => void; onConfirm: (finalRemarks: string) => void; submitting: boolean }) {
  const [allowResubmit, setAllowResubmit] = useState(true);
  const [localRemarks, setLocalRemarks] = useState(remarks);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[560px] overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center">
            <X className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg">Confirm Document Rejection</p>
            <p className="text-[#FFD41C] text-sm">{doc.title}</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <AlertIcon className="w-4 h-4 text-red-600" />
              <p className="text-[#001A4D] text-sm">This document will be rejected and returned to the officer with your remarks.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Rejection Reason Category <span className="text-red-500">*</span></label>
            <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent">
              <option>Document Incomplete</option>
              <option>Wrong Format</option>
              <option>Wrong Category</option>
              <option>Missing Attachments</option>
              <option>Requires Revision</option>
              <option>Does Not Meet Requirements</option>
              <option>Duplicate Submission</option>
              <option>Other</option>
            </select>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Allow Resubmission</p>
              <p className="text-xs text-gray-500">Officer can submit a corrected version.</p>
            </div>
            <button onClick={() => setAllowResubmit(!allowResubmit)} className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${allowResubmit ? "bg-[#83358E]" : "bg-gray-300"}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${allowResubmit ? "translate-x-6" : ""}`} />
            </button>
          </div>
          {!allowResubmit && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-700 text-xs">Officer will not be able to resubmit this document.</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Rejection Remarks / Feedback for Officer</label>
            <textarea
              rows={4}
              placeholder="Provide specific feedback or reason for rejecting this document..."
              value={localRemarks}
              onChange={(e) => setLocalRemarks(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none text-[#001A4D]"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={() => onConfirm(localRemarks)} disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            {submitting ? "Rejecting..." : "Confirm Rejection"}
          </button>
        </div>
      </div>
    </div>
  );
}

// little helper used in the reject modal
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function AdminDocumentReview() {
  const navigate = useNavigate();
  const { docId } = useParams();
  const { data: doc, loading, error } = useDocument(docId);
  const { profile: adminProfile } = useAdviserProfile();

  const [decision, setDecision] = useState<"approved" | "rejected" | "info" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canReject = remarks.trim().length >= 10;

  if (loading) {
    return <div className="flex justify-center items-center h-[calc(100vh-80px)]"><Loader2 className="w-8 h-8 text-[#83358E] animate-spin" /></div>;
  }
  if (error || !doc) {
    return <div className="flex justify-center items-center h-[calc(100vh-80px)]"><p className="text-gray-500">Document not found.</p></div>;
  }

  const isProcessed = doc.status === 'Approved' || doc.status === 'Rejected';

  const handleApprove = async (finalRemarks: string) => {
    if (!adminProfile) return;
    setIsSubmitting(true);
    await reviewDocument(doc.id, 'Approved', adminProfile.uid, finalRemarks || null);
    setIsSubmitting(false);
    setDecision("approved");
    setShowApproveModal(false);
    setTimeout(() => navigate("/home/documents"), 2000);
  };

  const handleReject = async (finalRemarks?: string) => {
    if (!adminProfile) return;
    const r = finalRemarks !== undefined ? finalRemarks : remarks;
    setIsSubmitting(true);
    await reviewDocument(doc.id, 'Rejected', adminProfile.uid, r || null);
    setIsSubmitting(false);
    setDecision("rejected");
    setShowRejectModal(false);
    setTimeout(() => navigate("/home/documents"), 2000);
  };

  const handleRequestInfo = () => { setDecision("info"); };

  const submittedAtStr = doc.createdAt ? format(doc.createdAt.toDate(), 'MMM dd, yyyy · h:mm a') : 'Unknown';
  const timeInQueueStr = doc.createdAt ? formatDistanceToNow(doc.createdAt.toDate()) : '';
  const fileSizeStr = doc.fileSize >= 1024 * 1024 ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(doc.fileSize / 1024)} KB`;

  const type = doc.fileType?.toUpperCase() || 'UNKNOWN';
  const isImage = ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG'].includes(type);
  const isPdf = type === 'PDF';
  const isOffice = ['DOCX', 'DOC', 'XLSX', 'XLS', 'PPTX', 'PPT'].includes(type);

  const history = [
    { label: "Submitted to SAS", color: "bg-blue-600", icon: Send, timestamp: submittedAtStr, actor: doc.submittedBy },
  ];
  if (doc.status === 'Approved' || doc.status === 'Rejected') {
    history.push({
      label: doc.status === 'Approved' ? "Document Approved" : "Document Rejected",
      color: doc.status === 'Approved' ? "bg-green-500" : "bg-red-500",
      icon: doc.status === 'Approved' ? CheckCircle : X,
      timestamp: doc.reviewedAt ? format(doc.reviewedAt.toDate(), 'MMM dd, yyyy · h:mm a') : '',
      actor: "SAS Admin"
    });
  } else {
    history.push({ label: "Received by SAS", color: "bg-[#FFD41C]", icon: Clock, timestamp: "", actor: "Pending Review" });
  }

  return (
    <div className="space-y-0 -m-6">
      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E0E0E0] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/home/documents")} className="flex items-center gap-2 text-gray-500 hover:text-[#001A4D] transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <p className="text-gray-400 text-sm">
            Document Management &rsaquo; Review &rsaquo; <span className="text-[#001A4D] font-medium">{doc.title.slice(0, 45)}{doc.title.length > 45 ? "…" : ""}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 border border-[#E0E0E0] text-[#001A4D] rounded-lg text-sm hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" /> Download
          </a>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-[280px_1fr_280px] min-h-screen">
        {/* LEFT — Submission Info */}
        <div className="border-r border-[#E0E0E0] p-5 space-y-4 bg-white overflow-y-auto sticky top-[57px] h-[calc(100vh-57px)]">
          {/* Submitter */}
          <div className="border border-[#E0E0E0] rounded-xl p-4">
            <div className="border-l-4 border-[#83358E] pl-3 mb-4">
              <p className="text-[#001A4D] font-bold text-xs">Submitted By</p>
            </div>
            <div className="text-center mb-3">
              <div className="w-14 h-14 bg-[#F3E8FF] border-2 border-white shadow rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-[#83358E] font-bold text-base">{doc.submittedBy.substring(0, 2).toUpperCase()}</span>
              </div>
              <p className="text-[#001A4D] font-bold text-sm">{doc.submittedBy}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-[#F3E8FF] text-[#83358E] text-xs rounded-full font-medium">Organization Officer</span>
            </div>
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2 text-xs">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-gray-600 truncate">{doc.submittedByOrgName}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-gray-600 truncate">{doc.submittedByEmail}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-gray-600">{submittedAtStr}</span>
              </div>
            </div>
          </div>

          {/* Document Metadata */}
          <div className="border border-[#E0E0E0] rounded-xl p-4">
            <div className="border-l-4 border-[#83358E] pl-3 mb-3">
              <p className="text-[#001A4D] font-bold text-xs">Document Information</p>
            </div>
            <div className="space-y-2.5">
              {[
                { Icon: Hash, label: "Reference", value: doc.referenceNumber, valueClass: "text-amber-600 font-bold font-mono" },
                { Icon: Tag, label: "Category", value: doc.category, valueClass: "px-2 py-0.5 bg-[#F3E8FF] text-[#83358E] text-xs rounded-full font-medium" },
                { Icon: Calendar, label: "Semester", value: `${doc.semester} · ${doc.academicYear}`, valueClass: "" },
                { Icon: File, label: "File", value: `${doc.fileType} · ${fileSizeStr}`, valueClass: "" },
                { Icon: Clock, label: "In Queue", value: timeInQueueStr, valueClass: "text-amber-600 font-bold" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <row.Icon className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-500 text-xs">{row.label}</span>
                  </div>
                  {row.label === "Category" ? (
                    <span className={row.valueClass}>{row.value}</span>
                  ) : (
                    <span className={`text-xs text-right ${row.valueClass || "text-[#001A4D]"}`}>{row.value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Submission Notes */}
          {doc.description && (
            <div className="border border-[#E0E0E0] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <StickyNote className="w-3.5 h-3.5 text-blue-600" />
                <p className="text-blue-700 font-bold text-xs">Officer's Submission Notes</p>
              </div>
              <p className="text-[#001A4D] text-xs italic leading-relaxed">{doc.description}</p>
            </div>
          )}

          {/* Timeline */}
          <div className="border border-[#E0E0E0] rounded-xl p-4">
            <p className="text-[#001A4D] font-bold text-xs mb-3">Document History</p>
            <div className="space-y-3">
              {history.map((step, i) => {
                const Icon = step.icon;
                const isLast = i === history.length - 1;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${step.color}`}>
                        <Icon className="w-3 h-3 text-white" />
                      </div>
                      {!isLast && <div className={`w-px flex-1 mt-1 ${step.timestamp ? "bg-gray-300" : "bg-gray-200 border-dashed"}`} style={{ minHeight: "16px" }} />}
                    </div>
                    <div className="pb-3">
                      <p className="text-[#001A4D] text-xs font-medium">{step.label}</p>
                      {step.timestamp && <p className="text-gray-400 text-[10px]">{step.timestamp}</p>}
                      <p className="text-gray-400 text-[10px]">{step.actor}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CENTER — Preview */}
        <div className="p-6 space-y-4 bg-gray-50 flex flex-col min-h-0 h-[calc(100vh-57px)] sticky top-[57px]">
          {/* Preview Card */}
          <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden flex-1 flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <p className="text-[#001A4D] font-bold text-sm">Document Preview</p>
              <div className="flex items-center gap-3">
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 text-xs hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" /> Open Full Screen
                </a>
              </div>
            </div>

            {/* Document Render Area */}
            <div className="relative bg-gray-100 flex-1 overflow-hidden p-4">
              {isImage ? (
                <div className="w-full h-full flex items-center justify-center">
                  <img src={doc.fileUrl} alt={doc.fileName} className="max-w-full max-h-full object-contain bg-white shadow-md rounded-xl" />
                </div>
              ) : isOffice ? (
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(doc.fileUrl)}`}
                  className="w-full h-full border-none rounded-xl shadow-inner bg-white"
                  title="Document Preview"
                />
              ) : isPdf ? (
                <iframe
                  src={doc.fileUrl}
                  className="w-full h-full border-none rounded-xl shadow-inner bg-white"
                  title="Document Preview"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center bg-white rounded-xl shadow-inner">
                  <FileText className="w-12 h-12 text-gray-400 mb-4" />
                  <p className="text-[#001A4D] font-medium">Preview not available for {doc.fileType}</p>
                  <p className="text-gray-500 text-sm mb-6">Please download the file to view it.</p>
                  <a href={doc.fileUrl} download className="flex items-center gap-2 px-6 py-2.5 bg-[#001A4D] text-white rounded-lg text-sm font-medium hover:bg-[#001A4D]/90 transition-colors">
                    <Download className="w-4 h-4" /> Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Decision Panel */}
        <div className="border-l border-[#E0E0E0] p-5 space-y-4 bg-white overflow-y-auto sticky top-[57px] h-[calc(100vh-57px)]">
          {decision ? (
            /* Decision Made */
            <div className="space-y-4">
              <div className={`p-5 rounded-2xl text-center ${decision === "approved" ? "bg-gradient-to-b from-green-500 to-green-600" : decision === "rejected" ? "bg-gradient-to-b from-red-500 to-orange-500" : "bg-gradient-to-b from-blue-600 to-blue-500"}`}>
                {decision === "approved" && <><CheckCircle className="w-10 h-10 text-white mx-auto mb-2" /><p className="text-white font-bold text-lg">Document Approved</p></>}
                {decision === "rejected" && <><X className="w-10 h-10 text-white mx-auto mb-2" /><p className="text-white font-bold text-lg">Document Rejected</p></>}
                {decision === "info" && <><HelpCircle className="w-10 h-10 text-white mx-auto mb-2" /><p className="text-white font-bold text-lg">More Info Requested</p></>}
                <p className="text-white/80 text-xs mt-1">March 18, 2026 · {new Date().toLocaleTimeString()}</p>
              </div>
              <button
                onClick={() => setDecision(null)}
                className="text-gray-400 text-xs hover:text-gray-600 transition-colors w-full text-center"
              >
                Undo Decision (available 5 min)
              </button>
              <button
                onClick={() => navigate("/home/documents")}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Next Pending Document
              </button>
            </div>
          ) : isProcessed ? (
            /* Read-Only Decision Summary */
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-[#001A4D]" />
                <p className="text-[#001A4D] font-bold text-base">Review Decision</p>
              </div>

              <div className={`p-4 rounded-xl border ${doc.status === 'Approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {doc.status === 'Approved' ? <CheckCircle className="w-5 h-5 text-green-600" /> : <X className="w-5 h-5 text-red-600" />}
                  <p className={`font-bold text-sm ${doc.status === 'Approved' ? 'text-green-700' : 'text-red-700'}`}>
                    Document {doc.status}
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  Reviewed on {doc.reviewedAt ? format(doc.reviewedAt.toDate(), 'MMM dd, yyyy · h:mm a') : 'Unknown Date'}
                </p>
              </div>

              {doc.remarks && (
                <div>
                  <div className="border-l-4 border-[#83358E] pl-3 mb-3 mt-4">
                    <p className="text-[#001A4D] font-bold text-sm">Adviser Remarks</p>
                  </div>
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                    <p className="text-sm text-[#001A4D] leading-relaxed whitespace-pre-wrap">{doc.remarks}</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate("/home/documents")}
                className="w-full py-2.5 mt-6 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Back to Documents
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-[#001A4D]" />
                <p className="text-[#001A4D] font-bold text-base">Review Decision</p>
              </div>
              <p className="text-gray-500 text-xs">Review the document before making your decision.</p>

              {/* Summary chips */}
              <div className="space-y-2">
                {[
                  { Icon: Building2, value: doc.submittedByOrgName },
                  { Icon: Tag, value: doc.category },
                  { Icon: Calendar, value: submittedAtStr.split(" · ")[0] },
                ].map((chip) => (
                  <div key={chip.value} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <chip.Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-700 truncate">{chip.value}</span>
                  </div>
                ))}
              </div>

              {/* Remarks */}
              <div>
                <div className="border-l-4 border-[#83358E] pl-3 mb-3">
                  <p className="text-[#001A4D] font-bold text-sm">Adviser Remarks</p>
                </div>
                <textarea
                  rows={7}
                  placeholder="Write your feedback, instructions, or approval remarks for the submitting officer. These will be sent with your decision."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#83358E] focus:border-transparent resize-none text-sm text-[#001A4D] leading-relaxed"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                <p className="text-right text-gray-400 text-[10px] mt-0.5">{remarks.length} / 1000</p>
                <div className="flex items-start gap-2 mt-2 p-2 bg-[#F3E8FF] border border-[#83358E]/20 rounded-lg">
                  <Eye className="w-3 h-3 text-[#83358E] flex-shrink-0 mt-0.5" />
                  <p className="text-[#83358E] text-[10px] italic">Remarks are sent directly to the officer and stored permanently in the document record.</p>
                </div>
              </div>

              {/* Decision Buttons */}
              <div className="space-y-3">
                {/* Approve */}
                <div>
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="w-full py-3.5 bg-gradient-to-r from-green-500 to-green-400 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approve Document
                  </button>
                  <p className="text-gray-400 text-[10px] italic text-center mt-1">Officer will be notified. Document marked as approved.</p>
                </div>

                {/* Reject */}
                <div>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-[1.5px] border-red-500 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Reject Document
                  </button>
                  <p className="text-gray-400 text-[10px] italic text-center mt-1">Officer receives your remarks and can resubmit.</p>
                </div>

                {/* Request More Info */}
                <div>
                  <button
                    onClick={handleRequestInfo}
                    className="w-full py-2.5 border border-blue-500 text-blue-600 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
                  >
                    <HelpCircle className="w-4 h-4" />
                    Request More Information
                  </button>
                  <p className="text-gray-400 text-[10px] italic text-center mt-1">Document stays in queue. Officer is notified.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showApproveModal && (
        <ApproveModal doc={doc} remarks={remarks} onClose={() => setShowApproveModal(false)} onConfirm={handleApprove} submitting={isSubmitting} />
      )}
      {showRejectModal && (
        <RejectModal doc={doc} remarks={remarks} onClose={() => setShowRejectModal(false)} onConfirm={handleReject} submitting={isSubmitting} />
      )}
    </div>
  );
}
