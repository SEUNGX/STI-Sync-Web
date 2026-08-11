import { useState } from 'react';
import { X, AlertTriangle, Ban, Archive, ArchiveRestore, CheckCircle2, Loader2 } from 'lucide-react';
import type { OrganizationDocument } from '../../modules/organizations/types/organization.types';
import { updateOrganization } from '../../modules/organizations/services/organization.service';
import { toast } from 'sonner';

interface OrganizationStatusModalProps {
  organization: OrganizationDocument | null;
  mode: 'suspend' | 'archive' | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function OrganizationStatusModal({
  organization,
  mode,
  isOpen,
  onClose,
  onSuccess,
}: OrganizationStatusModalProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !organization || !mode) return null;

  const isCurrentActive = organization.status === 'active';
  const isCurrentArchived = organization.status === 'archived';

  const targetStatus = mode === 'archive' 
    ? (isCurrentArchived ? 'active' : 'archived')
    : isCurrentActive 
    ? 'suspended' 
    : 'active';

  const config = {
    suspend: {
      headerBg: isCurrentActive ? 'bg-gradient-to-r from-amber-600 to-amber-700' : 'bg-gradient-to-r from-green-600 to-green-700',
      icon: isCurrentActive ? Ban : CheckCircle2,
      title: isCurrentActive ? 'Suspend Organization' : 'Reactivate Organization',
      btnBg: isCurrentActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700',
      btnText: isCurrentActive ? 'Confirm Suspension' : 'Reactivate Now',
      warningBg: isCurrentActive ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-green-50 border-green-200 text-green-900',
      warningMessage: isCurrentActive
        ? `Suspending ${organization.name} will immediately block officers from logging into or accessing their Officer Web account, and restrict event proposal submissions until reactivated.`
        : `Reactivating ${organization.name} will restore officer login access and portal permissions.`,
    },
    archive: {
      headerBg: isCurrentArchived ? 'bg-gradient-to-r from-blue-600 to-blue-700' : 'bg-gradient-to-r from-gray-700 to-gray-800',
      icon: isCurrentArchived ? ArchiveRestore : Archive,
      title: isCurrentArchived ? 'Unarchive Organization' : 'Archive Organization',
      btnBg: isCurrentArchived ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-800 hover:bg-gray-900',
      btnText: isCurrentArchived ? 'Unarchive Organization' : 'Archive Organization',
      warningBg: isCurrentArchived ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-gray-50 border-gray-200 text-gray-800',
      warningMessage: isCurrentArchived
        ? `Unarchiving ${organization.name} will restore it to active organization status and make it visible in active rosters again.`
        : `Archiving ${organization.name} will hide it from active organization rosters while preserving past event records and financial liquidations in the SAO ledger.`,
    },
  }[mode];

  const IconComponent = config.icon;

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      await updateOrganization(organization.id, { status: targetStatus });

      toast.success(`Organization ${targetStatus}!`, {
        description: `${organization.name} status updated to ${targetStatus}.`,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Status update failed:', err);
      toast.error('Failed to update status', {
        description: err?.message || 'Something went wrong.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10">
        
        {/* Header */}
        <div className={`${config.headerBg} px-6 py-4 flex items-center justify-between text-white flex-shrink-0`}>
          <div className="flex items-center gap-2.5">
            <IconComponent className="w-5 h-5 text-white" />
            <h3 className="font-bold text-base">{config.title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="w-10 h-10 bg-[#001A4D] rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0 overflow-hidden">
              {organization.logoUrl ? (
                <img src={organization.logoUrl} alt={organization.acronym} className="w-full h-full object-cover" />
              ) : (
                organization.acronym || 'ORG'
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-[#001A4D]">{organization.name}</p>
              <p className="text-xs text-gray-500 font-mono">Current Status: <span className="font-bold capitalize">{organization.status}</span></p>
            </div>
          </div>

          <div className={`p-4 border rounded-xl flex items-start gap-3 ${config.warningBg}`}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{config.warningMessage}</p>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Are you sure you want to change status to <span className="font-bold text-gray-900 capitalize">{targetStatus}</span>?
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className={`px-5 py-2 text-xs font-bold text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 ${config.btnBg}`}
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? 'Updating...' : config.btnText}
          </button>
        </div>
      </div>
    </div>
  );
}
