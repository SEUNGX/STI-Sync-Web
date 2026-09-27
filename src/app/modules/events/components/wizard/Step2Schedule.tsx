import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Building2, Clock, X, Check, AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, Calendar, CalendarDays, MapPin, Lock } from 'lucide-react';
import { useSemesters } from '../../../academic';
import { useVenuesStream } from '../../hooks/useEventConfigStream';
import { useAllEvents } from '../../hooks/useEventStream';
import { createVenue } from '../../services/event-config.service';
import { checkInternalSessionConflicts, checkExternalVenueConflicts, extractDateString, timeToMinutes, addMinutesToTime, formatTime12Hour } from '../../utils/event-validation';
import type { EventFormData, EventSession, EventDocument } from '../../types/event.types';
import { toast } from 'sonner';

interface Step2Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
  isOfficer?: boolean;
  errors?: Record<string, string>;
  isRestricted?: boolean;
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

export default function Step2Schedule({ data, onUpdate, isOfficer, errors = {}, isRestricted }: Step2Props) {
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
  const accentBgLight = 'bg-blue-50';
  const accentBorderLight = 'border-blue-200';
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
    const visDate = extractDateString(data.visibilityStart);
    if (!visDate) return null;
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

  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Approved Event Lock Banner */}
        {isRestricted && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-900 text-xs font-semibold shadow-xs">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Schedule & Venue Locked: This approved event's venue, semester, and session dates/times are sealed and cannot be modified.</span>
            </div>
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold uppercase tracking-wider">Locked</span>
          </div>
        )}

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

        {/* Section A — Auto-Assigned Academic Period */}
        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${accentBg} text-white flex items-center justify-center font-bold text-xs shadow-xs`}>
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#001A4D] uppercase tracking-wider">
                Active Academic Period
              </div>
              <div className="text-sm font-bold text-gray-900">
                {selectedSemester ? `${selectedSemester.label || selectedSemester.semester} (SY ${selectedSemester.academicYear})` : (semestersLoading ? 'Detecting active trimester/semester...' : 'Current Academic Trimester')}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Automatically recorded and linked to current campus term records.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md uppercase tracking-wider">
            Auto-Recorded
          </span>
        </div>

        {/* Section B — Event Schedule & Sessions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className={`border-l-4 ${accentBorder} pl-3 flex items-center gap-2`}>
              <h3 className="text-[#001A4D] font-bold text-base">Event Schedule & Sessions</h3>
              {isRestricted && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                  <Lock className="w-3 h-3 text-amber-600" /> Locked upon Approval
                </span>
              )}
            </div>
            {!isRestricted && (
              <button
                type="button"
                onClick={addSession}
                className={`px-3 py-1.5 ${accentBg} ${accentBgHover} text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs`}
              >
                <Plus className="w-4 h-4" /> Add Session
              </button>
            )}
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
                      : isRestricted
                      ? 'border-gray-200 bg-gray-50/40'
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
                          disabled={isRestricted}
                          onChange={(e) => updateSession(session.id, 'title', e.target.value)}
                          className={`font-semibold text-sm text-gray-900 border-b px-1 py-0.5 rounded-sm w-full max-w-md ${
                            titleErr
                              ? 'border-red-500 ring-1 ring-red-300 bg-red-50/30'
                              : isRestricted
                              ? 'border-transparent bg-transparent cursor-not-allowed text-gray-700'
                              : 'border-transparent hover:border-gray-300 focus:border-[#0E4EBD] focus:outline-hidden'
                          }`}
                        />
                        {titleErr && (
                          <p className="text-[11px] text-red-600 mt-0.5 font-medium">{titleErr}</p>
                        )}
                      </div>
                    </div>
                    {sessions.length > 1 && !isRestricted && (
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
                      <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                        <span>Date <span className="text-red-500">*</span></span>
                        {isRestricted && <Lock className="w-3 h-3 text-amber-600" />}
                      </label>
                      <input
                        type="date"
                        min={todayStr}
                        value={session.date || ''}
                        disabled={isRestricted}
                        onChange={(e) => updateSession(session.id, 'date', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:border-transparent disabled:opacity-60 disabled:bg-gray-100 transition-colors ${
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
                      <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                        <span>Start Time <span className="text-red-500">*</span></span>
                        {isRestricted && <Lock className="w-3 h-3 text-amber-600" />}
                      </label>
                      <input
                        type="time"
                        min={session.date === todayStr ? currentTimeStr : undefined}
                        value={session.startTime || ''}
                        disabled={isRestricted}
                        onChange={(e) => updateSession(session.id, 'startTime', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:border-transparent disabled:opacity-60 disabled:bg-gray-100 transition-colors ${
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
                      <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                        <span>End Time <span className="text-red-500">*</span></span>
                        {isRestricted && <Lock className="w-3 h-3 text-amber-600" />}
                      </label>
                      <input
                        type="time"
                        min={session.date === todayStr ? (session.startTime || currentTimeStr) : session.startTime || undefined}
                        value={session.endTime || ''}
                        disabled={isRestricted}
                        onChange={(e) => updateSession(session.id, 'endTime', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:border-transparent disabled:opacity-60 disabled:bg-gray-100 transition-colors ${
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
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4 flex items-center justify-between`}>
            <h3 className="text-[#001A4D] font-bold text-base">Venue & Location</h3>
            {isRestricted && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                <Lock className="w-3 h-3 text-amber-600" /> Locked upon Approval
              </span>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span>Venue <span className="text-red-500">*</span></span>
                {isRestricted && <Lock className="w-3.5 h-3.5 text-amber-600" />}
              </label>
              <select
                value={data.customVenueName ? '__other__' : (data.venueId || '')}
                onChange={(e) => handleVenueChange(e.target.value)}
                disabled={venuesLoading || isRestricted}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent disabled:opacity-60 disabled:bg-gray-100 transition-colors ${
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
                {!isRestricted && <option value="__other__">Other / Add Venue...</option>}
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
                  {!isRestricted && (
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
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section D — Attendance Rules & Scanning Thresholds */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4 flex items-center justify-between`}>
            <div>
              <h3 className="text-[#001A4D] font-bold text-base">Attendance Rules & Scanning Windows</h3>
              <p className="text-xs text-gray-500 mt-0.5">Configure attendance thresholds, check-in, and check-out scanning windows for each event session</p>
            </div>
            {isRestricted && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                <Lock className="w-3 h-3 text-amber-600" /> Locked upon Approval
              </span>
            )}
          </div>

          {data.enableQRTickets === true || (data as any).enableQR === true ? (
            <div className="space-y-4">
              {/* Attendance Scanning Thresholds */}
              <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className={`w-3.5 h-3.5 ${accentText}`} />
                    <span>Attendance Scanning Thresholds</span>
                  </label>
                  {isRestricted && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      <Lock className="w-3 h-3 text-amber-600" /> Locked
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center">
                      <span>Grace Period (minutes)</span>
                      {isRestricted && <Lock className="w-3.5 h-3.5 text-amber-600 ml-1.5" />}
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
                      disabled={isRestricted}
                      placeholder="15"
                      value={data.gracePeriodMinutes ?? 15}
                      onChange={(e) => updateField('gracePeriodMinutes', e.target.value ? Number(e.target.value) : 0)}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent disabled:opacity-60 disabled:bg-gray-100 transition-colors ${
                        errors.gracePeriod
                          ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                          : `border-gray-300 ${accentFocusRing}`
                      }`}
                    />
                    <p className="text-[11px] text-gray-500 mt-1">Default: 15 mins (marked on-time)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center">
                      <span>Late Threshold (minutes)</span>
                      {isRestricted && <Lock className="w-3.5 h-3.5 text-amber-600 ml-1.5" />}
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
                      disabled={isRestricted}
                      placeholder="60"
                      value={data.lateThresholdMinutes ?? 60}
                      onChange={(e) => updateField('lateThresholdMinutes', e.target.value ? Number(e.target.value) : 0)}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent disabled:opacity-60 disabled:bg-gray-100 transition-colors ${
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

              {sessions.map((session, index) => {
                const graceCutoff = session.startTime ? addMinutesToTime(session.startTime, graceMins) : '';
                const lateCutoff = session.startTime ? addMinutesToTime(session.startTime, lateMins) : '';

                const timeInOpenInvalid = Boolean(session.timeInOpen && session.startTime && timeToMinutes(session.timeInOpen) > timeToMinutes(session.startTime));
                const timeInOrderInvalid = Boolean(session.timeInOpen && session.timeInClose && timeToMinutes(session.timeInOpen) >= timeToMinutes(session.timeInClose));
                const timeInBeforeGraceInvalid = Boolean(session.timeInClose && session.startTime && timeToMinutes(session.timeInClose) < timeToMinutes(session.startTime) + graceMins);
                const timeOutOrderInvalid = Boolean(session.timeOutOpen && session.timeOutClose && timeToMinutes(session.timeOutOpen) >= timeToMinutes(session.timeOutClose));
                const timeOutBeforeInInvalid = Boolean(session.hasTimeOut && session.timeOutOpen && session.timeInClose && timeToMinutes(session.timeOutOpen) < timeToMinutes(session.timeInClose));

                return (
                  <div key={session.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-xs bg-white">
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
                              disabled={isRestricted}
                              onChange={(e) => updateSession(session.id, 'timeInOpen', e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent disabled:opacity-60 disabled:bg-gray-100 ${
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
                                  Cutoff for check-in. Must be at or after Grace Period cutoff (Start + {graceMins}m). Auto-synced with Late Threshold.
                                </span>
                              </span>
                            </label>
                            <input
                              type="time"
                              step="600"
                              value={session.timeInClose || ''}
                              disabled={isRestricted}
                              onChange={(e) => updateSession(session.id, 'timeInClose', e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent disabled:opacity-60 disabled:bg-gray-100 ${
                                timeInOrderInvalid || timeInBeforeGraceInvalid ? 'border-red-400 bg-red-50/30' : 'border-gray-300'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Validation messages for Time-In */}
                        {timeInOpenInvalid && (
                          <p className="text-[11px] text-red-600 font-medium mt-1.5 flex items-center gap-1">
                            ❌ Time-In Opens ({formatTime12Hour(session.timeInOpen)}) cannot be after Session Start ({formatTime12Hour(session.startTime)}). Early arrivals must be able to scan.
                          </p>
                        )}
                        {timeInOrderInvalid && (
                          <p className="text-[11px] text-red-600 font-medium mt-1.5">
                            ❌ Time-In Opens must be earlier than Time-In Closes.
                          </p>
                        )}
                        {timeInBeforeGraceInvalid && (
                          <p className="text-[11px] text-red-600 font-medium mt-1.5">
                            ❌ Time-In Closes ({formatTime12Hour(session.timeInClose)}) cannot be earlier than the Grace Period cutoff ({formatTime12Hour(graceCutoff)}).
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
                            disabled={isRestricted}
                            onClick={() => updateSession(session.id, 'hasTimeOut', !session.hasTimeOut)}
                            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                              isRestricted ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                            } ${
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
                                  disabled={isRestricted}
                                  onChange={(e) => updateSession(session.id, 'timeOutOpen', e.target.value)}
                                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent disabled:opacity-60 disabled:bg-gray-100 ${
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
                                  disabled={isRestricted}
                                  onChange={(e) => updateSession(session.id, 'timeOutClose', e.target.value)}
                                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent disabled:opacity-60 disabled:bg-gray-100 ${
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