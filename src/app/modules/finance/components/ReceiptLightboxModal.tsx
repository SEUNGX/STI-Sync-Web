import { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, ExternalLink, FileText, FileSpreadsheet, File } from 'lucide-react';
import { formatCurrency } from '../../../utils/currency';

interface ReceiptLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  itemTitle?: string;
  vendorName?: string;
  amount?: number;
  fileName?: string;
  fileType?: string;
}

export default function ReceiptLightboxModal({
  isOpen,
  onClose,
  imageUrl,
  itemTitle,
  vendorName,
  amount,
  fileName,
  fileType,
}: ReceiptLightboxModalProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!isOpen || !imageUrl) return null;

  const urlLower = imageUrl.toLowerCase();
  const nameLower = (fileName || '').toLowerCase();
  const typeLower = (fileType || '').toLowerCase();

  const isPdf = typeLower === 'pdf' || urlLower.endsWith('.pdf') || nameLower.endsWith('.pdf') || urlLower.includes('/raw/upload/') && urlLower.endsWith('.pdf');
  const isDoc = typeLower === 'document' || nameLower.endsWith('.doc') || nameLower.endsWith('.docx') || nameLower.endsWith('.txt') || nameLower.endsWith('.rtf');
  const isSheet = typeLower === 'spreadsheet' || nameLower.endsWith('.xls') || nameLower.endsWith('.xlsx') || nameLower.endsWith('.csv');
  const isImage = !isPdf && !isDoc && !isSheet;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="px-6 py-4 bg-[#001A4D] text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              {isPdf ? <FileText className="w-5 h-5 text-red-400" /> : isSheet ? <FileSpreadsheet className="w-5 h-5 text-emerald-400" /> : isDoc ? <FileText className="w-5 h-5 text-blue-400" /> : null}
              {fileName || 'Receipt & Supporting Evidence'}
            </h3>
            {itemTitle && (
              <p className="text-xs text-white/70 mt-0.5">
                {itemTitle} {vendorName ? `• Vendor: ${vendorName}` : ''} {amount ? `• ${formatCurrency(amount)}` : ''}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isImage && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors"
                  title="Rotate Image"
                >
                  <RotateCw className="w-5 h-5" />
                </button>
              </>
            )}

            <a
              href={imageUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors flex items-center gap-1 text-xs font-semibold"
              title="Open Original File in New Tab"
            >
              <ExternalLink className="w-5 h-5" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors ml-2 cursor-pointer"
              title="Close Viewer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content Container */}
        <div className="p-4 bg-gray-950 flex-1 flex items-center justify-center overflow-auto min-h-[420px]">
          {isPdf ? (
            <div className="w-full h-full min-h-[550px] flex flex-col bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
              <iframe
                src={imageUrl}
                title={fileName || 'PDF Document'}
                className="w-full h-[550px] rounded-lg bg-white border-0"
              />
            </div>
          ) : isDoc || isSheet ? (
            <div className="text-center p-8 bg-gray-900 rounded-2xl border border-gray-800 max-w-md w-full text-white space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-white/10">
                {isSheet ? (
                  <FileSpreadsheet className="w-10 h-10 text-emerald-400" />
                ) : (
                  <FileText className="w-10 h-10 text-blue-400" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-base truncate">{fileName || 'Attached Document'}</h4>
                <p className="text-xs text-gray-400 mt-1">
                  {isSheet ? 'Spreadsheet File (Excel / CSV)' : 'Word Document / Text File'}
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-[#1E70E8] hover:bg-[#0E4EBD] text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" /> Open / Download File
                </a>
              </div>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={itemTitle || fileName || 'Receipt Image'}
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                transition: 'transform 0.2s ease-out',
              }}
              className="max-h-[70vh] object-contain rounded-lg shadow-2xl select-none"
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-900 text-white/70 text-xs flex items-center justify-between">
          <span>
            {isImage
              ? `Zoom: ${Math.round(zoomLevel * 100)}% • Rotation: ${rotation}°`
              : `${fileName || 'Attached Evidence Document'}`}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Close Viewer
          </button>
        </div>

      </div>
    </div>
  );
}

