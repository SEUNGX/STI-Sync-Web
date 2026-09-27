import { useState, useEffect, useMemo } from 'react';
import { Users, Globe, UserCheck, CheckSquare, Layers, BookOpen, GraduationCap, ShieldAlert, Lock } from 'lucide-react';
import { useCourses, useSections, useSemesters } from '../../../academic';
import { useStudents } from '../../../students/hooks/useStudentStream';
import { useOrgMembers } from '../../../organizations/hooks/useOrgMembers';
import { useOrganizationStream } from '../../../organizations';
import type { EventFormData } from '../../types/event.types';

interface Step3Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
  isOfficer?: boolean;
  errors?: Record<string, string>;
  isRestricted?: boolean;
}

const ALL_YEAR_LEVELS = ['G11', 'G12', '1st Year', '2nd Year', '3rd Year', '4th Year'];

export default function Step3Participants({ data, onUpdate, isOfficer, errors = {}, isRestricted }: Step3Props) {
  const { data: courses, loading: coursesLoading } = useCourses();
  const { data: sections, loading: sectionsLoading } = useSections();
  const { data: students, loading: studentsLoading } = useStudents();
  const { data: orgs } = useOrganizationStream();
  const { data: semesters } = useSemesters();
  const { members: orgMembers, loading: membersLoading } = useOrgMembers(data.hostingOrgId || '');

  const activeCourses = useMemo(() => courses.filter(c => !c.archived), [courses]);
  const activeSections = useMemo(() => sections.filter(s => !s.archived), [sections]);
  const currentOrg = useMemo(() => orgs.find(o => o.id === data.hostingOrgId), [orgs, data.hostingOrgId]);

  // Selected semester context for reference
  const selectedSemester = useMemo(
    () => semesters.find(s => s.id === data.semesterId),
    [semesters, data.semesterId]
  );

  // Available year levels includes all SHS and College levels
  const availableYearLevels = ALL_YEAR_LEVELS;

  // Dynamic Theme Styling based on Officer vs Admin
  const accentBorder = 'border-[#0E4EBD]';
  const accentText = 'text-[#0E4EBD]';
  const accentBg = 'bg-[#0E4EBD]';
  const accentBgLight = 'bg-blue-50';
  const accentBorderLight = 'border-blue-200';
  const accentFocusRing = 'focus:ring-[#0E4EBD]';
  const accentGradient = 'from-[#001A4D] via-[#002B7F] to-[#0E4EBD]';

  // Selected filters
  const selectedScope = data.targetAudienceScope || 'all';
  const selectedCourses = data.targetCourses || data.allowedCourses || [];
  const selectedYears = data.targetYearLevels || [];
  const selectedSections = data.targetSections || [];

  // Initialize defaults
  useEffect(() => {
    const updates: Partial<EventFormData> = {};
    if (data.attendanceEnabled === undefined) updates.attendanceEnabled = true;
    if (data.certificatesEnabled === undefined) updates.certificatesEnabled = true;
    if (!data.targetAudienceScope) updates.targetAudienceScope = 'all';
    if (Object.keys(updates).length > 0) {
      onUpdate(updates);
    }
  }, []);

  const updateField = (field: keyof EventFormData, value: any) => {
    onUpdate({ [field]: value });
  };

  // Scope toggle (All Students vs Org Members) for Officers
  const setAudienceScope = (scope: 'all' | 'members') => {
    updateField('targetAudienceScope', scope);
  };

  // Course Toggles & Select All
  const toggleCourse = (courseId: string) => {
    const next = selectedCourses.includes(courseId)
      ? selectedCourses.filter(id => id !== courseId)
      : [...selectedCourses, courseId];
    updateField('targetCourses', next);
    updateField('allowedCourses', next);
  };

  const selectAllCourses = () => {
    const allCourseIds = activeCourses.map(c => c.id);
    updateField('targetCourses', allCourseIds);
    updateField('allowedCourses', allCourseIds);
  };

  const clearAllCourses = () => {
    updateField('targetCourses', []);
    updateField('allowedCourses', []);
  };

  // Year Level Toggles & Select All
  const toggleYear = (year: string) => {
    const next = selectedYears.includes(year)
      ? selectedYears.filter(y => y !== year)
      : [...selectedYears, year];
    updateField('targetYearLevels', next);
  };

  const selectAllYears = () => {
    updateField('targetYearLevels', [...availableYearLevels]);
  };

  const clearAllYears = () => {
    updateField('targetYearLevels', []);
  };

  // Cascading Sections Filter based on selected courses and year levels
  const availableSections = useMemo(() => {
    return activeSections.filter(sec => {
      // 1. Filter by Course if any courses are selected
      if (selectedCourses.length > 0) {
        const matchesCourse =
          selectedCourses.includes(sec.courseId) ||
          selectedCourses.some(cId => {
            const c = activeCourses.find(item => item.id === cId);
            if (!c) return false;
            return (
              sec.courseId === c.id ||
              sec.name.toUpperCase().startsWith(c.code.toUpperCase()) ||
              sec.name.toUpperCase().includes(c.code.toUpperCase())
            );
          });
        if (!matchesCourse) return false;
      }

      // 2. Filter by Year Level if any year levels are selected
      if (selectedYears.length > 0) {
        const matchesYear = selectedYears.some(yearStr => {
          const yNum = Number(sec.yearLevel);
          if (yearStr === '1st Year') {
            return yNum === 1 || sec.name.includes('-1') || sec.name.includes(' 1') || sec.name.includes('101') || sec.name.includes('102');
          }
          if (yearStr === '2nd Year') {
            return yNum === 2 || sec.name.includes('-2') || sec.name.includes(' 2') || sec.name.includes('201') || sec.name.includes('202');
          }
          if (yearStr === '3rd Year') {
            return yNum === 3 || sec.name.includes('-3') || sec.name.includes(' 3') || sec.name.includes('301') || sec.name.includes('302');
          }
          if (yearStr === '4th Year') {
            return yNum === 4 || sec.name.includes('-4') || sec.name.includes(' 4') || sec.name.includes('401') || sec.name.includes('402');
          }
          if (yearStr === 'G11') {
            return yNum === 11 || sec.name.toUpperCase().includes('G11') || sec.name.toUpperCase().includes('11-') || sec.name.toUpperCase().includes('11A');
          }
          if (yearStr === 'G12') {
            return yNum === 12 || sec.name.toUpperCase().includes('G12') || sec.name.toUpperCase().includes('12-') || sec.name.toUpperCase().includes('12A');
          }
          return false;
        });
        if (!matchesYear) return false;
      }

      return true;
    });
  }, [activeSections, selectedCourses, selectedYears, activeCourses]);

  // Section Toggles & Select All
  const toggleSection = (secNameOrId: string) => {
    const next = selectedSections.includes(secNameOrId)
      ? selectedSections.filter(s => s !== secNameOrId)
      : [...selectedSections, secNameOrId];
    updateField('targetSections', next);
  };

  const selectAllFilteredSections = () => {
    const allFilteredSecNames = availableSections.map(s => s.name);
    updateField('targetSections', allFilteredSecNames);
  };

  const clearAllSections = () => {
    updateField('targetSections', []);
  };

  // Build member ID sets for fast lookup
  const memberStudentIds = useMemo(() => {
    const set = new Set<string>();
    orgMembers.forEach(m => {
      if (m.studentId) set.add(m.studentId);
      if (m.studentSchoolId) set.add(m.studentSchoolId);
      if (m.authUid) set.add(m.authUid);
    });
    return set;
  }, [orgMembers]);

  // Calculate actual matching students based on Active status, Audience Scope, Courses, Year Levels, and Sections
  const matchingStudents = useMemo(() => {
    return students.filter(s => {
      // 1. Only Active students
      const isActive = !s.archived && (s.status === 'ACTIVE' || (!s.status && !s.archived) || s.status?.toUpperCase() === 'ACTIVE') && s.status !== 'INACTIVE' && s.status !== 'ARCHIVED' && s.status !== 'RETURNED' && s.status !== 'DROPPED';
      if (!isActive) return false;

      // 2. If scope is members only (officer option), constrain to org members
      if (isOfficer && selectedScope === 'members') {
        const isOrgMember =
          memberStudentIds.size > 0
            ? memberStudentIds.has(s.studentId) || memberStudentIds.has(s.id) || (s.authUid && memberStudentIds.has(s.authUid))
            : true;
        if (!isOrgMember) return false;
      }

      // 3. Course Filter (SHS and College)
      if (selectedCourses.length > 0) {
        const matchesCourse = selectedCourses.includes(s.courseId) || selectedCourses.some(cId => {
          const c = activeCourses.find(item => item.id === cId);
          return c && (s.courseName === c.name || s.courseCode === c.code || s.courseId === c.id);
        });
        if (!matchesCourse) return false;
      }

      // 4. Year Level Filter
      if (selectedYears.length > 0) {
        const matchesYear = selectedYears.some(y => {
          if (s.yearLevel === y) return true;
          if ((y === 'G11' || y === 'Grade 11') && (s.yearLevel === 'G11' || s.yearLevel === 'Grade 11' || s.yearLevel === 11 || (s as any).yearLevel === '11')) return true;
          if ((y === 'G12' || y === 'Grade 12') && (s.yearLevel === 'G12' || s.yearLevel === 'Grade 12' || s.yearLevel === 12 || (s as any).yearLevel === '12')) return true;
          if (y === '1st Year' && (s.yearLevel === '1st Year' || s.yearLevel === 1 || (s as any).yearLevel === '1')) return true;
          if (y === '2nd Year' && (s.yearLevel === '2nd Year' || s.yearLevel === 2 || (s as any).yearLevel === '2')) return true;
          if (y === '3rd Year' && (s.yearLevel === '3rd Year' || s.yearLevel === 3 || (s as any).yearLevel === '3')) return true;
          if (y === '4th Year' && (s.yearLevel === '4th Year' || s.yearLevel === 4 || (s as any).yearLevel === '4')) return true;
          return false;
        });
        if (!matchesYear) return false;
      }

      // 5. Section Filter
      if (selectedSections.length > 0) {
        const matchesSection = selectedSections.includes(s.section) || selectedSections.includes(s.id);
        if (!matchesSection) return false;
      }

      return true;
    });
  }, [students, isOfficer, selectedScope, selectedCourses, selectedYears, selectedSections, activeCourses, memberStudentIds]);

  // Sync expectedParticipantCount to data
  useEffect(() => {
    const count = matchingStudents.length;
    updateField('expectedParticipantCount', count);
  }, [matchingStudents.length]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        {/* Approved Event Lock Banner */}
        {isRestricted && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-900 text-xs font-semibold shadow-xs">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Target Audience Locked: Audience cohort, course filters, year levels, and sections are sealed and cannot be modified.</span>
            </div>
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold uppercase tracking-wider">Locked</span>
          </div>
        )}

        {/* Section A — Target Audience */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4 flex items-center justify-between`}>
            <h3 className="text-[#001A4D] font-bold text-base">
              {isOfficer ? 'Target Audience Scope' : 'Target Audience & Academic Filter'}
            </h3>
            {isRestricted && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                <Lock className="w-3 h-3 text-amber-600" /> Locked upon Approval
              </span>
            )}
          </div>

          {/* Scope Selector Cards — ONLY for Officers */}
          {isOfficer && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                disabled={isRestricted}
                onClick={() => setAudienceScope('all')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  isRestricted ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                } ${
                  selectedScope === 'all'
                    ? 'border-[#0E4EBD] bg-blue-50/70 ring-2 ring-[#0E4EBD]/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className={`p-2 rounded-lg ${selectedScope === 'all' ? 'bg-[#0E4EBD] text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      <span>Campus-Wide / Open to All</span>
                      {isRestricted && <Lock className="w-3.5 h-3.5 text-amber-600" />}
                    </h4>
                    <p className="text-xs text-gray-500">Target all students matching course, year level, and section</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={isRestricted}
                onClick={() => setAudienceScope('members')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  isRestricted ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                } ${
                  selectedScope === 'members'
                    ? 'border-[#0E4EBD] bg-blue-50/70 ring-2 ring-[#0E4EBD]/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className={`p-2 rounded-lg ${selectedScope === 'members' ? 'bg-[#0E4EBD] text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      <span>Organization Members Only</span>
                      {isRestricted && <Lock className="w-3.5 h-3.5 text-amber-600" />}
                    </h4>
                    <p className="text-xs text-gray-500">
                      Exclusive to registered members of {currentOrg?.acronym || 'your organization'}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {errors.targetAudienceScope && (
            <div className="p-3.5 bg-red-50 border border-red-300 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2 mb-2 shadow-2xs">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errors.targetAudienceScope}</span>
            </div>
          )}

          <div className="space-y-5">
            {/* 1. Courses Filter (Includes All SHS and College Courses) */}
            <div className="p-4 border border-gray-200 rounded-xl bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className={`w-4 h-4 ${accentText}`} />
                  <label className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Target Courses ({selectedCourses.length === 0 ? 'All Courses' : `${selectedCourses.length} Selected`})</span>
                    {isRestricted && <Lock className="w-3.5 h-3.5 text-amber-600" />}
                  </label>
                </div>
                {!isRestricted && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllCourses}
                      className={`text-xs ${accentText} hover:underline font-semibold flex items-center gap-1 cursor-pointer`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" /> Select All ({activeCourses.length})
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={clearAllCourses}
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {coursesLoading ? (
                <div className="text-xs text-gray-400 py-2">Loading courses...</div>
              ) : activeCourses.length === 0 ? (
                <div className="text-xs text-gray-400 py-2">No courses registered in system.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeCourses.map(course => {
                    const isSelected = selectedCourses.includes(course.id);
                    const isShs =
                      course.academicLevel === 'SHS' ||
                      course.departmentId === 'SHS' ||
                      String(course.code).includes('SHS') ||
                      String(course.code).includes('STEM') ||
                      String(course.code).includes('ABM') ||
                      String(course.code).includes('HUMSS') ||
                      String(course.code).includes('TVL') ||
                      String(course.code).includes('GAS') ||
                      String(course.name).toLowerCase().includes('senior high');

                    return (
                      <button
                        type="button"
                        key={course.id}
                        disabled={isRestricted}
                        onClick={() => toggleCourse(course.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                          isRestricted ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                        } ${
                          isSelected
                            ? `${accentBg} text-white ${accentBorder} shadow-xs`
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#0E4EBD] hover:bg-blue-50/50'
                        }`}
                      >
                        <span>{course.code || course.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${
                          isSelected ? 'bg-white/20 text-white' : isShs ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {isShs ? 'SHS' : 'College'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Year Levels Filter */}
            <div className="p-4 border border-gray-200 rounded-xl bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className={`w-4 h-4 ${accentText}`} />
                  <label className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Year Levels ({selectedYears.length === 0 ? 'All Year Levels' : `${selectedYears.length} Selected`})</span>
                    {isRestricted && <Lock className="w-3.5 h-3.5 text-amber-600" />}
                  </label>
                </div>
                {!isRestricted && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllYears}
                      className={`text-xs ${accentText} hover:underline font-semibold flex items-center gap-1 cursor-pointer`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" /> Select All ({availableYearLevels.length})
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={clearAllYears}
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {availableYearLevels.map(year => {
                  const isSelected = selectedYears.includes(year);
                  return (
                    <button
                      type="button"
                      key={year}
                      disabled={isRestricted}
                      onClick={() => toggleYear(year)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isRestricted ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                      } ${
                        isSelected
                          ? `${accentBg} text-white ${accentBorder} shadow-xs`
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#0E4EBD] hover:bg-blue-50/50'
                      }`}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Sections Filter (Cascading) */}
            <div className="p-4 border border-gray-200 rounded-xl bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Sections ({selectedSections.length === 0 ? 'All Sections' : `${selectedSections.length} Selected`})</span>
                    {isRestricted && <Lock className="w-3.5 h-3.5 text-amber-600" />}
                  </label>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {selectedCourses.length > 0 || selectedYears.length > 0
                      ? `Filtered by chosen course/year (${availableSections.length} available)`
                      : `Showing all sections (${availableSections.length} available)`}
                  </p>
                </div>
                {!isRestricted && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllFilteredSections}
                      disabled={availableSections.length === 0}
                      className={`text-xs ${accentText} hover:underline font-semibold flex items-center gap-1 disabled:opacity-50 cursor-pointer`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" /> Select All ({availableSections.length})
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={clearAllSections}
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {sectionsLoading ? (
                <div className="text-xs text-gray-400 py-2">Loading sections...</div>
              ) : availableSections.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  No sections match the current Course and Year Level selection.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-2 border border-gray-100 rounded-lg bg-gray-50/50">
                  {availableSections.map(sec => {
                    const isSelected = selectedSections.includes(sec.name) || selectedSections.includes(sec.id);
                    return (
                      <button
                        type="button"
                        key={sec.id}
                        disabled={isRestricted}
                        onClick={() => toggleSection(sec.name)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                          isRestricted ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                        } ${
                          isSelected
                            ? `${accentBg} text-white ${accentBorder} font-bold shadow-xs`
                            : 'bg-white text-gray-700 border-gray-200 hover:border-[#0E4EBD]'
                        }`}
                      >
                        {sec.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Dynamic Reach Preview */}
      <div className="sticky top-0 h-fit">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
          <h4 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
            <Users className={`w-4 h-4 ${accentText}`} />
            Targeted Audience Reach
          </h4>

          <div className={`p-4 bg-gradient-to-br ${accentGradient} rounded-xl text-white text-center shadow-xs`}>
            <div className="text-3xl font-bold mb-0.5">
              {studentsLoading ? '...' : matchingStudents.length}
            </div>
            <div className="text-xs opacity-90 font-medium">Eligible Students</div>
          </div>

          <div className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="text-xs text-gray-500 font-semibold">Scope & Filters</div>
            <div className="text-xs text-gray-700 space-y-1">
              {isOfficer && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Scope:</span>
                  <span className={`font-bold ${accentText}`}>
                    {selectedScope === 'members' ? 'Org Members Only' : 'Campus-Wide'}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Courses:</span>
                <span className="font-medium">
                  {selectedCourses.length === 0 ? 'All Courses' : `${selectedCourses.length} selected`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Year Levels:</span>
                <span className="font-medium">
                  {selectedYears.length === 0 ? 'All Years' : `${selectedYears.length} selected`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sections:</span>
                <span className="font-medium">
                  {selectedSections.length === 0 ? 'All Sections' : `${selectedSections.length} selected`}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown by Course */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="text-xs text-gray-500 font-semibold">Breakdown by Course</div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {activeCourses
                .filter(c => selectedCourses.length === 0 || selectedCourses.includes(c.id))
                .map(course => {
                  const count = matchingStudents.filter(s =>
                    s.courseId === course.id || s.courseCode === course.code || s.courseName === course.name
                  ).length;
                  return (
                    <div key={course.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                      <span className="text-gray-700 font-medium">{course.code || course.name}</span>
                      <span className={`font-bold ${accentText} ${accentBgLight} px-2 py-0.5 rounded text-[11px]`}>
                        {studentsLoading ? '...' : count}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
