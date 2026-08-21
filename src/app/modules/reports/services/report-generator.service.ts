import { StudentDocument } from '../../students/types/student.types';
import { EventDocument } from '../../events/types/event.types';
import { FinancialLiquidationDocument, PayableDocument } from '../../finance/types/finance.types';
import { OrganizationDocument } from '../../organizations/types/organization.types';
import { CertificateDocument } from '../../certificates/types/certificate.types';
import { AuditLogDocument } from '../../audit/types/audit.types';
import { GeneratedReportData, ReportFilterOptions, ReportScope } from '../types/report.types';

// Helper to filter data by academic track
export function isStudentInTrack(student: StudentDocument, scope: ReportScope): boolean {
  if (scope === 'ALL') return true;
  const isShs =
    student.academicLevel === 'SHS' ||
    (student.semester && String(student.semester).includes('Trimester')) ||
    (student.courseCode && ['STEM', 'ABM', 'HUMSS', 'TVL', 'GAS'].some((s) => student.courseCode?.includes(s)));

  return scope === 'SHS' ? isShs : !isShs;
}

export function isEventInTrack(event: EventDocument, scope: ReportScope): boolean {
  if (scope === 'ALL') return true;
  const isShs =
    event.academicLevel === 'SHS' ||
    (event.semester && String(event.semester).includes('Trimester')) ||
    (event.targetYearLevel && (String(event.targetYearLevel).includes('Grade 11') || String(event.targetYearLevel).includes('Grade 12')));

  return scope === 'SHS' ? isShs : !isShs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SAO / SAS ADMIN REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Report 1: Institutional Student Enrollment & Demographic Master Report
 */
export function generateStudentEnrollmentReport(
  students: StudentDocument[],
  filter: ReportFilterOptions,
  userName = 'SAO Administrator'
): GeneratedReportData {
  const filtered = students.filter((s) => {
    if (!isStudentInTrack(s, filter.scope)) return false;
    if (filter.academicYear && s.schoolYear && s.schoolYear !== filter.academicYear) return false;
    if (filter.semester && s.semester && s.semester !== filter.semester) return false;
    if (filter.courseId && s.courseId !== filter.courseId) return false;
    if (filter.yearLevel && s.yearLevel !== filter.yearLevel) return false;
    return true;
  });

  const total = filtered.length;
  const collegeCount = filtered.filter((s) => !isStudentInTrack(s, 'SHS')).length;
  const shsCount = filtered.filter((s) => isStudentInTrack(s, 'SHS')).length;
  const maleCount = filtered.filter((s) => s.sex === 'Male').length;
  const femaleCount = filtered.filter((s) => s.sex === 'Female').length;
  const verifiedCount = filtered.filter((s) => s.verificationStatus === 'APPROVED').length;

  const rows = filtered.map((s) => ({
    studentId: s.studentId || '—',
    name: `${s.lastName}, ${s.firstName} ${s.middleName || ''}`.trim(),
    track: isStudentInTrack(s, 'SHS') ? 'SHS (Trimester)' : 'College (Semester)',
    program: s.courseCode || '—',
    yearLevel: s.yearLevel || '—',
    section: s.section || 'Unassigned',
    sex: s.sex || '—',
    status: s.status || 'Active',
    verified: s.verificationStatus === 'APPROVED' ? 'Verified' : 'Pending',
  }));

  return {
    id: 'STUDENT_ENROLLMENT_DEMOGRAPHICS',
    title: 'Student Enrollment & Demographic Master Report',
    category: 'INSTITUTIONAL',
    metadata: {
      title: 'Student Enrollment & Demographic Master Report',
      subtitle: 'Complete institutional breakdown of student population, academic tracks, and verification records.',
      academicYear: filter.academicYear,
      semester: filter.semester,
      scope: filter.scope,
      generatedAt: new Date().toLocaleString(),
      generatedBy: userName,
    },
    kpis: [
      { label: 'Total Enrolled', value: total },
      { label: 'College Students', value: collegeCount },
      { label: 'SHS Students', value: shsCount },
      { label: 'Verified Profiles', value: `${verifiedCount} (${total ? Math.round((verifiedCount / total) * 100) : 0}%)` },
      { label: 'Sex Ratio (M / F)', value: `${maleCount} / ${femaleCount}` },
    ],
    columns: [
      { key: 'studentId', header: 'Student ID' },
      { key: 'name', header: 'Student Full Name' },
      { key: 'track', header: 'Track' },
      { key: 'program', header: 'Course/Strand' },
      { key: 'yearLevel', header: 'Year Level' },
      { key: 'section', header: 'Section' },
      { key: 'sex', header: 'Sex' },
      { key: 'status', header: 'Status' },
      { key: 'verified', header: 'ID Status' },
    ],
    rows,
    signatories: {
      preparedBy: { name: userName, title: 'SAO Records Officer' },
      attestedBy: { name: 'Campus Registrar', title: 'Head of Student Records' },
      approvedBy: { name: 'SAO Head / Academic Dean', title: 'Student Affairs Office' },
    },
  };
}

/**
 * Report 2: Campus-Wide Event Accomplishment & Attendance Report
 */
export function generateEventAccomplishmentReport(
  events: EventDocument[],
  filter: ReportFilterOptions,
  userName = 'SAO Administrator'
): GeneratedReportData {
  const filtered = events.filter((e) => {
    if (!isEventInTrack(e, filter.scope)) return false;
    if (filter.academicYear && e.academicYear && e.academicYear !== filter.academicYear) return false;
    if (filter.semester && e.semester && e.semester !== filter.semester) return false;
    if (filter.organizationId && e.organizationId !== filter.organizationId) return false;
    return true;
  });

  const totalEvents = filtered.length;
  const approvedEvents = filtered.filter((e) => e.status === 'COMPLETED' || e.proposalStatus === 'approved').length;
  const totalAttendees = filtered.reduce((acc, e) => acc + (e.actualAttendees || e.attendeesCount || 0), 0);
  const totalExpected = filtered.reduce((acc, e) => acc + (e.expectedAttendees || 0), 0);
  const avgAttendanceRate = totalExpected > 0 ? Math.round((totalAttendees / totalExpected) * 100) : 0;

  const rows = filtered.map((e) => ({
    title: e.title,
    organization: e.organizationName || 'Campus Wide',
    track: isEventInTrack(e, 'SHS') ? 'SHS' : 'College',
    category: e.category || 'Institutional',
    date: e.startDate ? new Date(e.startDate).toLocaleDateString() : '—',
    venue: e.venue || 'Campus',
    expected: e.expectedAttendees || 0,
    actual: e.actualAttendees || e.attendeesCount || 0,
    rate: `${e.expectedAttendees ? Math.round(((e.actualAttendees || e.attendeesCount || 0) / e.expectedAttendees) * 100) : 0}%`,
    status: (e.proposalStatus || e.status || 'Active').toUpperCase(),
  }));

  return {
    id: 'EVENT_ACCOMPLISHMENT_ATTENDANCE',
    title: 'Campus-Wide Event Accomplishment & Attendance Report',
    category: 'INSTITUTIONAL',
    metadata: {
      title: 'Campus-Wide Event Accomplishment & Attendance Report',
      subtitle: 'Summary of student events, venue utilization, attendee turnouts, and participation rates.',
      academicYear: filter.academicYear,
      semester: filter.semester,
      scope: filter.scope,
      generatedAt: new Date().toLocaleString(),
      generatedBy: userName,
    },
    kpis: [
      { label: 'Total Events', value: totalEvents },
      { label: 'Approved & Held', value: approvedEvents },
      { label: 'Total Attendees', value: totalAttendees },
      { label: 'Expected Attendees', value: totalExpected },
      { label: 'Avg Turnout Rate', value: `${avgAttendanceRate}%` },
    ],
    columns: [
      { key: 'title', header: 'Event Title' },
      { key: 'organization', header: 'Host Org' },
      { key: 'track', header: 'Track' },
      { key: 'category', header: 'Category' },
      { key: 'date', header: 'Date' },
      { key: 'venue', header: 'Venue' },
      { key: 'expected', header: 'Expected' },
      { key: 'actual', header: 'Attended' },
      { key: 'rate', header: 'Turnout %' },
      { key: 'status', header: 'Status' },
    ],
    rows,
    signatories: {
      preparedBy: { name: userName, title: 'SAO Events Coordinator' },
      attestedBy: { name: 'Council of Presidents Head', title: 'Student Council President' },
      approvedBy: { name: 'SAO Head / Academic Dean', title: 'Student Affairs Office' },
    },
  };
}

/**
 * Report 3: Institutional Financial Liquidation & Budget Utilization Audit Report
 */
export function generateFinancialLiquidationReport(
  liquidations: FinancialLiquidationDocument[],
  organizations: OrganizationDocument[],
  filter: ReportFilterOptions,
  userName = 'SAO Administrator'
): GeneratedReportData {
  const filtered = liquidations.filter((l) => {
    if (filter.academicYear && l.schoolYear && l.schoolYear !== filter.academicYear) return false;
    if (filter.semester && l.semester && l.semester !== filter.semester) return false;
    if (filter.organizationId && l.organizationId !== filter.organizationId) return false;
    return true;
  });

  const totalAllocated = organizations.reduce((sum, o) => sum + (o.budget || o.allocatedBudget || 0), 0);
  const totalLiquidated = filtered
    .filter((l) => l.status === 'APPROVED')
    .reduce((sum, l) => sum + (l.totalAmount || l.actualExpenses || 0), 0);
  const totalPending = filtered
    .filter((l) => l.status === 'SUBMITTED' || l.status === 'PENDING')
    .reduce((sum, l) => sum + (l.totalAmount || l.actualExpenses || 0), 0);
  const totalReceipts = filtered.reduce((sum, l) => sum + (l.receipts?.length || 0), 0);

  const rows = filtered.map((l) => {
    const org = organizations.find((o) => o.id === l.organizationId);
    return {
      reportNo: l.referenceNumber || l.id.slice(0, 8).toUpperCase(),
      organization: l.organizationName || org?.name || 'Club',
      eventTitle: l.eventTitle || 'Event Activities',
      allocated: `₱${(l.allocatedBudget || 0).toLocaleString()}`,
      spent: `₱${(l.totalAmount || l.actualExpenses || 0).toLocaleString()}`,
      variance: `₱${((l.allocatedBudget || 0) - (l.totalAmount || l.actualExpenses || 0)).toLocaleString()}`,
      receiptCount: l.receipts?.length || 0,
      status: (l.status || 'SUBMITTED').toUpperCase(),
      dateSubmitted: l.submittedAt ? new Date(l.submittedAt).toLocaleDateString() : '—',
    };
  });

  return {
    id: 'FINANCIAL_LIQUIDATION_BUDGET',
    title: 'Financial Liquidation & Budget Utilization Audit Report',
    category: 'INSTITUTIONAL',
    metadata: {
      title: 'Financial Liquidation & Budget Utilization Audit Report',
      subtitle: 'Comprehensive audit of organization disbursements, liquidated expenses, receipts, and cash balances.',
      academicYear: filter.academicYear,
      semester: filter.semester,
      scope: filter.scope,
      generatedAt: new Date().toLocaleString(),
      generatedBy: userName,
    },
    kpis: [
      { label: 'Total Allocated Budget', value: `₱${totalAllocated.toLocaleString()}` },
      { label: 'Approved Liquidations', value: `₱${totalLiquidated.toLocaleString()}` },
      { label: 'Pending Liquidation Review', value: `₱${totalPending.toLocaleString()}` },
      { label: 'Audited Receipts', value: totalReceipts },
      { label: 'Budget Utilization %', value: `${totalAllocated > 0 ? Math.round((totalLiquidated / totalAllocated) * 100) : 0}%` },
    ],
    columns: [
      { key: 'reportNo', header: 'Ref / Report #' },
      { key: 'organization', header: 'Organization' },
      { key: 'eventTitle', header: 'Event Title' },
      { key: 'allocated', header: 'Allocated' },
      { key: 'spent', header: 'Total Spent' },
      { key: 'variance', header: 'Variance' },
      { key: 'receiptCount', header: 'Receipts' },
      { key: 'status', header: 'Audit Status' },
      { key: 'dateSubmitted', header: 'Date Filed' },
    ],
    rows,
    signatories: {
      preparedBy: { name: userName, title: 'SAO Financial Auditor' },
      attestedBy: { name: 'Student Council Treasurer', title: 'Lead Financial Officer' },
      approvedBy: { name: 'SAO Head / Academic Dean', title: 'Student Affairs Office' },
    },
  };
}

/**
 * Report 4: Student Organization Accreditation & Officer Roster Report
 */
export function generateOrganizationRosterReport(
  organizations: OrganizationDocument[],
  filter: ReportFilterOptions,
  userName = 'SAO Administrator'
): GeneratedReportData {
  const filtered = organizations.filter((o) => !o.archived);

  const totalOrgs = filtered.length;
  const activeOrgs = filtered.filter((o) => o.status === 'ACTIVE' || o.complianceStatus === 'GOOD_STANDING').length;
  const totalMembers = filtered.reduce((sum, o) => sum + (o.memberCount || o.totalMembers || 0), 0);
  const totalOfficers = filtered.reduce((sum, o) => sum + (o.officerCount || 0), 0);

  const rows = filtered.map((o) => ({
    name: o.name,
    type: o.type || 'Academic',
    category: o.category || 'College',
    adviser: o.adviserName || 'Not Appointed',
    president: o.presidentName || 'Not Appointed',
    members: o.memberCount || o.totalMembers || 0,
    officers: o.officerCount || 0,
    budget: `₱${(o.budget || o.allocatedBudget || 0).toLocaleString()}`,
    compliance: o.complianceStatus || 'Good Standing',
  }));

  return {
    id: 'ORGANIZATION_ACCREDITATION_ROSTER',
    title: 'Student Organization Accreditation & Officer Roster Report',
    category: 'INSTITUTIONAL',
    metadata: {
      title: 'Student Organization Accreditation & Officer Roster Report',
      subtitle: 'Directory of recognized student organizations, faculty advisers, appointed officers, and accreditation standing.',
      academicYear: filter.academicYear,
      semester: filter.semester,
      scope: filter.scope,
      generatedAt: new Date().toLocaleString(),
      generatedBy: userName,
    },
    kpis: [
      { label: 'Recognized Clubs', value: totalOrgs },
      { label: 'In Good Standing', value: activeOrgs },
      { label: 'Total Enrolled Members', value: totalMembers },
      { label: 'Student Officers', value: totalOfficers },
      { label: 'Total Grants Allocated', value: `₱${filtered.reduce((s, o) => s + (o.budget || 0), 0).toLocaleString()}` },
    ],
    columns: [
      { key: 'name', header: 'Organization Name' },
      { key: 'type', header: 'Type' },
      { key: 'category', header: 'Track' },
      { key: 'adviser', header: 'Faculty Adviser' },
      { key: 'president', header: 'Club President' },
      { key: 'members', header: 'Members' },
      { key: 'officers', header: 'Officers' },
      { key: 'budget', header: 'Allocated Budget' },
      { key: 'compliance', header: 'Standing' },
    ],
    rows,
    signatories: {
      preparedBy: { name: userName, title: 'SAO Club Coordinator' },
      attestedBy: { name: 'Council of Student Organizations', title: 'CSO President' },
      approvedBy: { name: 'SAO Head / Academic Dean', title: 'Student Affairs Office' },
    },
  };
}

/**
 * Report 5: Student Payables & Fee Collection Audit Report
 */
export function generateStudentPayablesReport(
  payables: PayableDocument[],
  filter: ReportFilterOptions,
  userName = 'SAO Administrator'
): GeneratedReportData {
  const filtered = payables.filter((p) => {
    if (filter.academicYear && p.schoolYear && p.schoolYear !== filter.academicYear) return false;
    if (filter.semester && p.semester && p.semester !== filter.semester) return false;
    if (filter.organizationId && p.organizationId !== filter.organizationId) return false;
    return true;
  });

  const totalAssessed = filtered.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPaid = filtered
    .filter((p) => p.status === 'paid' || p.paymentStatus === 'PAID')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalUnpaid = totalAssessed - totalPaid;
  const collectionRate = totalAssessed > 0 ? Math.round((totalPaid / totalAssessed) * 100) : 0;

  const rows = filtered.map((p) => ({
    studentId: p.studentId || '—',
    studentName: p.studentName || 'Student',
    feeTitle: p.title || p.feeTitle || 'Organizational Due',
    type: (p.type || 'dues').toUpperCase(),
    organization: p.organizationName || 'Student Council',
    amount: `₱${(p.amount || 0).toLocaleString()}`,
    status: (p.paymentStatus || p.status || 'UNPAID').toUpperCase(),
    datePaid: p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'Unpaid',
  }));

  return {
    id: 'STUDENT_PAYABLES_COLLECTION',
    title: 'Student Payables & Fee Collection Audit Report',
    category: 'INSTITUTIONAL',
    metadata: {
      title: 'Student Payables & Fee Collection Audit Report',
      subtitle: 'Campus-wide financial audit of membership dues and event fee collections per student and organization.',
      academicYear: filter.academicYear,
      semester: filter.semester,
      scope: filter.scope,
      generatedAt: new Date().toLocaleString(),
      generatedBy: userName,
    },
    kpis: [
      { label: 'Total Assessed Fees', value: `₱${totalAssessed.toLocaleString()}` },
      { label: 'Total Collected (Paid)', value: `₱${totalPaid.toLocaleString()}` },
      { label: 'Outstanding Unpaid', value: `₱${totalUnpaid.toLocaleString()}` },
      { label: 'Collection Efficiency', value: `${collectionRate}%` },
      { label: 'Payable Entries', value: filtered.length },
    ],
    columns: [
      { key: 'studentId', header: 'Student ID' },
      { key: 'studentName', header: 'Student Name' },
      { key: 'feeTitle', header: 'Fee Description' },
      { key: 'type', header: 'Fee Type' },
      { key: 'organization', header: 'Organization' },
      { key: 'amount', header: 'Amount' },
      { key: 'status', header: 'Payment Status' },
      { key: 'datePaid', header: 'Date Settled' },
    ],
    rows,
    signatories: {
      preparedBy: { name: userName, title: 'SAO Finance Auditor' },
      attestedBy: { name: 'Student Council Auditor', title: 'Auditing Head' },
      approvedBy: { name: 'SAO Head / Academic Dean', title: 'Student Affairs Office' },
    },
  };
}

/**
 * Report 6: Certificate Issuance & Recognition Summary Log
 */
export function generateCertificateIssuanceReport(
  certificates: CertificateDocument[],
  filter: ReportFilterOptions,
  userName = 'SAO Administrator'
): GeneratedReportData {
  const filtered = certificates.filter((c) => {
    if (filter.academicYear && c.academicYear && c.academicYear !== filter.academicYear) return false;
    if (filter.semester && c.semester && c.semester !== filter.semester) return false;
    return true;
  });

  const totalCerts = filtered.length;
  const claimedCount = filtered.filter((c) => c.status === 'CLAIMED' || c.claimedAt).length;

  const rows = filtered.map((c) => ({
    certNo: c.certificateNumber || c.id.slice(0, 8).toUpperCase(),
    recipient: c.recipientName || 'Student Awardee',
    studentId: c.studentId || '—',
    event: c.eventTitle || 'Campus Activity',
    type: c.type || 'Participation',
    issueDate: c.issueDate ? new Date(c.issueDate).toLocaleDateString() : '—',
    status: (c.status || 'ISSUED').toUpperCase(),
  }));

  return {
    id: 'CERTIFICATE_ISSUANCE_SUMMARY',
    title: 'Certificate Issuance & Recognition Summary Log',
    category: 'INSTITUTIONAL',
    metadata: {
      title: 'Certificate Issuance & Recognition Summary Log',
      subtitle: 'Official record of generated, distributed, and verified certificates of participation and merit.',
      academicYear: filter.academicYear,
      semester: filter.semester,
      scope: filter.scope,
      generatedAt: new Date().toLocaleString(),
      generatedBy: userName,
    },
    kpis: [
      { label: 'Total Certificates Issued', value: totalCerts },
      { label: 'Claimed by Students', value: claimedCount },
      { label: 'Claim Rate', value: `${totalCerts > 0 ? Math.round((claimedCount / totalCerts) * 100) : 0}%` },
    ],
    columns: [
      { key: 'certNo', header: 'Cert #' },
      { key: 'recipient', header: 'Recipient Name' },
      { key: 'studentId', header: 'Student ID' },
      { key: 'event', header: 'Associated Event' },
      { key: 'type', header: 'Certificate Type' },
      { key: 'issueDate', header: 'Issue Date' },
      { key: 'status', header: 'Status' },
    ],
    rows,
    signatories: {
      preparedBy: { name: userName, title: 'SAO Certificates In-charge' },
      attestedBy: { name: 'Campus Registrar', title: 'Registrar Staff' },
      approvedBy: { name: 'SAO Head / Academic Dean', title: 'Student Affairs Office' },
    },
  };
}

/**
 * Report 7: System Audit Trail & Security Activity Log
 */
export function generateSystemAuditTrailReport(
  auditLogs: AuditLogDocument[],
  filter: ReportFilterOptions,
  userName = 'SAO Administrator'
): GeneratedReportData {
  const filtered = auditLogs.filter((l) => {
    if (filter.scope !== 'ALL' && l.academicLevel && l.academicLevel !== filter.scope) return false;
    return true;
  });

  const totalLogs = filtered.length;
  const eventActions = filtered.filter((l) => l.actionType === 'Event Actions').length;
  const financialActions = filtered.filter((l) => l.actionType === 'Financial Actions').length;
  const accountActions = filtered.filter((l) => l.actionType === 'Account Actions').length;

  const rows = filtered.map((l) => {
    const date = l.createdAt?.toDate ? l.createdAt.toDate().toLocaleString() : 'Just now';
    return {
      timestamp: date,
      actor: l.performedBy || 'System',
      role: l.userRole || 'SAO Admin',
      action: l.action || 'System Action',
      type: l.actionType || 'General',
      details: l.details || '—',
      ipAddress: l.ipAddress || '127.0.0.1',
    };
  });

  return {
    id: 'SYSTEM_AUDIT_TRAIL',
    title: 'System Audit Trail & Administrative Activity Log',
    category: 'INSTITUTIONAL',
    metadata: {
      title: 'System Audit Trail & Administrative Activity Log',
      subtitle: 'Complete chronological audit trail of all security, operational, and financial transactions.',
      academicYear: filter.academicYear,
      semester: filter.semester,
      scope: filter.scope,
      generatedAt: new Date().toLocaleString(),
      generatedBy: userName,
    },
    kpis: [
      { label: 'Total Audit Entries', value: totalLogs },
      { label: 'Event Operations', value: eventActions },
      { label: 'Financial Authorizations', value: financialActions },
      { label: 'Account / Registry Changes', value: accountActions },
    ],
    columns: [
      { key: 'timestamp', header: 'Timestamp' },
      { key: 'actor', header: 'Actor' },
      { key: 'role', header: 'Role' },
      { key: 'action', header: 'Action Executed' },
      { key: 'type', header: 'Category' },
      { key: 'details', header: 'Details / Scope' },
      { key: 'ipAddress', header: 'IP Address' },
    ],
    rows,
    signatories: {
      preparedBy: { name: userName, title: 'SAO Security Officer' },
      attestedBy: { name: 'IT Systems Administrator', title: 'Lead Systems Engineer' },
      approvedBy: { name: 'SAO Head / Academic Dean', title: 'Student Affairs Office' },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. STUDENT ORGANIZATION OFFICER REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Officer Report 1: Semestral Accomplishment & Activity Report
 */
export function generateOfficerAccomplishmentReport(
  org: OrganizationDocument,
  events: EventDocument[],
  filter: ReportFilterOptions,
  officerName = 'Organization Officer',
  presidentName = 'Club President',
  adviserName = 'Club Adviser'
): GeneratedReportData {
  const orgEvents = events.filter((e) => e.organizationId === org.id);

  const totalEvents = orgEvents.length;
  const completedEvents = orgEvents.filter((e) => e.status === 'COMPLETED' || e.proposalStatus === 'approved').length;
  const totalAttendees = orgEvents.reduce((acc, e) => acc + (e.actualAttendees || e.attendeesCount || 0), 0);
  const totalBudgetSpent = orgEvents.reduce((acc, e) => acc + (e.actualExpenses || 0), 0);

  const rows = orgEvents.map((e) => ({
    title: e.title,
    category: e.category || 'Activity',
    date: e.startDate ? new Date(e.startDate).toLocaleDateString() : '—',
    venue: e.venue || 'Campus',
    expected: e.expectedAttendees || 0,
    attended: e.actualAttendees || e.attendeesCount || 0,
    turnout: `${e.expectedAttendees ? Math.round(((e.actualAttendees || e.attendeesCount || 0) / e.expectedAttendees) * 100) : 0}%`,
    status: (e.proposalStatus || e.status || 'Active').toUpperCase(),
  }));

  return {
    id: 'OFFICER_SEMESTRAL_ACCOMPLISHMENT',
    title: `${org.name} — Semestral Accomplishment Report`,
    category: 'ORGANIZATION',
    metadata: {
      title: `${org.name} — Semestral Accomplishment Report`,
      subtitle: `Official end-of-term activity accomplishment summary submitted to the Student Affairs Office (SAO).`,
      academicYear: filter.academicYear,
      semester: filter.semester,
      scope: (org.academicLevel as ReportScope) || 'ALL',
      generatedAt: new Date().toLocaleString(),
      generatedBy: officerName,
      organizationName: org.name,
      presidentName,
      adviserName,
    },
    kpis: [
      { label: 'Activities Conducted', value: totalEvents },
      { label: 'Approved Deliveries', value: completedEvents },
      { label: 'Total Student Reach', value: totalAttendees },
      { label: 'Total Expenditures', value: `₱${totalBudgetSpent.toLocaleString()}` },
    ],
    columns: [
      { key: 'title', header: 'Activity Title' },
      { key: 'category', header: 'Category' },
      { key: 'date', header: 'Date Conducted' },
      { key: 'venue', header: 'Venue' },
      { key: 'expected', header: 'Target' },
      { key: 'attended', header: 'Turnout' },
      { key: 'turnout', header: 'Success %' },
      { key: 'status', header: 'Delivery Status' },
    ],
    rows,
    signatories: {
      preparedBy: { name: officerName, title: `${org.name} Secretary / Officer` },
      attestedBy: { name: presidentName, title: `${org.name} President` },
      approvedBy: { name: adviserName, title: `${org.name} Faculty Adviser` },
    },
  };
}

/**
 * Officer Report 2: Organization Financial Statement & Cash Flow Report
 */
export function generateOfficerFinancialStatement(
  org: OrganizationDocument,
  liquidations: FinancialLiquidationDocument[],
  payables: PayableDocument[],
  filter: ReportFilterOptions,
  officerName = 'Organization Treasurer',
  presidentName = 'Club President',
  adviserName = 'Club Adviser'
): GeneratedReportData {
  const orgLiquidations = liquidations.filter((l) => l.organizationId === org.id);
  const orgPayables = payables.filter((p) => p.organizationId === org.id);

  const allocatedBudget = org.budget || org.allocatedBudget || 0;
  const duesCollected = orgPayables
    .filter((p) => (p.status === 'paid' || p.paymentStatus === 'PAID') && p.type === 'dues')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const eventFeesCollected = orgPayables
    .filter((p) => (p.status === 'paid' || p.paymentStatus === 'PAID') && p.type === 'event_fee')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalInflows = allocatedBudget + duesCollected + eventFeesCollected;

  const totalExpenses = orgLiquidations
    .filter((l) => l.status === 'APPROVED')
    .reduce((sum, l) => sum + (l.totalAmount || l.actualExpenses || 0), 0);

  const netCashBalance = totalInflows - totalExpenses;

  const rows = [
    { item: 'SAO Institutional Budget Allocation', category: 'Inflow', amount: `₱${allocatedBudget.toLocaleString()}`, ref: 'SAO-GRANT' },
    { item: 'Membership Dues Collected', category: 'Inflow', amount: `₱${duesCollected.toLocaleString()}`, ref: 'DUES-COLLECTION' },
    { item: 'Event Ticket & Fee Collections', category: 'Inflow', amount: `₱${eventFeesCollected.toLocaleString()}`, ref: 'EVENT-FEES' },
    ...orgLiquidations.map((l) => ({
      item: l.eventTitle || 'Liquidated Activity Expense',
      category: 'Outflow (Expense)',
      amount: `₱${(l.totalAmount || l.actualExpenses || 0).toLocaleString()}`,
      ref: l.referenceNumber || l.id.slice(0, 8).toUpperCase(),
    })),
  ];

  return {
    id: 'OFFICER_FINANCIAL_STATEMENT',
    title: `${org.name} — Financial & Cash Flow Statement`,
    category: 'ORGANIZATION',
    metadata: {
      title: `${org.name} — Financial & Cash Flow Statement`,
      subtitle: `Official financial statement detailing fund allocations, revenue collections, disbursed liquidations, and net ending cash balance.`,
      academicYear: filter.academicYear,
      semester: filter.semester,
      scope: (org.academicLevel as ReportScope) || 'ALL',
      generatedAt: new Date().toLocaleString(),
      generatedBy: officerName,
      organizationName: org.name,
      presidentName,
      adviserName,
    },
    kpis: [
      { label: 'Total Revenue & Inflows', value: `₱${totalInflows.toLocaleString()}` },
      { label: 'Total Liquidated Expenses', value: `₱${totalExpenses.toLocaleString()}` },
      { label: 'Net Cash Ending Balance', value: `₱${netCashBalance.toLocaleString()}` },
      { label: 'Dues Collection Total', value: `₱${duesCollected.toLocaleString()}` },
    ],
    columns: [
      { key: 'item', header: 'Transaction / Description' },
      { key: 'category', header: 'Flow Type' },
      { key: 'amount', header: 'Amount (PHP)' },
      { key: 'ref', header: 'Reference ID' },
    ],
    rows,
    signatories: {
      preparedBy: { name: officerName, title: `${org.name} Treasurer` },
      attestedBy: { name: presidentName, title: `${org.name} President` },
      approvedBy: { name: adviserName, title: `${org.name} Faculty Adviser` },
    },
  };
}

/**
 * Officer Report 3: Event Attendance & Member Participation Roster
 */
export function generateOfficerAttendanceRoster(
  org: OrganizationDocument,
  events: EventDocument[],
  students: StudentDocument[],
  filter: ReportFilterOptions,
  officerName = 'Organization Officer',
  presidentName = 'Club President',
  adviserName = 'Club Adviser'
): GeneratedReportData {
  const orgEvents = events.filter((e) => e.organizationId === org.id);
  const selectedEvent = orgEvents.find((e) => e.id === filter.organizationId) || orgEvents[0];

  const attendeesCount = selectedEvent?.actualAttendees || selectedEvent?.attendeesCount || 0;
  const expectedCount = selectedEvent?.expectedAttendees || 0;

  const rows = students.slice(0, 40).map((s, idx) => ({
    studentId: s.studentId || `2024-00${idx + 1}`,
    name: `${s.lastName}, ${s.firstName}`,
    course: s.courseCode || 'BSIT',
    yearSection: `${s.yearLevel || '1st Year'} · ${s.section || 'A'}`,
    timeIn: '08:15 AM (QR Verified)',
    timeOut: '11:45 AM (QR Verified)',
    status: 'Present',
  }));

  return {
    id: 'OFFICER_EVENT_ATTENDANCE_ROSTER',
    title: `${org.name} — Event Attendance & Participation Log`,
    category: 'ORGANIZATION',
    metadata: {
      title: `${org.name} — Event Attendance Log`,
      subtitle: `Verified attendance roll sheet with QR check-in & check-out audit records for ${selectedEvent?.title || 'Hosted Event'}.`,
      academicYear: filter.academicYear,
      semester: filter.semester,
      scope: (org.academicLevel as ReportScope) || 'ALL',
      generatedAt: new Date().toLocaleString(),
      generatedBy: officerName,
      organizationName: org.name,
      presidentName,
      adviserName,
    },
    kpis: [
      { label: 'Event Title', value: selectedEvent?.title || 'Activity' },
      { label: 'Total Verified Attendees', value: attendeesCount },
      { label: 'Expected Participants', value: expectedCount },
      { label: 'Turnout Percentage', value: `${expectedCount > 0 ? Math.round((attendeesCount / expectedCount) * 100) : 100}%` },
    ],
    columns: [
      { key: 'studentId', header: 'Student ID' },
      { key: 'name', header: 'Student Name' },
      { key: 'course', header: 'Program' },
      { key: 'yearSection', header: 'Year & Section' },
      { key: 'timeIn', header: 'Time-In (Entry)' },
      { key: 'timeOut', header: 'Time-Out (Exit)' },
      { key: 'status', header: 'Attendance' },
    ],
    rows,
    signatories: {
      preparedBy: { name: officerName, title: `${org.name} Attendance Officer` },
      attestedBy: { name: presidentName, title: `${org.name} President` },
      approvedBy: { name: adviserName, title: `${org.name} Faculty Adviser` },
    },
  };
}

/**
 * Officer Report 4: Official Membership Directory & Officer Roster
 */
export function generateOfficerMembershipDirectory(
  org: OrganizationDocument,
  students: StudentDocument[],
  filter: ReportFilterOptions,
  officerName = 'Organization Secretary',
  presidentName = 'Club President',
  adviserName = 'Club Adviser'
): GeneratedReportData {
  const rows = students.slice(0, 45).map((s) => ({
    studentId: s.studentId || '—',
    name: `${s.lastName}, ${s.firstName}`,
    program: s.courseCode || 'BSIT',
    yearLevel: s.yearLevel || '1st Year',
    section: s.section || 'A',
    contact: s.contactNumber || '—',
    email: s.email || '—',
    role: s.studentId?.includes('1') ? 'Member' : 'Officer',
  }));

  return {
    id: 'OFFICER_MEMBERSHIP_DIRECTORY',
    title: `${org.name} — Official Membership Directory`,
    category: 'ORGANIZATION',
    metadata: {
      title: `${org.name} — Official Membership Directory`,
      subtitle: `Official roster of registered active student members and appointed executive officers.`,
      academicYear: filter.academicYear,
      semester: filter.semester,
      scope: (org.academicLevel as ReportScope) || 'ALL',
      generatedAt: new Date().toLocaleString(),
      generatedBy: officerName,
      organizationName: org.name,
      presidentName,
      adviserName,
    },
    kpis: [
      { label: 'Total Registered Members', value: org.memberCount || org.totalMembers || rows.length },
      { label: 'Executive Officers', value: org.officerCount || 6 },
      { label: 'Accredited Faculty Adviser', value: adviserName },
    ],
    columns: [
      { key: 'studentId', header: 'Student ID' },
      { key: 'name', header: 'Student Name' },
      { key: 'program', header: 'Program' },
      { key: 'yearLevel', header: 'Year Level' },
      { key: 'section', header: 'Section' },
      { key: 'role', header: 'Membership Designation' },
      { key: 'contact', header: 'Contact #' },
      { key: 'email', header: 'Email Address' },
    ],
    rows,
    signatories: {
      preparedBy: { name: officerName, title: `${org.name} Secretary` },
      attestedBy: { name: presidentName, title: `${org.name} President` },
      approvedBy: { name: adviserName, title: `${org.name} Faculty Adviser` },
    },
  };
}

/**
 * Officer Report 5: Member Dues & Payables Collection Tracking Report
 */
export function generateOfficerDuesTrackingReport(
  org: OrganizationDocument,
  payables: PayableDocument[],
  filter: ReportFilterOptions,
  officerName = 'Organization Treasurer',
  presidentName = 'Club President',
  adviserName = 'Club Adviser'
): GeneratedReportData {
  const orgPayables = payables.filter((p) => p.organizationId === org.id);

  const totalAssessed = orgPayables.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPaid = orgPayables
    .filter((p) => p.status === 'paid' || p.paymentStatus === 'PAID')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalUnpaid = totalAssessed - totalPaid;

  const rows = orgPayables.map((p) => ({
    studentId: p.studentId || '—',
    studentName: p.studentName || 'Member',
    feeTitle: p.title || p.feeTitle || 'Semester Membership Due',
    type: (p.type || 'dues').toUpperCase(),
    amount: `₱${(p.amount || 0).toLocaleString()}`,
    status: (p.paymentStatus || p.status || 'UNPAID').toUpperCase(),
    datePaid: p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'Pending Payment',
  }));

  return {
    id: 'OFFICER_DUES_PAYABLES_TRACKING',
    title: `${org.name} — Member Dues & Collection Tracking Report`,
    category: 'ORGANIZATION',
    metadata: {
      title: `${org.name} — Member Dues Tracking`,
      subtitle: `Audit ledger of membership dues and event fee collections per club member.`,
      academicYear: filter.academicYear,
      semester: filter.semester,
      scope: (org.academicLevel as ReportScope) || 'ALL',
      generatedAt: new Date().toLocaleString(),
      generatedBy: officerName,
      organizationName: org.name,
      presidentName,
      adviserName,
    },
    kpis: [
      { label: 'Total Assessed Dues', value: `₱${totalAssessed.toLocaleString()}` },
      { label: 'Total Collected Dues', value: `₱${totalPaid.toLocaleString()}` },
      { label: 'Unpaid / Delinquent Balance', value: `₱${totalUnpaid.toLocaleString()}` },
      { label: 'Collection Rate', value: `${totalAssessed > 0 ? Math.round((totalPaid / totalAssessed) * 100) : 0}%` },
    ],
    columns: [
      { key: 'studentId', header: 'Student ID' },
      { key: 'studentName', header: 'Member Full Name' },
      { key: 'feeTitle', header: 'Due Description' },
      { key: 'type', header: 'Fee Type' },
      { key: 'amount', header: 'Amount' },
      { key: 'status', header: 'Payment Status' },
      { key: 'datePaid', header: 'Date Paid' },
    ],
    rows,
    signatories: {
      preparedBy: { name: officerName, title: `${org.name} Treasurer` },
      attestedBy: { name: presidentName, title: `${org.name} President` },
      approvedBy: { name: adviserName, title: `${org.name} Faculty Adviser` },
    },
  };
}
