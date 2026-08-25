import { useState, useEffect } from 'react';
import { X, Send, Save, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useEventCreation } from '../../modules/events/hooks/useEventCreation';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useOrganizationStream } from '../../modules/organizations';
import type { EventDocument, EventFormData } from '../../modules/events/types/event.types';

import Step1EventDetails from '../../modules/events/components/wizard/Step1EventDetails';
import Step2Schedule from '../../modules/events/components/wizard/Step2Schedule';
import Step3Participants from '../../modules/events/components/wizard/Step3Participants';
import Step4Staff from '../../modules/events/components/wizard/Step4Staff';
import Step5Budget from '../../modules/events/components/wizard/Step5Budget';
import Step6Documents from '../../modules/events/components/wizard/Step6Documents';
import Step7Publish from '../../modules/events/components/wizard/Step7Publish';

interface OfficerEventProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDraft?: EventDocument;
  draftId?: string;
}

const FLAG_STEP_MAP: Record<string, string> = {
  'Event Information (title, description, objectives)': 'Event Details',
  'Schedule or Venue': 'Schedule',
  'Participant Settings': 'Participants',
  'Event Team Assignment': 'Staff',
  'Budget Request': 'Budget',
  'Submitted Documents': 'Documents',
};

const getStepForFlag = (flag: string): string | null => {
  if (FLAG_STEP_MAP[flag]) return FLAG_STEP_MAP[flag];
  const lower = flag.toLowerCase();
  if (lower.includes('event info') || lower.includes('title')) return 'Event Details';
  if (lower.includes('schedule') || lower.includes('venue')) return 'Schedule';
  if (lower.includes('participant')) return 'Participants';
  if (lower.includes('team') || lower.includes('staff')) return 'Staff';
  if (lower.includes('budget')) return 'Budget';
  if (lower.includes('document')) return 'Documents';
  return null;
};

const cleanStringArray = (arr?: any[]): string[] => {
  if (!Array.isArray(arr)) return [];
  return arr.map(x => String(x || '').trim()).filter(Boolean).sort();
};

const normalizeSessions = (sessions?: any[]): any[] => {
  if (!Array.isArray(sessions)) return [];
  return sessions.map(s => ({
    title: String(s?.title || '').trim(),
    date: String(s?.date || '').trim(),
    startTime: String(s?.startTime || '').trim(),
    endTime: String(s?.endTime || '').trim(),
    venueId: String(s?.venueId || '').trim(),
    timeInOpen: String(s?.timeInOpen || '').trim(),
    timeInClose: String(s?.timeInClose || '').trim(),
    hasTimeOut: Boolean(s?.hasTimeOut),
    timeOutOpen: String(s?.timeOutOpen || '').trim(),
    timeOutClose: String(s?.timeOutClose || '').trim(),
  }));
};

const normalizeBudgetItems = (items?: any[]): any[] => {
  if (!Array.isArray(items)) return [];
  return items.map(i => ({
    item: String(i?.item || i?.category || '').trim(),
    description: String(i?.description || '').trim(),
    quantity: Number(i?.quantity || 1),
    unitCost: Number(i?.unitCost || i?.amount || 0),
    approvedAmount: Number(i?.approvedAmount || 0),
  }));
};

const normalizeScanners = (scanners?: any[]): any[] => {
  if (!Array.isArray(scanners)) return [];
  return scanners.map(s => ({
    officerUserId: String(s?.officerUserId || '').trim(),
    officerName: String(s?.officerName || '').trim(),
    fullAccess: Boolean(s?.fullAccess),
    canCheckIn: Boolean(s?.canCheckIn),
    canCheckOut: Boolean(s?.canCheckOut),
    canViewList: Boolean(s?.canViewList),
    canEditRecords: Boolean(s?.canEditRecords),
    allowManualAttendance: Boolean(s?.allowManualAttendance),
  }));
};

const normalizeDocuments = (docs?: any[]): any[] => {
  if (!Array.isArray(docs)) return [];
  return docs.map(d => ({
    name: String(d?.name || '').trim(),
    fileUrl: String(d?.fileUrl || '').trim(),
    required: Boolean(d?.required),
  }));
};

