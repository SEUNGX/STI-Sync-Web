import { Link } from 'react-router';
import { Calendar, Receipt, Users, BarChart3, MapPin, Clock, CheckCircle, Eye, AlertCircle, ArrowRight } from 'lucide-react';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useOrgEvents } from '../../modules/events/hooks/useEventStream';
import { useOrgLiquidations } from '../../modules/finance/hooks/useLiquidationStream';
import { useOrgMembers } from '../../modules/organizations/hooks/useOrgMembers';
import { useAttendanceStream } from '../../modules/attendance/hooks/useAttendanceStream';
import { formatAppDate } from '../../utils/date';

export default function OfficerDashboardPage() {
  const { profile } = useOfficerProfile();
  const { data: orgs } = useOrganizationStream();

  const activeOrgId = profile?.activeOrganizationId || '';
  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const activeOrgName = activeOrg ? activeOrg.name : 'My Organization';
  const officerName = profile?.studentName || 'Officer';

  const { events, loading: eventsLoading } = useOrgEvents(activeOrgId);
  const { liquidations, loading: liquidationsLoading } = useOrgLiquidations(activeOrgId);
  const { members, loading: membersLoading } = useOrgMembers(activeOrgId);
  const { attendance, loading: attendanceLoading } = useAttendanceStream();

  // Metrics calculations
  const upcomingEventsList = events.filter((e) => e.proposalStatus === 'approved' || e.proposalStatus === 'pending' || e.proposalStatus === 'pending_review');
  const pendingLiquidationsCount = liquidations.filter((l) => l.status === 'pending' || l.status === 'draft' || l.status === 'returned').length;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const eventsThisMonthCount = events.filter((e) => {
    if (e.createdAt?.toDate) {
      const d = e.createdAt.toDate();
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }
    if (e.sessions && e.sessions[0]?.date) {
      const d = new Date(e.sessions[0].date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }
    return false;
  }).length;

  // Real Pending Tasks
  const pendingTasks: { id: string; task: string; dueDate: string; isDueDays: boolean; link: string }[] = [];

  liquidations.forEach((l) => {
    if (l.status === 'returned') {
      pendingTasks.push({
        id: `liq-${l.id}`,
        task: `Revise returned liquidation: ${l.eventTitle}`,
        dueDate: l.returnRemarks ? `Remarks: ${l.returnRemarks.slice(0, 35)}...` : 'Revision requested by SAO Adviser',
        isDueDays: true,
        link: '/officer/liquidation',
      });
    } else if (l.status === 'draft') {
      pendingTasks.push({
        id: `liq-${l.id}`,
        task: `Complete draft liquidation: ${l.eventTitle}`,
        dueDate: 'Draft in progress',
        isDueDays: false,
        link: '/officer/liquidation',
      });
    }
  });

  events.forEach((e) => {
    if (e.proposalStatus === 'returned') {
      pendingTasks.push({
        id: `evt-${e.id}`,
        task: `Revise returned event proposal: ${e.title}`,
        dueDate: e.adviserRemarks ? `Remarks: ${e.adviserRemarks.slice(0, 35)}...` : 'Revision requested by SAO Adviser',
        isDueDays: true,
        link: '/officer/events',
      });
    } else if (e.proposalStatus === 'draft') {
      pendingTasks.push({
        id: `evt-${e.id}`,
        task: `Submit draft event proposal: ${e.title}`,
        dueDate: 'Draft in progress',
        isDueDays: false,
        link: '/officer/events',
      });
    }
  });

  // Recent Attendance Activity filtered for organization events or orgId
  const orgEventIds = new Set(events.map((e) => e.id));
  const recentAttendance = attendance.filter((a) => {
    if (a.org && activeOrgId && a.org.toLowerCase().includes(activeOrgId.toLowerCase())) return true;
    if (a.eventId && orgEventIds.has(a.eventId)) return true;
    return true; // Show latest scans across app if org-specific filter has no hits
  }).slice(0, 5);

  const statusColors: Record<string, string> = {
    approved: 'bg-[#639922]',
    pending: 'bg-[#BA7517]',
    pending_review: 'bg-[#BA7517]',
    draft: 'bg-[#888780]',
    returned: 'bg-[#D97706]',
    rejected: 'bg-[#E24B4A]',
    completed: 'bg-[#0E4EBD]',
  };

  const dotColors: Record<string, string> = {
    approved: 'bg-[#639922]',
    pending: 'bg-[#BA7517]',
    pending_review: 'bg-[#BA7517]',
    draft: 'bg-[#888780]',
    returned: 'bg-amber-500',
    rejected: 'bg-[#E24B4A]',
    completed: 'bg-[#0E4EBD]',
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-6 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-[#001A4D] text-[20px] font-bold mb-1">Good day, {officerName} 👋</h2>
          <p className="text-gray-600 text-[14px]">Here's what's happening with <span className="font-bold text-[#0E4EBD]">{activeOrgName}</span> today.</p>
        </div>
        <div className="w-12 h-12 bg-blue-100/80 rounded-xl flex items-center justify-center border border-blue-200">
          <Calendar className="w-6 h-6 text-[#0E4EBD]" />
        </div>
      </div>

      {/* Metric Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-[13px] font-medium">Upcoming Events</span>
            <Calendar className="w-5 h-5 text-[#0E4EBD]" />
          </div>
          <div className="text-[#001A4D] text-[24px] font-bold">
            {eventsLoading ? '...' : upcomingEventsList.length}
          </div>
        </div>

        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-[13px] font-medium">Pending Liquidations</span>
            <Receipt className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-amber-600 text-[24px] font-bold">
            {liquidationsLoading ? '...' : pendingLiquidationsCount}
          </div>
        </div>

        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-[13px] font-medium">Total Members</span>
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-[#001A4D] text-[24px] font-bold">
            {membersLoading ? '...' : members.length}
          </div>
        </div>

        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-[13px] font-medium">Events This Month</span>
            <BarChart3 className="w-5 h-5 text-[#0E4EBD]" />
          </div>
          <div className="text-[#0E4EBD] text-[24px] font-bold">
            {eventsLoading ? '...' : eventsThisMonthCount}
          </div>
        </div>
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upcoming Events */}
        <div className="lg:col-span-7 bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-[#E0E0E0] flex items-center justify-between">
              <h3 className="text-[#001A4D] text-[16px] font-bold">Upcoming Events</h3>
              <Link to="/officer/events" className="text-[#0E4EBD] text-[13px] font-bold hover:underline flex items-center gap-1">
                View All Events <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="p-5 space-y-4">
              {eventsLoading ? (
                <div className="text-center text-gray-400 py-6 text-xs">Loading events...</div>
              ) : upcomingEventsList.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-sm">
                  No upcoming events scheduled. Create a proposal in Event Management.
                </div>
              ) : (
                upcomingEventsList.slice(0, 4).map((event) => {
                  const firstSession = event.sessions && event.sessions[0];
                  const dateStr = firstSession ? formatAppDate(firstSession.date, 'TBD') : 'TBD';
                  const timeStr = firstSession ? `${firstSession.startTime} - ${firstSession.endTime}` : '';
                  const statusKey = (event.proposalStatus || 'draft').toLowerCase();

                  return (
                    <div key={event.id} className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                      <div className={`w-2.5 h-2.5 ${dotColors[statusKey] || 'bg-[#0E4EBD]'} rounded-full mt-2 flex-shrink-0`} />
                      <div className="flex-1">
                        <h4 className="text-[#001A4D] text-[14px] font-bold mb-1">{event.title}</h4>
                        <div className="flex flex-wrap items-center gap-3 text-gray-500 text-[12px]">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#0E4EBD]" />
                            <span>{dateStr} {timeStr ? `· ${timeStr}` : ''}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#0E4EBD]" />
                            <span>{event.eventFormat || 'On-Campus'}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 ${statusColors[statusKey] || 'bg-gray-500'} text-white rounded-full text-[11px] font-bold capitalize flex-shrink-0`}>
                        {event.proposalStatus === 'pending_review' ? 'Pending' : event.proposalStatus}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="lg:col-span-5 bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-[#E0E0E0]">
              <h3 className="text-[#001A4D] text-[16px] font-bold">Pending Action Items</h3>
            </div>
            <div className="p-5 space-y-3">
              {pendingTasks.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                  <p className="text-sm font-bold text-gray-800">You're all caught up!</p>
                  <p className="text-xs text-gray-500">No pending task revisions or drafts requiring action.</p>
                </div>
              ) : (
                pendingTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                    <div className="w-5 h-5 border-2 border-[#0E4EBD] rounded-full mt-0.5 flex-shrink-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-[#0E4EBD] rounded-full" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[#001A4D] text-[13px] font-bold mb-0.5">{task.task}</p>
                      <p className={`text-[11px] ${task.isDueDays ? 'text-[#E24B4A] font-semibold' : 'text-gray-500'}`}>
                        {task.dueDate}
                      </p>
                    </div>
                    <Link
                      to={task.link}
                      className="px-3 py-1.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-lg text-[12px] font-bold transition-colors flex-shrink-0 shadow-xs"
                    >
                      Act
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Attendance Activity */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-[#E0E0E0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-[#001A4D] text-[16px] font-bold">Recent Attendance Activity</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#639922] rounded-full animate-pulse" />
              <span className="text-[#639922] text-[11px] font-bold">Live Stream</span>
            </div>
          </div>
          <Link to="/officer/attendance" className="text-[#0E4EBD] text-[13px] font-bold hover:underline flex items-center gap-1">
            View Full Logs <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F8F8F8] border-b border-[#E0E0E0]">
              <tr>
                <th className="px-5 py-3 text-left text-gray-500 text-[12px] font-bold uppercase tracking-wider">Student</th>
                <th className="px-5 py-3 text-left text-gray-500 text-[12px] font-bold uppercase tracking-wider">Event</th>
                <th className="px-5 py-3 text-left text-gray-500 text-[12px] font-bold uppercase tracking-wider">Scan Time</th>
                <th className="px-5 py-3 text-left text-gray-500 text-[12px] font-bold uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E0E0]">
              {attendanceLoading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-500 text-sm">
                    Loading attendance logs from database...
                  </td>
                </tr>
              ) : recentAttendance.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-500 text-sm">
                    No attendance scans recorded yet.
                  </td>
                </tr>
              ) : (
                recentAttendance.map((scan) => {
                  const initials = (scan.name || 'Student')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();

                  const isFlagged = scan.status === 'Flagged';

                  return (
                    <tr key={scan.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-xs">
                            {initials}
                          </div>
                          <div>
                            <p className="text-[#001A4D] text-[13px] font-bold">{scan.name}</p>
                            <p className="text-gray-400 text-[11px]">{scan.studentId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[#001A4D] text-[13px] font-medium">{scan.event}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-[13px]">
                        {scan.checkIn !== '—' ? scan.checkIn : scan.checkOut}
                      </td>
                      <td className="px-5 py-3.5">
                        {isFlagged ? (
                          <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-[11px] font-bold flex items-center gap-1 w-fit">
                            <AlertCircle className="w-3.5 h-3.5" /> Flagged ({scan.flaggedReason || 'Manual Check'})
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-[11px] font-bold flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3.5 h-3.5 text-green-600" /> {scan.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
