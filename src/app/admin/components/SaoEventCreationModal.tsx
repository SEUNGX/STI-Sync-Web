import { useState } from 'react';
import { X, Shield, Rocket, Save } from 'lucide-react';
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

  const { createEvent, saveDraft, loading } = useEventCreation();

  if (!isOpen) return null;

  const updateFormData = (stepData: any) => {
    setFormData({ ...formData, ...stepData });
  };

  const isQREnabled = formData.enableQRTickets !== false;
  const steps = isQREnabled
    ? ['Event Details', 'Schedule', 'Participants', 'Staff', 'Budget', 'Documents', 'Publish']
    : ['Event Details', 'Schedule', 'Participants', 'Budget', 'Documents', 'Publish'];

  const currentStepName = steps[currentStep] || steps[0];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  };

  const handleSubmit = async () => {
    const payload = { hostingOrgId: 'sas', ...formData };
    const id = await createEvent(payload, activeDraftId, false);
    if (id) {
      toast.success('Event Published!', {
        description: 'The event has been successfully published and activated.',
        duration: 4000,
      });
      onClose();
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = { hostingOrgId: 'sas', ...formData };
      const id = await saveDraft(payload, activeDraftId);
      if (id) {
        setActiveDraftId(id);
        toast.success('Draft saved!', {
          description: 'Your progress has been saved. You can resume any time from the Drafts tab.',
          duration: 4000,
        });
      } else {
        toast.error('Failed to save draft', {
          description: 'Something went wrong. Please try again.',
        });
      }
    } catch {
      toast.error('Failed to save draft', {
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (currentStepName) {
      case 'Event Details':
        return <Step1EventDetails data={formData} onUpdate={updateFormData} isOfficer={false} />;
      case 'Schedule':
        return <Step2Schedule data={formData} onUpdate={updateFormData} isOfficer={false} />;
      case 'Participants':
        return <Step3Participants data={formData} onUpdate={updateFormData} isOfficer={false} />;
      case 'Staff':
        return <Step4Staff data={formData} onUpdate={updateFormData} isOfficer={false} />;
      case 'Budget':
        return <Step5Budget data={formData} onUpdate={updateFormData} isOfficer={false} />;
      case 'Documents':
        return <Step6Documents data={formData} onUpdate={updateFormData} isOfficer={false} />;
      case 'Publish':
        return <Step7Publish data={formData} onUpdate={updateFormData} onPublish={handleSubmit} isPublishing={saving || loading} isOfficer={false} />;
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
                    ? 'bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white shadow-xs'
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
                  disabled={saving || loading}
                  className="px-6 py-2.5 border border-[#0E4EBD] text-[#0E4EBD] rounded-lg font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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
                  className="px-6 py-2.5 bg-[#001A4D] text-white rounded-lg font-medium hover:bg-[#001A4D]/90 transition-colors disabled:opacity-50"
                >
                  Next Step
                </button>
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg font-medium hover:from-green-700 hover:to-green-600 transition-all flex items-center gap-2 disabled:opacity-50"
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
