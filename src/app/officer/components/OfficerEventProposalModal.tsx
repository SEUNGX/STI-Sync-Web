import { useState } from 'react';
import { X, Send, Save } from 'lucide-react';
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

export default function OfficerEventProposalModal({ isOpen, onClose, initialDraft, draftId }: OfficerEventProposalModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<EventFormData>(initialDraft ? { ...initialDraft } : {});
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(draftId);
  const [saving, setSaving] = useState(false);

  const { profile } = useOfficerProfile();
  const { data: orgs } = useOrganizationStream();
  const activeOrgId = profile?.activeOrganizationId || '';
  const currentOrg = orgs.find(o => o.id === activeOrgId);

  const { createEvent, saveDraft, loading } = useEventCreation();

  if (!isOpen) return null;

  const update = (d: Partial<EventFormData>) => setFormData(prev => ({ ...prev, ...d }));

  const getPayload = () => ({
    hostingOrgId: formData.hostingOrgId || activeOrgId,
    ...formData,
  });

  const isQREnabled = formData.enableQR !== false && formData.enableQRTickets !== false;
  const activeSteps = isQREnabled
    ? ['Event Details', 'Schedule', 'Participants', 'Staff', 'Budget', 'Documents', 'Submit']
    : ['Event Details', 'Schedule', 'Participants', 'Budget', 'Documents', 'Submit'];

  const currentStepName = activeSteps[currentStep] || activeSteps[0];

  const next = () => { if (currentStep < activeSteps.length - 1) setCurrentStep(currentStep + 1); };
  const prev = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };
  const goTo = (i: number) => { if (i <= currentStep) setCurrentStep(i); };

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

          {/* Header — solid violet (officer pattern) */}
          <div className="bg-[#83358E] px-6 py-4 flex items-center justify-between flex-shrink-0">
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
                <p className="text-white/70 text-xs">
                  {currentOrg?.name || currentOrg?.acronym || 'My Organization'} {activeDraftId ? '· Resuming Draft' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-white/90 text-sm font-medium">
                Step {currentStep + 1} of {activeSteps.length} — <span className="text-white font-bold">{currentStepName}</span>
              </span>
              <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-white/20 bg-gray-100 flex-shrink-0">
            <div className="h-full bg-[#83358E] transition-all duration-300" style={{ width: `${((currentStep + 1) / activeSteps.length) * 100}%` }} />
          </div>

          {/* Step navigator */}
          <div className="px-6 py-3 border-b border-gray-200 flex gap-2 overflow-x-auto flex-shrink-0">
            {activeSteps.map((step, i) => (
              <button key={i} onClick={() => goTo(i)} disabled={i > currentStep}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  i === currentStep ? 'bg-[#83358E] text-white' :
                  i < currentStep ? 'bg-[#83358E]/80 text-white hover:bg-[#83358E]' :
                  'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}>
                {step}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">{renderStep()}</div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-between flex-shrink-0">
            <button onClick={prev} disabled={currentStep === 0}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Previous
            </button>

            {currentStep < activeSteps.length - 1 ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleSaveDraft} 
                  disabled={saving || loading}
                  className="px-5 py-2.5 border border-[#83358E] text-[#83358E] rounded-lg text-sm font-medium hover:bg-[#83358E]/5 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save as Draft'}
                </button>
                <button onClick={next}
                  className="px-5 py-2.5 bg-[#83358E] text-white rounded-lg text-sm font-medium hover:bg-[#6D2A78] transition-colors">
                  Next Step
                </button>
              </div>
            ) : (
              <button 
                onClick={handleSubmitProposal} 
                disabled={saving || loading}
                className="px-6 py-2.5 bg-[#83358E] text-white rounded-lg text-sm font-medium hover:bg-[#6D2A78] disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {saving || loading ? 'Submitting...' : (initialDraft?.proposalStatus === 'rejected' ? 'Revise & Resubmit Proposal' : 'Submit Proposal for SAO Approval')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
