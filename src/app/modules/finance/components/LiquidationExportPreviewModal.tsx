import { useState, useMemo } from 'react';
import { X, FileSpreadsheet, Check, Printer, Layers, Eye, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { LiquidationDocument } from '../types/liquidation.types';

interface LiquidationExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: LiquidationDocument | null;
}

interface ColumnConfig {
  key: string;
  label: string;
  enabled: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'itemIndex', label: '#', enabled: true },
  { key: 'description', label: 'Item Description', enabled: true },
  { key: 'category', label: 'Expense Category', enabled: true },
  { key: 'allocatedCost', label: 'Allocated Budget (₱)', enabled: true },
  { key: 'totalCost', label: 'Actual Cost (₱)', enabled: true },
  { key: 'variance', label: 'Variance (₱)', enabled: true },
  { key: 'vendorName', label: 'Vendor Name', enabled: true },
  { key: 'receiptNumber', label: 'Receipt / Invoice #', enabled: true },
  { key: 'hasReceiptImage', label: 'Receipt Image', enabled: true },
];

export function LiquidationExportPreviewModal({
  isOpen,
  onClose,
  report,
}: LiquidationExportPreviewModalProps) {
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [previewSearch, setPreviewSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Filter line items locally if search query typed inside modal
  const displayItems = useMemo(() => {
    if (!report || !report.lineItems) return [];
    if (!previewSearch.trim()) return report.lineItems;
    const q = previewSearch.toLowerCase();
    return report.lineItems.filter(item =>
      (item.description || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.vendorName || '').toLowerCase().includes(q) ||
      (item.receiptNumber || '').toLowerCase().includes(q)
    );
  }, [report, previewSearch]);

  if (!isOpen || !report) return null;

  const toggleColumn = (key: string) => {
    setColumns(prev => prev.map(col => col.key === key ? { ...col, enabled: !col.enabled } : col));
  };

  const enabledColumns = columns.filter(c => c.enabled);

  const isDeficit = (report.surplusOrDeficit || 0) < 0;
  const varianceAmount = Math.abs(report.surplusOrDeficit || 0);

  const getItemValue = (item: any, idx: number, key: string): string => {
    const allocated = item.allocatedCost ?? 0;
    const variance = allocated > 0 ? allocated - item.totalCost : 0;

    switch (key) {
      case 'itemIndex': return (idx + 1).toString();
      case 'description': return item.description || '—';
      case 'category': return item.category || '—';
      case 'allocatedCost': return allocated > 0 ? `₱${allocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';
      case 'totalCost': return `₱${(item.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      case 'variance':
        if (allocated === 0) return '—';
        return variance < 0 ? `-₱${Math.abs(variance).toLocaleString('en-US', { minimumFractionDigits: 2 })} (Deficit)` : `+₱${variance.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Surplus)`;
      case 'vendorName': return item.vendorName || '—';
      case 'receiptNumber': return item.receiptNumber || '—';
      case 'hasReceiptImage': return item.receiptUrl ? 'Attached' : 'None';
      default: return '';
    }
  };

  const sanitizeFileName = (name: string) => {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
  };

  const escapeXml = (unsafe: string) => {
    return unsafe.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  };

  const exportToExcelXML = () => {
    setIsExporting(true);
    try {
      const now = new Date().toLocaleString();
      const filename = `${sanitizeFileName(report.eventTitle)}_Financial_Liquidation.xls`;

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="TitleStyle">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#001A4D"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="SubTitleStyle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#555555"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#83358E" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="RowEven">
   <Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="RowOdd">
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TotalStyle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#001A4D"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Liquidation Report">
  <Table>
   <Column ss:Width="40"/>
   <Column ss:Width="200"/>
   <Column ss:Width="140"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="130"/>
   <Column ss:Width="140"/>
   <Column ss:Width="120"/>
   <Column ss:Width="90"/>
   <Row ss:Height="26">
    <Cell ss:MergeAcross="${Math.max(0, enabledColumns.length - 1)}" ss:StyleID="TitleStyle"><Data ss:Type="String">STI Sync — Approved Financial Liquidation Report</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="${Math.max(0, enabledColumns.length - 1)}" ss:StyleID="SubTitleStyle"><Data ss:Type="String">Event: ${report.eventTitle} | Organization: ${report.organizationName} | Submitted By: ${report.createdByName}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="${Math.max(0, enabledColumns.length - 1)}" ss:StyleID="SubTitleStyle"><Data ss:Type="String">Approved Budget: ₱${report.allocatedBudget.toLocaleString()} | Actual Spend: ₱${report.totalActualSpending.toLocaleString()} | Net Variance: ${isDeficit ? `-₱${varianceAmount.toLocaleString()} (Deficit)` : `+₱${varianceAmount.toLocaleString()} (Surplus)`} | Exported: ${now}</Data></Cell>
   </Row>
   <Row ss:Height="10"></Row>
   <Row ss:Height="24">`;

      enabledColumns.forEach(col => {
        xml += `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${col.label}</Data></Cell>`;
      });
      xml += `</Row>`;

      report.lineItems.forEach((item, idx) => {
        const rowStyle = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
        xml += `<Row ss:Height="20">`;
        enabledColumns.forEach(col => {
          const val = getItemValue(item, idx, col.key);
          xml += `<Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`;
        });
        xml += `</Row>`;
      });

      // Total Row
      xml += `<Row ss:Height="24">`;
      enabledColumns.forEach(col => {
        let val = '';
        if (col.key === 'itemIndex') val = 'Total';
        else if (col.key === 'description') val = 'TOTAL SUMMARY';
        else if (col.key === 'allocatedCost') val = `₱${report.allocatedBudget.toLocaleString()}`;
        else if (col.key === 'totalCost') val = `₱${report.totalActualSpending.toLocaleString()}`;
        else if (col.key === 'variance') val = isDeficit ? `-₱${varianceAmount.toLocaleString()}` : `+₱${varianceAmount.toLocaleString()}`;
        xml += `<Cell ss:StyleID="TotalStyle"><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`;
      });
      xml += `</Row>`;

      xml += `  </Table>
 </Worksheet>
</Workbook>`;

      const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Liquidation Excel Exported!', {
        description: `Exported ${report.lineItems.length} items to ${filename}`,
      });
      onClose();
    } catch (err) {
      console.error('Failed to export liquidation Excel XML', err);
      toast.error('Failed to generate Excel file.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-5xl h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between flex-shrink-0 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#83358E] rounded-xl flex items-center justify-center text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Export Liquidation Report — Interactive Excel Preview</h3>
              <p className="text-xs text-white/70">Inspect financial line items, select export columns, and preview before downloading.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info & Financial Summary Banner */}
        <div className="bg-purple-50 border-b border-purple-100 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-[#001A4D]">{report.eventTitle}</h4>
              <span className="px-2.5 py-0.5 bg-green-100 text-green-800 rounded-full text-[10px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Approved
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Host: <strong>{report.organizationName}</strong> • Submitted by: <strong>{report.createdByName}</strong>
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="bg-white px-3 py-1.5 rounded-lg border border-purple-200">
              <span className="text-gray-500 block text-[10px] uppercase font-bold">Approved Budget</span>
              <span className="font-bold text-[#001A4D] text-sm">₱{report.allocatedBudget.toLocaleString()}</span>
            </div>
            <div className="bg-white px-3 py-1.5 rounded-lg border border-purple-200">
              <span className="text-gray-500 block text-[10px] uppercase font-bold">Actual Spending</span>
              <span className="font-bold text-[#83358E] text-sm">₱{report.totalActualSpending.toLocaleString()}</span>
            </div>
            <div className="bg-white px-3 py-1.5 rounded-lg border border-purple-200">
              <span className="text-gray-500 block text-[10px] uppercase font-bold">{isDeficit ? 'Net Deficit' : 'Net Surplus'}</span>
              <span className={`font-bold text-sm ${isDeficit ? 'text-red-600' : 'text-green-600'}`}>
                {isDeficit ? `-₱${varianceAmount.toLocaleString()}` : `+₱${varianceAmount.toLocaleString()}`}
              </span>
            </div>
          </div>
        </div>

        {/* Column Configurator & Preview Search */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#83358E]" />
            <span className="text-xs font-bold text-[#001A4D]">Included Columns:</span>
            <span className="text-xs text-gray-500 font-mono">({enabledColumns.length}/{columns.length})</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {columns.map((col) => (
              <button
                key={col.key}
                onClick={() => toggleColumn(col.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                  col.enabled
                    ? 'bg-[#83358E] text-white border-[#83358E]'
                    : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                }`}
              >
                {col.enabled && <Check className="w-3 h-3 text-white" />}
                <span>{col.label}</span>
              </button>
            ))}
          </div>

          <div className="relative w-48">
            <input
              type="text"
              placeholder="Search line items..."
              value={previewSearch}
              onChange={e => setPreviewSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1 bg-white border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-[#83358E] outline-none"
            />
            <Eye className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Interactive Excel Sheet Live Preview */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100/60">
          <div className="bg-white border border-gray-300 rounded-xl shadow-md overflow-hidden font-sans">
            <div className="bg-[#001A4D] text-white p-4 border-b border-gray-300 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-base text-white">Financial Liquidation Ledger Sheet</h4>
                <p className="text-xs text-white/80">{report.eventTitle} — {report.organizationName}</p>
              </div>
              <div className="text-right text-xs text-white/70 font-mono">
                {displayItems.length} line items visible
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#83358E] text-white font-bold divide-x divide-[#6D2A78]">
                    {enabledColumns.map(col => (
                      <th key={col.key} className="px-3 py-2.5 uppercase tracking-wider text-[11px] whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white font-mono text-[12px]">
                  {displayItems.length === 0 ? (
                    <tr>
                      <td colSpan={enabledColumns.length} className="py-12 text-center text-gray-400 font-sans">
                        No expense line items found.
                      </td>
                    </tr>
                  ) : (
                    displayItems.map((item, idx) => (
                      <tr key={item.id || idx} className={`hover:bg-purple-50/50 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/70' : 'bg-white'}`}>
                        {enabledColumns.map(col => {
                          const val = getItemValue(item, idx, col.key);
                          const isAllocated = col.key === 'allocatedCost';
                          const isActual = col.key === 'totalCost';
                          const isVariance = col.key === 'variance';

                          return (
                            <td key={col.key} className="px-3 py-2 whitespace-nowrap text-gray-800">
                              {isActual ? (
                                <span className="font-bold text-[#83358E]">{val}</span>
                              ) : isAllocated ? (
                                <span className="font-semibold text-gray-700">{val}</span>
                              ) : isVariance ? (
                                <span className={`font-bold ${val.includes('Deficit') ? 'text-red-600' : val.includes('Surplus') ? 'text-green-600' : 'text-gray-500'}`}>
                                  {val}
                                </span>
                              ) : (
                                <span>{val}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
                {/* Total Summary Footer Row */}
                <tfoot className="bg-amber-50 border-t-2 border-amber-300 font-mono font-bold text-xs">
                  <tr>
                    {enabledColumns.map(col => {
                      let val = '';
                      if (col.key === 'itemIndex') val = 'Total';
                      else if (col.key === 'description') val = 'SUMMARY TOTALS';
                      else if (col.key === 'allocatedCost') val = `₱${report.allocatedBudget.toLocaleString()}`;
                      else if (col.key === 'totalCost') val = `₱${report.totalActualSpending.toLocaleString()}`;
                      else if (col.key === 'variance') val = isDeficit ? `-₱${varianceAmount.toLocaleString()}` : `+₱${varianceAmount.toLocaleString()}`;

                      return (
                        <td key={col.key} className="px-3 py-2.5 text-[#001A4D]">
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span>Ready to generate formatted Excel spreadsheet with <strong>{report.lineItems.length}</strong> expense items.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              disabled={isExporting}
              className="px-4 py-2.5 border border-[#001A4D] text-[#001A4D] rounded-xl text-sm font-bold hover:bg-[#001A4D]/5 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              onClick={exportToExcelXML}
              disabled={isExporting || report.lineItems.length === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-[#83358E] to-[#001A4D] text-white rounded-xl text-sm font-bold hover:from-[#6D2A78] hover:to-[#00143D] disabled:opacity-50 transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#FFC107]" />
              {isExporting ? 'Generating Excel File...' : 'Download Excel (.xlsx)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
