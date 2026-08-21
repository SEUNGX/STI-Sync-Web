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
  Filter,
  ArrowRight,
  Sparkles,
  School,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { StudentDocument, StudentYearLevel } from '../../../modules/students/types/student.types';
import { SemesterDocument, CourseDocument, SectionDocument } from '../../../modules/academic/types/academic.types';
import { formatTimestampDate } from '../../../modules/students/utils/date.utils';
import { formatAppDate } from '../../../utils/date';
import {
  reEnrollStudent,
  bulkReEnrollStudents,
  inactivateOverdueStudents,
} from '../../../modules/students/services/student.service';
import { useCourses, useSections, useDepartments, useActiveAcademicPeriods } from '../../../modules/academic/hooks/useAcademicStream';
import { exportStudentsToCSV } from '../../../modules/students/utils/export.utils';

interface ReEnrollmentManagementProps {
  students: StudentDocument[];
  activeSemester?: SemesterDocument;
}

type FilterType = 'all' | 'confirmed' | 'pending' | 'overdue';
type TrackFilter = 'ALL' | 'COLLEGE' | 'SHS';

// Standardized Year Level conversion helpers
const YEAR_NUM_MAP: Record<string, number> = {
  'Grade 11': 11,
  'Grade 12': 12,
  '1st Year': 1,
  '2nd Year': 2,
  '3rd Year': 3,
  '4th Year': 4,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
};

const NUM_TO_YEAR_STR: Record<number, string> = {
  11: 'Grade 11',
  12: 'Grade 12',
  1: '1st Year',
  2: '2nd Year',
  3: '3rd Year',
  4: '4th Year',
};

