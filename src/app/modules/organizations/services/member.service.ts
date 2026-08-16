import {
  collection,
  addDoc,
  setDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { AddMemberPayload, OrganizationMemberStatus } from '../types/member.types';

const COLLECTION = 'organization_members';

/**
 * Helper to ensure a membership fee payable is generated for an active member
 * the moment they join or are approved:
 * 1. Checks if the club already created/generated a membership_due in /payables (uses its fee, label, semester, dueDate).
 * 2. Or checks if the organization has membershipFee configured in /organizations.
 * 3. Deduplicates and automatically creates the 'membership_due' payable document for the student!
 */
export async function ensureMembershipPayable(
  organizationId: string,
  studentId: string,
  studentName: string,
  paymentStatus: 'paid' | 'outstanding' = 'outstanding',
  addedBy: string = 'Officer'
): Promise<{ payableCreated: boolean; feeAmount?: number }> {
  try {
    if (!organizationId || !studentId) return { payableCreated: false };

    const payablesRef = collection(db, 'payables');

    // 1. Check if the student already has a membership_due for this organization
    const qExistingOrgDues = query(
      payablesRef,
      where('organizationId', '==', organizationId),
      where('type', '==', 'membership_due')
    );
    const existingSnap = await getDocs(qExistingOrgDues);

    const alreadyHasDue = existingSnap.docs.some((d) => {
      const data = d.data();
      const sId = (studentId || '').toString().trim().toLowerCase();
      const match1 = (data.studentId || '').toString().trim().toLowerCase() === sId;
      const match2 = (data.studentSchoolId || '').toString().trim().toLowerCase() === sId;
      return match1 || match2;
    });

    if (alreadyHasDue) {
      return { payableCreated: false };
    }

    // 2. Determine fee amount, label, and semester from existing club dues OR org profile
    let feeAmount = 0;
    let label = 'Membership Due';
    let description = 'Semester membership fee';
    let semesterId: string | null = null;
    let dueDate: any = null;
    let organizationName = 'Organization';

    // If the club already has membership_due payables created, extract their details as template
    if (!existingSnap.empty) {
      const sample = existingSnap.docs[0].data();
      feeAmount = Number(sample.assignedAmount) || 0;
      label = sample.label || label;
      description = sample.description || description;
      semesterId = sample.semesterId || null;
      dueDate = sample.dueDate || null;
      organizationName = sample.organizationName || organizationName;
    }

    // If no fee found from existing payables, check /organizations document
    if (feeAmount <= 0) {
      const orgRef = doc(db, 'organizations', organizationId);
      const orgSnap = await getDoc(orgRef);
      if (orgSnap.exists()) {
        const orgData = orgSnap.data();
        feeAmount = Number(orgData.membershipFee || 0);
        organizationName = orgData.name || organizationName;
        label = `${orgData.acronym || orgData.name || 'Organization'} Membership Due`;
      }
    }

    // 3. If there is a fee, create the membership_due payable for this student
    if (feeAmount > 0) {
      const isPaid = paymentStatus === 'paid';
      const newPayableRef = doc(collection(db, 'payables'));

      await setDoc(newPayableRef, {
        id: newPayableRef.id,
        studentId: studentId,
        studentSchoolId: studentId,
        studentName: studentName || 'Student',
        type: 'membership_due',
        label: label,
        description: description,
        organizationId: organizationId,
        organizationName: organizationName,
        semesterId: semesterId,
        eventId: null,
        assignedAmount: feeAmount,
        paidAmount: isPaid ? feeAmount : 0,
        status: isPaid ? 'paid' : 'pending',
        dueDate: dueDate,
        paidAt: isPaid ? serverTimestamp() : null,
        recordedBy: isPaid ? addedBy : null,
        paymentMethod: isPaid ? 'cash' : null,
        createdBy: addedBy || 'Officer Management',
        assignedBy: addedBy || 'Officer Management',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return { payableCreated: true, feeAmount };
    }
  } catch (err) {
    console.warn('[member.service] Error ensuring membership payable:', err);
  }
  return { payableCreated: false };
}

export const addMember = async (payload: AddMemberPayload, addedBy: string): Promise<string> => {
  try {
    const addPromise = addDoc(collection(db, COLLECTION), {
      ...payload,
      isOfficer: false,
      addedBy,
      dateJoined: payload.status === 'active' ? serverTimestamp() : null,
      applicationDate: serverTimestamp(),
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

        // Trigger membership fee payable if configured or created
        await ensureMembershipPayable(
          payload.organizationId,
          payload.studentId || docRef.id,
          payload.studentName,
          payload.paymentStatus,
          addedBy
        );
      } catch (orgErr) {
        console.warn('Could not update organization memberCount / payable:', orgErr);
      }
    }

    return docRef.id;
  } catch (error: any) {
    console.error("Member creation failed:", error);
    throw new Error(`Member creation failed: ${error.message}`);
  }
};

export const updateMemberStatus = async (
  docId: string,
  status: OrganizationMemberStatus,
  actionByUid?: string
): Promise<void> => {
  const docRef = doc(db, COLLECTION, docId);
  const snap = await getDoc(docRef);
  const prevData = snap.exists() ? snap.data() : null;
  const prevStatus = prevData?.status;
  const orgId = prevData?.organizationId;
  const studentId = prevData?.studentId || docId;
  const studentName = prevData?.studentName || 'Student';

  await updateDoc(docRef, {
    status,
    dateJoined: status === 'active' && !prevData?.dateJoined ? serverTimestamp() : prevData?.dateJoined || serverTimestamp(),
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

        // Trigger membership fee payable if not already assigned
        await ensureMembershipPayable(
          orgId,
          studentId,
          studentName,
          prevData?.paymentStatus || 'outstanding',
          actionByUid || 'Officer Status Update'
        );
      } catch (err) {
        console.warn('Could not increment organization memberCount / payable:', err);
      }
    }
  }
};

/**
 * Approves a pending membership application.
 * 1. Sets status: 'active', dateJoined: now.
 * 2. Increments organization memberCount.
 * 3. Checks if the club already created a membership_due (or has configured membershipFee).
 *    If yes, automatically creates a 'membership_due' payable for this student in /payables!
 */
export const approveMemberApplication = async (
  memberDocId: string,
  approvedByUid?: string
): Promise<{ payableCreated: boolean; feeAmount?: number }> => {
  const memberRef = doc(db, COLLECTION, memberDocId);
  const memberSnap = await getDoc(memberRef);

  if (!memberSnap.exists()) {
    throw new Error('Membership record not found.');
  }

  const memberData = memberSnap.data();
  const orgId = memberData.organizationId;
  const studentId = memberData.studentId || memberDocId;
  const studentName = memberData.studentName || 'Student';

  // 1. Update member status
  await updateDoc(memberRef, {
    status: 'active',
    dateJoined: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2. Increment organization member count
  if (orgId) {
    try {
      const orgRef = doc(db, 'organizations', orgId);
      await updateDoc(orgRef, {
        memberCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch (orgErr) {
      console.warn('Error updating org member count:', orgErr);
    }
  }

  // 3. Trigger Membership Due Payable if club already created dues or requires fee
  const res = await ensureMembershipPayable(
    orgId,
    studentId,
    studentName,
    'outstanding',
    approvedByUid || 'Officer Application Approval'
  );

  return res;
};

/**
 * Rejects a pending membership application.
 */
export const rejectMemberApplication = async (
  memberDocId: string,
  reason?: string
): Promise<void> => {
  const memberRef = doc(db, COLLECTION, memberDocId);
  await updateDoc(memberRef, {
    status: 'rejected',
    rejectionReason: reason || 'Application not accepted by organization officers.',
    updatedAt: serverTimestamp(),
  });
};

export const updatePaymentStatus = async (
  docId: string,
  paymentStatus: 'paid' | 'outstanding'
): Promise<void> => {
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
