import {
  Bell,
  Download,
  Check,
  Clock,
  AlertTriangle,
  UserCheck,
  UserX,
  Search,
  CheckCircle2,
  X,
  Loader2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { StudentDocument, StudentYearLevel } from '../../../modules/students/types/student.types';
import { SemesterDocument } from '../../../modules/academic/types/academic.types';
import { formatTimestampDate } from '../../../modules/students/utils/date.utils';
import {
  reEnrollStudent,
  bulkReEnrollStudents,
  inactivateOverdueStudents,
} from '../../../modules/students/services/student.service';
import { useSections } from '../../../modules/academic/hooks/useAcademicStream';

interface ReEnrollmentManagementProps {
  students: StudentDocument[];
  activeSemester: SemesterDocument | undefined;
}

type FilterType = 'all' | 'confirmed' | 'pending' | 'overdue';

export default function ReEnrollmentManagement({ students, activeSemester }: ReEnrollmentManagementProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reEnrollTarget, setReEnrollTarget] = useState<StudentDocument | null>(null);
  const [processing, setProcessing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const { data: sections } = useSections();

  const now = Date.now();
  const deadlineMillis = activeSemester ? new Date(activeSemester.reenrollDeadline).getTime() : now;
  const isOverdueGlobally = now > deadlineMillis;

  const mappedStudents = useMemo(() => {
    return students.map((student) => {
      const isConfirmed =
        activeSemester &&
        student.schoolYear === activeSemester.academicYear &&
        student.semester === activeSemester.semester;
      let status: 'confirmed' | 'pending' | 'overdue' = 'pending';
      if (isConfirmed) status = 'confirmed';
      else if (isOverdueGlobally) status = 'overdue';

      return {
        ...student,
        reEnrollStatus: status,
      };
    });
  }, [students, activeSemester, isOverdueGlobally]);

  const confirmedCount = mappedStudents.filter((s) => s.reEnrollStatus === 'confirmed').length;
  const pendingCount = mappedStudents.filter((s) => s.reEnrollStatus === 'pending').length;
  const overdueCount = mappedStudents.filter((s) => s.reEnrollStatus === 'overdue').length;

  const filteredStudents = useMemo(() => {
    return mappedStudents.filter((s) => {
      if (filter !== 'all' && s.reEnrollStatus !== filter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
        const sid = (s.studentId || '').toLowerCase();
        const sec = (s.section || '').toLowerCase();
        if (!fullName.includes(q) && !sid.includes(q) && !sec.includes(q)) return false;
      }
      return true;
    });
  }, [mappedStudents, filter, searchQuery]);

  const progressPercent = students.length === 0 ? 0 : Math.round((confirmedCount / students.length) * 100);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map((s) => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleBulkReEnroll = async () => {
    if (!activeSemester || selectedIds.length === 0) return;
    setProcessing(true);
    try {
      await bulkReEnrollStudents(
        selectedIds,
        activeSemester.academicYear,
        activeSemester.semester as any
      );
      setActionFeedback(`Successfully re-enrolled ${selectedIds.length} students for ${activeSemester.label}!`);
      setSelectedIds([]);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert('Failed to bulk re-enroll students.');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkInactivate = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to mark ${selectedIds.length} students as INACTIVE?`)) return;
    setProcessing(true);
    try {
      await inactivateOverdueStudents(selectedIds);
      setActionFeedback(`Marked ${selectedIds.length} overdue students as Inactive.`);
      setSelectedIds([]);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert('Failed to inactivate students.');
    } finally {
      setProcessing(false);
    }
  };

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
          <button className="px-5 py-2.5 bg-[#83358E] text-white rounded-lg font-medium hover:bg-[#83358E]/90 flex items-center gap-2 text-sm">
            <Bell className="w-4 h-4" />
            Send Bulk Reminder
          </button>
          <button className="px-5 py-2.5 bg-[#001A4D] text-white rounded-lg font-medium hover:bg-[#001A4D]/90 flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" />
            Export Status
          </button>
        </div>
      </div>

      {/* Action feedback toast */}
      {actionFeedback && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-sm text-green-800 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span className="font-medium">{actionFeedback}</span>
        </div>
      )}

      {/* Semester Re-enrollment Progress Card */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-2xs">
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0C3C8A] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-bold text-lg">{activeSemester.label} Re-enrollment</h3>
            <span className="px-3 py-1 bg-[#FFD41C] text-[#001A4D] rounded-full text-xs font-bold">
              Active Term
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-gray-200 rounded-full h-5 mb-4 overflow-hidden">
            <div
              className="bg-[#83358E] h-full transition-all flex items-center justify-between px-3"
              style={{ width: `${progressPercent}%` }}
            >
              {progressPercent > 10 && (
                <span className="text-white text-xs font-medium">
                  {confirmedCount} / {students.length} students confirmed
                </span>
              )}
              <span className="text-white text-xs font-bold ml-auto">{progressPercent}%</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-xl p-4 text-white text-center shadow-xs">
              <div className="text-3xl font-bold">{confirmedCount}</div>
              <div className="text-xs font-medium opacity-90 mt-0.5">Confirmed</div>
            </div>
            <div className="bg-gradient-to-br from-[#FFC107] to-[#F59E0B] rounded-xl p-4 text-white text-center shadow-xs">
              <div className="text-3xl font-bold">{pendingCount}</div>
              <div className="text-xs font-medium opacity-90 mt-0.5">Pending</div>
            </div>
            <div className="bg-gradient-to-br from-[#EF4444] to-[#F97316] rounded-xl p-4 text-white text-center shadow-xs">
              <div className="text-3xl font-bold">{overdueCount}</div>
              <div className="text-xs font-medium opacity-90 mt-0.5">Overdue</div>
            </div>
            <div className="bg-gradient-to-br from-[#001A4D] to-[#0C3C8A] rounded-xl p-4 text-white text-center shadow-xs">
              <div className="text-3xl font-bold">{students.length}</div>
              <div className="text-xs font-medium opacity-90 mt-0.5">Total Enrolled</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Re-enrollment Deadline:</span>
              <span className="font-bold text-[#001A4D]">
                {activeSemester.reenrollDeadline
                  ? new Date(activeSemester.reenrollDeadline).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'}
              </span>
              {!isOverdueGlobally ? (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold">
                  {daysRemaining} days remaining
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded font-semibold">Overdue</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Re-enrollment Status Table & Selection Toolbar */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-2xs">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === 'all'
                  ? 'bg-[#001A4D] text-[#FFD41C] shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All <span className="ml-1.5 px-2 py-0.5 bg-white/20 rounded text-xs">{students.length}</span>
            </button>
            <button
              onClick={() => setFilter('confirmed')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === 'confirmed'
                  ? 'bg-[#001A4D] text-[#FFD41C] shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Confirmed{' '}
              <span className="ml-1.5 px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                {confirmedCount}
              </span>
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === 'pending'
                  ? 'bg-[#001A4D] text-[#FFD41C] shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Pending{' '}
              <span className="ml-1.5 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">
                {pendingCount}
              </span>
            </button>
            <button
              onClick={() => setFilter('overdue')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === 'overdue'
                  ? 'bg-[#001A4D] text-[#FFD41C] shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Overdue{' '}
              <span className="ml-1.5 px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs">
                {overdueCount}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, ID, section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent"
            />
          </div>
        </div>

        {/* Bulk Action Toolbar when items are selected */}
        {selectedIds.length > 0 && (
          <div className="bg-[#F3E8FF] px-6 py-3 border-b border-[#83358E]/20 flex items-center justify-between animate-in slide-in-from-top-2">
            <span className="text-xs font-bold text-[#83358E]">
              {selectedIds.length} student{selectedIds.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleBulkReEnroll}
                disabled={processing}
                className="px-4 py-1.5 bg-[#001A4D] text-[#FFD41C] text-xs font-bold rounded-lg hover:bg-[#001A4D]/90 flex items-center gap-1.5 transition-all shadow-xs"
              >
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                Confirm Re-enrollment ({selectedIds.length})
              </button>
              <button
                onClick={handleBulkInactivate}
                disabled={processing}
                className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-lg hover:bg-red-200 flex items-center gap-1 transition-all"
              >
                <UserX className="w-3.5 h-3.5" />
                Inactivate Selected
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-gray-500 hover:text-gray-800 underline ml-2"
              >
                Deselect All
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs font-bold text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5 text-left w-12">
                  <input
                    type="checkbox"
                    checked={filteredStudents.length > 0 && selectedIds.length === filteredStudents.length}
                    onChange={toggleSelectAll}
                    className="rounded accent-[#83358E]"
                  />
                </th>
                <th className="px-6 py-3.5 text-left">Student</th>
                <th className="px-6 py-3.5 text-left">Student ID</th>
                <th className="px-6 py-3.5 text-left">Course & Section</th>
                <th className="px-6 py-3.5 text-left">Re-enrollment Status</th>
                <th className="px-6 py-3.5 text-left">Last Term</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredStudents.map((student) => {
                const isSelected = selectedIds.includes(student.id);
                return (
                  <tr
                    key={student.id}
                    className={`hover:bg-[#F3E8FF]/30 transition-colors ${
                      isSelected ? 'bg-[#F3E8FF]/40' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(student.id)}
                        className="rounded accent-[#83358E]"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#0E4EBD] to-[#83358E] rounded-full flex items-center justify-center text-white font-bold text-xs">
                          {student.firstName.charAt(0)}
                          {student.lastName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-[#001A4D]">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold text-gray-700">{student.studentId}</td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">
                        {student.courseCode || 'BSIT'}
                      </span>{' '}
                      <span className="text-gray-500 font-mono text-xs">({student.section})</span>
                      <div className="text-[11px] text-gray-400">Year {student.yearLevel}</div>
                    </td>
                    <td className="px-6 py-4">
                      {student.reEnrollStatus === 'confirmed' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                          <Check className="w-3.5 h-3.5" />
                          Confirmed
                        </span>
                      )}
                      {student.reEnrollStatus === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          Pending
                        </span>
                      )}
                      {student.reEnrollStatus === 'overdue' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Overdue
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {student.schoolYear ? `${student.schoolYear} · ${student.semester}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {student.reEnrollStatus !== 'confirmed' ? (
                        <button
                          onClick={() => setReEnrollTarget(student)}
                          className="px-3 py-1.5 bg-[#001A4D] text-[#FFD41C] hover:bg-[#001A4D]/90 text-xs font-bold rounded-lg transition-all shadow-2xs inline-flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Re-enroll
                        </button>
                      ) : (
                        <span className="text-xs text-green-600 font-bold inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Enrolled
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No students matching your filter or search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Re-enroll Confirmation Modal */}
      {reEnrollTarget && (
        <IndividualReEnrollModal
          student={reEnrollTarget}
          activeSemester={activeSemester}
          sections={sections}
          onClose={() => setReEnrollTarget(null)}
          onSuccess={() => {
            setReEnrollTarget(null);
            setActionFeedback(`Successfully re-enrolled ${reEnrollTarget.firstName} ${reEnrollTarget.lastName}!`);
            setTimeout(() => setActionFeedback(null), 4000);
          }}
        />
      )}
    </div>
  );
}

// ─── Individual Re-enroll Modal ────────────────────────────────────────────────
function IndividualReEnrollModal({
  student,
  activeSemester,
  sections,
  onClose,
  onSuccess,
}: {
  student: StudentDocument;
  activeSemester: SemesterDocument;
  sections: Array<{ id: string; name: string; courseId: string; yearLevel: number }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [yearLevel, setYearLevel] = useState<StudentYearLevel>(
    (student.yearLevel || 1) as StudentYearLevel
  );
  const [section, setSection] = useState(student.section || '');
  const [saving, setSaving] = useState(false);

  const availableSections = useMemo(() => {
    return sections.filter((s) => s.yearLevel === yearLevel);
  }, [sections, yearLevel]);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await reEnrollStudent(
        student.id,
        activeSemester.academicYear,
        activeSemester.semester as any,
        {
          yearLevel,
          section: section || student.section,
        }
      );
      onSuccess();
    } catch (err) {
      console.error('Re-enroll failed:', err);
      alert('Failed to re-enroll student.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[460px] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#001A4D] to-[#83358E] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-[#FFD41C]" />
            <h3 className="font-bold text-base">Confirm Student Re-enrollment</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="font-bold text-[#001A4D] text-base">
              {student.firstName} {student.lastName}
            </p>
            <p className="text-xs font-mono text-gray-500 mt-0.5">ID: {student.studentId}</p>
            <p className="text-xs text-gray-600 mt-1">Course: {student.courseName || student.courseCode}</p>
          </div>

          <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-[#83358E]">
            Enrolling into: <strong>{activeSemester.label}</strong> ({activeSemester.semester} · A.Y. {activeSemester.academicYear})
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Year Level
            </label>
            <select
              value={yearLevel}
              onChange={(e) => setYearLevel(Number(e.target.value) as StudentYearLevel)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E]"
            >
              <option value={1}>1st Year</option>
              <option value={2}>2nd Year</option>
              <option value={3}>3rd Year</option>
              <option value={4}>4th Year</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Section
            </label>
            {availableSections.length > 0 ? (
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E]"
              >
                <option value="">Select Section</option>
                {availableSections.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. BSIT 2101"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E]"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="px-5 py-2.5 bg-[#001A4D] text-[#FFD41C] text-sm font-bold rounded-lg hover:bg-[#001A4D]/90 flex items-center gap-2 shadow-xs"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Confirm Re-enrollment
          </button>
        </div>
      </div>
    </div>
  );
}

