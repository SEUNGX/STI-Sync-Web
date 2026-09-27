import { useState } from 'react';
import { X, RotateCcw, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import type { StudentDocument } from '../../../modules/students/types/student.types';
import { updateStudentStatus } from '../../../modules/students/services/student.service';
import { toast } from 'sonner';

interface ReactivateStudentModalProps {
  student: StudentDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReactivateStudentModal({
  student,
  isOpen,
  onClose,
  onSuccess,
}: ReactivateStudentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !student) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await updateStudentStatus(student.id, 'ACTIVE');
      toast.success(`Reactivated ${student.firstName} ${student.lastName} back to Active status.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Reactivation error:', err);
      toast.error(`Failed to reactivate student: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-green-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Reactivate Student Account</h3>
              <p className="text-xs text-white/80">Restore active standing & portal access</p>
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

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="w-10 h-10 bg-[#001A4D] rounded-full flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden flex-shrink-0">
              {student.profilePhotoUrl ? (
                <img src={student.profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-[#001A4D]">
                {student.firstName} {student.middleName ? `${student.middleName} ` : ''}{student.lastName}
              </p>
              <p className="text-xs text-gray-500 font-mono">
                {student.studentId} · {student.courseCode} ({student.yearLevel})
              </p>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-green-900 leading-relaxed space-y-1">
              <span className="font-bold block">Reactivation Notice</span>
              <p>
                Reactivating this student will set their status back to <strong>ACTIVE</strong>, restoring their student app access, event participation privileges, and club eligibility.
              </p>
            </div>
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
            className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Reactivating...
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                Confirm Reactivate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
