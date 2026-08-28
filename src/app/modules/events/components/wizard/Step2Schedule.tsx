import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Building2, Clock, X, Check, AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, Calendar, CalendarDays, MapPin } from 'lucide-react';
import { useSemesters } from '../../../academic';
import { useVenuesStream } from '../../hooks/useEventConfigStream';
import { useAllEvents } from '../../hooks/useEventStream';
import { createVenue } from '../../services/event-config.service';
import { checkInternalSessionConflicts, checkExternalVenueConflicts } from '../../utils/event-validation';
import type { EventFormData, EventSession, EventDocument } from '../../types/event.types';
import { toast } from 'sonner';

interface Step2Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
  isOfficer?: boolean;
  errors?: Record<string, string>;
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

const getTodayDateStr = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getNextDayDateStr = (baseDateStr?: string): string => {
  if (!baseDateStr) return getTodayDateStr();
  const parts = baseDateStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return getTodayDateStr();
  }
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  dateObj.setDate(dateObj.getDate() + 1);
  const nextY = dateObj.getFullYear();
  const nextM = String(dateObj.getMonth() + 1).padStart(2, '0');
  const nextD = String(dateObj.getDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
};

const COMMON_FACILITIES = ['Projector', 'Air Conditioning', 'Sound System', 'Stage / Podium', 'WiFi / LAN', 'Whiteboard', 'Tiered Seating'];

