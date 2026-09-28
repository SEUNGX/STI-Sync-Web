import { useState, useMemo } from 'react';
import {
  UserCheck,
  ChevronDown,
  AlertCircle,
  QrCode,
  Loader2,
  Calendar,
  Coins,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  MapPin,
  Users,
  Search,
  Filter,
  ChevronRight,
} from 'lucide-react';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useAllEvents } from '../../modules/events/hooks/useEventStream';
import { useAttendanceStream } from '../../modules/attendance/hooks/useAttendanceStream';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useStudents } from '../../modules/students/hooks/useStudentStream';
import { useDepartments, useCourses, useSections } from '../../modules/academic/hooks/useAcademicStream';
import { useVenuesStream, useEventCategoriesStream } from '../../modules/events/hooks/useEventConfigStream';
import {
  isSessionCheckInPassed,
  isStudentTargetedForEvent,
  syncEventAbsenteeRecords,
} from '../../modules/attendance/services/attendance.service';

import { AttendanceFilterToolbar } from '../../modules/attendance/components/AttendanceFilterToolbar';
import { AttendanceExportPreviewModal } from '../../modules/attendance/components/AttendanceExportPreviewModal';
import { EventFinesGenerationModal } from '../../modules/finance/components/EventFinesGenerationModal';
import { EventFinesRosterView } from '../../modules/finance/components/EventFinesRosterView';
import type { AttendanceFilterState, EnrichedAttendanceRecord } from '../../modules/attendance/types/attendance.types';
import { TablePagination } from '../../components/common/TablePagination';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OfficerMappedEvent {
  id: string;
  title: string;
  date: string;
  venue: string;
  category: string;
  hostingOrgId: string;
  orgName: string;
  orgInitials: string;
  expectedAttendance: number;
  registered: number;
  checkedIn: number;
  checkedOut: number;
  absent: number;
  flagged: number;
  status: string;
  sessions: { id: string; title: string }[];
  records: EnrichedAttendanceRecord[];
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

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string }> = {
    'Complete': { label: 'Complete', bg: 'bg-green-100 text-green-700 border-green-200' },
    'Checked In': { label: 'Checked In', bg: 'bg-green-100 text-green-700 border-green-200' },
    'Checked Out': { label: 'Checked Out', bg: 'bg-blue-100 text-blue-700 border-blue-200' },
    'Late': { label: 'Late', bg: 'bg-orange-100 text-orange-700 border-orange-200' },
    'Absent': { label: 'Absent', bg: 'bg-red-100 text-red-700 border-red-200' },
    'Flagged': { label: 'Flagged', bg: 'bg-amber-100 text-amber-700 border-amber-200' },
  };

  const c = config[status] ?? { label: status, bg: 'bg-gray-100 text-gray-700 border-gray-200' };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.bg}`}>
      {c.label}
    </span>
  );
}

// ─── Event Detail View (Mirrored from Admin) ──────────────────────────────────
function EventDetail({
  event,
  onBack,
  departments,
  courses,
  sections,
  activeOrgId,
  currentStudentId,
}: {
  event: OfficerMappedEvent;
  onBack: () => void;
  departments: any[];
  courses: any[];
  sections: string[];
  activeOrgId?: string;
  currentStudentId?: string;
}) {
  const [filterState, setFilterState] = useState<AttendanceFilterState>(INITIAL_FILTERS);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendance' | 'fines'>('attendance');
  const [isAssessFinesModalOpen, setIsAssessFinesModalOpen] = useState(false);
  const [showFlagged, setShowFlagged] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ATTENDANCE_PER_PAGE = 8;

  const allRecords = useMemo(() => event.records || [], [event]);
  const rate = event.registered > 0 ? Math.round((event.checkedIn / event.registered) * 100) : 0;

  // Filtered records
  const filteredRecords = useMemo(() => {
    return allRecords.filter((rec) => {
      // 1. Search Query
      if (filterState.searchQuery.trim()) {
        const q = filterState.searchQuery.toLowerCase();
        const matchSearch =
          (rec.name || '').toLowerCase().includes(q) ||
          (rec.studentId || '').toLowerCase().includes(q) ||
          (rec.section || '').toLowerCase().includes(q) ||
          (rec.courseCode || rec.courseName || '').toLowerCase().includes(q) ||
          (rec.departmentName || rec.departmentCode || '').toLowerCase().includes(q) ||
          (rec.flaggedReason || '').toLowerCase().includes(q);
        if (!matchSearch) return false;
      }

      // 2. Department Filter
      if (filterState.departmentId !== 'all') {
        const matchDept =
          rec.departmentId === filterState.departmentId ||
          rec.departmentCode === filterState.departmentId;
        if (!matchDept) return false;
      }

      // 3. Course Filter
      if (filterState.courseId !== 'all') {
        const matchCourse =
          rec.courseId === filterState.courseId ||
          rec.courseCode === filterState.courseId;
        if (!matchCourse) return false;
      }

      // 4. Section Filter
      if (filterState.section !== 'all') {
        if ((rec.section || '').trim().toLowerCase() !== filterState.section.trim().toLowerCase()) {
          return false;
        }
      }

      // 5. Year Level Filter
      if (filterState.yearLevel !== 'all') {
        if ((rec.yearLevel || '').trim().toLowerCase() !== filterState.yearLevel.trim().toLowerCase()) {
          return false;
        }
      }

      // 6. Session Filter
      if (filterState.sessionId !== 'all') {
        if (rec.sessionId !== filterState.sessionId) return false;
      }

      // 7. Status Filter
      if (filterState.status !== 'all') {
        if (filterState.status === 'Checked In' && rec.status !== 'Checked In' && rec.status !== 'Complete') return false;
        if (filterState.status === 'Checked Out' && rec.status !== 'Checked Out') return false;
        if (filterState.status === 'Late' && rec.status !== 'Late') return false;
        if (filterState.status === 'Absent' && rec.status !== 'Absent') return false;
        if (filterState.status === 'Flagged' && rec.status !== 'Flagged') return false;
        if (['Complete', 'Checked In', 'Checked Out', 'Absent', 'Flagged', 'Late'].includes(filterState.status)) {
          if (rec.status !== filterState.status) return false;
        }
      }

      return true;
    });
  }, [allRecords, filterState]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ATTENDANCE_PER_PAGE));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ATTENDANCE_PER_PAGE;
    return filteredRecords.slice(start, start + ATTENDANCE_PER_PAGE);
  }, [filteredRecords, currentPage]);

  const flaggedEntries = useMemo(() => {
    return allRecords.filter((r) => r.status === 'Flagged' || !!r.flaggedReason);
  }, [allRecords]);

  const activeFiltersSummary = useMemo(() => {
    const parts: string[] = [];
    if (filterState.departmentId !== 'all') {
      const d = (departments || []).find(dept => dept.id === filterState.departmentId || dept.code === filterState.departmentId);
      parts.push(`Dept: ${d?.code || filterState.departmentId}`);
    }
    if (filterState.section !== 'all') parts.push(`Section: ${filterState.section}`);
    if (filterState.yearLevel !== 'all') parts.push(`Year: ${filterState.yearLevel}`);
    if (filterState.sessionId !== 'all') {
      const s = event.sessions.find(sess => sess.id === filterState.sessionId);
      parts.push(`Session: ${s?.title || filterState.sessionId}`);
    }
    if (filterState.status !== 'all') parts.push(`Status: ${filterState.status}`);
    if (filterState.searchQuery) parts.push(`Search: "${filterState.searchQuery}"`);
    return parts.length > 0 ? parts.join(' | ') : 'All Event Attendees';
  }, [filterState, departments, event.sessions]);

  const handleFilterChange = (updates: Partial<AttendanceFilterState>) => {
    setFilterState(prev => ({ ...prev, ...updates }));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilterState(INITIAL_FILTERS);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#001A4D] text-sm font-medium hover:text-[#0E4EBD] transition-colors mb-4 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Events
        </button>

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-2xl flex items-center justify-center text-[#FFD41C] font-bold text-lg flex-shrink-0 shadow-sm">
            {event.orgInitials}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#001A4D]">{event.title}</h2>
            <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-gray-400" />{event.date}</span>
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" />{event.venue}</span>
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-gray-400" />{event.orgName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row - 5 Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Registered', value: event.registered, color: 'text-[#001A4D]', bg: 'bg-blue-50', icon: UserCheck, note: `${event.sessions.length} session(s) scheduled` },
          { label: 'Attended', value: `${event.checkedIn} (${rate}%)`, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2, note: `${rate}% attendance rate` },
          { label: 'Checked Out', value: event.checkedOut, color: 'text-blue-600', bg: 'bg-sky-50', icon: CheckCircle2, note: `${event.checkedIn > 0 ? Math.round((event.checkedOut / event.checkedIn) * 100) : 0}% completion` },
          { label: 'Absent', value: event.absent, color: 'text-red-500', bg: 'bg-red-50', icon: XCircle, note: `${event.registered > 0 ? Math.round((event.absent / event.registered) * 100) : 0}% no-show rate` },
          { label: 'Flagged', value: event.flagged, color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertCircle, note: event.flagged > 0 ? `${event.flagged} require review` : 'No flagged logs' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`${s.bg} border border-gray-200 rounded-2xl p-4 shadow-xs`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{s.label}</p>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-gray-400 text-[11px] mt-1">{s.note}</p>
            </div>
          );
        })}
      </div>

      {/* Sub-Tab Switcher */}
      <div className="flex items-center gap-3 border-b border-gray-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 px-2 text-sm font-bold transition-all relative cursor-pointer ${
            activeTab === 'attendance'
              ? 'text-[#001A4D]'
              : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Attendance Roster ({allRecords.length})
          </span>
          {activeTab === 'attendance' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#001A4D] rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fines')}
          className={`pb-3 px-2 text-sm font-bold transition-all relative cursor-pointer ${
            activeTab === 'fines'
              ? 'text-[#001A4D]'
              : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#FFD41C]" />
            Club Fines & Collections
          </span>
          {activeTab === 'fines' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#001A4D] rounded-full" />
          )}
        </button>
      </div>

      {activeTab === 'attendance' ? (
        <>
          {/* Shared Filter Toolbar */}
          <AttendanceFilterToolbar
            filters={filterState}
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
            departments={(departments || []).map(d => ({ id: d.id, name: d.name, code: d.code }))}
            sections={sections}
            courses={(courses || []).map(c => ({ id: c.id, name: c.name, code: c.code }))}
            sessions={event.sessions}
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
                  {paginatedRecords.map((rec, idx) => (
                    <tr
                      key={rec.id || idx}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        rec.status === 'Absent' ? 'bg-red-50/20' :
                        rec.status === 'Flagged' ? 'bg-amber-50/30' :
                        rec.status === 'Late' ? 'bg-orange-50/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center text-gray-400 font-mono">
                        {(currentPage - 1) * ATTENDANCE_PER_PAGE + idx + 1}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600">{rec.studentId || 'N/A'}</td>
                      <td className="px-4 py-3 font-bold text-[#001A4D]">{rec.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-bold">
                          {rec.departmentCode || rec.departmentName || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#0E4EBD]">{rec.courseCode || rec.courseName || 'N/A'}</td>
                      <td className="px-4 py-3 font-semibold text-[#0E4EBD]">{rec.section || 'N/A'}</td>
                      <td className="px-4 py-3 text-gray-600">{rec.yearLevel || 'N/A'}</td>
                      <td className="px-4 py-3 font-mono text-green-700">{rec.checkIn || '—'}</td>
                      <td className="px-4 py-3 font-mono text-blue-700">{rec.checkOut || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={rec.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs italic">
                        {rec.flaggedReason ?? '—'}
                      </td>
                    </tr>
                  ))}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-gray-400 text-sm">
                        No attendance records match your search or filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Summary Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <p>Showing <strong>{filteredRecords.length}</strong> of <strong>{allRecords.length}</strong> records</p>
              <p>Event: <strong>{event.title}</strong></p>
            </div>

            {/* Standard Table Pagination Footer */}
            {filteredRecords.length > ATTENDANCE_PER_PAGE && (
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredRecords.length}
                itemsPerPage={ATTENDANCE_PER_PAGE}
                onPageChange={setCurrentPage}
                itemName="attendance records"
              />
            )}
          </div>

          {/* Flagged Section Accordion */}
          {flaggedEntries.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl overflow-hidden shadow-sm">
              <button
                onClick={() => setShowFlagged(!showFlagged)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-amber-100/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-700" />
                  <span className="text-amber-900 text-sm font-bold">
                    Flagged Anomaly Entries ({flaggedEntries.length})
                  </span>
                </div>
                <ChevronDown className={`w-5 h-5 text-amber-700 transition-transform ${showFlagged ? 'rotate-180' : ''}`} />
              </button>

              {showFlagged && (
                <div className="border-t border-amber-200 bg-white p-4">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-amber-100/60 text-amber-900">
                      <tr>
                        <th className="px-3 py-2 font-bold">Student</th>
                        <th className="px-3 py-2 font-bold">Section</th>
                        <th className="px-3 py-2 font-bold">Flag Reason</th>
                        <th className="px-3 py-2 font-bold">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-800">
                      {flaggedEntries.map((rec, i) => (
                        <tr key={rec.id || i}>
                          <td className="px-3 py-2 font-bold">{rec.name} ({rec.studentId})</td>
                          <td className="px-3 py-2 font-mono text-[#0E4EBD]">{rec.section}</td>
                          <td className="px-3 py-2 text-amber-800 italic">{rec.flaggedReason || 'Scan anomaly'}</td>
                          <td className="px-3 py-2 font-mono">{rec.checkIn || rec.checkOut || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Excel Export Preview Modal */}
          <AttendanceExportPreviewModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            records={filteredRecords}
            eventTitle={event.title}
            eventDate={event.date}
            hostingOrgName={event.orgName}
            venueName={event.venue}
            activeFiltersSummary={activeFiltersSummary}
          />
        </>
      ) : (
        <EventFinesRosterView
          eventId={event.id}
          eventTitle={event.title}
          isOfficer={true}
          orgId={activeOrgId || event.hostingOrgId}
          recordedByUid={currentStudentId || 'officer'}
          semesterId="active"
          onOpenAssessFinesModal={() => setIsAssessFinesModalOpen(true)}
          isEventCompleted={event.status === 'Completed'}
          isEventCancelled={
            event.status === 'Cancelled' ||
            event.status === 'cancelled' ||
            (event as any).isCancelled === true
          }
        />
      )}

      {/* Dynamic Fines Assessment Modal */}
      <EventFinesGenerationModal
        isOpen={isAssessFinesModalOpen}
        onClose={() => setIsAssessFinesModalOpen(false)}
        event={{
          id: event.id,
          name: event.title,
          title: event.title,
          sessions: event.sessions.map((s) => ({
            id: s.id,
            title: s.title,
            hasTimeOut: true,
          })),
          status: event.status,
          hostingOrgId: activeOrgId || event.hostingOrgId,
          hostingOrgName: event.orgName,
        }}
        isOfficer={true}
        attendanceRecords={event.records}
        currentUserId={currentStudentId || 'officer'}
        onSuccess={() => {
          setActiveTab('fines');
        }}
      />
    </div>
  );
}

// ─── Main Attendance Logs Page ────────────────────────────────────────────────
export default function AttendanceLogs() {
  const { profile, loading: profileLoading } = useOfficerProfile();
  const { events: dbEvents, loading: eventsLoading } = useAllEvents();
  const { attendance: dbAttendance, loading: attendanceLoading } = useAttendanceStream();
  const { data: orgs, loading: orgsLoading } = useOrganizationStream();
  const { venues } = useVenuesStream();
  const { categories: dbCategories } = useEventCategoriesStream();

  // Academic streams
  const { data: students, loading: studentsLoading } = useStudents();
  const { data: departments } = useDepartments();
  const { data: courses } = useCourses();
  const { data: dbSections } = useSections();

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [eventSearch, setEventSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [venueFilter, setVenueFilter] = useState('all');

  const activeOrgId = profile?.activeOrganizationId;
  const currentStudentId = profile?.studentId;

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

  // Unique sections list from students + registry
  const availableSections = useMemo(() => {
    const set = new Set<string>();
    (dbSections || []).forEach(s => { if (s.name) set.add(s.name.trim()); });
    (students || []).forEach(s => { if (s.section) set.add(s.section.trim()); });
    return Array.from(set).sort();
  }, [dbSections, students]);

  // Filter & Map Events hosted by or created by me / this particular org, with attendance
  const officerEvents: OfficerMappedEvent[] = useMemo(() => {
    if (!dbEvents || dbEvents.length === 0) return [];

    return dbEvents
      .filter((evt) => {
        const isMyOrg = activeOrgId ? evt.hostingOrgId === activeOrgId : false;
        const isCreatedByMe = currentStudentId ? evt.createdBy === currentStudentId : false;
        const isMyScope = isMyOrg || isCreatedByMe;

        if (!isMyScope) return false;

        const hasAttendanceConfig = evt.enableQRTickets !== false && (evt as any).enableQR !== false && evt.attendanceEnabled !== false;
        return hasAttendanceConfig;
      })
      .map((evt) => {
        const evtTitle = evt.title || (evt as any).name || '';
        const evtAttendance = (dbAttendance || []).filter(
          (a) => a.eventId === evt.id || (a.event && evtTitle && String(a.event).toLowerCase() === String(evtTitle).toLowerCase())
        );

        const orgObj = (orgs || []).find((o) => o.id === evt.hostingOrgId);
        const orgName = orgObj ? orgObj.name : evt.hostingOrgId || 'Organization';
        const orgInitials = orgObj ? (orgObj.acronym || (orgObj.name ? orgObj.name.substring(0, 3).toUpperCase() : 'ORG')) : 'ORG';

        const venueObj = (venues || []).find(v => v.id === evt.venueId || v.name === evt.venueId);
        const venueName = venueObj ? venueObj.name : (evt.venueId || 'Campus Venue');

        const catObj = (dbCategories || []).find(c => c.id === evt.categoryId || c.name === evt.categoryId);
        const catName = catObj ? catObj.name : (evt.category || evt.categoryId || 'General');

        const rawSessions = (evt.sessions && evt.sessions.length > 0) ? evt.sessions : [
          {
            id: `${evt.id}-main`,
            title: 'Main Session',
            date: (evt as any).date || 'TBA',
            startTime: (evt as any).startTime || '08:00',
            endTime: (evt as any).endTime || '17:00',
          }
        ];

        const firstSessionDate = rawSessions[0]?.date || (evt as any).date || 'TBA';
        const targetedStudents = (students || []).filter(s => isStudentTargetedForEvent(s, evt, orgs));

        const sessionsList = rawSessions.map((s, idx) => ({
          id: s.id || `sess-${idx}`,
          title: s.title || `Session ${idx + 1}`,
        }));

        const allSynthesizedRecords: EnrichedAttendanceRecord[] = [];

        rawSessions.forEach((s, idx) => {
          const sId = s.id || `sess-${idx}`;
          const sessionPassed = isSessionCheckInPassed(s, evt.gracePeriodMinutes, evt.lateThresholdMinutes) || evt.proposalStatus === 'completed' || (evt as any).status === 'Completed';

          const sessionScans = evtAttendance.filter(r => r.sessionId === sId || (!r.sessionId && idx === 0));

          const mappedScans: EnrichedAttendanceRecord[] = sessionScans.map((rec) => {
            const matchedStudent = studentMap.get((rec.studentId || '').trim().toLowerCase()) ||
              (rec.name ? (students || []).find(st => `${st.firstName} ${st.lastName}`.trim().toLowerCase() === rec.name.trim().toLowerCase()) : undefined);

            const deptObj = (departments || []).find(d => d.id === matchedStudent?.departmentId || d.code === matchedStudent?.departmentId);
            const courseObj = (courses || []).find(c => c.id === matchedStudent?.courseId || c.code === matchedStudent?.courseCode);
            const sessionObj = evt.sessions?.find(sess => sess.id === rec.sessionId) || s;

            const isFlagged = rec.status === 'Flagged' || !!rec.flaggedReason;
            const isCheckedOut = rec.checkOut && rec.checkOut !== '—';
            const isAbsent = rec.status === 'Absent';
            const isLate = rec.status === 'Late';

            let normStatus: any = 'Checked In';
            if (isFlagged) normStatus = 'Flagged';
            else if (isAbsent) normStatus = 'Absent';
            else if (isLate) normStatus = 'Late';
            else if (isCheckedOut) normStatus = 'Checked Out';
            else if (rec.status) normStatus = rec.status;

            const studentAuthUid = matchedStudent?.authUid || matchedStudent?.id || (rec as any).studentAuthUid || (rec as any).authUid || rec.studentId || 'N/A';
            const studentSchoolId = matchedStudent?.studentId || (rec as any).studentSchoolId || rec.studentId || 'N/A';

            return {
              ...rec,
              id: rec.id,
              studentAuthUid,
              studentSchoolId,
              studentId: studentSchoolId,
              name: rec.name || (matchedStudent ? `${matchedStudent.firstName} ${matchedStudent.lastName}` : 'Unknown Student'),
              departmentId: matchedStudent?.departmentId,
              departmentName: matchedStudent?.departmentName || deptObj?.name || 'N/A',
              departmentCode: deptObj?.code || matchedStudent?.departmentId || 'N/A',
              courseId: matchedStudent?.courseId,
              courseCode: matchedStudent?.courseCode || courseObj?.code || 'N/A',
              courseName: matchedStudent?.courseName || courseObj?.name || 'N/A',
              section: matchedStudent?.section || 'N/A',
              yearLevel: matchedStudent?.yearLevel || 'N/A',
              sessionTitle: sessionObj?.title || s.title || `Session ${idx + 1}`,
              sessionId: sId,
              checkIn: rec.checkIn === '—' ? '' : rec.checkIn,
              checkOut: rec.checkOut === '—' ? '' : rec.checkOut,
              duration: rec.checkIn && rec.checkOut && rec.checkIn !== '—' && rec.checkOut !== '—' ? 'Active' : null,
              status: normStatus,
              flaggedReason: rec.flaggedReason,
            };
          });

          allSynthesizedRecords.push(...mappedScans);

          if (sessionPassed) {
            targetedStudents.forEach((student) => {
              const studentSchoolId = (student.studentId || '').trim().toLowerCase();
              const studentAuthUid = (student.authUid || student.id || '').trim().toLowerCase();

              const alreadyLogged = mappedScans.some((scan) => {
                const scanId = (scan.studentId || scan.studentSchoolId || '').trim().toLowerCase();
                const scanUid = (scan.studentAuthUid || '').trim().toLowerCase();
                return (studentSchoolId && scanId === studentSchoolId) || (studentAuthUid && (scanUid === studentAuthUid || scanId === studentAuthUid));
              });

              if (!alreadyLogged) {
                const deptObj = (departments || []).find(d => d.id === student?.departmentId || d.code === student?.departmentId);
                const courseObj = (courses || []).find(c => c.id === student?.courseId || c.code === student?.courseCode);

                allSynthesizedRecords.push({
                  id: `synthetic-absent-${evt.id}-${sId}-${student.id || studentSchoolId}`,
                  studentAuthUid: student.authUid || student.id,
                  studentSchoolId: student.studentId || 'N/A',
                  studentId: student.studentId || 'N/A',
                  name: `${student.firstName} ${student.lastName}`,
                  departmentId: student.departmentId,
                  departmentName: deptObj?.name || 'N/A',
                  departmentCode: deptObj?.code || 'N/A',
                  courseId: student.courseId,
                  courseCode: courseObj?.code || student.courseCode || 'N/A',
                  courseName: courseObj?.name || student.courseName || 'N/A',
                  section: student.section || 'N/A',
                  yearLevel: student.yearLevel || 'N/A',
                  sessionTitle: s.title || `Session ${idx + 1}`,
                  sessionId: sId,
                  checkIn: '',
                  checkOut: '',
                  duration: null,
                  status: 'Absent',
                  flaggedReason: 'No check-in detected during session grace period',
                });
              }
            });
          }
        });

        const registered = Math.max(targetedStudents.length, evt.expectedParticipantCount || 0, allSynthesizedRecords.length);
        const checkedIn = allSynthesizedRecords.filter((r) => r.status === 'Checked In' || r.status === 'Complete' || r.status === 'Checked Out' || r.status === 'Late').length;
        const checkedOut = allSynthesizedRecords.filter((r) => r.status === 'Checked Out').length;
        const absent = allSynthesizedRecords.filter((r) => r.status === 'Absent').length;
        const flagged = allSynthesizedRecords.filter((r) => r.status === 'Flagged').length;

        const eventStatus = evt.proposalStatus === 'completed' || (evt as any).status === 'Completed'
          ? 'Completed'
          : (evt.proposalStatus === 'approved' || (evt as any).status === 'Approved' ? 'Ongoing' : 'Upcoming');

        return {
          id: evt.id,
          title: evtTitle || 'Untitled Event',
          date: firstSessionDate,
          venue: venueName,
          category: catName,
          hostingOrgId: evt.hostingOrgId,
          orgName,
          orgInitials,
          expectedAttendance: registered,
          registered,
          checkedIn,
          checkedOut,
          absent,
          flagged,
          status: eventStatus,
          sessions: sessionsList,
          records: allSynthesizedRecords,
        };
      });
  }, [dbEvents, dbAttendance, orgs, activeOrgId, currentStudentId, studentMap, departments, courses, students, venues, dbCategories]);

  // Automatically sync missing absent records to Firestore in background
  useMemo(() => {
    if (!officerEvents || officerEvents.length === 0 || !students || students.length === 0) return;
    officerEvents.forEach((evt) => {
      const dbEvt = (dbEvents || []).find(e => e.id === evt.id);
      if (!dbEvt) return;
      const targeted = students.filter(s => isStudentTargetedForEvent(s, dbEvt, orgs));
      if (targeted.length > 0) {
        syncEventAbsenteeRecords(dbEvt, targeted).catch(err => {
          console.warn('[AttendanceLogs] Auto-sync absentee error for evt:', evt.id, err);
        });
      }
    });
  }, [officerEvents, dbEvents, students, orgs]);

  // Unique options for event filter dropdowns
  const availableCategories = useMemo(() => {
    return Array.from(new Set(officerEvents.map(e => e.category).filter(Boolean))).sort();
  }, [officerEvents]);

  const availableVenues = useMemo(() => {
    return Array.from(new Set(officerEvents.map(e => e.venue).filter(Boolean))).sort();
  }, [officerEvents]);

  const filteredEvents = useMemo(() => {
    return officerEvents.filter((e) => {
      const searchStr = eventSearch.trim().toLowerCase();
      const nameStr = (e.title || '').toLowerCase();
      const venueStr = (e.venue || '').toLowerCase();
      const catStr = (e.category || '').toLowerCase();

      const matchSearch =
        !searchStr ||
        nameStr.includes(searchStr) ||
        venueStr.includes(searchStr) ||
        catStr.includes(searchStr);

      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchCat = categoryFilter === 'all' || e.category === categoryFilter;
      const matchVenue = venueFilter === 'all' || e.venue === venueFilter;

      return matchSearch && matchStatus && matchCat && matchVenue;
    });
  }, [officerEvents, eventSearch, statusFilter, categoryFilter, venueFilter]);

  const hasActiveEventFilters =
    eventSearch !== '' ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    venueFilter !== 'all';

  const handleResetEventFilters = () => {
    setEventSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setVenueFilter('all');
  };

  const totalRegistered = officerEvents.reduce((s, e) => s + e.registered, 0);
  const totalCheckedIn = officerEvents.reduce((s, e) => s + e.checkedIn, 0);
  const totalCheckedOut = officerEvents.reduce((s, e) => s + e.checkedOut, 0);
  const totalAbsent = officerEvents.reduce((s, e) => s + e.absent, 0);
  const totalFlagged = officerEvents.reduce((s, e) => s + e.flagged, 0);

  const activeSelectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return officerEvents.find(e => e.id === selectedEventId) || null;
  }, [officerEvents, selectedEventId]);

  const loading = profileLoading || eventsLoading || attendanceLoading || orgsLoading || studentsLoading;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0E4EBD] mb-3" />
        <p className="text-gray-500 text-sm font-medium">Loading attendance logs & student registry...</p>
      </div>
    );
  }

  if (activeSelectedEvent) {
    return (
      <EventDetail
        event={activeSelectedEvent}
        onBack={() => setSelectedEventId('')}
        departments={departments || []}
        courses={courses || []}
        sections={availableSections}
        activeOrgId={activeOrgId}
        currentStudentId={currentStudentId}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-gray-500 text-sm font-medium">
          Track and monitor event attendance for your organization with section and department filters.
        </p>
      </div>

      {officerEvents.length === 0 ? (
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-12 text-center shadow-sm">
          <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-[#001A4D] font-bold text-lg mb-1">No Attendance Logs Found</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            There are no events hosted by or created for your active organization with QR attendance enabled yet.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Registered', value: totalRegistered, color: 'text-[#001A4D]', bg: 'bg-blue-50', icon: UserCheck, note: `Across ${officerEvents.length} events` },
              { label: 'Checked In', value: totalCheckedIn, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2, note: `${totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0}% overall rate` },
              { label: 'Checked Out', value: totalCheckedOut, color: 'text-blue-600', bg: 'bg-sky-50', icon: CheckCircle2, note: `${totalCheckedIn > 0 ? Math.round((totalCheckedOut / totalCheckedIn) * 100) : 0}% completion` },
              { label: 'Absent', value: totalAbsent, color: 'text-red-500', bg: 'bg-red-50', icon: XCircle, note: `${totalRegistered > 0 ? Math.round((totalAbsent / totalRegistered) * 100) : 0}% no-show rate` },
              { label: 'Flagged', value: totalFlagged, color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertCircle, note: totalFlagged > 0 ? `${totalFlagged} require review` : 'No flagged logs' },
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

          {/* Event Filters Toolbar */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#0E4EBD]" />
                <h3 className="font-bold text-sm text-[#001A4D]">Event Filters</h3>
                <span className="px-2 py-0.5 bg-blue-50 text-[#0E4EBD] rounded-full text-xs font-semibold">
                  Showing {filteredEvents.length} of {officerEvents.length} events
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

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search event, venue..."
                  value={eventSearch}
                  onChange={e => setEventSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#0E4EBD] focus:bg-white outline-none"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Event Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-[#0E4EBD] focus:bg-white outline-none"
                >
                  <option value="all">All Event Statuses</option>
                  <option value="Ongoing">Ongoing / Approved</option>
                  <option value="Completed">Completed</option>
                  <option value="Upcoming">Upcoming / In Review</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-[#0E4EBD] focus:bg-white outline-none"
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
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-[#0E4EBD] focus:bg-white outline-none"
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
                onClick={() => setSelectedEventId(evt.id)}
                className="bg-white border border-gray-200 hover:border-[#0E4EBD] rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#001A4D] text-[#FFD41C] font-bold rounded-xl flex items-center justify-center text-xs flex-shrink-0">
                      {evt.orgInitials}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#001A4D] line-clamp-1">{evt.title}</h4>
                      <p className="text-xs text-gray-400">{evt.category} • {evt.venue}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
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
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-400" />{evt.date}</span>
                  <span className="font-semibold text-[#0E4EBD] flex items-center gap-1">View Logs &rarr;</span>
                </div>
              </div>
            ))}

            {filteredEvents.length === 0 && (
              <div className="col-span-full bg-gray-50 border border-gray-200 rounded-2xl p-12 text-center text-gray-500 space-y-3">
                <p className="font-semibold text-gray-700 text-sm">No events match your selected filters.</p>
                {hasActiveEventFilters && (
                  <button
                    onClick={handleResetEventFilters}
                    className="px-4 py-2 bg-[#001A4D] text-[#FFD41C] text-xs font-bold rounded-xl hover:bg-[#0E4EBD] hover:text-white transition-colors cursor-pointer"
                  >
                    Reset Event Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
