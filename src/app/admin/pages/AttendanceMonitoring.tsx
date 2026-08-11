import { useState, useMemo } from "react";
import {
  CheckCircle2, XCircle, AlertCircle, UserCheck, Clock,
  ArrowLeft, Calendar, MapPin, Users, Search, Download,
  ChevronRight, QrCode, Timer, TrendingUp, Filter, Loader2, FileSpreadsheet,
  DollarSign, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAllEvents } from "../../modules/events/hooks/useEventStream";
import { useAttendanceStream } from "../../modules/attendance/hooks/useAttendanceStream";
import { useVenuesStream, useEventCategoriesStream } from "../../modules/events/hooks/useEventConfigStream";
import { useStudents } from "../../modules/students/hooks/useStudentStream";
import { useDepartments, useCourses, useSections } from "../../modules/academic/hooks/useAcademicStream";
import { useOrganizationStream } from "../../modules/organizations/hooks/useOrganizationStream";
import { recordEventFinePayables } from "../../modules/finance/services/payable.service";

import { AttendanceFilterToolbar } from "../../modules/attendance/components/AttendanceFilterToolbar";
import { AttendanceExportPreviewModal } from "../../modules/attendance/components/AttendanceExportPreviewModal";
import type { AttendanceFilterState, EnrichedAttendanceRecord } from "../../modules/attendance/types/attendance.types";

// ─── Types ────────────────────────────────────────────────────────────────────
type AttendStatus = "Complete" | "Checked In" | "Absent" | "Flagged" | "Late";

interface EventSession {
  id: string;
  label: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  records: EnrichedAttendanceRecord[];
}

interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
  org: string;
  orgInitials: string;
  category: string;
  registered: number;
  checkedIn: number;
  absent: number;
  flagged: number;
  status: "Ongoing" | "Completed" | "Upcoming";
  sessions: EventSession[];
}

const INITIAL_FILTERS: AttendanceFilterState = {
  searchQuery: '',
  departmentId: 'all',
  courseId: 'all',
  section: 'all',
  yearLevel: 'all',
  sessionId: 'all',
  status: 'all',
};

