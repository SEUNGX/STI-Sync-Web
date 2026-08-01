import { collection, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { CreateAnnouncementPayload, AnnouncementDocument } from '../types/announcement.types';
import { websocketHub } from '@/services/websocket';

export const ANNOUNCEMENTS_COLLECTION = 'announcements';

export const createAnnouncement = async (
  payload: CreateAnnouncementPayload,
  authorUid: string,
  authorName: string,
  authorRole?: string
): Promise<string> => {
  const docPayload: Partial<AnnouncementDocument> = {
    ...payload,
    authorUid,
    authorName,
    authorRole: authorRole || payload.authorRole || null,
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  };

  const docRef = await addDoc(collection(db, ANNOUNCEMENTS_COLLECTION), docPayload);
  
  // Dispatch a WebSocket message so connected officer/student panels can show an instant toast notification
  websocketHub.send({
    type: 'BROADCAST_ANNOUNCEMENT',
    payload: {
      announcementId: docRef.id,
      title: payload.title,
      priority: payload.priority,
      targetOrganizationIds: payload.audience === 'campus-wide' || payload.audience === 'all-organizations' 
        ? 'all' 
        : payload.targetOrgIds
    },
    senderId: authorUid,
    organizationId: payload.organizationId || null
  });

  return docRef.id;
};

export const updateAnnouncement = async (
  id: string,
  payload: Partial<CreateAnnouncementPayload>
): Promise<void> => {
  const docRef = doc(db, ANNOUNCEMENTS_COLLECTION, id);
  await updateDoc(docRef, {
    ...payload,
    updatedAt: serverTimestamp() as any,
  });
};

export const togglePin = async (id: string, pinned: boolean): Promise<void> => {
  const docRef = doc(db, ANNOUNCEMENTS_COLLECTION, id);
  await updateDoc(docRef, {
    pinned,
    updatedAt: serverTimestamp() as any,
  });
};

export const deleteAnnouncement = async (id: string): Promise<void> => {
  const docRef = doc(db, ANNOUNCEMENTS_COLLECTION, id);
  await deleteDoc(docRef);
};