export default function ReEnrollmentManagement({ students, activeSemester: fallbackSemester }: ReEnrollmentManagementProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cascade Academic Filter States
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('All Courses');
  const [selectedYearLevel, setSelectedYearLevel] = useState<string>('All Year Levels');
  const [selectedSectionName, setSelectedSectionName] = useState<string>('All Sections');

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reEnrollTarget, setReEnrollTarget] = useState<StudentDocument | null>(null);
  
  // Bulk promotion target states
  const [targetYearLevel, setTargetYearLevel] = useState<string>('2nd Year');
  const [targetSectionName, setTargetSectionName] = useState<string>('');

  const [processing, setProcessing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Live Academic Streams
  const { data: courses = [] } = useCourses();
  const { data: sections = [] } = useSections();
  const { data: departments = [] } = useDepartments();
  const { activeCollegePeriod, activeShsPeriod, getActivePeriodFor } = useActiveAcademicPeriods();

  const now = Date.now();

  // Active (non-archived) courses & sections
  const activeCourses = useMemo(() => courses.filter((c) => !c.archived), [courses]);
  const activeSections = useMemo(() => sections.filter((s) => !s.archived), [sections]);

  // Map student enrollment status relative to their track's active academic period
  const mappedStudents = useMemo(() => {
    return students.map((student) => {
      const isShs =
        student.academicLevel === 'SHS' ||
        (student.semester && String(student.semester).includes('Trimester'));
      const activePeriod = getActivePeriodFor(isShs ? 'SHS' : 'COLLEGE') || fallbackSemester;

      const isConfirmed =
        activePeriod &&
        student.schoolYear === activePeriod.academicYear &&
        (student.term || student.semester) === activePeriod.semester;

      const deadlineMillis = activePeriod ? new Date(activePeriod.reenrollDeadline).getTime() : now;
      const isOverdue = now > deadlineMillis;

      let status: 'confirmed' | 'pending' | 'overdue' = 'pending';
      if (isConfirmed) status = 'confirmed';
      else if (isOverdue) status = 'overdue';

      const rawYl = String(student.yearLevel || '');
      const yearNum = YEAR_NUM_MAP[rawYl] || (rawYl.includes('11') ? 11 : rawYl.includes('12') ? 12 : 1);
      const yearLabel = NUM_TO_YEAR_STR[yearNum] || rawYl || '1st Year';

      return {
        ...student,
        academicLevel: isShs ? ('SHS' as const) : ('COLLEGE' as const),
        yearLevelNumber: yearNum,
        yearLevelLabel: yearLabel,
        reEnrollStatus: status,
        activePeriod,
      };
    });
  }, [students, getActivePeriodFor, fallbackSemester, now]);

  // Available Sections for Cascade Filter Dropdown based on selected Course & Year Level
  const availableFilterSections = useMemo(() => {
    let list = [...activeSections];

    if (selectedCourseCode !== 'All Courses') {
      const matchedCourse = activeCourses.find((c) => c.code === selectedCourseCode);
      if (matchedCourse) {
        list = list.filter((s) => s.courseId === matchedCourse.id);
      }
    }

    if (selectedYearLevel !== 'All Year Levels') {
      const targetYearNum = YEAR_NUM_MAP[selectedYearLevel];
      if (targetYearNum) {
        list = list.filter((s) => Number(s.yearLevel) === targetYearNum);
      }
    }

    const sectionNames = new Set<string>();
    list.forEach((s) => sectionNames.add(s.name));

    // Also include any sections present in student data matching this course & year
    mappedStudents.forEach((s) => {
      const matchCourse = selectedCourseCode === 'All Courses' || s.courseCode === selectedCourseCode;
      const matchYear = selectedYearLevel === 'All Year Levels' || s.yearLevelLabel === selectedYearLevel;
      if (matchCourse && matchYear && s.section) {
        sectionNames.add(s.section);
      }
    });

    return Array.from(sectionNames).sort();
  }, [activeSections, activeCourses, selectedCourseCode, selectedYearLevel, mappedStudents]);

  // Filtered Students Table Data
  const filteredStudents = useMemo(() => {
    return mappedStudents.filter((s) => {
      // 0. Track Filter
      if (trackFilter !== 'ALL' && s.academicLevel !== trackFilter) return false;

      // 1. Status Tab Filter
      if (filter !== 'all' && s.reEnrollStatus !== filter) return false;

      // 2. Cascade Course Filter
      if (selectedCourseCode !== 'All Courses' && s.courseCode !== selectedCourseCode) {
        return false;
      }

      // 3. Cascade Year Level Filter
      if (selectedYearLevel !== 'All Year Levels' && s.yearLevelLabel !== selectedYearLevel) {
        return false;
      }

      // 4. Cascade Section Filter
      if (selectedSectionName !== 'All Sections' && s.section !== selectedSectionName) {
        return false;
      }

      // 5. Search Text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${s.firstName} ${s.middleName || ''} ${s.lastName}`.toLowerCase();
        const sid = (s.studentId || '').toLowerCase();
        const sec = (s.section || '').toLowerCase();
        const course = (s.courseCode || '').toLowerCase();
        if (!fullName.includes(q) && !sid.includes(q) && !sec.includes(q) && !course.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [mappedStudents, trackFilter, filter, selectedCourseCode, selectedYearLevel, selectedSectionName, searchQuery]);

  // Selectable students (only unconfirmed students: pending or overdue)
  const selectableStudents = useMemo(() => {
    return filteredStudents.filter((s) => s.reEnrollStatus !== 'confirmed');
  }, [filteredStudents]);

  // Overall metric counts (independent of course/year filters)
  const confirmedCount = mappedStudents.filter((s) => s.reEnrollStatus === 'confirmed').length;
  const pendingCount = mappedStudents.filter((s) => s.reEnrollStatus === 'pending').length;
  const overdueCount = mappedStudents.filter((s) => s.reEnrollStatus === 'overdue').length;
  const progressPercent = students.length === 0 ? 0 : Math.round((confirmedCount / students.length) * 100);

  // Selected students cohort analysis & conflict detection
  const selectedStudents = useMemo(() => {
    return mappedStudents.filter((s) => selectedIds.includes(s.id));
  }, [mappedStudents, selectedIds]);

  const distinctTracks = useMemo(() => new Set(selectedStudents.map((s) => s.academicLevel)), [selectedStudents]);
  const distinctCourses = useMemo(() => new Set(selectedStudents.map((s) => s.courseCode || s.courseId || 'No Course')), [selectedStudents]);
  const distinctYearLevels = useMemo(() => new Set(selectedStudents.map((s) => s.yearLevelLabel || 'No Year')), [selectedStudents]);
  const distinctSections = useMemo(() => new Set(selectedStudents.map((s) => s.section || 'No Section')), [selectedStudents]);

  const isMixedTracks = distinctTracks.size > 1;
  const isMixedCourses = distinctCourses.size > 1;
  const isMixedYearLevels = distinctYearLevels.size > 1;
  const isMixedSections = distinctSections.size > 1;
  const hasPromotionConflict = isMixedTracks || isMixedCourses || isMixedYearLevels || isMixedSections;

  const cohortTrack = selectedStudents[0]?.academicLevel || (trackFilter !== 'ALL' ? trackFilter : 'COLLEGE');
  const cohortCourseCode = isMixedCourses ? null : selectedStudents[0]?.courseCode;
  const cohortYearLevel = isMixedYearLevels ? null : selectedStudents[0]?.yearLevelLabel;
  const cohortSection = isMixedSections ? null : selectedStudents[0]?.section;

  const availableTargetYearLevels = cohortTrack === 'SHS' ? ['Grade 11', 'Grade 12'] : ['1st Year', '2nd Year', '3rd Year', '4th Year'];

  // Available Target Promoted Sections (for the bulk promotion toolbar)
  const availableTargetSections = useMemo(() => {
    let list = [...activeSections];
    const targetYearNum = YEAR_NUM_MAP[targetYearLevel] || 1;

    // Filter by target year level
    list = list.filter((s) => Number(s.yearLevel) === targetYearNum);

    // If cohort has a specific course, filter by that course
    if (cohortCourseCode) {
      const matchedCourse = activeCourses.find((c) => c.code === cohortCourseCode);
      if (matchedCourse) {
        list = list.filter((s) => s.courseId === matchedCourse.id);
      }
    } else if (selectedCourseCode !== 'All Courses') {
      const matchedCourse = activeCourses.find((c) => c.code === selectedCourseCode);
      if (matchedCourse) {
        list = list.filter((s) => s.courseId === matchedCourse.id);
      }
    }

    return list;
  }, [activeSections, targetYearLevel, cohortCourseCode, selectedCourseCode, activeCourses]);

  // Checkbox selection handlers (strictly unconfirmed students)
  const toggleSelectAll = () => {
    if (selectedIds.length === selectableStudents.length && selectableStudents.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableStudents.map((s) => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    const student = mappedStudents.find((s) => s.id === id);
    if (student?.reEnrollStatus === 'confirmed') return; // Do not allow selecting confirmed students
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // Bulk Re-enrollment with Target Section and Year Level Promotion
  const handleBulkReEnroll = async () => {
    if (selectedIds.length === 0) return;
    if (hasPromotionConflict) {
      alert('Cannot bulk promote: Selected students belong to mixed courses, year levels, or sections. Please select students from a single section cohort.');
      return;
    }

    setProcessing(true);
    try {
      for (const student of selectedStudents) {
        if (student.reEnrollStatus === 'confirmed') continue;

        const activePeriod =
          student.activePeriod ||
          (student.academicLevel === 'SHS' ? activeShsPeriod : activeCollegePeriod) ||
          fallbackSemester;
        if (!activePeriod) continue;

        await reEnrollStudent(
          student.id,
          activePeriod.academicYear,
          activePeriod.semester as any,
          {
            yearLevel: (targetYearLevel || student.yearLevel || '1st Year') as any,
            section: targetSectionName ? targetSectionName.trim() : student.section,
          }
        );
      }

      const sectionMsg = targetSectionName ? ` into section ${targetSectionName}` : '';
      setActionFeedback(
        `Successfully re-enrolled ${selectedIds.length} student(s)${sectionMsg}!`
      );
      setSelectedIds([]);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to bulk re-enroll students: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // Bulk Inactivate Overdue / Selected
  const handleBulkInactivate = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to mark ${selectedIds.length} selected student(s) as INACTIVE? They will lose access to the mobile app.`)) {
      return;
    }
    setProcessing(true);
    try {
      await inactivateOverdueStudents(selectedIds);
      setActionFeedback(`Marked ${selectedIds.length} student(s) as Inactive.`);
      setSelectedIds([]);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to inactivate students: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = () => {
    exportStudentsToCSV(filteredStudents, 'ReEnrollment_Filtered_List');
  };

  const handleResetCascadeFilters = () => {
    setSelectedCourseCode('All Courses');
    setSelectedYearLevel('All Year Levels');
    setSelectedSectionName('All Sections');
    setSearchQuery('');
  };

  const currentActivePeriod =
    trackFilter === 'SHS'
      ? activeShsPeriod
      : trackFilter === 'COLLEGE'
      ? activeCollegePeriod
      : activeCollegePeriod || activeShsPeriod || fallbackSemester;

  const hasAnyActive = !!(activeCollegePeriod || activeShsPeriod || fallbackSemester);

  if (!hasAnyActive) {
    return (
      <div className="text-center py-16 text-gray-500 bg-white rounded-2xl border border-[#E0E0E0] shadow-sm">
        <School className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-[#001A4D]">No Active Academic Period Found</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
          Please configure and activate an academic semester or trimester in the Academic Settings to manage student re-enrollment.
        </p>
      </div>
    );
  }

  const activeDeadlineMillis = currentActivePeriod?.reenrollDeadline
    ? new Date(currentActivePeriod.reenrollDeadline).getTime()
    : now;
  const daysRemaining = Math.ceil((activeDeadlineMillis - now) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Re-enrollment Management</h2>
          <p className="text-sm text-gray-500">Dashboard → Student Registry → Re-enrollment Management</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="px-5 py-2.5 bg-[#001A4D] text-white rounded-lg font-medium hover:bg-[#001A4D]/90 flex items-center gap-2 text-sm shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            Export Status
          </button>
        </div>
      </div>

      {/* Action feedback toast */}
      {actionFeedback && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-sm text-green-800 animate-in fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span className="font-semibold">{actionFeedback}</span>
        </div>
      )}

      {/* Semester Re-enrollment Progress Card */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-[#001A4D] via-[#002B7F] to-[#0E4EBD] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-bold text-lg">
              {trackFilter === 'SHS'
                ? activeShsPeriod?.label || 'SHS Trimester'
                : trackFilter === 'COLLEGE'
                ? activeCollegePeriod?.label || 'College Semester'
                : 'Campus-Wide Re-enrollment'}
            </h3>
            <span className="px-3 py-1 bg-[#FFD41C] text-[#001A4D] rounded-full text-xs font-bold">
              Active Periods
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/90 font-medium">
            {activeCollegePeriod && (
              <span className="px-2.5 py-1 bg-white/15 rounded-lg border border-white/20">
                College: {activeCollegePeriod.semester} ({activeCollegePeriod.academicYear})
              </span>
            )}
            {activeShsPeriod && (
              <span className="px-2.5 py-1 bg-amber-400/20 text-amber-200 rounded-lg border border-amber-400/30">
                SHS: {activeShsPeriod.semester} ({activeShsPeriod.academicYear})
              </span>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="bg-gray-200 rounded-full h-5 mb-4 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] h-full transition-all flex items-center justify-between px-3"
              style={{ width: `${Math.max(5, progressPercent)}%` }}
            >
              {progressPercent > 10 && (
                <span className="text-white text-xs font-bold">
                  {confirmedCount} / {students.length} confirmed
                </span>
              )}
              <span className="text-white text-xs font-bold ml-auto">{progressPercent}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-xl p-4 text-white text-center shadow-sm">
              <div className="text-3xl font-bold">{confirmedCount}</div>
              <div className="text-xs font-medium opacity-90 mt-0.5">Confirmed Enrolled</div>
            </div>
            <div className="bg-gradient-to-br from-[#FFC107] to-[#F59E0B] rounded-xl p-4 text-white text-center shadow-sm">
              <div className="text-3xl font-bold">{pendingCount}</div>
              <div className="text-xs font-medium opacity-90 mt-0.5">Pending Re-enrollment</div>
            </div>
            <div className="bg-gradient-to-br from-[#EF4444] to-[#F97316] rounded-xl p-4 text-white text-center shadow-sm">
              <div className="text-3xl font-bold">{overdueCount}</div>
              <div className="text-xs font-medium opacity-90 mt-0.5">Overdue Unconfirmed</div>
            </div>
            <div className="bg-gradient-to-br from-[#001A4D] to-[#0C3C8A] rounded-xl p-4 text-white text-center shadow-sm">
              <div className="text-3xl font-bold">{students.length}</div>
              <div className="text-xs font-medium opacity-90 mt-0.5">Total Registry Students</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-gray-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 font-medium">Re-enrollment Status:</span>
              <span className="font-bold text-[#001A4D]">
                College ({activeCollegePeriod?.reenrollDeadline ? formatAppDate(activeCollegePeriod.reenrollDeadline, '—') : '—'}) | SHS ({activeShsPeriod?.reenrollDeadline ? formatAppDate(activeShsPeriod.reenrollDeadline, '—') : '—'})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CASCADE ACADEMIC FILTER BAR (Course ➔ Year Level ➔ Section) */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between border-b border-gray-100 pb-3 gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#0E4EBD]" />
              <h4 className="font-bold text-[#001A4D] text-sm">Filters</h4>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-200">
              {(['ALL', 'COLLEGE', 'SHS'] as TrackFilter[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrackFilter(t)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    trackFilter === t
                      ? 'bg-[#001A4D] text-[#FFD41C] shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t === 'ALL' ? 'All Tracks' : t === 'COLLEGE' ? 'College' : 'SHS'}
                </button>
              ))}
            </div>
          </div>
          {(selectedCourseCode !== 'All Courses' || selectedYearLevel !== 'All Year Levels' || selectedSectionName !== 'All Sections' || searchQuery || trackFilter !== 'ALL') && (
            <button
              onClick={() => {
                setTrackFilter('ALL');
                handleResetCascadeFilters();
              }}
              className="text-xs text-[#0E4EBD] hover:underline font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Course Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
              1. Course / Program
            </label>
            <select
              value={selectedCourseCode}
              onChange={(e) => {
                setSelectedCourseCode(e.target.value);
                setSelectedSectionName('All Sections'); // reset section on course change
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none bg-white text-gray-800 font-medium"
            >
              <option value="All Courses">All Courses</option>
              {activeCourses.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Year Level Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
              2. Year Level
            </label>
            <select
              value={selectedYearLevel}
              onChange={(e) => {
                setSelectedYearLevel(e.target.value);
                setSelectedSectionName('All Sections'); // reset section on year change
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none bg-white text-gray-800 font-medium"
            >
              <option value="All Year Levels">All Year Levels</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
              <option value="3rd Year">3rd Year</option>
              <option value="4th Year">4th Year</option>
            </select>
          </div>

          {/* 3. Section Filter (Bound to Course & Year Level) */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
              3. Current Section
            </label>
            <select
              value={selectedSectionName}
              onChange={(e) => setSelectedSectionName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none bg-white text-gray-800 font-medium"
            >
              <option value="All Sections">All Sections</option>
              {availableFilterSections.map((secName) => (
                <option key={secName} value={secName}>
                  {secName}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Instant Search */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
              4. Search Students
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, ID, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Filter context hint */}
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 pt-1">
          <span>
            Displaying <strong>{filteredStudents.length}</strong> student(s) matching your academic filters.
          </span>
          {selectedSectionName !== 'All Sections' && (
            <span className="text-[#0E4EBD] font-semibold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
              Section Scope: {selectedSectionName}
            </span>
          )}
        </div>
      </div>

      {/* Main Table & Selection Hub */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-sm">
        {/* Status Filter Tabs */}
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === 'all'
                  ? 'bg-[#001A4D] text-[#FFD41C] shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Students{' '}
              <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-mono">
                {mappedStudents.length}
              </span>
            </button>
            <button
              onClick={() => setFilter('confirmed')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === 'confirmed'
                  ? 'bg-[#001A4D] text-[#FFD41C] shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Confirmed{' '}
              <span className="ml-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-mono font-bold">
                {confirmedCount}
              </span>
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === 'pending'
                  ? 'bg-[#001A4D] text-[#FFD41C] shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Pending{' '}
              <span className="ml-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-mono font-bold">
                {pendingCount}
              </span>
            </button>
            <button
              onClick={() => setFilter('overdue')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === 'overdue'
                  ? 'bg-[#001A4D] text-[#FFD41C] shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Overdue{' '}
              <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-mono font-bold">
                {overdueCount}
              </span>
            </button>
          </div>
        </div>

        {/* TARGETED BATCH ACTION TOOLBAR (When students are selected) */}
        {selectedIds.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 via-slate-50 to-white px-6 py-4 border-b border-[#0E4EBD]/30 flex flex-col gap-3 animate-in slide-in-from-top-2">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#001A4D] text-[#FFD41C] font-bold flex items-center justify-center text-xs shadow-xs">
                  {selectedIds.length}
                </div>
                <div>
                  <span className="text-xs font-bold text-[#001A4D] block">
                    {selectedIds.length} unconfirmed student(s) selected
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {hasPromotionConflict
                      ? '⚠️ Mixed cohort selected — resolve conflict to enable bulk promotion'
                      : `Cohort: ${cohortCourseCode || 'Program'} · ${cohortYearLevel || 'Year'} · ${cohortSection || 'Section'}`}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Target Year Level */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-700">Target Year:</span>
                  <select
                    value={targetYearLevel}
                    onChange={(e) => {
                      setTargetYearLevel(e.target.value);
                      setTargetSectionName('');
                    }}
                    disabled={hasPromotionConflict}
                    className="px-2.5 py-1.5 text-xs font-bold border border-blue-300 rounded-lg bg-white text-[#001A4D] focus:ring-2 focus:ring-[#0E4EBD] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {availableTargetYearLevels.map((yl) => (
                      <option key={yl} value={yl}>{yl}</option>
                    ))}
                  </select>
                </div>

                {/* Target Section Selection */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-700">Target Section:</span>
                  <select
                    value={targetSectionName}
                    onChange={(e) => setTargetSectionName(e.target.value)}
                    disabled={hasPromotionConflict}
                    className="px-2.5 py-1.5 text-xs font-bold border border-blue-300 rounded-lg bg-white text-[#001A4D] focus:ring-2 focus:ring-[#0E4EBD] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <option value="">Keep / Inherit Section</option>
                    {availableTargetSections.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bulk Re-enroll Action */}
                <button
                  onClick={handleBulkReEnroll}
                  disabled={processing || hasPromotionConflict}
                  className="px-4 py-2 bg-[#001A4D] text-[#FFD41C] text-xs font-bold rounded-lg hover:bg-[#001A4D]/90 flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title={hasPromotionConflict ? 'Cannot bulk promote mixed cohorts. Select students from the same section.' : 'Confirm re-enrollment and promote cohort'}
                >
                  {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Confirm Re-enrollment ({selectedIds.length})
                </button>

                {/* Bulk Inactivate Action */}
                <button
                  onClick={handleBulkInactivate}
                  disabled={processing}
                  className="px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                  title="Mark selected overdue students as Inactive"
                >
                  <UserX className="w-3.5 h-3.5" />
                  Inactivate Selected
                </button>

                <button
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-gray-500 hover:text-gray-800 underline font-medium ml-1 cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Conflict Warning Banner */}
            {hasPromotionConflict && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-bold">Cannot Bulk Promote: Mixed Cohort Detected</p>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    Selected students belong to:
                    {isMixedTracks && <span className="font-semibold block">• Multiple Academic Tracks ({Array.from(distinctTracks).join(', ')})</span>}
                    {isMixedCourses && <span className="font-semibold block">• Multiple Programs ({Array.from(distinctCourses).join(', ')})</span>}
                    {isMixedYearLevels && <span className="font-semibold block">• Multiple Year Levels ({Array.from(distinctYearLevels).join(', ')})</span>}
                    {isMixedSections && <span className="font-semibold block">• Multiple Sections ({Array.from(distinctSections).join(', ')})</span>}
                  </p>
                  <p className="text-[11px] text-amber-700 italic">
                    Bulk promotion applies a single target year & section to the entire batch. Please select students from the same section and program, or use the individual <strong>Re-enroll</strong> button on each row for irregular or course-shifting students.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Students Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-bold text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={selectableStudents.length > 0 && selectedIds.length === selectableStudents.length}
                    onChange={toggleSelectAll}
                    disabled={selectableStudents.length === 0}
                    className="w-4 h-4 rounded accent-[#0E4EBD] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title={selectableStudents.length === 0 ? "No unconfirmed students to select" : "Select all unconfirmed students"}
                  />
                </th>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">Student ID</th>
                <th className="px-6 py-3.5">Course & Year</th>
                <th className="px-6 py-3.5">Section</th>
                <th className="px-6 py-3.5">Re-enrollment Status</th>
                <th className="px-6 py-3.5">Last Record Term</th>
                <th className="px-6 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.map((student) => {
                const isSelected = selectedIds.includes(student.id);
                return (
                  <tr
                    key={student.id}
                    className={`hover:bg-blue-50/30 transition-colors ${
                      isSelected ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={student.reEnrollStatus === 'confirmed'}
                        onChange={() => toggleSelectOne(student.id)}
                        className="w-4 h-4 rounded accent-[#0E4EBD] cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                        title={student.reEnrollStatus === 'confirmed' ? 'Student is already enrolled' : 'Select student'}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-full flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden flex-shrink-0 shadow-xs">
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
                          <p className="font-bold text-[#001A4D] leading-tight">
                            {student.firstName} {student.middleName ? `${student.middleName} ` : ''}{student.lastName}
                          </p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold text-gray-700">{student.studentId}</td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-900">{student.courseCode || 'BSIT'}</span>
                      <div className="text-xs text-gray-500 font-medium">{student.yearLevelLabel}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-[#001A4D]">
                      {student.section ? (
                        <span className="px-2.5 py-1 bg-gray-100 rounded-md font-mono text-xs text-gray-800">
                          {student.section}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">No Section</span>
                      )}
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
                    <td className="px-6 py-4 text-xs text-gray-500 font-medium">
                      {student.schoolYear ? `${student.schoolYear} · ${student.semester}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {student.reEnrollStatus !== 'confirmed' ? (
                        <button
                          onClick={() => setReEnrollTarget(student)}
                          className="px-3 py-1.5 bg-[#001A4D] text-[#FFD41C] hover:bg-[#001A4D]/90 text-xs font-bold rounded-lg transition-all shadow-xs inline-flex items-center gap-1"
                          title="Individual Re-enrollment & Shifting"
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
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    No students match your academic filters or search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Re-enrollment Modal with Course Shifting & Section Hierarchy */}
      {reEnrollTarget && (
        <IndividualReEnrollModal
          student={reEnrollTarget}
          activeSemester={
            reEnrollTarget.activePeriod ||
            (reEnrollTarget.academicLevel === 'SHS' ? activeShsPeriod : activeCollegePeriod) ||
            fallbackSemester ||
            currentActivePeriod!
          }
          courses={activeCourses}
          sections={activeSections}
          departments={departments}
          onClose={() => setReEnrollTarget(null)}
          onSuccess={() => {
            const reEnrolledStudent = reEnrollTarget;
            setReEnrollTarget(null);
            setActionFeedback(
              `Successfully re-enrolled ${reEnrolledStudent.firstName} ${reEnrolledStudent.lastName}!`
            );
            setTimeout(() => setActionFeedback(null), 4000);
          }}
        />
      )}
    </div>
  );
}

// ─── Individual Re-enroll Modal with Course Shifting & Section Hierarchy ───────
interface IndividualReEnrollModalProps {
  student: StudentDocument;
  activeSemester: SemesterDocument;
  courses: CourseDocument[];
  sections: SectionDocument[];
  departments: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

function IndividualReEnrollModal({
  student,
  activeSemester,
  courses,
  sections,
  departments,
  onClose,
  onSuccess,
}: IndividualReEnrollModalProps) {
  // Course shifting state
  const initialCourse = courses.find((c) => c.id === student.courseId || c.code === student.courseCode) || courses[0];
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourse?.id || '');

  // Year level state
  const initialYearNum = YEAR_NUM_MAP[String(student.yearLevel)] || 1;
  const [yearLevelNumber, setYearLevelNumber] = useState<number>(initialYearNum);

  // Section state
  const [sectionName, setSectionName] = useState<string>(student.section || '');
  const [saving, setSaving] = useState(false);

  // Dynamic sections matching chosen Course and Year Level from settings
  const availableSections = useMemo(() => {
    return sections.filter((s) => {
      const matchCourse = !selectedCourseId || s.courseId === selectedCourseId;
      const matchYear = Number(s.yearLevel) === Number(yearLevelNumber);
      return matchCourse && matchYear;
    });
  }, [sections, selectedCourseId, yearLevelNumber]);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const course = courses.find((c) => c.id === selectedCourseId);
      const department = departments.find((d) => d.id === course?.departmentId);
      const yearLabel = NUM_TO_YEAR_STR[yearLevelNumber] || '1st Year';

      await reEnrollStudent(
        student.id,
        activeSemester.academicYear,
        activeSemester.semester as any,
        {
          yearLevel: yearLabel as any,
          section: sectionName ? sectionName.trim() : student.section,
          courseId: course?.id || student.courseId,
          courseCode: course?.code || student.courseCode,
          courseName: course?.name || student.courseName,
          departmentId: department?.id || student.departmentId,
          departmentName: department?.name || student.departmentName,
        }
      );
      onSuccess();
    } catch (err: any) {
      console.error('Re-enroll failed:', err);
      alert(`Failed to re-enroll student: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[500px] overflow-hidden border border-[#E0E0E0]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#001A4D] via-[#002B7F] to-[#0E4EBD] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-[#FFD41C]" />
            <h3 className="font-bold text-base">Individual Student Re-enrollment</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="font-bold text-[#001A4D] text-base">
              {student.firstName} {student.middleName ? `${student.middleName} ` : ''}{student.lastName}
            </p>
            <p className="text-xs font-mono text-gray-500 mt-0.5">Student ID: {student.studentId}</p>
            <p className="text-xs text-gray-600 mt-1">
              Current Enrollment: <strong className="text-gray-800">{student.courseCode} · {student.section}</strong>
            </p>
          </div>

          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-[#0E4EBD] flex items-center justify-between">
            <span>Enrolling for Active Term:</span>
            <strong className="text-[#001A4D]">{activeSemester.label} ({activeSemester.semester})</strong>
          </div>

          {/* 1. Course Selector (Supports Program Shifting) */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Program / Course (Allows Shifting)
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setSectionName(''); // clear section on course change
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Year Level */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Year Level
            </label>
            <select
              value={yearLevelNumber}
              onChange={(e) => {
                setYearLevelNumber(Number(e.target.value));
                setSectionName(''); // clear section on year change
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none"
            >
              <option value={1}>1st Year</option>
              <option value={2}>2nd Year</option>
              <option value={3}>3rd Year</option>
              <option value={4}>4th Year</option>
            </select>
          </div>

          {/* 3. Section Selector (Bound to selected Course & Year Level) */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Target Section
            </label>
            {availableSections.length > 0 ? (
              <select
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none"
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
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="e.g. BSIT 2101 (Manual input)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none"
              />
            )}
            {availableSections.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">
                No configured sections found for this Course & Year Level in Settings. You may type one manually.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="px-5 py-2.5 bg-[#001A4D] text-[#FFD41C] text-sm font-bold rounded-lg hover:bg-[#001A4D]/90 flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Confirm Re-enrollment
          </button>
        </div>
      </div>
    </div>
  );
}
