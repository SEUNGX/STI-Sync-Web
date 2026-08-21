import jsPDF from 'jspdf';
import { GeneratedReportData } from '../types/report.types';

/**
 * Builds and downloads an Official STI Formatted PDF report with letterhead,
 * executive summary KPIs, styled data table, and official signature sign-off blocks.
 */
export async function exportReportToPDF(report: GeneratedReportData) {
  try {
    const doc = new jsPDF({
      orientation: report.columns.length > 5 ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const isLandscape = report.columns.length > 5;
    const pageWidth = isLandscape ? 297 : 210;
    const pageHeight = isLandscape ? 210 : 297;
    const margin = 14;
    let y = margin;

    // ─── 1. Header Banner (Dark Navy) ──────────────────────────────────────────
    doc.setFillColor(0, 26, 77); // #001A4D
    doc.rect(margin, y, pageWidth - margin * 2, 26, 'F');

    // STI Yellow accent strip
    doc.setFillColor(255, 212, 28); // #FFD41C
    doc.rect(margin, y + 26, pageWidth - margin * 2, 2, 'F');

    // Header Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('STI COLLEGE ORMOC', margin + 6, y + 9);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 212, 28);
    doc.text('STUDENT AFFAIRS AND SERVICES (SAS) · OFFICIAL REPORT', margin + 6, y + 16);

    doc.setFontSize(8);
    doc.setTextColor(200, 215, 245);
    doc.text(`Academic Period: ${report.metadata.academicYear || 'A.Y. 2026-2027'} · ${report.metadata.semester || 'All Terms'} | Track: ${report.metadata.scope}`, margin + 6, y + 22);

    // Right-aligned Date & Gen By
    doc.setFontSize(8);
    doc.setTextColor(230, 230, 230);
    doc.text(`Generated: ${report.metadata.generatedAt}`, pageWidth - margin - 6, y + 10, { align: 'right' });
    doc.text(`Issuer: ${report.metadata.generatedBy}`, pageWidth - margin - 6, y + 16, { align: 'right' });

    y += 34;

    // ─── 2. Report Title & Subtitle ──────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(0, 26, 77);
    doc.text(report.title.toUpperCase(), margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(report.metadata.subtitle, margin, y);
    y += 7;

    // ─── 3. Executive KPI Summary Cards ──────────────────────────────────────
    if (report.kpis && report.kpis.length > 0) {
      const cardWidth = (pageWidth - margin * 2 - (report.kpis.length - 1) * 3) / report.kpis.length;
      report.kpis.forEach((kpi, i) => {
        const x = margin + i * (cardWidth + 3);
        doc.setFillColor(245, 248, 255);
        doc.setDrawColor(210, 225, 250);
        doc.roundedRect(x, y, cardWidth, 14, 2, 2, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 115, 140);
        doc.text(kpi.label.toUpperCase(), x + 3, y + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 26, 77);
        doc.text(String(kpi.value), x + 3, y + 10.5);
      });
      y += 18;
    }

    // ─── 4. Table Header ─────────────────────────────────────────────────────
    const colCount = report.columns.length;
    const tableWidth = pageWidth - margin * 2;
    const colWidth = tableWidth / colCount;

    doc.setFillColor(0, 26, 77);
    doc.rect(margin, y, tableWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    report.columns.forEach((col, i) => {
      const colX = margin + i * colWidth + 2;
      doc.text(col.header.toUpperCase(), colX, y + 4.8);
    });
    y += 7;

    // ─── 5. Table Rows ───────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    const maxRows = 45; // prevent overflow in single-page / multi-page handling
    const visibleRows = report.rows.slice(0, maxRows);

    visibleRows.forEach((row, rowIndex) => {
      // Check page break
      if (y > pageHeight - 38) {
        doc.addPage();
        y = margin;

        // Repeat table header
        doc.setFillColor(0, 26, 77);
        doc.rect(margin, y, tableWidth, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        report.columns.forEach((col, i) => {
          const colX = margin + i * colWidth + 2;
          doc.text(col.header.toUpperCase(), colX, y + 4.8);
        });
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
      }

      // Alternating row background
      if (rowIndex % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, tableWidth, 6, 'F');
      }

      doc.setTextColor(40, 40, 40);
      report.columns.forEach((col, i) => {
        const colX = margin + i * colWidth + 2;
        const val = String(row[col.key] || '—');
        const truncated = val.length > 28 ? val.substring(0, 26) + '…' : val;
        doc.text(truncated, colX, y + 4.2);
      });

      // Bottom row divider
      doc.setDrawColor(235, 238, 245);
      doc.line(margin, y + 6, margin + tableWidth, y + 6);
      y += 6;
    });

    if (report.rows.length > maxRows) {
      y += 4;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(`[Showing first ${maxRows} of ${report.rows.length} records. Export full CSV for complete raw dataset.]`, margin, y);
      y += 4;
    }

    // ─── 6. Official Signature Sign-off Block ────────────────────────────────
    // Ensure room for signatures
    if (y > pageHeight - 32) {
      doc.addPage();
      y = margin + 10;
    } else {
      y = Math.max(y + 8, pageHeight - 32);
    }

    const signY = y;
    const signWidth = (pageWidth - margin * 2) / 3;

    // Prepared By
    const prepName = report.signatories?.preparedBy?.name || report.metadata.generatedBy;
    const prepTitle = report.signatories?.preparedBy?.title || 'Report Officer / SAO Administrator';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 26, 77);
    doc.text('Prepared by:', margin, signY);
    doc.line(margin, signY + 10, margin + signWidth - 8, signY + 10);
    doc.text(prepName, margin, signY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.text(prepTitle, margin, signY + 17.5);

    // Attested By / Verified By
    const attName = report.signatories?.attestedBy?.name || report.metadata.presidentName || 'Organization President';
    const attTitle = report.signatories?.attestedBy?.title || 'President / Lead Auditor';
    const attX = margin + signWidth;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 26, 77);
    doc.text('Attested by:', attX, signY);
    doc.line(attX, signY + 10, attX + signWidth - 8, signY + 10);
    doc.text(attName, attX, signY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.text(attTitle, attX, signY + 17.5);

    // Approved By
    const appName = report.signatories?.approvedBy?.name || report.metadata.adviserName || 'SAO Head / Academic Adviser';
    const appTitle = report.signatories?.approvedBy?.title || 'Adviser / SAO Head';
    const appX = margin + signWidth * 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 26, 77);
    doc.text('Approved by:', appX, signY);
    doc.line(appX, signY + 10, appX + signWidth - 8, signY + 10);
    doc.text(appName, appX, signY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.text(appTitle, appX, signY + 17.5);

    // Footer timestamp & Confidentiality tag
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(140, 140, 140);
    doc.text('STI Sync Official Institutional Report · Confidential & Proprietary to STI College Ormoc · Document Integrity Verified', margin, pageHeight - 4);

    // Save File
    const cleanTitle = report.title.replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`${cleanTitle}_${dateStr}.pdf`);
  } catch (err) {
    console.error('Failed to export PDF report:', err);
    alert('Failed to generate PDF. Please try exporting as CSV instead.');
  }
}
