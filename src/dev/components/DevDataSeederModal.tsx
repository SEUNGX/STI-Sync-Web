import { useState, useMemo } from 'react';
import {
  Sparkles,
  Users,
  QrCode,
  Wallet,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CalendarCheck,
  Building2,
  Layers,
  Zap,
  Target,
  Filter,
  CalendarPlus,
  Clock,
  Coins,
} from 'lucide-react';
import { Button } from '../../app/components/ui/button';
import { useStudents } from '../../app/modules/students/hooks/useStudentStream';
import { useAllEvents } from '../../app/modules/events/hooks/useEventStream';
import { useOrganizationStream } from '../../app/modules/organizations/hooks/useOrganizationStream';
import {
  seedSampleStudents,
  seedEventAttendance,
  seedPayables,
  seedSampleEvent,
  clearAllTestData,
  isStudentEligibleForEvent,
  EVENT_PRESETS,
  SeedStudentOptions,
  SeedEventOptions,
} from '../services/test-seeder.service';

interface DevDataSeederModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DevDataSeederModal({ isOpen, onClose }: DevDataSeederModalProps) {
  const [activeTab, setActiveTab] = useState<'attendance' | 'events' | 'students' | 'payables' | 'purge'>('attendance');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Live data streams for dropdown selectors
  const { data: students = [] } = useStudents();
  const { events = [] } = useAllEvents();
  const { data: organizations = [] } = useOrganizationStream();

  // ── Form States ──

  // 1. Attendance form
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('ALL');
  const [attendanceRate, setAttendanceRate] = useState<number>(85);

  // 2. Event Creator form
  const [eventPresetIdx, setEventPresetIdx] = useState<number>(0);
  const [customEventTitle, setCustomEventTitle] = useState<string>('');
  const [eventOrgId, setEventOrgId] = useState<string>('');
  const [eventTrack, setEventTrack] = useState<'COLLEGE' | 'SHS' | 'CAMPUS_WIDE'>('COLLEGE');
  const [eventCourses, setEventCourses] = useState<string[]>(['BSIT', 'BSCS']);
  const [eventSessionCount, setEventSessionCount] = useState<number>(1);
  const [eventHasTimeOut, setEventHasTimeOut] = useState<boolean>(true);
  const [eventProposalStatus, setEventProposalStatus] = useState<'approved' | 'pending_review' | 'draft'>('approved');
  const [eventTicketFee, setEventTicketFee] = useState<number>(150);
  const [eventEnablePayables, setEventEnablePayables] = useState<boolean>(true);

  // 3. Student form
  const [studentCount, setStudentCount] = useState<number>(10);
  const [studentTrack, setStudentTrack] = useState<'COLLEGE' | 'SHS' | 'MIXED'>('MIXED');
  const [selectedCourse, setSelectedCourse] = useState<string>('');

  // 4. Payables form
  const [payableOrgId, setPayableOrgId] = useState<string>('');
  const [payableTitle, setPayableTitle] = useState<string>('Membership Dues & Shirt Fee');
  const [payableAmount, setPayableAmount] = useState<number>(150);
  const [payablePaidPct, setPayablePaidPct] = useState<number>(80);

