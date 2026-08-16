import { useState } from 'react';
import { Download, Send, RotateCcw, Eye, UserX } from 'lucide-react';
import { StudentDocument } from '../../../modules/students/types/student.types';
import { formatTimestampDate } from '../../../modules/students/utils/date.utils';
import { exportStudentsToCSV } from '../../../modules/students/utils/export.utils';
import StudentDetailModal from '../../../modules/students/components/StudentDetailModal';
import { updateStudentStatus } from '../../../modules/students/services/student.service';

interface InactiveSuspendedProps {
  inactiveStudents: StudentDocument[];
  suspendedStudents?: StudentDocument[];
}

export default function InactiveSuspended({ inactiveStudents }: InactiveSuspendedProps) {
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<StudentDocument | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const handleReactivate = async (student: StudentDocument) => {
    const confirm = window.confirm(`Reactivate ${student.firstName} ${student.lastName} back to ACTIVE status?`);
    if (!confirm) return;

    setReactivatingId(student.id);
    try {
      await updateStudentStatus(student.id, 'ACTIVE');
    } catch (err: any) {
      alert(`Failed to reactivate student: ${err.message}`);
    } finally {
      setReactivatingId(null);
    }
  };

  const handleExport = () => {
    exportStudentsToCSV(inactiveStudents, 'Inactive_Students_List');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Inactive Students</h2>
          <p className="text-sm text-gray-500">Dashboard → Student Registry → Inactive Students</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="px-5 py-2.5 bg-[#001A4D] text-white rounded-lg font-medium hover:bg-[#001A4D]/90 flex items-center gap-2 shadow-sm transition-all text-sm"
          >
            <Download className="w-4 h-4" />
            Export List
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <UserX className="w-5 h-5 text-gray-600 flex-shrink-0" />
          <p className="text-sm text-gray-700">
            These students did not confirm re-enrollment before the semester deadline. Their accounts are preserved but they cannot log in. They can be reactivated manually or will reactivate automatically when they confirm re-enrollment for the current semester.
          </p>
        </div>
      </div>

      {/* Inactive Table */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs font-bold text-gray-700 uppercase">
              <tr>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">Course & Year</th>
                <th className="px-6 py-3.5">Section</th>
                <th className="px-6 py-3.5">Inactive Since</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {inactiveStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    No inactive students found.
                  </td>
                </tr>
              ) : (
                inactiveStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden shadow-sm flex-shrink-0">
                          {student.profilePhotoUrl ? (
                            <img
                              src={student.profilePhotoUrl}
                              alt="Profile"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-[#001A4D]">
                            {student.firstName} {student.middleName ? `${student.middleName} ` : ''}{student.lastName}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">{student.studentId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{student.courseCode}</div>
                      <div className="text-xs text-gray-500">{student.yearLevel}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700">{student.section || '—'}</td>
                    <td className="px-6 py-4 text-xs text-gray-500 font-medium">
                      {formatTimestampDate(student.updatedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                        Inactive
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedStudentForDetail(student)}
                          className="px-3 py-1.5 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Info
                        </button>
                        <button
                          onClick={() => handleReactivate(student)}
                          disabled={reactivatingId === student.id}
                          className="px-3 py-1.5 border border-green-600 text-green-700 hover:bg-green-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {reactivatingId === student.id ? 'Reactivating...' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Details Inspection Modal */}
      {selectedStudentForDetail && (
        <StudentDetailModal
          student={selectedStudentForDetail}
          onClose={() => setSelectedStudentForDetail(null)}
          readOnly={false}
        />
      )}
    </div>
  );
}
