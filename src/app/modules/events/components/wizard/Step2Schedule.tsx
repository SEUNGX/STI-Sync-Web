import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useSemesters } from '../../../academic';
import { useVenuesStream } from '../../hooks/useEventConfigStream';
import type { EventFormData, EventSession } from '../../types/event.types';

interface Step2Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
}

function formatTime12Hour(timeStr?: string): string {
  if (!timeStr) return '';
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

export default function Step2Schedule({ data, onUpdate }: Step2Props) {
  const { data: semesters, loading: semestersLoading } = useSemesters();
  const { venues, loading: venuesLoading } = useVenuesStream();

  const activeSemesters = semesters.filter(s => !s.archived);
  const activeVenues = venues.filter(v => !v.archived && v.status === 'available');

  const graceMins = data.gracePeriodMinutes ?? 15;
  const lateMins = data.lateThresholdMinutes ?? 60;

  // Auto-set school year when semester is selected or loaded
  useEffect(() => {
    if (data.semesterId && !data.schoolYear) {
      const sem = semesters.find(s => s.id === data.semesterId);
      if (sem) {
        onUpdate({ schoolYear: sem.academicYear });
      }
    } else if (!data.semesterId && activeSemesters.length > 0) {
      const activeSem = activeSemesters.find(s => s.status === 'ACTIVE');
      if (activeSem) {
        onUpdate({ semesterId: activeSem.id, schoolYear: activeSem.academicYear });
      }
    }
  }, [semesters, data.semesterId, data.schoolYear]);

  const sessions = data.sessions || [
    { id: Date.now().toString(), title: '', date: '', startTime: '', endTime: '', timeInOpen: '', timeInClose: '', hasTimeOut: false, timeOutOpen: '', timeOutClose: '' }
  ];

  const updateField = (field: keyof EventFormData, value: any) => {
    onUpdate({ [field]: value });
  };

  const addSession = () => {
    const newSession: EventSession = { id: Date.now().toString(), title: '', date: '', startTime: '', endTime: '', timeInOpen: '', timeInClose: '', hasTimeOut: false, timeOutOpen: '', timeOutClose: '' };
    updateField('sessions', [...sessions, newSession]);
  };

  const removeSession = (id: string) => {
    updateField('sessions', sessions.filter(s => s.id !== id));
  };

  const updateSession = (id: string, field: keyof EventSession, value: any) => {
    const nextSessions = sessions.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, [field]: value };
      
      // Auto-compute attendance windows if start/end time updated
      if (field === 'startTime' && value) {
        if (!updated.timeInOpen) updated.timeInOpen = addMinutesToTime(value, -30);
        updated.timeInClose = addMinutesToTime(value, lateMins);
      }
      if (field === 'endTime' && value) {
        if (!updated.timeOutOpen) updated.timeOutOpen = addMinutesToTime(value, -30);
        if (!updated.timeOutClose) updated.timeOutClose = addMinutesToTime(value, 30);
      }
      return updated;
    });
    updateField('sessions', nextSessions);
  };

  const selectedSemester = activeSemesters.find(s => s.id === data.semesterId);
  const selectedVenue = activeVenues.find(v => v.id === data.venueId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Section A — Academic Context */}
        <div>
          <div className="border-l-4 border-[#83358E] pl-3 mb-4">
            <h3 className="text-[#001A4D] font-bold text-base">Academic Context</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Semester <span className="text-red-500">*</span>
              </label>
              <select 
                value={data.semesterId || ''}
                onChange={(e) => {
                  const sem = activeSemesters.find(s => s.id === e.target.value);
                  updateField('semesterId', e.target.value);
                  if (sem) updateField('schoolYear', sem.academicYear);
                }}
                disabled={semestersLoading}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent disabled:opacity-50"
              >
                <option value="">{semestersLoading ? 'Loading...' : 'Select Semester...'}</option>
                {activeSemesters.map(sem => (
                  <option key={sem.id} value={sem.id}>{sem.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                School Year
              </label>
              <input 
                type="text" 
                value={data.schoolYear || ''}
                disabled
                placeholder="Auto-generated"
                className="w-full px-4 py-2.5 border border-gray-300 bg-gray-100 text-gray-600 rounded-lg" 
              />
            </div>
          </div>
        </div>

        {/* Section B — Event Schedule */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="border-l-4 border-[#83358E] pl-3">
              <h3 className="text-[#001A4D] font-bold text-base">Event Schedule</h3>
            </div>
            <button
              onClick={addSession}
              className="px-4 py-2 bg-[#1E70E8] text-white rounded-lg text-sm font-medium hover:bg-[#0E4EBD] flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Session
            </button>
          </div>

          <div className="space-y-3">
            {sessions.map((session, index) => (
              <div key={session.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Session {index + 1}</h4>
                  {sessions.length > 1 && (
                    <button onClick={() => removeSession(session.id)} className="text-red-600 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Session Title"
                    value={session.title}
                    onChange={(e) => updateSession(session.id, 'title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <input type="date" value={session.date} onChange={(e) => updateSession(session.id, 'date', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    <input type="time" step="600" value={session.startTime} onChange={(e) => updateSession(session.id, 'startTime', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    <input type="time" step="600" value={session.endTime} onChange={(e) => updateSession(session.id, 'endTime', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section C — Venue Assignment & Attendance Thresholds */}
        <div>
          <div className="border-l-4 border-[#83358E] pl-3 mb-4">
            <h3 className="text-[#001A4D] font-bold text-base">Venue & Attendance Thresholds</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Venue <span className="text-red-500">*</span>
              </label>
              <select
                value={data.venueId || ''}
                onChange={(e) => updateField('venueId', e.target.value)}
                disabled={venuesLoading}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent disabled:opacity-50"
              >
                <option value="">{venuesLoading ? 'Loading venues...' : 'Select venue...'}</option>
                {activeVenues.map(v => (
                  <option key={v.id} value={v.id}>{v.name} (Cap: {v.capacity})</option>
                ))}
              </select>
            </div>

            {data.enableQRTickets === true || (data as any).enableQR === true ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center">
                    Grace Period (minutes)
                    <span className="relative group inline-block ml-1.5 cursor-pointer">
                      <span className="w-4 h-4 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-[10px] font-bold">?</span>
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[11px] rounded shadow-xl z-20 pointer-events-none text-center">
                        Buffer minutes after start time before check-in is marked Late.
                      </span>
                    </span>
                  </label>
                  <input
                    type="number"
                    placeholder="5"
                    value={data.gracePeriodMinutes || ''}
                    onChange={(e) => updateField('gracePeriodMinutes', e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center">
                    Late Threshold (minutes)
                    <span className="relative group inline-block ml-1.5 cursor-pointer">
                      <span className="w-4 h-4 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-[10px] font-bold">?</span>
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[11px] rounded shadow-xl z-20 pointer-events-none text-center">
                        Cutoff minutes after start time after which check-in closes.
                      </span>
                    </span>
                  </label>
                  <input
                    type="number"
                    placeholder="15"
                    value={data.lateThresholdMinutes || ''}
                    onChange={(e) => updateField('lateThresholdMinutes', e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent"
                  />
                </div>

                {graceMins >= lateMins && lateMins > 0 && (
                  <div className="col-span-1 sm:col-span-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium">
                    ⚠️ Grace Period ({graceMins} mins) must be less than Late Threshold ({lateMins} mins).
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 font-medium flex items-center gap-2.5">
                <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-bold text-[10px] uppercase">QR Disabled</span>
                <span>Grace Period & Late Threshold settings are disabled because QR Code Tickets & Attendance Scanning is turned off in Event Details.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="sticky top-0 h-fit">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h4 className="font-bold text-gray-900 mb-3">Schedule Preview</h4>
          <div className="space-y-3">
            <div className="p-3 bg-gradient-to-br from-[#0E4EBD] to-[#83358E] rounded-lg text-white">
              <div className="text-xs opacity-80 mb-1">Academic Period</div>
              <div className="font-bold">{selectedSemester ? selectedSemester.label : 'Select Semester'}</div>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-2">Event Sessions</div>
              {sessions.map((session, index) => (
                <div key={session.id} className="py-2 border-b border-gray-100 last:border-0">
                  <div className="text-sm font-medium">{session.title || `Session ${index + 1}`}</div>
                  <div className="text-xs text-gray-500">
                    {session.date || 'Date not set'} {session.startTime ? `• ${formatTime12Hour(session.startTime)} – ${formatTime12Hour(session.endTime)}` : ''}
                  </div>
                </div>
              ))}
            </div>

            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-2">Venue</div>
              <div className="text-sm font-medium">{selectedVenue ? selectedVenue.name : 'Venue not selected'}</div>
              <div className="text-xs text-gray-500">{data.eventFormat || 'On-Campus'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}