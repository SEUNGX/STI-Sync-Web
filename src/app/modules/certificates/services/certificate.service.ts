import { 
  collection, addDoc, updateDoc, setDoc, deleteDoc, doc, getDoc, getDocs, query, where, 
  serverTimestamp, orderBy 
} from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { CertificateItem, CertificateStatus, IssuedCertificateRecord } from '../types/certificate.types';

export const TEMPLATES_COLLECTION = 'certificate_templates';
export const CERTIFICATES_COLLECTION = 'certificates';
export const ISSUED_COLLECTION = 'certificates_issued';

const isSpecialObject = (val: any) => {
  if (!val || typeof val !== 'object') return false;
  if (val instanceof Date) return true;
  if (typeof val.toMillis === 'function') return true;
  // Firestore FieldValue (serverTimestamp, etc.)
  if (val.constructor && (val.constructor.name === 'FieldValue' || val._methodName)) return true;
  return false;
};

const cleanUndefined = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(v => cleanUndefined(v));
  } else if (obj !== null && typeof obj === 'object' && !isSpecialObject(obj)) {
    return Object.entries(obj).reduce((acc: any, [key, value]) => {
      if (value !== undefined) {
        acc[key] = cleanUndefined(value);
      }
      return acc;
    }, {});
  }
  return obj;
};

export const saveCertificateItem = async (
  cert: Partial<CertificateItem>,
  uid: string,
  existingId?: string,
  organizationId?: string | null
): Promise<string> => {
  const cleanedCert = cleanUndefined({ ...cert });

  const payload = {
    ...cleanedCert,
    title: cert.title || cert.name || 'Untitled Certificate',
    name: cert.title || cert.name || 'Untitled Certificate',
    category: cert.category || 'Participation',
    status: cert.status || 'Approved',
    createdBy: uid,
    organizationId: organizationId !== undefined && organizationId !== null ? organizationId : (cert.organizationId || 'admin'),
    organizationName: cert.organizationName || (organizationId === 'admin' || !organizationId ? 'SAO Admin' : 'Student Organization'),
    updatedAt: serverTimestamp(),
  };

  if (existingId && existingId.trim().length > 0) {
    // Attempt update on CERTIFICATES_COLLECTION
    try {
      const refCerts = doc(db, CERTIFICATES_COLLECTION, existingId);
      await setDoc(refCerts, payload, { merge: true });
    } catch (e) {
      console.warn('SetDoc on certificates collection failed, trying template collection:', e);
    }

    // Also attempt update on TEMPLATES_COLLECTION in case it originated there
    try {
      const refTemplates = doc(db, TEMPLATES_COLLECTION, existingId);
      await setDoc(refTemplates, payload, { merge: true });
    } catch (e) {
      // Ignore if not present in templates collection
    }

    return existingId;
  } else {
    (payload as any).createdAt = serverTimestamp();
    const docRef = await addDoc(collection(db, CERTIFICATES_COLLECTION), payload);
    return docRef.id;
  }
};

export const updateCertificateStatus = async (
  id: string,
  status: CertificateStatus,
  notesOrReason?: string
): Promise<void> => {
  const ref = doc(db, CERTIFICATES_COLLECTION, id);
  const payload: Record<string, any> = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (status === 'Rejected') {
    payload.rejectionReason = notesOrReason || 'Needs revision';
  } else if (status === 'Approved') {
    payload.approvalNotes = notesOrReason || 'Approved by Admin';
    payload.rejectionReason = null;
  }

  await updateDoc(ref, payload);
};

export const deleteCertificate = async (id: string): Promise<void> => {
  const ref = doc(db, CERTIFICATES_COLLECTION, id);
  await deleteDoc(ref);
};

export const getCertificateById = async (id: string): Promise<CertificateItem | null> => {
  if (!id) return null;
  try {
    const certRef = doc(db, CERTIFICATES_COLLECTION, id);
    const certSnap = await getDoc(certRef);
    if (certSnap.exists()) {
      const data = certSnap.data();
      return {
        id: certSnap.id,
        ...data,
        name: data.name || data.title || '',
        title: data.title || data.name || '',
      } as CertificateItem;
    }
    const templateRef = doc(db, TEMPLATES_COLLECTION, id);
    const templateSnap = await getDoc(templateRef);
    if (templateSnap.exists()) {
      const data = templateSnap.data();
      return {
        id: templateSnap.id,
        ...data,
        name: data.name || data.title || '',
        title: data.title || data.name || '',
      } as CertificateItem;
    }
  } catch (err) {
    console.error('Failed to get certificate by id:', err);
  }
  return null;
};

// Backward-compatibility wrapper for existing template save code
export const saveCertificateTemplate = async (
  template: Partial<CertificateItem>,
  uid: string,
  existingId?: string,
  organizationId?: string | null
): Promise<string> => {
  return saveCertificateItem(template, uid, existingId, organizationId);
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
