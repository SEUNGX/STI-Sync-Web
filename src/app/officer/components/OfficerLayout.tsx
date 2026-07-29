import { Outlet, useLocation, Navigate } from 'react-router';
import { OfficerSidebar } from './OfficerSidebar';
import { OfficerTopNav } from './OfficerTopNav';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';

const pageTitles: Record<string, string> = {
  '/officer/dashboard': 'Dashboard',
  '/officer/events': 'Event Management',
  '/officer/attendance': 'Attendance Logs',
  '/officer/liquidation': 'Financial Liquidation',
  '/officer/members': 'Member Directory',
  '/officer/organization': 'Organization Profile',
  '/officer/announcements': 'Announcements',
  '/officer/settings': 'Settings',
};

export function OfficerLayout() {
  const location = useLocation();
  const { profile, loading } = useOfficerProfile();
  const title = pageTitles[location.pathname] || 'Officer Portal';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F8F8]">
        <div className="w-8 h-8 border-4 border-[#0E4EBD] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/officer/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <OfficerSidebar />
      <div className="ml-[240px]">
        <OfficerTopNav title={title} />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
