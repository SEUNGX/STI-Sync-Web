import { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  FileText,
  Download,
  Users,
  CalendarCheck,
  Receipt,
  Award,
  Wallet,
  CheckCircle2,
  Printer,
  ChevronRight,
  X,
  Sparkles,
  TrendingUp,
  CreditCard,
  Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { TablePagination } from '../../components/common/TablePagination';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useAllEvents } from '../../modules/events/hooks/useEventStream';
import { useAllLiquidations } from '../../modules/finance/hooks/useLiquidationStream';
import { useOrgPayables } from '../../modules/finance/hooks/usePayableStream';
import { useStudents } from '../../modules/students/hooks/useStudentStream';
import { useActiveAcademicPeriods } from '../../modules/academic/hooks/useAcademicStream';
import {
  GeneratedReportData,
  OfficerReportId,
  ReportFilterOptions,
} from '../../modules/reports/types/report.types';
import {
  generateOfficerAccomplishmentReport,
  generateOfficerFinancialStatement,
  generateOfficerAttendanceRoster,
  generateOfficerMembershipDirectory,
  generateOfficerDuesTrackingReport,
} from '../../modules/reports/services/report-generator.service';
import { exportReportToPDF } from '../../modules/reports/utils/pdf-report-builder';
import { exportReportToCSV } from '../../modules/reports/utils/csv-report-builder';

const COLORS = ['#001A4D', '#0E4EBD', '#22C55E', '#FFD41C', '#8B5CF6'];

