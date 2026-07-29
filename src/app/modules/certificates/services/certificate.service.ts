import { 
  collection, addDoc, updateDoc, doc, getDocs, query, where, 
  serverTimestamp, orderBy 
} from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { CertificateTemplate, IssuedCertificateRecord } from '../types/certificate.types';

export const TEMPLATES_COLLECTION = 'certificate_templates';
export const ISSUED_COLLECTION = 'certificates_issued';

export const saveCertificateTemplate = async (
  template: Partial<CertificateTemplate>,
  uid: string,
  existingId?: string
): Promise<string> => {
  const payload = {
    ...template,
    createdBy: uid,
    updatedAt: serverTimestamp(),
  };

  if (existingId) {
    const ref = doc(db, TEMPLATES_COLLECTION, existingId);
    await updateDoc(ref, payload);
    return existingId;
  } else {
    (payload as any).createdAt = serverTimestamp();
    const docRef = await addDoc(collection(db, TEMPLATES_COLLECTION), payload);
    return docRef.id;
  }
};

export const recordIssuedCertificates = async (
  records: Omit<IssuedCertificateRecord, 'id' | 'issuedAt'>[],
  uid: string
): Promise<void> => {
  for (const record of records) {
    await addDoc(collection(db, ISSUED_COLLECTION), {
      ...record,
      issuedBy: uid,
      issuedAt: serverTimestamp(),
    });
  }
};
