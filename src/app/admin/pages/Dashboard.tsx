import { useState, useMemo } from "react";
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
  Clock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  FileCheck,
  ChevronRight,
} from "lucide-react";
import { MetricCard } from "../components/dashboard/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

import { useAdviserProfile } from "../../modules/auth/hooks/useAdviserProfile";
import { useStudents } from "../../modules/students/hooks/useStudentStream";
import { useAllEvents } from "../../modules/events/hooks/useEventStream";
import { useAllLiquidations } from "../../modules/finance/hooks/useLiquidationStream";
import { useOrganizationStream } from "../../modules/organizations/hooks/useOrganizationStream";
import { useAttendanceStream } from "../../modules/attendance/hooks/useAttendanceStream";
import { useSemesters } from "../../modules/academic/hooks/useAcademicStream";
import { getMillis, formatTimestampDate } from "../../modules/students/utils/date.utils";

type ChartTimeframe = "this_week" | "this_month" | "this_semester";

export function Dashboard() {
  const navigate = useNavigate();
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>("this_week");

  // ─── Real-Time Data Streams ────────────────────────────────────────────────
  const { profile, loading: loadingProfile } = useAdviserProfile();
  const { data: students = [], loading: loadingStudents } = useStudents();
  const { events = [], loading: loadingEvents } = useAllEvents();
  const { liquidations = [], loading: loadingLiquidations } = useAllLiquidations();
  const { data: organizations = [], loading: loadingOrgs } = useOrganizationStream();
  const { attendance = [], loading: loadingAttendance } = useAttendanceStream();
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

  const activeOrgs = useMemo(() => {
    return organizations.filter((o) => !o.archived && o.status === "active");
  }, [organizations]);

  const approvedEvents = useMemo(() => {
    return events.filter((e) => e.proposalStatus === "approved");
  }, [events]);

  // Map organization names & acronyms by ID
  const orgMap = useMemo(() => {
    const map = new Map<string, { name: string; acronym: string; logoUrl?: string | null }>();
    organizations.forEach((o) => {
      map.set(o.id, { name: o.name, acronym: o.acronym || o.name, logoUrl: o.logoUrl });
    });
    return map;
  }, [organizations]);

  // ─── Unified Approvals Queue Feed ──────────────────────────────────────────
  const unifiedApprovalsQueue = useMemo(() => {
    interface ApprovalItem {
      id: string;
      domain: "student" | "event" | "liquidation";
      domainLabel: string;
      title: string;
      subtitle: string;
      timestampMs: number;
      dateFormatted: string;
      route: string;
      badgeColor: string;
    }

    const items: ApprovalItem[] = [];

    // 1. Pending Students
    pendingStudents.forEach((s) => {
      const ms = getMillis(s.createdAt);
      items.push({
        id: `student-${s.id}`,
        domain: "student",
        domainLabel: "Student Verification",
        title: `${s.firstName} ${s.lastName}`,
        subtitle: `${s.courseCode || "Student"} · ID: ${s.studentId || "New Registration"}`,
        timestampMs: ms,
        dateFormatted: formatTimestampDate(s.createdAt),
        route: "/home/students",
        badgeColor: "bg-red-500",
      });
    });

    // 2. Pending Event Proposals
    pendingEvents.forEach((e) => {
      const ms = getMillis(e.createdAt);
      const hostInfo = orgMap.get(e.hostingOrgId);
      items.push({
        id: `event-${e.id}`,
        domain: "event",
        domainLabel: "Event Proposal",
        title: e.title || "Untitled Proposal",
        subtitle: `${hostInfo?.acronym || hostInfo?.name || "Student Club"} · Proposed`,
        timestampMs: ms,
        dateFormatted: formatTimestampDate(e.createdAt),
        route: "/home/event-approvals",
        badgeColor: "bg-[#0E4EBD]",
      });
    });

    // 3. Pending Liquidations
    pendingLiquidations.forEach((l) => {
      const ms = getMillis(l.updatedAt || l.createdAt);
      const totalExp = Number(l.totalExpenses || (l as any).totalAmount || 0);
      items.push({
        id: `liq-${l.id}`,
        domain: "liquidation",
        domainLabel: "Liquidation Report",
        title: l.eventName || (l as any).title || "Financial Liquidation",
        subtitle: `${l.organizationName || "Club"} · ₱${totalExp.toLocaleString()}`,
        timestampMs: ms,
        dateFormatted: formatTimestampDate(l.updatedAt || l.createdAt),
        route: "/home/liquidations",
        badgeColor: "bg-amber-500",
      });
    });

    // Sort newest pending items first
    items.sort((a, b) => b.timestampMs - a.timestampMs);
    return items.slice(0, 6);
  }, [pendingStudents, pendingEvents, pendingLiquidations, orgMap]);

  // ─── Real Organization Activity Roster ─────────────────────────────────────
  const organizationActivityList = useMemo(() => {
    return activeOrgs.slice(0, 4).map((org) => {
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

  // ─── Real Campus Activity Chart Data ───────────────────────────────────────
  const chartData = useMemo(() => {
    const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const dayDataMap: Record<string, { events: number; scans: number }> = {
      Mon: { events: 0, scans: 0 },
      Tue: { events: 0, scans: 0 },
      Wed: { events: 0, scans: 0 },
      Thu: { events: 0, scans: 0 },
      Fri: { events: 0, scans: 0 },
      Sat: { events: 0, scans: 0 },
      Sun: { events: 0, scans: 0 },
    };

    const getDayKey = (date: Date): string => {
      const dayIndex = date.getDay(); // 0 is Sunday, 1 is Monday...
      return dayIndex === 0 ? "Sun" : daysOfWeek[dayIndex - 1];
    };

    const now = new Date();

    if (chartTimeframe === "this_week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      startOfWeek.setHours(0, 0, 0, 0);

      // Attendance scans this week
      attendance.forEach((a) => {
        const ms = getMillis(a.createdAt);
        if (!ms) return;
        const scanDate = new Date(ms);
        if (scanDate >= startOfWeek) {
          const key = getDayKey(scanDate);
          if (dayDataMap[key]) dayDataMap[key].scans += 1;
        }
      });

      // Events this week
      events.forEach((e) => {
        if (!e.sessions || e.sessions.length === 0) return;
        e.sessions.forEach((s) => {
          if (!s.date) return;
          const sDate = new Date(s.date);
          if (sDate >= startOfWeek) {
            const key = getDayKey(sDate);
            if (dayDataMap[key]) dayDataMap[key].events += 1;
          }
        });
      });
    } else {
      // Aggregate all active logs by day-of-week pattern
      attendance.forEach((a) => {
        const ms = getMillis(a.createdAt);
        if (!ms) return;
        const key = getDayKey(new Date(ms));
        if (dayDataMap[key]) dayDataMap[key].scans += 1;
      });

      events.forEach((e) => {
        if (!e.sessions || e.sessions.length === 0) return;
        e.sessions.forEach((s) => {
          if (!s.date) return;
          const key = getDayKey(new Date(s.date));
          if (dayDataMap[key]) dayDataMap[key].events += 1;
        });
      });
    }

    return daysOfWeek.map((day) => ({
      id: day.toLowerCase(),
      day,
      events: dayDataMap[day].events,
      scans: dayDataMap[day].scans,
    }));
  }, [attendance, events, chartTimeframe]);

  return (
    <div className="space-y-6">
      {/* Dynamic Welcome Banner */}
      <div className="relative bg-gradient-to-r from-[#001A4D] via-[#0E4EBD] to-[#83358E] rounded-3xl p-8 text-white overflow-hidden shadow-sm">
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
              className="bg-white text-[#001A4D] hover:bg-gray-100 font-bold shadow-sm"
            >
              <BarChart3 className="w-4 h-4 mr-1.5 text-[#83358E]" />
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
          gradient="purple"
          change="Currently verified students"
          onClick={() => navigate("/home/students")}
          trending="up"
        />
      </div>

      {/* 3-Column Intelligence & Action Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Unified Approvals Queue */}
        <Card className="lg:col-span-5 border-[#E0E0E0] shadow-sm rounded-2xl flex flex-col">
          <CardHeader className="border-b border-gray-100 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#0E4EBD]" />
                <CardTitle className="text-[#001A4D] text-lg">Pending Approvals Queue</CardTitle>
              </div>
              <span className="px-2.5 py-0.5 bg-[#001A4D] text-white rounded-full text-xs font-mono font-bold">
                {pendingStudents.length + pendingEvents.length + pendingLiquidations.length} Total
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col justify-between">
            <div className="space-y-2.5">
              {unifiedApprovalsQueue.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="font-bold text-[#001A4D]">All Approval Queues are Clear!</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    There are currently no pending students, event proposals, or liquidations awaiting review.
                  </p>
                </div>
              ) : (
                unifiedApprovalsQueue.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3.5 hover:bg-gray-50/80 rounded-xl transition-colors border border-gray-100"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${item.badgeColor} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          {item.domainLabel}
                        </span>
                      </div>
                      <div className="font-semibold text-[#001A4D] text-sm truncate">{item.title}</div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">{item.subtitle}</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => navigate(item.route)}
                      className="bg-[#001A4D] hover:bg-[#0E4EBD] text-white text-xs font-semibold flex-shrink-0"
                    >
                      Review
                    </Button>
                  </div>
                ))
              )}
            </div>

            {unifiedApprovalsQueue.length > 0 && (
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">Showing most recent pending submissions</span>
                <button
                  onClick={() => navigate(pendingStudents.length > 0 ? "/home/students" : "/home/event-approvals")}
                  className="text-[#0E4EBD] hover:underline font-bold flex items-center gap-1"
                >
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Real Organization Activity & Progress */}
        <Card className="lg:col-span-4 border-[#E0E0E0] shadow-sm rounded-2xl flex flex-col">
          <CardHeader className="border-b border-gray-100 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#83358E]" />
                <CardTitle className="text-[#001A4D] text-lg">Organization Activity</CardTitle>
              </div>
              <span className="text-xs text-gray-500 font-medium">{activeOrgs.length} Active Clubs</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4 flex-1">
            {organizationActivityList.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium">No active organizations found.</p>
              </div>
            ) : (
              organizationActivityList.map((org) => (
                <div key={org.id} className="p-3 bg-gray-50/60 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-gradient-to-br from-[#001A4D] to-[#83358E] rounded-xl flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden flex-shrink-0 shadow-xs">
                      {org.logoUrl ? (
                        <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
                      ) : (
                        org.name.slice(0, 3)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[#001A4D] text-sm truncate">{org.fullName}</div>
                      <div className="text-xs text-gray-500 flex items-center justify-between mt-0.5">
                        <span>{org.eventsCount} event(s) approved</span>
                        <span>{org.memberCount} member(s)</span>
                      </div>
                    </div>
                  </div>
                  <Progress value={org.progress} className="h-1.5 bg-gray-200" />
                </div>
              ))
            )}

            <Button
              variant="outline"
              onClick={() => navigate("/home/organizations")}
              className="w-full border-gray-200 text-[#001A4D] hover:bg-gray-50 font-semibold text-xs mt-2"
            >
              View All Recognized Clubs →
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions Panel */}
        <Card className="lg:col-span-3 border-[#E0E0E0] shadow-sm rounded-2xl flex flex-col justify-between">
          <CardHeader className="border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FFC107]" />
              <CardTitle className="text-[#001A4D] text-lg">Quick Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5 flex-1">
            <Button
              onClick={() => navigate("/home/students")}
              className="w-full bg-[#001A4D] hover:bg-[#0E4EBD] text-white justify-between font-semibold text-xs py-5"
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
              className="w-full border-gray-300 text-[#001A4D] hover:bg-gray-50 justify-between font-semibold text-xs py-5"
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
              className="w-full border-gray-300 text-[#001A4D] hover:bg-gray-50 justify-between font-semibold text-xs py-5"
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
              className="w-full border-gray-300 text-[#001A4D] hover:bg-gray-50 justify-start font-semibold text-xs py-5"
            >
              <Building2 className="w-4 h-4 mr-2 text-[#83358E]" />
              Manage Clubs & Roster
            </Button>

            <Button
              onClick={() => navigate("/home/attendance")}
              variant="outline"
              className="w-full border-gray-300 text-[#001A4D] hover:bg-gray-50 justify-start font-semibold text-xs py-5"
            >
              <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
              Live Attendance Gate
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Real Campus Activity Bar Chart */}
      <Card className="border-[#E0E0E0] shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-gray-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-[#001A4D] text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#0E4EBD]" />
                Campus Activity & Attendance Analytics
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                Real-time scan logs from QR event gates and approved student events.
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setChartTimeframe("this_week")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartTimeframe === "this_week"
                    ? "bg-[#001A4D] text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setChartTimeframe("this_month")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartTimeframe === "this_month"
                    ? "bg-[#001A4D] text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All Days
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} id="dashboard-activity-chart">
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#001A4D",
                    borderRadius: "12px",
                    border: "none",
                    color: "#fff",
                    fontSize: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  }}
                  itemStyle={{ color: "#fff" }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "10px" }}
                  formatter={(value) => <span className="text-xs font-semibold text-gray-700">{value}</span>}
                />
                <Bar
                  dataKey="events"
                  fill="#0E4EBD"
                  name="Events Held / Scheduled"
                  radius={[6, 6, 0, 0]}
                  barSize={28}
                />
                <Bar
                  dataKey="scans"
                  fill="#FFC107"
                  name="Total Attendance Scans"
                  radius={[6, 6, 0, 0]}
                  barSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
