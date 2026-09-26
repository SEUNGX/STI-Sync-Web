import React, { useState, useRef, useEffect } from "react";
import {
  Upload as UploadIcon, ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon,
  Maximize2 as Maximize2Icon, Save as SaveIcon, Eye as EyeIcon, EyeOff as EyeOffIcon,
  AlignLeft as AlignLeftIcon, AlignCenter as AlignCenterIcon, AlignRight as AlignRightIcon,
  Award as AwardIcon, Plus as PlusIcon, Trash2 as Trash2Icon, Type as TypeIcon,
  Copy as CopyIcon, Sliders as SlidersIcon, FileSpreadsheet as FileSpreadsheetIcon,
  Move as MoveIcon, Image as ImageIconComponent, Sparkles as SparklesIcon
} from "lucide-react";
import { toast } from "sonner";
import { uploadToCloudinary } from "../../../../services/cloudinary";
import { saveCertificateTemplate, getCertificateById } from "../services/certificate.service";
import { useCertificateTemplatesStream } from "../hooks/useCertificateStream";
import { useAdviserProfile } from "../../auth/hooks/useAdviserProfile";
import type { CertificateElement, CertificateItem, PaperSize, PaperOrientation } from "../types/certificate.types";

interface Props {
  isAdmin: boolean;
  organizationId?: string;
  templateId?: string;
  onSave: () => void;
}

export interface PaperFormatOption {
  id: PaperSize;
  name: string;
  sub: string;
  widthMM: number;
  heightMM: number;
}

export const PAPER_FORMATS: PaperFormatOption[] = [
  { id: "a4", name: "A4", sub: "210 × 297 mm", widthMM: 210, heightMM: 297 },
  { id: "short", name: "Short (Letter)", sub: "8.5 × 11 in (216 × 279 mm)", widthMM: 215.9, heightMM: 279.4 },
  { id: "long", name: "Long (Folio)", sub: "8.5 × 13 in (216 × 330 mm)", widthMM: 215.9, heightMM: 330.2 },
  { id: "legal", name: "Legal", sub: "8.5 × 14 in (216 × 356 mm)", widthMM: 215.9, heightMM: 355.6 },
];

const FONTS = [
  "Great Vibes",
  "Arial",
  "Times New Roman",
  "Georgia",
  "Helvetica",
  "Montserrat",
  "Playfair Display",
  "Courier New",
  "Trebuchet MS",
  "Verdana"
];

const COLOR_PRESETS = [
  "#001A4D", // STI Navy
  "#FFD41C", // STI Yellow
  "#83358E", // Officer Purple
  "#0E4EBD", // Royal Blue
  "#000000", // Black
  "#FFFFFF", // White
  "#B8860B", // Dark Goldenrod
  "#8B0000", // Crimson
  "#1B5E20", // Forest Green
  "#4A5568", // Slate Gray
];

