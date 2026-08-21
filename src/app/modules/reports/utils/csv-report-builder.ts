import { GeneratedReportData } from '../types/report.types';

/**
 * Generates and downloads a CSV file from a GeneratedReportData object.
 */
export function exportReportToCSV(report: GeneratedReportData) {
  if (!report.rows || report.rows.length === 0) {
    alert('No data rows available to export.');
    return;
  }

  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = report.columns.map((c) => escapeCSV(c.header));
  const rows = report.rows.map((row) => {
    return report.columns.map((c) => escapeCSV(row[c.key]));
  });

  const metadataHeaders = [
    `"STI COLLEGE ORMOC - STUDENT AFFAIRS AND SERVICES (SAS)"`,
    `"${report.title.toUpperCase()}"`,
    `"Scope: ${report.metadata.scope} | Term: ${report.metadata.academicYear || ''} ${report.metadata.semester || ''}"`,
    `"Generated At: ${report.metadata.generatedAt} by ${report.metadata.generatedBy}"`,
    `""`, // empty line before table
  ];

  const csvContent = [
    ...metadataHeaders,
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanTitle = report.title.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `${cleanTitle}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
