import { collection, addDoc, doc, getDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { AddMemberPayload } from '../types/member.types';

const COLLECTION = 'organization_members';

export const addMember = async (payload: AddMemberPayload, addedBy: string): Promise<string> => {
  try {
    const addPromise = addDoc(collection(db, COLLECTION), {
      ...payload,
      isOfficer: false,
      addedBy,
      dateJoined: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Firestore database write timed out.")), 15000);
    });
    
    const docRef = await Promise.race([addPromise, timeoutPromise]);

    // Increment memberCount on the organization document if active
    if (payload.organizationId && payload.status === 'active') {
      try {
        const orgRef = doc(db, 'organizations', payload.organizationId);
        await updateDoc(orgRef, {
          memberCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      } catch (orgErr) {
        console.warn('Could not update organization memberCount:', orgErr);
      }
    }

    return docRef.id;
  } catch (error: any) {
    console.error("Member creation failed:", error);
    throw new Error(`Member creation failed: ${error.message}`);
  }
};

export const updateMemberStatus = async (docId: string, status: 'active' | 'inactive' | 'suspended'): Promise<void> => {
  const docRef = doc(db, COLLECTION, docId);
  const snap = await getDoc(docRef);
  const prevData = snap.exists() ? snap.data() : null;
  const prevStatus = prevData?.status;
  const orgId = prevData?.organizationId;

  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp(),
  });

  if (orgId && prevStatus !== status) {
    if (prevStatus === 'active' && status !== 'active') {
      try {
        await updateDoc(doc(db, 'organizations', orgId), {
          memberCount: increment(-1),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Could not decrement organization memberCount:', err);
      }
    } else if (prevStatus !== 'active' && status === 'active') {
      try {
        await updateDoc(doc(db, 'organizations', orgId), {
          memberCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Could not increment organization memberCount:', err);
      }
    }
  }
};

export const updatePaymentStatus = async (docId: string, paymentStatus: 'paid' | 'outstanding'): Promise<void> => {
  const docRef = doc(db, COLLECTION, docId);
  await updateDoc(docRef, {
    paymentStatus,
    updatedAt: serverTimestamp(),
  });
};

export const removeMember = async (docId: string): Promise<void> => {
  await updateMemberStatus(docId, 'inactive');
};

export const deleteMember = async (docId: string, organizationId: string): Promise<void> => {
  const docRef = doc(db, COLLECTION, docId);
  const snap = await getDoc(docRef);
  const data = snap.exists() ? snap.data() : null;

  await deleteDoc(docRef);

  if (organizationId && data?.status === 'active') {
    try {
      await updateDoc(doc(db, 'organizations', organizationId), {
        memberCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Could not decrement organization memberCount on delete:', err);
    }
  }
};

export const appointAsOfficer = async (
  organizationId: string,
  memberDocId: string,
  roleId: string,
  studentId: string,
  studentName: string,
  email: string,
  tempPassword?: string
): Promise<void> => {
  const batch = writeBatch(db);
  
  // 1. Update the member doc to reflect they are an officer
  const memberRef = doc(db, COLLECTION, memberDocId);
  batch.update(memberRef, {
    isOfficer: true,
    updatedAt: serverTimestamp(),
  });
  
  // 2. Create the officer doc in organization_officers
  const officersCollectionRef = collection(db, 'organization_officers');
  const officerDocRef = doc(officersCollectionRef);
  
  batch.set(officerDocRef, {
    id: officerDocRef.id,
    organizationId,
    roleId,
    studentId,
    studentName,
    email,
    temporaryPassword: tempPassword || 'TempPass123!',
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  const commitPromise = batch.commit();
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Firestore batch write timed out.")), 15000);
  });
  
  try {
    await Promise.race([commitPromise, timeoutPromise]);
  } catch (error: any) {
    console.error("Appoint officer failed:", error);
    throw new Error(`Appoint officer failed: ${error.message}`);
  }
};
