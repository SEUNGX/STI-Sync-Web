import { Link, useLocation, useNavigate } from "react-router";
import stiSyncLogo from '../../../../imports/STI_SYNC_LOGO.jpg';
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
  Shield,
  Settings,
  LogOut,
  GraduationCap,
  Banknote,
  Files,
} from "lucide-react";
import { useAdviserProfile, signOutAdviser } from '../../../modules/auth';

const navGroups = [
  {
    title: "Main",
    items: [
      { icon: LayoutDashboard, label: "Dashboard Overview", path: "/home" },
      { icon: Users, label: "Student Registry", path: "/home/students" },
      { icon: GraduationCap, label: "Academic Semester", path: "/home/academic-semester" },
    ]
  },
  {
    title: "Organizations & Activities",
    items: [
      { icon: Building2, label: "Organization Management", path: "/home/organizations" },
      { icon: CalendarCheck, label: "Event Approvals", path: "/home/event-approvals" },
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
      { icon: Shield, label: "Audit Logs", path: "/home/audit-logs" },
      { icon: Settings, label: "System Settings", path: "/home/settings" },
    ]
  }
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAdviserProfile();

  // Derive initials from live profile, fallback to '?' while loading
  const initials = profile
    ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase()
    : '?';

  const handleLogout = async () => {
    await signOutAdviser();
    navigate('/');
  };

  return (
    <div className="fixed left-0 top-0 h-screen w-[260px] bg-[#001A4D] flex flex-col">
      {/* Logo and Role */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <img src={stiSyncLogo} alt="STI Sync" className="w-8 h-8 object-cover rounded-lg" />
          <span className="text-white font-bold text-lg">STI Sync</span>
        </div>
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#FFC107] text-[#001A4D] text-xs font-semibold">
          SAS Admin
        </div>
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

      {/* User Profile */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-[#0E4EBD] to-[#1E70E8] rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">
              {profile?.displayName ?? 'Loading...'}
            </div>
            <div className="text-[#FFD54F] text-xs truncate">
              {profile?.position ?? ''}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
