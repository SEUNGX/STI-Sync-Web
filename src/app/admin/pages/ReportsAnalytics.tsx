import { useState, useMemo, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  FileText,
  Download,
  Users,
  CalendarCheck,
  Receipt,
  Award,
  Shield,
  Building2,
  Filter,
  Eye,
  Printer,
  Sparkles,
  CheckCircle2,
  Clock,
  X,
  ChevronRight,
  School,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { TablePagination } from "../../components/common/TablePagination";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useStudents } from "../../modules/students/hooks/useStudentStream";
import { useAllEvents } from "../../modules/events/hooks/useEventStream";
import { useAllLiquidations } from "../../modules/finance/hooks/useLiquidationStream";
import { useAllPayables } from "../../modules/finance/hooks/usePayableStream";
import { useOrganizationStream } from "../../modules/organizations/hooks/useOrganizationStream";
import { useIssuedCertificatesStream } from "../../modules/certificates/hooks/useCertificateStream";
import { useAuditLogs } from "../../modules/audit/hooks/useAuditStream";
import { useActiveAcademicPeriods, useSemesters } from "../../modules/academic/hooks/useAcademicStream";
import {
  AdminReportId,
  GeneratedReportData,
  ReportScope,
} from "../../modules/reports/types/report.types";
import {
  generateStudentEnrollmentReport,
  generateEventAccomplishmentReport,
  generateFinancialLiquidationReport,
  generateOrganizationRosterReport,
  generateStudentPayablesReport,
  generateCertificateIssuanceReport,
  generateSystemAuditTrailReport,
  isStudentInTrack,
  isEventInTrack,
} from "../../modules/reports/services/report-generator.service";
import { exportReportToPDF } from "../../modules/reports/utils/pdf-report-builder";
import { exportReportToCSV } from "../../modules/reports/utils/csv-report-builder";

// Color constants for charts
const CHART_COLORS = ["#001A4D", "#0E4EBD", "#FFD41C", "#22C55E", "#8B5CF6", "#EC4899", "#F97316"];

