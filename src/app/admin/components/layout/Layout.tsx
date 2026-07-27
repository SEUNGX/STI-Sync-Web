import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { Toaster } from "../../../components/ui/sonner";

const pageTitles: Record<string, string> = {
  "/home": "Dashboard Overview",
  "/home/organizations": "Organization Management",
  "/home/event-approvals": "Event Approvals",
  "/home/attendance": "Attendance Monitoring",
  "/home/liquidations": "Financial Liquidations",
  "/home/students": "Student Registry",
  "/home/reports": "Reports & Analytics",
  "/home/announcements": "Announcements",
  "/home/audit-logs": "Audit Logs",
  "/home/settings": "System Settings",
  "/home/academic-semester": "Academic Year & Semester",
  "/home/budget-fund": "Budget & Fund Management",
  "/home/documents": "Document Management",
};

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = pageTitles[location.pathname] || "SAO Admin Panel";
  const [globalSearch, setGlobalSearch] = useState("");

  const handleLogout = () => {
    navigate('/');
  };

  const handleNavigateSettings = () => {
    navigate('/home/settings');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-[260px]">
        <TopNav
          title={title}
          globalSearch={globalSearch}
          onSearchChange={setGlobalSearch}
          onLogout={handleLogout}
          onNavigateSettings={handleNavigateSettings}
        />
        <main className="p-6">
          <Outlet context={{ globalSearch, setGlobalSearch }} />
        </main>
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
