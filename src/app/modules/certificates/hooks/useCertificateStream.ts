import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { CertificateItem, CertificateTemplate, IssuedCertificateRecord } from '../types/certificate.types';
import { TEMPLATES_COLLECTION, CERTIFICATES_COLLECTION, ISSUED_COLLECTION } from '../services/certificate.service';

export function useCertificatesStream(organizationId?: string, isAdmin?: boolean) {
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let certsList: CertificateItem[] = [];
    let templatesList: CertificateItem[] = [];
    let certsLoaded = false;
    let templatesLoaded = false;

    const updateCombined = () => {
      // Merge by document ID (certificates collection takes precedence)
      const map = new Map<string, CertificateItem>();
      templatesList.forEach(t => map.set(t.id, t));
      certsList.forEach(c => map.set(c.id, c));

      const all = Array.from(map.values());

      let filtered: CertificateItem[] = [];
      if (isAdmin) {
        filtered = all.filter(c => c.organizationId === 'admin' || !c.organizationId);
      } else if (organizationId) {
        filtered = all.filter(c => c.organizationId === organizationId);
      } else {
        filtered = [];
      }

      setCertificates(filtered);
      if (certsLoaded && templatesLoaded) {
        setLoading(false);
      }
    };

    // 1. Listen to `certificates` collection in Firestore
    const qCerts = query(collection(db, CERTIFICATES_COLLECTION));
    const unsubCerts = onSnapshot(
      qCerts,
      (snapshot) => {
        certsList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || data.name || 'Untitled Certificate',
            name: data.name || data.title || 'Untitled Certificate',
            category: data.category || 'Participation',
            status: data.status || (data.isDefault ? 'Published' : 'Approved'),
            organizationId: data.organizationId || 'admin',
            organizationName: data.organizationName || (data.organizationId === 'admin' || !data.organizationId ? 'SAO Admin' : data.organizationId),
            eventId: data.eventId,
            eventName: data.eventName,
            imageUrl: data.imageUrl || '',
            designPreset: data.designPreset || 'classic_gold',
            isDefault: !!data.isDefault,
            paperSize: data.paperSize || 'a4',
            orientation: data.orientation || 'landscape',
            elements: data.elements || [],
            namePosition: data.namePosition || {
              xPercent: 50,
              yPercent: 45,
              widthPercent: 60,
              fontSizePt: 32,
              fontFamily: 'Great Vibes',
              fontWeight: 'Regular',
              textColor: '#001A4D',
              textAlign: 'center',
            },
            signatoryName: data.signatoryName || '',
            signatoryTitle: data.signatoryTitle || '',
            secondarySignatoryName: data.secondarySignatoryName,
            secondarySignatoryTitle: data.secondarySignatoryTitle,
            issuedCount: data.issuedCount || 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy,
            createdByName: data.createdByName,
            rejectionReason: data.rejectionReason,
            approvalNotes: data.approvalNotes,
          } as CertificateItem;
        });
        certsLoaded = true;
        updateCombined();
      },
      (err) => {
        console.error('Error fetching certificates collection from Firestore:', err);
        certsLoaded = true;
        updateCombined();
      }
    );

    // 2. Listen to `certificate_templates` collection in Firestore
    const qTemplates = query(collection(db, TEMPLATES_COLLECTION));
    const unsubTemplates = onSnapshot(
      qTemplates,
      (snapshot) => {
        templatesList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.name || data.title || 'Certificate Template',
            name: data.name || data.title || 'Certificate Template',
            category: data.category || 'Participation',
            status: data.status || 'Published',
            organizationId: data.organizationId || 'admin',
            organizationName: data.organizationName || (data.organizationId === 'admin' || !data.organizationId ? 'SAO Admin' : 'Student Organization'),
            eventId: data.eventId,
            eventName: data.eventName,
            imageUrl: data.imageUrl || '',
            designPreset: data.designPreset || 'classic_gold',
            isDefault: !!data.isDefault,
            paperSize: data.paperSize || 'a4',
            orientation: data.orientation || 'landscape',
            elements: data.elements || [],
            namePosition: data.namePosition || {
              xPercent: 50,
              yPercent: 45,
              widthPercent: 60,
              fontSizePt: 32,
              fontFamily: 'Great Vibes',
              fontWeight: 'Regular',
              textColor: '#001A4D',
              textAlign: 'center',
            },
            signatoryName: data.signatoryName || '',
            signatoryTitle: data.signatoryTitle || '',
            secondarySignatoryName: data.secondarySignatoryName,
            secondarySignatoryTitle: data.secondarySignatoryTitle,
            issuedCount: data.issuedCount || 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy,
          } as CertificateItem;
        });
        templatesLoaded = true;
        updateCombined();
      },
      (err) => {
        console.error('Error fetching certificate_templates from Firestore:', err);
        templatesLoaded = true;
        updateCombined();
      }
    );

    return () => {
      unsubCerts();
      unsubTemplates();
    };
  }, [organizationId, isAdmin]);

  return { certificates, loading };
}

// Alias hook for backward compatibility
export function useCertificateTemplatesStream(organizationId?: string, isAdmin?: boolean) {
  const { certificates, loading } = useCertificatesStream(organizationId, isAdmin);
  const templates: CertificateTemplate[] = (certificates || []).map(c => ({
    ...c,
    name: c.title || c.name || 'Certificate',
    imageUrl: c.imageUrl || '',
    createdBy: c.createdBy || 'system',
    isDefault: !!c.isDefault,
  }));
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
