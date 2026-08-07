import { X, Award, Download, Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

interface Recipient { name: string; id: string; }
interface Props {
  isAdmin?: boolean;
  recipients: Recipient[];
  initialIndex: number;
  templateName?: string;
  fromTemplate?: boolean;
  onClose: () => void;
}

export default function PreviewModal({ isAdmin = false, recipients, initialIndex, templateName, fromTemplate, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const current = recipients[index];

  const prev = () => setIndex(i => Math.max(0, i - 1));
  const next = () => setIndex(i => Math.min(recipients.length - 1, i + 1));

  return (
    <div className="fixed inset-0 bg-black/85 flex flex-col z-50">
      {/* Header */}
      <div className={`h-14 flex items-center px-6 gap-4 ${isAdmin ? "bg-[#001A4D]" : "bg-[#83358E]"}`}>
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-[#FFD41C]" />
          <span className="text-white font-bold text-base">Certificate Preview</span>
        </div>
        {!fromTemplate && (
          <span className="text-[#FFD41C] font-bold text-sm">{current?.name}</span>
        )}
        {fromTemplate && <span className="text-[#FFD41C] text-sm">Template Preview</span>}
        <div className="ml-auto flex items-center gap-2">
          <button className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors" title="Download PDF">
            <Download className="w-5 h-5 text-white" />
          </button>
          <button className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors" title="Print">
            <Printer className="w-5 h-5 text-white" />
          </button>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Certificate Display */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
        <div className="bg-gradient-to-br from-amber-50 to-yellow-100 rounded-xl shadow-2xl relative" style={{ width: 900, height: 637 }}>
          <div className="absolute inset-4 border-4 border-[#B8860B]/30 rounded" />
          <div className="absolute inset-5 border border-[#B8860B]/20 rounded" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <p className="text-[#001A4D]/40 text-sm font-bold tracking-widest uppercase">Certificate of Participation</p>
            <p className="text-[#001A4D]/30 text-sm">This is to certify that</p>
            <p className="text-[#001A4D] font-bold text-4xl" style={{ fontFamily: "Georgia" }}>
              {fromTemplate ? "Juan dela Cruz" : current?.name}
            </p>
            <p className="text-[#001A4D]/30 text-sm">has successfully participated in the event</p>
            <p className="text-[#001A4D]/20 text-xs mt-2">{templateName || "IT Guild Tech Summit 2025"}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      {!fromTemplate && recipients.length > 1 && (
        <div className="flex items-center justify-center gap-4 pb-4">
          <button onClick={prev} disabled={index === 0} className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <span className="text-white text-sm">Certificate {index + 1} of {recipients.length}</span>
          <button onClick={next} disabled={index === recipients.length - 1} className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-30 transition-colors">
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="bg-white h-16 flex items-center justify-center gap-4 shadow-lg">
        <button className={`flex items-center gap-2 px-5 py-2.5 font-bold text-sm rounded-xl transition-colors ${isAdmin ? "bg-[#001A4D] text-[#FFD41C] hover:bg-[#0E4EBD]" : "bg-[#83358E] text-white hover:bg-[#6D2A78]"}`}>
          <Download className="w-4 h-4" /> Download PDF
        </button>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#001A4D] text-[#001A4D] font-bold text-sm rounded-xl hover:bg-gray-50 transition-colors">
          <Printer className="w-4 h-4" /> Print
        </button>
        <button onClick={onClose} className="flex items-center gap-2 text-[#9E9E9E] text-sm hover:text-[#001A4D] transition-colors">
          <X className="w-4 h-4" /> Close Preview
        </button>
      </div>
    </div>
  );
}
