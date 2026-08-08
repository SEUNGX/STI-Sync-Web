import { useState, useEffect, useMemo } from 'react';
import { Users, Lock } from 'lucide-react';
import { useDepartments } from '../../../academic';
import { useStudents } from '../../../students/hooks/useStudentStream';
import { useOrgMembers } from '../../../organizations/hooks/useOrgMembers';
import { useOrganizationStream } from '../../../organizations';
import type { EventFormData, EventSession } from '../../types/event.types';

interface Step3Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
  isOfficer?: boolean;
}

const YEAR_LEVELS = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', 'G11', 'G12'];

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
  const { data: departments, loading: deptsLoading } = useDepartments();
  const { data: students, loading: studentsLoading } = useStudents();
  const { data: orgs } = useOrganizationStream();
  const { members: orgMembers, loading: membersLoading } = useOrgMembers(data.hostingOrgId || '');

  const activeDepartments = departments.filter(d => !d.archived);
  const currentOrg = orgs.find(o => o.id === data.hostingOrgId);

  // Initialize defaults if undefined without triggering redundant state updates
  useEffect(() => {
    const updates: Partial<EventFormData> = {};
    if (data.attendanceEnabled === undefined) updates.attendanceEnabled = true;
    if (data.certificatesEnabled === undefined) updates.certificatesEnabled = true;
    if (Object.keys(updates).length > 0) {
      onUpdate(updates);
    }
  }, []);

  const updateField = (field: keyof EventFormData, value: any) => {
    onUpdate({ [field]: value });
  };

  const toggleYear = (year: string) => {
    const current = data.targetYearLevels || [];
    if (year === 'All') {
      updateField('targetYearLevels', current.length === YEAR_LEVELS.length ? [] : [...YEAR_LEVELS]);
    } else {
      updateField('targetYearLevels', current.includes(year) ? current.filter(y => y !== year) : [...current, year]);
    }
  };

  const toggleDept = (deptId: string) => {
    const current = data.targetDepartmentIds || [];
    updateField('targetDepartmentIds', current.includes(deptId) ? current.filter(id => id !== deptId) : [...current, deptId]);
  };

  const toggleHasTimeOut = (id: string) => {
    const sessions = data.sessions || [];
    updateField('sessions', sessions.map(s => s.id === id ? { ...s, hasTimeOut: !s.hasTimeOut } : s));
  };

  const updateSession = (id: string, field: keyof EventSession, value: any) => {
    const sessions = data.sessions || [];
    updateField('sessions', sessions.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const sessions = data.sessions || [];
  const selectedYears = data.targetYearLevels || [];
  const selectedDepts = data.targetDepartmentIds || [];

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

  // Calculate actual matching students based on selected Departments and Year Levels
  const matchingStudents = useMemo(() => {
    return students.filter(s => {
      const active = !s.status || s.status.toUpperCase() === 'ACTIVE';
      if (!active) return false;

      // If officer mode, constrain to org members (or org department if members list is empty)
      if (isOfficer) {
        const isOrgMember =
          memberStudentIds.size > 0
            ? memberStudentIds.has(s.studentId) || memberStudentIds.has(s.id) || (s.authUid && memberStudentIds.has(s.authUid))
            : currentOrg?.departmentId && currentOrg.departmentId !== 'cross-departmental'
            ? s.departmentId === currentOrg.departmentId
            : true;

        if (!isOrgMember) return false;
      }

      const matchesDept = selectedDepts.length === 0 || selectedDepts.some(dId => {
        const dObj = activeDepartments.find(ad => ad.id === dId);
        return s.departmentId === dId || (dObj && (s.departmentId === dObj.code || s.departmentId === dObj.name));
      });

      const matchesYear = selectedYears.length === 0 || selectedYears.includes('All') || selectedYears.includes(s.yearLevel);

      return matchesDept && matchesYear;
    });
  }, [students, selectedDepts, selectedYears, activeDepartments, isOfficer, memberStudentIds, currentOrg]);

  // Sync expectedParticipantCount to data if uninitialized
  useEffect(() => {
    const count = matchingStudents.length;
    if (data.expectedParticipantCount === undefined && count > 0) {
      onUpdate({ expectedParticipantCount: count });
    }
  }, [matchingStudents.length]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-6">

        {/* Section A — Target Audience */}
        <div>
          <div className="border-l-4 border-[#83358E] pl-3 mb-4 flex items-center justify-between">
            <h3 className="text-[#001A4D] font-bold text-base">Target Audience</h3>
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded border border-red-200">
              * Required Audience Selection
            </span>
          </div>

          {isOfficer && (
            <div className="p-3 bg-[#F3E8FF] border border-[#83358E]/30 rounded-xl mb-4 flex items-center gap-2 text-xs text-[#83358E]">
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Organization Scope:</strong> Reach is automatically scoped to designated members of <strong>{currentOrg?.acronym || currentOrg?.name || 'your organization'}</strong>. You can filter by year level below.
              </span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year Levels <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {YEAR_LEVELS.map((year) => (
                  <button
                    key={year}
                    onClick={() => toggleYear(year)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${selectedYears.includes(year)
                        ? 'bg-[#83358E] text-white border-[#83358E]'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-[#83358E]'
                      }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
              {selectedYears.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Please select at least one target Year Level.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Departments / Colleges <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                {deptsLoading ? (
                  <div className="text-sm text-gray-500">Loading departments...</div>
                ) : activeDepartments.map((dept) => (
                  <label key={dept.id} className="flex items-center gap-2 px-3 py-2 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={selectedDepts.includes(dept.id)}
                      onChange={() => toggleDept(dept.id)}
                      className="text-[#83358E] focus:ring-[#83358E] rounded" 
                    />
                    <span className="text-sm text-gray-700">{dept.name} ({dept.code})</span>
                  </label>
                ))}
              </div>
              {selectedDepts.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Please select at least one target Department/College.</p>
              )}
            </div>
          </div>
        </div>

        {/* Section B — Attendance Rules per Session */}
        <div>
          <div className="border-l-4 border-[#83358E] pl-3 mb-4">
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
                        <span className="px-2.5 py-0.5 bg-[#83358E] rounded-full text-xs font-semibold text-white">
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
                              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent ${
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
                              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent ${
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
                            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                              session.hasTimeOut ? 'bg-[#83358E]' : 'bg-gray-300'
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
                          <div className="space-y-2 bg-purple-50/40 p-3 rounded-lg border border-purple-100">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Opens</label>
                                <input
                                  type="time"
                                  step="600"
                                  value={session.timeOutOpen || ''}
                                  onChange={(e) => updateSession(session.id, 'timeOutOpen', e.target.value)}
                                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent ${
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
                                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent ${
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

      {/* Right Panel */}
      <div className="sticky top-0 h-fit">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#83358E]" />
            Estimated Reach
          </h4>
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-br from-[#0E4EBD] to-[#83358E] rounded-lg text-white text-center">
              <div className="text-3xl font-bold mb-1">
                {studentsLoading ? '...' : matchingStudents.length}
              </div>
              <div className="text-sm opacity-90">Matching Students</div>
            </div>

            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-2">Selected Year Levels</div>
              <div className="flex flex-wrap gap-1">
                {selectedYears.length === 0
                  ? <span className="text-xs text-gray-400">None selected</span>
                  : selectedYears.map(y => (
                    <span key={y} className="px-2 py-0.5 bg-[#83358E]/10 text-[#83358E] text-xs rounded-full">{y}</span>
                  ))}
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-3">By Department</div>
              <div className="space-y-2">
                {activeDepartments.filter(d => selectedDepts.length === 0 || selectedDepts.includes(d.id)).map((dept) => {
                  const count = matchingStudents.filter(s =>
                    s.departmentId === dept.id || s.departmentId === dept.code || s.departmentId === dept.name
                  ).length;
                  return (
                    <div key={dept.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                      <span className="text-gray-700 font-medium">{dept.name} ({dept.code})</span>
                      <span className="font-bold text-[#83358E] bg-[#83358E]/10 px-2 py-0.5 rounded text-xs">
                        {studentsLoading ? '...' : count}
                      </span>
                    </div>
                  );
                })}
                {selectedDepts.length === 0 && <span className="text-xs text-gray-400">Showing all active departments</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
