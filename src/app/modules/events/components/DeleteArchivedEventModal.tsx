import React, { useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import type { EventDocument } from '../types/event.types';
import { softDeleteArchivedEvent } from '../services/event-lifecycle.service';

interface DeleteArchivedEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventDocument | null;
  adminUid: string;
  adminName?: string;
  onSuccess?: () => void;
}

export const DeleteArchivedEventModal: React.FC<DeleteArchivedEventModalProps> = ({
  isOpen,
  onClose,
  event,
  adminUid,
  adminName,
  onSuccess,
}) => {
  const [confirmKeyword, setConfirmKeyword] = useState('');
  const [reason, setReason] = useState('Moved to Trash from Archive');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !event) return null;

  const isConfirmed = confirmKeyword.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!isConfirmed) return;

    try {
      setIsSubmitting(true);
      await softDeleteArchivedEvent(
        event.id,
        adminUid,
        adminName,
        reason.trim() || 'Soft-deleted from Archive'
      );
      toast.success(`Event "${event.title}" was moved to the Archive Center Trash.`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[DeleteArchivedEventModal] Error:', err);
      toast.error(err.message || 'Failed to delete event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Delete Archived Event</h2>
              <p className="text-xs text-red-100">Send archived event to Archive Center Trash</p>
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
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 dark:text-red-200 space-y-1">
              <p className="font-bold">This will remove the event from all standard lists.</p>
              <p className="text-slate-600 dark:text-slate-400">
                The event will be placed into the <strong>Archive Center Trash</strong>. Existing student payables and attendance records are preserved for accounting audit purposes.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Target Event
            </span>
            <p className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
              {event.title}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Reference: <span className="font-mono">{event.referenceId || event.id}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Reason for Deletion
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Obsolete record / Cleanup"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              To confirm, type <span className="font-mono font-bold text-red-600 dark:text-red-400">DELETE</span> below:
            </label>
            <input
              type="text"
              value={confirmKeyword}
              onChange={(e) => setConfirmKeyword(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Can be restored within 30 days.
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={!isConfirmed || isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting Event...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Delete</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteArchivedEventModal;