const checkStepModified = (stepName: string, currentData: EventFormData, baselineData: EventDocument | undefined): boolean => {
  if (!baselineData) return true;

  // Use returnedSnapshot baseline if available (preserves returned state across saved drafts)
  const baseline = (baselineData as any).returnedSnapshot || baselineData;

  switch (stepName) {
    case 'Event Details': {
      const curEnableQR = currentData.enableQRTickets !== false && (currentData as any).enableQR !== false;
      const baseEnableQR = baseline.enableQRTickets !== false && baseline.enableQR !== false;
      return (
        (currentData.title || '').trim() !== (baseline.title || '').trim() ||
        (currentData.description || '').trim() !== (baseline.description || '').trim() ||
        (currentData.tagline || '').trim() !== (baseline.tagline || '').trim() ||
        (currentData.eventTypeId || '').trim() !== (baseline.eventTypeId || '').trim() ||
        (currentData.eventCategoryId || '').trim() !== (baseline.eventCategoryId || '').trim() ||
        (currentData.hostingOrgId || '').trim() !== (baseline.hostingOrgId || '').trim() ||
        (currentData.bannerImageUrl || '').trim() !== (baseline.bannerImageUrl || '').trim() ||
        curEnableQR !== baseEnableQR ||
        JSON.stringify(cleanStringArray(currentData.objectives)) !== JSON.stringify(cleanStringArray(baseline.objectives))
      );
    }

    case 'Schedule':
      return (
        (currentData.venueId || '').trim() !== (baseline.venueId || '').trim() ||
        (currentData.eventFormat || '').trim() !== (baseline.eventFormat || '').trim() ||
        (currentData.semesterId || '').trim() !== (baseline.semesterId || '').trim() ||
        (currentData.schoolYear || '').trim() !== (baseline.schoolYear || '').trim() ||
        Number(currentData.gracePeriodMinutes ?? 15) !== Number(baseline.gracePeriodMinutes ?? 15) ||
        Number(currentData.lateThresholdMinutes ?? 60) !== Number(baseline.lateThresholdMinutes ?? 60) ||
        JSON.stringify(normalizeSessions(currentData.sessions)) !== JSON.stringify(normalizeSessions(baseline.sessions))
      );

    case 'Participants':
      return (
        Boolean(currentData.attendanceEnabled !== false) !== Boolean(baseline.attendanceEnabled !== false) ||
        Boolean(currentData.certificatesEnabled !== false) !== Boolean(baseline.certificatesEnabled !== false) ||
        (currentData.targetAudienceScope || '').trim() !== (baseline.targetAudienceScope || '').trim() ||
        (currentData.scope || '').trim() !== (baseline.scope || '').trim() ||
        Number(currentData.maxAttendees || 0) !== Number(baseline.maxAttendees || 0) ||
        (currentData.registrationDeadline || '').trim() !== (baseline.registrationDeadline || '').trim() ||
        Boolean(currentData.requiresRegistration) !== Boolean(baseline.requiresRegistration) ||
        JSON.stringify(cleanStringArray(currentData.targetCourses)) !== JSON.stringify(cleanStringArray(baseline.targetCourses)) ||
        JSON.stringify(cleanStringArray(currentData.targetYearLevels)) !== JSON.stringify(cleanStringArray(baseline.targetYearLevels)) ||
        JSON.stringify(cleanStringArray(currentData.targetSections)) !== JSON.stringify(cleanStringArray(baseline.targetSections)) ||
        JSON.stringify(cleanStringArray(currentData.targetDepartmentIds)) !== JSON.stringify(cleanStringArray(baseline.targetDepartmentIds)) ||
        JSON.stringify(cleanStringArray(currentData.allowedCourses)) !== JSON.stringify(cleanStringArray(baseline.allowedCourses)) ||
        JSON.stringify(cleanStringArray(currentData.allowedYearLevels)) !== JSON.stringify(cleanStringArray(baseline.allowedYearLevels)) ||
        JSON.stringify(normalizeSessions(currentData.sessions)) !== JSON.stringify(normalizeSessions(baseline.sessions))
      );

    case 'Staff':
      return (
        (currentData.eventHeadUid || '').trim() !== (baseline.eventHeadUid || '').trim() ||
        (currentData.officerInChargeUid || '').trim() !== (baseline.officerInChargeUid || '').trim() ||
        JSON.stringify(cleanStringArray(currentData.scannerUids)) !== JSON.stringify(cleanStringArray(baseline.scannerUids)) ||
        JSON.stringify(normalizeScanners(currentData.scanners)) !== JSON.stringify(normalizeScanners(baseline.scanners))
      );

    case 'Budget': {
      const curApproved = Number(currentData.totalApprovedBudget ?? currentData.totalRequestedBudget ?? 0);
      const baseApproved = Number(baseline.totalApprovedBudget ?? baseline.totalRequestedBudget ?? 0);
      const curRequested = Number(currentData.totalRequestedBudget ?? 0);
      const baseRequested = Number(baseline.totalRequestedBudget ?? 0);
      return (
        (currentData.sourceOfFunds || '').trim() !== (baseline.sourceOfFunds || '').trim() ||
        curApproved !== baseApproved ||
        curRequested !== baseRequested ||
        Boolean(currentData.studentPayablesEnabled) !== Boolean(baseline.studentPayablesEnabled) ||
        Number(currentData.adminFeeOverride || 0) !== Number(baseline.adminFeeOverride || 0) ||
        JSON.stringify(normalizeBudgetItems(currentData.budgetItems)) !== JSON.stringify(normalizeBudgetItems(baseline.budgetItems))
      );
    }

    case 'Documents':
      return (
        JSON.stringify(cleanStringArray(currentData.attachedDocumentUrls)) !== JSON.stringify(cleanStringArray(baseline.attachedDocumentUrls)) ||
        JSON.stringify(cleanStringArray(currentData.documentIds)) !== JSON.stringify(cleanStringArray(baseline.documentIds)) ||
        JSON.stringify(normalizeDocuments(currentData.documents)) !== JSON.stringify(normalizeDocuments(baseline.documents))
      );

    default:
      return true;
  }
};