export default function Step2Schedule({ data, onUpdate, isOfficer, errors = {} }: Step2Props) {
  const { data: semesters, loading: semestersLoading } = useSemesters();
  const { venues, loading: venuesLoading } = useVenuesStream();
  const { events: allEvents } = useAllEvents();

  const todayStr = useMemo(() => getTodayDateStr(), []);

  // Strictly filter to active, non-archived semesters
  const activeSemesters = useMemo(
    () => semesters.filter((s) => !s.archived && s.status === 'ACTIVE'),
    [semesters]
  );

  // Fetch active, non-archived venues
  const availableVenues = useMemo(
    () => venues.filter((v) => !v.archived),
    [venues]
  );

  const graceMins = data.gracePeriodMinutes ?? 15;
  const lateMins = data.lateThresholdMinutes ?? 60;

  // Custom Venue Modal State
  const [showCustomVenueModal, setShowCustomVenueModal] = useState(false);
  const [customVenueName, setCustomVenueName] = useState('');
  const [customVenueCapacity, setCustomVenueCapacity] = useState(50);
  const [customVenueFacilities, setCustomVenueFacilities] = useState<string[]>(['Air Conditioning', 'Sound System']);
  const [saveVenuePermanently, setSaveVenuePermanently] = useState(true);
  const [isSavingVenue, setIsSavingVenue] = useState(false);

  // Dynamic Theme Styling based on Officer vs Admin
  const accentBorder = 'border-[#0E4EBD]';
  const accentText = 'text-[#0E4EBD]';
  const accentBg = 'bg-[#0E4EBD]';
  const accentBgHover = 'hover:bg-[#002B7F]';
  const accentFocusRing = 'focus:ring-[#0E4EBD]';
  const accentGradient = 'from-[#001A4D] to-[#0E4EBD]';

  // Auto-set school year and targetAcademicLevel when active semester is loaded or default selected
  useEffect(() => {
    if (data.semesterId) {
      const sem = activeSemesters.find((s) => s.id === data.semesterId);
      if (sem) {
        const isShs = sem.academicLevel === 'SHS' || String(sem.semester).includes('Trimester');
        const level = isShs ? 'SHS' : sem.academicLevel === 'COLLEGE' || !sem.academicLevel ? 'COLLEGE' : 'BOTH';
        const updates: Partial<EventFormData> = {};
        if (!data.schoolYear) updates.schoolYear = sem.academicYear;
        if (!data.targetAcademicLevel) updates.targetAcademicLevel = level;
        if (Object.keys(updates).length > 0) onUpdate(updates);
      }
    } else if (!data.semesterId && activeSemesters.length > 0) {
      const defaultActive = activeSemesters[0];
      const isShs = defaultActive.academicLevel === 'SHS' || String(defaultActive.semester).includes('Trimester');
      const level = isShs ? 'SHS' : defaultActive.academicLevel === 'COLLEGE' || !defaultActive.academicLevel ? 'COLLEGE' : 'BOTH';
      onUpdate({
        semesterId: defaultActive.id,
        schoolYear: defaultActive.academicYear,
        targetAcademicLevel: level,
      });
    }
  }, [activeSemesters, data.semesterId, data.schoolYear, data.targetAcademicLevel]);

  // Ensure default session defaults to today's date if not yet initialized
  useEffect(() => {
    if (!data.sessions || data.sessions.length === 0) {
      onUpdate({
        sessions: [{
          id: Date.now().toString(),
          title: 'Main Session',
          date: todayStr,
          startTime: '09:00',
          endTime: '17:00',
          timeInOpen: '08:30',
          timeInClose: '10:00',
          hasTimeOut: true,
          timeOutOpen: '16:30',
          timeOutClose: '17:30'
        }]
      });
    }
  }, [todayStr]);

  const sessions = data.sessions || [
    {
      id: Date.now().toString(),
      title: 'Main Session',
      date: todayStr,
      startTime: '09:00',
      endTime: '17:00',
      timeInOpen: '08:30',
      timeInClose: '10:00',
      hasTimeOut: true,
      timeOutOpen: '16:30',
      timeOutClose: '17:30'
    }
  ];

  const updateField = (field: keyof EventFormData, value: any) => {
    onUpdate({ [field]: value });
  };

  const addSession = () => {
    const lastSession = sessions[sessions.length - 1];
    const nextDate = lastSession?.date ? getNextDayDateStr(lastSession.date) : todayStr;
    const newSession: EventSession = {
      id: Date.now().toString(),
      title: `Session ${sessions.length + 1}`,
      date: nextDate,
      startTime: '09:00',
      endTime: '17:00',
      timeInOpen: '08:30',
      timeInClose: '10:00',
      hasTimeOut: true,
      timeOutOpen: '16:30',
      timeOutClose: '17:30'
    };
    onUpdate({ sessions: [...sessions, newSession] });
  };

  const removeSession = (id: string) => {
    onUpdate({ sessions: sessions.filter(s => s.id !== id) });
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
    onUpdate({ sessions: nextSessions });
  };

  const handleVenueChange = (val: string) => {
    if (val === '__other__') {
      setShowCustomVenueModal(true);
    } else {
      onUpdate({
        venueId: val,
        customVenueName: null,
      });
    }
  };

  const handleCreateCustomVenue = async () => {
    if (!customVenueName.trim()) {
      toast.error('Please enter a venue name.');
      return;
    }
    setIsSavingVenue(true);
    try {
      if (saveVenuePermanently) {
        const docRef = await createVenue({
          name: customVenueName.trim(),
          capacity: Number(customVenueCapacity) || 50,
          facilities: customVenueFacilities,
          status: 'available',
          archived: false,
        });
        onUpdate({
          venueId: docRef.id,
          customVenueName: null,
        });
        toast.success(`Venue "${customVenueName.trim()}" saved and selected!`);
      } else {
        onUpdate({
          venueId: '__other__',
          customVenueName: customVenueName.trim(),
        });
        toast.success(`Custom venue "${customVenueName.trim()}" set for this event.`);
      }
      setShowCustomVenueModal(false);
      setCustomVenueName('');
    } catch (err: any) {
      console.error('Failed to create venue:', err);
      toast.error('Failed to create venue. Please try again.');
    } finally {
      setIsSavingVenue(false);
    }
  };

  const handleSemesterChange = (semId: string) => {
    const sem = activeSemesters.find(s => s.id === semId);
    const isShs = sem ? (sem.academicLevel === 'SHS' || String(sem.semester).includes('Trimester')) : false;
    const level = sem ? (isShs ? 'SHS' : (sem.academicLevel === 'COLLEGE' || !sem.academicLevel ? 'COLLEGE' : 'BOTH')) : null;
    onUpdate({
      semesterId: semId,
      schoolYear: sem ? sem.academicYear : '',
      targetAcademicLevel: level,
    });
  };

  const internalConflictResult = useMemo(() => checkInternalSessionConflicts(sessions), [sessions]);
  const venueConflictResult = useMemo(
    () => checkExternalVenueConflicts(sessions, data.venueId, allEvents, (data as any).id),
    [sessions, data.venueId, allEvents, (data as any).id]
  );

  const visibilityConflict = useMemo(() => {
    if (!data.visibilityStart || !sessions || sessions.length === 0) return null;
    const visDate = data.visibilityStart.split('T')[0];
    const conflictingSession = sessions.find(s => s.date && s.date < visDate);
    if (conflictingSession) {
      return `Visibility Conflict: Feed visibility is set to ${visDate}, which is after Session "${conflictingSession.title || 'Session'}" (${conflictingSession.date}). Students will not see this event before it takes place. Please adjust your visibility date in Step 1.`;
    }
    return null;
  }, [data.visibilityStart, sessions]);

  // Calendar State & Calculations
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string; events: EventDocument[] } | null>(null);

  // Map events by date (for dates with events in allEvents)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventDocument[]>();
    (allEvents || []).forEach(evt => {
      if (evt.proposalStatus === 'rejected' || evt.proposalStatus === 'draft' || evt.proposalStatus === 'cancelled') {
        return;
      }
      (evt.sessions || []).forEach(s => {
        if (s.date) {
          const list = map.get(s.date) || [];
          if (!list.some(e => e.id === evt.id)) {
            list.push(evt);
          }
          map.set(s.date, list);
        }
      });
    });
    return map;
  }, [allEvents]);

  // Draft session dates
  const draftSessionDateSet = useMemo(() => {
    return new Set(sessions.map(s => s.date).filter(Boolean));
  }, [sessions]);

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  const monthName = calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCalendarMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(year, month + 1, 1));

  const handleDayClick = (dayNum: number) => {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayEvts = eventsByDate.get(dStr) || [];
    setSelectedDayEvents({ date: dStr, events: dayEvts });
  };

  const selectedSemester = activeSemesters.find(s => s.id === data.semesterId);
  const selectedVenue = availableVenues.find(v => v.id === data.venueId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Visibility Conflict Alert */}
        {visibilityConflict && (
          <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-900">Event Visibility Warning</h4>
              <p className="text-xs text-amber-800 mt-0.5">{visibilityConflict}</p>
            </div>
          </div>
        )}

        {/* Section A — Academic Context */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4`}>
            <h3 className="text-[#001A4D] font-bold text-base">Academic Context</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Semester <span className="text-red-500">*</span>
              </label>
              <select 
                value={data.semesterId || ''}
                onChange={(e) => handleSemesterChange(e.target.value)}
                disabled={semestersLoading}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent disabled:opacity-50 transition-colors ${
                  errors.semesterId
                    ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                    : `border-gray-300 ${accentFocusRing}`
                }`}
              >
                <option value="">{semestersLoading ? 'Loading active semesters...' : 'Select Active Semester...'}</option>
                {activeSemesters.map(sem => (
                  <option key={sem.id} value={sem.id}>{sem.label} {sem.academicLevel ? `(${sem.academicLevel})` : ''}</option>
                ))}
              </select>
              {errors.semesterId && (
                <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.semesterId}</span>
                </p>
              )}
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

        {/* Section B — Event Schedule & Sessions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className={`border-l-4 ${accentBorder} pl-3`}>
              <h3 className="text-[#001A4D] font-bold text-base">Event Schedule & Sessions</h3>
            </div>
            <button
              type="button"
              onClick={addSession}
              className={`px-3 py-1.5 ${accentBg} ${accentBgHover} text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs`}
            >
              <Plus className="w-4 h-4" /> Add Session
            </button>
          </div>

          <div className="space-y-4">
            {sessions.map((session, index) => {
              const hasInternalConflict = internalConflictResult.conflicts.some(
                c => c.sessionAIndex === index || c.sessionBIndex === index
              );
              const hasVenueConflict = venueConflictResult.conflicts.some(
                c => c.sessionIndex === index
              );
              const isConflicted = hasInternalConflict || hasVenueConflict;

              const titleErr = errors[`session_${index}_title`];
              const dateErr = errors[`session_${index}_date`];
              const startErr = errors[`session_${index}_startTime`];
              const endErr = errors[`session_${index}_endTime`] || errors[`session_${index}_time`];

              return (
                <div
                  key={session.id}
                  className={`border rounded-xl p-4 transition-all ${
                    isConflicted
                      ? 'border-red-400 bg-red-50/40 ring-2 ring-red-300 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 flex-1">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isConflicted ? 'bg-red-500 text-white' : `${accentBg} text-white`
                      }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder={`Session ${index + 1} Title`}
                          value={session.title || ''}
                          onChange={(e) => updateSession(session.id, 'title', e.target.value)}
                          className={`font-semibold text-sm text-gray-900 border-b px-1 py-0.5 rounded-sm w-full max-w-md ${
                            titleErr
                              ? 'border-red-500 ring-1 ring-red-300 bg-red-50/30'
                              : 'border-transparent hover:border-gray-300 focus:border-[#0E4EBD] focus:outline-hidden'
                          }`}
                        />
                        {titleErr && (
                          <p className="text-[11px] text-red-600 mt-0.5 font-medium">{titleErr}</p>
                        )}
                      </div>
                    </div>
                    {sessions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSession(session.id)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-gray-100 cursor-pointer"
                        title="Remove session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Conflict Notice if this card has conflicts */}
                  {isConflicted && (
                    <div className="mb-3 p-2.5 bg-red-100 border border-red-300 rounded-lg text-xs text-red-800 space-y-1">
                      {internalConflictResult.conflicts
                        .filter(c => c.sessionAIndex === index || c.sessionBIndex === index)
                        .map((c, cIdx) => (
                          <div key={cIdx} className="flex items-start gap-1.5 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                            <span>{c.message}</span>
                          </div>
                        ))}
                      {venueConflictResult.conflicts
                        .filter(c => c.sessionIndex === index)
                        .map((c, cIdx) => (
                          <div key={cIdx} className="flex items-start gap-1.5 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                            <span>{c.message}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        min={todayStr}
                        value={session.date || ''}
                        onChange={(e) => updateSession(session.id, 'date', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:border-transparent transition-colors ${
                          dateErr
                            ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                            : !session.date
                            ? 'border-amber-400 bg-amber-50/20'
                            : `border-gray-300 ${accentFocusRing}`
                        }`}
                      />
                      {dateErr && (
                        <p className="text-[11px] text-red-600 mt-1 font-medium">{dateErr}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Start Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={session.startTime || ''}
                        onChange={(e) => updateSession(session.id, 'startTime', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:border-transparent transition-colors ${
                          startErr
                            ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                            : !session.startTime
                            ? 'border-amber-400 bg-amber-50/20'
                            : `border-gray-300 ${accentFocusRing}`
                        }`}
                      />
                      {startErr && (
                        <p className="text-[11px] text-red-600 mt-1 font-medium">{startErr}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        End Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={session.endTime || ''}
                        onChange={(e) => updateSession(session.id, 'endTime', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:border-transparent transition-colors ${
                          endErr
                            ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                            : !session.endTime
                            ? 'border-amber-400 bg-amber-50/20'
                            : `border-gray-300 ${accentFocusRing}`
                        }`}
                      />
                      {endErr && (
                        <p className="text-[11px] text-red-600 mt-1 font-medium">{endErr}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section C — Venue & Location */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4`}>
            <h3 className="text-[#001A4D] font-bold text-base">Venue & Location</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Venue <span className="text-red-500">*</span>
              </label>
              <select
                value={data.customVenueName ? '__other__' : (data.venueId || '')}
                onChange={(e) => handleVenueChange(e.target.value)}
                disabled={venuesLoading}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent disabled:opacity-50 transition-colors ${
                  errors.venueId
                    ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                    : `border-gray-300 ${accentFocusRing}`
                }`}
              >
                <option value="">{venuesLoading ? 'Loading venues...' : 'Select venue...'}</option>
                {availableVenues.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.capacity ? `(Capacity: ${v.capacity})` : ''}
                  </option>
                ))}
                <option value="__other__">Other / Add Venue...</option>
              </select>
              {errors.venueId && (
                <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.venueId}</span>
                </p>
              )}

              {data.customVenueName && (
                <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#0E4EBD]" />
                    <span>Custom Venue: <strong>{data.customVenueName}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomVenueName(data.customVenueName || '');
                        setShowCustomVenueModal(true);
                      }}
                      className="text-[#0E4EBD] hover:underline font-bold text-xs cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdate({
                          venueId: '',
                          customVenueName: null,
                        });
                      }}
                      className="text-gray-400 hover:text-red-600 p-0.5 cursor-pointer"
                      title="Clear custom venue"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Attendance Thresholds: Grace Period & Late Threshold */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className={`w-3.5 h-3.5 ${accentText}`} />
                  <span>Attendance Scanning Thresholds</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center">
                    Grace Period (minutes)
                    <span className="relative group inline-block ml-1.5 cursor-pointer">
                      <span className="w-4 h-4 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-[10px] font-bold">?</span>
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[11px] rounded shadow-xl z-20 pointer-events-none text-center">
                        Buffer minutes after session start time before check-in is marked Late.
                      </span>
                    </span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="15"
                    value={data.gracePeriodMinutes ?? 15}
                    onChange={(e) => updateField('gracePeriodMinutes', e.target.value ? Number(e.target.value) : 0)}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent transition-colors ${
                      errors.gracePeriod
                        ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                        : `border-gray-300 ${accentFocusRing}`
                    }`}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Default: 15 mins (marked on-time)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center">
                    Late Threshold (minutes)
                    <span className="relative group inline-block ml-1.5 cursor-pointer">
                      <span className="w-4 h-4 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-[10px] font-bold">?</span>
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[11px] rounded shadow-xl z-20 pointer-events-none text-center">
                        Cutoff minutes after start time after which check-in is closed.
                      </span>
                    </span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="60"
                    value={data.lateThresholdMinutes ?? 60}
                    onChange={(e) => updateField('lateThresholdMinutes', e.target.value ? Number(e.target.value) : 0)}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent transition-colors ${
                      errors.gracePeriod
                        ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                        : `border-gray-300 ${accentFocusRing}`
                    }`}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Default: 60 mins (check-in closes)</p>
                </div>

                {(errors.gracePeriod || (graceMins >= lateMins && lateMins > 0)) && (
                  <div className="col-span-1 sm:col-span-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>{errors.gracePeriod || `Grace Period (${graceMins} mins) must be less than Late Threshold (${lateMins} mins).`}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column — Preview & Interactive Event Calendar */}
      <div className="sticky top-0 h-fit space-y-4">
        {/* Schedule Summary Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-3">
          <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <Calendar className={`w-4 h-4 ${accentText}`} />
            <span>Schedule Preview</span>
          </h4>
          
          <div className={`p-3 bg-gradient-to-br ${accentGradient} rounded-lg text-white shadow-xs`}>
            <div className="text-[11px] opacity-80 mb-0.5">Academic Period</div>
            <div className="font-bold text-sm">{selectedSemester ? selectedSemester.label : 'Select Semester'}</div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
            <div className="text-xs text-gray-500 font-semibold mb-2">Event Sessions ({sessions.length})</div>
            {sessions.map((session, index) => (
              <div key={session.id} className="py-1.5 border-b border-gray-200/70 last:border-0">
                <div className="text-xs font-bold text-gray-900">{session.title || `Session ${index + 1}`}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {session.date || 'Date not set'} {session.startTime ? `• ${formatTime12Hour(session.startTime)} – ${formatTime12Hour(session.endTime)}` : ''}
                </div>
              </div>
            ))}
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
            <div className="text-xs text-gray-500 font-semibold mb-1">Venue</div>
            <div className="text-xs font-bold text-gray-900">
              {data.customVenueName || (selectedVenue ? selectedVenue.name : 'Venue not selected')}
            </div>
          </div>
        </div>

        {/* Interactive Monthly Mini-Calendar */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-1.5">
              <CalendarDays className={`w-4 h-4 ${accentText}`} />
              <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Campus Calendar</h4>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded-md hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold text-gray-800 min-w-[90px] text-center">{monthName}</span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 rounded-md hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400 pb-1">
            <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {/* Blank prefix offset days */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`blank-${i}`} className="h-7 w-7" />
            ))}

            {/* Days in Month */}
            {Array.from({ length: totalDaysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayEvents = eventsByDate.get(dateStr) || [];
              const hasEvents = dayEvents.length > 0;
              const isDraftSession = draftSessionDateSet.has(dateStr);
              const isToday = dateStr === todayStr;

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => handleDayClick(dayNum)}
                  className={`h-7 w-7 rounded-lg text-xs font-semibold flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                    isDraftSession
                      ? 'bg-blue-100 text-[#001A4D] font-black ring-1.5 ring-[#0E4EBD]'
                      : isToday
                      ? 'bg-amber-100 text-amber-900 font-bold'
                      : hasEvents
                      ? 'bg-gray-100 hover:bg-blue-50 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  title={`${dateStr}: ${hasEvents ? `${dayEvents.length} event(s)` : 'No events'}`}
                >
                  <span>{dayNum}</span>
                  {hasEvents && (
                    <span className={`w-1.5 h-1.5 rounded-full absolute bottom-0.5 ${
                      dayEvents.some(e => !e.isOfficerProposal) ? 'bg-[#0E4EBD]' : 'bg-[#83358E]'
                    }`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Calendar Legend */}
          <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between text-[10px] text-gray-500 font-medium">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#0E4EBD]" /> Admin Event
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#83358E]" /> Club Event
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs ring-1 ring-[#0E4EBD] bg-blue-100" /> Your Session
            </span>
          </div>
        </div>
      </div>

      {/* Day Events Details Modal */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CalendarDays className={`w-5 h-5 ${accentText}`} />
                <div>
                  <h3 className="font-bold text-[#001A4D] text-sm">Campus Events on this Date</h3>
                  <p className="text-xs text-gray-500">{selectedDayEvents.date}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayEvents(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedDayEvents.events.length === 0 ? (
              <div className="py-6 text-center text-gray-500 text-xs">
                <p className="font-medium text-gray-700 mb-1">No campus events scheduled on this date.</p>
                <p className="text-gray-400">Venues and session slots are completely open.</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                {selectedDayEvents.events.map((evt) => {
                  const daySessions = (evt.sessions || []).filter(s => s.date === selectedDayEvents.date);
                  return (
                    <div key={evt.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="font-bold text-gray-900">{evt.title}</h5>
                          <p className="text-[11px] text-gray-500">{evt.eventTypeName || 'Event'} • {evt.categoryName || 'General'}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          evt.isOfficerProposal ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-900'
                        }`}>
                          {evt.isOfficerProposal ? 'Club Event' : 'SAS Admin'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-gray-600 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="font-medium">{evt.venueName || evt.customVenueName || 'Venue TBD'}</span>
                      </div>

                      {daySessions.length > 0 && (
                        <div className="pt-1.5 border-t border-gray-200/60 space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Scheduled Sessions</span>
                          {daySessions.map((s, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px] text-gray-700 bg-white p-1.5 rounded-md border border-gray-200">
                              <span className="font-medium">{s.title || `Session ${idx + 1}`}</span>
                              <span className="font-bold text-gray-900">{formatTime12Hour(s.startTime)} – {formatTime12Hour(s.endTime)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedDayEvents(null)}
              className={`w-full py-2.5 ${accentBg} text-white font-bold text-xs rounded-xl shadow-xs hover:opacity-90 transition-opacity cursor-pointer`}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Custom Venue Modal */}
      {showCustomVenueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Building2 className={`w-5 h-5 ${accentText}`} />
                <h3 className="font-bold text-[#001A4D] text-base">Add Venue</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomVenueModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Venue Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Gymnasium Court B"
                  value={customVenueName}
                  onChange={(e) => setCustomVenueName(e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    value={customVenueCapacity}
                    onChange={(e) => setCustomVenueCapacity(Number(e.target.value))}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 ${accentFocusRing}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Location Type</label>
                  <input
                    type="text"
                    disabled
                    value="On-Campus"
                    className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-sm text-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Available Facilities</label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_FACILITIES.map(fac => {
                    const isSelected = customVenueFacilities.includes(fac);
                    return (
                      <button
                        key={fac}
                        type="button"
                        onClick={() => {
                          setCustomVenueFacilities(prev =>
                            isSelected ? prev.filter(f => f !== fac) : [...prev, fac]
                          );
                        }}
                        className={`px-2.5 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
                          isSelected
                            ? `${accentBg} text-white border-transparent`
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {fac}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <input
                  type="checkbox"
                  id="saveVenuePermanently"
                  checked={saveVenuePermanently}
                  onChange={(e) => setSaveVenuePermanently(e.target.checked)}
                  className={`w-4 h-4 rounded text-[#0E4EBD] focus:ring-[#0E4EBD] cursor-pointer`}
                />
                <label htmlFor="saveVenuePermanently" className="text-xs text-gray-700 font-medium cursor-pointer">
                  Save this venue for future events across campus
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomVenueModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCustomVenue}
                  disabled={isSavingVenue}
                  className={`px-4 py-2 ${accentBg} text-white text-xs font-bold rounded-lg shadow-xs hover:opacity-90 disabled:opacity-50 cursor-pointer`}
                >
                  {isSavingVenue ? 'Saving...' : 'Set Venue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}