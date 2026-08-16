import { StudentDocument } from '../types/student.types';

/**
 * Exports an array of student documents to a CSV file and triggers automatic browser download.
 */
export function exportStudentsToCSV(
  students: StudentDocument[],
  filenamePrefix = 'Active_Students_Directory'
) {
  if (students.length === 0) {
    alert('No students to export.');
    return;
  }

  const headers = [
    'Student ID',
    'Full Name',
    'Email',
    'Contact Number',
    'Department',
    'Course Code',
    'Course Name',
    'Year Level',
    'Section',
    'School Year',
    'Semester',
    'Status',
    'Registration Source',
  ];

  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = students.map((s) => [
    escapeCSV(s.studentId),
    escapeCSV(`${s.firstName} ${s.middleName ? s.middleName + ' ' : ''}${s.lastName}`),
    escapeCSV(s.email),
    escapeCSV(s.contactNumber),
    escapeCSV(s.departmentName || s.departmentId),
    escapeCSV(s.courseCode),
    escapeCSV(s.courseName),
    escapeCSV(s.yearLevel),
    escapeCSV(s.section),
    escapeCSV(s.schoolYear),
    escapeCSV(s.semester),
    escapeCSV(s.status),
    escapeCSV(s.registrationSource || 'MANUAL'),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
