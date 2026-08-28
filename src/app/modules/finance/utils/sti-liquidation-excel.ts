import type { LiquidationDocument, LiquidationLineItem } from '../types/liquidation.types';
import { formatAppDate } from '../../../utils/date';

export interface StiSignatory {
  id: string;
  type: string; // e.g., 'Submitted By:', 'Checked By:', 'Indorsed By:', 'Recommending Approval:', 'Approved By:', 'Noted By:'
  name: string; // e.g., '' (blank for signature) or officer name
  role: string; // e.g., '(Name of Employee / Treasurer)', '(Accountant)', '(Supervisor)', '(Administrator)', '(President)'
  date?: string;
}

export interface StiLiquidationExcelOptions {
  officerName?: string;
  chequeNumber?: string;
  activityEndDate?: string;
  submissionDeadline?: string;
  dateSubmitted?: string;
  dateReleased?: string;
  amountAdvanced?: number;
  daysLapsed?: string;
  orNumber?: string;
  signatories?: StiSignatory[];
}

function escapeXml(unsafe: string | number | undefined | null): string {
  if (unsafe === undefined || unsafe === null) return '';
  const str = String(unsafe);
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Exports a Liquidation Report to an official STI College Ormoc formatted Excel spreadsheet (.xls / Excel XML).
 * Faithfully mirrors the clean monochrome layout, standard borders, cell positions, formulas,
 * and signature matrix of LIQUIDATION-FORMAT_v1.xlsx without unnecessary decorative colors.
 */
export function exportOfficialStiLiquidationExcel(
  report: LiquidationDocument,
  options: StiLiquidationExcelOptions = {}
) {
  const eventTitle = report.eventTitle || 'Event Activity';
  const officerName = options.officerName || report.submittedByName || '';
  const chequeNumber = options.chequeNumber || '';
  const activityEndDate = options.activityEndDate || formatAppDate(report.createdAt, '');
  const submissionDeadline = options.submissionDeadline || '';
  const dateSubmitted = options.dateSubmitted || formatAppDate(report.submittedAt || report.createdAt, new Date().toLocaleDateString());
  const dateReleased = options.dateReleased || '';
  const amountAdvanced = options.amountAdvanced !== undefined ? options.amountAdvanced : (report.allocatedBudget || report.totalAllocatedBudget || report.totalActualSpent || 0);
  const daysLapsed = options.daysLapsed || '-o-';
  const orNumber = options.orNumber || (report.lineItems?.find(i => i.receiptNumber)?.receiptNumber) || '';

  // Dynamic Signatories (Clean fallback defaults matching STI standard with NO hardcoded sample names)
  const signatories: StiSignatory[] = options.signatories && options.signatories.length > 0
    ? options.signatories
    : [
        { id: '1', type: 'Submitted By:', name: officerName, role: '(Name of Employee / Treasurer)' },
        { id: '2', type: 'Checked By:', name: '', role: '(Accountant)' },
        { id: '3', type: 'Indorsed By:', name: '', role: '(Supervisor)' },
        { id: '4', type: 'Recommending Approval:', name: '', role: '(Supervisor)' },
        { id: '5', type: 'Approved By:', name: '', role: '(Administrator)' },
        { id: '6', type: 'Noted By:', name: '', role: '(President)' },
      ];

  // Group line items by category (e.g. A. Fare, B. Meals, C. Supplies, D. Accommodation, etc.)
  const rawItems = report.lineItems || [];
  const categoryMap = new Map<string, LiquidationLineItem[]>();

  rawItems.forEach((item) => {
    const cat = (item.category || 'General Expenses').trim();
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, []);
    }
    categoryMap.get(cat)!.push(item);
  });

  if (categoryMap.size === 0) {
    categoryMap.set('General Expenses', []);
  }

  const categoryLetterPrefixes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  let catIndex = 0;

  // Build the expense rows XML
  let currentRow = 13; // Data starts at Row 13 in original template
  let expenseRowsXml = '';
  const itemRowIndexes: number[] = [];

  categoryMap.forEach((items, catName) => {
    const letter = categoryLetterPrefixes[catIndex] || `${catIndex + 1}`;
    const categoryTitle = `${letter}. ${catName}`;

    // Compute category allocated budget (sum of item allocatedCost)
    const catAllocated = items.reduce((sum, it) => sum + (it.allocatedCost || 0), 0);

    if (items.length === 0) {
      const r = currentRow++;
      itemRowIndexes.push(r);
      expenseRowsXml += `
   <Row ss:Index="${r}">
    <Cell ss:StyleID="CategoryCell"><Data ss:Type="String">${escapeXml(categoryTitle)}</Data></Cell>
    <Cell ss:StyleID="CurrencyCell">${catAllocated > 0 ? `<Data ss:Type="Number">${catAllocated}</Data>` : '<Data ss:Type="String"></Data>'}</Cell>
    <Cell ss:StyleID="ItemDescCell"><Data ss:Type="String">—</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">0</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">0</Data></Cell>
    <Cell ss:StyleID="CurrencyCell" ss:Formula="=RC[-2]-RC[-1]"><Data ss:Type="Number">0</Data></Cell>
    <Cell ss:StyleID="BorderedText"><Data ss:Type="String"></Data></Cell>
   </Row>`;
    } else {
      items.forEach((item, itemIdx) => {
        const r = currentRow++;
        itemRowIndexes.push(r);
        const isFirstInCat = itemIdx === 0;

        const particularColA = isFirstInCat ? categoryTitle : '';
        const allocatedColB = isFirstInCat ? (catAllocated > 0 ? catAllocated : '') : '';
        const itemDesc = item.description || item.vendorName || '—';
        const itemAmount = item.totalCost || 0;
        const remarks = item.receiptNumber ? `Reference: ${item.receiptNumber}` : (item.vendorName || '');

        expenseRowsXml += `
   <Row ss:Index="${r}">
    <Cell ss:StyleID="${isFirstInCat ? 'CategoryCell' : 'BorderedText'}"><Data ss:Type="String">${escapeXml(particularColA)}</Data></Cell>
    <Cell ss:StyleID="${isFirstInCat ? 'CurrencyCell' : 'BorderedText'}">${allocatedColB !== '' ? `<Data ss:Type="Number">${allocatedColB}</Data>` : '<Data ss:Type="String"></Data>'}</Cell>
    <Cell ss:StyleID="ItemDescCell"><Data ss:Type="String">${escapeXml(itemDesc)}</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${itemAmount}</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${itemAmount}</Data></Cell>
    <Cell ss:StyleID="CurrencyCell" ss:Formula="=RC[-2]-RC[-1]"><Data ss:Type="Number">0</Data></Cell>
    <Cell ss:StyleID="BorderedText"><Data ss:Type="String">${escapeXml(remarks)}</Data></Cell>
   </Row>`;
      });
    }
    catIndex++;
  });

  const totalsRow = currentRow++;
  const firstDataRow = 13;
  const lastDataRow = totalsRow - 1;

  const totalAdvanceFormula = `=SUM(R${firstDataRow}C2:R${lastDataRow}C2)`;
  const totalActualFormula = `=SUM(R${firstDataRow}C5:R${lastDataRow}C5)`;
  const varianceFormula = `=R${totalsRow}C2-R${totalsRow}C5`;

  // Summary note block rows
  const emptyRow1 = currentRow++;
  const noteHeaderRow = currentRow++;
  const amountAdvancedRow = currentRow++;
  const actualExpenseSummaryRow = currentRow++;
  const balanceRow = currentRow++;

  // Dynamic Signatures Block Rows
  let signaturesXml = '';
  let sigStartRow = currentRow + 2;

  signatories.forEach((sig) => {
    const titleRow = sigStartRow++;
    const roleRow = sigStartRow++;
    sigStartRow++; // spacing row

    signaturesXml += `
   <Row ss:Index="${titleRow}">
    <Cell ss:StyleID="SigHeader"><Data ss:Type="String">${escapeXml(sig.type)}</Data></Cell>
    <Cell ss:StyleID="Default"/>
    <Cell ss:StyleID="SigNameUnderline"><Data ss:Type="String">${escapeXml(sig.name)}</Data></Cell>
    <Cell ss:StyleID="Default"/>
    <Cell ss:StyleID="Default"/>
   </Row>
   <Row ss:Index="${roleRow}">
    <Cell ss:StyleID="Default"/>
    <Cell ss:StyleID="Default"/>
    <Cell ss:StyleID="SigRoleText"><Data ss:Type="String">${escapeXml(sig.role)}</Data></Cell>
    <Cell ss:StyleID="Default"/>
    <Cell ss:StyleID="SigDateText"><Data ss:Type="String">(Date)</Data></Cell>
   </Row>`;
  });

  // Clean XML Document matching the monochrome styling of LIQUIDATION-FORMAT_v1.xlsx
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>STI Sync Platform</Author>
  <LastAuthor>STI Sync Platform</LastAuthor>
  <Created>${new Date().toISOString()}</Created>
  <Company>STI College</Company>
  <Version>16.00</Version>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>

  <!-- Title Style (Clean Bold Text) -->
  <Style ss:ID="MainTitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#000000"/>
  </Style>

  <!-- Metadata Header Labels & Values -->
  <Style ss:ID="MetaLabel">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="MetaValue">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="SubHeader">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#000000"/>
  </Style>

  <!-- Clean Table Header Styles (Standard Monochrome with Borders) -->
  <Style ss:ID="TableHeaderTop">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#000000"/>
  </Style>

  <Style ss:ID="TableHeaderSub">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#000000"/>
  </Style>

  <!-- Data Cells -->
  <Style ss:ID="CategoryCell">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#000000"/>
  </Style>

  <Style ss:ID="ItemDescCell">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Color="#000000"/>
  </Style>

  <Style ss:ID="CurrencyCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Color="#000000"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>

  <Style ss:ID="BorderedText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Color="#000000"/>
  </Style>

  <!-- Totals & Balances -->
  <Style ss:ID="TotalLabel">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#000000"/>
  </Style>

  <Style ss:ID="TotalAmountCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#000000"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>

  <Style ss:ID="BalanceSummaryLabel">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#000000"/>
  </Style>

  <Style ss:ID="BalanceSummaryValue">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#000000"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10.5" ss:Bold="1" ss:Color="#000000"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>

  <!-- Signatures Styles -->
  <Style ss:ID="SigHeader">
   <Alignment ss:Horizontal="Left" ss:Vertical="Bottom"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="SigNameUnderline">
   <Alignment ss:Horizontal="Center" ss:Vertical="Bottom"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="SigRoleText">
   <Alignment ss:Horizontal="Center" ss:Vertical="Top"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="SigDateText">
   <Alignment ss:Horizontal="Right" ss:Vertical="Top"/>
   <Font ss:FontName="Calibri" ss:Size="8" ss:Color="#555555"/>
  </Style>
 </Styles>

 <Worksheet ss:Name="Liquidation Report">
  <Table ss:ExpandedColumnCount="8" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="16">
   <Column ss:Index="1" ss:AutoFitWidth="0" ss:Width="160"/>
   <Column ss:Index="2" ss:AutoFitWidth="0" ss:Width="100"/>
   <Column ss:Index="3" ss:AutoFitWidth="0" ss:Width="200"/>
   <Column ss:Index="4" ss:AutoFitWidth="0" ss:Width="90"/>
   <Column ss:Index="5" ss:AutoFitWidth="0" ss:Width="95"/>
   <Column ss:Index="6" ss:AutoFitWidth="0" ss:Width="90"/>
   <Column ss:Index="7" ss:AutoFitWidth="0" ss:Width="130"/>

   <!-- Row 1: Header Title -->
   <Row ss:Index="1" ss:Height="24">
    <Cell ss:MergeAcross="6" ss:StyleID="MainTitle">
     <Data ss:Type="String">LIQUIDATION REPORT FOR ${escapeXml(eventTitle.toUpperCase())}</Data>
    </Cell>
   </Row>

   <!-- Row 2: Officer Name & Activity End Date -->
   <Row ss:Index="2">
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Employee / Officer Name:</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(officerName)}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Date Of Activity End:</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(activityEndDate)}</Data></Cell>
   </Row>

   <!-- Row 3: Cheque Number & Deadline -->
   <Row ss:Index="3">
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Cheque Number:</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(chequeNumber)}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Deadline For The Liquidation Submissions:</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(submissionDeadline)}</Data></Cell>
   </Row>

   <!-- Row 4: Purpose & Date Submitted -->
   <Row ss:Index="4">
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Purpose:</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(eventTitle)}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Date Submitted:</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(dateSubmitted)}</Data></Cell>
   </Row>

   <!-- Row 5: Amount Advanced & Days Lapsed -->
   <Row ss:Index="5">
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Amount:</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${amountAdvanced}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">No. Of Days Lapse:</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(daysLapsed)}</Data></Cell>
   </Row>

   <!-- Row 6: Date Released -->
   <Row ss:Index="6">
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Date Released:</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(dateReleased)}</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="Default"/>
   </Row>

   <!-- Row 8: Section Title -->
   <Row ss:Index="8">
    <Cell ss:MergeAcross="6" ss:StyleID="SubHeader">
     <Data ss:Type="String">CHARGE TO EXPENSE/REFUNDABLE ACCOUNT:</Data>
    </Cell>
   </Row>

   <!-- Row 10: Table Header (Top Level) -->
   <Row ss:Index="10" ss:Height="20">
    <Cell ss:StyleID="TableHeaderTop"><Data ss:Type="String">PARTICULAR</Data></Cell>
    <Cell ss:StyleID="TableHeaderTop"><Data ss:Type="String">AMOUNT</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="TableHeaderTop"><Data ss:Type="String">ACTUAL EXPENSES BREAKDOWN</Data></Cell>
    <Cell ss:StyleID="TableHeaderTop"><Data ss:Type="String">Remarks</Data></Cell>
   </Row>

   <!-- Row 11: Table Header (Sub Level) -->
   <Row ss:Index="11" ss:Height="18">
    <Cell ss:StyleID="TableHeaderSub"><Data ss:Type="String"> Breakdown For Cash Advances</Data></Cell>
    <Cell ss:StyleID="TableHeaderSub"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="TableHeaderSub"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="TableHeaderSub"><Data ss:Type="String">Amount</Data></Cell>
    <Cell ss:StyleID="TableHeaderSub"><Data ss:Type="String">Total Amount</Data></Cell>
    <Cell ss:StyleID="TableHeaderSub"><Data ss:Type="String">Variance</Data></Cell>
    <Cell ss:StyleID="TableHeaderSub"><Data ss:Type="String"></Data></Cell>
   </Row>

   <!-- Data Rows -->
   ${expenseRowsXml}

   <!-- Totals Row -->
   <Row ss:Index="${totalsRow}" ss:Height="20">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">Total Cash Advance</Data></Cell>
    <Cell ss:StyleID="TotalAmountCell" ss:Formula="${totalAdvanceFormula}"><Data ss:Type="Number">${amountAdvanced}</Data></Cell>
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">Total Actual Expense</Data></Cell>
    <Cell ss:StyleID="Default"/>
    <Cell ss:StyleID="TotalAmountCell" ss:Formula="${totalActualFormula}"><Data ss:Type="Number">${report.totalActualSpent || 0}</Data></Cell>
    <Cell ss:StyleID="TotalAmountCell" ss:Formula="${varianceFormula}"><Data ss:Type="Number">${(report.surplusOrDeficit || 0)}</Data></Cell>
    <Cell ss:StyleID="Default"/>
   </Row>

   <!-- Summary & Balance Note Block -->
   <Row ss:Index="${noteHeaderRow}">
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Note: </Data></Cell>
    <Cell ss:MergeAcross="5" ss:StyleID="Default"/>
   </Row>

   <Row ss:Index="${amountAdvancedRow}">
    <Cell ss:StyleID="BalanceSummaryLabel"><Data ss:Type="String">             Amount Advanced:</Data></Cell>
    <Cell ss:StyleID="CurrencyCell" ss:Formula="=R${totalsRow}C2"><Data ss:Type="Number">${amountAdvanced}</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="Default"/>
   </Row>

   <Row ss:Index="${actualExpenseSummaryRow}">
    <Cell ss:StyleID="BalanceSummaryLabel"><Data ss:Type="String">          Total Actual Expense</Data></Cell>
    <Cell ss:StyleID="CurrencyCell" ss:Formula="=R${totalsRow}C5"><Data ss:Type="Number">${report.totalActualSpent || 0}</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="Default"/>
   </Row>

   <Row ss:Index="${balanceRow}" ss:Height="20">
    <Cell ss:StyleID="BalanceSummaryLabel"><Data ss:Type="String">          Balance: </Data></Cell>
    <Cell ss:StyleID="BalanceSummaryValue" ss:Formula="=R${amountAdvancedRow}C2-R${actualExpenseSummaryRow}C2"><Data ss:Type="Number">${(report.surplusOrDeficit || 0)}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">OR NO: ${escapeXml(orNumber)}</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="Default"/>
   </Row>

   <!-- Dynamic Signatures Block -->
   ${signaturesXml}

  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup>
    <Layout x:Orientation="Portrait"/>
    <Header x:Margin="0.3"/>
    <Footer x:Margin="0.3"/>
    <PageMargins x:Bottom="0.75" x:Left="0.7" x:Right="0.7" x:Top="0.75"/>
   </PageSetup>
   <Print>
    <ValidPrinterInfo/>
    <PaperSizeIndex>9</PaperSizeIndex>
    <HorizontalResolution>600</HorizontalResolution>
    <VerticalResolution>600</VerticalResolution>
   </Print>
   <Selected/>
   <Panes>
    <Pane>
     <Number>3</Number>
     <ActiveRow>10</ActiveRow>
     <ActiveCol>2</ActiveCol>
    </Pane>
   </Panes>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

  // Trigger browser download
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const cleanFilename = eventTitle.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 35);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${cleanFilename}_Official_STI_Liquidation.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