export default function OfficerEventProposalModal({ isOpen, onClose, initialDraft, draftId }: OfficerEventProposalModalProps) {
  const { profile } = useOfficerProfile();
  const { data: orgs } = useOrganizationStream();
  const activeOrgId = profile?.activeOrganizationId || '';
  const currentOrg = orgs.find(o => o.id === activeOrgId);

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<EventFormData>(
    initialDraft
      ? { hostingOrgId: initialDraft.hostingOrgId || activeOrgId, ...initialDraft }
      : { hostingOrgId: activeOrgId }
  );
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(draftId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeOrgId && (!formData.hostingOrgId || formData.hostingOrgId === 'sas')) {
      setFormData(prev => ({ ...prev, hostingOrgId: activeOrgId }));
    }
  }, [activeOrgId]);

  const { createEvent, saveDraft, loading } = useEventCreation();

  if (!isOpen) return null;

  const update = (d: Partial<EventFormData>) => setFormData(prev => ({ ...prev, ...d }));

  const getPayload = () => ({
    hostingOrgId: formData.hostingOrgId || activeOrgId,
    ...formData,
  });

  const isQREnabled = formData.enableQR !== false && formData.enableQRTickets !== false;
  const activeSteps = ['Event Details', 'Schedule', 'Participants', 'Staff', 'Budget', 'Documents', 'Submit'];

  const currentStepName = activeSteps[currentStep] || activeSteps[0];

  const next = () => {
    const activeReturnFlags = initialDraft?.returnFlags || [];
    const stepFlagged = activeReturnFlags.some(flag => getStepForFlag(flag) === currentStepName);

    if (stepFlagged && !checkStepModified(currentStepName, formData, initialDraft)) {
      toast.error(`Revision Required for ${currentStepName}`, {
        description: `The SAO Adviser flagged this section. You must make modifications to ${currentStepName} before proceeding to the next step.`,
        duration: 5000,
      });
      return;
    }

    if (currentStep < activeSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prev = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };

  const goTo = (i: number) => {
    const activeReturnFlags = initialDraft?.returnFlags || [];
    for (let stepIdx = 0; stepIdx < i; stepIdx++) {
      const stepName = activeSteps[stepIdx];
      const isFlagged = activeReturnFlags.some(flag => getStepForFlag(flag) === stepName);
      if (isFlagged && !checkStepModified(stepName, formData, initialDraft)) {
        toast.error(`Revision Required for ${stepName}`, {
          description: `You must resolve flagged changes in ${stepName} before skipping forward.`,
          duration: 5000,
        });
        setCurrentStep(stepIdx);
        return;
      }
    }
    if (i <= currentStep || i === currentStep + 1) {
      setCurrentStep(i);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = getPayload();
      const id = await saveDraft(payload, activeDraftId);
      if (id) {
        setActiveDraftId(id);
        toast.success('Draft saved!', {
          description: 'Your proposal draft has been saved successfully.',
          duration: 4000,
        });
      } else {
        toast.error('Failed to save draft');
      }
    } catch {
      toast.error('An error occurred while saving draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitProposal = async () => {
    const activeReturnFlags = initialDraft?.returnFlags || [];
    for (const flag of activeReturnFlags) {
      const stepName = getStepForFlag(flag);
      if (stepName && activeSteps.includes(stepName)) {
        const isModified = checkStepModified(stepName, formData, initialDraft);
        if (!isModified) {
          toast.error(`Cannot Resubmit Proposal`, {
            description: `Flagged section "${stepName}" has not been modified yet. Please make the required changes before resubmitting.`,
            duration: 6000,
          });
          const targetStepIndex = activeSteps.indexOf(stepName);
          if (targetStepIndex >= 0) {
            setCurrentStep(targetStepIndex);
          }
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = getPayload();
      const id = await createEvent(payload, activeDraftId, true);
      if (id) {
        toast.success(initialDraft?.proposalStatus === 'rejected' ? 'Proposal Resubmitted!' : 'Proposal Submitted!', {
          description: initialDraft?.proposalStatus === 'rejected'
            ? 'Your revised proposal has been resubmitted for SAO review.'
            : 'Your event proposal has been submitted for SAO review.',
          duration: 4000,
        });
        onClose();
      } else {
        toast.error('Failed to submit proposal');
      }
    } catch {
      toast.error('An error occurred while submitting proposal.');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    const props = { data: { hostingOrgId: activeOrgId, ...formData }, onUpdate: update, isOfficer: true };
    switch (currentStepName) {
      case 'Event Details': return <Step1EventDetails {...props} />;
      case 'Schedule': return <Step2Schedule {...props} />;
      case 'Participants': return <Step3Participants {...props} />;
      case 'Staff': return <Step4Staff {...props} />;
      case 'Budget': return <Step5Budget {...props} />;
      case 'Documents': return <Step6Documents {...props} />;
      case 'Submit': return <Step7Publish {...props} onPublish={handleSubmitProposal} isPublishing={saving || loading} />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-[1280px] h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">

          {/* Header — Deep Navy to Royal Blue */}
          <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <div>
                <p className="text-white font-bold text-base">
                  {initialDraft?.proposalStatus === 'rejected'
                    ? 'Revise & Resubmit Proposal'
                    : initialDraft?.proposalStatus === 'returned'
                    ? 'Revise Event Proposal'
                    : 'Create Event Proposal'}
                </p>
                <p className="text-white/80 text-xs">
                  {currentOrg?.name || currentOrg?.acronym || 'My Organization'} {activeDraftId ? '· Resuming Draft' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-white/90 text-sm font-medium">
                Step {currentStep + 1} of {activeSteps.length} — <span className="text-white font-bold">{currentStepName}</span>
              </span>
              <button onClick={onClose} className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Return Flags Warning Banner */}
          {initialDraft?.returnFlags && initialDraft.returnFlags.length > 0 && (
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs font-bold text-amber-900">SAO Adviser Flagged Sections:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {initialDraft.returnFlags.map((flag, idx) => {
                  const stepName = getStepForFlag(flag);
                  const isModified = stepName ? checkStepModified(stepName, formData, initialDraft) : true;
                  return (
                    <span
                      key={idx}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                        isModified
                          ? 'bg-green-100 text-green-800 border-green-300'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      {isModified ? (
                        <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                      )}
                      <span>{flag}</span>
                      <span className="font-mono text-[10px] opacity-75">
                        ({isModified ? 'Revised' : 'Needs Changes'})
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="h-1 bg-gray-100 flex-shrink-0">
            <div className="h-full bg-[#0E4EBD] transition-all duration-300" style={{ width: `${((currentStep + 1) / activeSteps.length) * 100}%` }} />
          </div>

          {/* Step navigator */}
          <div className="px-6 py-3 border-b border-gray-200 flex gap-2 overflow-x-auto flex-shrink-0">
            {activeSteps.map((step, i) => {
              const activeReturnFlags = initialDraft?.returnFlags || [];
              const isFlagged = activeReturnFlags.some(flag => getStepForFlag(flag) === step);
              const isModified = isFlagged ? checkStepModified(step, formData, initialDraft) : true;

              return (
                <button key={i} onClick={() => goTo(i)} disabled={i > currentStep}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    i === currentStep ? 'bg-[#001A4D] text-white font-bold shadow-xs' :
                    i < currentStep ? 'bg-[#0E4EBD] text-white hover:bg-[#001A4D]' :
                    'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}>
                  <span>{step}</span>
                  {isFlagged && (
                    <span className={`w-2 h-2 rounded-full ${isModified ? 'bg-green-400' : 'bg-amber-400 animate-ping'}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* Step-specific SAO Adviser Guidance & Remarks Banner */}
              {(initialDraft?.adviserRemarks || (initialDraft?.returnFlags && initialDraft.returnFlags.length > 0)) && (
                <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl shadow-sm space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <h4 className="text-sm font-bold text-amber-900">SAO Adviser Revision Guidance & Remarks</h4>
                    </div>
                    {initialDraft?.returnDeadline && (
                      <span className="text-xs font-mono font-semibold text-amber-800 bg-amber-200/80 px-2.5 py-0.5 rounded">
                        Deadline: {initialDraft.returnDeadline}
                      </span>
                    )}
                  </div>

                  {initialDraft?.adviserRemarks && (
                    <div className="bg-white/80 p-3 rounded-lg border border-amber-200 text-sm text-amber-950 leading-relaxed italic">
                      "{initialDraft.adviserRemarks}"
                    </div>
                  )}

                  {(() => {
                    const currentStepFlag = (initialDraft?.returnFlags || []).find(flag => getStepForFlag(flag) === currentStepName);
                    const isModified = checkStepModified(currentStepName, formData, initialDraft);
                    if (!currentStepFlag) return null;

                    return (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-semibold text-amber-900">
                        <span>⚠ Adviser Flag for {currentStepName}:</span>
                        <span className="px-2 py-0.5 bg-amber-200 text-amber-950 rounded font-bold">{currentStepFlag}</span>
                        <span className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 ${isModified ? 'bg-green-200 text-green-900' : 'bg-red-100 text-red-800 animate-pulse'}`}>
                          {isModified ? '✓ Modifications Detected' : '⚠ Action Required: Please edit this section before proceeding.'}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {renderStep()}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-between flex-shrink-0">
            <button onClick={prev} disabled={currentStep === 0}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
              Previous
            </button>

            {currentStep < activeSteps.length - 1 ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleSaveDraft} 
                  disabled={saving || loading}
                  className="px-5 py-2.5 border border-[#0E4EBD] text-[#0E4EBD] rounded-xl text-sm font-bold hover:bg-blue-50 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save as Draft'}
                </button>
                <button onClick={next}
                  className="px-5 py-2.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-xl text-sm font-bold transition-colors shadow-xs cursor-pointer">
                  Next Step
                </button>
              </div>
            ) : (
              <button 
                onClick={handleSubmitProposal} 
                disabled={saving || loading}
                className="px-6 py-2.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Send className="w-4 h-4 text-[#FFD41C]" />
                {saving || loading
                  ? 'Submitting...'
                  : initialDraft?.proposalStatus === 'returned' || initialDraft?.proposalStatus === 'rejected'
                  ? 'Save Changes & Resubmit Proposal'
                  : 'Submit Proposal for SAO Approval'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