// ─── Helper Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: AttendStatus }) {
  const config = {
    "Complete": { label: "Complete", bg: "bg-green-100 text-green-700 border-green-200" },
    "Checked In": { label: "Checked In", bg: "bg-blue-100 text-blue-700 border-blue-200" },
    "Late": { label: "Late", bg: "bg-orange-100 text-orange-700 border-orange-200" },
    "Absent": { label: "Absent", bg: "bg-red-100 text-red-700 border-red-200" },
    "Flagged": { label: "Flagged", bg: "bg-amber-100 text-amber-700 border-amber-200" },
  }[status] ?? { label: status, bg: "bg-gray-100 text-gray-700 border-gray-200" };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg}`}>
      {config.label}
    </span>
  );
}

// ─── Event Detail View ────────────────────────────────────────────────────────
function EventDetail({
  event,
  onBack,
  departments,
  courses,
  sections,
}: {
  event: Event;
  onBack: () => void;
  departments: any[];
  courses: any[];
  sections: string[];
}) {
  const [filterState, setFilterState] = useState<AttendanceFilterState>(INITIAL_FILTERS);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isRecordingFines, setIsRecordingFines] = useState(false);

  const handleRecordFines = async () => {
    setIsRecordingFines(true);
    try {
      const res = await recordEventFinePayables(event.id, 'sao_admin_user', false);
      if (res.created > 0) {
        toast.success(`Recorded ${res.created} fine payable(s) for ${event.name}.${res.skipped > 0 ? ` (${res.skipped} already recorded)` : ''}`);
      } else if (res.skipped > 0) {
        toast.info(`No new fines created. All ${res.skipped} eligible fine(s) were already recorded.`);
      } else {
        toast.info(`No fine-eligible attendance records found for ${event.name}.`);
      }
    } catch (err: any) {
      console.error('[EventDetail] Record fines error:', err);
      toast.error(err?.message || 'Failed to record event fines.');
    } finally {
      setIsRecordingFines(false);
    }
  };

  const allRecords = useMemo(() => event.sessions.flatMap((s) => s.records), [event]);

  const complete = allRecords.filter((r) => r.status === "Complete" || r.status === "Checked In").length;
  const absent = allRecords.filter((r) => r.status === "Absent").length;
  const late = allRecords.filter((r) => r.status === "Late").length;
  const flagged = allRecords.filter((r) => r.status === "Flagged").length;
  const rate = event.registered > 0 ? Math.round((event.checkedIn / event.registered) * 100) : 0;

  // Filtered records based on multi-criteria filterState
  const filteredRecords = useMemo(() => {
    return allRecords.filter((r) => {
      // 1. Search Query
      if (filterState.searchQuery.trim()) {
        const q = filterState.searchQuery.toLowerCase();
        const matchSearch =
          (r.name || "").toLowerCase().includes(q) ||
          (r.studentId || "").toLowerCase().includes(q) ||
          (r.section || "").toLowerCase().includes(q) ||
          (r.courseCode || r.courseName || "").toLowerCase().includes(q) ||
          (r.departmentName || r.departmentCode || "").toLowerCase().includes(q) ||
          (r.flaggedReason || "").toLowerCase().includes(q);
        if (!matchSearch) return false;
      }

      // 2. Department Filter
      if (filterState.departmentId !== 'all') {
        const matchDept =
          r.departmentId === filterState.departmentId ||
          r.departmentCode === filterState.departmentId;
        if (!matchDept) return false;
      }

      // 3. Course Filter
      if (filterState.courseId !== 'all') {
        const matchCourse =
          r.courseId === filterState.courseId ||
          r.courseCode === filterState.courseId;
        if (!matchCourse) return false;
      }

      // 4. Section Filter
      if (filterState.section !== 'all') {
        if ((r.section || '').trim().toLowerCase() !== filterState.section.trim().toLowerCase()) {
          return false;
        }
      }

      // 5. Year Level Filter
      if (filterState.yearLevel !== 'all') {
        if ((r.yearLevel || '').trim().toLowerCase() !== filterState.yearLevel.trim().toLowerCase()) {
          return false;
        }
      }

      // 6. Session Filter
      if (filterState.sessionId !== 'all') {
        if (r.sessionId !== filterState.sessionId) return false;
      }

      // 7. Status Filter
      if (filterState.status !== 'all') {
        if (filterState.status === 'Checked In' && r.status !== 'Checked In' && r.status !== 'Complete') return false;
        if (filterState.status === 'Late' && r.status !== 'Late') return false;
        if (filterState.status === 'Absent' && r.status !== 'Absent') return false;
        if (filterState.status === 'Flagged' && r.status !== 'Flagged') return false;
        if (['Complete', 'Checked In', 'Absent', 'Flagged', 'Late'].includes(filterState.status)) {
          if (r.status !== filterState.status) return false;
        }
      }

      return true;
    });
  }, [allRecords, filterState]);

  const activeFiltersSummary = useMemo(() => {
    const parts: string[] = [];
    if (filterState.departmentId !== 'all') {
      const d = departments.find(dept => dept.id === filterState.departmentId || dept.code === filterState.departmentId);
      parts.push(`Dept: ${d?.code || filterState.departmentId}`);
    }
    if (filterState.section !== 'all') parts.push(`Section: ${filterState.section}`);
    if (filterState.yearLevel !== 'all') parts.push(`Year: ${filterState.yearLevel}`);
    if (filterState.sessionId !== 'all') {
      const s = event.sessions.find(sess => sess.id === filterState.sessionId);
      parts.push(`Session: ${s?.label || filterState.sessionId}`);
    }
    if (filterState.status !== 'all') parts.push(`Status: ${filterState.status}`);
    if (filterState.searchQuery) parts.push(`Search: "${filterState.searchQuery}"`);
    return parts.length > 0 ? parts.join(' | ') : 'All Event Attendees';
  }, [filterState, departments, event.sessions]);

  const handleFilterChange = (updates: Partial<AttendanceFilterState>) => {
    setFilterState(prev => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    setFilterState(INITIAL_FILTERS);
  };

  const sessionsList = event.sessions.map(s => ({ id: s.id, title: s.label }));

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#001A4D] text-sm font-medium hover:text-[#83358E] transition-colors mb-4 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Events
        </button>

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-[#001A4D] to-[#83358E] rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-sm">
            {event.orgInitials}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#001A4D]">{event.name}</h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{event.date}</span>
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{event.venue}</span>
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{event.org}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Registered", value: event.registered, color: "text-[#001A4D]", bg: "bg-blue-50", icon: UserCheck },
          { label: "Attended", value: `${event.checkedIn} (${rate}%)`, color: "text-green-600", bg: "bg-green-50", icon: CheckCircle2 },
          { label: "Absent", value: absent, color: "text-red-500", bg: "bg-red-50", icon: XCircle },
          { label: "Late", value: late, color: "text-orange-600", bg: "bg-orange-50", icon: Timer },
          { label: "Flagged", value: flagged, color: "text-amber-600", bg: "bg-amber-50", icon: AlertCircle },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`${s.bg} border border-gray-200 rounded-2xl p-4 shadow-xs`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{s.label}</p>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Attendance Fine Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-purple-50 border border-purple-200 rounded-2xl p-4 shadow-xs">
        <div>
          <h3 className="font-bold text-[#001A4D] text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Institutional Event Fine Control
          </h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Automatically record fines for absent, late, or un-scanned students for this SAO institutional event.
          </p>
        </div>
        <button
          disabled={isRecordingFines}
          onClick={handleRecordFines}
          className="px-4 py-2 bg-gradient-to-r from-[#001A4D] to-[#83358E] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer flex-shrink-0 shadow-sm"
        >
          {isRecordingFines ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4 text-[#FFD41C]" />}
          <span>Record Event Fines</span>
        </button>
      </div>

      {/* Shared Filter Toolbar */}
      <AttendanceFilterToolbar
        filters={filterState}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        departments={departments.map(d => ({ id: d.id, name: d.name, code: d.code }))}
        sections={sections}
        courses={courses.map(c => ({ id: c.id, name: c.name, code: c.code }))}
        sessions={sessionsList}
        onExportClick={() => setIsExportModalOpen(true)}
        totalCount={allRecords.length}
        filteredCount={filteredRecords.length}
      />

      {/* Main Attendance Table */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#001A4D] text-white">
              <tr>
                <th className="px-4 py-3 font-bold uppercase tracking-wider w-10 text-center">#</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider">Student ID</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider">Student Name</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider">Department</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider">Course</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider">Section</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider">Year</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider">Time-In</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider">Time-Out</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
              {filteredRecords.map((rec, i) => (
                <tr
                  key={rec.id || i}
                  className={`hover:bg-purple-50/40 transition-colors ${
                    rec.status === "Absent" ? "bg-red-50/20" :
                    rec.status === "Flagged" ? "bg-amber-50/30" :
                    rec.status === "Late" ? "bg-orange-50/20" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-center text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-4 py-3 font-mono text-gray-600">{rec.studentId || 'N/A'}</td>
                  <td className="px-4 py-3 font-bold text-[#001A4D]">{rec.name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-bold">
                      {rec.departmentCode || rec.departmentName || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-purple-900">{rec.courseCode || rec.courseName || 'N/A'}</td>
                  <td className="px-4 py-3 font-semibold text-[#83358E]">{rec.section || 'N/A'}</td>
                  <td className="px-4 py-3 text-gray-600">{rec.yearLevel || 'N/A'}</td>
                  <td className="px-4 py-3 font-mono text-green-700">{rec.checkIn || '—'}</td>
                  <td className="px-4 py-3 font-mono text-blue-700">{rec.checkOut || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={rec.status as AttendStatus} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs italic">
                    {rec.flaggedReason ?? "—"}
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No attendance records match your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <p>Showing <strong>{filteredRecords.length}</strong> of <strong>{allRecords.length}</strong> records</p>
          <p>Event: <strong>{event.name}</strong></p>
        </div>
      </div>

      {/* Excel Export Preview Modal */}
      <AttendanceExportPreviewModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        records={filteredRecords}
        eventTitle={event.name}
        eventDate={event.date}
        hostingOrgName={event.org}
        venueName={event.venue}
        activeFiltersSummary={activeFiltersSummary}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AttendanceMonitoring() {
  const { events: dbEvents, loading: eventsLoading } = useAllEvents();
  const { attendance: dbAttendance, loading: attendanceLoading } = useAttendanceStream();
  const { venues, loading: venuesLoading } = useVenuesStream();
  const { categories: dbCategories, loading: categoriesLoading } = useEventCategoriesStream();
  const { data: rawOrganizations, loading: orgsLoading } = useOrganizationStream();

  const { data: students, loading: studentsLoading } = useStudents();
  const { data: departments } = useDepartments();
  const { data: courses } = useCourses();
  const { data: dbSections } = useSections();

  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventSearch, setEventSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");

  const loading = eventsLoading || attendanceLoading || venuesLoading || categoriesLoading || studentsLoading || orgsLoading;

  // Student lookup map
  const studentMap = useMemo(() => {
    const map = new Map<string, any>();
    (students || []).forEach(s => {
      if (s.studentId) map.set(s.studentId.trim().toLowerCase(), s);
      if (s.authUid) map.set(s.authUid.trim().toLowerCase(), s);
      if (s.id) map.set(s.id.trim().toLowerCase(), s);
    });
    return map;
  }, [students]);

  // Unique section names list
  const availableSections = useMemo(() => {
    const set = new Set<string>();
    (dbSections || []).forEach(s => { if (s.name) set.add(s.name.trim()); });
    (students || []).forEach(s => { if (s.section) set.add(s.section.trim()); });
    return Array.from(set).sort();
  }, [dbSections, students]);

  const mappedEvents: (Event & { hostingOrgId: string })[] = useMemo(() => {
    const validEvents = dbEvents.filter(evt => evt.enableQRTickets !== false);
    const eventsToUse = validEvents.length > 0 ? validEvents : dbEvents;

    if (eventsToUse.length === 0) return [];

    return eventsToUse.map(evt => {
      const evtAttendance = dbAttendance.filter(a => a.eventId === evt.id || a.event === evt.title);
      
      const registered = evt.expectedParticipantCount || evtAttendance.length || 0;
      const checkedIn = evtAttendance.filter(a => a.status === "Checked In" || a.status === "Complete" || a.status === "Late").length;
      const absent = evtAttendance.filter(a => a.status === "Absent").length;
      const flagged = evtAttendance.filter(a => a.status === "Flagged").length;

      const sessions: EventSession[] = (evt.sessions && evt.sessions.length > 0) ? evt.sessions.map((s, i) => ({
        id: s.id || `session-${i}`,
        label: s.title || `Session ${i + 1}`,
        date: s.date || "TBA",
        timeStart: s.startTime || "8:00 AM",
        timeEnd: s.endTime || "5:00 PM",
        records: evtAttendance.map((rec) => {
          const matchedStudent = studentMap.get((rec.studentId || '').trim().toLowerCase());
          const deptObj = (departments || []).find(d => d.id === matchedStudent?.departmentId || d.code === matchedStudent?.departmentId);
          const courseObj = (courses || []).find(c => c.id === matchedStudent?.courseId || c.code === matchedStudent?.courseCode);

          return {
            ...rec,
            id: rec.id,
            studentId: rec.studentId || matchedStudent?.studentId || 'N/A',
            name: rec.name || (matchedStudent ? `${matchedStudent.firstName} ${matchedStudent.lastName}` : 'Unknown Student'),
            departmentId: matchedStudent?.departmentId,
            departmentName: matchedStudent?.departmentName || deptObj?.name || 'N/A',
            departmentCode: deptObj?.code || matchedStudent?.departmentId || 'N/A',
            courseId: matchedStudent?.courseId,
            courseCode: matchedStudent?.courseCode || courseObj?.code || 'N/A',
            courseName: matchedStudent?.courseName || courseObj?.name || 'N/A',
            section: matchedStudent?.section || 'N/A',
            yearLevel: matchedStudent?.yearLevel || 'N/A',
            sessionTitle: s.title || 'Main Session',
            sessionId: s.id || `session-${i}`,
            checkIn: rec.checkIn === '—' ? '' : rec.checkIn,
            checkOut: rec.checkOut === '—' ? '' : rec.checkOut,
            duration: rec.checkIn && rec.checkOut && rec.checkIn !== '—' && rec.checkOut !== '—' ? 'Active' : null,
            status: rec.status as any,
            flaggedReason: rec.flaggedReason,
          };
        })
      })) : [
        {
          id: `${evt.id}-main`,
          label: "Main Session",
          date: "TBA",
          timeStart: "TBA",
          timeEnd: "TBA",
          records: evtAttendance.map(rec => {
            const matchedStudent = studentMap.get((rec.studentId || '').trim().toLowerCase());
            const deptObj = (departments || []).find(d => d.id === matchedStudent?.departmentId || d.code === matchedStudent?.departmentId);
            const courseObj = (courses || []).find(c => c.id === matchedStudent?.courseId || c.code === matchedStudent?.courseCode);

            return {
              ...rec,
              id: rec.id,
              studentId: rec.studentId || matchedStudent?.studentId || 'N/A',
              name: rec.name || (matchedStudent ? `${matchedStudent.firstName} ${matchedStudent.lastName}` : 'Unknown Student'),
              departmentId: matchedStudent?.departmentId,
              departmentName: matchedStudent?.departmentName || deptObj?.name || 'N/A',
              departmentCode: deptObj?.code || matchedStudent?.departmentId || 'N/A',
              courseId: matchedStudent?.courseId,
              courseCode: matchedStudent?.courseCode || courseObj?.code || 'N/A',
              courseName: matchedStudent?.courseName || courseObj?.name || 'N/A',
              section: matchedStudent?.section || 'N/A',
              yearLevel: matchedStudent?.yearLevel || 'N/A',
              sessionTitle: 'Main Session',
              sessionId: `${evt.id}-main`,
              checkIn: rec.checkIn === '—' ? '' : rec.checkIn,
              checkOut: rec.checkOut === '—' ? '' : rec.checkOut,
              duration: rec.checkIn && rec.checkOut && rec.checkIn !== '—' && rec.checkOut !== '—' ? 'Active' : null,
              status: rec.status as any,
              flaggedReason: rec.flaggedReason,
            };
          })
        }
      ];

      const eventDate = evt.sessions?.[0]?.date || "Date TBA";
      
      let eventStatus: "Ongoing" | "Completed" | "Upcoming" = "Upcoming";
      if (evt.proposalStatus === "approved") {
        if (checkedIn > 0 && absent > 0) eventStatus = "Completed";
        else if (checkedIn > 0) eventStatus = "Ongoing";
        else eventStatus = "Upcoming";
      }

      const venueObj = (venues || []).find(v => v.id === evt.venueId);
      const venueName = venueObj ? venueObj.name : (evt.venueId || "Venue TBA");
      
      const catObj = (dbCategories || []).find(c => c.id === evt.eventCategoryId);
      const catName = catObj ? catObj.name : (evt.eventCategoryId || "General");

      const orgObj = (rawOrganizations || []).find(
        o => o.id === evt.hostingOrgId || o.acronym === evt.hostingOrgId || o.name === evt.hostingOrgId
      );
      const orgName = orgObj ? orgObj.name : (evt.hostingOrgId || "SAO");
      const orgInitials = orgObj ? (orgObj.acronym || orgObj.name.substring(0, 3).toUpperCase()) : (evt.hostingOrgId ? evt.hostingOrgId.substring(0, 3).toUpperCase() : "SAO");

      return {
        id: evt.id,
        name: evt.title,
        date: eventDate,
        venue: venueName,
        hostingOrgId: evt.hostingOrgId || "SAO",
        org: orgName,
        orgInitials: orgInitials,
        category: catName,
        registered,
        checkedIn,
        absent,
        flagged,
        status: eventStatus,
        sessions,
      };
    });
  }, [dbEvents, dbAttendance, venues, dbCategories, studentMap, departments, courses, rawOrganizations]);

  // Unique options for event filter dropdowns
  const availableOrgs = useMemo(() => {
    const map = new Map<string, string>();
    (rawOrganizations || []).forEach(o => {
      map.set(o.id, o.acronym ? `${o.name} (${o.acronym})` : o.name);
    });
    mappedEvents.forEach(e => {
      if (e.hostingOrgId && !map.has(e.hostingOrgId)) {
        map.set(e.hostingOrgId, e.org || e.hostingOrgId);
      }
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rawOrganizations, mappedEvents]);

  const availableCategories = useMemo(() => {
    return Array.from(new Set(mappedEvents.map(e => e.category).filter(Boolean))).sort();
  }, [mappedEvents]);

  const availableVenues = useMemo(() => {
    return Array.from(new Set(mappedEvents.map(e => e.venue).filter(Boolean))).sort();
  }, [mappedEvents]);

  const filteredEvents = useMemo(() => {
    return mappedEvents.filter((e) => {
      const searchStr = eventSearch.trim().toLowerCase();
      const nameStr = (e.name || "").toLowerCase();
      const orgStr = (e.org || "").toLowerCase();
      const venueStr = (e.venue || "").toLowerCase();

      const matchSearch =
        !searchStr ||
        nameStr.includes(searchStr) ||
        orgStr.includes(searchStr) ||
        venueStr.includes(searchStr);

      const matchStatus = statusFilter === "all" || e.status === statusFilter;
      const matchOrg = orgFilter === "all" || e.hostingOrgId === orgFilter || e.org === orgFilter;
      const matchCat = categoryFilter === "all" || e.category === categoryFilter;
      const matchVenue = venueFilter === "all" || e.venue === venueFilter;

      return matchSearch && matchStatus && matchOrg && matchCat && matchVenue;
    });
  }, [mappedEvents, eventSearch, statusFilter, orgFilter, categoryFilter, venueFilter]);

  const hasActiveEventFilters =
    eventSearch !== "" ||
    statusFilter !== "all" ||
    orgFilter !== "all" ||
    categoryFilter !== "all" ||
    venueFilter !== "all";

  const handleResetEventFilters = () => {
    setEventSearch("");
    setStatusFilter("all");
    setOrgFilter("all");
    setCategoryFilter("all");
    setVenueFilter("all");
  };

  const totalRegistered = mappedEvents.reduce((s, e) => s + e.registered, 0);
  const totalCheckedIn = mappedEvents.reduce((s, e) => s + e.checkedIn, 0);
  const totalAbsent = mappedEvents.reduce((s, e) => s + e.absent, 0);
  const totalFlagged = mappedEvents.reduce((s, e) => s + e.flagged, 0);

  const overviewChart = useMemo(() => mappedEvents.filter((e) => e.status !== "Upcoming").map((e) => {
    const evtName = e.name || "Untitled Event";
    return {
      event: evtName.length > 18 ? evtName.slice(0, 18) + "…" : evtName,
      registered: e.registered,
      checkedIn: e.checkedIn,
      absent: e.absent,
    };
  }), [mappedEvents]);

  if (selectedEvent) {
    return (
      <EventDetail
        event={selectedEvent}
        onBack={() => setSelectedEvent(null)}
        departments={departments || []}
        courses={courses || []}
        sections={availableSections}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-[#001A4D]">Attendance Monitoring</h2>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-[#83358E]" />}
        </div>
        <p className="text-gray-500 text-sm">Track and monitor event attendance across campus with section and department filters.</p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Total Registered", value: totalRegistered, color: "text-[#001A4D]", bg: "bg-blue-50", icon: UserCheck, note: `Across ${mappedEvents.length} events` },
          { label: "Checked In", value: totalCheckedIn, color: "text-green-600", bg: "bg-green-50", icon: CheckCircle2, note: `${totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0}% overall rate` },
          { label: "Checked Out", value: Math.round(totalCheckedIn * 0.94), color: "text-blue-600", bg: "bg-sky-50", icon: CheckCircle2, note: "94% completion" },
          { label: "Absent", value: totalAbsent, color: "text-red-500", bg: "bg-red-50", icon: XCircle, note: `${totalRegistered > 0 ? Math.round((totalAbsent / totalRegistered) * 100) : 0}% no-show rate` },
          { label: "Flagged", value: totalFlagged, color: "text-amber-600", bg: "bg-amber-50", icon: AlertCircle, note: "Require review" },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`${c.bg} border border-gray-200 rounded-2xl p-5 shadow-xs`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{c.label}</p>
                <Icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-gray-400 text-[11px] mt-1">{c.note}</p>
            </div>
          );
        })}
      </div>

      {/* Attendance Feed Chart */}
      {overviewChart.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#001A4D] text-base">Campus Event Attendance Overview</h3>
              <p className="text-xs text-gray-400">Comparison of registered vs. attended students across active events</p>
            </div>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overviewChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                <XAxis dataKey="event" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip />
                <Bar dataKey="registered" fill="#E2E8F0" radius={[4, 4, 0, 0]} name="Registered" />
                <Bar dataKey="checkedIn" fill="#83358E" radius={[4, 4, 0, 0]} name="Attended" />
                <Bar dataKey="absent" fill="#EF4444" radius={[4, 4, 0, 0]} name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Event Flexible Filter Toolbar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#83358E]" />
            <h3 className="font-bold text-sm text-[#001A4D]">Event Filters</h3>
            <span className="px-2 py-0.5 bg-purple-50 text-[#83358E] rounded-full text-xs font-semibold">
              Showing {filteredEvents.length} of {mappedEvents.length} events
            </span>
          </div>

          {hasActiveEventFilters && (
            <button
              onClick={handleResetEventFilters}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search event, org, venue..."
              value={eventSearch}
              onChange={e => setEventSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#83358E] focus:bg-white outline-none"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>

          {/* Event Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-[#83358E] focus:bg-white outline-none"
            >
              <option value="all">All Event Statuses</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Upcoming">Upcoming</option>
            </select>
          </div>

          {/* Organization Filter */}
          <div>
            <select
              value={orgFilter}
              onChange={e => setOrgFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-[#83358E] focus:bg-white outline-none"
            >
              <option value="all">All Organizations</option>
              {availableOrgs.map(org => (
                <option key={org.id} value={org.id}>{org.label}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-[#83358E] focus:bg-white outline-none"
            >
              <option value="all">All Categories</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Venue Filter */}
          <div>
            <select
              value={venueFilter}
              onChange={e => setVenueFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-[#83358E] focus:bg-white outline-none"
            >
              <option value="all">All Venues</option>
              {availableVenues.map(ven => (
                <option key={ven} value={ven}>{ven}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEvents.map((evt) => (
          <div
            key={evt.id}
            onClick={() => setSelectedEvent(evt)}
            className="bg-white border border-gray-200 hover:border-[#83358E] rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#001A4D] text-white font-bold rounded-xl flex items-center justify-center text-xs">
                  {evt.orgInitials}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#001A4D] line-clamp-1">{evt.name}</h4>
                  <p className="text-xs text-gray-400">{evt.org}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center py-2 bg-gray-50 rounded-xl">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Registered</span>
                <span className="text-xs font-bold text-[#001A4D]">{evt.registered}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Attended</span>
                <span className="text-xs font-bold text-green-600">{evt.checkedIn}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Absent</span>
                <span className="text-xs font-bold text-red-500">{evt.absent}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
              <span>{evt.date}</span>
              <span className="font-semibold text-[#83358E]">View Logs &rarr;</span>
            </div>
          </div>
        ))}

        {filteredEvents.length === 0 && (
          <div className="col-span-full bg-gray-50 border border-gray-200 rounded-2xl p-12 text-center text-gray-500 space-y-3">
            <p className="font-semibold text-gray-700 text-sm">No events match your selected filters.</p>
            {hasActiveEventFilters && (
              <button
                onClick={handleResetEventFilters}
                className="px-4 py-2 bg-[#001A4D] text-white text-xs font-bold rounded-xl hover:bg-[#83358E] transition-colors"
              >
                Reset Event Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
