import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../../../services/firebase';

const SESSION_KEY = 'sti_sync_officer_session';

export function useOfficerAuth() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (identifier: string, password: string): Promise<boolean> => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const trimmedId = identifier.trim();
      const trimmedPass = password.trim();

      if (!trimmedId || !trimmedPass) {
        setError('Please enter both student ID/email and password.');
        return false;
      }

      // 1. If identifier is an email and not logged in, attempt Firebase Auth sign-in
      if (!auth.currentUser && trimmedId.includes('@')) {
        try {
          await signInWithEmailAndPassword(auth, trimmedId, trimmedPass);
        } catch (authErr: any) {
          // Log auth attempt note; will continue to match temporaryPassword in Firestore
          console.warn('[useOfficerAuth] Firebase Auth note:', authErr?.code || authErr?.message);
        }
      }

      // 2. Query organization_officers by studentId
      let q = query(
        collection(db, 'organization_officers'),
        where('studentId', '==', trimmedId),
        where('isActive', '==', true)
      );
      let querySnapshot = await getDocs(q);

      // 3. Fallback: Query by email if no studentId match
      if (querySnapshot.empty) {
        q = query(
          collection(db, 'organization_officers'),
          where('email', '==', trimmedId),
          where('isActive', '==', true)
        );
        querySnapshot = await getDocs(q);
      }

      // 4. Match temporaryPassword or authenticated user profile
      let matchedDoc: any = null;
      const cleanId = trimmedId.toLowerCase();
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const docStudentId = (data.studentId || '').trim().toLowerCase();
        const docEmail = (data.email || '').trim().toLowerCase();
        const isMatchId = docStudentId === cleanId || docEmail === cleanId;
        const isMatchPass = data.temporaryPassword === trimmedPass || auth.currentUser !== null;

        if (isMatchId && isMatchPass) {
          matchedDoc = data;
          break;
        }
      }

      if (matchedDoc) {
        // Create session
        const session = {
          studentId: matchedDoc.studentId,
          studentName: matchedDoc.studentName,
          email: matchedDoc.email,
          activeOrganizationId: matchedDoc.organizationId,
          activeRoleId: matchedDoc.roleId
        };
        
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return true;
      } else {
        setError('Invalid student ID/email or password. Please verify your officer account details.');
        return false;
      }
    } catch (e: any) {
      console.error("Login failed:", e);
      if (e?.code === 'permission-denied') {
        setError('Database Permission Error: Please ensure Firestore rules in Firebase Console allow reading organization_officers (allow read: if true;).');
      } else {
        setError('An error occurred during login. Please try again.');
      }
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  };

  return { login, isLoggingIn, error };
}
