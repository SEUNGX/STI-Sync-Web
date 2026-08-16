import { useState } from 'react';
import { X, Trash2, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import type { StudentDocument } from '../types/student.types';
import { deleteStudentPermanently } from '../services/student.service';

interface DeleteStudentModalProps {
  student: StudentDocument;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeleteStudentModal({
  student,
  onClose,
  onSuccess,
}: DeleteStudentModalProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredConfirmation = student.studentId?.trim() || 'DELETE';
  const isConfirmed = confirmInput.trim().toUpperCase() === requiredConfirmation.toUpperCase() || confirmInput.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setSubmitting(true);
    setError(null);

    try {
      await deleteStudentPermanently(student);
      onSuccess();
    } catch (err: any) {
      console.error('Permanent deletion failed:', err);
      setError(err.message || 'Failed to delete student.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-red-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-700 to-red-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Permanent Deletion</h3>
              <p className="text-xs text-white/80">Irreversible Action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 space-y-1">
              <span className="font-bold block text-sm">Warning: This cannot be undone!</span>
              <p>
                You are about to permanently delete the student record for{' '}
                <strong className="text-red-950">{student.firstName} {student.lastName}</strong> ({student.studentId}).
              </p>
              <p className="text-red-700 pt-1">
                This will purge the student profile, all club memberships, and officer credentials from the system.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
              To confirm, type student ID <code className="bg-gray-100 px-1.5 py-0.5 rounded text-red-700 font-mono font-bold">{requiredConfirmation}</code> or <code className="bg-gray-100 px-1.5 py-0.5 rounded text-red-700 font-mono font-bold">DELETE</code> below:
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={`Type ${requiredConfirmation} to confirm`}
              className="w-full px-3.5 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-mono focus:border-red-600 focus:outline-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isConfirmed || submitting}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 ${
              !isConfirmed || submitting
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-red-700 hover:bg-red-800 shadow-md'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Permanently
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
