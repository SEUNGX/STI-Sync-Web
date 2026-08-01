import { useState, useMemo } from 'react';
import { Download, Users, UserCheck, UserMinus, UserX, ChevronDown, AlertCircle, Search, QrCode, Loader2, Calendar } from 'lucide-react';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useAllEvents } from '../../modules/events/hooks/useEventStream';
import { useAttendanceStream } from '../../modules/attendance/hooks/useAttendanceStream';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';

interface FormattedRecord {
  id: string;
  studentName: string;
  studentId: string;
  course: string;
  year: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  duration: string | null;
  status: 'checked-in' | 'checked-out' | 'absent' | 'flagged';
  avatar: string;
  flaggedReason?: string;
  createdAtRaw?: any;
}

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
  records: FormattedRecord[];
}

export default function AttendanceLogs() {
  const { profile, loading: profileLoading } = useOfficerProfile();
  const { events: dbEvents, loading: eventsLoading } = useAllEvents();
  const { attendance: dbAttendance, loading: attendanceLoading } = useAttendanceStream();
  const { data: orgs, loading: orgsLoading } = useOrganizationStream();

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFlagged, setShowFlagged] = useState(false);

  const activeOrgId = profile?.activeOrganizationId;
  const currentStudentId = profile?.studentId;

  // Filter & Map Events hosted by or created by me / this particular org, with attendance
  const officerEvents: OfficerMappedEvent[] = useMemo(() => {
    if (!dbEvents || dbEvents.length === 0) return [];

    return dbEvents
      .filter((evt) => {
        // Must belong to this org OR created by this officer
        const isMyOrg = activeOrgId ? evt.hostingOrgId === activeOrgId : false;
        const isCreatedByMe = currentStudentId ? evt.createdBy === currentStudentId : false;
        const isMyScope = isMyOrg || isCreatedByMe;

        if (!isMyScope) return false;

        // Must have attendance enabled / QR tickets
        const hasAttendanceConfig = evt.enableQRTickets !== false && (evt as any).enableQR !== false && evt.attendanceEnabled !== false;

        return hasAttendanceConfig;
      })
      .map((evt) => {
        // Get matching attendance records
        const evtTitle = evt.title || (evt as any).name || '';
        const evtAttendance = (dbAttendance || []).filter(
          (a) => a.eventId === evt.id || (a.event && evtTitle && String(a.event).toLowerCase() === String(evtTitle).toLowerCase())
        );

        const orgObj = (orgs || []).find((o) => o.id === evt.hostingOrgId);
        const orgName = orgObj ? orgObj.name : evt.hostingOrgId || 'Organization';
        const orgInitials = orgObj ? (orgObj.acronym || (orgObj.name ? orgObj.name.substring(0, 3).toUpperCase() : 'ORG')) : 'ORG';

        const firstSessionDate = evt.sessions && evt.sessions.length > 0 ? evt.sessions[0].date : 'Date TBA';

        const formattedRecords: FormattedRecord[] = evtAttendance.map((rec) => {
          const initials = rec.name
            ? rec.name.split(' ').filter(Boolean).map((n) => n[0]).join('').substring(0, 2).toUpperCase()
            : 'ST';

          const isFlagged = rec.status === 'Flagged' || !!rec.flaggedReason;
          const isCheckedOut = rec.checkOut && rec.checkOut !== '—';
          const isAbsent = rec.status === 'Absent';

          let normStatus: 'checked-in' | 'checked-out' | 'absent' | 'flagged' = 'checked-in';
          if (isFlagged) normStatus = 'flagged';
          else if (isAbsent) normStatus = 'absent';
          else if (isCheckedOut) normStatus = 'checked-out';

          return {
            id: rec.id,
            studentName: rec.name || 'Unknown Student',
            studentId: rec.studentId || 'N/A',
            course: (rec as any).course || 'BSIT',
            year: 'N/A',
            checkInTime: rec.checkIn === '—' ? null : rec.checkIn,
            checkOutTime: rec.checkOut === '—' ? null : rec.checkOut,
            duration: null,
            status: normStatus,
            avatar: initials,
            flaggedReason: rec.flaggedReason,
            createdAtRaw: rec.createdAt,
          };
        });

        const registered = evt.expectedParticipantCount || formattedRecords.length || 0;
        const checkedIn = formattedRecords.filter((r) => r.status === 'checked-in' || r.status === 'checked-out' || r.status === 'flagged').length;
        const checkedOut = formattedRecords.filter((r) => r.status === 'checked-out').length;
        const absent = formattedRecords.filter((r) => r.status === 'absent').length;
        const flagged = formattedRecords.filter((r) => r.status === 'flagged').length;

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
          records: formattedRecords,
        };
      });
  }, [dbEvents, dbAttendance, orgs, activeOrgId, currentStudentId]);

  // Determine current active event
  const currentEvent = useMemo(() => {
    if (officerEvents.length === 0) return null;
    return officerEvents.find((e) => e.id === selectedEventId) || officerEvents[0];
  }, [officerEvents, selectedEventId]);

  const loading = profileLoading || eventsLoading || attendanceLoading || orgsLoading;

  // Filtered student records for active event
  const filteredRecords = useMemo(() => {
    if (!currentEvent) return [];
    const q = (searchQuery || '').toLowerCase();
    return currentEvent.records.filter((rec) => {
      const matchesSearch =
        (rec.studentName || '').toLowerCase().includes(q) ||
        (rec.studentId || '').toLowerCase().includes(q) ||
        (rec.course || '').toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || rec.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [currentEvent, searchQuery, statusFilter]);

  // Flagged records for current event
  const flaggedEntries = useMemo(() => {
    if (!currentEvent) return [];
    return currentEvent.records.filter((r) => r.status === 'flagged' || !!r.flaggedReason);
  }, [currentEvent]);

  // Scan activity feed
  const scanActivity = useMemo(() => {
    if (!currentEvent) return [];
    return [...currentEvent.records]
      .filter((r) => r.checkInTime || r.checkOutTime)
      .slice(0, 10);
  }, [currentEvent]);

  const exportCSV = () => {
    if (!currentEvent || currentEvent.records.length === 0) return;
    const headers = ['Student ID', 'Student Name', 'Check-In Time', 'Check-Out Time', 'Status', 'Notes'];
    const rows = currentEvent.records.map((r) => [
      `"${r.studentId}"`,
      `"${r.studentName}"`,
      `"${r.checkInTime || ''}"`,
      `"${r.checkOutTime || ''}"`,
      `"${r.status}"`,
      `"${r.flaggedReason || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${currentEvent.title.replace(/[^a-z0-9]/gi, '_')}_attendance.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusColors = {
    'checked-in': 'bg-[#639922] text-white',
    'checked-out': 'bg-[#888780] text-white',
    'absent': 'bg-[#E24B4A] text-white',
    'flagged': 'bg-[#BA7517] text-white',
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#7F77DD] mb-3" />
        <p className="text-gray-500 text-sm font-medium">Loading attendance logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[#888780] text-[13px] mb-1">Dashboard &gt; Attendance Logs</div>
          <h1 className="text-[#001A4D] text-[24px] font-bold">Attendance Logs</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Viewing events hosted or created by your organization with active attendance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            disabled={!currentEvent || currentEvent.records.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 border border-[#E0E0E0] text-[#001A4D] rounded-lg text-[14px] font-medium hover:bg-[#F8F8F8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {officerEvents.length === 0 ? (
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-12 text-center">
          <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-[#001A4D] font-bold text-lg mb-1">No Attendance Logs Found</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            There are no events hosted by or created for your active organization that have QR attendance enabled or attendance logs scanned yet.
          </p>
        </div>
      ) : (
        <>
          {/* Event Selector Carousel/Tabs */}
          <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Select Event</p>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {officerEvents.map((evt) => (
                <button
                  key={evt.id}
                  onClick={() => setSelectedEventId(evt.id)}
                  className={`px-4 py-2.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                    currentEvent?.id === evt.id
                      ? 'bg-[#7F77DD] text-white shadow-sm'
                      : 'bg-[#F8F8F8] text-[#888780] hover:bg-[#EEEDFE]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{evt.title}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      currentEvent?.id === evt.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {evt.checkedIn} attended
                  </span>
                </button>
              ))}
            </div>
          </div>

          {currentEvent && (
            <div className="flex gap-6">
              {/* Main Content Area */}
              <div className="flex-1 space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white border border-[#E0E0E0] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#888780] text-[13px]">Total Registered</span>
                      <Users className="w-5 h-5 text-[#888780]" />
                    </div>
                    <div className="text-[#001A4D] text-[24px] font-bold">{currentEvent.registered}</div>
                  </div>

                  <div className="bg-white border border-[#E0E0E0] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#888780] text-[13px]">Checked In</span>
                      <UserCheck className="w-5 h-5 text-[#639922]" />
                    </div>
                    <div className="text-[#639922] text-[24px] font-bold">{currentEvent.checkedIn}</div>
                  </div>

                  <div className="bg-white border border-[#E0E0E0] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#888780] text-[13px]">Checked Out</span>
                      <UserMinus className="w-5 h-5 text-[#888780]" />
                    </div>
                    <div className="text-[#888780] text-[24px] font-bold">{currentEvent.checkedOut}</div>
                  </div>

                  <div className="bg-white border border-[#E0E0E0] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#888780] text-[13px]">Absent</span>
                      <UserX className="w-5 h-5 text-[#E24B4A]" />
                    </div>
                    <div className="text-[#E24B4A] text-[24px] font-bold">{currentEvent.absent}</div>
                  </div>
                </div>

                {/* Filters & Table Container */}
                <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
                  {/* Table Toolbar */}
                  <div className="p-4 border-b border-[#E0E0E0] bg-gray-50 flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search student name, ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#7F77DD] focus:border-transparent bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'checked-in', label: 'Checked In' },
                        { id: 'checked-out', label: 'Checked Out' },
                        { id: 'absent', label: 'Absent' },
                        { id: 'flagged', label: 'Flagged' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setStatusFilter(tab.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            statusFilter === tab.id
                              ? 'bg-[#001A4D] text-white'
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Attendance Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#F8F8F8] border-b border-[#E0E0E0]">
                        <tr>
                          <th className="px-5 py-3 text-left text-[#888780] text-[12px] font-bold uppercase tracking-wider">
                            Student
                          </th>
                          <th className="px-5 py-3 text-left text-[#888780] text-[12px] font-bold uppercase tracking-wider">
                            Student ID
                          </th>
                          <th className="px-5 py-3 text-left text-[#888780] text-[12px] font-bold uppercase tracking-wider">
                            Check-In
                          </th>
                          <th className="px-5 py-3 text-left text-[#888780] text-[12px] font-bold uppercase tracking-wider">
                            Check-Out
                          </th>
                          <th className="px-5 py-3 text-left text-[#888780] text-[12px] font-bold uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E0E0E0]">
                        {filteredRecords.map((record) => (
                          <tr key={record.id} className="hover:bg-[#EEEDFE] transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-[#7F77DD] rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                                  {record.avatar}
                                </div>
                                <div>
                                  <span className="text-[#001A4D] text-[13px] font-medium block">
                                    {record.studentName}
                                  </span>
                                  {record.flaggedReason && (
                                    <span className="text-amber-600 text-[11px] font-medium block">
                                      Note: {record.flaggedReason}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-[#888780] text-[13px] font-mono">{record.studentId}</td>
                            <td className="px-5 py-4 text-[#001A4D] text-[13px]">{record.checkInTime || '—'}</td>
                            <td className="px-5 py-4 text-[#001A4D] text-[13px]">{record.checkOutTime || '—'}</td>
                            <td className="px-5 py-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize ${
                                  statusColors[record.status]
                                }`}
                              >
                                {record.status.replace('-', ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {filteredRecords.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm">
                              No attendance records match your search criteria.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-5 py-4 border-t border-[#E0E0E0] flex items-center justify-between">
                    <p className="text-[#888780] text-[13px]">
                      Showing {filteredRecords.length} of {currentEvent.records.length} records
                    </p>
                  </div>
                </div>

                {/* Flagged Section Drawer */}
                <div
                  className={`bg-white border-2 ${
                    showFlagged ? 'border-[#BA7517]' : 'border-[#E0E0E0]'
                  } rounded-xl overflow-hidden`}
                >
                  <button
                    onClick={() => setShowFlagged(!showFlagged)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#FEF3C7] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-[#BA7517]" />
                      <span className="text-[#BA7517] text-[14px] font-bold">
                        ⚠ Flagged Entries ({flaggedEntries.length})
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-[#BA7517] transition-transform ${
                        showFlagged ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {showFlagged && (
                    <div className="border-t border-[#BA7517]">
                      <table className="w-full">
                        <thead className="bg-[#FEF3C7] border-b border-[#BA7517]">
                          <tr>
                            <th className="px-5 py-3 text-left text-[#BA7517] text-[12px] font-bold uppercase">
                              Student
                            </th>
                            <th className="px-5 py-3 text-left text-[#BA7517] text-[12px] font-bold uppercase">
                              Reason
                            </th>
                            <th className="px-5 py-3 text-left text-[#BA7517] text-[12px] font-bold uppercase">
                              Time
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E0E0E0]">
                          {flaggedEntries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-[#FEF3C7]/20">
                              <td className="px-5 py-4 text-[#001A4D] text-[13px] font-medium">
                                {entry.studentName}
                              </td>
                              <td className="px-5 py-4 text-[#888780] text-[13px]">
                                {entry.flaggedReason || 'Flagged scan anomaly'}
                              </td>
                              <td className="px-5 py-4 text-[#888780] text-[13px]">
                                {entry.checkInTime || entry.checkOutTime || 'N/A'}
                              </td>
                            </tr>
                          ))}
                          {flaggedEntries.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-5 py-6 text-center text-gray-400 text-sm">
                                No flagged entries for this event.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar: Scan Activity Feed */}
              <div className="w-[280px] bg-white border border-[#E0E0E0] rounded-xl p-5 h-fit sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[#001A4D] text-[14px] font-bold">Scan Activity Feed</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#639922] rounded-full animate-pulse" />
                    <span className="text-[#639922] text-[11px] font-medium">Live</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {scanActivity.map((scan) => (
                    <div
                      key={scan.id}
                      className="flex items-start gap-3 pb-3 border-b border-[#E0E0E0] last:border-0"
                    >
                      <div className="w-8 h-8 bg-[#7F77DD] rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                        {scan.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#001A4D] text-[13px] font-medium truncate">{scan.studentName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              scan.status === 'checked-out'
                                ? 'bg-[#888780] text-white'
                                : 'bg-[#639922] text-white'
                            }`}
                          >
                            {scan.status === 'checked-out' ? 'Check-Out' : 'Check-In'}
                          </span>
                          <span className="text-[#888780] text-[11px]">
                            {scan.checkInTime || scan.checkOutTime || 'Recently'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {scanActivity.length === 0 && (
                    <p className="text-gray-400 text-xs text-center py-4">No recent scans recorded.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

