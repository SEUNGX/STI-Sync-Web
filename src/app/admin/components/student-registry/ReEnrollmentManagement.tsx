import { Bell, Download, Check, Clock, AlertTriangle, UserX, Edit, ArrowRight, RefreshCw } from 'lucide-react';
import { useState, useMemo } from 'react';
import { StudentDocument } from '../../../modules/students/types/student.types';
import { SemesterDocument } from '../../../modules/academic/types/academic.types';
import { formatTimestampDate } from '../../../modules/students/utils/date.utils';

interface ReEnrollmentManagementProps {
  students: StudentDocument[];
  activeSemester: SemesterDocument | undefined;
}

type FilterType = 'all' | 'confirmed' | 'pending' | 'overdue';

export default function ReEnrollmentManagement({ students, activeSemester }: ReEnrollmentManagementProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const now = Date.now();
  const deadlineMillis = activeSemester ? new Date(activeSemester.reenrollDeadline).getTime() : now;
  const isOverdueGlobally = now > deadlineMillis;

  const mappedStudents = useMemo(() => {
    return students.map(student => {
      const isConfirmed = activeSemester && student.schoolYear === activeSemester.academicYear && student.semester === activeSemester.semester;
      let status: 'confirmed' | 'pending' | 'overdue' = 'pending';
      if (isConfirmed) status = 'confirmed';
      else if (isOverdueGlobally) status = 'overdue';

      return {
        ...student,
        reEnrollStatus: status
      };
    });
  }, [students, activeSemester, isOverdueGlobally]);

  const confirmedCount = mappedStudents.filter(s => s.reEnrollStatus === 'confirmed').length;
  const pendingCount = mappedStudents.filter(s => s.reEnrollStatus === 'pending').length;
  const overdueCount = mappedStudents.filter(s => s.reEnrollStatus === 'overdue').length;

  const filteredStudents = mappedStudents.filter(s => {
    if (filter === 'all') return true;
    return s.reEnrollStatus === filter;
  });

  const progressPercent = students.length === 0 ? 0 : Math.round((confirmedCount / students.length) * 100);

  if (!activeSemester) {
    return (
      <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-[#E0E0E0]">
        No active semester found. Please set an active semester in the Academic Settings.
      </div>
    );
  }

  const daysRemaining = Math.ceil((deadlineMillis - now) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Re-enrollment Management</h2>
          <p className="text-sm text-gray-500">Dashboard → Student Registry → Re-enrollment Management</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-2.5 bg-[#83358E] text-white rounded-lg font-medium hover:bg-[#83358E]/90 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Send Bulk Reminder
          </button>
          <button className="px-6 py-2.5 bg-[#001A4D] text-white rounded-lg font-medium hover:bg-[#001A4D]/90 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Status
          </button>
        </div>
      </div>

      {/* Semester Re-enrollment Progress Card */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0C3C8A] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-bold text-lg">{activeSemester.label} Re-enrollment</h3>
            <span className="px-3 py-1 bg-[#FFD41C] text-[#001A4D] rounded-full text-xs font-bold animate-pulse">
              In Progress
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-gray-200 rounded-full h-5 mb-4 overflow-hidden">
            <div
              className="bg-[#83358E] h-full transition-all flex items-center justify-between px-3"
              style={{ width: `${progressPercent}%` }}
            >
              {progressPercent > 10 && <span className="text-white text-xs font-medium">{confirmedCount} / {students.length} students confirmed</span>}
              <span className="text-white text-xs font-bold ml-auto">{progressPercent}%</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-lg p-4 text-white text-center">
              <div className="text-3xl font-bold">{confirmedCount}</div>
              <div className="text-xs">Confirmed</div>
            </div>
            <div className="bg-gradient-to-br from-[#FFC107] to-[#F59E0B] rounded-lg p-4 text-white text-center">
              <div className="text-3xl font-bold">{pendingCount}</div>
              <div className="text-xs">Pending</div>
            </div>
            <div className="bg-gradient-to-br from-[#EF4444] to-[#F97316] rounded-lg p-4 text-white text-center">
              <div className="text-3xl font-bold">{overdueCount}</div>
              <div className="text-xs">Overdue</div>
            </div>
            <div className="bg-gradient-to-br from-[#001A4D] to-[#0C3C8A] rounded-lg p-4 text-white text-center">
              <div className="text-3xl font-bold">0</div>
              <div className="text-xs">Auto-Inactivated</div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Re-enrollment Deadline:</span>
              <span className="font-bold text-[#001A4D]">
                {new Date(activeSemester.reenrollDeadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              {!isOverdueGlobally ? (
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">{daysRemaining} days remaining</span>
              ) : (
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Overdue</span>
              )}
            </div>
            <button className="text-[#0E4EBD] text-sm hover:underline">Extend Deadline</button>
          </div>
        </div>
      </div>

      {/* Re-enrollment Status Table */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-4">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === 'all' ? 'bg-[#001A4D] text-white border-b-2 border-[#83358E]' : 'text-[#001A4D] hover:bg-gray-50'}`}>
            All <span className="ml-2 px-2 py-0.5 bg-white/20 rounded">{students.length}</span>
          </button>
          <button 
            onClick={() => setFilter('confirmed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === 'confirmed' ? 'bg-[#001A4D] text-white border-b-2 border-[#83358E]' : 'text-[#001A4D] hover:bg-gray-50'}`}>
            Confirmed <span className={`ml-2 px-2 py-0.5 rounded ${filter === 'confirmed' ? 'bg-white/20' : 'bg-green-100 text-green-700'}`}>{confirmedCount}</span>
          </button>
          <button 
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === 'pending' ? 'bg-[#001A4D] text-white border-b-2 border-[#83358E]' : 'text-[#001A4D] hover:bg-gray-50'}`}>
            Pending <span className={`ml-2 px-2 py-0.5 rounded ${filter === 'pending' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}>{pendingCount}</span>
          </button>
          <button 
            onClick={() => setFilter('overdue')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === 'overdue' ? 'bg-[#001A4D] text-white border-b-2 border-[#83358E]' : 'text-[#001A4D] hover:bg-gray-50'}`}>
            Overdue <span className={`ml-2 px-2 py-0.5 rounded ${filter === 'overdue' ? 'bg-white/20' : 'bg-red-100 text-red-700'}`}>{overdueCount}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input type="checkbox" className="rounded text-[#83358E]" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Student</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Student ID</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Course & Section</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Updated At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-[#F3E8FF] transition-colors">
                  <td className="px-6 py-4">
                    <input type="checkbox" className="rounded text-[#83358E]" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-[#0E4EBD] to-[#83358E] rounded-full flex items-center justify-center text-white font-bold text-xs">
                        {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                      </div>
                      <span className="font-medium text-[#001A4D]">{student.firstName} {student.lastName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{student.studentId}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{student.courseCode} - {student.section}</td>
                  <td className="px-6 py-4">
                    {student.reEnrollStatus === 'confirmed' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white rounded-full text-xs font-medium">
                        <Check className="w-3 h-3" />
                        Confirmed
                      </span>
                    )}
                    {student.reEnrollStatus === 'pending' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                    {student.reEnrollStatus === 'overdue' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-[#EF4444] to-[#F97316] text-white rounded-full text-xs font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        Overdue
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {formatTimestampDate(student.updatedAt, '—')}
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No students found for this status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
