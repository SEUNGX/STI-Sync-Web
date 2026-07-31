import { Timestamp } from 'firebase/firestore';

export interface OrganizationTypeDocument {
  id: string;
  name: string;
  color: string;
  archived: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrganizationDocument {
  id: string;
  name: string;
  acronym: string;
  typeId: string;                              // FK → /organization_types
  departmentId: string | 'cross-departmental'; // FK → /departments or sentinel
  description: string;

  // ─── Academic Context ───
  academicYear: string;                        // e.g. "2025-2026"
  semester: string;                            // e.g. "1st Semester"

  // ─── Metadata ───
  status: 'active' | 'inactive' | 'suspended';
  memberCount: number;
  logoUrl: string | null;
  membershipFee?: number;

  // ─── Timestamps ───
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface CreateOrganizationPayload {
  name: string;
  acronym: string;
  typeId: string;
  departmentId: string | 'cross-departmental';
  description: string;
  academicYear: string;
  semester: string;
  logoUrl: string | null;
  membershipFee?: number;
}

export interface OrganizationRulesDocument {
  minMembersRequired: number;
  minOfficersRequired: number;

  updatedAt: Timestamp;
}

