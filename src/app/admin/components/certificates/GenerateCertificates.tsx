import { useState, useEffect } from "react";
import {
  Calendar, Users, UserPlus, QrCode, ChevronLeft, ChevronRight,
  Eye, Trash2, Download, Printer, X, CheckCircle, AlertTriangle, ChevronDown
} from "lucide-react";
import PreviewModal from "./PreviewModal";
import ExportModal from "./ExportModal";
import { useEventById } from "../../../modules/events/hooks/useEventStream";
import { useAttendanceStream } from "../../../modules/attendance/hooks/useAttendanceStream";
import { useCertificateTemplatesStream } from "../../../modules/certificates/hooks/useCertificateStream";
import type { CertificateRecipient, CertificateTemplate } from "../../../modules/certificates/types/certificate.types";

interface Props {
  isAdmin: boolean;
  eventId: string;
  onBack: () => void;
}

export default function GenerateCertificates({ isAdmin, eventId, onBack }: Props) {
  const { event, loading: eventLoading } = useEventById(eventId);
  const { attendance, loading: attendanceLoading } = useAttendanceStream();
  const { templates, loading: templatesLoading } = useCertificateTemplatesStream();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [recipients, setRecipients] = useState<CertificateRecipient[]>([]);
  const [filter, setFilter] = useState<"all" | "attendance" | "manual">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAddRow, setShowAddRow] = useState(false);
  const [newName, setNewName] = useState("");
  const [newId, setNewId] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newReason, setNewReason] = useState("");
  const [duplicateWarn, setDuplicateWarn] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [previewRecipient, setPreviewRecipient] = useState(0);
  const [quickAdjustOpen, setQuickAdjustOpen] = useState(false);

  // Set default template when templates load
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      const defaultT = templates.find(t => t.isDefault) || templates[0];
      setSelectedTemplateId(defaultT.id);
    }
  }, [templates, selectedTemplateId]);

  // Load attendance records for this event
  useEffect(() => {
    if (!eventId) return;

    const eventAttendance = attendance.filter(a => 
      a.eventId === eventId || (event && a.event === event.title)
    );

    const mapped: CertificateRecipient[] = eventAttendance.map(a => ({
      id: a.id || a.studentId,
      name: a.name || 'Unknown Attendee',
      studentId: a.studentId || '—',
      course: a.org || 'STI Student',
      source: 'attendance',
      status: (a.status as any) || 'Checked In',
      include: true,
    }));

    setRecipients(mapped);
  }, [eventId, event, attendance]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0] || null;

  const filteredRecipients = recipients.filter(r => filter === "all" || r.source === filter);
  const includedCount = recipients.filter(r => r.include).length;
  const attendanceCount = recipients.filter(r => r.source === "attendance").length;
  const manualCount = recipients.filter(r => r.source === "manual").length;
  const totalCount = recipients.length;

  const toggleInclude = (id: string) => setRecipients(rs => rs.map(r => r.id === id ? { ...r, include: !r.include } : r));
  const toggleSelect = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected(new Set(filteredRecipients.map(r => r.id)));
  const deselectAll = () => setSelected(new Set());

  const handleAdd = () => {
    if (!newName.trim() || newName.trim().length < 2) return;
    const isDup = recipients.some(r => r.name.toLowerCase() === newName.toLowerCase());
    if (isDup && !duplicateWarn) { setDuplicateWarn(true); return; }
    setRecipients(rs => [...rs, {
      id: Date.now().toString(),
      name: newName.trim(),
      studentId: newId || "—",
      course: newCourse || "—",
      source: "manual",
      status: "Manual",
      include: true
    }]);
    setNewName(""); setNewId(""); setNewCourse(""); setNewReason(""); setShowAddRow(false); setDuplicateWarn(false);
  };

  const removeManual = (id: string) => setRecipients(rs => rs.filter(r => r.id !== id));
  const openPreview = (idx: number) => setPreviewIdx(idx);

  const currentPreviewRecipient = filteredRecipients[previewRecipient] || filteredRecipients[0];
  const firstSessionDate = event?.sessions && event.sessions.length > 0 ? event.sessions[0].date : 'TBA';

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#001A4D] font-semibold transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      {/* Event Summary Card */}
      <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] rounded-2xl overflow-hidden shadow-lg">
        <div className="px-6 py-4 flex items-center gap-4">
          <div className="w-9 h-9 bg-[#FFD41C]/20 rounded-full flex items-center justify-center">
            <Calendar className="w-5 h-5 text-[#FFD41C]" />
          </div>
          <div>
            <p className="text-white font-bold text-lg">{event?.title || "Loading Event..."}</p>
            <p className="text-white/70 text-xs">{event?.hostingOrgId || "STI Event"}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-white text-xs font-medium">{firstSessionDate}</span>
            <span className="bg-[#22C55E] text-white text-xs font-bold px-3 py-1 rounded-full">
              {attendanceCount} Checked In
            </span>
          </div>
        </div>
        <div className="bg-white/5 px-6 py-3 grid grid-cols-4 divide-x divide-white/10">
          {[
            ["Target Participants", event?.expectedParticipantCount || 0, "text-white"],
            ["Checked In", attendanceCount, "text-[#22C55E]"],
            ["Manual Additions", manualCount, "text-[#FFC107]"],
            ["Total Recipients", totalCount, "text-[#FFD41C]"]
          ].map(([label, val, color]) => (
            <div key={label as string} className="px-4 first:pl-0 text-center">
              <p className={`font-bold text-xl ${color as string}`}>{val as number}</p>
              <p className="text-white/60 text-xs">{label as string}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Template Selector */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 flex items-center gap-4 shadow-sm">
        <p className="text-[#001A4D] font-bold text-sm">Certificate Template:</p>
        <select
          value={selectedTemplateId}
          onChange={e => setSelectedTemplateId(e.target.value)}
          className="flex-1 px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm font-semibold text-[#83358E] focus:outline-none"
        >
          {templates.length === 0 ? (
            <option value="">Standard Default Template</option>
          ) : (
            templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.namePosition?.fontFamily || 'Arial'}) {t.isDefault ? '— Default' : ''}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Recipients Table */}
        <div className="col-span-8 bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden">
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-[#E0E0E0]">
            <p className="text-[#001A4D] font-bold text-base">Certificate Recipients</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowAddRow(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#83358E] text-[#83358E] rounded-lg text-xs font-semibold hover:bg-[#F3E8FF] transition-colors">
                <UserPlus className="w-3.5 h-3.5" /> Add Manual Recipient
              </button>
              <button onClick={selected.size === filteredRecipients.length ? deselectAll : selectAll} className="text-xs text-[#9E9E9E] hover:text-[#001A4D] transition-colors">
                {selected.size === filteredRecipients.length ? "Deselect All" : "Select All"}
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-5 py-2.5 flex items-center gap-2 border-b border-[#E0E0E0]">
            {([["all", `All (${totalCount})`], ["attendance", `From Attendance (${attendanceCount})`], ["manual", `Manual (${manualCount})`]] as const).map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${filter === f ? "bg-[#001A4D] text-white border-[#001A4D]" : "bg-white text-[#9E9E9E] border-[#E0E0E0] hover:border-gray-400"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-[#E0E0E0]">
                <tr>
                  <th className="w-10 px-3 py-2.5"></th>
                  <th className="px-3 py-2.5 text-left text-[#9E9E9E] text-xs font-bold uppercase">Name</th>
                  <th className="px-3 py-2.5 text-left text-[#9E9E9E] text-xs font-bold uppercase">Course / Org</th>
                  <th className="px-3 py-2.5 text-left text-[#9E9E9E] text-xs font-bold uppercase">Source</th>
                  <th className="px-3 py-2.5 text-center text-[#9E9E9E] text-xs font-bold uppercase">Include</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {filteredRecipients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500 text-sm">
                      No recipients found for this event.
                    </td>
                  </tr>
                ) : (
                  filteredRecipients.map((r, idx) => (
                    <tr
                      key={r.id}
                      onClick={() => setPreviewRecipient(idx)}
                      className={`hover:bg-[#F3E8FF]/40 transition-colors cursor-pointer ${previewRecipient === idx ? "bg-[#F3E8FF]/60" : ""}`}
                    >
                      <td className="px-3 py-2.5" onClick={e => { e.stopPropagation(); toggleSelect(r.id); }}>
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="w-4 h-4 accent-[#83358E]" />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0E4EBD] to-[#83358E] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {r.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-[#001A4D] font-semibold text-sm">{r.name}</p>
                            <p className="text-[#9E9E9E] text-xs">{r.studentId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[#9E9E9E] text-sm">{r.course}</td>
                      <td className="px-3 py-2.5">
                        {r.source === "attendance" ? (
                          <span className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${r.status === 'Flagged' ? 'bg-amber-100 text-amber-700' : 'bg-[#22C55E]/10 text-[#22C55E]'}`}>
                            <QrCode className="w-3 h-3" /> {r.status}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 bg-[#FFC107]/10 text-[#FFC107] text-xs font-semibold px-2 py-0.5 rounded-full w-fit">
                            <UserPlus className="w-3 h-3" /> Manual
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center" onClick={e => { e.stopPropagation(); toggleInclude(r.id); }}>
                        <div className={`relative inline-flex h-5 w-9 cursor-pointer rounded-full transition-colors ${r.include ? "bg-[#83358E]" : "bg-gray-200"}`}>
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${r.include ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openPreview(idx)} className="p-1.5 rounded hover:bg-[#EEF2FF] transition-colors">
                            <Eye className="w-3.5 h-3.5 text-[#0E4EBD]" />
                          </button>
                          {r.source === "manual" && (
                            <button onClick={() => removeManual(r.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5 text-[#9E9E9E] hover:text-[#EF4444]" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}

                {/* Inline add row */}
                {showAddRow && (
                  <tr className="bg-[#F3E8FF] border-t-2 border-[#83358E]">
                    <td colSpan={6} className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <input type="text" value={newName} onChange={e => { setNewName(e.target.value); setDuplicateWarn(false); }} placeholder="Full name of recipient" className="w-48 px-2.5 py-1.5 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none focus:border-[#83358E]" />
                        <input type="text" value={newId} onChange={e => setNewId(e.target.value)} placeholder="Student ID" className="w-28 px-2.5 py-1.5 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none focus:border-[#83358E]" />
                        <input type="text" value={newCourse} onChange={e => setNewCourse(e.target.value)} placeholder="e.g. BSIT-2A" className="w-28 px-2.5 py-1.5 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none focus:border-[#83358E]" />
                        <button onClick={handleAdd} className="px-4 py-1.5 bg-[#83358E] text-white text-sm font-semibold rounded-lg hover:bg-[#5B1F6B] transition-colors">Add</button>
                        <button onClick={() => { setShowAddRow(false); setDuplicateWarn(false); }} className="p-1.5 hover:bg-white/60 rounded-lg transition-colors">
                          <X className="w-4 h-4 text-[#9E9E9E]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-[#E0E0E0] flex items-center gap-2">
              <p className="text-[#001A4D] font-bold text-sm">Live Preview</p>
              <Eye className="w-4 h-4 text-[#9E9E9E] ml-auto" />
            </div>

            {/* Preview card */}
            <div className="p-4">
              <div className="bg-gradient-to-br from-amber-50 to-yellow-100 rounded-xl border border-[#E0E0E0] overflow-hidden relative" style={{ aspectRatio: "1.414/1" }}>
                {selectedTemplate?.imageUrl ? (
                  <img src={selectedTemplate.imageUrl} alt="Template" className="w-full h-full object-cover absolute inset-0" />
                ) : (
                  <div className="w-full h-full absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-4">
                    <div className="absolute inset-2 border-2 border-[#B8860B]/20 rounded" />
                    <p className="text-[#001A4D]/40 text-[8px] font-bold tracking-widest uppercase">Certificate of Participation</p>
                  </div>
                )}
                {/* Dynamically overlay name */}
                <div
                  className="absolute flex items-center justify-center pointer-events-none"
                  style={{
                    left: `${selectedTemplate?.namePosition?.xPercent || 50}%`,
                    top: `${selectedTemplate?.namePosition?.yPercent || 45}%`,
                    transform: 'translate(-50%, -50%)',
                    color: selectedTemplate?.namePosition?.textColor || '#001A4D',
                    fontFamily: selectedTemplate?.namePosition?.fontFamily || 'Georgia',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  {currentPreviewRecipient?.name || "Juan dela Cruz"}
                </div>
              </div>

              <p className="text-[#9E9E9E] text-xs mt-3">Previewing certificate for:</p>
              <p className="text-[#001A4D] font-bold text-sm">{currentPreviewRecipient?.name || "No recipient selected"}</p>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-3">
                <button onClick={() => setPreviewRecipient(p => Math.max(0, p - 1))} className="p-1.5 rounded-lg border border-[#E0E0E0] hover:bg-gray-50 transition-colors">
                  <ChevronLeft className="w-4 h-4 text-[#9E9E9E]" />
                </button>
                <span className="text-[#001A4D] font-bold text-sm">{previewRecipient + 1} of {filteredRecipients.length || 1}</span>
                <button onClick={() => setPreviewRecipient(p => Math.min(filteredRecipients.length - 1, p + 1))} className="p-1.5 rounded-lg border border-[#E0E0E0] hover:bg-gray-50 transition-colors">
                  <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
                </button>
              </div>
            </div>
          </div>

          {/* Export button */}
          <button
            onClick={() => setShowExport(true)}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold shadow-md transition-all ${
              isAdmin ? "bg-[#001A4D] text-white hover:bg-[#0E4EBD]" : "bg-[#83358E] text-white hover:bg-[#5B1F6B]"
            }`}
          >
            <Download className="w-4 h-4" /> Export All Certificates (Landscape PDF)
          </button>
        </div>
      </div>

      {/* Modals */}
      {showExport && (
        <ExportModal
          eventId={eventId}
          eventName={event?.title || "STI Event"}
          recipients={recipients}
          template={selectedTemplate}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
