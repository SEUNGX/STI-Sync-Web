import { useState, useMemo } from 'react';
import {
  Download,
  Users,
  UserCheck,
  UserMinus,
  UserX,
  ChevronDown,
  AlertCircle,
  QrCode,
  Loader2,
  Calendar,
  FileSpreadsheet,
  DollarSign,
  AlertTriangle,
  Coins,
  Info,
  CheckCircle2,
  ShieldAlert,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useAllEvents } from '../../modules/events/hooks/useEventStream';
import { useAttendanceStream } from '../../modules/attendance/hooks/useAttendanceStream';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useStudents } from '../../modules/students/hooks/useStudentStream';
import { useDepartments, useCourses, useSections } from '../../modules/academic/hooks/useAcademicStream';
import { recordEventFinePayables } from '../../modules/finance/services/payable.service';

import { AttendanceFilterToolbar } from '../../modules/attendance/components/AttendanceFilterToolbar';
import { AttendanceExportPreviewModal } from '../../modules/attendance/components/AttendanceExportPreviewModal';
import { EventFinesGenerationModal } from '../../modules/finance/components/EventFinesGenerationModal';
import { EventFinesRosterView } from '../../modules/finance/components/EventFinesRosterView';
import type { AttendanceFilterState, EnrichedAttendanceRecord } from '../../modules/attendance/types/attendance.types';

interface OfficerMappedEvent {
  id: string;
  title: string;
  date: string;
  venue: string;
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

export default function AttendanceLogs() {
  const { profile, loading: profileLoading } = useOfficerProfile();
  const { events: dbEvents, loading: eventsLoading } = useAllEvents();
  const { attendance: dbAttendance, loading: attendanceLoading } = useAttendanceStream();
  const { data: orgs, loading: orgsLoading } = useOrganizationStream();

  // Academic streams
  const { data: students, loading: studentsLoading } = useStudents();
  const { data: departments } = useDepartments();
  const { data: courses } = useCourses();
  const { data: dbSections } = useSections();

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [filterState, setFilterState] = useState<AttendanceFilterState>(INITIAL_FILTERS);
  const [showFlagged, setShowFlagged] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendance' | 'fines'>('attendance');
  const [isAssessFinesModalOpen, setIsAssessFinesModalOpen] = useState(false);

  const activeOrgId = profile?.activeOrganizationId;
  const currentStudentId = profile?.studentId;

  const handleRecordFines = async (eventId: string, eventTitle: string) => {
    if (!eventId) return;
    setIsRecordingFines(true);
    try {
      const res = await recordEventFinePayables(eventId, currentStudentId || 'officer', true);
      if (res.created > 0) {
        toast.success(`Recorded ${res.created} fine payable(s) for ${eventTitle}.${res.skipped > 0 ? ` (${res.skipped} already recorded)` : ''}`);
      } else if (res.skipped > 0) {
        toast.info(`No new fines created. All ${res.skipped} eligible fine(s) were already recorded.`);
      } else {
        toast.info(`No fine-eligible attendance records found for ${eventTitle}.`);
      }
    } catch (err: any) {
      console.error('[AttendanceLogs] Record fines error:', err);
      toast.error(err?.message || 'Failed to record event fines.');
    } finally {
      setIsRecordingFines(false);
    }
  };

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

        const firstSessionDate = evt.sessions && evt.sessions.length > 0 ? evt.sessions[0].date : 'Date TBA';

        const sessionsList = (evt.sessions || []).map((s, idx) => ({
          id: s.id || `sess-${idx}`,
          title: s.title || `Session ${idx + 1}`,
        }));

        const enrichedRecords: EnrichedAttendanceRecord[] = evtAttendance.map((rec) => {
          const matchedStudent = studentMap.get((rec.studentId || '').trim().toLowerCase());

          const deptObj = (departments || []).find(d => d.id === matchedStudent?.departmentId || d.code === matchedStudent?.departmentId);
          const courseObj = (courses || []).find(c => c.id === matchedStudent?.courseId || c.code === matchedStudent?.courseCode);
          const sessionObj = evt.sessions?.find(s => s.id === rec.sessionId);

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
            sessionTitle: sessionObj?.title || 'Main Session',
            checkIn: rec.checkIn === '—' ? '' : rec.checkIn,
            checkOut: rec.checkOut === '—' ? '' : rec.checkOut,
            duration: rec.checkIn && rec.checkOut && rec.checkIn !== '—' && rec.checkOut !== '—' ? 'Active' : null,
            status: normStatus,
            flaggedReason: rec.flaggedReason,
          };
        });

        const registered = evt.expectedParticipantCount || enrichedRecords.length || 0;
        const checkedIn = enrichedRecords.filter((r) => r.status === 'Checked In' || r.status === 'Complete' || r.status === 'Checked Out' || r.status === 'Late').length;
        const checkedOut = enrichedRecords.filter((r) => r.status === 'Checked Out').length;
        const absent = enrichedRecords.filter((r) => r.status === 'Absent').length;
        const flagged = enrichedRecords.filter((r) => r.status === 'Flagged').length;