export default function TemplateEditor({ isAdmin, organizationId, templateId, onSave }: Props) {
  const { templates } = useCertificateTemplatesStream(organizationId, isAdmin);

  // Template background & info
  const [templateName, setTemplateName] = useState("");
  const [templateUrl, setTemplateUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingItem, setExistingItem] = useState<CertificateItem | null>(null);

  // Editor modes & views
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [zoom, setZoom] = useState(100);
  const [previewName, setPreviewName] = useState("Juan Dela Cruz");

  // Paper Format & Orientation
  const [paperSize, setPaperSize] = useState<PaperSize>("a4");
  const [orientation, setOrientation] = useState<PaperOrientation>("landscape");

  // Text Elements State
  const [elements, setElements] = useState<CertificateElement[]>([
    {
      id: "elem_recipient_default",
      text: "{recipientName}",
      xPercent: 50,
      yPercent: 48,
      widthPercent: 65,
      fontSizePt: 36,
      fontFamily: "Great Vibes",
      fontWeight: "Regular",
      textColor: "#001A4D",
      textAlign: "center",
    },
  ]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>("elem_recipient_default");

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedTemplateIdRef = useRef<string | null>(null);

  const { user } = useAdviserProfile();
  const uid = user?.uid || "USER-UID";

  // Calculate paper physical aspect ratio
  const currentPaper = PAPER_FORMATS.find((p) => p.id === paperSize) || PAPER_FORMATS[0];
  const widthMM = orientation === "landscape" ? Math.max(currentPaper.widthMM, currentPaper.heightMM) : Math.min(currentPaper.widthMM, currentPaper.heightMM);
  const heightMM = orientation === "landscape" ? Math.min(currentPaper.widthMM, currentPaper.heightMM) : Math.max(currentPaper.widthMM, currentPaper.heightMM);
  const aspectRatio = widthMM / heightMM;

  // Base canvas pixel sizing
  const baseCanvasWidth = orientation === "landscape" ? 720 : Math.round(540 * aspectRatio);
  const baseCanvasHeight = orientation === "landscape" ? Math.round(720 / aspectRatio) : 540;

  // Load existing template configuration or reset on new certificate
  useEffect(() => {
    let isCurrent = true;

    if (templateId && templateId.trim().length > 0) {
      (async () => {
        // Fetch directly from Firestore to ensure freshness and bypass any role filtering
        const fetched = await getCertificateById(templateId);
        const cached = templates.find((t) => t.id === templateId);
        const target = fetched || cached;

        if (!isCurrent || !target) return;

        setExistingItem(target);
        setTemplateName(target.name || target.title || "");
        setTemplateUrl(target.imageUrl || "");

        if (target.paperSize) setPaperSize(target.paperSize);
        if (target.orientation) setOrientation(target.orientation);

        if (target.elements && target.elements.length > 0) {
          setElements(target.elements);
          setSelectedElementId(target.elements[0].id);
        } else if (target.namePosition) {
          const pos = target.namePosition;
          const initialElem: CertificateElement = {
            id: `elem_recipient_${Date.now()}`,
            text: "{recipientName}",
            xPercent: pos.xPercent ?? 50,
            yPercent: pos.yPercent ?? 48,
            widthPercent: pos.widthPercent ?? 60,
            fontSizePt: pos.fontSizePt ?? 36,
            fontFamily: pos.fontFamily || "Great Vibes",
            fontWeight: pos.fontWeight || "Regular",
            textColor: pos.textColor || "#001A4D",
            textAlign: pos.textAlign || "center",
          };
          setElements([initialElem]);
          setSelectedElementId(initialElem.id);
        }
      })();
    } else {
      // Clean reset for Add Certificate mode
      setExistingItem(null);
      setTemplateName("");
      setTemplateUrl("");
      setPaperSize("a4");
      setOrientation("landscape");
      setMode("edit");
      const defaultElem: CertificateElement = {
        id: `elem_${Date.now()}`,
        text: "{recipientName}",
        xPercent: 50,
        yPercent: 48,
        widthPercent: 65,
        fontSizePt: 36,
        fontFamily: "Great Vibes",
        fontWeight: "Regular",
        textColor: "#001A4D",
        textAlign: "center",
      };
      setElements([defaultElem]);
      setSelectedElementId(defaultElem.id);
    }

    return () => {
      isCurrent = false;
    };
  }, [templateId]);

  const selectedElement = elements.find((e) => e.id === selectedElementId) || null;

  // Background upload handler
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadToCloudinary(file, { folder: "certificates/templates" });
      setTemplateUrl(result.secureUrl);
      if (!templateName) {
        setTemplateName(file.name.replace(/\.[^/.]+$/, ""));
      }
      toast.success("Background uploaded successfully!");
    } catch {
      toast.error("Failed to upload background image");
    } finally {
      setIsUploading(false);
    }
  };

  // + ADD TEXT: Direct customizable text box
  const handleAddText = () => {
    const newId = `elem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const offsetCount = elements.length % 5;
    const yPct = Math.min(85, Math.max(15, 35 + offsetCount * 12));

    const newElement: CertificateElement = {
      id: newId,
      text: "Custom Text",
      xPercent: 50,
      yPercent: yPct,
      widthPercent: 60,
      fontSizePt: 18,
      fontFamily: "Arial",
      fontWeight: "Regular",
      textColor: "#001A4D",
      textAlign: "center",
    };

    setElements((prev) => [...prev, newElement]);
    setSelectedElementId(newId);
    toast.success("Added new text box! Drag to move.");
  };

  // Duplicate text box
  const handleDuplicateElement = (elemId: string) => {
    const source = elements.find((e) => e.id === elemId);
    if (!source) return;

    const newId = `elem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const duplicate: CertificateElement = {
      ...source,
      id: newId,
      xPercent: Math.min(92, source.xPercent + 3),
      yPercent: Math.min(92, source.yPercent + 3),
    };

    setElements((prev) => [...prev, duplicate]);
    setSelectedElementId(newId);
    toast.info("Duplicated text box");
  };

  // Remove element
  const handleRemoveElement = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedElementId === id) {
      const remaining = elements.filter((el) => el.id !== id);
      setSelectedElementId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Update selected element property
  const updateSelectedElement = (updates: Partial<CertificateElement>) => {
    if (!selectedElementId) return;
    setElements((prev) =>
      prev.map((el) => (el.id === selectedElementId ? { ...el, ...updates } : el))
    );
  };

  // Bulletproof Drag & Drop using clean window event listeners
  const handleMouseDownOnElement = (elemId: string, e: React.MouseEvent) => {
    if (mode !== "edit") return;
    e.stopPropagation();

    setSelectedElementId(elemId);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const elem = elements.find((el) => el.id === elemId);
    if (!elem) return;

    // Element center in px relative to canvas
    const elemXPx = (elem.xPercent / 100) * canvasRect.width;
    const elemYPx = (elem.yPercent / 100) * canvasRect.height;

    // Mouse position relative to canvas
    const mouseXPx = e.clientX - canvasRect.left;
    const mouseYPx = e.clientY - canvasRect.top;

    // Offset between mouse click point and element center
    const offsetXPx = mouseXPx - elemXPx;
    const offsetYPx = mouseYPx - elemYPx;

    setIsDragging(true);

    const onMouseMove = (moveEvt: MouseEvent) => {
      const currentRect = canvas.getBoundingClientRect();
      const currentMouseX = moveEvt.clientX - currentRect.left;
      const currentMouseY = moveEvt.clientY - currentRect.top;

      const targetXPx = currentMouseX - offsetXPx;
      const targetYPx = currentMouseY - offsetYPx;

      let xPct = Math.round(Math.max(2, Math.min(98, (targetXPx / currentRect.width) * 100)) * 10) / 10;
      let yPct = Math.round(Math.max(2, Math.min(98, (targetYPx / currentRect.height) * 100)) * 10) / 10;

      // Magnetic snap to center (50%)
      if (Math.abs(xPct - 50) < 1.5) xPct = 50;
      if (Math.abs(yPct - 50) < 1.5) yPct = 50;

      setElements((prev) =>
        prev.map((el) => (el.id === elemId ? { ...el, xPercent: xPct, yPercent: yPct } : el))
      );
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Keyboard nudging for pixel-perfect adjustments
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedElementId || mode !== "edit") return;

      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
        return;
      }

      const step = e.shiftKey ? 2 : 0.5;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        updateSelectedElement({
          xPercent: Math.max(2, (selectedElement?.xPercent || 50) - step),
        });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        updateSelectedElement({
          xPercent: Math.min(98, (selectedElement?.xPercent || 50) + step),
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        updateSelectedElement({
          yPercent: Math.max(2, (selectedElement?.yPercent || 50) - step),
        });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        updateSelectedElement({
          yPercent: Math.min(98, (selectedElement?.yPercent || 50) + step),
        });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleRemoveElement(selectedElementId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElementId, selectedElement, mode]);

  // Save template
  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error("Please enter a certificate template title");
      return;
    }

    setSaving(true);
    const targetOrgId = isAdmin ? "admin" : organizationId || "admin";

    // Primary recipient element for backwards compatibility
    const recipientElem = elements.find((e) => e.text.includes("{recipientName}") || e.text.includes("{name}")) || elements[0];
    const fallbackPos = recipientElem
      ? {
          xPercent: recipientElem.xPercent,
          yPercent: recipientElem.yPercent,
          widthPercent: recipientElem.widthPercent,
          fontSizePt: recipientElem.fontSizePt,
          fontFamily: recipientElem.fontFamily,
          fontWeight: recipientElem.fontWeight,
          textColor: recipientElem.textColor,
          textAlign: recipientElem.textAlign,
        }
      : {
          xPercent: 50,
          yPercent: 48,
          widthPercent: 60,
          fontSizePt: 36,
          fontFamily: "Great Vibes",
          fontWeight: "Regular",
          textColor: "#001A4D",
          textAlign: "center" as const,
        };

    try {
      const payload: Partial<CertificateItem> = {
        ...(existingItem || {}),
        name: templateName.trim(),
        title: templateName.trim(),
        imageUrl: templateUrl || "",
        organizationId: existingItem?.organizationId || targetOrgId,
        paperSize: paperSize,
        orientation: orientation,
        elements: elements,
        namePosition: fallbackPos,
      };

      await saveCertificateTemplate(
        payload,
        uid,
        templateId,
        existingItem?.organizationId || targetOrgId
      );

      toast.success(templateId ? "Certificate Template Updated Successfully!" : "Certificate Template Created Successfully!");
      onSave();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save certificate template");
    } finally {
      setSaving(false);
    }
  };

  const formatDisplayText = (text: string) => {
    return text.replace(/{recipientName}|{name}/g, previewName || "Juan Dela Cruz");
  };

  return (
    <div className="flex gap-5 h-[calc(100vh-140px)]">
      {/* Hidden background file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg"
        onChange={handleTemplateUpload}
        className="hidden"
      />

      {/* ================= LEFT — CANVAS WORKSPACE ================= */}
      <div className="flex-1 bg-[#EEF2F6] rounded-2xl overflow-hidden flex flex-col border border-[#E0E0E0] shadow-xs">
        {/* Workspace Toolbar */}
        <div className="bg-white border-b border-[#E0E0E0] min-h-12 flex flex-wrap items-center justify-between px-4 py-2 gap-2 z-20">
          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex items-center bg-gray-100 rounded-xl p-0.5 border border-gray-200">
              {(["edit", "preview"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize cursor-pointer ${
                    mode === m
                      ? isAdmin
                        ? "bg-[#001A4D] text-white shadow-2xs"
                        : "bg-[#83358E] text-white shadow-2xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {m === "edit" ? "Edit Mode" : "Preview Mode"}
                </button>
              ))}
            </div>

            {/* Direct + Add Text Button */}
            {mode === "edit" && (
              <button
                onClick={handleAddText}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95 ${
                  isAdmin
                    ? "bg-[#001A4D] text-[#FFD41C] hover:bg-[#0E4EBD]"
                    : "bg-[#83358E] text-white hover:bg-[#6D2A78]"
                }`}
                title="Add a customizable, draggable text element"
              >
                <PlusIcon className="w-4 h-4" />
                <span>+ Add Text</span>
              </button>
            )}

            {/* Upload Background Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-[#E0E0E0] rounded-xl transition-colors cursor-pointer"
              title="Upload or change certificate background"
            >
              <UploadIcon className="w-3.5 h-3.5 text-gray-500" />
              <span>{isUploading ? "Uploading..." : templateUrl ? "Change Background" : "Upload Background"}</span>
            </button>

            {/* Paper Size Selector */}
            <div className="flex items-center gap-1.5 border-l border-gray-200 pl-2">
              <FileSpreadsheetIcon className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                className="text-xs font-semibold text-[#001A4D] bg-white border border-[#E0E0E0] rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:border-[#001A4D]"
              >
                {PAPER_FORMATS.map((fmt) => (
                  <option key={fmt.id} value={fmt.id}>
                    {fmt.name} ({fmt.sub})
                  </option>
                ))}
              </select>
            </div>

            {/* Orientation Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
              <button
                onClick={() => setOrientation("landscape")}
                className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors flex items-center gap-1 cursor-pointer ${
                  orientation === "landscape"
                    ? "bg-white text-[#001A4D] shadow-2xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
                title="Landscape Orientation"
              >
                <div className="w-3.5 h-2.5 border border-current rounded-2xs" />
                <span>Landscape</span>
              </button>
              <button
                onClick={() => setOrientation("portrait")}
                className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors flex items-center gap-1 cursor-pointer ${
                  orientation === "portrait"
                    ? "bg-white text-[#001A4D] shadow-2xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
                title="Portrait Orientation"
              >
                <div className="w-2.5 h-3.5 border border-current rounded-2xs" />
                <span>Portrait</span>
              </button>
            </div>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            {mode === "preview" && (
              <span className="bg-[#22C55E] text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-2xs">
                Live Preview
              </span>
            )}
            <button
              onClick={() => setZoom((z) => Math.max(25, z - 25))}
              className="w-7 h-7 rounded-lg border border-[#E0E0E0] flex items-center justify-center hover:bg-gray-50 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOutIcon className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <span className="text-gray-600 text-xs font-mono w-10 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(200, z + 25))}
              className="w-7 h-7 rounded-lg border border-[#E0E0E0] flex items-center justify-center hover:bg-gray-50 cursor-pointer"
              title="Zoom In"
            >
              <ZoomInIcon className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <button
              onClick={() => setZoom(100)}
              className="w-7 h-7 rounded-lg border border-[#E0E0E0] flex items-center justify-center hover:bg-gray-50 cursor-pointer"
              title="Reset Zoom"
            >
              <Maximize2Icon className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Canvas Area (ALWAYS Visible & Interactive) */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-[#E5E9F0]">
          <div
            ref={canvasRef}
            onClick={() => {
              if (mode === "edit") {
                setSelectedElementId(null);
              }
            }}
            className="relative bg-white shadow-2xl rounded-sm overflow-hidden flex-shrink-0 transition-all select-none"
            style={{
              width: `${(baseCanvasWidth * zoom) / 100}px`,
              height: `${(baseCanvasHeight * zoom) / 100}px`,
            }}
          >
            {/* Background Layer: Uploaded image OR elegant default certificate frame */}
            {templateUrl ? (
              <img
                src={templateUrl}
                alt="Certificate Template"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#FFFDF7] via-[#FAF5E8] to-[#FFFDF7] border-[10px] border-[#001A4D]/15 flex flex-col justify-between p-6 pointer-events-none">
                <div className="border border-[#B8860B]/40 h-full w-full rounded flex flex-col items-center justify-between p-6 relative">
                  <div className="text-center opacity-30 pt-2">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#001A4D]">STI College Official Template</p>
                    <p className="text-[8px] text-[#001A4D]">A4 / Short / Long / Legal Multi-Size Canvas</p>
                  </div>
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#B8860B]/30 flex items-center justify-center opacity-25">
                    <AwardIcon className="w-8 h-8 text-[#B8860B]" />
                  </div>
                  <div className="text-center opacity-30 pb-1">
                    <p className="text-[8px] text-[#001A4D]">Click "Upload Background" to set a custom certificate design</p>
                  </div>
                </div>
              </div>
            )}

            {/* Placed Customizable Text Elements */}
            {elements.map((elem) => {
              const isSelected = selectedElementId === elem.id;
              const displayText = formatDisplayText(elem.text);
              const isBold = elem.fontWeight?.toLowerCase().includes("bold");
              const isItalic = elem.fontWeight?.toLowerCase().includes("italic");

              if (mode === "preview") {
                return (
                  <div
                    key={elem.id}
                    className="absolute pointer-events-none flex items-center justify-center"
                    style={{
                      left: `${elem.xPercent}%`,
                      top: `${elem.yPercent}%`,
                      width: `${elem.widthPercent}%`,
                      transform: "translate(-50%, -50%)",
                      textAlign: elem.textAlign,
                      fontFamily: elem.fontFamily,
                      fontSize: `${(elem.fontSizePt * zoom) / 100}px`,
                      fontWeight: isBold ? "bold" : "normal",
                      fontStyle: isItalic ? "italic" : "normal",
                      color: elem.textColor,
                      lineHeight: 1.25,
                      whiteSpace: "pre-line",
                    }}
                  >
                    <div className="w-full" style={{ textAlign: elem.textAlign }}>
                      {displayText}
                    </div>
                  </div>
                );
              }

              // Edit Mode: Draggable Text Element
              return (
                <div
                  key={elem.id}
                  onMouseDown={(e) => handleMouseDownOnElement(elem.id, e)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElementId(elem.id);
                  }}
                  className={`absolute z-20 cursor-grab active:cursor-grabbing transition-shadow ${
                    isSelected
                      ? "ring-2 ring-[#001A4D] bg-[#001A4D]/10 rounded shadow-md"
                      : "hover:ring-1 hover:ring-[#001A4D]/60 hover:bg-black/5 rounded"
                  }`}
                  style={{
                    left: `${elem.xPercent}%`,
                    top: `${elem.yPercent}%`,
                    width: `${elem.widthPercent}%`,
                    transform: "translate(-50%, -50%)",
                    padding: "4px 8px",
                  }}
                >
                  {/* Selected Tag Badge */}
                  {isSelected && (
                    <div className="absolute -top-6 left-0 bg-[#001A4D] text-[#FFD41C] text-[9px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1.5 pointer-events-none whitespace-nowrap">
                      <MoveIcon className="w-2.5 h-2.5" />
                      <span>Draggable Text</span>
                      <span className="opacity-75">
                        ({elem.xPercent}%, {elem.yPercent}%)
                      </span>
                    </div>
                  )}

                  {/* Corner Anchors */}
                  {isSelected && (
                    <>
                      <div className="absolute -top-1 -left-1 w-2 h-2 bg-[#001A4D] rounded-full pointer-events-none" />
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#001A4D] rounded-full pointer-events-none" />
                      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-[#001A4D] rounded-full pointer-events-none" />
                      <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-[#001A4D] rounded-full pointer-events-none" />
                    </>
                  )}

                  <div
                    className="w-full"
                    style={{
                      textAlign: elem.textAlign,
                      fontFamily: elem.fontFamily,
                      fontSize: `${(elem.fontSizePt * zoom) / 100}px`,
                      fontWeight: isBold ? "bold" : "normal",
                      fontStyle: isItalic ? "italic" : "normal",
                      color: elem.textColor,
                      lineHeight: 1.25,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {displayText || "[Empty Text Box]"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================= RIGHT — SIDEBAR CONTROLS ================= */}
      <div className="w-88 bg-white border border-[#E0E0E0] rounded-2xl flex flex-col overflow-hidden flex-shrink-0 shadow-sm">
        {/* Sidebar Header */}
        <div
          className={`${
            isAdmin ? "bg-[#001A4D]" : "bg-[#83358E]"
          } px-4 py-3 flex items-center justify-between text-white`}
        >
          <div className="flex items-center gap-2">
            <AwardIcon className="w-4 h-4 text-[#FFD41C]" />
            <p className="font-bold text-sm">{templateId ? "Edit Certificate" : "Create Certificate"}</p>
          </div>
          <span className="text-[11px] font-medium text-white/80">
            {elements.length} {elements.length === 1 ? "Text Box" : "Text Boxes"}
          </span>
        </div>

        {/* Scrollable control settings */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Section 1: Template Name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#001A4D]">Template Name</label>
              {templateName && (
                <span className="text-[10px] text-gray-400 font-mono">
                  {templateName.length} chars
                </span>
              )}
            </div>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. STI College Certificate of Recognition"
              className="w-full px-3 py-2 border border-[#E0E0E0] rounded-xl text-xs focus:outline-none focus:border-[#001A4D] bg-white font-medium text-gray-900"
            />
          </div>

          {/* Section 2: Paper Size & Background Card */}
          <div className="p-3 bg-gray-50 border border-[#E0E0E0] rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#001A4D] flex items-center gap-1.5">
                <FileSpreadsheetIcon className="w-3.5 h-3.5 text-[#001A4D]" />
                Paper Configuration
              </span>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {paperSize} · {orientation}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <p className="text-[9px] text-gray-400 font-bold uppercase">Dimensions</p>
                <p className="font-semibold text-gray-800">
                  {Math.round(widthMM)} × {Math.round(heightMM)} mm
                </p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <p className="text-[9px] text-gray-400 font-bold uppercase">Aspect Ratio</p>
                <p className="font-semibold text-gray-800">{aspectRatio.toFixed(3)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-gray-500">
                {templateUrl ? "Custom background applied" : "Using default canvas frame"}
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] font-semibold text-[#0E4EBD] hover:underline cursor-pointer"
              >
                {templateUrl ? "Replace Background" : "Upload Background"}
              </button>
            </div>
          </div>

          {/* Section 3: Text Box Inspector (Active Element) */}
          {selectedElement ? (
            <div className="space-y-3 pt-2 border-t border-[#E0E0E0]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#001A4D] flex items-center gap-1.5">
                  <SlidersIcon className="w-3.5 h-3.5 text-[#001A4D]" />
                  Edit Text Box
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDuplicateElement(selectedElement.id)}
                    title="Duplicate Text Box"
                    className="p-1 text-gray-500 hover:text-[#001A4D] hover:bg-gray-100 rounded cursor-pointer"
                  >
                    <CopyIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleRemoveElement(selectedElement.id)}
                    title="Delete Text Box"
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                  >
                    <Trash2Icon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Text Content */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-gray-500">Text Content</label>
                  <button
                    onClick={() =>
                      updateSelectedElement({
                        text: (selectedElement.text ? selectedElement.text + " " : "") + "{recipientName}",
                      })
                    }
                    className="text-[10px] font-bold text-[#0E4EBD] hover:underline cursor-pointer"
                  >
                    + Insert &#123;recipientName&#125;
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={selectedElement.text}
                  onChange={(e) => updateSelectedElement({ text: e.target.value })}
                  placeholder="Type anything here (dates, names, titles, body text, signatories)..."
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-xl text-xs focus:outline-none focus:border-[#001A4D]"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Drag text box anywhere on canvas or nudge with arrow keys.
                </p>
              </div>

              {/* Typography: Font Family */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                  Font Family
                </label>
                <select
                  value={selectedElement.fontFamily}
                  onChange={(e) => updateSelectedElement({ fontFamily: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#E0E0E0] rounded-xl text-xs focus:outline-none focus:border-[#001A4D]"
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Font Size & Weight */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                    Font Size (pt)
                  </label>
                  <input
                    type="number"
                    min={8}
                    max={140}
                    value={selectedElement.fontSizePt}
                    onChange={(e) =>
                      updateSelectedElement({ fontSizePt: Number(e.target.value) || 12 })
                    }
                    className="w-full px-2.5 py-1.5 border border-[#E0E0E0] rounded-xl text-xs focus:outline-none focus:border-[#001A4D]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                    Weight
                  </label>
                  <select
                    value={selectedElement.fontWeight}
                    onChange={(e) => updateSelectedElement({ fontWeight: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-[#E0E0E0] rounded-xl text-xs focus:outline-none focus:border-[#001A4D]"
                  >
                    {["Regular", "Bold", "Italic", "Bold Italic"].map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Alignment */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                  Alignment
                </label>
                <div className="flex gap-1">
                  {[
                    ["left", AlignLeftIcon],
                    ["center", AlignCenterIcon],
                    ["right", AlignRightIcon],
                  ].map(([align, Icon]: any) => (
                    <button
                      key={align}
                      onClick={() => updateSelectedElement({ textAlign: align })}
                      className={`flex-1 py-1.5 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                        selectedElement.textAlign === align
                          ? "bg-[#001A4D] border-[#001A4D] text-white"
                          : "bg-white border-[#E0E0E0] text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                  Text Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedElement.textColor}
                    onChange={(e) => updateSelectedElement({ textColor: e.target.value })}
                    className="w-7 h-7 rounded border border-gray-300 cursor-pointer p-0"
                  />
                  <input
                    type="text"
                    value={selectedElement.textColor}
                    onChange={(e) => updateSelectedElement({ textColor: e.target.value })}
                    className="flex-1 px-2.5 py-1 border border-[#E0E0E0] rounded-lg text-xs font-mono"
                  />
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      onClick={() => updateSelectedElement({ textColor: c })}
                      className="w-4 h-4 rounded-full border border-gray-300 cursor-pointer hover:scale-125 transition-transform"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Box Width */}
              <div>
                <div className="flex justify-between text-[10px] font-semibold text-gray-500 mb-1">
                  <span>Box Width</span>
                  <span>{selectedElement.widthPercent}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={96}
                  value={selectedElement.widthPercent}
                  onChange={(e) =>
                    updateSelectedElement({ widthPercent: Number(e.target.value) })
                  }
                  className="w-full accent-[#001A4D]"
                />
              </div>

              {/* Coordinates Readout */}
              <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 bg-gray-50 p-2 rounded-xl border border-[#E0E0E0]">
                <div>
                  <span>X Position: </span>
                  <span className="font-bold text-[#001A4D]">{selectedElement.xPercent}%</span>
                </div>
                <div>
                  <span>Y Position: </span>
                  <span className="font-bold text-[#001A4D]">{selectedElement.yPercent}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 border border-dashed border-gray-200 rounded-2xl text-center space-y-1 pt-4">
              <TypeIcon className="w-5 h-5 text-gray-400 mx-auto" />
              <p className="text-xs font-semibold text-gray-600">No text box selected</p>
              <p className="text-[10px] text-gray-400">
                Click any text on the canvas to configure typography & position, or click "+ Add Text" to insert a new box.
              </p>
            </div>
          )}

          {/* Section 4: All Text Layers */}
          <div className="space-y-2 pt-2 border-t border-[#E0E0E0]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-[#001A4D]">All Text Layers ({elements.length})</p>
              <button
                onClick={handleAddText}
                className="text-[10px] font-bold text-[#0E4EBD] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <PlusIcon className="w-3 h-3" /> Add Text
              </button>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {elements.map((el, idx) => {
                const isSel = selectedElementId === el.id;
                return (
                  <div
                    key={el.id}
                    onClick={() => setSelectedElementId(el.id)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSel
                        ? "bg-blue-50/80 border-[#001A4D] text-[#001A4D] font-semibold"
                        : "bg-white border-[#E0E0E0] text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-gray-400 font-mono">#{idx + 1}</span>
                      <span className="truncate max-w-[130px]">
                        {el.text || "[Empty]"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 font-mono">
                        {el.fontSizePt}pt
                      </span>
                      <button
                        onClick={(e) => handleRemoveElement(el.id, e)}
                        title="Remove"
                        className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-600 rounded transition-colors"
                      >
                        <Trash2Icon className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 5: Sample Preview Name */}
          <div className="space-y-1.5 pt-2 border-t border-[#E0E0E0]">
            <label className="block text-xs font-bold text-[#001A4D]">Sample Recipient Name</label>
            <input
              type="text"
              value={previewName}
              onChange={(e) => setPreviewName(e.target.value)}
              placeholder="Juan Dela Cruz"
              className="w-full px-3 py-2 border border-[#E0E0E0] rounded-xl text-xs focus:outline-none focus:border-[#001A4D]"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#E0E0E0] bg-gray-50">
          <button
            onClick={handleSave}
            disabled={saving || !templateName.trim()}
            className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              isAdmin
                ? "bg-[#001A4D] text-[#FFD41C] hover:bg-[#0E4EBD]"
                : "bg-[#83358E] text-white hover:bg-[#6D2A78]"
            }`}
          >
            <SaveIcon className="w-4 h-4" />
            {saving ? "Saving..." : templateId ? "Save Changes" : "Create Certificate"}
          </button>
        </div>
      </div>
    </div>
  );
}
