import { useState, useEffect, useMemo } from 'react';
import { Users, Globe, UserCheck, CheckSquare, Layers, BookOpen } from 'lucide-react';
import { useCourses, useSections } from '../../../academic';
import { useStudents } from '../../../students/hooks/useStudentStream';
import { useOrgMembers } from '../../../organizations/hooks/useOrgMembers';
import { useOrganizationStream } from '../../../organizations';
import type { EventFormData, EventSession } from '../../types/event.types';

interface Step3Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
  isOfficer?: boolean;
}

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'G11', 'G12'];

function formatTime12Hour(timeStr?: string): string {
  if (!timeStr) return 'TBA';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return timeStr;
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;

  let totalMins = h * 60 + m + minutesToAdd;
  if (totalMins < 0) totalMins = (totalMins % 1440) + 1440;
  totalMins = totalMins % 1440;

  const newH = Math.floor(totalMins / 60);
  const newM = totalMins % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
}

export default function Step3Participants({ data, onUpdate, isOfficer }: Step3Props) {
  const { data: courses, loading: coursesLoading } = useCourses();
  const { data: sections, loading: sectionsLoading } = useSections();
  const { data: students, loading: studentsLoading } = useStudents();
  const { data: orgs } = useOrganizationStream();
  const { members: orgMembers, loading: membersLoading } = useOrgMembers(data.hostingOrgId || '');

  const activeCourses = useMemo(() => courses.filter(c => !c.archived), [courses]);
  const activeSections = useMemo(() => sections.filter(s => !s.archived), [sections]);
  const currentOrg = useMemo(() => orgs.find(o => o.id === data.hostingOrgId), [orgs, data.hostingOrgId]);

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
    updateField('targetYearLevels', [...YEAR_LEVELS]);
  };

  const clearAllYears = () => {
    updateField('targetYearLevels', []);
  };

  // Cascading Sections Filter based on selected courses and year levels
  const availableSections = useMemo(() => {
    return activeSections.filter(sec => {
      // Filter by Course if any courses are selected
      if (selectedCourses.length > 0) {
        const matchesCourse = selectedCourses.includes(sec.courseId) || selectedCourses.some(cId => {
          const c = activeCourses.find(item => item.id === cId);
          return c && (sec.name.startsWith(c.code) || sec.name.includes(c.code));
        });
        if (!matchesCourse) return false;
      }

      // Filter by Year Level if any year levels are selected
      if (selectedYears.length > 0) {
        const matchesYear = selectedYears.some(yearStr => {
          if (yearStr === '1st Year') return sec.yearLevel === 1 || sec.name.includes('-1') || sec.name.includes('101');
          if (yearStr === '2nd Year') return sec.yearLevel === 2 || sec.name.includes('-2') || sec.name.includes('201');
          if (yearStr === '3rd Year') return sec.yearLevel === 3 || sec.name.includes('-3') || sec.name.includes('301');
          if (yearStr === '4th Year') return sec.yearLevel === 4 || sec.name.includes('-4') || sec.name.includes('401');
          if (yearStr === 'G11') return sec.yearLevel === 11 || sec.name.includes('11');
          if (yearStr === 'G12') return sec.yearLevel === 12 || sec.name.includes('12');
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

  // Calculate actual matching students based on Audience Scope, Courses, Year Levels, and Sections
  const matchingStudents = useMemo(() => {
    return students.filter(s => {
      const active = !s.status || s.status.toUpperCase() === 'ACTIVE';
      if (!active) return false;

      // If scope is members only (officer option), constrain to org members
      if (isOfficer && selectedScope === 'members') {
        const isOrgMember =
          memberStudentIds.size > 0
            ? memberStudentIds.has(s.studentId) || memberStudentIds.has(s.id) || (s.authUid && memberStudentIds.has(s.authUid))
            : true;
        if (!isOrgMember) return false;
      }

      // Course Filter
      if (selectedCourses.length > 0) {
        const matchesCourse = selectedCourses.includes(s.courseId) || selectedCourses.some(cId => {
          const c = activeCourses.find(item => item.id === cId);
          return c && (s.courseName === c.name || s.courseCode === c.code || s.courseId === c.id);
        });
        if (!matchesCourse) return false;
      }

      // Year Level Filter
      if (selectedYears.length > 0) {
        const matchesYear = selectedYears.includes(s.yearLevel);
        if (!matchesYear) return false;
      }

      // Section Filter
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

  const sessions = data.sessions || [];

  const updateSession = (id: string, field: keyof EventSession, value: any) => {
    updateField('sessions', sessions.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">

        {/* Section A — Target Audience */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4 flex items-center justify-between`}>
            <h3 className="text-[#001A4D] font-bold text-base">
              {isOfficer ? 'Target Audience Scope' : 'Target Audience & Academic Filter'}
            </h3>
          </div>

          {/* Scope Selector Cards — ONLY for Officers */}
          {isOfficer && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setAudienceScope('all')}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
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
                    <h4 className="font-bold text-gray-900 text-sm">Campus-Wide / Open to All</h4>
                    <p className="text-xs text-gray-500">Target all students matching course, year level, and section</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAudienceScope('members')}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
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
                    <h4 className="font-bold text-gray-900 text-sm">Organization Members Only</h4>
                    <p className="text-xs text-gray-500">
                      Exclusive to registered members of {currentOrg?.acronym || 'your organization'}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}

          <div className="space-y-5">
            {/* 1. Courses Filter */}
            <div className="p-4 border border-gray-200 rounded-xl bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className={`w-4 h-4 ${accentText}`} />
                  <label className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Target Courses ({selectedCourses.length === 0 ? 'All Courses' : `${selectedCourses.length} Selected`})
                  </label>
                </div>
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
              </div>

              {coursesLoading ? (
                <div className="text-xs text-gray-400 py-2">Loading courses...</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeCourses.map(course => {
                    const isSelected = selectedCourses.includes(course.id);
                    return (
                      <button
                        type="button"
                        key={course.id}
                        onClick={() => toggleCourse(course.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? `${accentBg} text-white ${accentBorder} shadow-xs`
                            : `bg-gray-50 text-gray-700 border-gray-200 hover:${accentBorder} ${isOfficer ? 'hover:bg-purple-50/50' : 'hover:bg-blue-50/50'}`
                        }`}
                      >
                        {course.code || course.name}
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
                  <label className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Year Levels ({selectedYears.length === 0 ? 'All Year Levels' : `${selectedYears.length} Selected`})
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllYears}
                    className={`text-xs ${accentText} hover:underline font-semibold flex items-center gap-1 cursor-pointer`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> Select All ({YEAR_LEVELS.length})
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
              </div>

              <div className="flex flex-wrap gap-2">
                {YEAR_LEVELS.map(year => {
                  const isSelected = selectedYears.includes(year);
                  return (
                    <button
                      type="button"
                      key={year}
                      onClick={() => toggleYear(year)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? `${accentBg} text-white ${accentBorder} shadow-xs`
                          : `bg-gray-50 text-gray-700 border-gray-200 hover:${accentBorder} ${isOfficer ? 'hover:bg-purple-50/50' : 'hover:bg-blue-50/50'}`
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
                  <label className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Sections ({selectedSections.length === 0 ? 'All Sections' : `${selectedSections.length} Selected`})
                  </label>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {selectedCourses.length > 0 || selectedYears.length > 0
                      ? `Filtered by chosen course/year (${availableSections.length} available)`
                      : `Showing all sections (${availableSections.length} available)`}
                  </p>
                </div>
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
                        onClick={() => toggleSection(sec.name)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer ${
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

        {/* Section B — Attendance Rules per Session */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4`}>
            <h3 className="text-[#001A4D] font-bold text-base">Attendance Rules per Session</h3>
            <p className="text-xs text-gray-500 mt-0.5">Configure check-in and check-out scanning windows for each event session</p>
          </div>

          {data.enableQRTickets === true || (data as any).enableQR === true ? (
            <div className="space-y-4">
              {sessions.map((session, index) => {
                const graceMins = data.gracePeriodMinutes ?? 15;
                const lateMins = data.lateThresholdMinutes ?? 60;
                const graceCutoff = session.startTime ? addMinutesToTime(session.startTime, graceMins) : '';
                const lateCutoff = session.startTime ? addMinutesToTime(session.startTime, lateMins) : '';

                const timeInOpenInvalid = session.timeInOpen && session.startTime && session.timeInOpen > session.startTime;
                const timeInOrderInvalid = session.timeInOpen && session.timeInClose && session.timeInOpen >= session.timeInClose;
                const timeOutOrderInvalid = session.timeOutOpen && session.timeOutClose && session.timeOutOpen >= session.timeOutClose;
                const timeOutBeforeInInvalid = session.hasTimeOut && session.timeOutOpen && session.timeInClose && session.timeOutOpen <= session.timeInClose;

                return (
                  <div key={session.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    {/* Session header banner */}
                    <div className="bg-[#001A4D] px-4 py-3 text-white">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-sm">{session.title || `Session ${index + 1}`}</p>
                        <span className={`px-2.5 py-0.5 ${accentBg} rounded-full text-xs font-semibold text-white`}>
                          {session.date || 'No Date'}
                        </span>
                      </div>
                      {session.startTime && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80 mt-1.5 pt-1.5 border-t border-white/10">
                          <span>Start: <strong className="text-white">{formatTime12Hour(session.startTime)}</strong></span>
                          <span>Grace (On-Time): <strong className="text-green-300">{formatTime12Hour(graceCutoff)} (+{graceMins}m)</strong></span>
                          <span>Late Cutoff: <strong className="text-amber-300">{formatTime12Hour(lateCutoff)} (+{lateMins}m)</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Time-in settings */}
                    <div className="p-4 space-y-4">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Time-In Window</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1 flex items-center">
                              Opens
                              <span className="relative group inline-block ml-1 cursor-pointer">
                                <span className="w-3.5 h-3.5 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-[9px] font-bold">?</span>
                                <span className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[11px] rounded shadow-xl z-30 pointer-events-none text-left">
                                  Recommended 15–30 mins before session start so early arrivals can scan.
                                </span>
                              </span>
                            </label>
                            <input
                              type="time"
                              step="600"
                              value={session.timeInOpen || ''}
                              onChange={(e) => updateSession(session.id, 'timeInOpen', e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent ${
                                timeInOpenInvalid || timeInOrderInvalid ? 'border-red-400 bg-red-50/30' : 'border-gray-300'
                              }`}
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-gray-600 mb-1 flex items-center">
                              Closes
                              <span className="relative group inline-block ml-1 cursor-pointer">
                                <span className="w-3.5 h-3.5 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-[9px] font-bold">?</span>
                                <span className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[11px] rounded shadow-xl z-30 pointer-events-none text-left">
                                  Cutoff for check-in. Auto-synced with Session Start + Late Threshold.
                                </span>
                              </span>
                            </label>
                            <input
                              type="time"
                              step="600"
                              value={session.timeInClose || ''}
                              onChange={(e) => updateSession(session.id, 'timeInClose', e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent ${
                                timeInOrderInvalid ? 'border-red-400 bg-red-50/30' : 'border-gray-300'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Validation messages for Time-In */}
                        {timeInOpenInvalid && (
                          <p className="text-[11px] text-amber-600 font-medium mt-1.5 flex items-center gap-1">
                            ⚠️ Time-In Opens ({formatTime12Hour(session.timeInOpen)}) is after session start ({formatTime12Hour(session.startTime)}). Early arrivals cannot scan.
                          </p>
                        )}
                        {timeInOrderInvalid && (
                          <p className="text-[11px] text-red-600 font-medium mt-1.5">
                            ❌ Time-In Opens must be earlier than Time-In Closes.
                          </p>
                        )}
                      </div>

                      {/* Time-out toggle & settings */}
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Time-Out Window</p>
                            <p className="text-[11px] text-gray-500">Enable check-out scanning for attendance verification at end of session</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateSession(session.id, 'hasTimeOut', !session.hasTimeOut)}
                            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
                              session.hasTimeOut ? accentBg : 'bg-gray-300'
                            }`}
                          >
                            <div
                              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                                session.hasTimeOut ? 'translate-x-5' : ''
                              }`}
                            />
                          </button>
                        </div>

                        {session.hasTimeOut && (
                          <div className={`space-y-2 ${accentBgLight}/40 p-3 rounded-lg border ${accentBorderLight}`}>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Opens</label>
                                <input
                                  type="time"
                                  step="600"
                                  value={session.timeOutOpen || ''}
                                  onChange={(e) => updateSession(session.id, 'timeOutOpen', e.target.value)}
                                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent ${
                                    timeOutBeforeInInvalid || timeOutOrderInvalid ? 'border-red-400 bg-red-50/30' : 'border-gray-300'
                                  }`}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Closes</label>
                                <input
                                  type="time"
                                  step="600"
                                  value={session.timeOutClose || ''}
                                  onChange={(e) => updateSession(session.id, 'timeOutClose', e.target.value)}
                                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent ${
                                    timeOutOrderInvalid ? 'border-red-400 bg-red-50/30' : 'border-gray-300'
                                  }`}
                                />
                              </div>
                            </div>

                            {timeOutBeforeInInvalid && (
                              <p className="text-[11px] text-red-600 font-medium mt-1">
                                ❌ Time-Out Opens must be after Time-In Closes.
                              </p>
                            )}
                            {timeOutOrderInvalid && (
                              <p className="text-[11px] text-red-600 font-medium mt-1">
                                ❌ Time-Out Opens must be earlier than Time-Out Closes.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 font-medium flex items-center gap-2.5">
              <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-bold text-[10px] uppercase">QR Disabled</span>
              <span>Attendance Rules & Session Scanning Windows are disabled because QR Code Tickets & Attendance Scanning is turned off in Event Details.</span>
            </div>
          )}
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
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
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
