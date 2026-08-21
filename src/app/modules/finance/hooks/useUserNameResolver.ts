import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../../../services/firebase';

const PLACEHOLDER_BLACKLIST = new Set([
  'admin sao',
  'sao admin',
  'admin',
  'sao',
  'sao approval',
  'officer',
  'system',
  'organization creation',
  'sao org',
  'sas',
  'sas_admin',
  'sao_admin',
  'sao-adviser',
  'adviser',
  'null',
  'undefined',
  'anonymous',
  'user',
  'my organization',
]);

/**
 * Hook to resolve any User UID, Student ID, or Officer Email to their real human full name.
 * If the creator is an ID or generic placeholder that cannot be matched to a real human, returns null (to leave blank).
 */
export function useUserNameResolver() {
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const localMap = new Map<string, string>();

    const updateMap = () => {
      setNameMap(new Map(localMap));
    };

    // 1. Listen to students
    try {
      const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
        snap.docs.forEach((d) => {
          const data = d.data();
          const fullName = data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim();
          if (fullName) {
            if (d.id) localMap.set(d.id.trim().toLowerCase(), fullName);
            if (data.studentId) localMap.set(String(data.studentId).trim().toLowerCase(), fullName);
            if (data.authUid) localMap.set(String(data.authUid).trim().toLowerCase(), fullName);
            if (data.email) localMap.set(String(data.email).trim().toLowerCase(), fullName);
          }
        });
        updateMap();
      });
      unsubs.push(unsubStudents);
    } catch (e) {
      console.warn('[useUserNameResolver] Error listening to students:', e);
    }

    // 2. Listen to organization_officers
    try {
      const unsubOfficers = onSnapshot(collection(db, 'organization_officers'), (snap) => {
        snap.docs.forEach((d) => {
          const data = d.data();
          const officerName = data.studentName || data.name || data.fullName;
          if (officerName) {
            if (d.id) localMap.set(d.id.trim().toLowerCase(), officerName);
            if (data.studentId) localMap.set(String(data.studentId).trim().toLowerCase(), officerName);
            if (data.email) localMap.set(String(data.email).trim().toLowerCase(), officerName);
          }
        });
        updateMap();
      });
      unsubs.push(unsubOfficers);
    } catch (e) {
      console.warn('[useUserNameResolver] Error listening to officers:', e);
    }

    // 3. Listen to organization_advisers
    try {
      const unsubAdvisers = onSnapshot(collection(db, 'organization_advisers'), (snap) => {
        snap.docs.forEach((d) => {
          const data = d.data();
          const adviserName = data.name || data.fullName || data.adviserName;
          if (adviserName) {
            if (d.id) localMap.set(d.id.trim().toLowerCase(), adviserName);
            if (data.authUid) localMap.set(String(data.authUid).trim().toLowerCase(), adviserName);
            if (data.email) localMap.set(String(data.email).trim().toLowerCase(), adviserName);
          }
        });
        updateMap();
      });
      unsubs.push(unsubAdvisers);
    } catch (e) {
      console.warn('[useUserNameResolver] Error listening to advisers:', e);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  const resolveUserName = useCallback((rawString: string | null | undefined): string | null => {
    if (!rawString) return null;
    const clean = rawString.trim();
    if (!clean) return null;

    const lower = clean.toLowerCase();

    // If it's a generic placeholder, ignore and leave blank
    if (PLACEHOLDER_BLACKLIST.has(lower)) {
      return null;
    }

    // Check if it matches an entry in our database
    const matched = nameMap.get(lower);
    if (matched && !PLACEHOLDER_BLACKLIST.has(matched.toLowerCase())) {
      return matched;
    }

    // Check if clean is a UID / batch ID / numeric ID
    const isNumericOrId = /^\d+$/.test(clean) || clean.startsWith('TRANS-') || (clean.length >= 20 && !clean.includes(' '));
    if (isNumericOrId) {
      // Unresolved ID -> leave blank
      return null;
    }

    // Check if clean is an email address
    if (clean.includes('@')) {
      return null;
    }

    // If it is a multi-word person name (e.g. "Juan Dela Cruz")
    const words = clean.split(/\s+/);
    if (words.length >= 2 && !PLACEHOLDER_BLACKLIST.has(lower)) {
      return clean;
    }

    return null;
  }, [nameMap]);

  return { resolveUserName, nameMap };
}
