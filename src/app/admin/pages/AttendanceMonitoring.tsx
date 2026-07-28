import { useState, useMemo } from "react";
import {
  CheckCircle2, XCircle, AlertCircle, UserCheck, Clock,
  ArrowLeft, Calendar, MapPin, Users, Search, Download,
  ChevronRight, QrCode, Timer, TrendingUp, Filter, Loader2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAllEvents } from "../../modules/events/hooks/useEventStream";
import { useAttendanceStream } from "../../modules/attendance/hooks/useAttendanceStream";
import { useVenuesStream, useEventCategoriesStream } from "../../modules/events/hooks/useEventConfigStream";

// ─── Types ────────────────────────────────────────────────────────────────────
type AttendStatus = "Complete" | "Checked In" | "Absent" | "Flagged" | "Late";

interface SessionRecord {
  id: string;
  studentId: string;
  name: string;
  org: string;
  course: string;
  timeIn: string | null;
  timeOut: string | null;
  duration: string | null;
  status: AttendStatus;
  note?: string;
}

interface EventSession {
  id: string;
  label: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  records: SessionRecord[];
}

interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
  org: string;
  orgInitials: string;
  category: string;
  registered: number;
  checkedIn: number;
  absent: number;
  flagged: number;
  status: "Ongoing" | "Completed" | "Upcoming";
  sessions: EventSession[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const FALLBACK_EVENTS: Event[] = [
  {
    id: "e1",
    name: "Leadership Summit 2026",
    date: "Jun 5–6, 2026",
    venue: "STI Ormoc Gymnasium",
    org: "Supreme Student Government",
    orgInitials: "SSG",
    category: "Seminar",
    registered: 200,
    checkedIn: 178,
    absent: 22,
    flagged: 3,
    status: "Completed",
    sessions: [
      {
        id: "s1a",
        label: "Day 1 — Morning Session",
        date: "Jun 5, 2026",
        timeStart: "8:00 AM",
        timeEnd: "12:00 PM",
        records: [
          { id: "r1", studentId: "2022-001234", name: "Juan Dela Cruz", org: "SSG", course: "BSIT 3A", timeIn: "7:55 AM", timeOut: "12:01 PM", duration: "4h 6m", status: "Complete" },
          { id: "r2", studentId: "2022-001456", name: "Maria Santos", org: "JPIA", course: "BSA 2B", timeIn: "8:03 AM", timeOut: "12:00 PM", duration: "3h 57m", status: "Complete" },
          { id: "r3", studentId: "2022-002345", name: "Pedro Garcia", org: "CSS", course: "BSCS 2A", timeIn: "8:45 AM", timeOut: "12:00 PM", duration: "3h 15m", status: "Late", note: "Late by 45 min" },
          { id: "r4", studentId: "2022-003456", name: "Ana Reyes", org: "RCY", course: "BSIT 1A", timeIn: null, timeOut: null, duration: null, status: "Absent" },
          { id: "r5", studentId: "2022-004567", name: "Carlos Lopez", org: "ACSS", course: "BSIT 4A", timeIn: "7:58 AM", timeOut: "11:30 AM", duration: "3h 32m", status: "Flagged", note: "Early check-out" },
          { id: "r6", studentId: "2022-005678", name: "Sofia Mendoza", org: "SSG", course: "BSIT 2B", timeIn: "8:00 AM", timeOut: "12:00 PM", duration: "4h 0m", status: "Complete" },
          { id: "r7", studentId: "2022-006789", name: "Miguel Torres", org: "JPIA", course: "BSA 3A", timeIn: "8:10 AM", timeOut: "12:05 PM", duration: "3h 55m", status: "Complete" },
          { id: "r8", studentId: "2022-007890", name: "Isabella Cruz", org: "CSS", course: "BSCS 3B", timeIn: null, timeOut: null, duration: null, status: "Absent" },
        ],
      },
      {
        id: "s1b",
        label: "Day 1 — Afternoon Session",
        date: "Jun 5, 2026",
        timeStart: "1:00 PM",
        timeEnd: "5:00 PM",
        records: [
          { id: "r9", studentId: "2022-001234", name: "Juan Dela Cruz", org: "SSG", course: "BSIT 3A", timeIn: "1:02 PM", timeOut: "5:00 PM", duration: "3h 58m", status: "Complete" },
          { id: "r10", studentId: "2022-001456", name: "Maria Santos", org: "JPIA", course: "BSA 2B", timeIn: "1:00 PM", timeOut: "5:01 PM", duration: "4h 1m", status: "Complete" },
          { id: "r11", studentId: "2022-002345", name: "Pedro Garcia", org: "CSS", course: "BSCS 2A", timeIn: "1:15 PM", timeOut: "5:00 PM", duration: "3h 45m", status: "Complete" },
          { id: "r12", studentId: "2022-003456", name: "Ana Reyes", org: "RCY", course: "BSIT 1A", timeIn: null, timeOut: null, duration: null, status: "Absent" },
          { id: "r13", studentId: "2022-004567", name: "Carlos Lopez", org: "ACSS", course: "BSIT 4A", timeIn: "1:00 PM", timeOut: "4:50 PM", duration: "3h 50m", status: "Complete" },
          { id: "r14", studentId: "2022-005678", name: "Sofia Mendoza", org: "SSG", course: "BSIT 2B", timeIn: "1:05 PM", timeOut: "5:00 PM", duration: "3h 55m", status: "Complete" },
          { id: "r15", studentId: "2022-006789", name: "Miguel Torres", org: "JPIA", course: "BSA 3A", timeIn: "1:00 PM", timeOut: "4:30 PM", duration: "3h 30m", status: "Flagged", note: "Left early without sign-out" },
          { id: "r16", studentId: "2022-007890", name: "Isabella Cruz", org: "CSS", course: "BSCS 3B", timeIn: "1:10 PM", timeOut: "5:00 PM", duration: "3h 50m", status: "Complete" },
        ],
      },
      {
        id: "s1c",
        label: "Day 2 — Full Day Session",
        date: "Jun 6, 2026",
        timeStart: "8:00 AM",
        timeEnd: "5:00 PM",
        records: [
          { id: "r17", studentId: "2022-001234", name: "Juan Dela Cruz", org: "SSG", course: "BSIT 3A", timeIn: "7:58 AM", timeOut: "5:02 PM", duration: "9h 4m", status: "Complete" },
          { id: "r18", studentId: "2022-001456", name: "Maria Santos", org: "JPIA", course: "BSA 2B", timeIn: "8:05 AM", timeOut: "5:00 PM", duration: "8h 55m", status: "Complete" },
          { id: "r19", studentId: "2022-002345", name: "Pedro Garcia", org: "CSS", course: "BSCS 2A", timeIn: "8:30 AM", timeOut: "5:00 PM", duration: "8h 30m", status: "Late", note: "Late by 30 min" },
          { id: "r20", studentId: "2022-003456", name: "Ana Reyes", org: "RCY", course: "BSIT 1A", timeIn: "8:00 AM", timeOut: "5:00 PM", duration: "9h 0m", status: "Complete" },
          { id: "r21", studentId: "2022-004567", name: "Carlos Lopez", org: "ACSS", course: "BSIT 4A", timeIn: "8:00 AM", timeOut: "5:00 PM", duration: "9h 0m", status: "Complete" },
          { id: "r22", studentId: "2022-005678", name: "Sofia Mendoza", org: "SSG", course: "BSIT 2B", timeIn: null, timeOut: null, duration: null, status: "Absent" },
          { id: "r23", studentId: "2022-006789", name: "Miguel Torres", org: "JPIA", course: "BSA 3A", timeIn: "8:00 AM", timeOut: "5:00 PM", duration: "9h 0m", status: "Complete" },
          { id: "r24", studentId: "2022-007890", name: "Isabella Cruz", org: "CSS", course: "BSCS 3B", timeIn: "8:00 AM", timeOut: "5:00 PM", duration: "9h 0m", status: "Complete" },
        ],
      },
    ],
  },
  {
    id: "e2",
    name: "Tech Talks: AI & the Future",
    date: "Jun 10, 2026",
    venue: "Room 301 — STI Ormoc",
    org: "STI IT Guild",
    orgInitials: "IG",
    category: "Talk",
    registered: 85,
    checkedIn: 82,
    absent: 3,
    flagged: 1,
    status: "Completed",
    sessions: [
      {
        id: "s2a",
        label: "Single Session",
        date: "Jun 10, 2026",
        timeStart: "9:00 AM",
        timeEnd: "12:00 PM",
        records: [
          { id: "r25", studentId: "2022-008901", name: "Luis Fernandez", org: "IG", course: "BSIT 3B", timeIn: "8:58 AM", timeOut: "12:01 PM", duration: "3h 3m", status: "Complete" },
          { id: "r26", studentId: "2022-009012", name: "Chloe Villanueva", org: "IG", course: "BSIT 3A", timeIn: "9:10 AM", timeOut: "12:00 PM", duration: "2h 50m", status: "Late", note: "Late by 10 min" },
          { id: "r27", studentId: "2022-010123", name: "Marco Aquino", org: "JPIA", course: "BSA 4A", timeIn: null, timeOut: null, duration: null, status: "Absent" },
          { id: "r28", studentId: "2022-011234", name: "Jasmine Ocampo", org: "CSS", course: "BSCS 2B", timeIn: "9:02 AM", timeOut: "12:00 PM", duration: "2h 58m", status: "Complete" },
          { id: "r29", studentId: "2022-012345", name: "Diego Santos", org: "IG", course: "BSIT 2A", timeIn: "9:00 AM", timeOut: "11:45 AM", duration: "2h 45m", status: "Flagged", note: "Duplicate scan detected" },
          { id: "r30", studentId: "2022-013456", name: "Elena Ramos", org: "IG", course: "BSIT 1B", timeIn: "9:05 AM", timeOut: "12:00 PM", duration: "2h 55m", status: "Complete" },
        ],
      },
    ],
  },
  {
    id: "e3",
    name: "Blood Donation Drive",
    date: "Jun 14, 2026",
    venue: "SAO Office — STI Ormoc",
    org: "Red Cross Youth",
    orgInitials: "RCY",
    category: "Outreach",
    registered: 120,
    checkedIn: 98,
    absent: 22,
    flagged: 0,
    status: "Completed",
    sessions: [
      {
        id: "s3a",
        label: "Morning Batch",
        date: "Jun 14, 2026",
        timeStart: "8:00 AM",
        timeEnd: "11:30 AM",
        records: [
          { id: "r31", studentId: "2022-014567", name: "Patricia Navarro", org: "RCY", course: "BSIT 2B", timeIn: "8:00 AM", timeOut: "9:15 AM", duration: "1h 15m", status: "Complete" },
          { id: "r32", studentId: "2022-015678", name: "Ramon Castillo", org: "RCY", course: "BSA 1A", timeIn: "8:30 AM", timeOut: "9:45 AM", duration: "1h 15m", status: "Complete" },
          { id: "r33", studentId: "2022-016789", name: "Bianca Flores", org: "JPIA", course: "BSA 2A", timeIn: null, timeOut: null, duration: null, status: "Absent" },
          { id: "r34", studentId: "2022-017890", name: "Kenneth Cruz", org: "CSS", course: "BSCS 1A", timeIn: "9:00 AM", timeOut: "10:15 AM", duration: "1h 15m", status: "Complete" },
        ],
      },
      {
        id: "s3b",
        label: "Afternoon Batch",
        date: "Jun 14, 2026",
        timeStart: "1:00 PM",
        timeEnd: "4:30 PM",
        records: [
          { id: "r35", studentId: "2022-018901", name: "Tricia Morales", org: "RCY", course: "BSIT 3A", timeIn: "1:05 PM", timeOut: "2:20 PM", duration: "1h 15m", status: "Complete" },
          { id: "r36", studentId: "2022-019012", name: "Aldrin Bautista", org: "ACSS", course: "BSIT 4B", timeIn: null, timeOut: null, duration: null, status: "Absent" },
          { id: "r37", studentId: "2022-020123", name: "Shaira Domingo", org: "RCY", course: "BSA 3B", timeIn: "1:15 PM", timeOut: "2:35 PM", duration: "1h 20m", status: "Complete" },
          { id: "r38", studentId: "2022-021234", name: "Raphael Soriano", org: "CSS", course: "BSCS 4A", timeIn: "2:00 PM", timeOut: "3:15 PM", duration: "1h 15m", status: "Late", note: "Late to afternoon slot" },
        ],
      },
    ],
  },
  {
    id: "e4",
    name: "Marketing Workshop",
    date: "Jun 18, 2026",
    venue: "Conference Room B",
    org: "JMAP",
    orgInitials: "JM",
    category: "Workshop",
    registered: 65,
    checkedIn: 61,
    absent: 4,
    flagged: 0,
    status: "Completed",
    sessions: [
      {
        id: "s4a",
        label: "Full Day Workshop",
        date: "Jun 18, 2026",
        timeStart: "8:00 AM",
        timeEnd: "5:00 PM",
        records: [
          { id: "r39", studentId: "2022-022345", name: "Camille Reyes", org: "JMAP", course: "BSA 2A", timeIn: "8:00 AM", timeOut: "5:00 PM", duration: "9h 0m", status: "Complete" },
          { id: "r40", studentId: "2022-023456", name: "Andrei Pascual", org: "JMAP", course: "BSA 3B", timeIn: "8:10 AM", timeOut: "5:00 PM", duration: "8h 50m", status: "Complete" },
          { id: "r41", studentId: "2022-024567", name: "Lara Gonzales", org: "JMAP", course: "BSA 1B", timeIn: null, timeOut: null, duration: null, status: "Absent" },
          { id: "r42", studentId: "2022-025678", name: "Vincent Tan", org: "JMAP", course: "BSA 4A", timeIn: "8:00 AM", timeOut: "4:45 PM", duration: "8h 45m", status: "Complete" },
          { id: "r43", studentId: "2022-026789", name: "Nikki Basco", org: "ACSS", course: "BSIT 2A", timeIn: "8:15 AM", timeOut: "5:00 PM", duration: "8h 45m", status: "Late", note: "Late by 15 min" },
        ],
      },
    ],
  },
  {
    id: "e5",
    name: "Sportsfest Opening Ceremony",
    date: "Jul 5, 2026",
    venue: "STI Ormoc Sports Complex",
    org: "Supreme Student Government",
    orgInitials: "SSG",
    category: "Sports",
    registered: 320,
    checkedIn: 0,
    absent: 0,
    flagged: 0,
    status: "Upcoming",
    sessions: [],
  },
];

// Chart data is now computed dynamically below

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: AttendStatus }) {
  const map: Record<AttendStatus, string> = {
    Complete: "bg-green-100 text-green-700",
    "Checked In": "bg-blue-100 text-blue-700",
    Absent: "bg-red-100 text-red-600",
    Flagged: "bg-amber-100 text-amber-700",
    Late: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${map[status]}`}>{status}</span>
  );
}

// ─── Event Card ────────────────────────────────────────────────────────────────
function EventCard({ event, onClick }: { event: Event; onClick: () => void }) {
  const rate = event.registered > 0 ? Math.round((event.checkedIn / event.registered) * 100) : 0;
  const statusColor = {
    Completed: "bg-green-100 text-green-700",
    Ongoing: "bg-blue-100 text-blue-700",
    Upcoming: "bg-gray-100 text-gray-500",
  }[event.status];

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-[#E0E0E0] rounded-2xl p-5 hover:border-[#001A4D]/40 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#001A4D] to-[#83358E] rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {event.orgInitials}
          </div>
          <div>
            <p className="text-[#001A4D] font-bold text-sm leading-tight">{event.name}</p>
            <p className="text-gray-500 text-xs mt-0.5">{event.org}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#001A4D] transition-colors flex-shrink-0 mt-1" />
      </div>

      <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{event.date}</span>
        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{event.venue}</span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusColor}`}>{event.status}</span>
        <span className="text-xs text-gray-500 font-medium">
          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold">{event.category}</span>
        </span>
      </div>

      <div className="flex items-center justify-between text-xs mb-1.5 mt-2">
        <span className="text-gray-500">{event.checkedIn} / {event.registered} attended</span>
        <span className={`font-bold ${rate >= 90 ? "text-green-600" : rate >= 75 ? "text-amber-600" : "text-gray-500"}`}>{rate}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
        <div
          className={`h-full rounded-full ${rate >= 90 ? "bg-green-500" : rate >= 75 ? "bg-amber-400" : rate > 0 ? "bg-blue-500" : "bg-gray-200"}`}
          style={{ width: `${rate}%` }}
        />
      </div>
      {event.flagged > 0 && (
        <p className="text-amber-600 text-[11px] font-medium mt-1.5 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />{event.flagged} flagged entries
        </p>
      )}
    </button>
  );
}

