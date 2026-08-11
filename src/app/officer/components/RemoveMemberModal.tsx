import { useState } from 'react';
import { X, UserMinus, Loader2, Trash2, UserX } from 'lucide-react';
import type { OrganizationMemberDocument } from '../../modules/organizations/types/member.types';
import { deleteMember, updateMemberStatus } from '../../modules/organizations/services/member.service';
import { toast } from 'sonner';

interface RemoveMemberModalProps {
  member: OrganizationMemberDocument | null;
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RemoveMemberModal({
  member,
  organizationId,
  isOpen,
  onClose,
  onSuccess,
}: RemoveMemberModalProps) {
  const [actionType, setActionType] = useState<'inactive' | 'delete'>('delete');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !member) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      if (actionType === 'delete') {
        await deleteMember(member.id, organizationId);
        toast.success('Member removed!', {
          description: `${member.studentName} has been removed from the organization.`,
        });
      } else {
        await updateMemberStatus(member.id, 'inactive');
        toast.success('Status updated!', {
          description: `${member.studentName} status updated to Inactive.`,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Member removal error:', err);
      toast.error('Failed to remove member', {
        description: err?.message || 'An error occurred during removal.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10">
        {/* Header */}
        <div className="bg-[#E24B4A] px-6 py-4 flex items-center justify-between text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <UserMinus className="w-5 h-5 text-white" />
            <h3 className="font-bold text-base">Remove Member</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl border border-red-100">
            <div className="w-10 h-10 bg-[#001A4D] rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {member.studentName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-[#001A4D]">{member.studentName}</p>
              <p className="text-xs text-gray-500 font-mono">ID: {member.studentId} · {member.course || 'Student'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Removal Option</label>
            
            <div
              onClick={() => setActionType('delete')}
              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                actionType === 'delete' ? 'bg-red-50 border-red-300 ring-2 ring-red-500/20' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Trash2 className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-950">Permanently Remove Member</p>
                <p className="text-[11px] text-red-700">Deletes member record from this organization roster completely.</p>
              </div>
            </div>

            <div
              onClick={() => setActionType('inactive')}
              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                actionType === 'inactive' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <UserX className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-950">Mark Status as Inactive</p>
                <p className="text-[11px] text-amber-800">Preserves member history but marks status as inactive.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-bold text-white bg-[#E24B4A] hover:bg-[#DC2626] rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Processing...' : actionType === 'delete' ? 'Remove Member' : 'Set Inactive'}
          </button>
        </div>
      </div>
    </div>
  );
}
