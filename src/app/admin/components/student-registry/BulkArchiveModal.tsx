import { useState } from 'react';
import { X, Archive, AlertTriangle, Loader2, Users } from 'lucide-react';
import type { StudentDocument } from '../../../modules/students/types/student.types';
import { bulkArchiveStudents } from '../../../modules/students/services/student.service';
import { toast } from 'sonner';

interface BulkArchiveModalProps {
  selectedStudents: StudentDocument[];
  adminUid: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BULK_ARCHIVE_REASONS = [
  'Did Not Confirm Re-enrollment',
  'Graduated',
  'Transferred to Another School',
  'Dropped Out',
  'Manual Batch Archival',
  'Other',
];

export default function BulkArchiveModal({
  selectedStudents,
  adminUid,
  isOpen,
  onClose,
  onSuccess,
}: BulkArchiveModalProps) {
  const [reason, setReason] = useState(BULK_ARCHIVE_REASONS[0]);
  const [customNote, setCustomNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || selectedStudents.length === 0) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const finalReason = reason === 'Other' && customNote.trim() ? customNote.trim() : reason;
      const ids = selectedStudents.map((s) => s.id);
      await bulkArchiveStudents(ids, adminUid, finalReason);
      toast.success(`Successfully archived ${ids.length} student account(s).`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Bulk archive error:', err);
      toast.error(`Failed to archive students: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-amber-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-800 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Archive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Bulk Archive Inactive Accounts</h3>
              <p className="text-xs text-white/80">{selectedStudents.length} Students Selected</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Warning Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed space-y-1">
              <span className="font-bold block">Archive Warning</span>
              <p>
                Archiving will move <strong>{selectedStudents.length} selected student(s)</strong> out of the active/inactive registry and deactivate their mobile access.
              </p>
              <p className="text-amber-800/90 font-medium">
                All historical attendance records, certificates, and payment transaction receipts will remain permanently preserved in the SAO ledger.
              </p>
            </div>
          </div>

          {/* Selected Students Preview List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-gray-500" />
                Selected Students ({selectedStudents.length})
              </span>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 max-h-36 overflow-y-auto divide-y divide-gray-100">
              {selectedStudents.map((s) => (
                <div key={s.id} className="py-1.5 px-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#001A4D]">
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="font-mono text-gray-500 text-[11px]">{s.studentId} · {s.courseCode}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reason Selector */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                Archive Reason <span className="text-red-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none bg-white"
              >
                {BULK_ARCHIVE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {reason === 'Other' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Specify Reason Notes
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Enter archive reason..."
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Archiving {selectedStudents.length} Students...
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                Confirm Archive ({selectedStudents.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
