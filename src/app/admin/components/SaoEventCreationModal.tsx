import { useState } from 'react';
import { X, Shield, Rocket, Save, AlertTriangle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Step1EventDetails from '../../modules/events/components/wizard/Step1EventDetails';
import Step2Schedule from '../../modules/events/components/wizard/Step2Schedule';
import Step3Participants from '../../modules/events/components/wizard/Step3Participants';
import Step4Staff from '../../modules/events/components/wizard/Step4Staff';
import Step5Budget from '../../modules/events/components/wizard/Step5Budget';
import Step6Documents from '../../modules/events/components/wizard/Step6Documents';
import Step7Publish from '../../modules/events/components/wizard/Step7Publish';
import type { EventDocument, EventFormData } from '../../modules/events/types/event.types';
import { useEventCreation } from '../../modules/events/hooks/useEventCreation';
import { useAllEvents } from '../../modules/events/hooks/useEventStream';
import { validateWizardStep } from '../../modules/events/utils/event-validation';
import { isEventEditable, isMajorFieldLocked } from '../../modules/events/utils/event-lifecycle.utils';

interface SaoEventCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-populate the form when resuming a saved draft */
  initialDraft?: EventDocument;
  /** Firestore document ID of the draft being resumed */
  draftId?: string;
}

const STEPS = [
  'Event Details',
  'Schedule',
  'Participants',
  'Staff',
  'Budget',
  'Documents',
  'Publish'
];

/**
 * Infer the last wizard step the admin was working on based on which
 * fields are populated in the draft. Returns the 0-based step index.
 */
function inferLastStep(draft: EventDocument): number {
  if (draft.documents && draft.documents.length > 0) return 5; // Documents (Step 6)
  if (
    draft.budgetItems && draft.budgetItems.length > 0
  ) return 4; // Budget (Step 5)
  if (draft.scanners && draft.scanners.length > 0) return 3; // Staff (Step 4)
  if (
    draft.targetYearLevels && draft.targetYearLevels.length > 0
  ) return 2; // Participants (Step 3)
  if (draft.sessions && draft.sessions.length > 0) return 1; // Schedule (Step 2)
  return 0; // Event Details (Step 1)
}

