import {
  collection, doc, addDoc, updateDoc, query, where, orderBy, limit,
  getDocs, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { DocumentDocument, DocStatus } from '../types/document.types';

const COLLECTION_NAME = 'documents';

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createDocument(
  data: Omit<DocumentDocument, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const payload = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
  return docRef.id;
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateDocument(
  id: string,
  data: Partial<Omit<DocumentDocument, 'id' | 'createdAt'>>
): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, id);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

// ─── Review Actions ──────────────────────────────────────────────────────────

export async function reviewDocument(
  id: string,
  status: 'Approved' | 'Rejected' | 'Returned',
  reviewedBy: string,
  remarks: string | null,
): Promise<void> {
  await updateDocument(id, {
    status,
    reviewedBy,
    reviewedAt: Timestamp.now(),
    remarks,
  });
}

// ─── Mark Broadcast Read ─────────────────────────────────────────────────────

export async function markDocumentRead(
  docId: string,
  orgId: string,
): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, docId);
  await updateDoc(ref, {
    [`readBy.${orgId}`]: Timestamp.now(),
    updatedAt: serverTimestamp(),
  });
}

// ─── Reference Number Generator ──────────────────────────────────────────────

export async function getNextReferenceNumber(prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const refPrefix = `${prefix}-${year}-`;

  const q = query(
    collection(db, COLLECTION_NAME),
    where('referenceNumber', '>=', refPrefix),
    where('referenceNumber', '<=', refPrefix + ''),
    orderBy('referenceNumber', 'desc'),
    limit(1),
  );

  const snapshot = await getDocs(q);
  let nextNum = 1;

  if (!snapshot.empty) {
    const lastRef = snapshot.docs[0].data().referenceNumber as string;
    const lastNum = parseInt(lastRef.replace(refPrefix, ''), 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }

  return `${refPrefix}${String(nextNum).padStart(4, '0')}`;
}
