import { RefreshCw, Download, Clock, UserCheck, UserX, CircleCheck } from 'lucide-react';
import { StudentDocument } from '../../../modules/students/types/student.types';
import { SemesterDocument } from '../../../modules/academic/types/academic.types';
import { getMillis } from '../../../modules/students/utils/date.utils';
import { formatAppDate, isDeadlinePassed } from '../../../utils/date';

interface RegistryDashboardProps {
  onNavigate: (view: string, studentIdOrSearch?: string) => void;
  categorizedStudents: {
    pending: StudentDocument[];
    active: StudentDocument[];
    inactive: StudentDocument[];
    archived: StudentDocument[];
    reenrollment: StudentDocument[];
  };
  activeSemester?: SemesterDocument;
  activeCollegePeriod?: SemesterDocument;
  activeShsPeriod?: SemesterDocument;
  allStudents: StudentDocument[];
}

export default function RegistryDashboard({
  onNavigate,
  categorizedStudents,
  activeCollegePeriod,
  activeShsPeriod,
  allStudents,
}: RegistryDashboardProps) {
  const { pending, active, inactive, reenrollment } = categorizedStudents;

  // Determine if deadlines have passed
  const isCollegePassed = isDeadlinePassed(activeCollegePeriod?.reenrollDeadline);
  const isShsPassed = isDeadlinePassed(activeShsPeriod?.reenrollDeadline);

  // If both deadlines passed or periods don't exist, hide the card completely
  const hasActiveReenrollmentCard =
    (activeCollegePeriod && !isCollegePassed) || (activeShsPeriod && !isShsPassed);

  // Calculate College Breakdown
  const collegeStudents = active.filter(
    (s) =>
      s.academicLevel === 'COLLEGE' ||
      (!s.academicLevel && !String(s.semester).includes('Trimester') && s.yearLevel !== 'Grade 11' && s.yearLevel !== 'Grade 12')
  );
  const collegeConfirmed = collegeStudents.filter(
    (s) =>
      activeCollegePeriod &&
      s.schoolYear === activeCollegePeriod.academicYear &&
      (s.term || s.semester) === activeCollegePeriod.semester
  ).length;
  const collegeUnconfirmed = collegeStudents.length - collegeConfirmed;

  // Calculate SHS Breakdown
  const shsStudents = active.filter(
    (s) =>
      s.academicLevel === 'SHS' ||
      String(s.semester).includes('Trimester') ||
      s.yearLevel === 'Grade 11' ||
      s.yearLevel === 'Grade 12'
  );
  const shsConfirmed = shsStudents.filter(
    (s) =>
      activeShsPeriod &&
      s.schoolYear === activeShsPeriod.academicYear &&
      (s.term || s.semester) === activeShsPeriod.semester
  ).length;
  const shsUnconfirmed = shsStudents.length - shsConfirmed;

  // Top 5 pending verification
  const pendingQueue = pending.slice(0, 5).map(student => {
    // elapsed time
    const createdAtMs = getMillis(student.createdAt);
    const diff = createdAtMs ? Math.max(0, Date.now() - createdAtMs) : 0;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    let submitted = '';
    if (!createdAtMs) submitted = 'Recently';
    else if (days > 0) submitted = `${days} day${days > 1 ? 's' : ''} ago`;
    else if (hours > 0) submitted = `${hours} hour${hours > 1 ? 's' : ''} ago`;
    else submitted = 'Recently';

    return {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      studentId: student.studentId,
      course: student.courseCode,
      year: student.yearLevel,
      submitted,
      avatar: (student.firstName?.charAt(0) || 'S') + (student.lastName?.charAt(0) || 'T')
    };
  });

  // Recent activity
  const recentActivity = [...allStudents]
    .sort((a, b) => getMillis(b.updatedAt) - getMillis(a.updatedAt))
    .slice(0, 5)
    .map(student => {
      let action = '';
      let type = '';
      switch (student.status) {
        case 'ACTIVE': action = `${student.firstName} ${student.lastName} — Account Active`; type = 'approved'; break;
        case 'RETURNED': action = `${student.firstName} ${student.lastName} — Correction Requested`; type = 'returned'; break;
        case 'PENDING': action = `${student.firstName} ${student.lastName} — Pending Verification`; type = 'blue'; break;
        case 'INACTIVE': action = `${student.firstName} ${student.lastName} — Account Inactive`; type = 'blue'; break;
        case 'ARCHIVED': action = `${student.firstName} ${student.lastName} — Account Archived`; type = 'blue'; break;
        default: action = `${student.firstName} ${student.lastName} — Status Updated`; type = 'blue'; break;
      }
      
      const updatedAtMs = getMillis(student.updatedAt);
      const diff = updatedAtMs ? Math.max(0, Date.now() - updatedAtMs) : 0;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      let timeString = '';
      if (!updatedAtMs) timeString = 'Just now';
      else if (days > 0) timeString = `${days} day${days > 1 ? 's' : ''} ago`;
      else if (hours > 0) timeString = `${hours} hour${hours > 1 ? 's' : ''} ago`;
      else if (minutes > 0) timeString = `${minutes} min ago`;
      else timeString = 'Just now';

      return { action, type, time: timeString };
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Student Registry</h2>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-2.5 bg-[#001A4D] text-white rounded-lg font-medium hover:bg-[#001A4D]/90 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Registry
          </button>
        </div>
      </div>

      {/* Semester Re-enrollment Status Banner (Hidden if all deadlines passed) */}
      {hasActiveReenrollmentCard && (
        <div className="bg-gradient-to-r from-[#001A4D] via-[#002B7F] to-[#0E4EBD] rounded-2xl p-6 border-l-8 border-[#FFD41C] text-white shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 bg-[#FFD41C] text-[#001A4D] rounded-full text-xs font-bold uppercase tracking-wider">
                  Re-enrollment In Progress
                </span>
              </div>
              <h3 className="text-xl font-bold">Academic Period Enrollment Status</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* College Students Breakdown */}
            {activeCollegePeriod && !isCollegePassed && (
              <div className="bg-white/10 backdrop-blur-xs rounded-xl p-4 border border-white/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-base text-[#FFD41C]">College Department</span>
                  <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-medium">
                    {activeCollegePeriod.semester} ({activeCollegePeriod.academicYear})
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 my-3">
                  <div className="bg-black/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">{collegeConfirmed}</div>
                    <div className="text-xs text-white/80">Enrolled</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-amber-300">{collegeUnconfirmed}</div>
                    <div className="text-xs text-white/80">Not Yet Enrolled</div>
                  </div>
                </div>
                <div className="text-xs text-white/90 flex items-center justify-between pt-2 border-t border-white/15">
                  <span>Re-enrollment Deadline:</span>
                  <span className="font-bold text-[#FFD41C]">
                    {formatAppDate(activeCollegePeriod.reenrollDeadline)}
                  </span>
                </div>
              </div>
            )}

            {/* Senior High School Breakdown */}
            {activeShsPeriod && !isShsPassed && (
              <div className="bg-white/10 backdrop-blur-xs rounded-xl p-4 border border-white/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-base text-[#FFD41C]">Senior High School (SHS)</span>
                  <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-medium">
                    {activeShsPeriod.semester} ({activeShsPeriod.academicYear})
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 my-3">
                  <div className="bg-black/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">{shsConfirmed}</div>
                    <div className="text-xs text-white/80">Enrolled</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-amber-300">{shsUnconfirmed}</div>
                    <div className="text-xs text-white/80">Not Yet Enrolled</div>
                  </div>
                </div>
                <div className="text-xs text-white/90 flex items-center justify-between pt-2 border-t border-white/15">
                  <span>Re-enrollment Deadline:</span>
                  <span className="font-bold text-[#FFD41C]">
                    {formatAppDate(activeShsPeriod.reenrollDeadline)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate('pending')}
          className="relative bg-gradient-to-br from-[#EF4444] to-[#F97316] rounded-xl p-6 text-white overflow-hidden group hover:shadow-lg transition-shadow text-left"
        >
          <div className="absolute top-4 right-4 bg-white/20 p-3 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div className="text-5xl font-bold mb-2">{pending.length}</div>
          <div className="text-sm font-medium mb-1">Pending Verification</div>
          <div className="text-xs text-white/80">Awaiting SAO Review</div>
          {pending.length > 0 && (
            <div className="absolute top-4 right-4">
              <span className="px-3 py-1 bg-amber-500 text-white text-xs rounded-full">Review Now</span>
            </div>
          )}
        </button>

        <button
          onClick={() => onNavigate('reenrollment')}
          className="relative bg-gradient-to-br from-[#FFC107] to-[#F59E0B] rounded-xl p-6 text-white overflow-hidden group hover:shadow-lg transition-shadow text-left"
        >
          <div className="absolute top-4 right-4 bg-white/20 p-3 rounded-lg">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div className="text-5xl font-bold mb-2">{reenrollment.length}</div>
          <div className="text-sm font-medium mb-1">Pending Re-enrollment</div>
          <div className="text-xs text-white/80">Awaiting student confirmation</div>
        </button>

        <button
          onClick={() => onNavigate('active')}
          className="relative bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-xl p-6 text-white overflow-hidden group hover:shadow-lg transition-shadow text-left"
        >
          <div className="absolute top-4 right-4 bg-white/20 p-3 rounded-lg">
            <UserCheck className="w-6 h-6" />
          </div>
          <div className="text-5xl font-bold mb-2">{active.length}</div>
          <div className="text-sm font-medium mb-1">Active Students</div>
          <div className="text-xs text-white/80">Currently enrolled</div>
        </button>

        <button
          onClick={() => onNavigate('inactive')}
          className="relative bg-gradient-to-br from-[#001A4D] to-[#0C3C8A] rounded-xl p-6 text-white overflow-hidden group hover:shadow-lg transition-shadow text-left"
        >
          <div className="absolute top-4 right-4 bg-white/20 p-3 rounded-lg">
            <UserX className="w-6 h-6" />
          </div>
          <div className="text-5xl font-bold mb-2">{inactive.length}</div>
          <div className="text-sm font-medium mb-1">Inactive Students</div>
          <div className="text-xs text-white/80">Did not re-enroll</div>
        </button>
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pending Verification Queue Preview */}
        <div className="lg:col-span-7 bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-xs">
          <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-bold">Needs Your Review</h3>
              <span className="px-3 py-1 bg-[#FFD41C] text-[#001A4D] rounded-full text-xs font-bold">
                {pending.length}
              </span>
            </div>
          </div>

          <div className="p-6">
            {pendingQueue.length > 0 ? (
              <div className="space-y-3">
                {pendingQueue.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {student.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-[#001A4D]">{student.name}</div>
                        <div className="text-xs text-gray-500">{student.studentId} • {student.course} • {student.year}</div>
                      </div>
                      <div className="text-xs text-gray-500">{student.submitted}</div>
                    </div>
                    <button
                      onClick={() => onNavigate('pending', student.studentId || student.id)}
                      className="ml-4 px-4 py-2 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                    >
                      Review
                    </button>
                  </div>
                ))}
                {pending.length > 5 && (
                  <button
                    onClick={() => onNavigate('pending')}
                    className="w-full text-[#FFD41C] hover:underline text-sm text-right"
                  >
                    View All {pending.length} Pending →
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <CircleCheck className="w-12 h-12 text-[#0E4EBD] mx-auto mb-4" />
                <div className="font-bold text-[#001A4D] mb-2">All clear</div>
                <div className="text-sm text-gray-500">All registrations reviewed. No pending submissions.</div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-5 bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-bold text-[#001A4D]">Recent Account Activity</h3>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              {recentActivity.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 ${activity.type === 'approved' ? 'bg-green-500' :
                        activity.type === 'rejected' ? 'bg-red-500' :
                          activity.type === 'returned' ? 'bg-amber-500' :
                            activity.type === 'suspended' ? 'bg-red-600' :
                              'bg-blue-500'
                      }`}
                  ></div>
                  <div className="flex-1">
                    <div className="text-sm text-[#001A4D]">{activity.action}</div>
                    <div className="text-xs text-gray-500">{activity.time}</div>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">No recent activity.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
