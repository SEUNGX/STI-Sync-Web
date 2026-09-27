import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Lock,
  X,
  Clock,
  Calendar,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { EventDocument } from '../types/event.types';
import { concludeEvent } from '../services/event-lifecycle.service';

interface ConcludeEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventDocument | null;
  adminUid: string;
  adminName?: string;
  onSuccess?: () => void;
}

export const ConcludeEventModal: React.FC<ConcludeEventModalProps> = ({
  isOpen,
  onClose,
  event,
  adminUid,
  adminName,
  onSuccess,
}) => {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !event) return null;

  // Check if scheduled sessions are finished
  const sessions = event.sessions || [];
  const now = new Date();
  let hasFutureSessions = false;

  for (const s of sessions) {
    if (!s.date) continue;
    const dateStr = typeof s.date === 'string' ? s.date.split('T')[0] : '';
    if (!dateStr) continue;
    const [year, month, day] = dateStr.split('-').map(Number);
    const endParts = (s.endTime || '23:59').split(':').map(Number);
    const end = new Date(year, month - 1, day, endParts[0] || 23, endParts[1] || 59, 59);

    if (now < end) {
      hasFutureSessions = true;
      break;
    }
  }

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await concludeEvent(event.id, adminUid, adminName, note);
      toast.success(`Event "${event.title}" is now marked as Completed!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[ConcludeEventModal] Error:', err);
      toast.error(err.message || 'Failed to conclude event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Conclude & Complete Event</h2>
              <p className="text-xs text-emerald-100">Finalize event lifecycle and lock attendance</p>
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
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
                {event.referenceId || 'EVT-REF'}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                Ready for Completion
              </span>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">
              {event.title}
            </h3>
            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {sessions.length} Session(s)
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {event.schoolYear || 'Current AY'}
              </span>
            </div>
          </div>

          {/* Early Conclude Warning */}
          {hasFutureSessions && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                <span className="font-bold">Scheduled sessions are not finished yet.</span> Concluding early will immediately lock live attendance scanners and stop gate admissions.
              </div>
            </div>
          )}

          {/* Action Impact List */}
          <div className="space-y-2.5 pt-1">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              What happens when you conclude this event:
            </p>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <li className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>Locks Attendance Scanners:</strong> QR check-in gates are sealed from new scans.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>Unlocks Post-Event Workflows:</strong> Enables financial liquidation submission, certificate distribution, and eventual archiving.</span>
              </li>
            </ul>
          </div>

          {/* Optional Note */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Closing Remarks / Notes (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Event successfully concluded with all attendees accounted for."
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Concluding Event...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Conclude Event</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConcludeEventModal;
