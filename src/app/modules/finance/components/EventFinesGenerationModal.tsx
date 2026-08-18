import { useState, useMemo, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Coins,
  CheckCircle2,
  Clock,
  Calendar,
  Users,
  Copy,
  RotateCcw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEventPayablesStream } from '../hooks/usePayableStream';
import { formatCurrency } from '../../../utils/currency';
import { generateDynamicEventFines } from '../services/payable.service';
import type { SessionFineRule, FineViolationDetail } from '../types/payable.types';
import type { EnrichedAttendanceRecord } from '../../attendance/types/attendance.types';

interface EventFinesGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    id: string;
    name?: string;
    title?: string;
    sessions?: Array<{
      id: string;
      title?: string;
      label?: string;
      date?: string;
      startTime?: string;
      endTime?: string;
      timeStart?: string;
      timeEnd?: string;
      hasTimeOut?: boolean;
    }>;
    status?: string;
    semesterId?: string;
    hostingOrgId?: string;
    hostingOrgName?: string;
    org?: string;
    latePenaltyAmount?: number | null;
  } | null;
  isOfficer: boolean;
  isReadOnly?: boolean;
  attendanceRecords: EnrichedAttendanceRecord[];
  currentUserId: string;
  onSuccess?: () => void;
}

export function EventFinesGenerationModal({
  isOpen,
  onClose,
  event,
  isOfficer,
  isReadOnly = false,
  attendanceRecords,
  currentUserId,
  onSuccess,
}: EventFinesGenerationModalProps) {
  if (!isOpen || !event) return null;

  const eventTitle = event.name || event.title || 'Event';
  const defaultPenalty = Number(event.latePenaltyAmount) || 10;

  const { data: existingPayables } = useEventPayablesStream(event.id);
  const hasAssessedFines = useMemo(() => {
    if (isReadOnly) return true;
    const targetType = isOfficer ? 'org_fine' : 'admin_fine';
    return (existingPayables || []).some((p) => p.type === targetType);
  }, [existingPayables, isOfficer, isReadOnly]);

  const effectiveReadOnly = Boolean(isReadOnly || hasAssessedFines);

  // Normalized sessions
  const sessions = useMemo(() => {
    if (event.sessions && event.sessions.length > 0) {
      return event.sessions.map((s, idx) => ({
        id: s.id || `session-${idx}`,
        title: s.title || s.label || `Session ${idx + 1}`,
        date: s.date || 'TBA',
        timeStart: s.startTime || s.timeStart || '8:00 AM',
        timeEnd: s.endTime || s.timeEnd || '5:00 PM',
        hasTimeOut: Boolean(s.hasTimeOut),
      }));
    }
    return [
      {
        id: `${event.id}-main`,
        title: 'Main Session',
        date: 'Event Date',
        timeStart: '8:00 AM',
        timeEnd: '5:00 PM',
        hasTimeOut: false,
      },
    ];
  }, [event]);

  // Initial fine rules state per session
  const [rules, setRules] = useState<SessionFineRule[]>(() => {
    return sessions.map((s) => ({
      sessionId: s.id,
      sessionTitle: s.title,
      timeInAbsentAmount: defaultPenalty,
      timeInLateAmount: Math.max(1, Math.round(defaultPenalty / 2)),
      timeOutAbsentAmount: defaultPenalty,
      enableTimeInAbsent: true,
      enableTimeInLate: true,
      enableTimeOutAbsent: s.hasTimeOut,
    }));
  });

  // Re-sync rules when sessions change
  useEffect(() => {
    setRules(
      sessions.map((s) => ({
        sessionId: s.id,
        sessionTitle: s.title,
        timeInAbsentAmount: defaultPenalty,
        timeInLateAmount: Math.max(1, Math.round(defaultPenalty / 2)),
        timeOutAbsentAmount: defaultPenalty,
        enableTimeInAbsent: true,
        enableTimeInLate: true,
        enableTimeOutAbsent: s.hasTimeOut,
      }))
    );
  }, [sessions, defaultPenalty]);

  const [previewExpanded, setPreviewExpanded] = useState(true);
  const [previewSearch, setPreviewSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // 2 weeks default
    return d.toISOString().split('T')[0];
  });

  // Check event ended status
  const isEventEnded = useMemo(() => {
    const status = (event.status || '').toLowerCase();
    if (status === 'completed' || status === 'ended') return true;

    // Check last session date/time if available
    const lastSession = sessions[sessions.length - 1];
    if (lastSession && lastSession.date && lastSession.date !== 'TBA') {
      const now = new Date();
      const sessionDate = new Date(lastSession.date);
      // If session date was in the past (before today's midnight)
      if (sessionDate.getTime() + 86400000 < now.getTime()) {
        return true;
      }
    }
    return false;
  }, [event.status, sessions]);

  // Rule change handler
  const handleRuleChange = (
    sessionId: string,
    field: keyof SessionFineRule,
    value: any
  ) => {
    if (effectiveReadOnly) return;
    setRules((prev) =>
      prev.map((r) => (r.sessionId === sessionId ? { ...r, [field]: value } : r))
    );
  };

  // Quick preset: Apply Session 1 to all
  const handleApplyToAll = () => {
    if (effectiveReadOnly || rules.length <= 1) return;
    const base = rules[0];
    setRules((prev) =>
      prev.map((r, idx) =>
        idx === 0
          ? r
          : {
              ...r,
              timeInAbsentAmount: base.timeInAbsentAmount,
              timeInLateAmount: base.timeInLateAmount,
              timeOutAbsentAmount: base.timeOutAbsentAmount,
              enableTimeInAbsent: base.enableTimeInAbsent,
              enableTimeInLate: base.enableTimeInLate,
              enableTimeOutAbsent: r.enableTimeOutAbsent ? base.enableTimeOutAbsent : false,
            }
      )
    );
    toast.info('Applied Session 1 rules to all sessions.');
  };

  // Quick preset: Reset defaults
  const handleResetDefaults = () => {
    if (effectiveReadOnly) return;
    setRules(
      sessions.map((s) => ({
        sessionId: s.id,
        sessionTitle: s.title,
        timeInAbsentAmount: defaultPenalty,
        timeInLateAmount: Math.max(1, Math.round(defaultPenalty / 2)),
        timeOutAbsentAmount: defaultPenalty,
        enableTimeInAbsent: true,
        enableTimeInLate: true,
        enableTimeOutAbsent: s.hasTimeOut,
      }))
    );
    toast.info('Reset all session rules to default values.');
  };

  // Real-time violation simulation
  const simulation = useMemo(() => {
    const studentViolationsMap = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        departmentName?: string;
        courseCode?: string;
        section?: string;
        violations: FineViolationDetail[];
        totalFine: number;
      }
    >();

    const rulesMap = new Map<string, SessionFineRule>();
    rules.forEach((r) => rulesMap.set(r.sessionId, r));

    // Group attendance records by student
    const studentRecordsMap = new Map<string, EnrichedAttendanceRecord[]>();
    attendanceRecords.forEach((rec) => {
      const sId = (rec.studentId || '').trim();
      if (!sId) return;
      if (!studentRecordsMap.has(sId)) {
        studentRecordsMap.set(sId, []);
      }
      studentRecordsMap.get(sId)!.push(rec);
    });

    let countAbsent = 0;
    let countLate = 0;
    let countMissedTimeOut = 0;
    let totalFineSum = 0;

    studentRecordsMap.forEach((records, studentId) => {
      const firstRec = records[0];
      const studentName = firstRec?.name || 'Student';
      const studentAuthUid = (firstRec as any)?.studentAuthUid || (firstRec as any)?.authUid || studentId;
      const studentSchoolId = (firstRec as any)?.studentSchoolId || (firstRec as any)?.studentId || studentId;
      const departmentName = firstRec?.departmentCode || firstRec?.departmentName;
      const courseCode = firstRec?.courseCode;
      const section = firstRec?.section;
      const violations: FineViolationDetail[] = [];
      let studentFineSum = 0;

      sessions.forEach((sess, sIdx) => {
        const rule = rulesMap.get(sess.id) || rules[sIdx];
        if (!rule) return;

        const record = records.find(
          (r) => r.sessionId === sess.id || (!r.sessionId && sIdx === 0)
        );

        if (!record || record.status === 'Absent') {
          if (rule.enableTimeInAbsent && rule.timeInAbsentAmount > 0) {
            violations.push({
              sessionId: sess.id,
              sessionTitle: sess.title,
              violationType: 'time_in_absent',
              amount: rule.timeInAbsentAmount,
              description: `Absent on ${sess.title}`,
            });
            studentFineSum += rule.timeInAbsentAmount;
            countAbsent++;
          }
        } else if (record.status === 'Late') {
          if (rule.enableTimeInLate && rule.timeInLateAmount > 0) {
            violations.push({
              sessionId: sess.id,
              sessionTitle: sess.title,
              violationType: 'time_in_late',
              amount: rule.timeInLateAmount,
              description: `Late Arrival on ${sess.title}`,
            });
            studentFineSum += rule.timeInLateAmount;
            countLate++;
          }
        }

        if (sess.hasTimeOut && rule.enableTimeOutAbsent && rule.timeOutAbsentAmount > 0) {
          const hasTimeOut =
            record &&
            record.checkOut &&
            record.checkOut !== '—' &&
            record.checkOut !== 'N/A' &&
            record.status !== 'Absent';

          if (!hasTimeOut && record && record.status !== 'Absent') {
            violations.push({
              sessionId: sess.id,
              sessionTitle: sess.title,
              violationType: 'time_out_absent',
              amount: rule.timeOutAbsentAmount,
              description: `Missed Time-Out on ${sess.title}`,
            });
            studentFineSum += rule.timeOutAbsentAmount;
            countMissedTimeOut++;
          }
        }
      });

      if (violations.length > 0 && studentFineSum > 0) {
        totalFineSum += studentFineSum;
        studentViolationsMap.set(studentId, {
          studentId: studentAuthUid,
          studentSchoolId,
          studentName,
          departmentName,
          courseCode,
          section,
          violations,
          totalFine: studentFineSum,
        });
      }
    });

    const studentsList = Array.from(studentViolationsMap.values()).sort(
      (a, b) => b.totalFine - a.totalFine
    );

    return {
      studentsList,
      totalStudentsWithFines: studentsList.length,
      totalFineSum,
      countAbsent,
      countLate,
      countMissedTimeOut,
    };
  }, [rules, sessions, attendanceRecords]);

  // Filtered preview student list
  const filteredStudentsList = useMemo(() => {
    if (!previewSearch.trim()) return simulation.studentsList;
    const q = previewSearch.trim().toLowerCase();
    return simulation.studentsList.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        ((s as any).studentSchoolId && (s as any).studentSchoolId.toLowerCase().includes(q)) ||
        (s.courseCode && s.courseCode.toLowerCase().includes(q)) ||
        (s.section && s.section.toLowerCase().includes(q))
    );
  }, [simulation.studentsList, previewSearch]);

  // Form submission handler
  const handleSubmit = async () => {
    if (effectiveReadOnly) return;
    if (simulation.totalStudentsWithFines === 0) {
      toast.info('No students with fine violations found under the current rules.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await generateDynamicEventFines({
        eventId: event.id,
        eventTitle,
        semesterId: event.semesterId || 'active',
        rules,
        createdBy: currentUserId || (isOfficer ? 'officer' : 'sao_admin'),
        isOfficer,
        hostingOrgId: event.hostingOrgId || null,
        hostingOrgName: event.hostingOrgName || event.org || null,
        dueDate,
        studentViolations: simulation.studentsList.map((s) => ({
          studentId: s.studentId,
          studentSchoolId: (s as any).studentSchoolId || s.studentId,
          studentName: s.studentName,
          violations: s.violations,
          totalFine: s.totalFine,
        })),
        rawAttendanceRecords: attendanceRecords,
      });

      toast.success(
        `Generated ${res.created} fine payable(s) for ${eventTitle} (Total: ${formatCurrency(res.totalAmount)}).${
          res.updated > 0 ? ` Updated ${res.updated} existing record(s).` : ''
        }`
      );

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('[EventFinesGenerationModal] Error generating fines:', err);
      toast.error(err?.message || 'Failed to generate event fines.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-[#E0E0E0]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#001A4D] via-[#002B7F] to-[#0E4EBD] px-6 py-5 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Coins className="w-6 h-6 text-[#FFD41C]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg leading-tight">
                  {effectiveReadOnly ? 'View Assessed Event Fines' : 'Configure & Assess Event Fines'}
                </h3>
                <span className="px-2 py-0.5 bg-[#FFD41C] text-[#001A4D] font-bold text-xs rounded-full uppercase">
                  {effectiveReadOnly ? 'View Mode' : isOfficer ? 'Club Violation Fines' : 'SAO Institutional Fines'}
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5 truncate max-w-lg">
                {eventTitle} • {sessions.length} Session(s)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-gray-50/50">
          {/* View-Only Banner */}
          {effectiveReadOnly && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-xs text-blue-900 shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm block text-[#001A4D]">Event Fines Already Assessed (View Mode)</span>
                <p className="mt-0.5 text-blue-800">
                  Fines for this event have already been configured and generated. The fine matrix and simulated student breakdown are displayed in view-only mode and locked from modification.
                </p>
              </div>
            </div>
          )}

          {/* Lifecycle Warning Banner if event not ended */}
          {!isEventEnded && !effectiveReadOnly && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-800 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm block text-amber-900">Event is Not Concluded</span>
                <p className="mt-0.5">
                  Fines can only be officially assessed and generated once the event attendance has concluded. Please finalize all attendee check-ins/check-outs before generating fine obligations.
                </p>
              </div>
            </div>
          )}

          {/* Due Date & Presets Configuration Banner */}
          <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-[#0E4EBD] rounded-lg">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#001A4D]">Fine Payment Settlement Due Date</label>
                <input
                  type="date"
                  disabled={effectiveReadOnly}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 bg-white focus:ring-2 focus:ring-[#0E4EBD]/30 outline-none disabled:bg-gray-100 disabled:text-gray-500 cursor-pointer"
                />
              </div>
            </div>
            {!effectiveReadOnly && (
              <div className="flex items-center gap-2">
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={handleApplyToAll}
                    className="px-3 py-1.5 bg-blue-50 text-[#0E4EBD] border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Apply Session 1 to All
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Defaults
                </button>
              </div>
            )}
          </div>

          {/* Dynamic Sessions Grid: 1-2 sessions in equal grid, 3+ in horizontal scroll */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[#001A4D] uppercase tracking-wide">
                  Session Fine Rules Matrix ({sessions.length})
                </h4>
                {sessions.length > 2 && (
                  <span className="text-[10px] px-2.5 py-0.5 bg-blue-50 text-[#0E4EBD] font-bold rounded-full border border-blue-100 flex items-center gap-1">
                    <span>←</span> Scroll Sideward ({sessions.length} Sessions) <span>→</span>
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400">Customized per session timeline</span>
            </div>

            <div
              className={
                sessions.length <= 2
                  ? "grid grid-cols-1 md:grid-cols-2 gap-4 w-full"
                  : "flex gap-4 overflow-x-auto pb-3 pt-1 snap-x scrollbar-thin"
              }
            >
              {sessions.map((s, idx) => {
                const rule = rules.find((r) => r.sessionId === s.id) || rules[idx];
                if (!rule) return null;

                return (
                  <div
                    key={s.id}
                    className={`bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs space-y-3.5 relative overflow-hidden snap-start hover:border-[#0E4EBD]/40 transition-colors ${
                      sessions.length === 1
                        ? 'w-full md:col-span-2'
                        : sessions.length === 2
                        ? 'w-full'
                        : 'w-[320px] sm:w-[360px] flex-shrink-0'
                    }`}
                  >
                    {/* Session Header */}
                    <div className="flex items-start justify-between border-b border-gray-100 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 bg-[#001A4D] text-[#FFD41C] font-bold text-xs rounded-full flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <h5 className="font-bold text-sm text-[#001A4D]">{s.title}</h5>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {s.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            {s.timeStart} – {s.timeEnd}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          s.hasTimeOut
                            ? 'bg-blue-50 text-[#0E4EBD] border border-blue-100'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {s.hasTimeOut ? 'Time-In & Out' : 'Time-In Only'}
                      </span>
                    </div>

                    {/* Rule 1: Time-In Absent */}
                    <div className="flex items-center justify-between text-xs bg-gray-50/80 p-2.5 rounded-lg border border-gray-100">
                      <label className={`flex items-center gap-2 select-none ${effectiveReadOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          disabled={effectiveReadOnly}
                          checked={rule.enableTimeInAbsent}
                          onChange={(e) =>
                            handleRuleChange(s.id, 'enableTimeInAbsent', e.target.checked)
                          }
                          className="w-4 h-4 rounded text-[#0E4EBD] focus:ring-[#0E4EBD] cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className="font-semibold text-gray-800">Time-In Absent</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 font-bold text-xs">₱</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={effectiveReadOnly || !rule.enableTimeInAbsent}
                          value={rule.timeInAbsentAmount}
                          onChange={(e) =>
                            handleRuleChange(
                              s.id,
                              'timeInAbsentAmount',
                              Math.max(0, Number(e.target.value))
                            )
                          }
                          className={`w-20 px-2 py-1 border rounded text-right text-xs font-bold ${
                            !effectiveReadOnly && rule.enableTimeInAbsent
                              ? 'border-gray-300 text-[#001A4D] bg-white focus:ring-1 focus:ring-[#0E4EBD]'
                              : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Rule 2: Time-In Late */}
                    <div className="flex items-center justify-between text-xs bg-gray-50/80 p-2.5 rounded-lg border border-gray-100">
                      <label className={`flex items-center gap-2 select-none ${effectiveReadOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          disabled={effectiveReadOnly}
                          checked={rule.enableTimeInLate}
                          onChange={(e) =>
                            handleRuleChange(s.id, 'enableTimeInLate', e.target.checked)
                          }
                          className="w-4 h-4 rounded text-[#0E4EBD] focus:ring-[#0E4EBD] cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className="font-semibold text-gray-800">Time-In Late Arrival</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 font-bold text-xs">₱</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={effectiveReadOnly || !rule.enableTimeInLate}
                          value={rule.timeInLateAmount}
                          onChange={(e) =>
                            handleRuleChange(
                              s.id,
                              'timeInLateAmount',
                              Math.max(0, Number(e.target.value))
                            )
                          }
                          className={`w-20 px-2 py-1 border rounded text-right text-xs font-bold ${
                            !effectiveReadOnly && rule.enableTimeInLate
                              ? 'border-gray-300 text-[#001A4D] bg-white focus:ring-1 focus:ring-[#0E4EBD]'
                              : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Rule 3: Time-Out Absent / Missed */}
                    <div
                      className={`flex items-center justify-between text-xs p-2.5 rounded-lg border ${
                        s.hasTimeOut
                          ? 'bg-gray-50/80 border-gray-100'
                          : 'bg-gray-100/50 border-dashed border-gray-200 opacity-60'
                      }`}
                    >
                      <label
                        className={`flex items-center gap-2 select-none ${
                          s.hasTimeOut && !effectiveReadOnly ? 'cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={effectiveReadOnly || !s.hasTimeOut}
                          checked={s.hasTimeOut && rule.enableTimeOutAbsent}
                          onChange={(e) =>
                            handleRuleChange(s.id, 'enableTimeOutAbsent', e.target.checked)
                          }
                          className="w-4 h-4 rounded text-[#0E4EBD] focus:ring-[#0E4EBD] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="font-semibold text-gray-800">
                          Time-Out Missed / Absent
                        </span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 font-bold text-xs">₱</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={effectiveReadOnly || !s.hasTimeOut || !rule.enableTimeOutAbsent}
                          value={rule.timeOutAbsentAmount}
                          onChange={(e) =>
                            handleRuleChange(
                              s.id,
                              'timeOutAbsentAmount',
                              Math.max(0, Number(e.target.value))
                            )
                          }
                          className={`w-20 px-2 py-1 border rounded text-right text-xs font-bold ${
                            !effectiveReadOnly && s.hasTimeOut && rule.enableTimeOutAbsent
                              ? 'border-gray-300 text-[#001A4D] bg-white focus:ring-1 focus:ring-[#0E4EBD]'
                              : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time Calculation Simulation Panel */}
          <div className="bg-white border border-[#E0E0E0] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h4 className="font-bold text-sm text-[#001A4D] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#0E4EBD]" />
                  <span>Fine Calculation Preview & Breakdown</span>
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Live calculation based on {attendanceRecords.length} scanned attendance record(s)
                </p>
              </div>

              {/* Simulation KPI Badges */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">
                    Total Estimated Fines
                  </span>
                  <span className="text-lg font-bold text-[#001A4D]">
                    {formatCurrency(simulation.totalFineSum)}
                  </span>
                </div>
                <div className="px-3 py-1 bg-blue-50 text-[#0E4EBD] rounded-lg text-xs font-bold border border-blue-100">
                  {simulation.totalStudentsWithFines} Students
                </div>
              </div>
            </div>

            {/* Violation Breakdown KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-red-50/60 border border-red-100 rounded-lg p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-red-600 block">
                  Time-In Absent
                </span>
                <span className="text-lg font-bold text-red-700">
                  {simulation.countAbsent}
                </span>
              </div>
              <div className="bg-orange-50/60 border border-orange-100 rounded-lg p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-orange-600 block">
                  Late Arrivals
                </span>
                <span className="text-lg font-bold text-orange-700">
                  {simulation.countLate}
                </span>
              </div>
              <div className="bg-amber-50/60 border border-amber-100 rounded-lg p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-amber-600 block">
                  Missed Time-Out
                </span>
                <span className="text-lg font-bold text-amber-700">
                  {simulation.countMissedTimeOut}
                </span>
              </div>
            </div>

            {/* Expandable Affected Students Roster */}
            {simulation.studentsList.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden mt-4">
                <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
                  <button
                    type="button"
                    onClick={() => setPreviewExpanded(!previewExpanded)}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-gray-900 cursor-pointer"
                  >
                    {previewExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                    <span>
                      Affected Students List ({simulation.studentsList.length})
                    </span>
                  </button>

                  {previewExpanded && (
                    <input
                      type="text"
                      placeholder="Filter preview..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-[#0E4EBD] bg-white w-44"
                    />
                  )}
                </div>

                {previewExpanded && (
                  <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-gray-100 text-gray-600 font-semibold text-[11px] sticky top-0">
                        <tr>
                          <th className="p-2.5">Student</th>
                          <th className="p-2.5">Violations Detail</th>
                          <th className="p-2.5 text-right">Total Fine</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredStudentsList.map((s) => (
                          <tr key={s.studentId} className="hover:bg-gray-50/80 transition-colors">
                            <td className="p-2.5">
                              <span className="font-bold text-[#001A4D] block">{s.studentName}</span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                ID: {(s as any).studentSchoolId || s.studentId} {s.courseCode ? `• ${s.courseCode}` : ''}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <div className="flex flex-wrap gap-1">
                                {s.violations.map((v, vIdx) => (
                                  <span
                                    key={vIdx}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                      v.violationType === 'time_in_absent'
                                        ? 'bg-red-100 text-red-700'
                                        : v.violationType === 'time_in_late'
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    {v.description} ({formatCurrency(v.amount)})
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-2.5 text-right font-bold text-[#001A4D]">
                              {formatCurrency(s.totalFine)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Target Ledger:{' '}
            <strong className="text-[#001A4D]">
              {isOfficer ? 'Organization Budget Ledger' : 'SAO Institutional Budget Ledger'}
            </strong>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              {effectiveReadOnly ? 'Close' : 'Cancel'}
            </button>
            {effectiveReadOnly ? (
              <button
                type="button"
                disabled={true}
                className="px-5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-2 cursor-not-allowed shadow-none select-none"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Fines Already Assessed ({formatCurrency(simulation.totalFineSum)})
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || simulation.totalStudentsWithFines === 0}
                className="px-5 py-2 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating Fines...
                  </>
                ) : (
                  <>
                    <Coins className="w-3.5 h-3.5 text-[#FFD41C]" />
                    Generate Fines ({formatCurrency(simulation.totalFineSum)})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
