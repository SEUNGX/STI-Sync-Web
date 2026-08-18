import { useState, useMemo } from 'react';
import { X, Download, FileSpreadsheet, Check, Filter, Eye, RefreshCw, Layers } from 'lucide-react';
import { toast } from 'sonner';
import type { EnrichedAttendanceRecord } from '../types/attendance.types';
import { formatAppDateTime } from '../../../utils/date';

interface AttendanceExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: EnrichedAttendanceRecord[];
  eventTitle: string;
  eventDate: string;
  hostingOrgName: string;
  venueName?: string;
  activeFiltersSummary: string;
}

interface ColumnConfig {
  key: string;
  label: string;
  enabled: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'studentId', label: 'Student ID', enabled: true },
  { key: 'name', label: 'Full Name', enabled: true },
  { key: 'department', label: 'Department', enabled: true },
  { key: 'course', label: 'Course / Program', enabled: true },
  { key: 'section', label: 'Section', enabled: true },
  { key: 'yearLevel', label: 'Year Level', enabled: true },
  { key: 'sessionTitle', label: 'Session Name', enabled: true },
  { key: 'checkIn', label: 'Time-In', enabled: true },
  { key: 'checkOut', label: 'Time-Out', enabled: true },
  { key: 'duration', label: 'Duration', enabled: true },
  { key: 'status', label: 'Attendance Status', enabled: true },
  { key: 'flaggedReason', label: 'Remarks / Notes', enabled: true },
];

