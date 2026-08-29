import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../../services/firebase';

export const PAYABLE_CATEGORIES_COLLECTION = 'payable_categories';

export type PayableCategoryClassification = 'fee' | 'fine';

export interface PayableCategoryDocument {
  id: string;
  name: string;
  code: string;
  type: 'custom' | 'admin_fine' | 'org_fine' | 'membership_due';
  categoryType: PayableCategoryClassification;
  defaultAmount: number;
  description?: string;
  organizationId?: string | null;
  organizationName?: string | null;
  isActive: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type CreatePayableCategoryPayload = Omit<
  PayableCategoryDocument,
  'id' | 'createdAt' | 'updatedAt'
>;

export const DEFAULT_PAYABLE_CATEGORIES: Array<Omit<PayableCategoryDocument, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    name: 'ID Replacement Fee',
    code: 'ID_REPLACE',
    type: 'custom',
    categoryType: 'fee',
    defaultAmount: 150,
    description: 'Processing fee for lost or damaged student identification cards.',
    isActive: true,
  },
  {
    name: 'Graduation Assessment Fee',
    code: 'GRAD_ASSESS',
    type: 'custom',
    categoryType: 'fee',
    defaultAmount: 500,
    description: 'Evaluation and administrative fee for graduating senior students.',
    isActive: true,
  },
  {
    name: 'Good Moral Certificate Fee',
    code: 'GOOD_MORAL',
    type: 'custom',
    categoryType: 'fee',
    defaultAmount: 50,
    description: 'Issuance and document verification fee for Certificate of Good Moral Character.',
    isActive: true,
  },
  {
    name: 'Transcript of Records (TOR) Fee',
    code: 'TOR_FEE',
    type: 'custom',
    categoryType: 'fee',
    defaultAmount: 200,
    description: 'Official Transcript of Records evaluation and document printing fee.',
    isActive: true,
  },
  {
    name: 'SAO Disciplinary Fine',
    code: 'SAO_DISCIPLINE',
    type: 'admin_fine',
    categoryType: 'fine',
    defaultAmount: 100,
    description: 'Administrative penalty for violations of institutional student conduct guidelines.',
    isActive: true,
  },
  {
    name: 'Campus Facility / Equipment Damage Fine',
    code: 'FACILITY_DAMAGE',
    type: 'admin_fine',
    categoryType: 'fine',
    defaultAmount: 500,
    description: 'Restitution fine for damaged school property, furniture, or computer laboratory equipment.',
    isActive: true,
  },
  {
    name: 'Late Equipment Return Fine',
    code: 'LATE_RETURN',
    type: 'admin_fine',
    categoryType: 'fine',
    defaultAmount: 50,
    description: 'Per-day penalty for overdue library books, borrowed devices, or lab equipment.',
    isActive: true,
  },
  {
    name: 'Uniform / Dress Code Violation Fine',
    code: 'UNIFORM_FINE',
    type: 'admin_fine',
    categoryType: 'fine',
    defaultAmount: 50,
    description: 'Administrative sanction for repeated campus uniform or dress code non-compliance.',
    isActive: true,
  },
];

