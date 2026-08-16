import { RefreshCw, Download, Clock, UserCheck, UserX, CircleCheck } from 'lucide-react';
import { StudentDocument } from '../../../modules/students/types/student.types';
import { SemesterDocument } from '../../../modules/academic/types/academic.types';
import { getMillis } from '../../../modules/students/utils/date.utils';

interface RegistryDashboardProps {
  onNavigate: (view: string) => void;
  categorizedStudents: {
    pending: StudentDocument[];
    active: StudentDocument[];
    inactive: StudentDocument[];
    archived: StudentDocument[];
    reenrollment: StudentDocument[];
  };
  activeSemester: SemesterDocument | undefined;
  allStudents: StudentDocument[];
}

export default function RegistryDashboard({ onNavigate, categorizedStudents, activeSemester, allStudents }: RegistryDashboardProps) {
  const { pending, active, inactive, reenrollment } = categorizedStudents;

  // Re-enrollment logic
  const totalExpectedToReenroll = active.length;
  const unconfirmed = reenrollment.length;
  const confirmed = totalExpectedToReenroll - unconfirmed;
  const progressPercent = totalExpectedToReenroll === 0 ? 0 : Math.round((confirmed / totalExpectedToReenroll) * 100);

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
          <p className="text-sm text-gray-500">Dashboard → Student Registry</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-2.5 bg-[#001A4D] text-white rounded-lg font-medium hover:bg-[#001A4D]/90 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Registry
          </button>
        </div>
      </div>

      {/* Semester Rollover Status Banner */}
      {activeSemester && (
        <div className="bg-gradient-to-r from-[#0E4EBD] to-[#1E70E8] rounded-xl p-6 border-l-8 border-[#FFD41C]">
          <div className="text-white">
            <h3 className="text-xl font-bold mb-2">Re-enrollment In Progress — {activeSemester.label}</h3>
            <div className="bg-white/20 rounded-full h-5 mb-3 overflow-hidden">
              <div
                className="bg-[#83358E] h-full transition-all"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-sm mb-4">
              <span>{confirmed} of {totalExpectedToReenroll} students confirmed</span>
              <span className="font-bold">{progressPercent}%</span>
            </div>
            <p className="text-white/90 text-sm mb-4">
              Re-enrollment deadline: {new Date(activeSemester.reenrollDeadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Students who have not confirmed will be automatically set to Inactive.
            </p>
            <div className="flex items-center gap-3">
              <button className="px-6 py-2 bg-[#FFD41C] text-[#001A4D] rounded-lg font-medium hover:bg-[#FFD41C]/90">
                Send Reminder to Unconfirmed Students
              </button>
              <button onClick={() => onNavigate('reenrollment')} className="text-white hover:underline text-sm">
                View Re-enrollment Status →
              </button>
            </div>
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
        <div className="lg:col-span-7 bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
          <div className="bg-[#83358E] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-bold">Needs Your Review</h3>
              <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-bold">
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
                      <div className="w-10 h-10 bg-gradient-to-br from-[#0E4EBD] to-[#83358E] rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {student.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-[#001A4D]">{student.name}</div>
                        <div className="text-xs text-gray-500">{student.studentId} • {student.course} • {student.year}</div>
                      </div>
                      <div className="text-xs text-gray-500">{student.submitted}</div>
                    </div>
                    <button
                      onClick={() => onNavigate('pending')}
                      className="ml-4 px-4 py-2 bg-[#83358E] text-white rounded-lg text-sm font-medium hover:bg-[#83358E]/90"
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
              {recentActivity.map((activity, index) => (
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
            {recentActivity.length > 0 && (
              <button className="mt-4 w-full text-[#0E4EBD] hover:underline text-sm text-center">
                View Full Audit Log →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
