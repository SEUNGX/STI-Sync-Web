import { Award, Clock, CheckCircle, UserPlus, Calendar, Eye, ChevronRight } from "lucide-react";
import { useAllEvents } from "../../../modules/events/hooks/useEventStream";
import { useAttendanceStream } from "../../../modules/attendance/hooks/useAttendanceStream";
import { useCertificateTemplatesStream, useIssuedCertificatesStream } from "../../../modules/certificates/hooks/useCertificateStream";
import { useOrganizationStream } from "../../../modules/organizations/hooks/useOrganizationStream";

interface Props {
  isAdmin: boolean;
  onGenerate: (eventId: string) => void;
  onOpenTemplateLibrary: () => void;
  onOpenEditor: () => void;
}

export default function CertificateDashboard({ isAdmin, onGenerate, onOpenTemplateLibrary, onOpenEditor }: Props) {
  const { events, loading: eventsLoading } = useAllEvents();
  const { attendance, loading: attendanceLoading } = useAttendanceStream();
  const { templates, loading: templatesLoading } = useCertificateTemplatesStream();
  const { issuedRecords, loading: issuedLoading } = useIssuedCertificatesStream();
  const { data: orgs } = useOrganizationStream();

  const getOrgName = (orgId: string) => orgs.find(o => o.id === orgId)?.acronym || orgs.find(o => o.id === orgId)?.name || orgId || 'General';

  // Events with attendance (enableQRTickets or attendanceEnabled)
  const readyEvents = events
    .filter(e => e.enableQRTickets !== false && e.proposalStatus === 'approved')
    .map(e => {
      const eventAttendance = attendance.filter(a => a.eventId === e.id || a.event === e.title);
      const attendedCount = eventAttendance.filter(a => a.status === 'Checked In' || a.status === 'Complete' || a.status === 'Late' || a.status === 'Flagged').length;
      const firstDate = e.sessions && e.sessions.length > 0 ? e.sessions[0].date : 'TBA';

      return {
        id: e.id,
        name: e.title,
        org: getOrgName(e.hostingOrgId),
        date: firstDate,
        attended: attendedCount,
      };
    });

  const totalIssuedCount = issuedRecords.length;

  const metrics = [
    { label: "Total Templates", value: templates.length, note: "uploaded in system", icon: Award, gradient: "from-[#0E4EBD] to-[#1E70E8]", pill: null },
    { label: "Ready Events", value: readyEvents.length, note: "events with attendance", icon: Clock, gradient: "from-[#FFC107] to-[#FFD54F]", textDark: true, pill: "Generate Now" },
    { label: "Certificates Issued", value: totalIssuedCount, note: "total issued across system", icon: CheckCircle, gradient: "from-[#22C55E] to-[#16A34A]", pill: null },
    { label: "Total Attendees", value: attendance.length, note: "checked-in attendance records", icon: UserPlus, gradient: "from-[#83358E] to-[#5B1F6B]", pill: null },
  ];

  return (
    <div className="space-y-6">
      {/* Officer scope note */}
      {!isAdmin && (
        <div className="bg-[#F3E8FF] border border-[#83358E]/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <Award className="w-4 h-4 text-[#83358E] flex-shrink-0" />
          <p className="text-[#83358E] text-sm">Certificate generation is scoped to your organization's events only.</p>
        </div>
      )}

      {/* Context Banner */}
      <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#FFD41C]/20 rounded-full flex items-center justify-center">
            <Award className="w-6 h-6 text-[#FFD41C]" />
          </div>
          <div>
            <p className="text-white font-bold text-xl">Certificate Management</p>
            <p className="text-white/70 text-sm mt-0.5">Upload a template, position names, preview, and export landscape A4 certificates for your events.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-[#FFD41C] text-[#001A4D] text-xs font-semibold px-3 py-1.5 rounded-full">{templates.length} Templates Saved</span>
          <span className="bg-[#FFD41C] text-[#001A4D] text-xs font-semibold px-3 py-1.5 rounded-full">{totalIssuedCount} Certificates Issued</span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className={`bg-gradient-to-br ${m.gradient} rounded-2xl p-5 relative overflow-hidden`}>
              {m.pill && (
                <span className="absolute top-3 right-3 bg-white/20 text-white text-[10px] font-semibold px-2 py-1 rounded-full">{m.pill}</span>
              )}
              <Icon className={`w-7 h-7 mb-3 ${m.textDark ? "text-[#001A4D]" : "text-white/80"}`} />
              <p className={`text-3xl font-bold ${m.textDark ? "text-[#001A4D]" : "text-white"}`}>{m.value.toLocaleString()}</p>
              <p className={`text-sm font-semibold mt-0.5 ${m.textDark ? "text-[#001A4D]" : "text-white"}`}>{m.label}</p>
              <p className={`text-xs mt-1 ${m.textDark ? "text-[#001A4D]/70" : "text-white/60"}`}>{m.note}</p>
            </div>
          );
        })}
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-12 gap-5">
        {/* Ready to Generate */}
        <div className="col-span-8 bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden">
          <div className="bg-[#001A4D] px-5 py-3 flex items-center justify-between">
            <span className="text-white font-bold text-sm">Ready to Generate</span>
            <span className="bg-[#FFC107] text-[#001A4D] text-xs font-bold px-2 py-0.5 rounded-full">{readyEvents.length}</span>
          </div>
          <div className="divide-y divide-[#E0E0E0]">
            {eventsLoading || attendanceLoading ? (
              <div className="p-8 text-center text-gray-500 text-sm">Loading events & attendance...</div>
            ) : readyEvents.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No approved events with attendance records found yet.</div>
            ) : (
              readyEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-4 px-5 h-14 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[#001A4D] font-bold text-sm truncate">{ev.name}</p>
                    {isAdmin && <p className="text-[#9E9E9E] text-xs">{ev.org}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[#9E9E9E] text-xs">
                    <Calendar className="w-3.5 h-3.5" />
                    {ev.date}
                  </div>
                  <span className="bg-[#22C55E]/10 text-[#22C55E] text-xs font-semibold px-2.5 py-1 rounded-full">{ev.attended} Attendees</span>
                  <button
                    onClick={() => onGenerate(ev.id)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      isAdmin
                        ? "bg-[#FFD41C] text-[#001A4D] hover:bg-[#FFC107]"
                        : "bg-[#83358E] text-white hover:bg-[#5B1F6B]"
                    }`}
                  >
                    Generate Certificates
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Saved Templates */}
        <div className="col-span-4 bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden">
          <div className="bg-[#001A4D] px-5 py-3 flex items-center justify-between">
            <span className="text-white font-bold text-sm">Saved Templates</span>
            <button onClick={onOpenEditor} className="text-[#FFD41C] text-xs font-semibold hover:underline">+ Upload New</button>
          </div>
          <div className="divide-y divide-[#E0E0E0]">
            {templatesLoading ? (
              <div className="p-6 text-center text-gray-400 text-xs">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-xs">No templates saved yet. Click + Upload New to create one!</div>
            ) : (
              templates.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
                  <div className="w-12 h-8 bg-[#F8F8F8] rounded border border-[#E0E0E0] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {t.imageUrl ? (
                      <img src={t.imageUrl} alt={t.name} className="w-full h-full object-cover" />
                    ) : (
                      <Award className="w-4 h-4 text-[#9E9E9E]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#001A4D] font-bold text-xs truncate">{t.name}</p>
                    <p className="text-[#9E9E9E] text-[11px]">{t.namePosition?.fontFamily || 'Arial'} · {t.namePosition?.textColor || '#001A4D'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="px-4 py-3 border-t border-[#E0E0E0]">
            <button onClick={onOpenTemplateLibrary} className="text-[#0E4EBD] text-xs font-semibold hover:underline flex items-center gap-1">
              View All Templates <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
