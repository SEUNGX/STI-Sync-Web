import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  EventTypeDocument,
  EventCategoryDocument,
  VenueDocument
} from '../types/event-config.types';

// ==========================================
// EVENT TYPES
// ==========================================

export async function createEventType(
  data: Omit<EventTypeDocument, 'id' | 'createdAt' | 'updatedAt'>
) {
  const cleanName = data.name.trim();
  const snap = await getDocs(query(collection(db, 'event_types'), where('archived', '==', false)));
  const duplicate = snap.docs.find(
    (d) => (d.data().name || '').trim().toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`An event type named "${cleanName}" already exists.`);
  }

  const colRef = collection(db, 'event_types');
  return addDoc(colRef, {
    ...data,
    name: cleanName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateEventType(
  id: string,
  data: Partial<Omit<EventTypeDocument, 'id' | 'createdAt' | 'updatedAt'>>
) {
  const cleanName = data.name ? data.name.trim() : undefined;
  if (cleanName) {
    const snap = await getDocs(query(collection(db, 'event_types'), where('archived', '==', false)));
    const duplicate = snap.docs.find(
      (d) => d.id !== id && (d.data().name || '').trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`An event type named "${cleanName}" already exists.`);
    }
  }

  const docRef = doc(db, 'event_types', id);
  return updateDoc(docRef, {
    ...data,
    ...(cleanName ? { name: cleanName } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function archiveEventType(id: string) {
  return updateEventType(id, { archived: true });
}

export async function restoreEventType(id: string) {
  return updateEventType(id, { archived: false });
}

export async function deleteEventTypeForever(id: string) {
  const docRef = doc(db, 'event_types', id);
  return deleteDoc(docRef);
}

// ==========================================
// EVENT CATEGORIES
// ==========================================

export async function createEventCategory(
  data: Omit<EventCategoryDocument, 'id' | 'createdAt' | 'updatedAt'>
) {
  const cleanName = data.name.trim();
  const snap = await getDocs(query(collection(db, 'event_categories'), where('archived', '==', false)));
  const duplicate = snap.docs.find((d) => {
    const dData = d.data();
    return dData.typeId === data.typeId && (dData.name || '').trim().toLowerCase() === cleanName.toLowerCase();
  });
  if (duplicate) {
    throw new Error(`An event category named "${cleanName}" already exists for this event type.`);
  }

  const colRef = collection(db, 'event_categories');
  return addDoc(colRef, {
    ...data,
    name: cleanName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateEventCategory(
  id: string,
  data: Partial<Omit<EventCategoryDocument, 'id' | 'createdAt' | 'updatedAt'>>
) {
  const cleanName = data.name ? data.name.trim() : undefined;
  if (cleanName && data.typeId) {
    const snap = await getDocs(query(collection(db, 'event_categories'), where('archived', '==', false)));
    const duplicate = snap.docs.find((d) => {
      if (d.id === id) return false;
      const dData = d.data();
      return dData.typeId === data.typeId && (dData.name || '').trim().toLowerCase() === cleanName.toLowerCase();
    });
    if (duplicate) {
      throw new Error(`An event category named "${cleanName}" already exists for this event type.`);
    }
  }

  const docRef = doc(db, 'event_categories', id);
  return updateDoc(docRef, {
    ...data,
    ...(cleanName ? { name: cleanName } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function archiveEventCategory(id: string) {
  return updateEventCategory(id, { archived: true });
}

export async function restoreEventCategory(id: string) {
  return updateEventCategory(id, { archived: false });
}

export async function deleteEventCategoryForever(id: string) {
  const docRef = doc(db, 'event_categories', id);
  return deleteDoc(docRef);
}

// ==========================================
// VENUES
// ==========================================

export async function createVenue(
  data: Omit<VenueDocument, 'id' | 'createdAt' | 'updatedAt'>
) {
  const cleanName = data.name.trim();
  const snap = await getDocs(query(collection(db, 'venues'), where('archived', '==', false)));
  const duplicate = snap.docs.find(
    (d) => (d.data().name || '').trim().toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`A venue named "${cleanName}" already exists.`);
  }

  const colRef = collection(db, 'venues');
  return addDoc(colRef, {
    ...data,
    name: cleanName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateVenue(
  id: string,
  data: Partial<Omit<VenueDocument, 'id' | 'createdAt' | 'updatedAt'>>
) {
  const cleanName = data.name ? data.name.trim() : undefined;
  if (cleanName) {
    const snap = await getDocs(query(collection(db, 'venues'), where('archived', '==', false)));
    const duplicate = snap.docs.find(
      (d) => d.id !== id && (d.data().name || '').trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`A venue named "${cleanName}" already exists.`);
    }
  }

  const docRef = doc(db, 'venues', id);
  return updateDoc(docRef, {
    ...data,
    ...(cleanName ? { name: cleanName } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function archiveVenue(id: string) {
  return updateVenue(id, { archived: true });
}

export async function restoreVenue(id: string) {
  return updateVenue(id, { archived: false });
}

export async function deleteVenueForever(id: string) {
  const docRef = doc(db, 'venues', id);
  return deleteDoc(docRef);
}