export const DEFAULT_CLUB_CATEGORIES = (
  orgId: string,
  orgName: string
): Array<Omit<PayableCategoryDocument, 'id' | 'createdAt' | 'updatedAt'>> => [
  {
    name: 'Club Membership Dues',
    code: 'MEMBERSHIP_DUES',
    type: 'membership_due',
    categoryType: 'fee',
    defaultAmount: 100,
    description: `Official semester membership contribution for ${orgName}.`,
    organizationId: orgId,
    organizationName: orgName,
    isActive: true,
  },
  {
    name: 'Club T-Shirt / Merch Fee',
    code: 'CLUB_MERCH',
    type: 'custom',
    categoryType: 'fee',
    defaultAmount: 250,
    description: `Official organization shirt and merchandise assessment for ${orgName}.`,
    organizationId: orgId,
    organizationName: orgName,
    isActive: true,
  },
  {
    name: 'Meeting Absence Fine',
    code: 'MEETING_FINE',
    type: 'org_fine',
    categoryType: 'fine',
    defaultAmount: 20,
    description: 'Fine assessed for unexcused absence in scheduled organization meetings.',
    organizationId: orgId,
    organizationName: orgName,
    isActive: true,
  },
  {
    name: 'General Assembly Absence Fine',
    code: 'GA_ABSENCE_FINE',
    type: 'org_fine',
    categoryType: 'fine',
    defaultAmount: 50,
    description: 'Sanction for missing the mandatory organization General Assembly.',
    organizationId: orgId,
    organizationName: orgName,
    isActive: true,
  },
  {
    name: 'Special Project Contribution',
    code: 'SPECIAL_PROJECT',
    type: 'custom',
    categoryType: 'fee',
    defaultAmount: 150,
    description: `Targeted project, outreach activity, or event workshop assessment for ${orgName}.`,
    organizationId: orgId,
    organizationName: orgName,
    isActive: true,
  },
];

/**
 * Seed initial default categories if the collection is empty.
 */
export async function seedDefaultPayableCategories(): Promise<void> {
  const colRef = collection(db, PAYABLE_CATEGORIES_COLLECTION);
  const snap = await getDocs(colRef);

  if (snap.empty) {
    for (const item of DEFAULT_PAYABLE_CATEGORIES) {
      const newDoc = doc(colRef);
      await setDoc(newDoc, {
        ...item,
        id: newDoc.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }
}

/**
 * Seed standard default categories for a specific organization.
 */
export async function seedClubPayableCategories(
  orgId: string,
  orgName: string
): Promise<number> {
  const colRef = collection(db, PAYABLE_CATEGORIES_COLLECTION);
  const defaults = DEFAULT_CLUB_CATEGORIES(orgId, orgName);
  let count = 0;
  for (const item of defaults) {
    const newDoc = doc(colRef);
    await setDoc(newDoc, {
      ...item,
      id: newDoc.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    count++;
  }
  return count;
}

/**
 * Real-time hook for payable categories with optional organization filtering.
 * If orgId is provided, returns categories matching that organization PLUS global institutional categories.
 */
export function usePayableCategories(orgId?: string | null) {
  const [data, setData] = useState<PayableCategoryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const colRef = collection(db, PAYABLE_CATEGORIES_COLLECTION);
    const q = query(colRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (snapshot.empty) {
          try {
            await seedDefaultPayableCategories();
          } catch (seedErr) {
            console.warn('[usePayableCategories] Seeding error:', seedErr);
          }
        } else {
          let categories = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as PayableCategoryDocument[];

          if (orgId) {
            categories = categories.filter(
              (c) => c.organizationId === orgId || !c.organizationId
            );
          }
          setData(categories);
        }
        setLoading(false);
      },
      (err) => {
        console.error('[usePayableCategories] Stream error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orgId]);

  return { data, loading, error };
}

/**
 * Create a new payable category
 */
export async function createPayableCategory(
  payload: CreatePayableCategoryPayload
): Promise<string> {
  const colRef = collection(db, PAYABLE_CATEGORIES_COLLECTION);
  const newDoc = doc(colRef);

  await setDoc(newDoc, {
    ...payload,
    id: newDoc.id,
    name: payload.name.trim(),
    code: (payload.code || payload.name.toUpperCase().replace(/\s+/g, '_')).trim(),
    defaultAmount: Number(payload.defaultAmount) || 0,
    isActive: payload.isActive !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return newDoc.id;
}

/**
 * Update an existing payable category
 */
export async function updatePayableCategory(
  id: string,
  updates: Partial<CreatePayableCategoryPayload>
): Promise<void> {
  const docRef = doc(db, PAYABLE_CATEGORIES_COLLECTION, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a payable category
 */
export async function deletePayableCategory(id: string): Promise<void> {
  const docRef = doc(db, PAYABLE_CATEGORIES_COLLECTION, id);
  await deleteDoc(docRef);
}
