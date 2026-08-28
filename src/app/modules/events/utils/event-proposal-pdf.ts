import jsPDF from 'jspdf';
import type { EventDocument } from '../types/event.types';
import type { OrganizationDocument } from '../../organizations/types/organization.types';
import { formatCurrency } from '../../../utils/currency';
import { formatAppDate } from '../../../utils/date';

interface EventProposalPDFOptions {
  org?: OrganizationDocument | null;
  eventTypeName?: string;
  venueName?: string;
  categoryName?: string;
  approverName?: string;
}

/**
 * Generates an official, publication-quality A4 PDF for STI College Ormoc Event Proposals.
 * Includes official STI header, event overview, multi-session table, itemized budget,
 * compliance checklist, and signature approval blocks.
 */
export async function exportEventProposalPDF(
  event: EventDocument,
  options: EventProposalPDFOptions = {}
) {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    let y = margin;

    const isSas = !event.hostingOrgId || event.hostingOrgId === 'sas';
    const orgName = isSas
      ? 'Student Affairs & Services (SAS)'
      : options.org?.name || event.hostingOrgId || 'Student Organization';
    const orgAcronym = isSas ? 'SAS' : options.org?.acronym || 'ORG';
    const eventType = options.eventTypeName || 'General Campus Event';
    const referenceId = event.referenceId || 'EVT-PROP';

    // ─── 1. Header Banner (Deep Navy #001A4D) ─────────────────────────────────
    doc.setFillColor(0, 26, 77); // #001A4D
    doc.rect(margin, y, pageWidth - margin * 2, 24, 'F');

    // STI Golden Yellow accent strip
    doc.setFillColor(255, 212, 28); // #FFD41C
    doc.rect(margin, y + 24, pageWidth - margin * 2, 2, 'F');

    // Header Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('STI COLLEGE ORMOC', margin + 6, y + 8);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 212, 28);
    doc.text('STUDENT AFFAIRS AND SERVICES (SAS) · OFFICIAL EVENT PROPOSAL', margin + 6, y + 15);

    doc.setFontSize(7.5);
    doc.setTextColor(200, 215, 245);
    doc.text(
      `Academic Period: ${event.schoolYear || 'A.Y. 2025–2026'} · ${event.semester || 'Active Semester'} | Ref: ${referenceId}`,
      margin + 6,
      y + 21
    );

    // Right-aligned Date & Status
    const statusLabel = (event.proposalStatus || 'DRAFT').toUpperCase();
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`STATUS: ${statusLabel}`, pageWidth - margin - 6, y + 9, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(220, 220, 220);
    const dateStr = formatAppDate(event.createdAt, new Date().toLocaleDateString());
    doc.text(`Submitted: ${dateStr}`, pageWidth - margin - 6, y + 15, { align: 'right' });
    doc.text(`Host: ${orgAcronym}`, pageWidth - margin - 6, y + 21, { align: 'right' });

    y += 32;

    // ─── 2. Event Title & Core Badges ─────────────────────────────────────────
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 26, 77);
    const cleanTitle = (event.title || 'Untitled Event Proposal').toUpperCase();
    doc.text(cleanTitle.slice(0, 60), margin + 5, y + 8);

    if (event.tagline) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(14, 78, 189);
      doc.text(`"${event.tagline.slice(0, 80)}"`, margin + 5, y + 14);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const hostLine = isSas
      ? 'Issuer: Student Affairs & Services (SAS) · Institutional Event'
      : `Organizing Club: ${orgName} (${orgAcronym})`;
    doc.text(hostLine, margin + 5, y + 19);

    // Right-side Type & Capacity
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(14, 78, 189);
    doc.text(`Type: ${eventType}`, pageWidth - margin - 6, y + 8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Target Reach: ${event.expectedParticipantCount || 'Open to target cohort'}`,
      pageWidth - margin - 6,
      y + 14,
      { align: 'right' }
    );

    y += 28;

    // ─── 3. Description & Objectives ──────────────────────────────────────────
    if (event.description) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 26, 77);
      doc.text('I. EVENT DESCRIPTION & OBJECTIVES', margin, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 50);
      const splitDesc = doc.splitTextToSize(event.description, pageWidth - margin * 2);
      doc.text(splitDesc.slice(0, 4), margin, y);
      y += Math.min(splitDesc.length, 4) * 4 + 2;

      if (event.objectives && event.objectives.length > 0) {
        event.objectives.slice(0, 3).forEach((obj, idx) => {
          doc.text(`  • ${obj}`, margin + 2, y);
          y += 4;
        });
      }
      y += 3;
    }

    // ─── 4. Multi-Session Schedule & Venue Table ──────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 26, 77);
    doc.text('II. SCHEDULE, VENUE & SESSIONS', margin, y);
    y += 5;

    const tableWidth = pageWidth - margin * 2;
    doc.setFillColor(0, 26, 77);
    doc.rect(margin, y, tableWidth, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('SESSION', margin + 3, y + 4.2);
    doc.text('DATE', margin + 35, y + 4.2);
    doc.text('START - END TIME', margin + 70, y + 4.2);
    doc.text('VENUE / LOCATION', margin + 115, y + 4.2);
    doc.text('SCANNING WINDOW', margin + 155, y + 4.2);
    y += 6;

    const sessions = event.sessions && event.sessions.length > 0 ? event.sessions : [
      {
        id: 's1',
        title: 'Main Session',
        date: event.sessions?.[0]?.date || 'TBD',
        startTime: '08:00',
        endTime: '17:00',
      }
    ];

    sessions.forEach((s, idx) => {
      const isAlt = idx % 2 === 1;
      if (isAlt) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, tableWidth, 6, 'F');
      }
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, y + 6, margin + tableWidth, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(40, 40, 40);

      doc.text(String(s.title || `Session ${idx + 1}`).slice(0, 18), margin + 3, y + 4.2);
      doc.text(formatAppDate(s.date, 'TBD'), margin + 35, y + 4.2);
      doc.text(`${s.startTime || 'TBD'} - ${s.endTime || 'TBD'}`, margin + 70, y + 4.2);
      const vName = options.venueName || event.customVenueName || 'On-Campus Venue';
      doc.text(vName.slice(0, 22), margin + 115, y + 4.2);
      doc.text(`Grace: ${event.gracePeriodMinutes || 15}m / Late: ${event.lateThresholdMinutes || 60}m`, margin + 155, y + 4.2);
      y += 6;
    });

    y += 6;

    // ─── 5. Target Audience & Eligibility ─────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 26, 77);
    doc.text('III. TARGET PARTICIPANTS & COMPLIANCE', margin, y);
    y += 5;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, tableWidth, 14, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);

    const scopeText = event.targetAudienceScope === 'members'
      ? `Exclusive to registered members of ${orgAcronym}`
      : 'Open to all matching campus students';
    const courseText = event.targetCourses && event.targetCourses.length > 0
      ? `${event.targetCourses.length} Courses Selected`
      : 'All Academic Courses';
    const yearText = event.targetYearLevels && event.targetYearLevels.length > 0
      ? event.targetYearLevels.join(', ')
      : 'All Year Levels';

    doc.text(`• Audience Scope: ${scopeText}`, margin + 4, y + 5);
    doc.text(`• Eligible Cohort: ${courseText} | ${yearText}`, margin + 4, y + 10);

    const qrStatus = event.enableQRTickets !== false ? 'Enabled (Option A Scan)' : 'Disabled';
    const payStatus = event.studentPayablesEnabled ? `Fee: ${formatCurrency(event.adminFeeOverride || 0)}` : 'Free Event';
    doc.text(`• QR Gate Tickets: ${qrStatus} | Payment: ${payStatus}`, pageWidth - margin - 4, y + 5, { align: 'right' });
    doc.text(`• Certificates: ${event.certificatesEnabled ? 'Issued on Attendance' : 'None'}`, pageWidth - margin - 4, y + 10, { align: 'right' });

    y += 19;

    // ─── 6. Itemized Budget Breakdown Table ───────────────────────────────────
    const budgetItems = event.budgetItems || [];
    const totalBudget = event.totalApprovedBudget || event.totalRequestedBudget || 0;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 26, 77);
    doc.text('IV. FINANCIAL BUDGET REQUEST', margin, y);
    y += 5;

    doc.setFillColor(0, 26, 77);
    doc.rect(margin, y, tableWidth, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('ITEM / CATEGORY', margin + 3, y + 4.2);
    doc.text('DESCRIPTION', margin + 50, y + 4.2);
    doc.text('QTY', margin + 115, y + 4.2, { align: 'center' });
    doc.text('UNIT COST', margin + 145, y + 4.2, { align: 'right' });
    doc.text('TOTAL AMOUNT', margin + tableWidth - 3, y + 4.2, { align: 'right' });
    y += 6;

    if (budgetItems.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text('No financial budget requested for this event (₱0.00 zero-budget activity).', margin + 3, y + 4.2);
      y += 6;
    } else {
      budgetItems.slice(0, 6).forEach((item, idx) => {
        const isAlt = idx % 2 === 1;
        if (isAlt) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, tableWidth, 5.5, 'F');
        }
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, y + 5.5, margin + tableWidth, y + 5.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(40, 40, 40);

        const subtotal = (item.quantity || 0) * (item.unitCost || 0);
        doc.text(String(item.item || 'Budget Item').slice(0, 25), margin + 3, y + 4);
        doc.text(String(item.description || '—').slice(0, 35), margin + 50, y + 4);
        doc.text(String(item.quantity || 1), margin + 115, y + 4, { align: 'center' });
        doc.text(formatCurrency(item.unitCost || 0), margin + 145, y + 4, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(subtotal), margin + tableWidth - 3, y + 4, { align: 'right' });
        y += 5.5;
      });
    }

    // Budget Total Summary Row
    doc.setFillColor(240, 244, 255);
    doc.rect(margin, y, tableWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 26, 77);
    doc.text('TOTAL PROPOSED EVENT BUDGET:', margin + 3, y + 4.2);
    doc.setTextColor(14, 78, 189);
    doc.text(formatCurrency(totalBudget), margin + tableWidth - 3, y + 4.2, { align: 'right' });
    y += 12;

    // Check if we need to guard bottom margin
    if (y > pageHeight - 40) {
      doc.addPage();
      y = margin;
    }

    // ─── 7. Official Signatures & Approval Block ──────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 26, 77);
    doc.text('V. OFFICIAL ENDORSEMENT & APPROVALS', margin, y);
    y += 8;

    const sigBoxWidth = (tableWidth - 8) / 3;

    // 1. Submitting Officer
    const officerX = margin;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Prepared & Submitted By:', officerX, y);
    y += 9;
    doc.setDrawColor(180, 180, 180);
    doc.line(officerX, y, officerX + sigBoxWidth, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 26, 77);
    const officerName = isSas
      ? 'SAS Institutional Admin'
      : event.createdByName || 'Student Organization Officer';
    doc.text(officerName, officerX, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(isSas ? 'Student Affairs & Services' : `${orgAcronym} Officer`, officerX, y + 7.5);

    // 2. Organization Adviser
    const adviserX = margin + sigBoxWidth + 4;
    doc.text('Endorsed & Verified By:', adviserX, y - 9);
    doc.line(adviserX, y, adviserX + sigBoxWidth, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 26, 77);
    doc.text('Organization Faculty Adviser', adviserX, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`${orgAcronym} Academic Moderator`, adviserX, y + 7.5);

    // 3. SAO Head / Approver
    const approverX = margin + (sigBoxWidth + 4) * 2;
    doc.text('Approved For Implementation By:', approverX, y - 9);
    doc.line(approverX, y, approverX + sigBoxWidth, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 26, 77);
    doc.text(options.approverName || 'SAO Head / Academic Head', approverX, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Student Affairs & Services (SAS)', approverX, y + 7.5);

    // ─── 8. Footer ────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `STI Sync Platform · Official Digital Proposal Document · Generated ${new Date().toLocaleString()} · System Reference: ${referenceId}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );

    // Trigger download
    const filenameSafe = cleanTitle.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    doc.save(`STI_Event_Proposal_${filenameSafe}_${referenceId}.pdf`);
  } catch (err) {
    console.error('Error generating event proposal PDF:', err);
    throw err;
  }
}
