import { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, ExternalLink } from 'lucide-react';

interface ReceiptLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  itemTitle?: string;
  vendorName?: string;
  amount?: number;
}

export default function ReceiptLightboxModal({
  isOpen,
  onClose,
  imageUrl,
  itemTitle,
  vendorName,
  amount,
}: ReceiptLightboxModalProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!isOpen || !imageUrl) return null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-[#001A4D] text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">Receipt Evidence Lightbox</h3>
            {itemTitle && (
              <p className="text-xs text-white/70 mt-0.5">
                {itemTitle} {vendorName ? `• Vendor: ${vendorName}` : ''} {amount ? `• ₱${amount.toLocaleString()}` : ''}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
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

            <a
              href={imageUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors flex items-center gap-1 text-xs font-semibold"
              title="Open Original Image in New Tab"
            >
              <ExternalLink className="w-5 h-5" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors ml-2"
              title="Close Lightbox"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div className="p-6 bg-gray-950 flex-1 flex items-center justify-center overflow-auto min-h-[400px]">
          <img
            src={imageUrl}
            alt={itemTitle || 'Receipt Image'}
            style={{
              transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s ease-out',
            }}
            className="max-h-[70vh] object-contain rounded-lg shadow-2xl select-none"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-900 text-white/70 text-xs flex items-center justify-between">
          <span>Zoom: {Math.round(zoomLevel * 100)}% • Rotation: {rotation}°</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-colors"
          >
            Close Viewer
          </button>
        </div>

      </div>
    </div>
  );
}
