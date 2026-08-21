import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, createSecondaryAuthUser } from '../../../../services/firebase';
import { uploadToCloudinary } from '../../../../services/cloudinary';
import type { CreateOrganizationPayload } from '../types/organization.types';

const COLLECTION = 'organizations';

export const createOrganization = async (
  payload: CreateOrganizationPayload,
  createdBy: string,
  logoFile?: File | null
): Promise<string> => {
  // ── Logo upload → Cloudinary (app-wide upload standard; see services/cloudinary.ts) ──
  // We store ONLY the returned secure URL in Firestore — never the binary, never a blob: URL.
  let logoUrl: string | null = null;
  if (logoFile) {
    const { secureUrl } = await uploadToCloudinary(logoFile, {
      folder: 'organizations/logos',
    });
    logoUrl = secureUrl;
  }

  try {
    const addPromise = addDoc(collection(db, COLLECTION), {
      ...payload,
      logoUrl,
      status: 'active',
      memberCount: 0,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as Omit<CreateOrganizationPayload, never> & {
      logoUrl: string | null;
      status: string;
      memberCount: number;
      createdBy: string;
      createdAt: ReturnType<typeof serverTimestamp>;
      updatedAt: ReturnType<typeof serverTimestamp>;
    });
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Firestore database write timed out. Check your network or Firestore security rules.")), 15000);
    });
    
    const docRef = await Promise.race([addPromise, timeoutPromise]);
    const orgId = docRef.id;

    // ── Create Real Firebase Auth Account & Document for Club Adviser ──
    if (payload.adviser && payload.adviser.name && payload.adviser.email) {
      let authUid = '';
      const adviserPassword = payload.adviser.temporaryPassword || 'Adv-2026!#';

      try {
        authUid = await createSecondaryAuthUser(payload.adviser.email, adviserPassword);
      } catch (authErr: any) {
        console.warn('[createOrganization] Could not create Firebase Auth user for adviser:', authErr);
      }

      try {
        await addDoc(collection(db, 'organization_advisers'), {
          authUid,
          organizationId: orgId,
          organizationName: payload.name,
          name: payload.adviser.name.trim(),
          email: payload.adviser.email.trim().toLowerCase(),
          employeeId: (payload.adviser.employeeId || '').trim(),
          departmentId: payload.adviser.departmentId,
          title: payload.adviser.title || 'Club Adviser',
          temporaryPassword: adviserPassword,
          requiresPasswordChange: true,
          isActive: true,
          createdBy,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (advErr) {
        console.warn('Could not create organization_advisers document:', advErr);
      }
    }

    return orgId;
  } catch (error: any) {
    console.error("Organization creation failed:", error);
    throw new Error(`Organization creation failed: ${error.message}`);
  }
};

export const updateOrganization = async (
  orgId: string,
  payload: Partial<CreateOrganizationPayload>,
  logoFile?: File | null
): Promise<void> => {
  let logoUrl: string | null | undefined = payload.logoUrl;
  
  if (logoFile) {
    const { secureUrl } = await uploadToCloudinary(logoFile, {
      folder: 'organizations/logos',
    });
    logoUrl = secureUrl;
  }

  try {
    const docRef = doc(db, COLLECTION, orgId);
    
    const updateData: any = {
      ...payload,
      updatedAt: serverTimestamp(),
    };
    
    if (logoUrl !== undefined) {
      updateData.logoUrl = logoUrl;
    }

    const updatePromise = updateDoc(docRef, updateData);
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Firestore database write timed out.")), 15000);
    });
    
    await Promise.race([updatePromise, timeoutPromise]);
  } catch (error: any) {
    console.error("Organization update failed:", error);
    throw new Error(`Organization update failed: ${error.message}`);
  }
};
