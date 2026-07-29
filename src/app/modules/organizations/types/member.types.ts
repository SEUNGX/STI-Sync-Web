import { Timestamp } from 'firebase/firestore';

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
  status: 'active' | 'inactive' | 'suspended';
  paymentStatus: 'paid' | 'outstanding';
  dateJoined: any;
  isOfficer: boolean;
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
  status: 'active' | 'inactive' | 'suspended';
  paymentStatus: 'paid' | 'outstanding';
}