export function ReportsAnalytics() {
  const [scope, setScope] = useState<ReportScope>("ALL");
  const [selectedTermId, setSelectedTermId] = useState<string>("ACTIVE");
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

  // Live Streams
  const { data: students = [] } = useStudents();
  const { events = [] } = useAllEvents();
  const { liquidations = [] } = useAllLiquidations();
  const { data: payables = [] } = useAllPayables();
  const { data: organizations = [] } = useOrganizationStream();
  const { issuedRecords: certificates = [] } = useIssuedCertificatesStream();
  const { data: auditLogs = [] } = useAuditLogs(200);
  const { data: semesters = [] } = useSemesters();
  const { activeCollegePeriod, activeShsPeriod } = useActiveAcademicPeriods();

  // Active period resolution
  const activePeriod = scope === "SHS" ? activeShsPeriod : activeCollegePeriod || activeShsPeriod;

  // Selected semester filter
  const currentSemesterDoc = useMemo(() => {
    if (selectedTermId === "ACTIVE") return activePeriod;
    return semesters.find((s) => s.id === selectedTermId) || activePeriod;
  }, [selectedTermId, activePeriod, semesters]);

  const filterOptions = useMemo(
    () => ({
      scope,
      academicYear: currentSemesterDoc?.academicYear,
      semester: currentSemesterDoc?.semester,
    }),
    [scope, currentSemesterDoc]
  );

  // ── 1. Filtered Data per Scope ───────────────────────────────────────────────
  const scopedStudents = useMemo(() => students.filter((s) => isStudentInTrack(s, scope)), [students, scope]);
  const scopedEvents = useMemo(() => events.filter((e) => isEventInTrack(e, scope)), [events, scope]);

  // ── 2. Real-Time Chart Computations ─────────────────────────────────────────
  // Monthly Event & Attendance Trend
  const monthlyTrends = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const counts = months.map((m) => ({ month: m, events: 0, attendance: 0 }));

    scopedEvents.forEach((e) => {
      if (!e.startDate) return;
      const date = new Date(e.startDate);
      const mIdx = date.getMonth();
      if (mIdx >= 0 && mIdx < 12) {
        counts[mIdx].events += 1;
        counts[mIdx].attendance += e.actualAttendees || e.attendeesCount || 0;
      }
    });

    // Return active slice or last 6 months
    return counts.filter((c) => c.events > 0 || c.attendance > 0).length > 0
      ? counts.filter((c) => c.events > 0 || c.attendance > 0)
      : counts.slice(0, 6);
  }, [scopedEvents]);

  // Organization Budget vs Disbursed/Spent
  const orgBudgetStats = useMemo(() => {
    return organizations.slice(0, 6).map((org) => {
      const allocated = org.budget || org.allocatedBudget || 0;
      const spent = liquidations
        .filter((l) => l.organizationId === org.id && l.status === "APPROVED")
        .reduce((sum, l) => sum + (l.totalAmount || l.actualExpenses || 0), 0);
      return {
        org: org.code || org.name.slice(0, 8),
        allocated,
        spent,
      };
    });
  }, [organizations, liquidations]);

  // Student Program Distribution
  const programDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    scopedStudents.forEach((s) => {
      const code = s.courseCode || "General";
      map[code] = (map[code] || 0) + 1;
    });

    return Object.entries(map).map(([name, count], i) => ({
      name,
      value: count,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [scopedStudents]);

  // Payables collection rate
  const feeStats = useMemo(() => {
    const totalAssessed = payables.reduce((s, p) => s + (p.amount || 0), 0);
    const totalCollected = payables
      .filter((p) => p.status === "paid" || p.paymentStatus === "PAID")
      .reduce((s, p) => s + (p.amount || 0), 0);
    const uncollected = totalAssessed - totalCollected;
    return [
      { name: "Collected", value: totalCollected, color: "#22C55E" },
      { name: "Unpaid Balance", value: uncollected, color: "#EF4444" },
    ];
  }, [payables]);

  // ── 3. Report Trigger Handlers ──────────────────────────────────────────────
  const handleOpenReport = (id: AdminReportId) => {
    let rep: GeneratedReportData;
    switch (id) {
      case "STUDENT_ENROLLMENT_DEMOGRAPHICS":
        rep = generateStudentEnrollmentReport(students, filterOptions);
        break;
      case "EVENT_ACCOMPLISHMENT_ATTENDANCE":
        rep = generateEventAccomplishmentReport(events, filterOptions);
        break;
      case "FINANCIAL_LIQUIDATION_BUDGET":
        rep = generateFinancialLiquidationReport(liquidations, organizations, filterOptions);
        break;
      case "ORGANIZATION_ACCREDITATION_ROSTER":
        rep = generateOrganizationRosterReport(organizations, filterOptions);
        break;
      case "STUDENT_PAYABLES_COLLECTION":
        rep = generateStudentPayablesReport(payables, filterOptions);
        break;
      case "CERTIFICATE_ISSUANCE_SUMMARY":
        rep = generateCertificateIssuanceReport(certificates, filterOptions);
        break;
      case "SYSTEM_AUDIT_TRAIL":
        rep = generateSystemAuditTrailReport(auditLogs, filterOptions);
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
            <h2 className="text-2xl font-bold text-[#001A4D]">Institutional Reports & Analytics</h2>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            Campus-wide operational intelligence, financial audits, and accreditation report generator.
          </p>
        </div>

        {/* Scope & Term Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Track Scope Pills */}
          <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200">
            {(["ALL", "COLLEGE", "SHS"] as ReportScope[]).map((sc) => (
              <button
                key={sc}
                onClick={() => setScope(sc)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  scope === sc
                    ? sc === "SHS"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-[#001A4D] text-[#FFD41C] shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {sc === "ALL" ? "All Tracks" : sc === "COLLEGE" ? "College (Sem)" : "SHS (Tri)"}
              </button>
            ))}
          </div>

          {/* Academic Period Dropdown */}
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold bg-white text-[#001A4D] focus:ring-2 focus:ring-[#0E4EBD]"
          >
            <option value="ACTIVE">Active Period ({activePeriod?.label || "Current"})</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Executive KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-[#E0E0E0] shadow-xs hover:border-[#0E4EBD] transition-all">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-[#0E4EBD] flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Total Enrolled</p>
              <h3 className="text-2xl font-bold text-[#001A4D]">{scopedStudents.length}</h3>
              <p className="text-[11px] text-gray-400">
                {scopedStudents.filter((s) => s.verificationStatus === "APPROVED").length} Verified IDs
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E0E0E0] shadow-xs hover:border-[#0E4EBD] transition-all">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-green-600 flex-shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Campus Events</p>
              <h3 className="text-2xl font-bold text-[#001A4D]">{scopedEvents.length}</h3>
              <p className="text-[11px] text-green-600 font-medium">
                {scopedEvents.reduce((s, e) => s + (e.actualAttendees || e.attendeesCount || 0), 0)} Attendees
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E0E0E0] shadow-xs hover:border-[#0E4EBD] transition-all">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Total Liquidated</p>
              <h3 className="text-2xl font-bold text-[#001A4D]">
                ₱
                {liquidations
                  .filter((l) => l.status === "APPROVED")
                  .reduce((s, l) => s + (l.totalAmount || l.actualExpenses || 0), 0)
                  .toLocaleString()}
              </h3>
              <p className="text-[11px] text-purple-600 font-medium">
                {liquidations.filter((l) => l.status === "APPROVED").length} Approved Claims
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E0E0E0] shadow-xs hover:border-[#0E4EBD] transition-all">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Recognized Clubs</p>
              <h3 className="text-2xl font-bold text-[#001A4D]">{organizations.length}</h3>
              <p className="text-[11px] text-amber-600 font-medium">100% In Good Standing</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 7 Institutional Master Reports Roster ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-[#001A4D]">Official Institutional Reports</h3>
            <p className="text-xs text-gray-500">Generate, preview, print, or export formal reports for accreditation and audits.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[
            {
              id: "STUDENT_ENROLLMENT_DEMOGRAPHICS" as AdminReportId,
              title: "Enrollment & Demographics",
              desc: "Complete headcount, course, year level, and sex breakdown.",
              icon: Users,
              color: "text-[#0E4EBD]",
              bg: "bg-blue-50",
            },
            {
              id: "EVENT_ACCOMPLISHMENT_ATTENDANCE" as AdminReportId,
              title: "Event Accomplishment & Attendance",
              desc: "Event status, venue audit, and verified participant turnouts.",
              icon: CalendarCheck,
              color: "text-green-600",
              bg: "bg-green-50",
            },
            {
              id: "FINANCIAL_LIQUIDATION_BUDGET" as AdminReportId,
              title: "Financial Liquidation & Budgets",
              desc: "Organization allocations, spent funds, and audited receipts.",
              icon: Receipt,
              color: "text-purple-600",
              bg: "bg-purple-50",
            },
            {
              id: "ORGANIZATION_ACCREDITATION_ROSTER" as AdminReportId,
              title: "Clubs & Officer Roster",
              desc: "Accredited organizations, advisers, officers, and standing.",
              icon: Building2,
              color: "text-cyan-700",
              bg: "bg-cyan-50",
            },
            {
              id: "STUDENT_PAYABLES_COLLECTION" as AdminReportId,
              title: "Payables & Fee Collections",
              desc: "Membership dues and event ticket fee collections audit.",
              icon: TrendingUp,
              color: "text-emerald-700",
              bg: "bg-emerald-50",
            },
            {
              id: "CERTIFICATE_ISSUANCE_SUMMARY" as AdminReportId,
              title: "Certificate Issuance Log",
              desc: "Generated and claimed student achievement certificates.",
              icon: Award,
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              id: "SYSTEM_AUDIT_TRAIL" as AdminReportId,
              title: "System Audit Trail",
              desc: "Security event logs, administrative approvals, and IP history.",
              icon: Shield,
              color: "text-red-600",
              bg: "bg-red-50",
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
                      Official
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

      {/* ── Interactive Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Event & Attendance Trends */}
        <Card className="border-[#E0E0E0] rounded-2xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-[#001A4D] flex items-center justify-between">
              <span>Event Activity & Attendance Volume</span>
              <span className="text-xs font-normal text-gray-500">Live Timeline</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="events" stroke="#0E4EBD" strokeWidth={2.5} name="Events" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="attendance" stroke="#FFD41C" strokeWidth={2.5} name="Attendees" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Organization Budget vs Disbursed */}
        <Card className="border-[#E0E0E0] rounded-2xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-[#001A4D] flex items-center justify-between">
              <span>Organization Budget Allocation vs Spent</span>
              <span className="text-xs font-normal text-gray-500">Top Organizations</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={orgBudgetStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="org" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="allocated" fill="#001A4D" name="Allocated (₱)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" fill="#22C55E" name="Liquidated (₱)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Student Enrollment Distribution */}
        <Card className="border-[#E0E0E0] rounded-2xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-[#001A4D]">Program Population Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={programDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {programDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payables & Dues Collection */}
        <Card className="border-[#E0E0E0] rounded-2xl shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-[#001A4D]">Institutional Fee Collection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={feeStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {feeStats.map((entry, index) => (
                    <Cell key={`fee-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => `₱${val.toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
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
                    Scope: {previewReport.metadata.scope} · {previewReport.metadata.academicYear || "A.Y. 2026-2027"}{" "}
                    {previewReport.metadata.semester || ""}
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
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                              {String(row[c.key] || "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {previewReport.rows.length === 0 && (
                        <tr>
                          <td colSpan={previewReport.columns.length} className="text-center py-10 text-gray-400">
                            No records found matching the current academic filters.
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