export default function SaoEventCreationModal({
  isOpen,
  onClose,
  initialDraft,
  draftId,
}: SaoEventCreationModalProps) {
  const [currentStep, setCurrentStep] = useState(
    initialDraft ? inferLastStep(initialDraft) : 0
  );
  const [formData, setFormData] = useState<EventFormData>(
    initialDraft ? { hostingOrgId: initialDraft.hostingOrgId || 'sas', ...initialDraft } : { hostingOrgId: 'sas' }
  );
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(draftId);
  const [saving, setSaving] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  const { createEvent, saveDraft, loading } = useEventCreation();
  const { events: allEvents } = useAllEvents();

  // Lifecycle & Editability Guards
  const editCheck = isEventEditable(initialDraft, 'admin');
  const isLocked = Boolean(initialDraft && !editCheck.editable);
  const isRestricted = Boolean(initialDraft && editCheck.lockLevel === 'restricted');

  if (!isOpen) return null;

  const updateFormData = (stepData: any) => {
    if (isLocked) return;
    if (isRestricted && initialDraft) {
      const safeData = { ...stepData };
      const majorFields: (keyof EventFormData)[] = [
        'startDate', 'endDate', 'startTime', 'endTime', 'venue', 'sessions',
        'isMandatory', 'requiresAttendance', 'fines', 'studentPayablesEnabled',
        'totalApprovedBudget', 'budgetItems', 'targetAudience', 'targetYearLevels',
        'targetDepartmentIds', 'allowedCourses', 'allowedYearLevels'
      ];
      for (const f of majorFields) {
        if (f in safeData && isMajorFieldLocked(initialDraft, f)) {
          delete safeData[f];
        }
      }
      setFormData(prev => ({ ...prev, ...safeData }));
      return;
    }
    setFormData(prev => ({ ...prev, ...stepData }));
  };

  const isQREnabled = Boolean(formData.enableQRTickets === true || (formData as any).enableQR === true);
  const steps = isQREnabled
    ? ['Event Details', 'Schedule', 'Participants', 'Staff', 'Budget', 'Documents', 'Publish']
    : ['Event Details', 'Schedule', 'Participants', 'Budget', 'Documents', 'Publish'];

  const currentStepName = steps[currentStep] || steps[0];

  const nextStep = () => {
    const valResult = validateWizardStep(
      currentStep,
      currentStepName,
      formData,
      false,
      allEvents,
      activeDraftId
    );

    if (!valResult.isValid) {
      setStepErrors(valResult.fieldErrors || {});
      toast.error(`Incomplete: ${currentStepName}`, {
        description: valResult.errors[0] || 'Please complete all required fields before proceeding.',
        duration: 5000,
      });
      return;
    }

    setStepErrors({});
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    setStepErrors({});
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (stepIndex: number) => {
    if (stepIndex <= currentStep) {
      setCurrentStep(stepIndex);
      return;
    }
    const valResult = validateWizardStep(
      currentStep,
      currentStepName,
      formData,
      false,
      allEvents,
      activeDraftId
    );

    if (!valResult.isValid) {
      setStepErrors(valResult.fieldErrors || {});
      toast.error(`Please complete ${currentStepName} first`, {
        description: valResult.errors[0],
        duration: 4000,
      });
      return;
    }
    setStepErrors({});
    setCurrentStep(stepIndex);
  };

  const handleSubmit = async () => {
    if (isLocked) {
      toast.error('Event is Locked', {
        description: editCheck.reason || 'This event cannot be published or updated.',
      });
      return;
    }

    setSaving(true);
    try {
      const payload: EventFormData = {
        ...formData,
        hostingOrgId: formData.hostingOrgId || 'sas',
      };

      const result = await createEvent(payload, activeDraftId);
      if (result) {
        toast.success(
          activeDraftId ? 'Draft Published Successfully' : 'Event Created Successfully',
          {
            description: `${payload.title} is now active and published to the portal.`,
            duration: 5000,
          }
        );
        onClose();
      } else {
        toast.error('Failed to create event', {
          description: 'Please check your connection and try again.',
        });
      }
    } catch {
      toast.error('An unexpected error occurred while creating the event.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (isLocked) {
      toast.error('Event is Locked', {
        description: editCheck.reason || 'This event cannot be modified.',
      });
      return;
    }

    setSaving(true);
    try {
      const payload: EventFormData = {
        ...formData,
        hostingOrgId: formData.hostingOrgId || 'sas',
      };

      const id = await saveDraft(payload, activeDraftId, false);
      if (id) {
        setActiveDraftId(id);
        toast.success('Draft Saved Successfully', {
          description: 'You can resume this event anytime from the Event Management tab.',
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

  const renderStep = () => {
    const stepProps = {
      data: formData,
      onUpdate: updateFormData,
      isOfficer: false,
      errors: stepErrors,
      isRestricted: isRestricted,
    };

    switch (currentStepName) {
      case 'Event Details':
        return <Step1EventDetails {...stepProps} />;
      case 'Schedule':
        return <Step2Schedule {...stepProps} />;
      case 'Participants':
        return <Step3Participants {...stepProps} />;
      case 'Staff':
        return <Step4Staff {...stepProps} />;
      case 'Budget':
        return <Step5Budget {...stepProps} />;
      case 'Documents':
        return <Step6Documents {...stepProps} />;
      case 'Publish':
        return <Step7Publish {...stepProps} onPublish={handleSubmit} isPublishing={saving || loading} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-[1280px] h-[90vh] bg-white rounded-lg shadow-2xl flex flex-col">

          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-[#001A4D] via-[#002B7F] to-[#0E4EBD] px-6 py-4 flex items-center justify-between rounded-t-lg shadow-sm">
            <div className="flex items-center gap-4">
              <div className="text-white font-bold text-lg flex items-center gap-2">
                <span>STI Sync</span>
                <span className="font-normal">
                  {activeDraftId ? 'Resume Draft — Admin' : 'Event Creation — Admin'}
                </span>
              </div>
              <div className="px-3 py-1 bg-white/10 border border-white/20 rounded-full flex items-center gap-1.5 backdrop-blur-xs">
                <Shield className="w-3.5 h-3.5 text-[#FFD41C]" />
                <span className="text-[#FFD41C] text-sm font-bold">SAO Admin</span>
              </div>
              {activeDraftId && (
                <div className="px-3 py-1 bg-amber-500/20 border border-amber-400/40 rounded-full">
                  <span className="text-amber-300 text-xs font-medium">Resuming Draft</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="text-[#FFD41C] font-bold">
                Step {currentStep + 1} of {steps.length} — {currentStepName}
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white/10 p-1.5 rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lifecycle Status Banners */}
          {isLocked && (
            <div className="bg-red-50 border-b border-red-200 px-6 py-2.5 flex items-center justify-between text-red-900 text-xs font-semibold flex-shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{editCheck.reason || 'This event cannot be modified in its current status.'}</span>
              </div>
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[11px] uppercase tracking-wider font-bold">Read-Only</span>
            </div>
          )}

          {isRestricted && (
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-amber-900 text-xs font-semibold flex-shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Event is Approved: Core schedule, venue, fines, and budget are locked. Only minor information can be updated.</span>
              </div>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[11px] uppercase tracking-wider font-bold">Approved — Restricted</span>
            </div>
          )}

          {/* Progress Line */}
          <div className="h-1 bg-white/20">
            <div
              className="h-full bg-[#FFD41C] transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            ></div>
          </div>

          {/* Step Navigator */}
          <div className="px-6 py-4 border-b border-gray-200 flex gap-2 overflow-x-auto">
            {steps.map((step, index) => (
              <button
                key={index}
                onClick={() => goToStep(index)}
                disabled={index > currentStep}
                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                  index === currentStep
                    ? 'bg-[#001A4D] text-white shadow-xs'
                    : index < currentStep
                    ? 'bg-blue-50 text-[#0E4EBD] hover:bg-blue-100'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {step}
              </button>
            ))}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {renderStep()}
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-between rounded-b-lg">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Previous
            </button>

            {currentStep < STEPS.length - 1 ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={saving || loading || isLocked}
                  className="px-6 py-2.5 border border-[#0E4EBD] text-[#0E4EBD] rounded-lg font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  title={isLocked ? editCheck.reason : undefined}
                >
                  {saving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save as Draft
                    </>
                  )}
                </button>
                <button
                  onClick={nextStep}
                  disabled={loading}
                  className="px-6 py-2.5 bg-[#001A4D] hover:bg-[#002D72] text-white rounded-lg font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Next Step
                </button>
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || isLocked}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                title={isLocked ? editCheck.reason : undefined}
              >
                <Rocket className="w-4 h-4" />
                {loading ? 'Publishing...' : 'Create & Publish Event'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
