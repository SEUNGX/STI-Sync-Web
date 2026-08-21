import { AcademicLevel, StudentSemester } from '../../students/types/student.types';

export type ReportScope = 'ALL' | 'COLLEGE' | 'SHS';

export type AdminReportId =
  | 'STUDENT_ENROLLMENT_DEMOGRAPHICS'
  | 'EVENT_ACCOMPLISHMENT_ATTENDANCE'
  | 'FINANCIAL_LIQUIDATION_BUDGET'
  | 'ORGANIZATION_ACCREDITATION_ROSTER'
  | 'STUDENT_PAYABLES_COLLECTION'
  | 'CERTIFICATE_ISSUANCE_SUMMARY'
  | 'SYSTEM_AUDIT_TRAIL';

export type OfficerReportId =
  | 'OFFICER_SEMESTRAL_ACCOMPLISHMENT'
  | 'OFFICER_FINANCIAL_STATEMENT'
  | 'OFFICER_EVENT_ATTENDANCE_ROSTER'
  | 'OFFICER_MEMBERSHIP_DIRECTORY'
  | 'OFFICER_DUES_PAYABLES_TRACKING';

export interface ReportFilterOptions {
  scope: ReportScope;
  academicYear?: string;
  semester?: string;
  startDate?: string;
  endDate?: string;
  organizationId?: string;
  departmentId?: string;
  courseId?: string;
  yearLevel?: string;
}

export interface ReportMetadata {
  title: string;
  subtitle: string;
  academicYear?: string;
  semester?: string;
  scope: ReportScope;
  generatedAt: string;
  generatedBy: string;
  organizationName?: string;
  adviserName?: string;
  presidentName?: string;
  treasurerName?: string;
}

export interface ReportKPI {
  label: string;
  value: string | number;
  subtext?: string;
  highlight?: boolean;
}

export interface ReportTableColumn {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface GeneratedReportData {
  id: AdminReportId | OfficerReportId;
  title: string;
  category: 'INSTITUTIONAL' | 'ORGANIZATION';
  metadata: ReportMetadata;
  kpis: ReportKPI[];
  columns: ReportTableColumn[];
  rows: Record<string, string | number>[];
  summaryNotes?: string[];
  signatories?: {
    preparedBy?: { name: string; title: string };
    attestedBy?: { name: string; title: string };
    approvedBy?: { name: string; title: string };
  };
}
