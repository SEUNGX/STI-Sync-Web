import React, { useState, useEffect } from 'react';
import { X, Download, FileText, AlertCircle, Mail } from 'lucide-react';
import type { DocumentDocument } from '../types/document.types';

interface DocumentPreviewModalProps {
  doc: DocumentDocument;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

// Helper to force Cloudinary URLs to download instead of open in browser
function getDownloadUrl(url: string) {
  if (!url) return '';
  if (url.includes('cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', '/upload/fl_attachment/');
  }
  return url;
}

// Helper to ensure Cloudinary serves the correct MIME type for PDFs
function getPdfUrl(url: string) {
  if (!url) return '';
  if (url.includes('cloudinary.com') && !url.toLowerCase().endsWith('.pdf')) {
    return `${url}.pdf`;
  }
  return url;
}

export function DocumentPreviewModal({ doc, onClose }: DocumentPreviewModalProps) {
  const type = doc.fileType?.toUpperCase() || 'UNKNOWN';
  const isImage = ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG'].includes(type);
  const isPdf = type === 'PDF';
  const isOffice = ['DOCX', 'DOC', 'XLSX', 'XLS', 'PPTX', 'PPT'].includes(type);
  
  const downloadUrl = getDownloadUrl(doc.fileUrl);
  const pdfUrl = getPdfUrl(doc.fileUrl);

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<{message: string, status?: number} | null>(null);

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
      <a 
        href={downloadUrl} 
        download
        className="flex items-center gap-2 px-6 py-3 bg-[#0E4EBD] text-white rounded-xl font-bold hover:bg-[#0E4EBD]/90 transition-colors shadow-sm"
      >
        <Download className="w-5 h-5" />
        Download {doc.fileName}
      </a>
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
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-white/70 text-xs font-mono">{doc.referenceNumber}</span>
                <span className="text-white/30 text-xs">•</span>
                <span className="text-white/70 text-xs truncate" title={doc.fileName}>{doc.fileName}</span>
                <span className="text-white/30 text-xs">•</span>
                <span className="text-[#FFD41C] text-xs font-medium">{formatBytes(doc.fileSize)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <a 
              href={downloadUrl} 
              download
              className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
            <div className="w-px h-6 bg-white/20 mx-1"></div>
            <button 
              onClick={onClose} 
              className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
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
                <a 
                  href={downloadUrl} 
                  download
                  className="flex items-center gap-2 px-6 py-3 bg-[#0E4EBD] text-white rounded-xl font-bold hover:bg-[#0E4EBD]/90 transition-colors shadow-sm"
                >
                  <Download className="w-5 h-5" />
                  Try Downloading Anyway
                </a>
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
        
        {/* Footer info (optional, helps show what we are looking at) */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Type</span>
              <span className="text-[#001A4D] text-xs font-medium">{doc.type === 'submission' ? 'Submission to SAS' : 'Broadcast from SAS'}</span>
            </div>
            <div className="w-px h-8 bg-gray-200"></div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Category</span>
              <span className="text-[#001A4D] text-xs font-medium">{doc.category}</span>
            </div>
            <div className="w-px h-8 bg-gray-200"></div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Status</span>
              <span className={`text-xs font-bold ${
                doc.status === 'Approved' ? 'text-green-600' : 
                doc.status === 'Rejected' ? 'text-red-600' : 
                doc.status === 'Pending' ? 'text-amber-500' : 'text-blue-600'
              }`}>{doc.status}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {(doc.type === 'submission' && doc.remarks) && (
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
          </div>
        </div>
      </div>
    </div>
  );
}
