import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { CertificateTemplate, IssuedCertificateRecord } from '../types/certificate.types';
import { TEMPLATES_COLLECTION, ISSUED_COLLECTION } from '../services/certificate.service';

export function useCertificateTemplatesStream(organizationId?: string, isAdmin?: boolean) {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, TEMPLATES_COLLECTION));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map(
          doc => ({ id: doc.id, ...doc.data() } as CertificateTemplate)
        );

        let filtered = fetched;
        if (isAdmin) {
          // Admin only sees admin templates (where organizationId is 'admin' or not set)
          filtered = fetched.filter(t => !t.organizationId || t.organizationId === 'admin');
        } else if (organizationId) {
          // Officers only see templates for their specific organization
          filtered = fetched.filter(t => t.organizationId === organizationId);
        }

        setTemplates(filtered);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching certificate templates:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [organizationId, isAdmin]);

  return { templates, loading };
}

export function useIssuedCertificatesStream() {
  const [issuedRecords, setIssuedRecords] = useState<IssuedCertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, ISSUED_COLLECTION));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map(
          doc => ({ id: doc.id, ...doc.data() } as IssuedCertificateRecord)
        );
        setIssuedRecords(fetched);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching issued certificates:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { issuedRecords, loading };
}
