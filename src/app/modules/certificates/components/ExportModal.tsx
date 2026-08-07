import { useState } from "react";
import { X, FileText, Files, Printer, CheckCircle, Download, AlertTriangle } from "lucide-react";
import jsPDF from "jspdf";
import type { CertificateRecipient, CertificateTemplate } from "../types/certificate.types";
import { recordIssuedCertificates } from "../services/certificate.service";
import { useAdviserProfile } from "../../auth/hooks/useAdviserProfile";
import { toast } from "sonner";

interface Props {
  isAdmin?: boolean;
  eventId: string;
  eventName: string;
  recipients: CertificateRecipient[];
  template: CertificateTemplate | null;
  onClose: () => void;
}

export default function ExportModal({ isAdmin = false, eventId, eventName, recipients, template, onClose }: Props) {
  const [format, setFormat] = useState("single");
  const [paperSize, setPaperSize] = useState("A4");
  const [orientation, setOrientation] = useState("Landscape");
  const [includeFlagged, setIncludeFlagged] = useState(true);
  const [phase, setPhase] = useState<"config" | "progress" | "done">("config");
  const [progress, setProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null);

  const { user } = useAdviserProfile();
  const uid = user?.uid || "USER";

  const eligibleRecipients = recipients.filter(r => {
    if (!r.include) return false;
    if (r.status === 'Flagged' && !includeFlagged) return false;
    return true;
  });

  const totalCount = recipients.length;
  const includedCount = eligibleRecipients.length;
  const flaggedCount = recipients.filter(r => r.status === 'Flagged').length;

  const startExport = async () => {
    if (eligibleRecipients.length === 0) {
      toast.error("No recipients selected for export.");
      return;
    }

    setPhase("progress");
    setExporting(true);
    setProgress(5);

    try {
      // 1. Create Landscape A4 jsPDF instance (297mm x 210mm)
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 297;
      const pageHeight = 210;

      // Extract template position settings
      const pos = template?.namePosition || {
        xPercent: 50,
        yPercent: 45,
        widthPercent: 50,
        fontSizePt: 32,
        fontFamily: "Arial",
        fontWeight: "Bold",
        textColor: "#001A4D",
        textAlign: "center",
      };

      const bgImg = template?.imageUrl;

      for (let i = 0; i < eligibleRecipients.length; i++) {
        const r = eligibleRecipients[i];
        if (i > 0) {
          doc.addPage("a4", "landscape");
        }

        // Render Background Template Image if exists
        if (bgImg) {
          try {
            doc.addImage(bgImg, "JPEG", 0, 0, pageWidth, pageHeight);
          } catch (_) {
            try {
              doc.addImage(bgImg, "PNG", 0, 0, pageWidth, pageHeight);
            } catch (_) {}
          }
        }

        // Configure font & size
        const fontSize = pos.fontSizePt || 32;
        doc.setFontSize(fontSize);
        doc.setTextColor(pos.textColor || "#001A4D");

        // Set font family style
        try {
          const font = (pos.fontFamily || "helvetica").toLowerCase();
          const isBold = pos.fontWeight?.toLowerCase().includes("bold");
          const isItalic = pos.fontWeight?.toLowerCase().includes("italic");
          const style = isBold && isItalic ? "bolditalic" : isBold ? "bold" : isItalic ? "italic" : "normal";
          
          if (font.includes("times")) {
            doc.setFont("times", style);
          } else if (font.includes("georgia")) {
            doc.setFont("times", style);
          } else {
            doc.setFont("helvetica", style);
          }
        } catch (_) {
          doc.setFont("helvetica", "bold");
        }

        // Position coordinates
        const xMM = ((pos.xPercent || 50) / 100) * pageWidth;
        const yMM = ((pos.yPercent || 45) / 100) * pageHeight;
        const align = pos.textAlign || "center";

        // Print attendee full name
        doc.text(r.name, xMM, yMM, { align: align as any });

        const pct = Math.round(((i + 1) / eligibleRecipients.length) * 100);
        setProgress(pct);
      }

      // 2. Record issued certificates in Firestore
      const issuedRecordsPayload = eligibleRecipients.map(r => ({
        eventId,
        eventTitle: eventName,
        templateId: template?.id || "default",
        templateName: template?.name || "Standard Template",
        recipientName: r.name,
        studentId: r.studentId,
        course: r.course,
      }));

      await recordIssuedCertificates(issuedRecordsPayload, uid);

      setPdfDoc(doc);
      setPhase("done");
      toast.success("Certificates generated successfully!");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("An error occurred during PDF generation.");
      setPhase("config");
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = () => {
    if (!pdfDoc) return;
    const safeName = eventName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${safeName}_Landscape_Certificates.pdf`;
    pdfDoc.save(filename);
    toast.success("Downloaded Landscape A4 Certificates PDF!");
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-[580px] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className={`px-6 py-4 flex items-center gap-3 ${isAdmin ? "bg-gradient-to-r from-[#001A4D] to-[#0E4EBD]" : "bg-[#83358E]"}`}>
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <Download className="w-5 h-5 text-[#FFD41C]" />
          </div>
          <div>
            <p className="text-white font-bold text-base">Export Landscape A4 Certificates</p>
            <p className="text-[#FFD41C] text-xs font-medium">{eventName}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {phase === "config" && (
            <>
              {/* Summary Metrics */}
              <div className="bg-[#F3E8FF] border border-[#83358E]/20 rounded-xl p-4 flex items-center justify-around">
                <div className="text-center">
                  <p className="text-[#001A4D] font-bold text-xl">{totalCount}</p>
                  <p className="text-[#888780] text-xs">Total Attendees</p>
                </div>
                <div className="w-px h-10 bg-[#83358E]/20" />
                <div className="text-center">
                  <p className="text-[#22C55E] font-bold text-xl">{includedCount}</p>
                  <p className="text-[#888780] text-xs">Selected & Ready</p>
                </div>
                {flaggedCount > 0 && (
                  <>
                    <div className="w-px h-10 bg-[#83358E]/20" />
                    <div className="text-center">
                      <p className="text-[#FFC107] font-bold text-xl">{flaggedCount}</p>
                      <p className="text-[#888780] text-xs">Flagged Entries</p>
                    </div>
                  </>
                )}
              </div>

              {/* Include Flagged Switch */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[#001A4D]">Include Flagged Attendance Entries?</p>
                    <p className="text-[11px] text-gray-500">Includes students who checked in with grace/late flag exceptions.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFlagged}
                    onChange={e => setIncludeFlagged(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#83358E]"></div>
                </label>
              </div>

              {/* Output Format Information */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-gray-700">
                  <span>File Output:</span>
                  <span className="font-bold text-[#001A4D]">Single Combined Landscape A4 PDF</span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium text-gray-700">
                  <span>Page Dimensions:</span>
                  <span className="font-bold text-[#001A4D]">A4 Landscape (297 × 210 mm)</span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium text-gray-700">
                  <span>Template Background:</span>
                  <span className="font-bold text-[#83358E]">{template?.name || "Standard Certificate Template"}</span>
                </div>
              </div>
            </>
          )}

          {phase === "progress" && (
            <div className="py-6 space-y-4 text-center">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className="h-full bg-[#83358E] rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[#001A4D] font-bold text-sm">
                Generating Landscape Certificate {Math.round((progress / 100) * includedCount)} of {includedCount}...
              </p>
              <p className="text-[#888780] text-xs">Rendering high-resolution A4 pages and embedding recipient names.</p>
            </div>
          )}

          {phase === "done" && (
            <div className="py-2">
              <div className="bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-2xl p-6 text-center shadow-md">
                <CheckCircle className="w-12 h-12 text-white mx-auto mb-3" />
                <p className="text-white font-bold text-lg">{includedCount} Landscape A4 Certificates Generated!</p>
                <p className="text-white/90 text-xs mt-1">Single combined multi-page PDF ready for download.</p>
                <button
                  onClick={handleDownload}
                  className="mt-5 w-full bg-white text-[#22C55E] font-bold text-sm py-3 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow"
                >
                  <Download className="w-4 h-4" /> Download Combined PDF File
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E0E0E0] flex items-center justify-between bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 border border-[#E0E0E0] rounded-lg text-sm text-gray-600 hover:bg-white transition-colors">
            {phase === "done" ? "Close" : "Cancel"}
          </button>
          {phase === "config" && (
            <button
              onClick={startExport}
              disabled={exporting || includedCount === 0}
              className={`px-6 py-2.5 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2 ${isAdmin ? "bg-[#001A4D] hover:bg-[#0E4EBD]" : "bg-[#83358E] hover:bg-[#6D2A78]"}`}
            >
              <FileText className="w-4 h-4" /> Export {includedCount} Certificates
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
