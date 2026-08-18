import { useMemo } from "react";
import { useNavigate } from "react-router";
import {
  CalendarCheck,
  Receipt,
  Building2,
  BarChart3,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
  Sparkles,
  CheckCircle2,
  FileCheck,
} from "lucide-react";
import { MetricCard } from "../components/dashboard/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";

import { useAdviserProfile } from "../../modules/auth/hooks/useAdviserProfile";
import { useStudents } from "../../modules/students/hooks/useStudentStream";
import { useAllEvents } from "../../modules/events/hooks/useEventStream";
import { useAllLiquidations } from "../../modules/finance/hooks/useLiquidationStream";
import { useOrganizationStream } from "../../modules/organizations/hooks/useOrganizationStream";
import { formatCurrency } from "../../utils/currency";
import { useIncomingDocuments } from "../../modules/documents/hooks/useDocumentStream";
import { useSemesters } from "../../modules/academic/hooks/useAcademicStream";
import { getMillis, formatTimestampDate } from "../../modules/students/utils/date.utils";

export function Dashboard() {
  const navigate = useNavigate();

  // ─── Real-Time Data Streams ────────────────────────────────────────────────
  const { profile } = useAdviserProfile();
  const { data: students = [] } = useStudents();
  const { events = [] } = useAllEvents();
  const { liquidations = [] } = useAllLiquidations();
  const { data: organizations = [] } = useOrganizationStream();
  const { data: incomingDocs = [] } = useIncomingDocuments();
  const { data: semesters = [] } = useSemesters();

  const activeSemester = useMemo(() => {
    return semesters.find((s) => s.status === "ACTIVE");
  }, [semesters]);

  // ─── Time-of-Day Greeting ──────────────────────────────────────────────────
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const adviserDisplayName = useMemo(() => {
    if (profile?.displayName) return profile.displayName;
    if (profile?.firstName) return `Adviser ${profile.firstName}`;
    return "SAO Administrator";
  }, [profile]);

  // ─── Metrics Computation ───────────────────────────────────────────────────
  const pendingStudents = useMemo(() => {
    return students.filter((s) => s.status === "PENDING");
  }, [students]);

  const activeStudents = useMemo(() => {
    return students.filter((s) => s.status === "ACTIVE");
  }, [students]);

  const pendingEvents = useMemo(() => {
    return events.filter(
      (e) => e.proposalStatus === "pending_review" || e.proposalStatus === "pending"
    );
  }, [events]);

  const pendingLiquidations = useMemo(() => {
    return liquidations.filter(
      (l) => l.status === "pending_adviser_review" || (l as any).status === "submitted"
    );
  }, [liquidations]);

  const pendingIncomingDocs = useMemo(() => {
    return incomingDocs.filter((d) => d.status === "Pending");
  }, [incomingDocs]);

  const activeOrgs = useMemo(() => {
    return organizations.filter((o) => !o.archived && o.status === "active");
  }, [organizations]);

  // Map organization names & acronyms by ID
  const orgMap = useMemo(() => {
    const map = new Map<string, { name: string; acronym: string; logoUrl?: string | null }>();
    organizations.forEach((o) => {
      map.set(o.id, { name: o.name, acronym: o.acronym || o.name, logoUrl: o.logoUrl });
    });
    return map;
  }, [organizations]);

  // ─── Unified Approvals Queue Feed (Scrollable, No Visible Scrollbar) ────────
  const unifiedApprovalsQueue = useMemo(() => {
    interface ApprovalItem {
      id: string;
      rawId: string;
      domain: "student" | "event" | "liquidation" | "document";
      domainLabel: string;
      title: string;
      subtitle: string;
      timestampMs: number;
      dateFormatted: string;
      route: string;
      badgeColor: string;
    }

    const items: ApprovalItem[] = [];

    // 1. Pending Incoming Submitted Documents (Route directly to specific document review)
    pendingIncomingDocs.forEach((doc) => {
      const ms = getMillis(doc.createdAt);
      items.push({
        id: `doc-${doc.id}`,
        rawId: doc.id,
        domain: "document",
        domainLabel: "Document Submission",
        title: doc.title || doc.referenceNumber || "Document Review",
        subtitle: `${doc.senderOrgName || "Student Org"} · ${doc.category}`,
        timestampMs: ms,
        dateFormatted: formatTimestampDate(doc.createdAt),
        route: `/home/documents/${doc.id}/review`,
        badgeColor: "bg-[#0284C7]",
      });
    });

    // 2. Pending Event Proposals (Route directly to specific event proposal modal)
    pendingEvents.forEach((e) => {
      const ms = getMillis(e.createdAt);
      const hostInfo = orgMap.get(e.hostingOrgId);
      items.push({
        id: `event-${e.id}`,
        rawId: e.id,
        domain: "event",
        domainLabel: "Event Proposal",
        title: e.title || "Untitled Proposal",
        subtitle: `${hostInfo?.acronym || hostInfo?.name || "Student Club"} · Proposed`,
        timestampMs: ms,
        dateFormatted: formatTimestampDate(e.createdAt),
        route: `/home/event-approvals?id=${e.id}`,
        badgeColor: "bg-[#0E4EBD]",
      });
    });

    // 3. Pending Liquidations (Route directly to specific liquidation review)
    pendingLiquidations.forEach((l) => {
      const ms = getMillis(l.updatedAt || l.createdAt);
      const totalExp = Number(l.totalExpenses || (l as any).totalAmount || 0);
      items.push({
        id: `liq-${l.id}`,
        rawId: l.id,
        domain: "liquidation",
        domainLabel: "Liquidation Report",
        title: l.eventName || (l as any).title || "Financial Liquidation",
        subtitle: `${l.organizationName || "Club"} · ${formatCurrency(totalExp)}`,
        timestampMs: ms,
        dateFormatted: formatTimestampDate(l.updatedAt || l.createdAt),
        route: `/home/liquidations?id=${l.id}`,
        badgeColor: "bg-amber-500",
      });
    });

    // 4. Pending Students (Route directly to student verification)
    pendingStudents.forEach((s) => {
      const ms = getMillis(s.createdAt);
      items.push({
        id: `student-${s.id}`,
        rawId: s.id,
        domain: "student",
        domainLabel: "Student Verification",
        title: `${s.firstName} ${s.lastName}`,
        subtitle: `${s.courseCode || "Student"} · ID: ${s.studentId || "New Registration"}`,
        timestampMs: ms,
        dateFormatted: formatTimestampDate(s.createdAt),
        route: `/home/students?tab=pending&id=${s.id}`,
        badgeColor: "bg-red-500",
      });
    });

    // Sort newest pending items first
    items.sort((a, b) => b.timestampMs - a.timestampMs);
    return items;
  }, [pendingIncomingDocs, pendingEvents, pendingLiquidations, pendingStudents, orgMap]);

  // ─── Real Organization Activity Roster ─────────────────────────────────────
  const organizationActivityList = useMemo(() => {
    return activeOrgs.map((org) => {
      const orgEvents = events.filter((e) => e.hostingOrgId === org.id);
      const approvedCount = orgEvents.filter((e) => e.proposalStatus === "approved").length;
      const totalEvents = orgEvents.length || 1;
      const progress = Math.min(100, Math.round((approvedCount / totalEvents) * 100));

      return {
        id: org.id,
        name: org.acronym || org.name,
        fullName: org.name,
        logoUrl: org.logoUrl,
        eventsCount: approvedCount,
        totalEvents: orgEvents.length,
        memberCount: org.memberCount || 0,
        progress: progress === 0 && approvedCount > 0 ? 100 : progress,
      };
    });
  }, [activeOrgs, events]);

  return (
    <div className="space-y-6 pb-6">
      {/* Dynamic Welcome Banner */}
      <div className="relative bg-gradient-to-br from-[#001A4D] via-[#002B7F] to-[#0A47B8] rounded-3xl p-8 text-white overflow-hidden shadow-lg shadow-[#001A4D]/10 border border-blue-900/40">
        <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-[#FFD41C]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-[#FFD41C] text-[#001A4D] uppercase tracking-wider">
                SAO Portal
              </span>
              {activeSemester && (
                <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white">
                  {activeSemester.label} ({activeSemester.semester})
                </span>
              )}
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              {greeting}, {adviserDisplayName}.
            </h2>
            <p className="text-white/80 text-sm mt-1 max-w-2xl">
              {profile?.campusName || "STI College"} — Real-time overview of student registrations, event proposals, organization activities, and financial reviews.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button
              onClick={() => navigate("/home/reports")}
              className="bg-white text-[#001A4D] hover:bg-gray-100 font-bold shadow-sm cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 mr-1.5 text-[#0E4EBD]" />
              Reports Center
            </Button>
          </div>
        </div>
        <Shield className="absolute right-6 top-1/2 -translate-y-1/2 w-44 h-44 opacity-10 pointer-events-none" />
      </div>

      {/* Top 5 Real-Time Reactive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Pending Student Verifications */}
        <MetricCard
          title="Pending Student Verifications"
          value={pendingStudents.length}
          icon={UserCheck}
          gradient="red-orange"
          change="New student registrations"
          onClick={() => navigate("/home/students")}
          badge={
            pendingStudents.length > 0 ? (
              <span className="px-2.5 py-1 bg-white text-red-700 rounded-full text-xs font-bold shadow-xs">
                {pendingStudents.length} To Verify
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-white/30 text-white rounded-full text-xs font-semibold">
                All Cleared
              </span>
            )
          }
        />

        {/* 2. Pending Event Proposals */}
        <MetricCard
          title="Pending Event Proposals"
          value={pendingEvents.length}
          icon={CalendarCheck}
          gradient="blue"
          change="Club proposals awaiting SAO"
          onClick={() => navigate("/home/event-approvals")}
          badge={
            pendingEvents.length > 0 ? (
              <span className="px-2.5 py-1 bg-[#FFD41C] text-[#001A4D] rounded-full text-xs font-bold shadow-xs">
                {pendingEvents.length} Pending
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-white/30 text-white rounded-full text-xs font-semibold">
                All Cleared
              </span>
            )
          }
        />

        {/* 3. Pending Liquidations */}
        <MetricCard
          title="Pending Liquidations"
          value={pendingLiquidations.length}
          icon={Receipt}
          gradient="gold"
          change="Post-event financial reports"
          onClick={() => navigate("/home/liquidations")}
          badge={
            pendingLiquidations.length > 0 ? (
              <span className="px-2.5 py-1 bg-[#001A4D] text-[#FFD41C] rounded-full text-xs font-bold shadow-xs">
                {pendingLiquidations.length} Reviews
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-white/30 text-white rounded-full text-xs font-semibold">
                All Settled
              </span>
            )
          }
        />

        {/* 4. Active Organizations */}
        <MetricCard
          title="Active Organizations"
          value={activeOrgs.length}
          icon={Building2}
          gradient="green"
          change="Recognized student clubs"
          onClick={() => navigate("/home/organizations")}
          trending="up"
        />

        {/* 5. Active Enrolled Students */}
        <MetricCard
          title="Active Enrolled Students"
          value={activeStudents.length}
          icon={Users}
          gradient="navy"
          change="Currently verified students"
          onClick={() => navigate("/home/students")}
          trending="up"
        />
      </div>

      {/* 3-Column Fixed Height Hub Cards (Top Pushed Rows, Zero Top Whitespace) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. Unified Approvals Queue (Fixed Height h-[420px], Rows Pushed Directly to Top) */}
        <Card className="lg:col-span-5 h-[420px] border-[#E0E0E0] shadow-sm rounded-2xl flex flex-col gap-0 overflow-hidden">
          <CardHeader className="border-b border-gray-100 py-3.5 px-4 pb-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#0E4EBD]" />
                <CardTitle className="text-[#001A4D] text-lg font-bold">Pending Approvals Queue</CardTitle>
              </div>
              <span className="px-2.5 py-0.5 bg-[#001A4D] text-white rounded-full text-xs font-mono font-bold">
                {unifiedApprovalsQueue.length} Total
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pt-3 pb-3 flex-1 flex flex-col justify-start overflow-hidden">
            {/* Rows Pushed Directly to Top - Scrollable without visible scrollbar */}
            <div className="space-y-2 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pt-0 mt-0">
              {unifiedApprovalsQueue.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="font-bold text-[#001A4D]">All Approval Queues are Clear!</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    There are currently no pending items awaiting adviser review.
                  </p>
                </div>
              ) : (
                unifiedApprovalsQueue.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2.5 hover:bg-gray-50/80 rounded-xl transition-colors border border-gray-100"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${item.badgeColor} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          {item.domainLabel}
                        </span>
                      </div>
                      <div className="font-semibold text-[#001A4D] text-xs truncate">{item.title}</div>
                      <div className="text-[11px] text-gray-500 truncate mt-0.5">{item.subtitle}</div>
                    </div>
                    {/* Review Button Redirecting Directly to Specific Item Review Page */}
                    <Button
                      size="sm"
                      onClick={() => navigate(item.route)}
                      className="bg-[#001A4D] hover:bg-[#0E4EBD] text-white text-xs font-semibold h-7 px-3 flex-shrink-0 cursor-pointer"
                    >
                      Review
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. Organization Activity (Fixed Height h-[420px], Rows Pushed Directly to Top) */}
        <Card className="lg:col-span-4 h-[420px] border-[#E0E0E0] shadow-sm rounded-2xl flex flex-col gap-0 overflow-hidden">
          <CardHeader className="border-b border-gray-100 py-3.5 px-4 pb-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0E4EBD]" />
                <CardTitle className="text-[#001A4D] text-lg font-bold">Organization Activity</CardTitle>
              </div>
              <span className="text-xs text-gray-500 font-medium">{activeOrgs.length} Active Clubs</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pt-3 pb-3 flex-1 flex flex-col justify-start overflow-hidden">
            {/* Rows Pushed Directly to Top - Scrollable without visible scrollbar */}
            <div className="space-y-2 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pt-0 mt-0">
              {organizationActivityList.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium">No active organizations found.</p>
                </div>
              ) : (
                organizationActivityList.map((org) => (
                  <div key={org.id} className="p-2.5 bg-gray-50/60 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="w-8 h-8 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-lg flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden flex-shrink-0 shadow-xs">
                        {org.logoUrl ? (
                          <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
                        ) : (
                          org.name.slice(0, 3)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[#001A4D] text-xs truncate">{org.fullName}</div>
                        <div className="text-[11px] text-gray-500 flex items-center justify-between mt-0.5">
                          <span>{org.eventsCount} event(s) approved</span>
                          <span>{org.memberCount} member(s)</span>
                        </div>
                      </div>
                    </div>
                    <Progress value={org.progress} className="h-1.5 bg-gray-200" />
                  </div>
                ))
              )}
            </div>

            {/* Bottom Button */}
            <Button
              variant="outline"
              onClick={() => navigate("/home/organizations")}
              className="w-full border-gray-200 text-[#001A4D] hover:bg-gray-50 font-semibold text-xs mt-2 flex-shrink-0 cursor-pointer"
            >
              View All Recognized Clubs →
            </Button>
          </CardContent>
        </Card>

        {/* 3. Quick Actions Panel (Fixed Height h-[420px], Rows Pushed Directly to Top) */}
        <Card className="lg:col-span-3 h-[420px] border-[#E0E0E0] shadow-sm rounded-2xl flex flex-col gap-0 overflow-hidden">
          <CardHeader className="border-b border-gray-100 py-3.5 px-4 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FFC107]" />
              <CardTitle className="text-[#001A4D] text-lg font-bold">Quick Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pt-3 pb-3 flex-1 flex flex-col justify-start space-y-2 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <Button
              onClick={() => navigate("/home/students")}
              className="w-full bg-[#001A4D] hover:bg-[#0E4EBD] text-white justify-between font-semibold text-xs py-3.5 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#FFD41C]" />
                Verify Students
              </span>
              {pendingStudents.length > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-[11px] font-bold">
                  {pendingStudents.length}
                </span>
              )}
            </Button>

            <Button
              onClick={() => navigate("/home/event-approvals")}
              variant="outline"
              className="w-full border-gray-300 text-[#001A4D] hover:bg-gray-50 justify-between font-semibold text-xs py-3.5 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-[#0E4EBD]" />
                Event Approvals
              </span>
              {pendingEvents.length > 0 && (
                <span className="px-2 py-0.5 bg-blue-500 text-white rounded-full text-[11px] font-bold">
                  {pendingEvents.length}
                </span>
              )}
            </Button>

            <Button
              onClick={() => navigate("/home/liquidations")}
              variant="outline"
              className="w-full border-gray-300 text-[#001A4D] hover:bg-gray-50 justify-between font-semibold text-xs py-3.5 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-600" />
                Review Liquidations
              </span>
              {pendingLiquidations.length > 0 && (
                <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[11px] font-bold">
                  {pendingLiquidations.length}
                </span>
              )}
            </Button>

            <Button
              onClick={() => navigate("/home/organizations")}
              variant="outline"
              className="w-full border-gray-300 text-[#001A4D] hover:bg-gray-50 justify-start font-semibold text-xs py-3.5 cursor-pointer"
            >
              <Building2 className="w-4 h-4 mr-2 text-[#0E4EBD]" />
              Manage Clubs & Roster
            </Button>

            <Button
              onClick={() => navigate("/home/attendance")}
              variant="outline"
              className="w-full border-gray-300 text-[#001A4D] hover:bg-gray-50 justify-start font-semibold text-xs py-3.5 cursor-pointer"
            >
              <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
              Live Attendance Gate
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
