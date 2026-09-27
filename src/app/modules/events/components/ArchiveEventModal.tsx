import React, { useState, useEffect } from 'react';
import {
  FolderArchive,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  Receipt,
  CreditCard,
  Users,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import type { EventDocument } from '../types/event.types';
import {
  checkEventArchiveReadiness,
  archiveEvent,
  EventArchiveReadinessSummary,
} from '../services/event-lifecycle.service';

interface ArchiveEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventDocument | null;
  adminUid: string;
  adminName?: string;
  onSuccess?: () => void;
}

export const ArchiveEventModal: React.FC<ArchiveEventModalProps> = ({
  isOpen,
  onClose,
  event,
  adminUid,
  adminName,
  onSuccess,
}) => {
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [readiness, setReadiness] = useState<EventArchiveReadinessSummary | null>(null);
  const [reason, setReason] = useState('Event Concluded & Audited');
  const [waiveUnpaid, setWaiveUnpaid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !event) return;

    let isMounted = true;
    setLoadingCheck(true);

    checkEventArchiveReadiness(event.id)
      .then((res) => {
        if (isMounted) {
          setReadiness(res);
        }
      })
      .catch((err) => {
        console.error('[ArchiveEventModal] Readiness check error:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingCheck(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, event]);

  if (!isOpen || !event) return null;

  const handleArchive = async () => {
    if (!readiness?.canArchive) return;

    try {
      setIsSubmitting(true);
      await archiveEvent(event.id, adminUid, adminName, {
        reason: reason.trim() || 'Event Concluded & Audited',
        waiveUnpaidPayables: waiveUnpaid,
      });

      toast.success(`Event "${event.title}" has been safely archived!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[ArchiveEventModal] Error:', err);
      toast.error(err.message || 'Failed to archive event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <FolderArchive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Archive Event</h2>
              <p className="text-xs text-blue-100">Preserve records and seal historical event data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Event Header info */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
              {event.referenceId || 'EVT-REF'}
            </span>
            <h3 className="font-bold text-slate-900 dark:text-white text-base mt-0.5">
              {event.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Academic Year: {event.schoolYear || 'N/A'} • {event.semester || 'Current Semester'}
            </p>
          </div>

          {/* Readiness Checklist Loader */}
          {loadingCheck ? (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Running Pre-Archive Verification Checklist...</p>
            </div>
          ) : readiness ? (
            <div className="space-y-4">
              {/* Checklist Grid */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Verification Requirements:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Concluded Status */}
                  <div className="p-3 rounded-xl border bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Event Concluded
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      Passed
                    </span>
                  </div>

                  {/* Financial Liquidation */}
                  <div className="p-3 rounded-xl border bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Receipt className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Liquidation
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-bold ${
                        readiness.unapprovedLiquidationsCount === 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {readiness.unapprovedLiquidationsCount === 0 ? 'Approved / Settled' : 'Pending Review'}
                    </span>
                  </div>

                  {/* Student Payables / Refunds */}
                  <div className="p-3 rounded-xl border bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CreditCard className="w-4 h-4 text-blue-500" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Pending Refunds
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-bold ${
                        readiness.pendingRefundsCount === 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {readiness.pendingRefundsCount === 0 ? '0 Pending' : `${readiness.pendingRefundsCount} Pending`}
                    </span>
                  </div>

                  {/* Attendance Logged */}
                  <div className="p-3 rounded-xl border bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-violet-500" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Attendance Logs
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {readiness.attendanceCount} Logged
                    </span>
                  </div>
                </div>
              </div>

              {/* Blocking Reasons Alert */}
              {readiness.blockingReasons.length > 0 && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 space-y-2">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-xs font-bold">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Archiving Blocked by Unresolved Dependencies</span>
                  </div>
                  <ul className="text-xs text-red-600 dark:text-red-300 space-y-1 list-disc list-inside">
                    {readiness.blockingReasons.map((reasonText, idx) => (
                      <li key={idx}>{reasonText}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Informational Warnings */}
              {readiness.warnings.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-xs font-bold">
                    <Info className="w-4 h-4" />
                    <span>Payables Ledger Notice</span>
                  </div>
                  <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                    {readiness.warnings.map((wText, idx) => (
                      <li key={idx}>• {wText}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Form Options when Ready */}
              {readiness.canArchive && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Archiving Reason
                    </label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. End of Semester Rollover / Event Concluded"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {readiness.unpaidPayablesCount > 0 && (
                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={waiveUnpaid}
                        onChange={(e) => setWaiveUnpaid(e.target.checked)}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-900 dark:text-white">
                          Waive remaining unpaid student dues
                        </span>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                          If unchecked (recommended), existing unpaid payables will remain on students' active clearance balance.
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Archived events can be restored at any time in Archive Center.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleArchive}
              disabled={!readiness?.canArchive || isSubmitting || loadingCheck}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Archiving Event...</span>
                </>
              ) : (
                <>
                  <FolderArchive className="w-4 h-4" />
                  <span>Confirm & Archive</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchiveEventModal;
