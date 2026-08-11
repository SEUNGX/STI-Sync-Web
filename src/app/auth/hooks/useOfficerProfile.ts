import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

export interface OfficerRole {
  id: string; // Document ID
  organizationId: string;
  roleId: string;
  isActive: boolean;
}

export interface OfficerProfile {
  studentId: string;
  studentName: string;
  email: string;
  activeOrganizationId: string | null;
  activeRoleId: string | null;
}

const SESSION_KEY = 'sti_sync_officer_session';

export function useOfficerProfile() {
  const [profile, setProfile] = useState<OfficerProfile | null>(null);
  const [roles, setRoles] = useState<OfficerRole[]>([]);
  const [activeOrgStatus, setActiveOrgStatus] = useState<string>('active');
  const [activeOrgName, setActiveOrgName] = useState<string>('Organization');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rawSession = localStorage.getItem(SESSION_KEY);
    if (!rawSession) {
      setProfile(null);
      setRoles([]);
      setLoading(false);
      return;
    }

    let parsedSession: any;
    try {
      parsedSession = JSON.parse(rawSession);
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
      setProfile(null);
      setLoading(false);
      return;
    }

    const { studentId, studentName, email, activeOrganizationId, activeRoleId } = parsedSession;
    setProfile({ studentId, studentName, email, activeOrganizationId, activeRoleId });

    // Listen for their roles to ensure they are still active and to get their list of orgs
    const q = query(
      collection(db, 'organization_officers'),
      where('studentId', '==', studentId),
      where('isActive', '==', true)
    );

    const unsubscribeRoles = onSnapshot(q, (snapshot) => {
      const activeRoles = snapshot.docs.map(doc => ({
        id: doc.id,
        organizationId: doc.data().organizationId,
        roleId: doc.data().roleId,
        isActive: doc.data().isActive
      }));
      
      setRoles(activeRoles);
      
      // Auto-select if there is exactly 1 role and none is currently selected
      if (activeRoles.length === 1 && !activeOrganizationId) {
        setProfile(prev => {
          if (!prev) return prev;
          const newProfile = { ...prev, activeOrganizationId: activeRoles[0].organizationId, activeRoleId: activeRoles[0].roleId };
          localStorage.setItem(SESSION_KEY, JSON.stringify(newProfile));
          return newProfile;
        });
      }
      
      setLoading(false);
    });

    return () => unsubscribeRoles();
  }, []);

  // Listen to active organization status in real-time
  useEffect(() => {
    const activeOrgId = profile?.activeOrganizationId;
    if (!activeOrgId) {
      setActiveOrgStatus('active');
      return;
    }

    const unsubOrg = onSnapshot(
      doc(db, 'organizations', activeOrgId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setActiveOrgStatus(data.status || 'active');
          setActiveOrgName(data.name || 'Organization');
        } else {
          setActiveOrgStatus('archived');
        }
      },
      (err) => {
        console.warn('[useOfficerProfile] Error streaming org status:', err);
      }
    );

    return () => unsubOrg();
  }, [profile?.activeOrganizationId]);

  const switchOrganization = (organizationId: string, roleId: string) => {
    if (!profile) return;
    const newProfile = { ...profile, activeOrganizationId: organizationId, activeRoleId: roleId };
    setProfile(newProfile);
    localStorage.setItem(SESSION_KEY, JSON.stringify(newProfile));
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setProfile(null);
    setRoles([]);
  };

  return { profile, roles, activeOrgStatus, activeOrgName, loading, switchOrganization, logout };
}

