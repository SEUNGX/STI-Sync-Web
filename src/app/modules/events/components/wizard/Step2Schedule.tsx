import { useState, useEffect } from 'react';
import { Plus, Trash2, Sparkles, Building2, Clock, X, Check, AlertCircle } from 'lucide-react';
import { useSemesters } from '../../../academic';
import { useVenuesStream } from '../../hooks/useEventConfigStream';
import { createVenue } from '../../services/event-config.service';
import type { EventFormData, EventSession } from '../../types/event.types';
import { toast } from 'sonner';

interface Step2Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
  isOfficer?: boolean;
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

const COMMON_FACILITIES = ['Projector', 'Air Conditioning', 'Sound System', 'Stage / Podium', 'WiFi / LAN', 'Whiteboard', 'Tiered Seating'];

export default function Step2Schedule({ data, onUpdate, isOfficer }: Step2Props) {
  const { data: semesters, loading: semestersLoading } = useSemesters();
  const { venues, loading: venuesLoading } = useVenuesStream();

  const todayStr = new Date().toISOString().split('T')[0];
  const defaultDateStr = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const activeSemesters = semesters.filter(s => !s.archived);
  // Fetch only active, available venues
  const availableVenues = venues.filter(v => !v.archived && v.status === 'available');

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

  // Auto-set school year when semester is selected or loaded
  useEffect(() => {
    if (data.semesterId && !data.schoolYear) {
      const sem = semesters.find(s => s.id === data.semesterId);
      if (sem) {
        onUpdate({ schoolYear: sem.academicYear });
      }
    } else if (!data.semesterId && activeSemesters.length > 0) {
      const isShsOnly =
        Array.isArray((data as any).targetAcademicLevels) &&
        (data as any).targetAcademicLevels.length === 1 &&
        (data as any).targetAcademicLevels[0] === 'SHS';

      const targetActive =
        activeSemesters.find(
          (s) =>
            s.status === 'ACTIVE' &&
            (isShsOnly
              ? s.academicLevel === 'SHS' || String(s.semester).includes('Trimester')
              : s.academicLevel === 'COLLEGE' || (!s.academicLevel && !String(s.semester).includes('Trimester')))
        ) || activeSemesters.find((s) => s.status === 'ACTIVE');

      if (targetActive) {
        onUpdate({ semesterId: targetActive.id, schoolYear: targetActive.academicYear });
      }
    }
  }, [semesters, data.semesterId, data.schoolYear, (data as any).targetAcademicLevels]);

  // Ensure default session has recommended time & date if not yet initialized
  useEffect(() => {
    if (!data.sessions || data.sessions.length === 0) {
      onUpdate({
        sessions: [{
          id: Date.now().toString(),
          title: 'Main Session',
          date: defaultDateStr,
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
  }, []);

  const sessions = data.sessions || [
    {
      id: Date.now().toString(),
      title: 'Main Session',
      date: defaultDateStr,
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
    const newSession: EventSession = {
      id: Date.now().toString(),
      title: `Session ${sessions.length + 1}`,
      date: defaultDateStr,
      startTime: '09:00',
      endTime: '17:00',
      timeInOpen: '08:30',
      timeInClose: '10:00',
      hasTimeOut: true,
      timeOutOpen: '16:30',
      timeOutClose: '17:30'
    };
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

  const applyRecommendedSchedule = (sessionId: string) => {
    const nextSessions = sessions.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        date: defaultDateStr,
        startTime: '09:00',
        endTime: '17:00',
        timeInOpen: '08:30',
        timeInClose: '10:00',
        hasTimeOut: true,
        timeOutOpen: '16:30',
        timeOutClose: '17:30'
      };
    });
    updateField('sessions', nextSessions);
    toast.success('Applied recommended schedule (5 days ahead, 9:00 AM – 5:00 PM with optimal scanning windows)');
  };

  const handleVenueChange = (val: string) => {
    if (val === '__other__') {
      setShowCustomVenueModal(true);
    } else {
      updateField('venueId', val);
      updateField('customVenueName', null);
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
        updateField('venueId', docRef.id);
        updateField('customVenueName', null);
        toast.success(`Venue "${customVenueName.trim()}" saved and selected!`);
      } else {
        updateField('venueId', '__other__');
        updateField('customVenueName', customVenueName.trim());
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

  const selectedSemester = activeSemesters.find(s => s.id === data.semesterId);
  const selectedVenue = availableVenues.find(v => v.id === data.venueId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      {/* Left Column */}
      <div className="space-y-6">
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
                onChange={(e) => {
                  const sem = activeSemesters.find(s => s.id === e.target.value);
                  updateField('semesterId', e.target.value);
                  if (sem) updateField('schoolYear', sem.academicYear);
                }}
                disabled={semestersLoading}
                className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 ${accentFocusRing} focus:border-transparent disabled:opacity-50`}
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

        {/* Section B — Event Schedule & Sessions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className={`border-l-4 ${accentBorder} pl-3`}>
              <h3 className="text-[#001A4D] font-bold text-base">Event Schedule & Sessions</h3>
              <p className="text-xs text-gray-500 mt-0.5">Recommended: Set event date at least 5 days ahead (9:00 AM – 5:00 PM)</p>
            </div>
            <button
              onClick={addSession}
              className="px-4 py-2 bg-[#1E70E8] text-white rounded-lg text-sm font-medium hover:bg-[#0E4EBD] flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" /> Add Session
            </button>
          </div>

          <div className="space-y-4">
            {sessions.map((session, index) => {
              const isPastDate = session.date && session.date < todayStr;

              return (
                <div key={session.id} className="p-4 border border-gray-200 rounded-xl bg-white shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full ${isOfficer ? 'bg-[#83358E]/10 text-[#83358E]' : 'bg-[#0E4EBD]/10 text-[#0E4EBD]'} text-xs font-bold flex items-center justify-center`}>
                        {index + 1}
                      </span>
                      <h4 className="font-bold text-gray-900 text-sm">Session {index + 1}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => applyRecommendedSchedule(session.id)}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Auto-fill 5 days ahead, 9:00 AM – 5:00 PM"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Recommended Defaults</span>
                      </button>
                      {sessions.length > 1 && (
                        <button
                          onClick={() => removeSession(session.id)}
                          className="text-red-600 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="Remove session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Session Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Morning Keynote / Main Session"
                        value={session.title}
                        onChange={(e) => updateSession(session.id, 'title', e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent`}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          min={todayStr}
                          value={session.date || ''}
                          onChange={(e) => updateSession(session.id, 'date', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent ${
                            isPastDate ? 'border-red-400 bg-red-50/50' : 'border-gray-300'
                          }`}
                        />
                        {isPastDate && (
                          <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Past dates cannot be selected.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Start Time <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="time"
                          step="600"
                          value={session.startTime || ''}
                          onChange={(e) => updateSession(session.id, 'startTime', e.target.value)}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          End Time <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="time"
                          step="600"
                          value={session.endTime || ''}
                          onChange={(e) => updateSession(session.id, 'endTime', e.target.value)}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section C — Venue Assignment & Attendance Thresholds */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4`}>
            <h3 className="text-[#001A4D] font-bold text-base">Venue & Attendance Thresholds</h3>
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
                className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 ${accentFocusRing} focus:border-transparent disabled:opacity-50`}
              >
                <option value="">{venuesLoading ? 'Loading available venues...' : 'Select available venue...'}</option>
                {availableVenues.map(v => (
                  <option key={v.id} value={v.id}>{v.name} (Capacity: {v.capacity})</option>
                ))}
                <option value="__other__">Other / Custom Venue...</option>
              </select>

              {data.customVenueName && (
                <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#0E4EBD]" />
                    <span>Custom Event Venue: <strong>{data.customVenueName}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCustomVenueModal(true)}
                    className="text-[#0E4EBD] hover:underline font-bold text-xs cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              )}
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
                    placeholder="15"
                    value={data.gracePeriodMinutes || ''}
                    onChange={(e) => updateField('gracePeriodMinutes', e.target.value ? Number(e.target.value) : null)}
                    className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 ${accentFocusRing} focus:border-transparent`}
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
                    placeholder="60"
                    value={data.lateThresholdMinutes || ''}
                    onChange={(e) => updateField('lateThresholdMinutes', e.target.value ? Number(e.target.value) : null)}
                    className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 ${accentFocusRing} focus:border-transparent`}
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

      {/* Right Column — Preview */}
      <div className="sticky top-0 h-fit">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-3">
          <h4 className="font-bold text-gray-900 mb-1">Schedule Preview</h4>
          
          <div className={`p-3 bg-gradient-to-br ${accentGradient} rounded-lg text-white`}>
            <div className="text-xs opacity-80 mb-1">Academic Period</div>
            <div className="font-bold text-sm">{selectedSemester ? selectedSemester.label : 'Select Semester'}</div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-2">Event Sessions</div>
            {sessions.map((session, index) => (
              <div key={session.id} className="py-2 border-b border-gray-100 last:border-0">
                <div className="text-sm font-medium">{session.title || `Session ${index + 1}`}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {session.date || 'Date not set'} {session.startTime ? `• ${formatTime12Hour(session.startTime)} – ${formatTime12Hour(session.endTime)}` : ''}
                </div>
              </div>
            ))}
          </div>

          <div className="border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-2">Venue</div>
            <div className="text-sm font-medium">
              {data.customVenueName || (selectedVenue ? selectedVenue.name : 'Venue not selected')}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{data.eventFormat || 'On-Campus'}</div>
          </div>
        </div>
      </div>

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
                onClick={() => setShowCustomVenueModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
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
                  placeholder="e.g. 5th Floor Gymnasium / Room 302"
                  value={customVenueName}
                  onChange={(e) => setCustomVenueName(e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Capacity (approx. attendees)
                </label>
                <input
                  type="number"
                  min={1}
                  value={customVenueCapacity}
                  onChange={(e) => setCustomVenueCapacity(Number(e.target.value))}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Available Facilities
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_FACILITIES.map(fac => {
                    const selected = customVenueFacilities.includes(fac);
                    return (
                      <button
                        type="button"
                        key={fac}
                        onClick={() => {
                          setCustomVenueFacilities(prev =>
                            selected ? prev.filter(f => f !== fac) : [...prev, fac]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selected
                            ? `${accentBg} text-white ${accentBorder}`
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {fac}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save Permanently Checkbox */}
              <div className={`p-3 ${isOfficer ? 'bg-purple-50/60 border-purple-200/80' : 'bg-blue-50/60 border-blue-200/80'} border rounded-xl`}>
                <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={saveVenuePermanently}
                    onChange={(e) => setSaveVenuePermanently(e.target.checked)}
                    className={`mt-0.5 ${accentText} ${accentFocusRing} rounded w-4 h-4`}
                  />
                  <div>
                    <p className="font-bold text-[#001A4D]">Save this venue for future use?</p>
                    <p className="text-gray-600 text-[11px] mt-0.5 leading-normal">
                      If checked, this venue will be permanently saved to the Venue Registry so it can be re-used in other events.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomVenueModal(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCustomVenue}
                disabled={isSavingVenue || !customVenueName.trim()}
                className={`flex-1 py-2.5 ${accentBg} text-white rounded-xl text-xs font-bold ${accentBgHover} disabled:opacity-50 transition-colors cursor-pointer`}
              >
                {isSavingVenue ? 'Saving...' : 'Apply Venue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}