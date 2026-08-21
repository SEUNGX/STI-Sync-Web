import { useState } from 'react';
import { createOrganization } from '../services/organization.service';
import { batchCreateOfficers, type OfficerAssignmentData } from '../services/officer.service';
import { toast } from 'sonner';
import { sendAdviserWelcomeCredentialsEmail, sendOfficerAppointmentEmail } from '../../../../services/email.service';
import type { CreateOrganizationPayload } from '../types/organization.types';

export const useOrganizationMutations = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = async (
    payload: CreateOrganizationPayload, 
    createdBy: string,
    logoFile: File | null,
    officers: OfficerAssignmentData[] = []
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    setIsSaving(true);
    setError(null);
    try {
      const orgId = await createOrganization(payload, createdBy, logoFile);
      
      if (officers.length > 0) {
        await batchCreateOfficers(orgId, officers);
      }

      // ── Dispatch Welcome / Credential Emails asynchronously via Resend ──
      // 1. Email to Adviser
      if (payload.adviser?.email) {
        sendAdviserWelcomeCredentialsEmail({
          to: payload.adviser.email,
          adviserName: payload.adviser.name,
          orgName: payload.name,
          employeeId: payload.adviser.employeeId,
          temporaryPassword: payload.adviser.temporaryPassword || 'Adv-2026!#',
        })
          .then(() => {
            toast.success(`Welcome email sent to adviser (${payload.adviser?.email})`);
          })
          .catch(err => {
            console.warn('[useOrganizationMutations] Could not send adviser welcome email:', err);
            const msg = err?.message || '';
            if (msg.includes('only send testing emails to your own email address')) {
              toast.info(`Email Note: Free Resend test mode only delivers to leiconcordia2005@gmail.com until you verify a custom domain at resend.com/domains.`);
            } else {
              toast.error(`Could not send email to adviser: ${msg}`);
            }
          });
      }

      // 2. Email to Appointed Officers
      if (officers.length > 0) {
        officers.forEach(officer => {
          if (officer.email) {
            sendOfficerAppointmentEmail({
              to: officer.email,
              officerName: officer.studentName,
              orgName: payload.name,
              roleName: officer.roleName || 'Executive Officer',
              studentId: officer.studentId,
            })
              .then(() => {
                toast.success(`Appointment notice sent to ${officer.studentName}`);
              })
              .catch(err => {
                console.warn('[useOrganizationMutations] Could not send officer appointment email:', err);
              });
          }
        });
      }

      return { success: true, id: orgId };
    } catch (e) {
      console.error("Mutation failed:", e);
      const err = e as Error;
      setError(err);
      return { success: false, error: err.message };
    } finally {
      setIsSaving(false);
    }
  };

  return { create, isSaving, error };
};