  // Resolved event for attendance
  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || events[0];
  }, [events, selectedEventId]);

  // Target-eligible students matching selected event's criteria
  const eligibleStudentsForEvent = useMemo(() => {
    if (!selectedEvent) return [];
    return students.filter((s) => isStudentEligibleForEvent(selectedEvent, s));
  }, [students, selectedEvent]);

  if (!isOpen) return null;

  // ── Handlers ──

  const handleApplyPreset = (idx: number) => {
    setEventPresetIdx(idx);
    const preset = EVENT_PRESETS[idx];
    if (preset) {
      setCustomEventTitle(preset.title);
      setEventTrack(preset.track);
      setEventCourses(preset.courses);
      setEventTicketFee(preset.fee);
      setEventEnablePayables(preset.fee > 0);
    }
  };

  const handleCreateEvent = async () => {
    const org = organizations.find((o) => o.id === eventOrgId) || organizations[0];
    const title = customEventTitle.trim() || EVENT_PRESETS[eventPresetIdx]?.title || 'Campus Academic Event';

    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const opts: SeedEventOptions = {
        title,
        hostingOrgId: org?.id,
        hostingOrgName: org?.name,
        academicTrack: eventTrack,
        targetCourses: eventCourses,
        sessionCount: eventSessionCount,
        hasTimeOut: eventHasTimeOut,
        proposalStatus: eventProposalStatus,
        enablePayables: eventEnablePayables,
        ticketFee: Number(eventTicketFee),
      };

      const created = await seedSampleEvent(opts);
      setSelectedEventId(created.id);
      setStatusMessage({
        type: 'success',
        text: `Created Event "${created.title}" with ${created.sessions.length} session(s) (${eventHasTimeOut ? 'Time-In & Time-Out' : 'Time-In Only'}) and ${created.proposalStatus.toUpperCase()} status!`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create event.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSeedAttendance = async () => {
    if (!selectedEvent) {
      setStatusMessage({ type: 'error', text: 'Please select or create an event first.' });
      return;
    }
    if (eligibleStudentsForEvent.length === 0) {
      setStatusMessage({
        type: 'error',
        text: `No students match this event's targeting criteria. Generate students matching ${(selectedEvent.targetCourses || []).join(', ') || selectedEvent.academicLevel || 'this event'} first!`,
      });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const res = await seedEventAttendance({
        event: selectedEvent,
        students: eligibleStudentsForEvent,
        sessionId: selectedSessionId,
        attendanceRate,
        strictTargeting: true,
      });
      setStatusMessage({
        type: 'success',
        text: `Injected ${res.totalInjected} attendance logs across ${res.sessionsCount} session(s) (${res.attendees} Unique Attendees) for "${selectedEvent.title}"! Gate pass rules and timeout configurations were strictly applied.`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to inject attendance.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSeedStudents = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const opts: SeedStudentOptions = {
        count: studentCount,
        track: studentTrack,
        courseCode: selectedCourse || undefined,
      };
      const created = await seedSampleStudents(opts);
      setStatusMessage({
        type: 'success',
        text: `Generated ${created.length} students with valid 11-digit IDs and sections! Matching event payables were automatically synchronized.`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to generate students.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSeedPayables = async () => {
    const org = organizations.find((o) => o.id === payableOrgId) || organizations[0];
    if (!org) {
      setStatusMessage({ type: 'error', text: 'Please select an organization.' });
      return;
    }
    if (students.length === 0) {
      setStatusMessage({ type: 'error', text: 'No students available. Generate students first!' });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const res = await seedPayables({
        organizationId: org.id,
        organizationName: org.name,
        students: students.slice(0, 30),
        title: payableTitle,
        amount: Number(payableAmount),
        type: 'dues',
        paidPercentage: payablePaidPct,
      });
      setStatusMessage({
        type: 'success',
        text: `Injected ${res.total} payables for ${org.name} (${res.paid} Paid, ${res.unpaid} Unpaid)!`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to seed payables.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurge = async () => {
    if (!confirm('Are you sure you want to purge only dev test-generated data? Real records will be preserved.')) {
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const res = await clearAllTestData();
      setStatusMessage({
        type: 'success',
        text: `Cleaned: ${res.events} test events, ${res.students} test students, ${res.attendance} test attendance records, and ${res.payables} test payables.`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to purge test data.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] text-left animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#001A4D] via-[#0E4EBD] to-[#001A4D] px-6 py-4 flex items-center justify-between text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFD41C]/20 border border-[#FFD41C]/40 flex items-center justify-center text-[#FFD41C]">
              <Zap className="w-4 h-4 fill-[#FFD41C]" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                STI Sync Dev Test Data Seeder
                <span className="text-[10px] bg-[#FFD41C] text-[#001A4D] px-1.5 py-0.5 rounded font-black uppercase">
                  Parity Flow
                </span>
              </h3>
              <p className="text-xs text-white/75">
                Generates realistic events, students, gatepass attendance, and payables matching DB maintenance schemas.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-gray-200 bg-gray-50/80 px-6 pt-2 gap-2 overflow-x-auto flex-shrink-0">
          {[
            { id: 'attendance', label: 'Event Attendance', icon: QrCode },
            { id: 'events', label: 'Create Event', icon: CalendarPlus },
            { id: 'students', label: 'Student Registry', icon: Users },
            { id: 'payables', label: 'Finance & Payables', icon: Wallet },
            { id: 'purge', label: 'Purge Test Data', icon: Trash2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setStatusMessage(null);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'border-[#0E4EBD] text-[#0E4EBD] bg-white rounded-t-lg shadow-2xs'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Status Message Banner */}
        {statusMessage && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs flex items-center gap-2 font-medium ${
              statusMessage.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Modal Body / Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* ═══════════ TAB 1: ATTENDANCE SEEDER ═══════════ */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Target Event</label>
                {events.length > 0 ? (
                  <select
                    value={selectedEventId || selectedEvent?.id || ''}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white text-[#001A4D] font-medium"
                  >
                    {events.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title} ({e.status || 'Active'}) — Expected: {e.expectedAttendees || e.expectedParticipantCount || 0}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                    No events found in database. Go to the <strong>Create Event</strong> tab to seed a test event first!
                  </div>
                )}
              </div>

              {/* Event Targeting Criteria Card */}
              {selectedEvent && (
                <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-[#001A4D]">
                      <Target className="w-4 h-4 text-[#0E4EBD]" />
                      <span>Event Participant Targeting Rules</span>
                    </div>
                    <span className="px-2 py-0.5 bg-[#001A4D] text-[#FFD41C] text-[10px] font-bold rounded-md">
                      {eligibleStudentsForEvent.length} of {students.length} Students Match
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-white p-2 rounded-lg border border-blue-100">
                      <span className="text-gray-400 block text-[10px]">Track</span>
                      <span className="font-bold text-[#001A4D]">{selectedEvent.academicLevel || 'College & SHS'}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-blue-100">
                      <span className="text-gray-400 block text-[10px]">Target Courses</span>
                      <span className="font-bold text-[#001A4D]">
                        {(selectedEvent.targetCourses || []).length > 0 ? selectedEvent.targetCourses.join(', ') : 'All Programs'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-blue-100">
                      <span className="text-gray-400 block text-[10px]">Target Year</span>
                      <span className="font-bold text-[#001A4D]">
                        {(selectedEvent.targetYearLevels || []).length > 0 ? selectedEvent.targetYearLevels.join(', ') : 'All Year Levels'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-blue-100">
                      <span className="text-gray-400 block text-[10px]">Target Sections</span>
                      <span className="font-bold text-[#001A4D]">
                        {(selectedEvent.targetSections || []).length > 0 ? selectedEvent.targetSections.join(', ') : 'All Sections'}
                      </span>
                    </div>
                  </div>

                  {eligibleStudentsForEvent.length === 0 && (
                    <div className="p-2 bg-amber-100/70 border border-amber-300 rounded-lg text-amber-900 text-[11px]">
                      ⚠️ <strong>No registered students match this event's criteria.</strong> Go to the <em>Student Registry</em> tab to generate students matching {(selectedEvent.targetCourses || []).join(', ') || selectedEvent.academicLevel || 'this event'}.
                    </div>
                  )}
                </div>
              )}

              {/* Session Selector & Gate Pass Rule Display */}
              {selectedEvent && (
                <div className="space-y-2">
                  <label className="block font-bold text-gray-700">Target Session & Gate Pass Mode</label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white text-[#001A4D] font-medium"
                  >
                    <option value="ALL">
                      All Sessions ({(selectedEvent.sessions || []).length || 1} Total)
                    </option>
                    {(selectedEvent.sessions || []).map((sess, idx) => (
                      <option key={sess.id || idx} value={sess.id || `sess-${idx}`}>
                        {sess.title || `Session ${idx + 1}`} ({sess.hasTimeOut ? 'Time-In & Time-Out' : 'Time-In Only'})
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {(selectedEvent.sessions && selectedEvent.sessions.length > 0 ? selectedEvent.sessions : [
                      { id: 'sess_main', title: 'Main Session', hasTimeOut: true, timeInOpen: '07:30', timeInClose: '09:00', timeOutOpen: '11:30', timeOutClose: '12:30' }
                    ]).map((s, idx) => {
                      const isTimeInOnly = s.hasTimeOut === false;
                      return (
                        <div
                          key={s.id || idx}
                          className="p-2.5 rounded-xl border border-gray-200 bg-gray-50/70 flex items-start justify-between"
                        >
                          <div>
                            <p className="font-bold text-[#001A4D]">{s.title || `Session ${idx + 1}`}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              Time-In: {s.timeInOpen || s.startTime || '08:00 AM'}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              Time-Out:{' '}
                              {isTimeInOnly ? (
                                <span className="text-amber-600 font-semibold">Not Required (Time-In Only)</span>
                              ) : (
                                s.timeOutOpen || s.endTime || '12:00 PM'
                              )}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isTimeInOnly
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-green-100 text-green-800 border border-green-300'
                            }`}
                          >
                            {isTimeInOnly ? '1 Gate (In)' : '2 Gates (In+Out)'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Attendance Turnout Rate: <span className="text-[#0E4EBD]">{attendanceRate}%</span>
                </label>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={5}
                  value={attendanceRate}
                  onChange={(e) => setAttendanceRate(Number(e.target.value))}
                  className="w-full accent-[#0E4EBD]"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>20% (Low)</span>
                  <span>85% (Average)</span>
                  <span>100% (Full)</span>
                </div>
              </div>

              <Button
                onClick={handleSeedAttendance}
                disabled={isProcessing || !selectedEvent || eligibleStudentsForEvent.length === 0}
                className="w-full bg-[#001A4D] hover:bg-[#0E4EBD] text-white font-bold py-2.5 rounded-xl cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <QrCode className="w-4 h-4 mr-2" />}
                Inject Attendance for {eligibleStudentsForEvent.length} Eligible Students
              </Button>
            </div>
          )}

          {/* ═══════════ TAB 2: CREATE EVENT SEEDER ═══════════ */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              {/* Event Preset Selector */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Quick Event Template Preset</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EVENT_PRESETS.map((p, idx) => (
                    <button
                      key={p.title}
                      type="button"
                      onClick={() => handleApplyPreset(idx)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        eventPresetIdx === idx
                          ? 'border-[#0E4EBD] bg-blue-50/70 ring-2 ring-[#0E4EBD]/20'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#001A4D] text-[11px] truncate block">{p.title}</span>
                        <span className="text-[9px] bg-blue-100 text-[#0E4EBD] px-1.5 py-0.5 rounded font-black">
                          {p.track}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 block truncate mt-0.5">{p.tagline}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Event Title */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Event Title</label>
                <input
                  type="text"
                  value={customEventTitle}
                  onChange={(e) => setCustomEventTitle(e.target.value)}
                  placeholder="e.g. STI Tech Summit 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                />
              </div>

              {/* Host Org & Academic Track */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Hosting Organization</label>
                  <select
                    value={eventOrgId || organizations[0]?.id || ''}
                    onChange={(e) => setEventOrgId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white text-[#001A4D]"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.category || 'Org'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Academic Track</label>
                  <select
                    value={eventTrack}
                    onChange={(e) => {
                      const t = e.target.value as any;
                      setEventTrack(t);
                      if (t === 'SHS') setEventCourses(['STEM', 'ABM']);
                      else if (t === 'COLLEGE') setEventCourses(['BSIT', 'BSCS']);
                      else setEventCourses([]);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white text-[#001A4D]"
                  >
                    <option value="COLLEGE">College (Semestral)</option>
                    <option value="SHS">Senior High School (Trimestral)</option>
                    <option value="CAMPUS_WIDE">Campus-Wide (All Tracks)</option>
                  </select>
                </div>
              </div>

              {/* Target Courses Selector */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Target Participant Courses / Strands</label>
                <div className="flex flex-wrap gap-1.5">
                  {(eventTrack === 'SHS' ? ['STEM', 'ABM', 'HUMSS', 'TVL'] : ['BSIT', 'BSCS', 'BSHM', 'BSTM', 'BSBA']).map((course) => {
                    const selected = eventCourses.includes(course);
                    return (
                      <button
                        key={course}
                        type="button"
                        onClick={() => {
                          if (selected) setEventCourses(eventCourses.filter((c) => c !== course));
                          else setEventCourses([...eventCourses, course]);
                        }}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                          selected
                            ? 'bg-[#0E4EBD] text-white border-[#0E4EBD]'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {course}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setEventCourses([])}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      eventCourses.length === 0
                        ? 'bg-[#001A4D] text-[#FFD41C] border-[#001A4D]'
                        : 'bg-white text-gray-500 border-gray-300'
                    }`}
                  >
                    All Courses (Open)
                  </button>
                </div>
              </div>

              {/* Sessions & Gatepass Config */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Sessions Count</label>
                  <select
                    value={eventSessionCount}
                    onChange={(e) => setEventSessionCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white text-[#001A4D]"
                  >
                    <option value={1}>1 Session (Half-Day)</option>
                    <option value={2}>2 Sessions (Morning + Afternoon)</option>
                    <option value={3}>3 Sessions (2-Day Event)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Gate Pass Mode</label>
                  <select
                    value={eventHasTimeOut ? 'both' : 'checkin_only'}
                    onChange={(e) => setEventHasTimeOut(e.target.value === 'both')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white text-[#001A4D]"
                  >
                    <option value="both">2 Gates: Time-In & Time-Out (Complete)</option>
                    <option value="checkin_only">1 Gate: Time-In Only (Checked In)</option>
                  </select>
                </div>
              </div>

              {/* Proposal Status & Payable Ticket Fee */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Event Proposal Lifecycle Status</label>
                  <select
                    value={eventProposalStatus}
                    onChange={(e) => setEventProposalStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white text-[#001A4D]"
                  >
                    <option value="approved">Approved (Live & Active for Attendance)</option>
                    <option value="pending_review">Pending Review (For SAO Review testing)</option>
                    <option value="draft">Draft (For Officer Proposal editing)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Participant Ticket Fee (PHP)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={eventTicketFee}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setEventTicketFee(v);
                        setEventEnablePayables(v > 0);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                      placeholder="0 (Free)"
                    />
                    <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={eventEnablePayables}
                        onChange={(e) => setEventEnablePayables(e.target.checked)}
                        className="rounded"
                      />
                      Sync Payables
                    </label>
                  </div>
                </div>
              </div>

              {/* Automatic DB Maintenance Info Banner */}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1">
                <p className="font-bold text-[#001A4D] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0E4EBD]" />
                  Database Maintenance Mappings Handled Automatically:
                </p>
                <p className="text-[11px] text-gray-600">
                  Maps real FKs to <code>/event_types</code>, <code>/event_categories</code>, <code>/venues</code>, active <code>/semesters</code>, generates 6-digit scanner code, realistic budget line items, and assigns officer scanners.
                </p>
              </div>

              <Button
                onClick={handleCreateEvent}
                disabled={isProcessing}
                className="w-full bg-[#001A4D] hover:bg-[#0E4EBD] text-white font-bold py-2.5 rounded-xl cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarPlus className="w-4 h-4 mr-2" />}
                Generate & Publish Test Event
              </Button>
            </div>
          )}

          {/* ═══════════ TAB 3: STUDENT GENERATOR ═══════════ */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Number of Students to Generate</label>
                <div className="flex gap-2">
                  {[5, 10, 25, 50].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setStudentCount(cnt)}
                      className={`flex-1 py-2 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                        studentCount === cnt
                          ? 'border-[#0E4EBD] bg-blue-50 text-[#0E4EBD]'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {cnt} Students
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Academic Track</label>
                  <select
                    value={studentTrack}
                    onChange={(e) => setStudentTrack(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white text-[#001A4D]"
                  >
                    <option value="MIXED">Mixed (College & SHS)</option>
                    <option value="COLLEGE">College Only (Semestral)</option>
                    <option value="SHS">Senior High School Only (Trimestral)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Specific Course/Strand (Optional)</label>
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white text-[#001A4D]"
                  >
                    <option value="">Auto-assign from Database Courses</option>
                    <option value="BSIT">BSIT</option>
                    <option value="BSCS">BSCS</option>
                    <option value="BSHM">BSHM</option>
                    <option value="BSBA">BSBA</option>
                    <option value="STEM">STEM (SHS)</option>
                    <option value="ABM">ABM (SHS)</option>
                    <option value="HUMSS">HUMSS (SHS)</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-gray-700 space-y-1.5">
                <p className="font-bold text-[#001A4D] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0E4EBD]" />
                  Full Registration Flow Parity:
                </p>
                <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-gray-600">
                  <li><strong>Unique Filipino Names:</strong> Randomly generated from 100,000+ non-repeating permutations.</li>
                  <li><strong>11-digit Student IDs:</strong> Strictly generated as <code>02000XXXXXX</code>.</li>
                  <li><strong>Live Academic Mapping:</strong> Mapped to registered Departments, Courses, and Sections in Firestore.</li>
                  <li><strong>Auto-Payable Synchronization:</strong> Background checks active events and creates payables if targeting matches!</li>
                </ul>
              </div>

              <Button
                onClick={handleSeedStudents}
                disabled={isProcessing}
                className="w-full bg-[#001A4D] hover:bg-[#0E4EBD] text-white font-bold py-2.5 rounded-xl cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Users className="w-4 h-4 mr-2" />}
                Generate {studentCount} Realistically-Enrolled Students
              </Button>
            </div>
          )}

          {/* ═══════════ TAB 4: PAYABLES SEEDER ═══════════ */}
          {activeTab === 'payables' && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Target Organization</label>
                <select
                  value={payableOrgId || organizations[0]?.id || ''}
                  onChange={(e) => setPayableOrgId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white text-[#001A4D]"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.category || 'College'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Fee Description</label>
                  <input
                    type="text"
                    value={payableTitle}
                    onChange={(e) => setPayableTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                    placeholder="e.g. Semestral Membership Due"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Fee Amount (PHP)</label>
                  <input
                    type="number"
                    value={payableAmount}
                    onChange={(e) => setPayableAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                    placeholder="150"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Collection Rate: <span className="text-green-600 font-bold">{payablePaidPct}% Paid</span> ({100 - payablePaidPct}% Unpaid)
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={payablePaidPct}
                  onChange={(e) => setPayablePaidPct(Number(e.target.value))}
                  className="w-full accent-green-600"
                />
              </div>

              <Button
                onClick={handleSeedPayables}
                disabled={isProcessing || organizations.length === 0}
                className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-2.5 rounded-xl cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
                Generate Student Payables Ledger
              </Button>
            </div>
          )}

          {/* ═══════════ TAB 5: PURGE TEST DATA ═══════════ */}
          {activeTab === 'purge' && (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-[#001A4D]">Purge Dev Test Data</h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                  This will safely delete only mock test records that were generated by this dev tool (identified with <code>isTestData: true</code>). Real registrations, actual events, and live settings will remain untouched.
                </p>
              </div>

              <Button
                onClick={handlePurge}
                disabled={isProcessing}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Confirm & Clean Test Records
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Current Database: {students.length} Students · {events.length} Events</span>
          <Button variant="ghost" onClick={onClose} className="text-xs text-gray-600 font-bold cursor-pointer">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
