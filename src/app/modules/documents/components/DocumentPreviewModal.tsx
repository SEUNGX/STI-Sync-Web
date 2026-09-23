import React, { useState, useEffect } from 'react';
import { X, Download, FileText, AlertCircle, Mail, Loader2, Check, RotateCcw } from 'lucide-react';
import type { DocumentDocument } from '../types/document.types';
import { downloadFile } from '../../../../utils/fileDownloader';

interface DocumentPreviewModalProps {
  doc: DocumentDocument;
  onClose: () => void;
  onApprove?: (remarks: string) => Promise<void> | void;
  onReturn?: (remarks: string) => Promise<void> | void;
  onReject?: (remarks: string) => Promise<void> | void;
  isAdmin?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

// Helper to ensure Cloudinary serves the correct MIME type for PDFs
function getPdfUrl(url: string) {
  if (!url) return '';
  if (url.includes('cloudinary.com') && !url.toLowerCase().endsWith('.pdf')) {
    return `${url}.pdf`;
  }
  return url;
}

export function DocumentPreviewModal({
  doc,
  onClose,
  onApprove,
  onReturn,
  onReject,
  isAdmin,
}: DocumentPreviewModalProps) {
  const type = doc.fileType?.toUpperCase() || 'UNKNOWN';
  const isImage = ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG'].includes(type);
  const isPdf = type === 'PDF';
  const isOffice = ['DOCX', 'DOC', 'XLSX', 'XLS', 'PPTX', 'PPT'].includes(type);
  
  const pdfUrl = getPdfUrl(doc.fileUrl);

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<{message: string, status?: number} | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Review states
  const [actionType, setActionType] = useState<'Approve' | 'Return' | 'Reject' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isPendingReview = doc.type === 'submission' && (doc.status === 'Pending' || doc.status === 'Resubmitted');
  const canReview = !!(onApprove || onReturn || onReject || isAdmin);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadFile(doc.fileUrl, doc.fileName);
    } finally {
      setDownloading(false);
    }
  };

  const handleExecuteReview = async () => {
    if (!actionType) return;
    setSubmitting(true);
    try {
      if (actionType === 'Approve' && onApprove) {
        await onApprove(remarks);
      } else if (actionType === 'Return' && onReturn) {
        await onReturn(remarks);
      } else if (actionType === 'Reject' && onReject) {
        await onReject(remarks);
      }
      setActionType(null);
      setRemarks('');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (isPdf && pdfUrl) {
      setPdfLoading(true);
      setPdfError(null);
      fetch(pdfUrl)
        .then(res => {
          if (!res.ok) {
            throw { message: `HTTP Error ${res.status}: ${res.statusText}`, status: res.status };
          }
          return res.blob();
        })
        .then(blob => {
          const fileBlob = new Blob([blob], { type: 'application/pdf' });
          const url = URL.createObjectURL(fileBlob);
          setPdfBlobUrl(url);
          setPdfLoading(false);
        })
        .catch(err => {
          console.error('Error fetching PDF:', err);
          setPdfError(err.status ? err : { message: err.message || 'Network error or CORS issue' });
          setPdfLoading(false);
        });
    }

    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [isPdf, pdfUrl]);

  const DirectDownload = () => (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50">
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-sm ${isPdf ? 'bg-red-500' : 'bg-blue-600'}`}>
        <FileText className="w-10 h-10 text-white" />
      </div>
      <p className="text-[#001A4D] font-bold text-xl mb-2">Preview not available for {doc.fileType}</p>
      <p className="text-gray-500 text-sm mb-8 max-w-md">
        This file format cannot be previewed directly in the browser. Please download the file to view it on your device.
      </p>
      <button 
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-2 px-6 py-3 bg-[#0E4EBD] text-white rounded-xl font-bold hover:bg-[#0E4EBD]/90 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
      >
        {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
        {downloading ? 'Downloading...' : `Download ${doc.fileName}`}
      </button>
      <p className="text-gray-400 text-xs mt-4">{formatBytes(doc.fileSize)}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#001A4D]/80 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Modal Container */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full h-full max-w-6xl flex flex-col overflow-hidden border border-white/20">
        
        {/* Header */}
        <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-inner ${isPdf ? 'bg-red-500' : 'bg-blue-600'}`}>
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 pr-4">
              <h3 className="text-white font-bold text-base truncate" title={doc.title}>
                {doc.title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-white/70 text-xs font-mono">{doc.referenceNumber}</span>
                <span className="text-white/30 text-xs">•</span>
                <span className="text-white/70 text-xs truncate" title={doc.fileName}>{doc.fileName}</span>
                <span className="text-white/30 text-xs">•</span>
                <span className="text-[#FFD41C] text-xs font-medium">{formatBytes(doc.fileSize)}</span>
                {doc.academicYear && (
                  <>
                    <span className="text-white/30 text-xs">•</span>
                    <span className="text-blue-200 text-xs">SY {doc.academicYear}</span>
                  </>
                )}
                {doc.semester && (
                  <>
                    <span className="text-white/30 text-xs">•</span>
                    <span className="text-blue-200 text-xs">{doc.semester}</span>
                  </>
                )}
                {doc.trimester && doc.trimester !== doc.semester && (
                  <>
                    <span className="text-white/30 text-xs">•</span>
                    <span className="text-blue-200 text-xs">{doc.trimester}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <button 
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? 'Downloading...' : 'Download'}
            </button>
            <div className="w-px h-6 bg-white/20 mx-1"></div>
            <button 
              onClick={onClose} 
              className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-gray-100 relative w-full h-full flex flex-col overflow-hidden">
          {isImage ? (
            <div className="w-full h-full p-4 flex items-center justify-center overflow-auto">
              <img src={doc.fileUrl} alt={doc.fileName} className="max-w-full max-h-full object-contain bg-white shadow-md" />
            </div>
          ) : isPdf ? (
            pdfLoading ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-white space-y-4">
                <div className="w-8 h-8 border-4 border-[#0E4EBD] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Loading PDF...</p>
              </div>
            ) : pdfError ? (
              <div className="flex flex-col items-center justify-center w-full h-full bg-gray-50 p-8 text-center">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-sm bg-red-500">
                  <AlertCircle className="w-10 h-10 text-white" />
                </div>
                <p className="text-[#001A4D] font-bold text-xl mb-2">Failed to load PDF</p>
                <p className="text-gray-500 text-sm mb-6 max-w-md">
                  We couldn't preview this document. This usually happens if the storage provider restricts access or the file is corrupted.
                </p>
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6 text-left max-w-md w-full">
                  <p className="text-red-800 text-xs font-bold mb-1">Diagnostic Info:</p>
                  <p className="text-red-600 text-xs font-mono break-all">{pdfError.message}</p>
                  {pdfError.status === 401 && (
                    <p className="text-red-600 text-xs mt-2 font-medium">
                      Note: A 401 error on Cloudinary means "Allow delivery of PDF and ZIP files" is disabled in your Cloudinary Security settings.
                    </p>
                  )}
                </div>
                <button 
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-2 px-6 py-3 bg-[#0E4EBD] text-white rounded-xl font-bold hover:bg-[#0E4EBD]/90 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                  Try Downloading Anyway
                </button>
              </div>
            ) : pdfBlobUrl ? (
              <iframe 
                src={`${pdfBlobUrl}#toolbar=0`} 
                className="w-full h-full border-0 bg-white flex-1"
                title="PDF Preview"
              />
            ) : null
          ) : isOffice ? (
            <iframe 
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(doc.fileUrl)}`}
              className="w-full h-full border-0 bg-white flex-1"
              title="Office Document Preview"
            />
          ) : (
            <DirectDownload />
          )}
        </div>

        {/* Inline Review Remarks Panel (When an action button is clicked) */}
        {actionType && (
          <div className="bg-white border-t border-gray-200 p-4 shadow-lg animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {actionType === 'Approve' && <Check className="w-4 h-4 text-green-600" />}
                {actionType === 'Return' && <RotateCcw className="w-4 h-4 text-amber-600" />}
                {actionType === 'Reject' && <X className="w-4 h-4 text-red-600" />}
                <span className={`text-xs font-bold ${
                  actionType === 'Approve' ? 'text-green-700' :
                  actionType === 'Return' ? 'text-amber-700' : 'text-red-700'
                }`}>
                  {actionType === 'Approve' ? 'Approve Document' :
                   actionType === 'Return' ? 'Return Document for Revision' : 'Reject Document'}
                </span>
                <span className="text-gray-400 text-xs">· {doc.title}</span>
              </div>
              <button
                type="button"
                onClick={() => { setActionType(null); setRemarks(''); }}
                className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <div className="space-y-3">
              <textarea
                rows={2}
                placeholder={
                  actionType === 'Approve'
                    ? 'Optional remarks or approval notes for the officer...'
                    : actionType === 'Return'
                    ? 'Specify required revisions or feedback (Required)...'
                    : 'Specify rejection reason (Required)...'
                }
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none resize-none"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">
                  {actionType === 'Approve'
                    ? 'Remarks are optional.'
                    : 'Remarks are required so the officer understands the decision.'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setActionType(null); setRemarks(''); }}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submitting || ((actionType === 'Return' || actionType === 'Reject') && !remarks.trim())}
                    onClick={handleExecuteReview}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                      actionType === 'Approve'
                        ? 'bg-gradient-to-r from-green-500 to-green-400 hover:opacity-90 disabled:opacity-50 cursor-not-allowed disabled:cursor-not-allowed'
                        : actionType === 'Return'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 disabled:opacity-50 cursor-not-allowed disabled:cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90 disabled:opacity-50 cursor-not-allowed disabled:cursor-not-allowed'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        {actionType === 'Approve' && <Check className="w-3.5 h-3.5" />}
                        {actionType === 'Return' && <RotateCcw className="w-3.5 h-3.5" />}
                        {actionType === 'Reject' && <X className="w-3.5 h-3.5" />}
                        <span>
                          {actionType === 'Approve' ? 'Confirm Approval' :
                           actionType === 'Return' ? 'Return for Revision' : 'Confirm Rejection'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Footer info & Action Buttons */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex flex-col">
              <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Type</span>
              <span className="text-[#001A4D] text-xs font-medium">{doc.type === 'submission' ? 'Submission to SAS' : 'Broadcast from SAS'}</span>
            </div>
            <div className="w-px h-8 bg-gray-200"></div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Category</span>
              <span className="text-[#001A4D] text-xs font-medium">{doc.category}</span>
            </div>
            {doc.type === 'submission' && (
              <>
                <div className="w-px h-8 bg-gray-200"></div>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Status</span>
                  <span className={`text-xs font-bold ${
                    doc.status === 'Approved' ? 'text-green-600' : 
                    doc.status === 'Rejected' ? 'text-red-600' : 
                    doc.status === 'Returned' ? 'text-amber-700' :
                    doc.status === 'Pending' ? 'text-amber-500' : 'text-blue-600'
                  }`}>{doc.status}</span>
                </div>
              </>
            )}
            {doc.type === 'broadcast' && (
              <>
                <div className="w-px h-8 bg-gray-200"></div>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Distribution</span>
                  <span className="text-[#0E4EBD] text-xs font-semibold">
                    {doc.distribution === 'all' ? 'All Organizations' : `${doc.targetOrgIds?.length || 0} Organizations`}
                  </span>
                </div>
              </>
            )}
            {doc.submittedByOrgName && (
              <>
                <div className="w-px h-8 bg-gray-200"></div>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Submitted By</span>
                  <span className="text-[#001A4D] text-xs font-medium">{doc.submittedByOrgName}</span>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Show Remarks if already provided */}
            {(doc.type === 'submission' && doc.remarks && !actionType) && (
              <div className="flex items-center gap-2 max-w-md bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                <AlertCircle className="w-4 h-4 text-[#0E4EBD] flex-shrink-0" />
                <p className="text-[#001A4D] text-xs truncate" title={doc.remarks}>
                  <span className="font-bold">Remarks:</span> {doc.remarks}
                </p>
              </div>
            )}

            {(doc.type === 'broadcast' && doc.description) && (
              <div className="flex items-center gap-2 max-w-md bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                <Mail className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <p className="text-blue-800 text-xs truncate" title={doc.description}>
                  <span className="font-bold">Message:</span> {doc.description}
                </p>
              </div>
            )}

            {/* Admin Review Action Buttons */}
            {canReview && isPendingReview && !actionType && (
              <div className="flex items-center gap-2">
                {onApprove && (
                  <button
                    type="button"
                    onClick={() => { setActionType('Approve'); setRemarks(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-400 hover:opacity-90 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                )}
                {onReturn && (
                  <button
                    type="button"
                    onClick={() => { setActionType('Return'); setRemarks(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Return</span>
                  </button>
                )}
                {onReject && (
                  <button
                    type="button"
                    onClick={() => { setActionType('Reject'); setRemarks(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
