import { Link, useLocation } from "react-router";
import stiOrmocLogo from '../../../../imports/STI_ORMOC_LOGO.jpg';
import {
  LayoutDashboard,
  Building2,
  CalendarCheck,
  QrCode,
  Receipt,
  Users,
  BarChart3,
  Award,
  Bell,
  Settings,
  GraduationCap,
  Banknote,
  Files,
} from "lucide-react";

const navGroups = [
  {
    title: "Main",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/home" },
      { icon: Users, label: "Student Registry", path: "/home/students" },
      { icon: GraduationCap, label: "Academic Semester", path: "/home/academic-semester" },
    ]
  },
  {
    title: "Organizations & Activities",
    items: [
      { icon: Building2, label: "Organization Management", path: "/home/organizations" },
      { icon: CalendarCheck, label: "Events", path: "/home/event-approvals" },
      { icon: QrCode, label: "Attendance Monitoring", path: "/home/attendance" },
    ]
  },
  {
    title: "Finance & Documents",
    items: [
      { icon: Banknote, label: "Budget & Fund", path: "/home/budget-fund" },
      { icon: Receipt, label: "Financial Liquidations", path: "/home/liquidations" },
      { icon: Files, label: "Document Management", path: "/home/documents" },
      { icon: Award, label: "Certificates", path: "/home/certificates" },
    ]
  },
  {
    title: "System & Reports",
    items: [
      { icon: Bell, label: "Announcements", path: "/home/announcements" },
      { icon: BarChart3, label: "Reports & Analytics", path: "/home/reports" },
      { icon: Settings, label: "System Settings", path: "/home/settings" },
    ]
  }
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="fixed left-0 top-0 h-screen w-[260px] bg-[#001A4D] flex flex-col">
      {/* Centered Large Circular Logo Section (No White Border) */}
      <div className="p-6 border-b border-white/10 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full overflow-hidden shadow-xl mb-3 flex items-center justify-center bg-[#001A4D]">
          <img
            src={stiOrmocLogo}
            alt="STI College Logo"
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="text-white font-black text-lg tracking-tight leading-tight">
          STI Sync
        </h1>
        <p className="text-[#FFD41C] text-[11px] font-bold tracking-wider uppercase mt-1">
          STI College Ormoc
        </p>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 no-scrollbar">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx}>
            <h3 className="px-3 mb-2 text-xs font-semibold text-white/50 uppercase tracking-wider">
              {group.title}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.path === "/home" ? location.pathname === "/home" : location.pathname.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${isActive
                      ? "bg-[#1E70E8]/20 text-white"
                      : "text-[#E0E0E0]/70 hover:text-white hover:bg-white/5"
                      }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FFC107] rounded-r" />
                    )}
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium flex-1">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
