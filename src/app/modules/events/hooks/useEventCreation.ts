import { useState } from 'react';
import { createEvent, saveEventDraft } from '../services/event.service';
import type { EventFormData } from '../types/event.types';
import { useAdviserProfile } from '../../auth/hooks/useAdviserProfile';

export function useEventCreation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const { user } = useAdviserProfile();
  const uid = user?.uid || 'UNKNOWN-UID';

  const handleCreateEvent = async (data: EventFormData, draftId?: string, isOfficerProposal = false): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const id = await createEvent(data, uid, draftId, isOfficerProposal);
      setLoading(false);
      return id;
    } catch (err: any) {
      setError(err);
      setLoading(false);
      return null;
    }
  };

  const handleSaveDraft = async (data: EventFormData, existingId?: string): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const id = await saveEventDraft(data, uid, existingId);
      setLoading(false);
      return id;
    } catch (err: any) {
      setError(err);
      setLoading(false);
      return null;
    }
  };

  return {
    createEvent: handleCreateEvent,
    saveDraft: handleSaveDraft,
    loading,
    error
  };
}
