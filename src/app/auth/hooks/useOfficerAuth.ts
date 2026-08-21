import { useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
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
        setError('Please enter both student/employee ID or email and password.');
        return false;
      }

      const cleanId = trimmedId.toLowerCase();

      // 1. Look up Officer in organization_officers (by studentId or email)
      let matchedDoc: any = null;
      let isAdviserUser = false;

      let qOfficer = query(
        collection(db, 'organization_officers'),
        where('studentId', '==', trimmedId),
        where('isActive', '==', true)
      );
      let officerSnap = await getDocs(qOfficer);

      if (officerSnap.empty) {
        qOfficer = query(
          collection(db, 'organization_officers'),
          where('email', '==', trimmedId),
          where('isActive', '==', true)
        );
        officerSnap = await getDocs(qOfficer);
      }

      if (!officerSnap.empty) {
        matchedDoc = officerSnap.docs[0].data();
        isAdviserUser = false;
      }

      // 2. If not found in officers, look up in organization_advisers (by email or employeeId)
      if (!matchedDoc) {
        let qAdv = query(
          collection(db, 'organization_advisers'),
          where('email', '==', trimmedId),
          where('isActive', '==', true)
        );
        let advSnap = await getDocs(qAdv);

        if (advSnap.empty) {
          qAdv = query(
            collection(db, 'organization_advisers'),
            where('email', '==', cleanId),
            where('isActive', '==', true)
          );
          advSnap = await getDocs(qAdv);
        }

        if (advSnap.empty) {
          qAdv = query(
            collection(db, 'organization_advisers'),
            where('employeeId', '==', trimmedId),
            where('isActive', '==', true)
          );
          advSnap = await getDocs(qAdv);
        }

        // Also check without isActive constraint in case it wasn't populated
        if (advSnap.empty) {
          qAdv = query(
            collection(db, 'organization_advisers'),
            where('email', '==', cleanId)
          );
          advSnap = await getDocs(qAdv);
        }

        if (advSnap.empty) {
          qAdv = query(
            collection(db, 'organization_advisers'),
            where('employeeId', '==', trimmedId)
          );
          advSnap = await getDocs(qAdv);
        }

        if (!advSnap.empty) {
          matchedDoc = advSnap.docs[0].data();
          isAdviserUser = true;
        }
      }

      // 3. Check embedded adviser in organizations collection
      if (!matchedDoc) {
        let qOrgAdv = query(
          collection(db, 'organizations'),
          where('adviser.email', '==', cleanId)
        );
        let orgSnap = await getDocs(qOrgAdv);

        if (orgSnap.empty) {
          qOrgAdv = query(
            collection(db, 'organizations'),
            where('adviser.email', '==', trimmedId)
          );
          orgSnap = await getDocs(qOrgAdv);
        }

        if (orgSnap.empty) {
          qOrgAdv = query(
            collection(db, 'organizations'),
            where('adviser.employeeId', '==', trimmedId)
          );
          orgSnap = await getDocs(qOrgAdv);
        }

        if (!orgSnap.empty) {
          const orgData = orgSnap.docs[0].data();
          if (orgData.adviser) {
            matchedDoc = {
              ...orgData.adviser,
              organizationId: orgSnap.docs[0].id,
              organizationName: orgData.name,
            };
            isAdviserUser = true;
          }
        }
      }

      // 4. Fallback: If not in organization_officers directly, check if this is an active student in students collection
      if (!matchedDoc) {
        let qStudent = query(
          collection(db, 'students'),
          where('studentId', '==', trimmedId)
        );
        let studentSnap = await getDocs(qStudent);
        if (studentSnap.empty) {
          qStudent = query(
            collection(db, 'students'),
            where('email', '==', cleanId)
          );
          studentSnap = await getDocs(qStudent);
        }

        if (!studentSnap.empty) {
          const studentData = studentSnap.docs[0].data();
          const qOff = query(
            collection(db, 'organization_officers'),
            where('studentId', '==', studentData.studentId),
            where('isActive', '==', true)
          );
          const offSnap = await getDocs(qOff);
          if (!offSnap.empty) {
            matchedDoc = {
              ...offSnap.docs[0].data(),
              email: studentData.email || offSnap.docs[0].data().email,
            };
            isAdviserUser = false;
          }
        }
      }

      if (!matchedDoc) {
        setError('No active officer or adviser account found with these credentials.');
        return false;
      }

      // 5. Authenticate Password with Firebase Auth
      const targetEmail = (matchedDoc.email || '').trim().toLowerCase();
      let authenticated = false;

      if (targetEmail) {
        try {
          await signInWithEmailAndPassword(auth, targetEmail, trimmedPass);
          authenticated = true;
        } catch (authErr: any) {
          const errCode = authErr?.code;
          console.warn('[useOfficerAuth] Firebase Auth attempt error:', errCode, authErr?.message);

          if (errCode === 'auth/user-not-found' || errCode === 'auth/invalid-credential') {
            // If user does not exist in Firebase Auth yet, but matches temporaryPassword in Firestore,
            // provision their real Firebase Auth user account now!
            if (matchedDoc.temporaryPassword && matchedDoc.temporaryPassword === trimmedPass) {
              try {
                await createUserWithEmailAndPassword(auth, targetEmail, trimmedPass);
                authenticated = true;
              } catch (createErr: any) {
                if (createErr?.code === 'auth/email-already-in-use') {
                  setError('Incorrect password. Please enter your valid account password.');
                  return false;
                }
                console.warn('[useOfficerAuth] On-the-fly Auth user creation error:', createErr);
                authenticated = true;
              }
            } else {
              setError('Incorrect password. Please enter your valid account password.');
              return false;
            }
          } else if (errCode === 'auth/wrong-password') {
            setError('Incorrect password. Please enter your valid account password.');
            return false;
          } else {
            setError(authErr?.message || 'Authentication failed. Please try again.');
            return false;
          }
        }
      } else {
        setError('Account has no registered email address.');
        return false;
      }

      if (!authenticated) {
        setError('Invalid student/employee ID or password.');
        return false;
      }

      // 6. Verify organization status in Firestore
      if (matchedDoc.organizationId) {
        try {
          const orgSnap = await getDoc(doc(db, 'organizations', matchedDoc.organizationId));
          if (orgSnap.exists()) {
            const orgData = orgSnap.data();
            const orgStatus = orgData.status || 'active';
            if (['suspended', 'inactive', 'archived'].includes(orgStatus)) {
              setError(
                `Your organization (${orgData.name || 'Organization'}) is currently ${orgStatus}. Access is restricted by SAO Administration.`
              );
              return false;
            }
          }
        } catch (orgCheckErr) {
          console.warn('[useOfficerAuth] Org status check failed:', orgCheckErr);
        }
      }

      // 7. Create session
      const session = {
        studentId: matchedDoc.studentId || matchedDoc.employeeId || matchedDoc.email,
        studentName: matchedDoc.studentName || matchedDoc.name || 'Club Adviser',
        email: matchedDoc.email,
        activeOrganizationId: matchedDoc.organizationId,
        activeRoleId: isAdviserUser ? 'adviser' : matchedDoc.roleId,
        isAdviser: isAdviserUser,
        requiresPasswordChange: matchedDoc.requiresPasswordChange ?? false,
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return true;
    } catch (e: any) {
      console.error('Login failed:', e);
      if (e?.code === 'permission-denied') {
        setError('Database Permission Error: Please ensure Firestore rules allow reading organization_officers and organization_advisers.');
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