export default function OfficerReportsPage() {
  const { profile } = useOfficerProfile();
  const { data: orgs = [] } = useOrganizationStream();
  const { events = [] } = useAllEvents();
  const { liquidations = [] } = useAllLiquidations();
  const { data: students = [] } = useStudents();
  const { activeCollegePeriod, activeShsPeriod } = useActiveAcademicPeriods();

  const [previewReport, setPreviewReport] = useState<GeneratedReportData | null>(null);
  const [reportPage, setReportPage] = useState(1);
  const REPORT_PER_PAGE = 8;

  useEffect(() => {
    setReportPage(1);
  }, [previewReport]);

  const totalReportPages = Math.max(1, Math.ceil((previewReport?.rows.length || 0) / REPORT_PER_PAGE));
  const paginatedReportRows = useMemo(() => {
    if (!previewReport) return [];
    const start = (reportPage - 1) * REPORT_PER_PAGE;
    return previewReport.rows.slice(start, start + REPORT_PER_PAGE);
  }, [previewReport, reportPage]);

  // Active Organization
  const activeOrg = useMemo(() => {
    return (
      orgs.find((o) => o.id === profile?.activeOrganizationId) ||
      orgs.find((o) => (profile?.assignedOrganizations || []).includes(o.id)) ||
      orgs[0]
    );
  }, [orgs, profile]);

  const { data: payables = [] } = useOrgPayables(activeOrg?.id || null);

  const activePeriod =
    activeOrg?.academicLevel === 'SHS' ? activeShsPeriod : activeCollegePeriod || activeShsPeriod;

  const filterOptions: ReportFilterOptions = useMemo(
    () => ({
      scope: (activeOrg?.academicLevel as any) || 'ALL',
      organizationId: activeOrg?.id,
      academicYear: activePeriod?.academicYear,
      semester: activePeriod?.semester,
    }),
    [activeOrg, activePeriod]
  );

  // Filtered metrics for this specific organization
  const orgEvents = useMemo(() => events.filter((e) => e.organizationId === activeOrg?.id), [events, activeOrg]);
  const orgLiquidations = useMemo(() => liquidations.filter((l) => l.organizationId === activeOrg?.id), [liquidations, activeOrg]);
  const orgPayables = useMemo(() => payables.filter((p) => p.organizationId === activeOrg?.id), [payables, activeOrg]);

  // Financial calculations
  const allocatedBudget = activeOrg?.budget || activeOrg?.allocatedBudget || 0;
  const totalDuesCollected = orgPayables
    .filter((p) => (p.status === 'paid' || p.paymentStatus === 'PAID') && p.type === 'dues')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalEventFeesCollected = orgPayables
    .filter((p) => (p.status === 'paid' || p.paymentStatus === 'PAID') && p.type === 'event_fee')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalInflows = allocatedBudget + totalDuesCollected + totalEventFeesCollected;

  const totalLiquidated = orgLiquidations
    .filter((l) => l.status === 'APPROVED')
    .reduce((sum, l) => sum + (l.totalAmount || l.actualExpenses || 0), 0);

  const netCashBalance = totalInflows - totalLiquidated;

  // Event attendance chart
  const eventAttendanceData = useMemo(() => {
    return orgEvents.map((e) => ({
      name: e.title.length > 14 ? e.title.slice(0, 12) + '…' : e.title,
      expected: e.expectedAttendees || 0,
      actual: e.actualAttendees || e.attendeesCount || 0,
    }));
  }, [orgEvents]);

  // Financial breakdown pie
  const financePieData = useMemo(() => {
    return [
      { name: 'Allocated Budget', value: allocatedBudget, color: '#001A4D' },
      { name: 'Dues Collected', value: totalDuesCollected, color: '#0E4EBD' },
      { name: 'Event Fees', value: totalEventFeesCollected, color: '#22C55E' },
    ].filter((item) => item.value > 0);
  }, [allocatedBudget, totalDuesCollected, totalEventFeesCollected]);

  // ── Open Official Reports ──────────────────────────────────────────────────
  const handleOpenReport = (id: OfficerReportId) => {
    if (!activeOrg) return;
    const officerName = profile?.displayName || profile?.name || 'Officer';
    const presidentName = activeOrg.presidentName || 'Club President';
    const adviserName = activeOrg.adviserName || 'Faculty Adviser';

    let rep: GeneratedReportData;
    switch (id) {
      case 'OFFICER_SEMESTRAL_ACCOMPLISHMENT':
        rep = generateOfficerAccomplishmentReport(
          activeOrg,
          events,
          filterOptions,
          officerName,
          presidentName,
          adviserName
        );
        break;
      case 'OFFICER_FINANCIAL_STATEMENT':
        rep = generateOfficerFinancialStatement(
          activeOrg,
          liquidations,
          payables,
          filterOptions,
          officerName,
          presidentName,
          adviserName
        );
        break;
      case 'OFFICER_EVENT_ATTENDANCE_ROSTER':
        rep = generateOfficerAttendanceRoster(
          activeOrg,
          events,
          students,
          filterOptions,
          officerName,
          presidentName,
          adviserName
        );
        break;
      case 'OFFICER_MEMBERSHIP_DIRECTORY':
        rep = generateOfficerMembershipDirectory(
          activeOrg,
          students,
          filterOptions,
          officerName,
          presidentName,
          adviserName
        );
        break;
      case 'OFFICER_DUES_PAYABLES_TRACKING':
        rep = generateOfficerDuesTrackingReport(
          activeOrg,
          payables,
          filterOptions,
          officerName,
          presidentName,
          adviserName
        );
        break;
    }
    setPreviewReport(rep);
  };

  return (
    <div className="space-y-6 text-left">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#0E4EBD]" />
            <h2 className="text-2xl font-bold text-[#001A4D]">Organization Reports & Analytics</h2>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            Generate formal semestral reports, financial statements, and attendance records for SAO submission.
          </p>
        </div>

        {/* Active Organization Badge */}
        {activeOrg && (
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl text-[#001A4D]">
            <Building2 className="w-4 h-4 text-[#0E4EBD]" />
            <div>
              <span className="text-[10px] text-gray-500 font-bold block uppercase tracking-wider">Active Organization</span>
              <span className="text-xs font-bold">{activeOrg.name}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Organization Operational KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-[#E0E0E0] shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-[#0E4EBD] flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Total Members</p>
              <h3 className="text-2xl font-bold text-[#001A4D]">
                {activeOrg?.memberCount || activeOrg?.totalMembers || 0}
              </h3>
              <p className="text-[11px] text-gray-400">Registered in Directory</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E0E0E0] shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-green-600 flex-shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Activities Hosted</p>
              <h3 className="text-2xl font-bold text-[#001A4D]">{orgEvents.length}</h3>
              <p className="text-[11px] text-green-600 font-medium">
                {orgEvents.reduce((s, e) => s + (e.actualAttendees || e.attendeesCount || 0), 0)} Check-ins
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E0E0E0] shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Ending Cash Balance</p>
              <h3 className="text-2xl font-bold text-[#001A4D]">₱{netCashBalance.toLocaleString()}</h3>
              <p className="text-[11px] text-purple-600 font-medium">Net Cash on Hand</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E0E0E0] shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Liquidated Funds</p>
              <h3 className="text-2xl font-bold text-[#001A4D]">₱{totalLiquidated.toLocaleString()}</h3>
              <p className="text-[11px] text-amber-600 font-medium">{orgLiquidations.length} Claims Filed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── The 5 Official Organization Reports ── */}
      <div>
        <div className="mb-3">
          <h3 className="text-lg font-bold text-[#001A4D]">Official Organization Reports for SAO Submission</h3>
          <p className="text-xs text-gray-500">
            Generate printable reports with automated sign-off signatures for your President and Adviser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              id: 'OFFICER_SEMESTRAL_ACCOMPLISHMENT' as OfficerReportId,
              title: 'Semestral Accomplishment Report',
              desc: 'Official end-of-term summary of all conducted events, objectives, and participation.',
              icon: Award,
              color: 'text-[#0E4EBD]',
              bg: 'bg-blue-50',
            },
            {
              id: 'OFFICER_FINANCIAL_STATEMENT' as OfficerReportId,
              title: 'Financial Statement & Cash Flow',
              desc: 'Ledger of all revenues, allocated grants, dues, liquidated expenses, and ending balance.',
              icon: Wallet,
              color: 'text-purple-600',
              bg: 'bg-purple-50',
            },
            {
              id: 'OFFICER_EVENT_ATTENDANCE_ROSTER' as OfficerReportId,
              title: 'Event Attendance & Participant Log',
              desc: 'Verified attendee roll sheet with Time-In and Time-Out timestamps.',
              icon: CalendarCheck,
              color: 'text-green-600',
              bg: 'bg-green-50',
            },
            {
              id: 'OFFICER_MEMBERSHIP_DIRECTORY' as OfficerReportId,
              title: 'Official Membership Directory',
              desc: 'Complete roster of registered active student members and appointed officers.',
              icon: Users,
              color: 'text-cyan-700',
              bg: 'bg-cyan-50',
            },
            {
              id: 'OFFICER_DUES_PAYABLES_TRACKING' as OfficerReportId,
              title: 'Member Dues & Payables Tracking',
              desc: 'Detailed tracking of settled membership dues and outstanding delinquent balances.',
              icon: TrendingUp,
              color: 'text-amber-600',
              bg: 'bg-amber-50',
            },
          ].map((rep) => {
            const Icon = rep.icon;
            return (
              <Card
                key={rep.id}
                onClick={() => handleOpenReport(rep.id)}
                className="border-gray-200 hover:border-[#0E4EBD] hover:shadow-md transition-all cursor-pointer group rounded-2xl flex flex-col justify-between"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${rep.bg} flex items-center justify-center ${rep.color} group-hover:scale-105 transition-transform`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 uppercase">
                      SAO Ready
                    </span>
                  </div>
                  <h4 className="font-bold text-[#001A4D] text-sm group-hover:text-[#0E4EBD] transition-colors line-clamp-1">
                    {rep.title}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                    {rep.desc}
                  </p>
                </CardContent>

                <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-100 rounded-b-2xl flex items-center justify-between text-xs font-bold text-[#0E4EBD] group-hover:bg-blue-50/50 transition-colors">
                  <span>Generate Report</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Organization Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Turnout Chart */}
        <Card className="border-[#E0E0E0] rounded-2xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-[#001A4D]">Event Participation & Turnout</CardTitle>
          </CardHeader>
          <CardContent>
            {eventAttendanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={eventAttendanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="expected" fill="#001A4D" name="Expected" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" fill="#22C55E" name="Attended" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-14 text-gray-400 text-xs">No event data hosted yet for this organization.</div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Breakdown */}
        <Card className="border-[#E0E0E0] rounded-2xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-[#001A4D]">Revenue & Inflows Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {financePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={financePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {financePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => `₱${val.toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-14 text-gray-400 text-xs">No financial inflow data recorded yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Interactive Report Preview Modal ── */}
      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between text-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#FFD41C]" />
                <div>
                  <h3 className="font-bold text-base">{previewReport.title}</h3>
                  <p className="text-xs text-white/70">
                    Organization: {previewReport.metadata.organizationName || 'Student Club'} ·{' '}
                    {previewReport.metadata.academicYear || 'A.Y. 2026-2027'} {previewReport.metadata.semester || ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewReport(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Executive Summary Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {previewReport.kpis.map((kpi, i) => (
                  <div key={i} className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-left">
                    <p className="text-[11px] text-gray-500 font-semibold uppercase">{kpi.label}</p>
                    <p className="text-lg font-bold text-[#001A4D] mt-0.5">{kpi.value}</p>
                  </div>
                ))}
              </div>

              {/* Data Table Preview */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#001A4D] text-white font-bold sticky top-0 uppercase tracking-wider">
                      <tr>
                        {previewReport.columns.map((c) => (
                          <th key={c.key} className="px-4 py-3 whitespace-nowrap">
                            {c.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedReportRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/40">
                          {previewReport.columns.map((c) => (
                            <td key={c.key} className="px-4 py-2.5 whitespace-nowrap text-gray-700">
                              {String(row[c.key] || '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {previewReport.rows.length === 0 && (
                        <tr>
                          <td colSpan={previewReport.columns.length} className="text-center py-10 text-gray-400">
                            No records found for this organization.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ── Standard Bottom Pagination Bar ── */}
                <TablePagination
                  currentPage={reportPage}
                  totalPages={totalReportPages}
                  totalItems={previewReport.rows.length}
                  itemsPerPage={REPORT_PER_PAGE}
                  onPageChange={setReportPage}
                  itemName="records"
                />
              </div>

              {/* Official Signatories Block Preview */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100 text-xs">
                <div>
                  <span className="text-gray-400 block text-[11px]">Prepared by:</span>
                  <p className="font-bold text-[#001A4D] mt-1">{previewReport.signatories?.preparedBy?.name}</p>
                  <p className="text-gray-500 text-[11px]">{previewReport.signatories?.preparedBy?.title}</p>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Attested by:</span>
                  <p className="font-bold text-[#001A4D] mt-1">{previewReport.signatories?.attestedBy?.name}</p>
                  <p className="text-gray-500 text-[11px]">{previewReport.signatories?.attestedBy?.title}</p>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Approved by:</span>
                  <p className="font-bold text-[#001A4D] mt-1">{previewReport.signatories?.approvedBy?.name}</p>
                  <p className="text-gray-500 text-[11px]">{previewReport.signatories?.approvedBy?.title}</p>
                </div>
              </div>
            </div>

            {/* Modal Footer (Export Actions) */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => setPreviewReport(null)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100"
              >
                Close Preview
              </button>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => exportReportToCSV(previewReport)}
                  variant="outline"
                  className="border-[#0E4EBD] text-[#0E4EBD] text-xs font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Export CSV / Excel
                </Button>
                <Button
                  onClick={() => exportReportToPDF(previewReport)}
                  className="bg-[#001A4D] hover:bg-[#002D72] text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Export Official PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
