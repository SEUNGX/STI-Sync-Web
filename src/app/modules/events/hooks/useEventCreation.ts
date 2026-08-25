import { useState } from 'react';
import { createEvent, saveEventDraft } from '../services/event.service';
import type { EventFormData } from '../types/event.types';
import { useAdviserProfile } from '../../auth/hooks/useAdviserProfile';
import { useOfficerProfile } from '../../../auth/hooks/useOfficerProfile';
import { auth } from '../../../../services/firebase';

export function useEventCreation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { user: adviserUser, profile: adviserProfile } = useAdviserProfile();
  const { profile: officerProfile } = useOfficerProfile();

  const uid =
    officerProfile?.studentId ||
    officerProfile?.id ||
    adviserUser?.uid ||
    auth.currentUser?.uid ||
    'system_officer';

  const userName =
    officerProfile?.studentName ||
    adviserProfile?.displayName ||
    adviserUser?.displayName ||
    'Officer';

  const handleCreateEvent = async (
    data: EventFormData,
    draftId?: string,
    isOfficerProposal = false
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const id = await createEvent(data, uid, draftId, isOfficerProposal, userName);
      setLoading(false);
      return id;
    } catch (err: any) {
      console.error('[useEventCreation] Error creating event:', err);
      setError(err);
      setLoading(false);
      return null;
    }
  };

  const handleSaveDraft = async (
    data: EventFormData,
    existingId?: string
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const id = await saveEventDraft(data, uid, existingId, userName);
      setLoading(false);
      return id;
    } catch (err: any) {
      console.error('[useEventCreation] Error saving draft:', err);
      setError(err);
      setLoading(false);
      return null;
    }
  };

  return {
    createEvent: handleCreateEvent,
    saveDraft: handleSaveDraft,
    loading,
    error,
  };
}
