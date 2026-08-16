import { useState, useMemo } from 'react';
import { GraduationCap, Download, Eye, RotateCcw, Trash2, Search, Loader2 } from 'lucide-react';
import { StudentDocument } from '../../../modules/students/types/student.types';
import { formatTimestampDate } from '../../../modules/students/utils/date.utils';
import { exportStudentsToCSV } from '../../../modules/students/utils/export.utils';
import StudentDetailModal from '../../../modules/students/components/StudentDetailModal';
import DeleteStudentModal from '../../../modules/students/components/DeleteStudentModal';
import { restoreStudent } from '../../../modules/students/services/student.service';
import { useAdviserProfile } from '../../../modules/auth/hooks/useAdviserProfile';

interface ArchivedGraduatesProps {
  students: StudentDocument[];
}

export default function ArchivedGraduates({ students: archivedStudents }: ArchivedGraduatesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<StudentDocument | null>(null);
  const [selectedStudentForDelete, setSelectedStudentForDelete] = useState<StudentDocument | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { user, profile } = useAdviserProfile();
  const adminUid = user?.uid || profile?.uid || 'admin';

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return archivedStudents;
    const q = searchQuery.toLowerCase().trim();
    return archivedStudents.filter((s) => {
      const fullName = `${s.firstName} ${s.middleName || ''} ${s.lastName}`.toLowerCase();
      const studentId = (s.studentId || '').toLowerCase();
      const course = (s.courseCode || '').toLowerCase();
      return fullName.includes(q) || studentId.includes(q) || course.includes(q);
    });
  }, [archivedStudents, searchQuery]);

  const handleRestore = async (student: StudentDocument) => {
    const confirmRestore = window.confirm(
      `Restore ${student.firstName} ${student.lastName} back to ACTIVE status?`
    );
    if (!confirmRestore) return;

    setRestoringId(student.id);
    try {
      await restoreStudent(student.id, adminUid);
    } catch (err: any) {
      alert(`Failed to restore student: ${err.message}`);
    } finally {
      setRestoringId(null);
    }
  };

  const handleExport = () => {
    exportStudentsToCSV(filteredStudents, 'Archived_Students_Directory');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Archived & Graduates</h2>
          <p className="text-sm text-gray-500">View past students and archived records</p>
        </div>
        <button
          onClick={handleExport}
          className="px-5 py-2.5 bg-[#001A4D] text-white rounded-lg font-medium text-sm hover:bg-[#001A4D]/90 flex items-center gap-2 shadow-sm transition-all"
        >
          <Download className="w-4 h-4" />
          Export Archive
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-5 h-5 text-[#83358E] flex-shrink-0" />
          <p className="text-sm text-gray-700">
            Records here are preserved for historical logs. Students cannot log in to the mobile app. You can restore accounts to Active status or permanently delete records.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archived students by name, student ID, or course..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs font-bold text-gray-700 uppercase">
              <tr>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">Course</th>
                <th className="px-6 py-3.5">Archived Date</th>
                <th className="px-6 py-3.5">Archive Reason</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    No archived student records found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden shadow-sm flex-shrink-0">
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
                    <td className="px-6 py-4 font-medium text-gray-700">{student.courseCode}</td>
                    <td className="px-6 py-4 text-xs text-gray-500 font-medium">
                      {formatTimestampDate(student.archivedAt || student.updatedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                        {student.archiveReason || 'Graduated'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-gray-600 text-white rounded-full text-xs font-semibold">
                        Archived
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedStudentForDetail(student)}
                          className="px-3 py-1.5 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Record
                        </button>
                        <button
                          onClick={() => handleRestore(student)}
                          disabled={restoringId === student.id}
                          className="px-3 py-1.5 border border-[#0E4EBD] text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          {restoringId === student.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          Restore
                        </button>
                        <button
                          onClick={() => setSelectedStudentForDelete(student)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Permanently delete from database"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
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
          readOnly={true}
        />
      )}

      {/* Permanent Deletion Modal */}
      {selectedStudentForDelete && (
        <DeleteStudentModal
          student={selectedStudentForDelete}
          onClose={() => setSelectedStudentForDelete(null)}
          onSuccess={() => setSelectedStudentForDelete(null)}
        />
      )}
    </div>
  );
}
