import { useState, useEffect } from 'react';
import { X, AlertTriangle, Archive, ArchiveRestore, CheckCircle2, Loader2, Calendar, FileText, DollarSign, Users } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { OrganizationDocument } from '../../modules/organizations/types/organization.types';
import { updateOrganization } from '../../modules/organizations/services/organization.service';
import { toast } from 'sonner';

interface OrganizationStatusModalProps {
  organization: OrganizationDocument | null;
  mode: 'archive' | 'suspend' | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ValidationIssues {
  activeEvents: { id: string; title: string; status: string }[];
  pendingProposals: { id: string; title: string }[];
  pendingLiquidations: { id: string; title: string; amount?: number }[];
  pendingMembersCount: number;
}

export function OrganizationStatusModal({
  organization,
  mode,
  isOpen,
  onClose,
  onSuccess,
}: OrganizationStatusModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [validationIssues, setValidationIssues] = useState<ValidationIssues>({
    activeEvents: [],
    pendingProposals: [],
    pendingLiquidations: [],
    pendingMembersCount: 0,
  });

  const isCurrentArchived = organization?.status === 'archived';
  const targetStatus = isCurrentArchived ? 'active' : 'archived';

  // Run real-time validation checks against Firestore when opening archive modal
  useEffect(() => {
    if (!isOpen || !organization) {
      setIsValidating(false);
      return;
    }

    // Unarchiving doesn't require active blocker validation
    if (isCurrentArchived) {
      setIsValidating(false);
      setValidationIssues({
        activeEvents: [],
        pendingProposals: [],
        pendingLiquidations: [],
        pendingMembersCount: 0,
      });
      return;
    }

    let isMounted = true;
    const validateOrg = async () => {
      setIsValidating(true);
      const issues: ValidationIssues = {
        activeEvents: [],
        pendingProposals: [],
        pendingLiquidations: [],
        pendingMembersCount: 0,
      };

      try {
        // 1. Check Events for this org
        const eventsRef = collection(db, 'events');
        const [qHost, qOrg] = await Promise.all([
          getDocs(query(eventsRef, where('hostingOrgId', '==', organization.id))),
          getDocs(query(eventsRef, where('organizationId', '==', organization.id))),
        ]);

        const eventMap = new Map<string, any>();
        qHost.docs.forEach(d => eventMap.set(d.id, { id: d.id, ...d.data() }));
        qOrg.docs.forEach(d => eventMap.set(d.id, { id: d.id, ...d.data() }));

        eventMap.forEach((evt) => {
          const status = evt.status || 'pending';
          const proposalStatus = evt.proposalStatus || 'pending';

          if (proposalStatus === 'pending' || status === 'pending') {
            issues.pendingProposals.push({
              id: evt.id,
              title: evt.title || evt.name || 'Untitled Event Proposal',
            });
          } else if (
            (proposalStatus === 'approved' || status === 'approved' || status === 'ongoing' || status === 'published') &&
            status !== 'completed' &&
            status !== 'cancelled'
          ) {
            issues.activeEvents.push({
              id: evt.id,
              title: evt.title || evt.name || 'Ongoing Campus Event',
              status: evt.status || 'approved',
            });
          }
        });

        // 2. Check Pending Liquidations
        const liqRef = collection(db, 'liquidations');
        const liqSnap = await getDocs(query(liqRef, where('organizationId', '==', organization.id)));
        liqSnap.docs.forEach(d => {
          const lData = d.data();
          const lStatus = lData.status || 'pending';
          if (lStatus === 'pending' || lStatus === 'submitted' || lStatus === 'under_review' || lStatus === 'draft') {
            issues.pendingLiquidations.push({
              id: d.id,
              title: lData.eventTitle || lData.eventName || 'Financial Liquidation',
              amount: Number(lData.totalActualSpending ?? lData.totalExpenses ?? 0),
            });
          }
        });

        // 3. Check Pending Member Applications
        const memRef = collection(db, 'organization_members');
        const memSnap = await getDocs(
          query(memRef, where('organizationId', '==', organization.id), where('status', '==', 'pending'))
        );
        issues.pendingMembersCount = memSnap.size;

        if (isMounted) {
          setValidationIssues(issues);
        }
      } catch (err) {
        console.error('[OrganizationStatusModal] Error validating archive conditions:', err);
      } finally {
        if (isMounted) {
          setIsValidating(false);
        }
      }
    };

    validateOrg();
    return () => {
      isMounted = false;
    };
  }, [isOpen, organization, isCurrentArchived]);

  if (!isOpen || !organization) return null;

  const hasBlockers =
    !isCurrentArchived &&
    (validationIssues.activeEvents.length > 0 ||
      validationIssues.pendingProposals.length > 0 ||
      validationIssues.pendingLiquidations.length > 0 ||
      validationIssues.pendingMembersCount > 0);

  const handleConfirm = async () => {
    if (hasBlockers) {
      toast.error('Cannot archive organization', {
        description: 'Please resolve all ongoing events, pending proposals, and financial liquidations before archiving.',
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateOrganization(organization.id, { status: targetStatus });

      toast.success(
        targetStatus === 'archived' ? 'Organization archived successfully!' : 'Organization restored to active!',
        {
          description: `${organization.name} is now ${targetStatus}.`,
        }
      );

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
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10 max-h-[90vh]">
        {/* Header */}
        <div
          className={`${
            isCurrentArchived
              ? 'bg-gradient-to-r from-[#0E4EBD] to-[#1E70E8]'
              : 'bg-gradient-to-r from-gray-800 to-gray-900'
          } px-6 py-4 flex items-center justify-between text-white flex-shrink-0`}
        >
          <div className="flex items-center gap-2.5">
            {isCurrentArchived ? <ArchiveRestore className="w-5 h-5 text-white" /> : <Archive className="w-5 h-5 text-white" />}
            <h3 className="font-bold text-base">
              {isCurrentArchived ? 'Unarchive Organization' : 'Archive Organization'}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Org Profile Header */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="w-12 h-12 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden shadow-xs">
              {organization.logoUrl ? (
                <img src={organization.logoUrl} alt={organization.acronym} className="w-full h-full object-cover" />
              ) : (
                organization.acronym || 'ORG'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#001A4D] truncate">{organization.name}</p>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                Acronym: <span className="font-semibold text-gray-800">{organization.acronym || 'ORG'}</span> • Status: <span className="font-bold capitalize">{organization.status}</span>
              </p>
            </div>
          </div>

          {/* Validation Status */}
          {isValidating ? (
            <div className="flex items-center justify-center py-6 gap-2 text-xs text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#0E4EBD]" />
              <span>Validating active events, liquidations, and student records...</span>
            </div>
          ) : hasBlockers ? (
            <div className="space-y-3">
              <div className="p-4 border border-red-200 bg-red-50 rounded-xl flex items-start gap-3 text-red-900">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
                <div>
                  <h4 className="text-xs font-bold text-red-900">Archive Blocked by Unresolved Items</h4>
                  <p className="text-xs text-red-800 mt-1 leading-relaxed">
                    This organization cannot be archived while it has active scheduled events, pending proposals, or unsettled liquidations.
                  </p>
                </div>
              </div>

              {/* Blocker Breakdown List */}
              <div className="border border-red-100 rounded-xl p-3 bg-red-50/40 space-y-2.5 text-xs">
                {validationIssues.activeEvents.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-red-900">
                        {validationIssues.activeEvents.length} Active / Scheduled Event(s):
                      </strong>
                      <ul className="list-disc list-inside text-red-700 mt-0.5 space-y-0.5">
                        {validationIssues.activeEvents.map((evt) => (
                          <li key={evt.id} className="truncate">
                            {evt.title} <span className="text-[10px] uppercase font-mono font-bold">({evt.status})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {validationIssues.pendingProposals.length > 0 && (
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-amber-900">
                        {validationIssues.pendingProposals.length} Pending Event Proposal(s):
                      </strong>
                      <ul className="list-disc list-inside text-amber-800 mt-0.5 space-y-0.5">
                        {validationIssues.pendingProposals.map((p) => (
                          <li key={p.id} className="truncate">{p.title}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {validationIssues.pendingLiquidations.length > 0 && (
                  <div className="flex items-start gap-2">
                    <DollarSign className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-red-900">
                        {validationIssues.pendingLiquidations.length} Pending Financial Liquidation(s):
                      </strong>
                      <ul className="list-disc list-inside text-red-700 mt-0.5 space-y-0.5">
                        {validationIssues.pendingLiquidations.map((l) => (
                          <li key={l.id} className="truncate">{l.title}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {validationIssues.pendingMembersCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-amber-900">
                      <strong>{validationIssues.pendingMembersCount}</strong> pending student membership applicant(s).
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 border border-green-200 bg-green-50 rounded-xl flex items-center gap-2.5 text-xs text-green-900 font-medium">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span>All active events, liquidations, and memberships are clear for archiving.</span>
              </div>

              <div
                className={`p-4 border rounded-xl flex items-start gap-3 ${
                  isCurrentArchived
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-gray-50 border-gray-200 text-gray-800'
                }`}
              >
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600" />
                <p className="text-xs leading-relaxed">
                  {isCurrentArchived
                    ? `Unarchiving ${organization.name} will restore it to active status and make it visible in active organization rosters again.`
                    : `Archiving ${organization.name} will hide it from active student directories and officer access while permanently preserving all past event archives and financial records in the SAO ledger.`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSaving || isValidating || hasBlockers}
            className={`px-5 py-2 text-xs font-bold text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer ${
              isCurrentArchived
                ? 'bg-[#0E4EBD] hover:bg-[#001A4D]'
                : 'bg-gray-800 hover:bg-gray-900'
            }`}
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving
              ? 'Processing...'
              : isCurrentArchived
              ? 'Unarchive Organization'
              : 'Archive Organization'}
          </button>
        </div>
      </div>
    </div>
  );
}
