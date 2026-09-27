import { useState, useMemo, useEffect } from 'react';
import { Download, RotateCcw, Eye, UserX, Archive, Search } from 'lucide-react';
import { StudentDocument } from '../../../modules/students/types/student.types';
import { formatTimestampDate } from '../../../modules/students/utils/date.utils';
import { exportStudentsToCSV } from '../../../modules/students/utils/export.utils';
import StudentDetailModal from '../../../modules/students/components/StudentDetailModal';
import ArchiveStudentModal from '../../../modules/students/components/ArchiveStudentModal';
import BulkArchiveModal from './BulkArchiveModal';
import ReactivateStudentModal from './ReactivateStudentModal';
import { useAdviserProfile } from '../../../modules/auth/hooks/useAdviserProfile';
import { TablePagination } from '../../../components/common/TablePagination';

interface InactiveSuspendedProps {
  inactiveStudents: StudentDocument[];
  suspendedStudents?: StudentDocument[];
}

export default function InactiveSuspended({ inactiveStudents }: InactiveSuspendedProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal States (Full UI Modals — Zero browser window.confirm)
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<StudentDocument | null>(null);
  const [selectedStudentForArchive, setSelectedStudentForArchive] = useState<StudentDocument | null>(null);
  const [selectedStudentForReactivate, setSelectedStudentForReactivate] = useState<StudentDocument | null>(null);
  const [isBulkArchiveOpen, setIsBulkArchiveOpen] = useState(false);

  const { user, profile } = useAdviserProfile();
  const adminUid = user?.uid || profile?.uid || 'admin';

  // Filtered Students
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return inactiveStudents;
    const q = searchQuery.toLowerCase().trim();
    return inactiveStudents.filter((s) => {
      const fullName = `${s.firstName} ${s.middleName || ''} ${s.lastName}`.toLowerCase();
      const studentId = (s.studentId || '').toLowerCase();
      const course = (s.courseCode || '').toLowerCase();
      const section = (s.section || '').toLowerCase();
      return fullName.includes(q) || studentId.includes(q) || course.includes(q) || section.includes(q);
    });
  }, [inactiveStudents, searchQuery]);

  // Pagination State (8 rows per page standard)
  const PER_PAGE = 8;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PER_PAGE));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filteredStudents.slice(start, start + PER_PAGE);
  }, [filteredStudents, currentPage]);

  // Selected Student Objects for Bulk Action
  const selectedStudentObjects = useMemo(() => {
    return inactiveStudents.filter((s) => selectedIds.includes(s.id));
  }, [inactiveStudents, selectedIds]);

  // Selection helpers (Select on current page)
  const isAllSelected = paginatedStudents.length > 0 && paginatedStudents.every((s) => selectedIds.includes(s.id));
  const isSomeSelected = paginatedStudents.some((s) => selectedIds.includes(s.id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !paginatedStudents.some((s) => s.id === id)));
    } else {
      const paginatedIds = paginatedStudents.map((s) => s.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...paginatedIds])));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleExport = () => {
    exportStudentsToCSV(filteredStudents, 'Inactive_Students_List');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Inactive Students</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Manage students who missed re-enrollment deadlines or need manual archival
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg shadow-xs animate-in fade-in">
              <span className="text-xs font-bold text-amber-900 font-mono">
                {selectedIds.length} selected
              </span>
              <button
                onClick={() => setIsBulkArchiveOpen(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive Selected ({selectedIds.length})
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-amber-800 hover:text-amber-950 underline px-1 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          <button
            onClick={handleExport}
            className="px-4 py-2.5 bg-[#001A4D] text-white rounded-lg font-medium hover:bg-[#0E4EBD] flex items-center gap-2 shadow-xs transition-all text-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export List
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <UserX className="w-5 h-5 text-gray-600 flex-shrink-0" />
          <p className="text-xs text-gray-700 leading-relaxed">
            These students did not confirm re-enrollment before the semester deadline. Their accounts are preserved but they cannot log in. You can reactivate them back to active status, or archive them to transfer their record to the permanent archive.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, ID, or course..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0E4EBD]/20 focus:border-[#0E4EBD] transition-all"
          />
        </div>
      </div>

      {/* Inactive Table */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs font-bold text-gray-700 uppercase border-b border-gray-200">
              <tr>
                <th className="px-4 py-3.5 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isSomeSelected;
                    }}
                    onChange={handleToggleSelectAll}
                    disabled={paginatedStudents.length === 0}
                    className="w-4 h-4 rounded text-[#001A4D] focus:ring-[#0E4EBD] border-gray-300 cursor-pointer"
                    title="Select / Unselect All on Page"
                  />
                </th>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">Course & Year</th>
                <th className="px-6 py-3.5">Section</th>
                <th className="px-6 py-3.5">Inactive Since</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    {searchQuery ? 'No inactive students match your search query.' : 'No inactive students found.'}
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student) => {
                  const isSelected = selectedIds.includes(student.id);
                  return (
                    <tr
                      key={student.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-amber-50/50 hover:bg-amber-50/80' : 'hover:bg-gray-50/80'
                      }`}
                    >
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(student.id)}
                          className="w-4 h-4 rounded text-[#001A4D] focus:ring-[#0E4EBD] border-gray-300 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden shadow-xs flex-shrink-0">
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
                            className="px-2.5 py-1.5 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="View Student Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Info
                          </button>
                          <button
                            onClick={() => setSelectedStudentForReactivate(student)}
                            className="px-2.5 py-1.5 border border-green-600 text-green-700 hover:bg-green-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Reactivate to Active Status"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reactivate
                          </button>
                          <button
                            onClick={() => setSelectedStudentForArchive(student)}
                            className="px-2.5 py-1.5 border border-amber-600 text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Archive Student Account"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Standard Bottom Pagination Bar ── */}
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredStudents.length}
          itemsPerPage={PER_PAGE}
          onPageChange={setCurrentPage}
          itemName="inactive students"
        />
      </div>

      {/* ── MODALS (Rich UI Modals) ── */}

      {/* 1. Student Details Inspection Modal */}
      {selectedStudentForDetail && (
        <StudentDetailModal
          student={selectedStudentForDetail}
          onClose={() => setSelectedStudentForDetail(null)}
          readOnly={false}
        />
      )}

      {/* 2. Single Student Archive Modal (with financial clearance pre-flight checks & reasons) */}
      {selectedStudentForArchive && (
        <ArchiveStudentModal
          student={selectedStudentForArchive}
          adminUid={adminUid}
          onClose={() => setSelectedStudentForArchive(null)}
          onSuccess={() => {
            setSelectedStudentForArchive(null);
            setSelectedIds((prev) => prev.filter((id) => id !== selectedStudentForArchive.id));
          }}
        />
      )}

      {/* 3. Bulk Student Archive Modal */}
      <BulkArchiveModal
        selectedStudents={selectedStudentObjects}
        adminUid={adminUid}
        isOpen={isBulkArchiveOpen}
        onClose={() => setIsBulkArchiveOpen(false)}
        onSuccess={() => {
          setIsBulkArchiveOpen(false);
          setSelectedIds([]);
        }}
      />

      {/* 4. Student Reactivation Confirmation Modal */}
      <ReactivateStudentModal
        student={selectedStudentForReactivate}
        isOpen={!!selectedStudentForReactivate}
        onClose={() => setSelectedStudentForReactivate(null)}
        onSuccess={() => {
          setSelectedStudentForReactivate(null);
        }}
      />
    </div>
  );
}
