import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { CertificateTemplate, IssuedCertificateRecord } from '../types/certificate.types';
import { TEMPLATES_COLLECTION, ISSUED_COLLECTION } from '../services/certificate.service';

export function useCertificateTemplatesStream() {
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
        setTemplates(fetched);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching certificate templates:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

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