// ─── Event Detail View ─────────────────────────────────────────────────────────
function EventDetail({ event, onBack }: { event: Event; onBack: () => void }) {
  const [activeSession, setActiveSession] = useState(event.sessions[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendStatus | "All">("All");

  const session = event.sessions.find((s) => s.id === activeSession);
  const allRecords = event.sessions.flatMap((s) => s.records);

  const complete = allRecords.filter((r) => r.status === "Complete").length;
  const absent = allRecords.filter((r) => r.status === "Absent").length;
  const late = allRecords.filter((r) => r.status === "Late").length;
  const flagged = allRecords.filter((r) => r.status === "Flagged").length;
  const checkedIn = allRecords.filter((r) => r.status === "Checked In").length;
  const rate = event.registered > 0 ? Math.round((event.checkedIn / event.registered) * 100) : 0;

  const filteredRecords = (session?.records ?? []).filter((r) => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.studentId.includes(search) ||
      r.org.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = session ? {
    Complete: session.records.filter((r) => r.status === "Complete").length,
    Absent: session.records.filter((r) => r.status === "Absent").length,
    Late: session.records.filter((r) => r.status === "Late").length,
    Flagged: session.records.filter((r) => r.status === "Flagged").length,
    "Checked In": session.records.filter((r) => r.status === "Checked In").length,
  } : {};

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#001A4D] text-sm font-medium hover:text-[#83358E] transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Events
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-[#001A4D] to-[#83358E] rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {event.orgInitials}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#001A4D]">{event.name}</h2>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{event.date}</span>
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{event.venue}</span>
                <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{event.org}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Registered", value: event.registered, color: "text-[#001A4D]", bg: "bg-blue-50", icon: UserCheck },
          { label: "Attended", value: `${event.checkedIn} (${rate}%)`, color: "text-green-600", bg: "bg-green-50", icon: CheckCircle2 },
          { label: "Absent", value: absent, color: "text-red-500", bg: "bg-red-50", icon: XCircle },
          { label: "Late", value: late, color: "text-orange-600", bg: "bg-orange-50", icon: Timer },
          { label: "Flagged", value: flagged, color: "text-amber-600", bg: "bg-amber-50", icon: AlertCircle },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`${s.bg} border border-gray-200 rounded-2xl p-4`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{s.label}</p>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Sessions tabs */}
      {event.sessions.length > 0 ? (
        <>
          {event.sessions.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {event.sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setActiveSession(s.id); setSearch(""); setStatusFilter("All"); }}
                  className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSession === s.id
                    ? "bg-[#001A4D] text-white shadow-sm"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  {s.label}
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${activeSession === s.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                    }`}>
                    {s.records.length}
                  </span>
                </button>
              ))}
            </div>
          )}

          {session && (
            <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden">
              {/* Session header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="border-l-4 border-[#83358E] pl-3">
                      <h3 className="text-[#001A4D] font-bold text-base">{session.label}</h3>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {session.date} · {session.timeStart} — {session.timeEnd}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Session mini-stats */}
                <div className="flex gap-3 text-xs">
                  {(Object.entries(statusCounts) as [AttendStatus, number][])
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => (
                      <span key={k} className={`flex items-center gap-1 font-medium px-2 py-1 rounded-full ${k === "Complete" ? "bg-green-100 text-green-700" :
                        k === "Absent" ? "bg-red-100 text-red-600" :
                          k === "Late" ? "bg-orange-100 text-orange-600" :
                            k === "Flagged" ? "bg-amber-100 text-amber-700" :
                              "bg-blue-100 text-blue-700"
                        }`}>
                        {v} {k}
                      </span>
                    ))
                  }
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search student name, ID, or org..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent bg-white"
                  />
                </div>
                <div className="flex gap-1">
                  {(["All", "Complete", "Late", "Absent", "Flagged"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s as AttendStatus | "All")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s
                        ? "bg-[#001A4D] text-white"
                        : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Attendance table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {["#", "Student ID", "Name", "Organization", "Course", "Time In", "Time Out", "Duration", "Status", "Notes"].map((col) => (
                        <th key={col} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRecords.map((rec, i) => (
                      <tr
                        key={rec.id}
                        className={`transition-colors ${rec.status === "Absent" ? "bg-red-50/30 hover:bg-red-50/50" :
                          rec.status === "Flagged" ? "bg-amber-50/40 hover:bg-amber-50/60" :
                            rec.status === "Late" ? "bg-orange-50/30 hover:bg-orange-50/50" :
                              "hover:bg-gray-50"
                          }`}
                      >
                        <td className="px-4 py-3 text-gray-400 text-sm">{i + 1}</td>
                        <td className="px-4 py-3 text-gray-600 text-sm font-mono">{rec.studentId}</td>
                        <td className="px-4 py-3">
                          <p className="text-[#001A4D] font-medium text-sm">{rec.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-[#001A4D]/10 text-[#001A4D] text-xs rounded font-medium">{rec.org}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-sm">{rec.course}</td>
                        <td className="px-4 py-3">
                          {rec.timeIn ? (
                            <span className="flex items-center gap-1.5 text-sm">
                              <Clock className="w-3.5 h-3.5 text-green-500" />
                              <span className="font-medium text-green-700">{rec.timeIn}</span>
                            </span>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {rec.timeOut ? (
                            <span className="flex items-center gap-1.5 text-sm">
                              <Clock className="w-3.5 h-3.5 text-blue-400" />
                              <span className="font-medium text-blue-700">{rec.timeOut}</span>
                            </span>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {rec.duration ? (
                            <span className="flex items-center gap-1 text-sm text-gray-700">
                              <Timer className="w-3.5 h-3.5 text-gray-400" />
                              {rec.duration}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={rec.status} />
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs italic">
                          {rec.note ?? "—"}
                        </td>
                      </tr>
                    ))}
                    {filteredRecords.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm">
                          No records match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-gray-500 text-xs">
                  Showing {filteredRecords.length} of {session.records.length} records
                </p>
                <p className="text-gray-500 text-xs">
                  Scanned via QR · Session: {session.timeStart} — {session.timeEnd}
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-12 text-center">
          <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No attendance data yet</p>
          <p className="text-gray-400 text-sm mt-1">This event hasn't started. Attendance will appear here once scanning begins.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AttendanceMonitoring() {
  const { events: dbEvents, loading: eventsLoading } = useAllEvents();
  const { attendance: dbAttendance, loading: attendanceLoading } = useAttendanceStream();
  const { venues, loading: venuesLoading } = useVenuesStream();
  const { categories: dbCategories, loading: categoriesLoading } = useEventCategoriesStream();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventSearch, setEventSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const loading = eventsLoading || attendanceLoading || venuesLoading || categoriesLoading;

  const mappedEvents: Event[] = useMemo(() => {
    if (dbEvents.length === 0) return FALLBACK_EVENTS;

    return dbEvents.map(evt => {
      const evtAttendance = dbAttendance.filter(a => a.eventId === evt.id || a.event === evt.title);
      
      const registered = evt.expectedParticipantCount || evtAttendance.length || 50;
      const checkedIn = evtAttendance.filter(a => a.status === "Checked In" || a.status === "Complete" || a.status === "Late").length;
      const absent = evtAttendance.filter(a => a.status === "Absent").length;
      const flagged = evtAttendance.filter(a => a.status === "Flagged").length;

      const sessions: EventSession[] = (evt.sessions && evt.sessions.length > 0) ? evt.sessions.map((s, i) => ({
        id: s.id || `session-${i}`,
        label: s.title || "Main Session",
        date: s.date || "TBA",
        timeStart: s.startTime || "8:00 AM",
        timeEnd: s.endTime || "5:00 PM",
        records: evtAttendance.map((rec) => ({
          id: rec.id,
          studentId: rec.studentId,
          name: rec.name,
          org: rec.org,
          course: "TBA",
          timeIn: rec.checkIn === "—" ? null : rec.checkIn,
          timeOut: rec.checkOut === "—" ? null : rec.checkOut,
          duration: null,
          status: rec.status as AttendStatus,
          note: rec.flaggedReason || undefined,
        }))
      })) : [
        {
          id: `${evt.id}-main`,
          label: "Main Session",
          date: "TBA",
          timeStart: "TBA",
          timeEnd: "TBA",
          records: evtAttendance.map(rec => ({
            id: rec.id,
            studentId: rec.studentId,
            name: rec.name,
            org: rec.org,
            course: "TBA",
            timeIn: rec.checkIn === "—" ? null : rec.checkIn,
            timeOut: rec.checkOut === "—" ? null : rec.checkOut,
            duration: null,
            status: rec.status as AttendStatus,
            note: rec.flaggedReason || undefined,
          }))
        }
      ];

      const eventDate = evt.sessions?.[0]?.date || "Date TBA";
      
      let eventStatus: "Ongoing" | "Completed" | "Upcoming" = "Upcoming";
      if (evt.proposalStatus === "approved") {
        if (checkedIn > 0 && absent > 0) eventStatus = "Completed"; // Simple heuristic for completed
        else if (checkedIn > 0) eventStatus = "Ongoing";
        else eventStatus = "Upcoming";
      }

      const venueObj = venues.find(v => v.id === evt.venueId);
      const venueName = venueObj ? venueObj.name : (evt.venueId || "Venue TBA");
      
      const catObj = dbCategories.find(c => c.id === evt.eventCategoryId);
      const catName = catObj ? catObj.name : (evt.eventCategoryId || "General");

      return {
        id: evt.id,
        name: evt.title,
        date: eventDate,
        venue: venueName,
        org: evt.hostingOrgId || "SAO",
        orgInitials: evt.hostingOrgId ? evt.hostingOrgId.substring(0, 3).toUpperCase() : "SAO",
        category: catName,
        registered,
        checkedIn,
        absent,
        flagged,
        status: eventStatus,
        sessions,
      };
    });
  }, [dbEvents, dbAttendance, venues, dbCategories]);

  const categories = ["All", ...Array.from(new Set(mappedEvents.map((e) => e.category)))];

  const filteredEvents = mappedEvents.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(eventSearch.toLowerCase()) ||
      e.org.toLowerCase().includes(eventSearch.toLowerCase());
    const matchCat = categoryFilter === "All" || e.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const totalRegistered = mappedEvents.reduce((s, e) => s + e.registered, 0);
  const totalCheckedIn = mappedEvents.reduce((s, e) => s + e.checkedIn, 0);
  const totalAbsent = mappedEvents.reduce((s, e) => s + e.absent, 0);
  const totalFlagged = mappedEvents.reduce((s, e) => s + e.flagged, 0);

  const overviewChart = useMemo(() => mappedEvents.filter((e) => e.status !== "Upcoming").map((e) => ({
    event: e.name.length > 18 ? e.name.slice(0, 18) + "…" : e.name,
    registered: e.registered,
    checkedIn: e.checkedIn,
    absent: e.absent,
  })), [mappedEvents]);

  if (selectedEvent) {
    return <EventDetail event={selectedEvent} onBack={() => setSelectedEvent(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-[#001A4D]">Attendance Monitoring</h2>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-[#0E4EBD]" />}
        </div>
        <p className="text-gray-500 text-sm">Track and monitor event attendance via QR code scanning</p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Total Registered", value: totalRegistered, color: "text-[#001A4D]", bg: "bg-blue-50", icon: UserCheck, note: `Across ${mappedEvents.length} events` },
          { label: "Checked In", value: totalCheckedIn, color: "text-green-600", bg: "bg-green-50", icon: CheckCircle2, note: `${Math.round((totalCheckedIn / totalRegistered) * 100)}% overall rate` },
          { label: "Checked Out", value: Math.round(totalCheckedIn * 0.94), color: "text-blue-600", bg: "bg-sky-50", icon: CheckCircle2, note: "94% completion" },
          { label: "Absent", value: totalAbsent, color: "text-red-500", bg: "bg-red-50", icon: XCircle, note: `${Math.round((totalAbsent / totalRegistered) * 100)}% no-show rate` },
          { label: "Flagged", value: totalFlagged, color: "text-amber-600", bg: "bg-amber-50", icon: AlertCircle, note: "Require review" },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`${c.bg} border border-gray-200 rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{c.label}</p>
                <Icon className={`w-4 h-4 ${c.color}`} />
              </div>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-gray-400 text-xs mt-1">{c.note}</p>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="border-l-4 border-[#83358E] pl-3">
            <h3 className="text-[#001A4D] font-bold text-base">Attendance Overview by Event</h3>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#001A4D] inline-block" />Checked In</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Absent</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={overviewChart} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="event" stroke="#666" tick={{ fontSize: 11 }} />
            <YAxis stroke="#666" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar key="checkedIn" dataKey="checkedIn" fill="#001A4D" name="Checked In" radius={[4, 4, 0, 0]} />
            <Bar key="absent" dataKey="absent" fill="#EF4444" name="Absent" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Events section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="border-l-4 border-[#83358E] pl-3">
            <h3 className="text-[#001A4D] font-bold text-base">All Events</h3>
            <p className="text-gray-500 text-xs mt-0.5">Click an event to view detailed attendance records</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search events..."
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent w-52"
              />
            </div>
            <div className="flex gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${categoryFilter === cat ? "bg-[#001A4D] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
          ))}
          {filteredEvents.length === 0 && (
            <div className="col-span-3 py-16 text-center text-gray-400">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <p>No events match your search.</p>
            </div>
          )}
        </div>
      </div>

      {/* Flagged banner */}
      {totalFlagged > 0 && (
        <div className="flex items-start gap-3 p-5 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-[#001A4D] mb-1">{totalFlagged} Flagged Entries Require Review</h3>
            <p className="text-sm text-gray-700 mb-3">
              These attendance records have anomalies such as duplicate scans, early check-outs, or late arrivals that need manual verification.
            </p>
            <button className="px-4 py-2 bg-[#001A4D] text-white rounded-lg text-sm font-medium hover:bg-[#001A4D]/90 transition-colors">
              Review Flagged Entries
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
