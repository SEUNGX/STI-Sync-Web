import { Timestamp } from 'firebase/firestore';

export type OrganizationMemberStatus = 'active' | 'inactive' | 'suspended' | 'pending' | 'rejected';

export interface OrganizationMemberDocument {
  id: string;
  organizationId: string;
  studentId: string;
  studentName: string;
  email: string;
  course: string;
  year: string;
  department: string;
  contactNumber: string;
  status: OrganizationMemberStatus;
  paymentStatus: 'paid' | 'outstanding';
  dateJoined: any;
  isOfficer: boolean;
  rejectionReason?: string;
  applicationDate?: any;
  createdAt: any;
  updatedAt: any;
  addedBy: string;
}

export interface AddMemberPayload {
  organizationId: string;
  studentId: string;
  studentName: string;
  email: string;
  course: string;
  year: string;
  department: string;
  contactNumber: string;
  status: OrganizationMemberStatus;
  paymentStatus: 'paid' | 'outstanding';
}
