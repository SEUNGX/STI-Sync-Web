import { useMemo } from 'react';
import { Link } from 'react-router';
import { Calendar, Receipt, Users, MapPin, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useOrgEvents } from '../../modules/events/hooks/useEventStream';
import { useOrgLiquidations } from '../../modules/finance/hooks/useLiquidationStream';
import { useOrgMembers } from '../../modules/organizations/hooks/useOrgMembers';
import { useOrgOfficers } from '../../modules/organizations/hooks/useOrgOfficers';
import { useRoles } from '../../modules/roles/hooks/useRoles';
import { useStudents } from '../../modules/students/hooks/useStudentStream';
import { useActiveAcademicPeriods } from '../../modules/academic/hooks/useAcademicStream';
import { formatAppDate, format12HourTime } from '../../utils/date';

const getTimestampMs = (val: any): number => {
  if (!val) return 0;
  if (typeof val?.toDate === 'function') return val.toDate().getTime();
  if (typeof val?.seconds === 'number') return val.seconds * 1000;
  if (typeof val === 'string' || typeof val === 'number') {
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export default function OfficerDashboardPage() {
  const { profile } = useOfficerProfile();
  const { data: orgs } = useOrganizationStream();
  const { data: roles = [] } = useRoles();
  const { data: students = [], loading: studentsLoading } = useStudents();
  const { activeCollegePeriod, activeShsPeriod, isStudentPendingReEnrollment } = useActiveAcademicPeriods();

  const activeOrgId = profile?.activeOrganizationId || '';
  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const officerName = profile?.studentName || 'Officer';

  const { events, loading: eventsLoading } = useOrgEvents(activeOrgId);
  const { liquidations, loading: liquidationsLoading } = useOrgLiquidations(activeOrgId);
  const { members, loading: membersLoading } = useOrgMembers(activeOrgId);
  const { officers = [] } = useOrgOfficers(activeOrgId);

  // Student lookup map for fast student status and enrollment resolution
  const studentMap = useMemo(() => {
    const map = new Map<string, any>();
    students.forEach((s) => {
      if (s.studentId) map.set(s.studentId.trim().toLowerCase(), s);
      if (s.email) map.set(s.email.trim().toLowerCase(), s);
    });
    return map;
  }, [students]);

  // Resolve active enrolled members (excluding inactive, unapproved, or unenrolled students for this term)
  const activeEnrolledMembersCount = useMemo(() => {
    return members.filter((m) => {
      if (m.status !== 'active') return false;
      const st =
        studentMap.get((m.studentId || '').trim().toLowerCase()) ||
        studentMap.get((m.email || '').trim().toLowerCase());
      if (st) {
        if (st.status !== 'ACTIVE') return false;
        if (isStudentPendingReEnrollment(st)) return false;
      }
      return true;
    }).length;
  }, [members, studentMap, isStudentPendingReEnrollment]);

  // Resolve account owner position (e.g., Adviser, President, Vice President, Secretary)
  const positionTitle = (() => {
    // 1. Explicit adviser flag or role ID
    if (profile?.isAdviser || profile?.activeRoleId?.toLowerCase() === 'adviser') {
      return 'Adviser';
    }

    // 2. Organization adviser match
    if (
      activeOrg?.adviser?.name &&
      profile?.studentName &&
      activeOrg.adviser.name.trim().toLowerCase() === profile.studentName.trim().toLowerCase()
    ) {
      return 'Adviser';
    }

    // 3. Match activeRoleId from profile in roles list
    if (profile?.activeRoleId) {
      const matchedRole = roles.find((r) => r.id === profile.activeRoleId);
      if (matchedRole?.name) return matchedRole.name;
    }

    // 4. Look up current user in org officers collection
    const currentOfficer = officers.find(
      (o) =>
        (profile?.studentId && o.studentId === profile.studentId) ||
        (profile?.email && o.email?.toLowerCase() === profile.email.toLowerCase())
    );

    if (currentOfficer?.roleId) {
      const matchedRole = roles.find((r) => r.id === currentOfficer.roleId);
      if (matchedRole?.name) return matchedRole.name;
    }

    // 5. Check if named as President in organization document
    if (
      activeOrg?.presidentName &&
      profile?.studentName &&
      activeOrg.presidentName.trim().toLowerCase() === profile.studentName.trim().toLowerCase()
    ) {
      return 'President';
    }

    // 6. Readable fallback if activeRoleId is a plain string title
    if (profile?.activeRoleId && profile.activeRoleId.length > 2 && !profile.activeRoleId.includes('-')) {
      return profile.activeRoleId.charAt(0).toUpperCase() + profile.activeRoleId.slice(1);
    }

    return '';
  })();

  // Greeting name with position (e.g., "Adviser Ann Perez" or "President John Paul Gomez")
  const greetingDisplayName = positionTitle
    ? (officerName.toLowerCase().startsWith(positionTitle.toLowerCase())
        ? officerName
        : `${positionTitle} ${officerName}`)
    : officerName;

  // Upcoming events sorted FIFO by creation date (oldest created first)
  const upcomingEventsList = useMemo(() => {
    const list = events.filter(
      (e) =>
        e.proposalStatus === 'approved' ||
        e.proposalStatus === 'pending' ||
        e.proposalStatus === 'pending_review'
    );
    return list.sort((a, b) => getTimestampMs(a.createdAt) - getTimestampMs(b.createdAt));
  }, [events]);

  const pendingLiquidationsCount = liquidations.filter(
    (l) => l.status === 'pending' || l.status === 'draft' || l.status === 'returned'
  ).length;

  // Completed events in the current active semester / trimester
  const completedEventsCurrentSemCount = useMemo(() => {
    const activePeriodIds = new Set<string>();
    if (activeCollegePeriod?.id) activePeriodIds.add(activeCollegePeriod.id);
    if (activeShsPeriod?.id) activePeriodIds.add(activeShsPeriod.id);

    const activeYears = new Set<string>();
    if (activeCollegePeriod?.academicYear) activeYears.add(activeCollegePeriod.academicYear);
    if (activeShsPeriod?.academicYear) activeYears.add(activeShsPeriod.academicYear);

    const activeSemNames = new Set<string>();
    if (activeCollegePeriod?.semester) activeSemNames.add(activeCollegePeriod.semester.toLowerCase());
    if (activeShsPeriod?.semester) activeSemNames.add(activeShsPeriod.semester.toLowerCase());

    return events.filter((e) => {
      const isCompleted =
        e.proposalStatus === 'completed' ||
        (e as any).status === 'completed' ||
        (e as any).status === 'Completed';
      if (!isCompleted) return false;

      if (e.semesterId && activePeriodIds.has(e.semesterId)) return true;
      if (e.schoolYear && activeYears.has(e.schoolYear)) {
        if ((e as any).semester && activeSemNames.has(String((e as any).semester).toLowerCase())) return true;
        return true;
      }
      if (!e.semesterId && !e.schoolYear) return true;
      return false;
    }).length;
  }, [events, activeCollegePeriod, activeShsPeriod]);

  // Real Pending Tasks sorted FIFO by creation date (oldest created first)
  const pendingTasks = useMemo(() => {
    const tasks: { id: string; task: string; dueDate: string; isDueDays: boolean; link: string; createdAtTime: number }[] = [];

    // 1. Returned liquidations (Urgent revisions requested by SAO)
    liquidations.forEach((l) => {
      if (l.status === 'returned') {
        tasks.push({
          id: `liq-${l.id}`,
          task: `Revise returned liquidation: ${l.eventTitle}`,
          dueDate: l.returnRemarks ? `Remarks: ${l.returnRemarks.slice(0, 35)}...` : 'Revision requested by SAO Adviser',
          isDueDays: true,
          link: '/officer/liquidation',
          createdAtTime: getTimestampMs(l.createdAt),
        });
      }
    });

    // 2. Returned event proposals (Urgent revisions requested by SAO)
    events.forEach((e) => {
      if (e.proposalStatus === 'returned') {
        tasks.push({
          id: `evt-${e.id}`,
          task: `Revise returned event proposal: ${e.title}`,
          dueDate: e.adviserRemarks ? `Remarks: ${e.adviserRemarks.slice(0, 35)}...` : 'Revision requested by SAO Adviser',
          isDueDays: true,
          link: '/officer/events',
          createdAtTime: getTimestampMs(e.createdAt),
        });
      }
    });

    // 3. Pending membership applications (Awaiting officer review & approval)
    members.forEach((m) => {
      if (m.status === 'pending') {
        tasks.push({
          id: `mem-${m.id}`,
          task: `Review membership application: ${m.studentName || 'Student'}`,
          dueDate: m.course
            ? `${m.course}${m.year ? ` • Year ${m.year}` : ''} (${m.studentId || 'Pending'})`
            : 'Membership application awaiting approval',
          isDueDays: false,
          link: '/officer/members?tab=pending',
          createdAtTime: getTimestampMs(m.applicationDate || m.createdAt || m.dateJoined),
        });
      }
    });

    // 4. Draft liquidations (In progress)
    liquidations.forEach((l) => {
      if (l.status === 'draft') {
        tasks.push({
          id: `liq-${l.id}`,
          task: `Complete draft liquidation: ${l.eventTitle}`,
          dueDate: 'Draft in progress',
          isDueDays: false,
          link: '/officer/liquidation',
          createdAtTime: getTimestampMs(l.createdAt),
        });
      }
    });

    // 5. Draft event proposals (In progress)
    events.forEach((e) => {
      if (e.proposalStatus === 'draft') {
        tasks.push({
          id: `evt-${e.id}`,
          task: `Submit draft event proposal: ${e.title}`,
          dueDate: 'Draft in progress',
          isDueDays: false,
          link: '/officer/events',
          createdAtTime: getTimestampMs(e.createdAt),
        });
      }
    });

    // Sort FIFO: oldest created first
    return tasks.sort((a, b) => a.createdAtTime - b.createdAtTime);
  }, [liquidations, events, members]);

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
          <h2 className="text-[#001A4D] text-[20px] font-bold">Good day, {greetingDisplayName} 👋</h2>
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
            <span className="text-gray-500 text-[13px] font-medium">Active Members</span>
            <Users className="w-5 h-5 text-[#0E4EBD]" />
          </div>
          <div className="text-[#001A4D] text-[24px] font-bold">
            {membersLoading || studentsLoading ? '...' : activeEnrolledMembersCount}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">Enrolled this term</p>
        </div>

        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-[13px] font-medium">Completed Events</span>
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-emerald-700 text-[24px] font-bold">
            {eventsLoading ? '...' : completedEventsCurrentSemCount}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">In current sem / trimester</p>
        </div>
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upcoming Events (5 rows, FIFO created date) */}
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
                upcomingEventsList.slice(0, 5).map((event) => {
                  const firstSession = event.sessions && event.sessions[0];
                  const dateStr = firstSession ? formatAppDate(firstSession.date, 'TBD') : 'TBD';
                  const timeStr = firstSession && firstSession.startTime ? `${format12HourTime(firstSession.startTime)}${firstSession.endTime ? ` – ${format12HourTime(firstSession.endTime)}` : ''}` : '';
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
                            <span>{event.customVenueName || 'On-Campus'}</span>
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

        {/* Pending Action Items (5 rows, FIFO created date) */}
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
                  <p className="text-xs text-gray-500">No pending task revisions, applications, or drafts requiring action.</p>
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
    </div>
  );
}
