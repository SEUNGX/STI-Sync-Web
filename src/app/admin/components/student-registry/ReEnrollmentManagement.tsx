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
  GraduationCap,
  BookOpen,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { StudentDocument, StudentYearLevel } from '../../../modules/students/types/student.types';
import { SemesterDocument, CourseDocument, SectionDocument } from '../../../modules/academic/types/academic.types';
import { formatTimestampDate } from '../../../modules/students/utils/date.utils';
import { formatAppDate, isDeadlinePassed } from '../../../utils/date';
import {
  reEnrollStudent,
  bulkReEnrollStudents,
  inactivateOverdueStudents,
  archiveStudent,
  bulkArchiveStudents,
} from '../../../modules/students/services/student.service';
import { auth } from '../../../../services/firebase';
import { useCourses, useSections, useDepartments, useActiveAcademicPeriods } from '../../../modules/academic/hooks/useAcademicStream';
import { exportStudentsToCSV } from '../../../modules/students/utils/export.utils';
import { TablePagination } from '../../../components/common/TablePagination';

interface ReEnrollmentManagementProps {
  students: StudentDocument[];
  activeSemester?: SemesterDocument;
  activeCollegePeriod?: SemesterDocument;
  activeShsPeriod?: SemesterDocument;
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

export default function ReEnrollmentManagement({
  students,
  activeSemester: fallbackSemester,
  activeCollegePeriod: propCollegePeriod,
  activeShsPeriod: propShsPeriod,
}: ReEnrollmentManagementProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cascade Academic Filter States
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('All Programs');
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
  const {
    activeCollegePeriod: streamCollegePeriod,
    activeShsPeriod: streamShsPeriod,
    getActivePeriodFor,
  } = useActiveAcademicPeriods();

  const activeCollegePeriod = propCollegePeriod || streamCollegePeriod;
  const activeShsPeriod = propShsPeriod || streamShsPeriod;

  // Active (non-archived) courses & sections
  const activeCourses = useMemo(() => courses.filter((c) => !c.archived), [courses]);
  const activeSections = useMemo(() => sections.filter((s) => !s.archived), [sections]);

  // Map student enrollment status relative to their track's active academic period
  const mappedStudents = useMemo(() => {
    return students
      .map((student) => {
        const isShs =
          student.academicLevel === 'SHS' ||
          (student.semester && String(student.semester).includes('Trimester')) ||
          student.yearLevel === 'Grade 11' ||
          student.yearLevel === 'Grade 12';
        const activePeriod =
          getActivePeriodFor(isShs ? 'SHS' : 'COLLEGE') ||
          (isShs ? activeShsPeriod : activeCollegePeriod) ||
          fallbackSemester;

        const isConfirmed =
          activePeriod &&
          student.schoolYear === activePeriod.academicYear &&
          (student.term || student.semester) === activePeriod.semester;

        const deadlinePassed = isDeadlinePassed(activePeriod?.reenrollDeadline);

        let status: 'confirmed' | 'pending' | 'overdue' = 'pending';
        if (isConfirmed) status = 'confirmed';
        else if (deadlinePassed) status = 'overdue';

        const rawYl = String(student.yearLevel || '');
        const yearNum = YEAR_NUM_MAP[rawYl] || (rawYl.includes('11') ? 11 : rawYl.includes('12') ? 12 : 1);
        const yearLabel = NUM_TO_YEAR_STR[yearNum] || rawYl || '1st Year';

        const isCollege = !isShs;
        const is4thYear = rawYl.includes('4') || yearNum === 4;
        const compSem = String(student.semester || student.term || '').toLowerCase();
        const is2ndSem = compSem.includes('2nd sem') || compSem.includes('second sem') || compSem === '2nd semester';
        const isGraduatingCollege = isCollege && is4thYear && is2ndSem;

        return {
          ...student,
          academicLevel: isShs ? ('SHS' as const) : ('COLLEGE' as const),
          yearLevelNumber: yearNum,
          yearLevelLabel: yearLabel,
          reEnrollStatus: status,
          activePeriod,
          isGraduatingCollege,
        };
      })
      // If student is still not re-enrolled while re-enrollment deadline has passed,
      // they should not show up in the re-enrollment tab anymore (they only appear in inactive)
      .filter((s) => s.reEnrollStatus !== 'overdue');
  }, [students, getActivePeriodFor, fallbackSemester, activeCollegePeriod, activeShsPeriod]);

  // Available Sections for Cascade Filter Dropdown based on selected Course & Year Level
  const availableFilterSections = useMemo(() => {
    let list = [...activeSections];

    if (selectedCourseCode !== 'All Programs') {
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
      const matchCourse = selectedCourseCode === 'All Programs' || s.courseCode === selectedCourseCode;
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

      // 2. Cascade Course / Program Filter
      if (selectedCourseCode !== 'All Programs' && s.courseCode !== selectedCourseCode) {
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

      // 5. Search Text (Name, Student ID, Email, Section, Program)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${s.firstName} ${s.middleName || ''} ${s.lastName}`.toLowerCase();
        const sid = (s.studentId || '').toLowerCase();
        const email = (s.email || '').toLowerCase();
        const sec = (s.section || '').toLowerCase();
        const course = (s.courseCode || '').toLowerCase();
        if (!fullName.includes(q) && !sid.includes(q) && !email.includes(q) && !sec.includes(q) && !course.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [mappedStudents, trackFilter, filter, selectedCourseCode, selectedYearLevel, selectedSectionName, searchQuery]);

  // Pagination State (8 rows per page standard)
  const PER_PAGE = 8;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [trackFilter, filter, selectedCourseCode, selectedYearLevel, selectedSectionName, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PER_PAGE));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filteredStudents.slice(start, start + PER_PAGE);
  }, [filteredStudents, currentPage]);

  // Selectable students (only unconfirmed students: pending or overdue)
  const selectableStudents = useMemo(() => {
    return filteredStudents.filter((s) => s.reEnrollStatus !== 'confirmed');
  }, [filteredStudents]);

  // Track-filtered metric counts for the summary cards
  const trackFilteredForCards = useMemo(() => {
    if (trackFilter === 'ALL') return mappedStudents;
    return mappedStudents.filter((s) => s.academicLevel === trackFilter);
  }, [mappedStudents, trackFilter]);

  const confirmedCount = trackFilteredForCards.filter((s) => s.reEnrollStatus === 'confirmed').length;
  const pendingCount = trackFilteredForCards.filter((s) => s.reEnrollStatus === 'pending').length;
  const overdueCount = trackFilteredForCards.filter((s) => s.reEnrollStatus === 'overdue').length;
  const totalTrackStudents = trackFilteredForCards.length;
  const progressPercent = totalTrackStudents === 0 ? 0 : Math.round((confirmedCount / totalTrackStudents) * 100);

  const isDeadlinePassedForCurrentTrack = useMemo(() => {
    if (trackFilter === 'COLLEGE') {
      return isDeadlinePassed(activeCollegePeriod?.reenrollDeadline);
    }
    if (trackFilter === 'SHS') {
      return isDeadlinePassed(activeShsPeriod?.reenrollDeadline);
    }
    const colPassed = !activeCollegePeriod || isDeadlinePassed(activeCollegePeriod?.reenrollDeadline);
    const shsPassed = !activeShsPeriod || isDeadlinePassed(activeShsPeriod?.reenrollDeadline);
    return colPassed && shsPassed;
  }, [trackFilter, activeCollegePeriod, activeShsPeriod]);

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
            academicLevel: (student.academicLevel as any) || cohortTrack,
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

  // Graduating College Seniors (4th Year 2nd Sem) among current selection
  const selectedGraduatingCollegeStudents = useMemo(() => {
    return filteredStudents.filter((s) => selectedIds.includes(s.id) && (s as any).isGraduatingCollege);
  }, [filteredStudents, selectedIds]);

  // Bulk Graduate & Archive Graduating Seniors
  const handleBulkGraduate = async () => {
    const ids = selectedGraduatingCollegeStudents.map((s) => s.id);
    if (ids.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to mark ${ids.length} graduating 4th Year College student(s) as GRADUATED and archive their records? They will be moved to the Archived Graduates registry.`
      )
    ) {
      return;
    }
    setProcessing(true);
    try {
      await bulkArchiveStudents(ids, auth.currentUser?.uid || 'admin', 'Graduated');
      setActionFeedback(`Successfully graduated and archived ${ids.length} student(s)!`);
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to graduate students: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = () => {
    exportStudentsToCSV(filteredStudents, 'ReEnrollment_Filtered_List');
  };

  const handleResetCascadeFilters = () => {
    setSelectedCourseCode('All Programs');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Re-enrollment Management</h2>
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
          {/* Progress Bar (Removed if re-enrollment deadline has passed) */}
          {!isDeadlinePassedForCurrentTrack && (
            <div className="bg-gray-200 rounded-full h-5 mb-4 overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] h-full transition-all flex items-center justify-between px-3"
                style={{ width: `${Math.max(5, progressPercent)}%` }}
              >
                {progressPercent > 10 && (
                  <span className="text-white text-xs font-bold">
                    {confirmedCount} / {totalTrackStudents} confirmed
                  </span>
                )}
                <span className="text-white text-xs font-bold ml-auto">{progressPercent}%</span>
              </div>
            </div>
          )}

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
              <div className="text-3xl font-bold">{totalTrackStudents}</div>
              <div className="text-xs font-medium opacity-90 mt-0.5">
                {trackFilter === 'ALL' ? 'Total Registry Students' : `${trackFilter === 'COLLEGE' ? 'College' : 'SHS'} Students`}
              </div>
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

      {/* CASCADE ACADEMIC FILTER BAR (Course / Program ➔ Year Level ➔ Section) */}
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
          {(selectedCourseCode !== 'All Programs' || selectedYearLevel !== 'All Year Levels' || selectedSectionName !== 'All Sections' || searchQuery || trackFilter !== 'ALL') && (
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
          {/* 1. Program Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
              1. Program
            </label>
            <select
              value={selectedCourseCode}
              onChange={(e) => {
                setSelectedCourseCode(e.target.value);
                setSelectedSectionName('All Sections'); // reset section on course change
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none bg-white text-gray-800 font-medium"
            >
              <option value="All Programs">All Programs</option>
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
                placeholder="Search by name, student ID, or email..."
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

                {/* Bulk Graduate & Archive Action for College Seniors */}
                {selectedGraduatingCollegeStudents.length > 0 && (
                  <button
                    onClick={handleBulkGraduate}
                    disabled={processing}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    title="Mark selected 4th Year 2nd Sem students as Graduated and archive their records"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-[#FFD41C]" />
                    Graduate Selected ({selectedGraduatingCollegeStudents.length})
                  </button>
                )}

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
              {paginatedStudents.map((student) => {
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
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-gray-500 font-medium">{student.yearLevelLabel}</span>
                        {(student as any).isGraduatingCollege && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Graduating
                          </span>
                        )}
                      </div>
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
                        (student as any).isGraduatingCollege ? (
                          <button
                            onClick={() => setReEnrollTarget(student)}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                            title="Graduate & Archive Student"
                          >
                            <GraduationCap className="w-3.5 h-3.5 text-[#FFD41C]" />
                            Graduate & Archive
                          </button>
                        ) : (
                          <button
                            onClick={() => setReEnrollTarget(student)}
                            className="px-3 py-1.5 bg-[#001A4D] text-[#FFD41C] hover:bg-[#001A4D]/90 text-xs font-bold rounded-lg transition-all shadow-xs inline-flex items-center gap-1 cursor-pointer"
                            title="Individual Re-enrollment & Shifting"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Re-enroll
                          </button>
                        )
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

        {/* ── Standard Bottom Pagination Bar ── */}
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredStudents.length}
          itemsPerPage={PER_PAGE}
          onPageChange={setCurrentPage}
          itemName="students"
        />
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
          activeCollegePeriod={activeCollegePeriod}
          activeShsPeriod={activeShsPeriod}
          courses={activeCourses}
          sections={activeSections}
          departments={departments}
          onClose={() => setReEnrollTarget(null)}
          onSuccess={(customMessage?: string) => {
            const reEnrolledStudent = reEnrollTarget;
            setReEnrollTarget(null);
            setActionFeedback(
              customMessage ||
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
  activeCollegePeriod?: SemesterDocument;
  activeShsPeriod?: SemesterDocument;
  courses: CourseDocument[];
  sections: SectionDocument[];
  departments: Array<{ id: string; name: string; code?: string; academicLevel?: string }>;
  onClose: () => void;
  onSuccess: (customMessage?: string) => void;
}

function IndividualReEnrollModal({
  student,
  activeSemester,
  activeCollegePeriod,
  activeShsPeriod,
  courses,
  sections,
  departments,
  onClose,
  onSuccess,
}: IndividualReEnrollModalProps) {
  // Department lookup map
  const deptMap = useMemo(() => {
    const map = new Map<string, any>();
    departments.forEach((d) => map.set(d.id, d));
    return map;
  }, [departments]);

  // Helper to determine if a course is a Senior High School strand
  const isShsCourse = (c: CourseDocument) => {
    const dept = deptMap.get(c.departmentId);
    return (
      c.academicLevel === 'SHS' ||
      dept?.academicLevel === 'SHS' ||
      c.yearLevels === 2 ||
      /stem|abm|humss|gas|tvl|ict|arts/i.test(c.code) ||
      /senior high/i.test(c.name) ||
      dept?.code === 'SHS' ||
      /senior high/i.test(dept?.name || '')
    );
  };

  // Student current status detection
  const isCurrentlyShs =
    student.academicLevel === 'SHS' ||
    (student.semester && String(student.semester).includes('Trimester')) ||
    student.yearLevel === 'Grade 11' ||
    student.yearLevel === 'Grade 12' ||
    (typeof student.yearLevel === 'string' && student.yearLevel.toLowerCase().includes('grade'));

  const isGrade12 =
    student.yearLevel === 'Grade 12' ||
    String(student.yearLevel).includes('12') ||
    YEAR_NUM_MAP[String(student.yearLevel)] === 12 ||
    YEAR_NUM_MAP[String(student.yearLevel)] === 2;

  // Completed semester priority: use student.semester first. Never fall back to activeSemester (target term)!
  const completedSem = String(student.semester || student.term || '').trim().toLowerCase();

  // SHS is 3 terms (Trimesters). Completed term MUST be 3rd Trimester (not 1st or 2nd) to advance to college!
  const isThirdTerm = completedSem.includes('3rd') || completedSem.includes('third');

  // Specific rule: SHS student in Year Level 2 (Grade 12) finishing 3rd Term is eligible to advance to College
  const canAdvanceToCollege = isCurrentlyShs && isGrade12 && isThirdTerm;

  // College Graduation Rule: College student in 4th Year finishing 2nd Semester is eligible for graduation & archival
  const isCollege = !isCurrentlyShs;
  const isCollege4thYear =
    student.yearLevel === '4th Year' ||
    YEAR_NUM_MAP[String(student.yearLevel)] === 4 ||
    String(student.yearLevel).includes('4');
  const isSecondSemester =
    completedSem.includes('2nd sem') ||
    completedSem.includes('second sem') ||
    completedSem === '2nd semester';

  const isCollegeGraduate = isCollege && isCollege4thYear && isSecondSemester;
  const [isManualReEnrollMode, setIsManualReEnrollMode] = useState(false);

  // Track selection state:
  // - College students are locked to 'COLLEGE'
  // - SHS in Term 1/2 or Grade 11 are locked to 'SHS'
  // - Graduating SHS in Grade 12 Term 3 defaults to 'COLLEGE' with toggle option
  const [targetTrack, setTargetTrack] = useState<'COLLEGE' | 'SHS'>(() => {
    if (canAdvanceToCollege) return 'COLLEGE';
    return isCurrentlyShs ? 'SHS' : 'COLLEGE';
  });

  // Filter programs strictly by target track
  const allowedCourses = useMemo(() => {
    if (targetTrack === 'COLLEGE') {
      // ONLY College programs (BSIT, BSCS, BSHM, etc.) - hide & disallow SHS strands
      return courses.filter((c) => !isShsCourse(c));
    } else {
      // ONLY SHS strands (STEM, ABM, HUMSS, etc.) - hide & disallow College programs
      return courses.filter((c) => isShsCourse(c));
    }
  }, [courses, targetTrack]);

  // Selected course state
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    const match = allowedCourses.find((c) => c.id === student.courseId || c.code === student.courseCode);
    return match?.id || allowedCourses[0]?.id || '';
  });

  // Auto-correct course selection when track changes
  useEffect(() => {
    if (allowedCourses.length > 0 && !allowedCourses.some((c) => c.id === selectedCourseId)) {
      setSelectedCourseId(allowedCourses[0].id);
      setSectionName('');
    }
  }, [allowedCourses, selectedCourseId]);

  // Year level state & options
  const yearLevelOptions = useMemo(() => {
    if (targetTrack === 'COLLEGE') {
      if (canAdvanceToCollege) {
        // Advancing to College begins at 1st Year
        return [{ value: 1, label: '1st Year (College Freshman)' }];
      }
      return [
        { value: 1, label: '1st Year' },
        { value: 2, label: '2nd Year' },
        { value: 3, label: '3rd Year' },
        { value: 4, label: '4th Year' },
      ];
    } else {
      return [
        { value: 11, label: 'Grade 11' },
        { value: 12, label: 'Grade 12' },
      ];
    }
  }, [targetTrack, canAdvanceToCollege]);

  const [yearLevelNumber, setYearLevelNumber] = useState<number>(() => {
    if (targetTrack === 'COLLEGE') {
      if (canAdvanceToCollege) return 1;
      const parsed = YEAR_NUM_MAP[String(student.yearLevel)];
      return parsed && parsed >= 1 && parsed <= 4 ? parsed : 1;
    } else {
      return isGrade12 ? 12 : 11;
    }
  });

  // Keep yearLevelNumber in sync when track changes
  useEffect(() => {
    if (targetTrack === 'COLLEGE') {
      if (canAdvanceToCollege) {
        setYearLevelNumber(1);
      } else {
        const parsed = YEAR_NUM_MAP[String(student.yearLevel)];
        setYearLevelNumber(parsed && parsed >= 1 && parsed <= 4 ? parsed : 1);
      }
    } else {
      setYearLevelNumber(isGrade12 ? 12 : 11);
    }
    setSectionName('');
  }, [targetTrack, canAdvanceToCollege, isGrade12, student.yearLevel]);

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

  // Target active period based on chosen track
  const effectiveActiveSemester = targetTrack === 'COLLEGE'
    ? (activeCollegePeriod || activeSemester)
    : (activeShsPeriod || activeSemester);

  const handleGraduateAndArchive = async () => {
    setSaving(true);
    try {
      await archiveStudent(student.id, 'Graduated', auth.currentUser?.uid || 'admin');
      onSuccess(
        `Successfully graduated ${student.firstName} ${student.lastName}! Student has been archived under Graduated status.`
      );
    } catch (err: any) {
      console.error('Failed to graduate and archive student:', err);
      alert(`Failed to graduate and archive student: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const course = courses.find((c) => c.id === selectedCourseId);
      const department = departments.find((d) => d.id === course?.departmentId);

      let yearLabel = '1st Year';
      if (targetTrack === 'SHS') {
        yearLabel = yearLevelNumber === 11 ? 'Grade 11' : 'Grade 12';
      } else {
        yearLabel = NUM_TO_YEAR_STR[yearLevelNumber] || '1st Year';
      }

      await reEnrollStudent(
        student.id,
        effectiveActiveSemester.academicYear,
        effectiveActiveSemester.semester as any,
        {
          academicLevel: targetTrack,
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[540px] overflow-hidden border border-[#E0E0E0]">
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
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Student Profile Overview */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
            <div className="flex items-center justify-between">
              <p className="font-bold text-[#001A4D] text-base">
                {student.firstName} {student.middleName ? `${student.middleName} ` : ''}{student.lastName}
              </p>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isCurrentlyShs ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-blue-100 text-blue-900 border border-blue-300'
              }`}>
                {isCurrentlyShs ? 'Senior High (SHS)' : 'College Track'}
              </span>
            </div>
            <p className="text-xs font-mono text-gray-500">Student ID: {student.studentId}</p>
            <p className="text-xs text-gray-600">
              Current Record: <strong className="text-gray-800">{student.courseCode} · {student.yearLevel || 'Year 1'} · {student.section || 'No Section'}</strong>
            </p>
            {student.semester && (
              <p className="text-[11px] text-gray-500">
                Completed Term: <span className="font-medium text-gray-700">{student.semester} (A.Y. {student.schoolYear || 'Current'})</span>
              </p>
            )}
          </div>

          {/* Special Graduation Alert for College 4th Year 2nd Sem */}
          {isCollegeGraduate ? (
            <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div className="text-xs text-emerald-950 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-emerald-900">🎓 College Degree Completed</p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800 uppercase">
                      Graduating Senior
                    </span>
                  </div>
                  <p className="mt-1 text-emerald-900/90 leading-relaxed text-xs">
                    This student has finished <strong>4th Year, 2nd Semester</strong> and completed all degree requirements.
                    Marking this student as <strong>Graduated</strong> will archive their record into the Graduate Archives and seal their enrollment.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsManualReEnrollMode(!isManualReEnrollMode)}
                  className="text-xs text-emerald-800 hover:text-emerald-950 underline font-medium cursor-pointer"
                >
                  {isManualReEnrollMode ? '← Back to Graduation Action' : 'Need term extension / retake? Click to re-enroll instead'}
                </button>
              </div>
            </div>
          ) : canAdvanceToCollege ? (
            <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300 rounded-xl space-y-2.5">
              <div className="flex items-start gap-2.5">
                <GraduationCap className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950">
                  <p className="font-bold text-amber-900">🎓 Senior High Completion (Grade 12, Term 3)</p>
                  <p className="mt-0.5 text-amber-900/90 leading-relaxed">
                    This student has finished Grade 12 3rd Trimester. You can now select a <strong>College Degree Program</strong> to advance them as a 1st Year College student.
                  </p>
                </div>
              </div>

              {/* Track Toggle */}
              <div className="flex items-center gap-2 pt-1 border-t border-amber-200">
                <span className="text-xs font-bold text-amber-900">Target Track:</span>
                <div className="inline-flex p-0.5 bg-amber-200/60 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setTargetTrack('COLLEGE')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      targetTrack === 'COLLEGE'
                        ? 'bg-[#001A4D] text-white shadow-xs'
                        : 'text-amber-900 hover:text-black'
                    }`}
                  >
                    Promote to College (Freshman)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetTrack('SHS')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      targetTrack === 'SHS'
                        ? 'bg-[#001A4D] text-white shadow-xs'
                        : 'text-amber-900 hover:text-black'
                    }`}
                  >
                    Retain in Senior High
                  </button>
                </div>
              </div>
            </div>
          ) : isCurrentlyShs ? (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Senior High Track (Term 1/2 Progression):</strong> Only Senior High Strands are available. College degree programs are locked until Grade 12 completion.
              </span>
            </div>
          ) : (
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-[#001A4D] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#0E4EBD] flex-shrink-0" />
              <span>
                <strong>College Undergraduate Track:</strong> Only College Degree programs are available. Senior High strands are excluded.
              </span>
            </div>
          )}

          {isCollegeGraduate && !isManualReEnrollMode ? (
            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Academic Completion Summary
              </div>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Program: <strong className="text-gray-900">{student.courseName || student.courseCode}</strong></li>
                <li>Completed Year Level: <strong className="text-gray-900">4th Year (Senior)</strong></li>
                <li>Completed Term: <strong className="text-gray-900">{student.semester} (A.Y. {student.schoolYear || 'Current'})</strong></li>
                <li>Section: <strong className="text-gray-900">{student.section || '—'}</strong></li>
              </ul>
              <p className="pt-2 text-[11px] text-gray-500 border-t border-emerald-200">
                Upon confirming, the student's status will be set to <strong>ARCHIVED</strong> with reason <strong>"Graduated"</strong>. Their records will remain accessible in the <em>Archived / Graduates</em> tab.
              </p>
            </div>
          ) : (
            <>
              {/* Active Term Notification */}
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-[#0E4EBD] flex items-center justify-between">
                <span>Enrolling for Target Term:</span>
                <strong className="text-[#001A4D]">{effectiveActiveSemester.label} ({effectiveActiveSemester.semester})</strong>
              </div>

              {/* 1. Course Selector (Strictly filtered by track) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700 uppercase">
                    {targetTrack === 'COLLEGE' ? 'College Program / Degree' : 'Senior High Strand / Track'} <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-gray-400 font-medium">
                    {allowedCourses.length} available
                  </span>
                </div>
                <select
                  value={selectedCourseId}
                  onChange={(e) => {
                    setSelectedCourseId(e.target.value);
                    setSectionName(''); // clear section on course change
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none bg-white"
                >
                  {allowedCourses.length === 0 ? (
                    <option value="">No {targetTrack === 'COLLEGE' ? 'college courses' : 'SHS strands'} configured</option>
                  ) : (
                    allowedCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* 2. Year Level */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Target Year Level <span className="text-red-500">*</span>
                </label>
                <select
                  value={yearLevelNumber}
                  disabled={canAdvanceToCollege && targetTrack === 'COLLEGE'}
                  onChange={(e) => {
                    setYearLevelNumber(Number(e.target.value));
                    setSectionName(''); // clear section on year change
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none bg-white disabled:bg-gray-100 disabled:text-gray-500"
                >
                  {yearLevelOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {canAdvanceToCollege && targetTrack === 'COLLEGE' && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Entering College students automatically start at 1st Year.
                  </p>
                )}
              </div>

              {/* 3. Section Selector (Bound to selected Course & Year Level) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Target Section
                </label>
                {availableSections.length > 0 ? (
                  <select
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none bg-white"
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
                    placeholder={targetTrack === 'COLLEGE' ? 'e.g. BSIT 1101 (Manual input)' : 'e.g. STEM 1201 (Manual input)'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none"
                  />
                )}
                {availableSections.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No configured sections found for this Course & Year Level in Settings. You may enter one manually.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          {isCollegeGraduate && !isManualReEnrollMode ? (
            <button
              onClick={handleGraduateAndArchive}
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold rounded-lg flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4 text-[#FFD41C]" />}
              Mark as Graduated & Archive
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={saving || allowedCourses.length === 0}
              className="px-5 py-2.5 bg-[#001A4D] text-[#FFD41C] text-sm font-bold rounded-lg hover:bg-[#001A4D]/90 flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirm Re-enrollment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