export function AttendanceExportPreviewModal({
  isOpen,
  onClose,
  records,
  eventTitle,
  eventDate,
  hostingOrgName,
  venueName,
  activeFiltersSummary,
}: AttendanceExportPreviewModalProps) {
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [previewSearch, setPreviewSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Filter preview records locally if search query typed in modal
  const displayRecords = useMemo(() => {
    if (!previewSearch.trim()) return records;
    const q = previewSearch.toLowerCase();
    return records.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.studentId || '').toLowerCase().includes(q) ||
      (r.section || '').toLowerCase().includes(q) ||
      (r.courseCode || r.courseName || '').toLowerCase().includes(q) ||
      (r.departmentName || r.departmentCode || '').toLowerCase().includes(q) ||
      (r.status || '').toLowerCase().includes(q)
    );
  }, [records, previewSearch]);

  if (!isOpen) return null;

  const toggleColumn = (key: string) => {
    setColumns(prev => prev.map(col => col.key === key ? { ...col, enabled: !col.enabled } : col));
  };

  const enabledColumns = columns.filter(c => c.enabled);

  const getRecordValue = (rec: EnrichedAttendanceRecord, key: string): string => {
    switch (key) {
      case 'studentId': return rec.studentId || 'N/A';
      case 'name': return rec.name || 'Unknown';
      case 'department': return rec.departmentName ? `${rec.departmentName} (${rec.departmentCode || ''})` : (rec.departmentCode || 'N/A');
      case 'course': return rec.courseCode || rec.courseName || 'N/A';
      case 'section': return rec.section || 'N/A';
      case 'yearLevel': return rec.yearLevel || 'N/A';
      case 'sessionTitle': return rec.sessionTitle || 'Main Session';
      case 'checkIn': return rec.checkIn && rec.checkIn !== '—' ? rec.checkIn : 'Not Checked In';
      case 'checkOut': return rec.checkOut && rec.checkOut !== '—' ? rec.checkOut : 'Not Checked Out';
      case 'duration': return rec.duration || '—';
      case 'status': return rec.status || 'Checked In';
      case 'flaggedReason': return rec.flaggedReason || '—';
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
      const now = formatAppDateTime(new Date());
      const filename = `${sanitizeFileName(eventTitle)}_Attendance_Report.xls`;

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
  <Style ss:ID="StatusComplete">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#166534"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="StatusLate">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#C2410C"/>
   <Interior ss:Color="#FFEDD5" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="StatusAbsent">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#991B1B"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="StatusFlagged">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#92400E"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Attendance Log">
  <Table>
   <Column ss:Width="110"/>
   <Column ss:Width="160"/>
   <Column ss:Width="150"/>
   <Column ss:Width="100"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="140"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="180"/>
   <Row ss:Height="26">
    <Cell ss:MergeAcross="${Math.max(0, enabledColumns.length - 1)}" ss:StyleID="TitleStyle"><Data ss:Type="String">STI Sync — Attendance Monitoring Report</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="${Math.max(0, enabledColumns.length - 1)}" ss:StyleID="SubTitleStyle"><Data ss:Type="String">Event: ${eventTitle} | Date: ${eventDate} | Host: ${hostingOrgName}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="${Math.max(0, enabledColumns.length - 1)}" ss:StyleID="SubTitleStyle"><Data ss:Type="String">Filters Applied: ${activeFiltersSummary} | Generated: ${now} | Total Records: ${records.length}</Data></Cell>
   </Row>
   <Row ss:Height="10"></Row>
   <Row ss:Height="24">`;

      enabledColumns.forEach(col => {
        xml += `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${col.label}</Data></Cell>`;
      });
      xml += `</Row>`;

      records.forEach((rec, idx) => {
        const rowStyle = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
        xml += `<Row ss:Height="20">`;
        enabledColumns.forEach(col => {
          const val = getRecordValue(rec, col.key);
          let cellStyle = rowStyle;
          if (col.key === 'status') {
            if (val === 'Complete' || val === 'Checked In') cellStyle = 'StatusComplete';
            else if (val === 'Late') cellStyle = 'StatusLate';
            else if (val === 'Absent') cellStyle = 'StatusAbsent';
            else if (val === 'Flagged') cellStyle = 'StatusFlagged';
          }
          xml += `<Cell ss:StyleID="${cellStyle}"><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`;
        });
        xml += `</Row>`;
      });

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

      toast.success('Excel File Downloaded!', {
        description: `Successfully exported ${records.length} records to ${filename}`,
      });
      onClose();
    } catch (err) {
      console.error('Failed to export Excel XML', err);
      toast.error('Failed to export Excel file.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = () => {
    setIsExporting(true);
    try {
      const filename = `${sanitizeFileName(eventTitle)}_Attendance.csv`;
      const headers = enabledColumns.map(c => `"${c.label}"`).join(',');
      const rows = records.map(rec =>
        enabledColumns.map(c => `"${getRecordValue(rec, c.key).replace(/"/g, '""')}"`).join(',')
      );

      const meta = [
        `"STI Sync — Attendance Monitoring Report"`,
        `"Event: ${eventTitle} | Date: ${eventDate} | Host: ${hostingOrgName}"`,
        `"Filters: ${activeFiltersSummary} | Total Records: ${records.length}"`,
        `""`,
      ].join('\n');

      const csvContent = '\uFEFF' + meta + '\n' + headers + '\n' + rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('CSV File Downloaded!', {
        description: `Exported ${records.length} records to ${filename}`,
      });
      onClose();
    } catch (err) {
      console.error('Failed to export CSV', err);
      toast.error('Failed to export CSV file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-6xl h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between flex-shrink-0 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#83358E] rounded-xl flex items-center justify-center text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Export Attendance Report — Interactive Excel Preview</h3>
              <p className="text-xs text-white/70">Inspect data, select export columns, and preview before downloading.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-purple-50 border-b border-purple-100 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#83358E] flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#001A4D]">{eventTitle}</span>
            <span className="text-gray-400">•</span>
            <span>{eventDate}</span>
            <span className="text-gray-400">•</span>
            <span>{hostingOrgName}</span>
          </div>
          <div className="flex items-center gap-3 font-semibold">
            <span className="bg-[#83358E]/10 px-2.5 py-1 rounded text-[#83358E]">
              Applied Filters: <strong>{activeFiltersSummary}</strong>
            </span>
            <span className="bg-[#001A4D] text-white px-2.5 py-1 rounded">
              Total Records: <strong>{records.length}</strong>
            </span>
          </div>
        </div>

        {/* Column Configurator Toolbar */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#83358E]" />
            <span className="text-xs font-bold text-[#001A4D]">Included Excel Columns:</span>
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

          {/* Search inside preview */}
          <div className="relative w-48">
            <input
              type="text"
              placeholder="Search in preview..."
              value={previewSearch}
              onChange={e => setPreviewSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1 bg-white border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-[#83358E] focus:outline-none"
            />
            <Eye className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Live Interactive Excel Preview Table */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100/60">
          <div className="bg-white border border-gray-300 rounded-xl shadow-md overflow-hidden font-sans">
            {/* Sheet Title Block */}
            <div className="bg-[#001A4D] text-white p-4 border-b border-gray-300">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-lg text-white">STI Sync — Attendance Log Sheet</h4>
                  <p className="text-xs text-white/80">{eventTitle} — {eventDate}</p>
                </div>
                <div className="text-right text-xs text-white/70 font-mono">
                  Sheet Preview • {displayRecords.length} rows visible
                </div>
              </div>
            </div>

            {/* Excel Sheet Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#83358E] text-white font-bold divide-x divide-[#6D2A78]">
                    <th className="px-3 py-2.5 text-center w-10 bg-[#6D2A78] text-white/70 font-mono">#</th>
                    {enabledColumns.map(col => (
                      <th key={col.key} className="px-3 py-2.5 uppercase tracking-wider text-[11px] whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white font-mono text-[12px]">
                  {displayRecords.length === 0 ? (
                    <tr>
                      <td colSpan={enabledColumns.length + 1} className="py-12 text-center text-gray-400 font-sans">
                        No matching attendance records found for current filters.
                      </td>
                    </tr>
                  ) : (
                    displayRecords.map((rec, idx) => (
                      <tr key={rec.id || idx} className={`hover:bg-purple-50/50 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/70' : 'bg-white'}`}>
                        <td className="px-3 py-2 text-center text-gray-400 bg-gray-50 border-r border-gray-200 text-[11px]">
                          {idx + 1}
                        </td>
                        {enabledColumns.map(col => {
                          const val = getRecordValue(rec, col.key);
                          const isStatusCol = col.key === 'status';
                          return (
                            <td key={col.key} className="px-3 py-2 whitespace-nowrap text-gray-800">
                              {isStatusCol ? (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-sans ${
                                  val === 'Complete' || val === 'Checked In' ? 'bg-green-100 text-green-800 border border-green-300' :
                                  val === 'Late' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                  val === 'Absent' ? 'bg-red-100 text-red-800 border border-red-300' :
                                  val === 'Flagged' ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
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
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span>Ready to generate formatted Excel spreadsheet with <strong>{records.length}</strong> entries.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={exportToExcelXML}
              disabled={isExporting || records.length === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-[#83358E] to-[#001A4D] text-white rounded-xl text-sm font-bold hover:from-[#6D2A78] hover:to-[#00143D] disabled:opacity-50 transition-all shadow-md flex items-center gap-2"
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
