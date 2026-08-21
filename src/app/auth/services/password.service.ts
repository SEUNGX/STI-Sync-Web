/**
 * src/app/auth/services/password.service.ts
 *
 * Handles changing user passwords with real Firebase Auth and synchronizing
 * requiresPasswordChange status across Firestore collections (organization_advisers,
 * organizations, students, and local session).
 */

import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../../services/firebase';
import type { OfficerProfile } from '../hooks/useOfficerProfile';

const SESSION_KEY = 'sti_sync_officer_session';

export async function changeOfficerOrAdviserPassword(
  currentPassword: string,
  newPassword: string,
  profile: OfficerProfile
): Promise<void> {
  const email = profile.email?.trim().toLowerCase();
  if (!email) {
    throw new Error('No email found in active session profile.');
  }

  // ── 1. Re-authenticate / Ensure Firebase Auth User is signed in ──
  let user = auth.currentUser;
  if (!user || user.email?.toLowerCase() !== email) {
    const cred = await signInWithEmailAndPassword(auth, email, currentPassword);
    user = cred.user;
  } else {
    try {
      const cred = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(user, cred);
    } catch (reauthErr: any) {
      console.warn('[passwordService] Reauth failed, trying fresh signIn:', reauthErr);
      const cred = await signInWithEmailAndPassword(auth, email, currentPassword);
      user = cred.user;
    }
  }

  // ── 2. Update Password in Firebase Auth ──
  await updatePassword(user, newPassword);

  // ── 3. Update Firestore Records ──
  try {
    if (profile.isAdviser) {
      // Update organization_advisers
      const qAdv = query(
        collection(db, 'organization_advisers'),
        where('email', '==', email)
      );
      const advSnap = await getDocs(qAdv);
      for (const d of advSnap.docs) {
        await updateDoc(doc(db, 'organization_advisers', d.id), {
          requiresPasswordChange: false,
          temporaryPassword: null,
          updatedAt: serverTimestamp(),
        });
      }

      // If activeOrganizationId is present, update embedded adviser in organizations
      if (profile.activeOrganizationId) {
        const orgRef = doc(db, 'organizations', profile.activeOrganizationId);
        await updateDoc(orgRef, {
          'adviser.requiresPasswordChange': false,
          'adviser.temporaryPassword': null,
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      // Officer / Student
      const qStudent = query(
        collection(db, 'students'),
        where('email', '==', email)
      );
      const studentSnap = await getDocs(qStudent);
      for (const d of studentSnap.docs) {
        await updateDoc(doc(db, 'students', d.id), {
          requiresPasswordChange: false,
          updatedAt: serverTimestamp(),
        });
      }

      if (profile.studentId) {
        const qOfficer = query(
          collection(db, 'organization_officers'),
          where('studentId', '==', profile.studentId)
        );
        const officerSnap = await getDocs(qOfficer);
        for (const d of officerSnap.docs) {
          await updateDoc(doc(db, 'organization_officers', d.id), {
            requiresPasswordChange: false,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }
  } catch (dbErr) {
    console.warn('[passwordService] Firestore status update warning:', dbErr);
  }

  // ── 4. Update Local Session ──
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.requiresPasswordChange = false;
      localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
    }
  } catch (sessErr) {
    console.warn('[passwordService] Session update warning:', sessErr);
  }
}
