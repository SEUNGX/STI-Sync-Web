import { collection, doc, writeBatch, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../services/firebase';

export interface OfficerAssignmentData {
  roleId: string;
  roleName?: string;
  studentId: string;
  studentName: string;
  email: string;
  course?: string;
  year?: string;
  department?: string;
  contactNumber?: string;
  password?: string;
}

export const batchCreateOfficers = async (organizationId: string, officers: OfficerAssignmentData[]) => {
  if (!officers || officers.length === 0) return;

  const batch = writeBatch(db);
  const officersCollectionRef = collection(db, 'organization_officers');
  const membersCollectionRef = collection(db, 'organization_members');
  
  for (const officer of officers) {
    // 1. Create Officer document
    const officerDocRef = doc(officersCollectionRef);
    batch.set(officerDocRef, {
      id: officerDocRef.id,
      organizationId,
      roleId: officer.roleId,
      roleName: officer.roleName || '',
      studentId: officer.studentId,
      studentName: officer.studentName,
      email: officer.email,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Create Member document (officers are automatically active organization members)
    const memberDocRef = doc(membersCollectionRef);
    batch.set(memberDocRef, {
      id: memberDocRef.id,
      organizationId,
      studentId: officer.studentId,
      studentName: officer.studentName,
      email: officer.email,
      course: officer.course || 'N/A',
      year: officer.year || 'N/A',
      department: officer.department || 'N/A',
      contactNumber: officer.contactNumber || '',
      status: 'active',
      paymentStatus: 'paid',
      isOfficer: true,
      dateJoined: serverTimestamp(),
      applicationDate: serverTimestamp(),
      addedBy: 'Organization Creation',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // 3. Atomically update organization memberCount
  const orgDocRef = doc(db, 'organizations', organizationId);
  batch.update(orgDocRef, {
    memberCount: increment(officers.length),
    updatedAt: serverTimestamp(),
  });
  
  // Implement a timeout to prevent infinite hanging
  const commitPromise = batch.commit();
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Firestore batch write timed out. Check your network or Firestore security rules.")), 15000);
  });
  
  try {
    await Promise.race([commitPromise, timeoutPromise]);
  } catch (error: any) {
    console.error("Batch officer creation failed:", error);
    throw new Error(`Batch officer creation failed: ${error.message}`);
  }
};
