import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, ZoomIn, ZoomOut, Maximize2, Save, Eye, EyeOff,
  AlignLeft, AlignCenter, AlignRight, Lock, RotateCcw, Info, Award
} from "lucide-react";
import { toast } from "sonner";
import { uploadToCloudinary } from "../../../../services/cloudinary";
import { saveCertificateTemplate } from "../services/certificate.service";
import { useCertificateTemplatesStream } from "../hooks/useCertificateStream";
import { useAdviserProfile } from "../../auth/hooks/useAdviserProfile";

interface Props {
  isAdmin: boolean;
  organizationId?: string;
  templateId?: string;
  onSave: () => void;
}

const FONTS = ["Arial", "Times New Roman", "Georgia", "Helvetica", "Montserrat", "Playfair Display", "Great Vibes"];
const COLOR_PRESETS = ["#001A4D", "#FFFFFF", "#000000", "#B8860B", "#8B0000", "#006400"];

export default function TemplateEditor({ isAdmin, organizationId, templateId, onSave }: Props) {
  const { templates } = useCertificateTemplatesStream(organizationId, isAdmin);

  const [hasTemplate, setHasTemplate] = useState(false);
  const [templateUrl, setTemplateUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [zoom, setZoom] = useState(100);
  const [templateName, setTemplateName] = useState("");
  const [fontFamily, setFontFamily] = useState("Great Vibes");
  const [fontSize, setFontSize] = useState(36);
  const [fontWeight, setFontWeight] = useState("Regular");
  const [textColor, setTextColor] = useState("#001A4D");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("center");
  const [previewName, setPreviewName] = useState("Juan dela Cruz");
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [namePos, setNamePos] = useState({ x: 210, y: 220, w: 280, h: 48 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, ox: 0, oy: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const { user } = useAdviserProfile();
  const uid = user?.uid || 'USER-UID';

  // Load existing template configuration if templateId is passed
  useEffect(() => {
    if (!templateId || templates.length === 0) return;
    const existing = templates.find(t => t.id === templateId);
    if (!existing) return;

    setTemplateName(existing.name);
    setTemplateUrl(existing.imageUrl);
    setHasTemplate(true);
    setSetAsDefault(existing.isDefault || false);

    if (existing.namePosition) {
      const pos = existing.namePosition;
      setFontFamily(pos.fontFamily || "Great Vibes");
      setFontSize(pos.fontSizePt || 36);
      setFontWeight(pos.fontWeight || "Regular");
      setTextColor(pos.textColor || "#001A4D");
      setTextAlign(pos.textAlign || "center");

      // Convert stored percentage text anchor back to canvas box coordinates
      const boxW = Math.round(((pos.widthPercent || 40) / 100) * 700);
      let anchorX = ((pos.xPercent || 50) / 100) * 700;
      let boxX = anchorX - boxW / 2;
      if (pos.textAlign === 'left') boxX = anchorX;
      if (pos.textAlign === 'right') boxX = anchorX - boxW;

      let anchorY = ((pos.yPercent || 45) / 100) * 495;
      let boxY = anchorY - 24;

      setNamePos({
        x: Math.max(0, Math.min(700 - boxW, boxX)),
        y: Math.max(0, Math.min(495 - 48, boxY)),
        w: boxW,
        h: 48,
      });
    }
  }, [templateId, templates]);

  const canSave = hasTemplate && templateName.trim().length > 0;

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadToCloudinary(file, { folder: 'certificates/templates' });
      setTemplateUrl(result.secureUrl);
      setHasTemplate(true);
      if (!templateName) {
        setTemplateName(file.name.replace(/\.[^/.]+$/, ''));
      }
      toast.success('Template background uploaded!');
    } catch {
      toast.error('Failed to upload image background');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);

    // Calculate exact text anchor X/Y percentage based on text alignment
    let textAnchorX = namePos.x + namePos.w / 2;
    if (textAlign === 'left') textAnchorX = namePos.x;
    if (textAlign === 'right') textAnchorX = namePos.x + namePos.w;

    const textAnchorY = namePos.y + namePos.h / 2;

    const xPercent = Math.round((textAnchorX / 700) * 1000) / 10;
    const yPercent = Math.round((textAnchorY / 495) * 1000) / 10;
    const widthPercent = Math.round((namePos.w / 700) * 1000) / 10;

    const targetOrgId = isAdmin ? 'admin' : (organizationId || 'admin');

    try {
      await saveCertificateTemplate({
        name: templateName.trim(),
        imageUrl: templateUrl,
        isDefault: setAsDefault,
        organizationId: targetOrgId,
        namePosition: {
          xPercent,
          yPercent,
          widthPercent,
          fontSizePt: fontSize,
          fontFamily,
          fontWeight,
          textColor,
          textAlign,
        }
      }, uid, templateId, targetOrgId);

      toast.success('Certificate Template Saved Successfully!');
      onSave();
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // Drag and drop with zoom scaling correction
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (mode !== "edit") return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ mx: e.clientX, my: e.clientY, ox: namePos.x, oy: namePos.y });
  }, [mode, namePos]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const scale = zoom / 100;
    const dx = (e.clientX - dragStart.mx) / scale;
    const dy = (e.clientY - dragStart.my) / scale;

    setNamePos(p => ({
      ...p,
      x: Math.max(0, Math.min(700 - p.w, dragStart.ox + dx)),
      y: Math.max(0, Math.min(495 - p.h, dragStart.oy + dy)),
    }));
  }, [isDragging, dragStart, zoom]);

  const onMouseUp = useCallback(() => setIsDragging(false), []);
  const resetPosition = () => setNamePos({ x: 210, y: 220, w: 280, h: 48 });

  return (
    <div className="flex gap-5 h-[calc(100vh-160px)]" onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
      {/* LEFT — Canvas */}
      <div className="flex-1 bg-[#F0F0F0] rounded-2xl overflow-hidden flex flex-col">
        {/* Canvas Header */}
        <div className="bg-white border-b border-[#E0E0E0] h-11 flex items-center justify-between px-4">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {(["edit", "preview"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors capitalize ${
                  mode === m ? (isAdmin ? "bg-[#001A4D] text-white" : "bg-[#83358E] text-white") : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {m === "edit" ? "Edit Mode" : "Preview Mode"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {mode === "preview" && (
              <span className="bg-[#22C55E] text-white text-xs font-semibold px-2 py-0.5 rounded-full">Preview Active</span>
            )}
            <button onClick={() => setZoom(z => Math.max(25, z - 25))} className="w-7 h-7 rounded-lg border border-[#E0E0E0] flex items-center justify-center hover:bg-gray-50">
              <ZoomOut className="w-3.5 h-3.5 text-gray-500" />
            </button>
            <span className="text-gray-500 text-sm w-12 text-center">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 25))} className="w-7 h-7 rounded-lg border border-[#E0E0E0] flex items-center justify-center hover:bg-gray-50">
              <ZoomIn className="w-3.5 h-3.5 text-gray-500" />
            </button>
            <button onClick={() => setZoom(100)} className="w-7 h-7 rounded-lg border border-[#E0E0E0] flex items-center justify-center hover:bg-gray-50">
              <Maximize2 className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Canvas Area (Locked A4 Landscape Aspect Ratio 700x495) */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          {!hasTemplate ? (
            <label
              className={`border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors p-8 relative ${isAdmin ? "border-[#001A4D]/30 hover:border-[#001A4D]/60" : "border-[#83358E]/40 hover:border-[#83358E]"}`}
              style={{ width: 450, height: 300 }}
            >
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                onChange={handleTemplateUpload}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className={`w-12 h-12 ${isAdmin ? "text-[#001A4D]" : "text-[#83358E]"}`} />
              <p className="text-[#001A4D] font-bold text-base">
                {isUploading ? 'Uploading Image...' : 'Upload certificate template image'}
              </p>
              <p className="text-[#888780] text-xs text-center">JPG or PNG image · Recommended Landscape A4 aspect ratio (297 × 210 mm)</p>
              <span className={`${isAdmin ? "bg-[#001A4D] text-[#FFD41C] hover:bg-[#0E4EBD]" : "bg-[#83358E] text-white hover:bg-[#6D2A78]"} px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors mt-2`}>
                Browse Image File
              </span>
            </label>
          ) : (
            <div
              ref={canvasRef}
              className="relative bg-white shadow-xl rounded overflow-hidden flex-shrink-0"
              style={{ width: `${(700 * zoom) / 100}px`, height: `${(495 * zoom) / 100}px` }}
            >
              {/* Actual Uploaded Certificate Background Image */}
              {templateUrl ? (
                <img src={templateUrl} alt="Certificate Background" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-yellow-100 rounded" />
              )}

              {mode === "edit" ? (
                <>
                  {/* Snap guides */}
                  {isDragging && (
                    <>
                      <div className="absolute left-0 right-0 border-t-2 border-dashed border-[#FFD41C] pointer-events-none" style={{ top: "50%" }} />
                      <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-[#FFD41C] pointer-events-none" style={{ left: "50%" }} />
                    </>
                  )}

                  {/* Draggable name box */}
                  <div
                    className="absolute cursor-move select-none transition-shadow hover:shadow-lg"
                    style={{
                      left: `${(namePos.x * zoom) / 100}px`,
                      top: `${(namePos.y * zoom) / 100}px`,
                      width: `${(namePos.w * zoom) / 100}px`,
                      height: `${(namePos.h * zoom) / 100}px`,
                    }}
                    onMouseDown={onMouseDown}
                  >
                    <div
                      className="w-full h-full flex items-center justify-center border-2 border-dashed border-[#FFD41C] rounded bg-[#001A4D]/10 overflow-hidden"
                    >
                      <span
                        className="truncate px-2"
                        style={{
                          fontFamily,
                          fontSize: `${(fontSize * zoom) / 100}px`,
                          color: textColor,
                          textAlign,
                          fontWeight: fontWeight.includes("Bold") ? "bold" : "normal",
                          fontStyle: fontWeight.includes("Italic") ? "italic" : "normal",
                        }}
                      >
                        {previewName || "Attendee Name"}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                /* Preview mode overlay */
                <div
                  className="absolute pointer-events-none flex items-center justify-center"
                  style={{
                    left: `${(namePos.x * zoom) / 100}px`,
                    top: `${(namePos.y * zoom) / 100}px`,
                    width: `${(namePos.w * zoom) / 100}px`,
                    height: `${(namePos.h * zoom) / 100}px`,
                  }}
                >
                  <span
                    className="truncate px-2"
                    style={{
                      fontFamily,
                      fontSize: `${(fontSize * zoom) / 100}px`,
                      color: textColor,
                      textAlign,
                      fontWeight: fontWeight.includes("Bold") ? "bold" : "normal",
                      fontStyle: fontWeight.includes("Italic") ? "italic" : "normal",
                    }}
                  >
                    {previewName || "Juan dela Cruz"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Control Sidebar */}
      <div className="w-80 bg-white border border-[#E0E0E0] rounded-2xl flex flex-col overflow-hidden flex-shrink-0 shadow-sm">
        <div className={`${isAdmin ? "bg-[#001A4D]" : "bg-[#83358E]"} px-4 py-3 flex items-center justify-between`}>
          <p className="text-white font-bold text-sm">Template Properties</p>
          <Award className="w-4 h-4 text-[#FFD41C]" />
        </div>

        <div className="p-4 space-y-5 flex-1 overflow-y-auto">
          {/* Section A — Template Name */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#001A4D]">Template Title</label>
            <input
              type="text"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="e.g. Official Tech Summit Certificate 2026"
              className={`w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none ${isAdmin ? "focus:border-[#001A4D]" : "focus:border-[#83358E] focus:ring-2 focus:ring-[#83358E]/20"}`}
            />
          </div>

          {/* Section B — Typography Settings */}
          <div className="space-y-3">
            <p className="text-[#001A4D] font-bold text-xs border-l-[3px] border-[#83358E] pl-2">Typography & Styling</p>

            <div>
              <label className="block text-[10px] text-[#888780] mb-1">Font Family</label>
              <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none">
                {FONTS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-[#888780] mb-1">Font Size (pt)</label>
                <input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} min={12} max={120} className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-[#888780] mb-1">Font Weight</label>
                <select value={fontWeight} onChange={e => setFontWeight(e.target.value)} className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none">
                  {["Regular", "Bold", "Italic", "Bold Italic"].map(w => <option key={w}>{w}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-[#888780] mb-1">Text Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
                <input type="text" value={textColor} onChange={e => setTextColor(e.target.value)} className="flex-1 px-3 py-1.5 border border-[#E0E0E0] rounded-lg text-xs font-mono" />
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                {COLOR_PRESETS.map(c => (
                  <button key={c} onClick={() => setTextColor(c)} className="w-5 h-5 rounded border border-[#E0E0E0] hover:scale-110 transition-transform" style={{ background: c }} />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-[#888780] mb-1">Text Alignment</label>
              <div className="flex gap-1">
                {[["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]].map(([a, Icon]: any) => (
                  <button key={a} onClick={() => setTextAlign(a)} className={`flex-1 py-1.5 rounded-lg border flex items-center justify-center transition-colors ${textAlign === a ? (isAdmin ? "bg-[#001A4D] border-[#001A4D]" : "bg-[#83358E] border-[#83358E]") : "bg-white border-[#E0E0E0] hover:border-gray-400"}`}>
                    <Icon className={`w-4 h-4 ${textAlign === a ? "text-white" : "text-gray-500"}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section C — Position */}
          <div className="space-y-3">
            <p className="text-[#001A4D] font-bold text-xs border-l-[3px] border-[#83358E] pl-2">Name Box Position</p>
            <div className="grid grid-cols-2 gap-2">
              {[["X Position", Math.round(namePos.x), "px"], ["Y Position", Math.round(namePos.y), "px"], ["Box Width", namePos.w, "px"], ["Box Height", namePos.h, "px"]].map(([label, val]) => (
                <div key={label as string} className="bg-gray-50 border border-[#E0E0E0] rounded-lg px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-[#888780]">{label as string}</p>
                    <p className="text-[#001A4D] text-sm font-bold">{val as number} px</p>
                  </div>
                  <Lock className="w-3.5 h-3.5 text-[#888780]" />
                </div>
              ))}
            </div>
            <button onClick={resetPosition} className={`${isAdmin ? "text-[#0E4EBD]" : "text-[#83358E]"} text-xs font-semibold flex items-center gap-1 hover:underline`}>
              <RotateCcw className="w-3 h-3" /> Reset Center Position
            </button>
          </div>

          {/* Section D — Preview */}
          <div className="space-y-3">
            <p className="text-[#001A4D] font-bold text-xs border-l-[3px] border-[#83358E] pl-2">Live Preview Name</p>
            <input
              type="text"
              value={previewName}
              onChange={e => setPreviewName(e.target.value)}
              placeholder="Type sample name..."
              className={`w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none ${isAdmin ? "focus:border-[#001A4D]" : "focus:border-[#83358E] focus:ring-2 focus:ring-[#83358E]/20"}`}
            />
            <button
              onClick={() => setMode(m => m === "edit" ? "preview" : "edit")}
              className={`w-full py-2.5 rounded-lg text-white text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                isAdmin ? "bg-[#001A4D] hover:bg-[#0E4EBD]" : "bg-[#83358E] hover:bg-[#6D2A78]"
              }`}
            >
              {mode === "preview" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {mode === "preview" ? "Exit Preview" : "Preview Mode"}
            </button>
          </div>

          {/* Section E — Save */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className={`w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                isAdmin ? "bg-[#001A4D] text-[#FFD41C] hover:bg-[#0E4EBD]" : "bg-[#83358E] text-white hover:bg-[#6D2A78]"
              }`}
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving Template...' : 'Save Template'}
            </button>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={setAsDefault} onChange={e => setSetAsDefault(e.target.checked)} className="w-4 h-4 rounded accent-[#83358E]" />
              <span className="text-[#888780] text-xs">Set as Default Template</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