        return {
          id: evt.id,
          title: evtTitle || 'Untitled Event',
          date: firstSessionDate,
          venue: evt.venueId || 'Venue TBA',
          hostingOrgId: evt.hostingOrgId,
          orgName,
          orgInitials,
          expectedAttendance: registered,
          registered,
          checkedIn,
          checkedOut,
          absent,
          flagged,
          status: evt.proposalStatus,
          sessions: sessionsList,
          records: enrichedRecords,
        };
      });
  }, [dbEvents, dbAttendance, orgs, activeOrgId, currentStudentId, studentMap, departments, courses]);

  // Active Event
  const currentEvent = useMemo(() => {
    if (officerEvents.length === 0) return null;
    return officerEvents.find((e) => e.id === selectedEventId) || officerEvents[0];
  }, [officerEvents, selectedEventId]);

  const loading = profileLoading || eventsLoading || attendanceLoading || orgsLoading || studentsLoading;

  // Filtered student records based on AttendanceFilterState
  const filteredRecords = useMemo(() => {
    if (!currentEvent) return [];

    return currentEvent.records.filter((rec) => {
      // 1. Search query
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

      // 2. Department filter
      if (filterState.departmentId !== 'all') {
        const matchDept =
          rec.departmentId === filterState.departmentId ||
          rec.departmentCode === filterState.departmentId;
        if (!matchDept) return false;
      }

      // 3. Course filter
      if (filterState.courseId !== 'all') {
        const matchCourse =
          rec.courseId === filterState.courseId ||
          rec.courseCode === filterState.courseId;
        if (!matchCourse) return false;
      }

      // 4. Section filter
      if (filterState.section !== 'all') {
        if ((rec.section || '').trim().toLowerCase() !== filterState.section.trim().toLowerCase()) {
          return false;
        }
      }

      // 5. Year Level filter
      if (filterState.yearLevel !== 'all') {
        if ((rec.yearLevel || '').trim().toLowerCase() !== filterState.yearLevel.trim().toLowerCase()) {
          return false;
        }
      }

      // 6. Session filter
      if (filterState.sessionId !== 'all') {
        if (rec.sessionId !== filterState.sessionId) return false;
      }

      // 7. Status filter
      if (filterState.status !== 'all') {
        if (filterState.status === 'checked-in' && rec.status !== 'Checked In' && rec.status !== 'Complete') return false;
        if (filterState.status === 'checked-out' && rec.status !== 'Checked Out') return false;
        if (filterState.status === 'absent' && rec.status !== 'Absent') return false;
        if (filterState.status === 'flagged' && rec.status !== 'Flagged') return false;
        if (filterState.status === 'Late' && rec.status !== 'Late') return false;
        if (['Complete', 'Checked In', 'Absent', 'Flagged', 'Late'].includes(filterState.status)) {
          if (rec.status !== filterState.status) return false;
        }
      }

      return true;
    });
  }, [currentEvent, filterState]);

  // Flagged records for current event
  const flaggedEntries = useMemo(() => {
    if (!currentEvent) return [];
    return currentEvent.records.filter((r) => r.status === 'Flagged' || !!r.flaggedReason);
  }, [currentEvent]);

  // Active filters summary string
  const activeFiltersSummary = useMemo(() => {
    const parts: string[] = [];
    if (filterState.departmentId !== 'all') {
      const d = (departments || []).find(dept => dept.id === filterState.departmentId || dept.code === filterState.departmentId);
      parts.push(`Dept: ${d?.code || filterState.departmentId}`);
    }
    if (filterState.section !== 'all') parts.push(`Section: ${filterState.section}`);
    if (filterState.yearLevel !== 'all') parts.push(`Year: ${filterState.yearLevel}`);
    if (filterState.status !== 'all') parts.push(`Status: ${filterState.status}`);
    if (filterState.searchQuery) parts.push(`Search: "${filterState.searchQuery}"`);
    return parts.length > 0 ? parts.join(' | ') : 'All Attendees';
  }, [filterState, departments]);

  const handleFilterChange = (updates: Partial<AttendanceFilterState>) => {
    setFilterState(prev => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    setFilterState(INITIAL_FILTERS);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0E4EBD] mb-3" />
        <p className="text-gray-500 text-sm font-medium">Loading attendance logs & student registry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-gray-400 text-xs mb-1">Dashboard &gt; Attendance Logs</div>
        <h1 className="text-[#001A4D] text-2xl font-bold">Officer Attendance Logs</h1>
        <p className="text-gray-500 text-xs mt-0.5">
          Filter, monitor, and export attendance logs for events hosted or created by your organization.
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
          {/* Event Selector Tabs */}
          <div className="bg-white border border-[#E0E0E0] rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Select Event to Monitor</p>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {officerEvents.map((evt) => (
                <button
                  key={evt.id}
                  onClick={() => { setSelectedEventId(evt.id); handleResetFilters(); }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                    currentEvent?.id === evt.id
                      ? 'bg-[#001A4D] text-[#FFD41C] shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{evt.title}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                      currentEvent?.id === evt.id ? 'bg-[#FFD41C]/20 text-[#FFD41C]' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {evt.checkedIn} attended
                  </span>
                </button>
              ))}
            </div>
          </div>

          {currentEvent && (
            <div className="space-y-6">
              {/* Metric Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Registered</span>
                    <Users className="w-5 h-5 text-[#001A4D]" />
                  </div>
                  <div className="text-[#001A4D] text-2xl font-bold">{currentEvent.registered}</div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Attended / Checked In</span>
                    <UserCheck className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-green-600 text-2xl font-bold">{currentEvent.checkedIn}</div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Checked Out</span>
                    <UserMinus className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-blue-600 text-2xl font-bold">{currentEvent.checkedOut}</div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Absent</span>
                    <UserX className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="text-red-500 text-2xl font-bold">{currentEvent.absent}</div>
                </div>
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
                    Attendance Roster ({currentEvent.records.length})
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
                  {/* Shared Attendance Filter Toolbar */}
                  <AttendanceFilterToolbar
                    filters={filterState}
                    onFilterChange={handleFilterChange}
                    onReset={handleResetFilters}
                    departments={(departments || []).map(d => ({ id: d.id, name: d.name, code: d.code }))}
                    sections={availableSections}
                    courses={(courses || []).map(c => ({ id: c.id, name: c.name, code: c.code }))}
                    sessions={currentEvent.sessions}
                    onExportClick={() => setIsExportModalOpen(true)}
                    totalCount={currentEvent.records.length}
                    filteredCount={filteredRecords.length}
                  />

              {/* Attendance Table Container */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
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
                        <th className="px-4 py-3 font-bold uppercase tracking-wider">Check-In</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider">Check-Out</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                      {filteredRecords.map((rec, idx) => (
                        <tr
                          key={rec.id || idx}
                          className={`hover:bg-blue-50/40 transition-colors ${
                            rec.status === 'Absent' ? 'bg-red-50/20' :
                            rec.status === 'Flagged' ? 'bg-amber-50/30' :
                            rec.status === 'Late' ? 'bg-orange-50/20' : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 font-mono text-gray-600">{rec.studentId || 'N/A'}</td>
                          <td className="px-4 py-3 font-bold text-[#001A4D]">{rec.name}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-bold">
                              {rec.departmentCode || rec.departmentName || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-blue-900">{rec.courseCode || rec.courseName || 'N/A'}</td>
                          <td className="px-4 py-3 font-semibold text-[#0E4EBD]">{rec.section || 'N/A'}</td>
                          <td className="px-4 py-3 text-gray-600">{rec.yearLevel || 'N/A'}</td>
                          <td className="px-4 py-3 font-mono text-green-700">{rec.checkIn || '—'}</td>
                          <td className="px-4 py-3 font-mono text-blue-700">{rec.checkOut || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.status === 'Complete' || rec.status === 'Checked In' ? 'bg-green-100 text-green-800 border border-green-300' :
                              rec.status === 'Checked Out' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                              rec.status === 'Late' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                              rec.status === 'Absent' ? 'bg-red-100 text-red-800 border border-red-300' :
                              'bg-orange-100 text-orange-800 border border-orange-300'
                            }`}>
                              {rec.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredRecords.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm">
                            No attendance records match your search or filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>Showing <strong>{filteredRecords.length}</strong> of <strong>{currentEvent.records.length}</strong> attendance records</span>
                  <span>Event: <strong>{currentEvent.title}</strong></span>
                </div>
              </div>

              {/* Flagged Section Accordion */}
              {flaggedEntries.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl overflow-hidden shadow-sm">
                  <button
                    onClick={() => setShowFlagged(!showFlagged)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-amber-100/60 transition-colors"
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
                    eventTitle={currentEvent.title}
                    eventDate={currentEvent.date}
                    hostingOrgName={currentEvent.orgName}
                    venueName={currentEvent.venue}
                    activeFiltersSummary={activeFiltersSummary}
                  />
                </>
              ) : (
                <EventFinesRosterView
                  eventId={currentEvent.id}
                  eventTitle={currentEvent.title}
                  isOfficer={true}
                  orgId={activeOrgId || currentEvent.hostingOrgId}
                  recordedByUid={currentStudentId || 'officer'}
                  semesterId="active"
                  onOpenAssessFinesModal={() => setIsAssessFinesModalOpen(true)}
                  isEventCompleted={currentEvent.status === 'Completed'}
                />
              )}

              {/* Dynamic Fines Assessment Modal */}
              <EventFinesGenerationModal
                isOpen={isAssessFinesModalOpen}
                onClose={() => setIsAssessFinesModalOpen(false)}
                event={{
                  id: currentEvent.id,
                  name: currentEvent.title,
                  title: currentEvent.title,
                  sessions: currentEvent.sessions.map((s) => ({
                    id: s.id,
                    title: s.title,
                    hasTimeOut: true,
                  })),
                  status: currentEvent.status,
                  hostingOrgId: activeOrgId || currentEvent.hostingOrgId,
                  hostingOrgName: currentEvent.orgName,
                }}
                isOfficer={true}
                attendanceRecords={currentEvent.records}
                currentUserId={currentStudentId || 'officer'}
                onSuccess={() => {
                  setActiveTab('fines');
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
