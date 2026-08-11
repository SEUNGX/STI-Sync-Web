import { GraduationCap, Download, Eye, RotateCcw } from 'lucide-react';
import { StudentDocument } from '../../../modules/students/types/student.types';
import { formatTimestampDate } from '../../../modules/students/utils/date.utils';

interface ArchivedGraduatesProps {
  students: StudentDocument[];
}

export default function ArchivedGraduates({ students: archivedStudents }: ArchivedGraduatesProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Archived & Graduates</h2>
          <p className="text-sm text-gray-500">View past students and archived records</p>
        </div>
        <button className="px-4 py-2 bg-[#001A4D] text-white rounded-lg font-medium text-sm hover:bg-[#001A4D]/90 flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export Archive
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-5 h-5 text-gray-600" />
          <p className="text-sm text-gray-700">
            Records here are preserved for historical logs. Students cannot log in and are excluded from active calculations.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Student</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Course</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Archived Date</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Archive Reason</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Status</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {archivedStudents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No archived records found.</td>
              </tr>
            ) : archivedStudents.map((student) => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                      {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-[#001A4D]">{student.firstName} {student.lastName}</div>
                      <div className="text-xs text-gray-500">{student.studentId}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{student.courseCode}</td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {formatTimestampDate(student.updatedAt)}
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">
                    {student.archiveReason || 'Graduated'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-gray-600 text-white rounded-full text-xs font-medium">
                    Archived
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 text-[#0E4EBD] hover:underline text-xs flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      View Record
                    </button>
                    <button className="px-3 py-1.5 border-2 border-[#0E4EBD] text-[#0E4EBD] rounded text-xs font-medium flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" />
                      Restore
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
