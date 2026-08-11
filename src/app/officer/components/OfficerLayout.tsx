import { Outlet, useLocation, Navigate } from 'react-router';
import { ShieldAlert, LogOut, Mail, Lock } from 'lucide-react';
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
  const { profile, activeOrgStatus, activeOrgName, loading, logout } = useOfficerProfile();
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

  // Intercept layout if organization status is suspended, inactive, or archived
  const isSuspendedOrInactive = ['suspended', 'inactive', 'archived'].includes(activeOrgStatus);
  if (isSuspendedOrInactive) {
    return (
      <div className="min-h-screen bg-[#001A4D] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl text-center space-y-6 border border-amber-200 relative overflow-hidden">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl mx-auto flex items-center justify-center text-amber-600 shadow-inner">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              <Lock className="w-3.5 h-3.5" /> Account Restricted
            </div>
            <h2 className="text-2xl font-extrabold text-[#001A4D]">Organization {activeOrgStatus === 'suspended' ? 'Suspended' : 'Inactive'}</h2>
            <p className="text-sm font-semibold text-gray-700 mt-1">{activeOrgName}</p>
          </div>

          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-950 leading-relaxed text-left space-y-2">
            <p className="font-bold text-amber-900 flex items-center gap-1.5">
              ⚠️ SAO Administrative Restriction
            </p>
            <p>
              The SAO Administration has set <strong>{activeOrgName}</strong> to <strong>{activeOrgStatus}</strong> status.
            </p>
            <p>
              While in this state, officers are restricted from hosting events, launching attendance scanning, submitting proposals, or accessing portal resources.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <button
              onClick={() => logout()}
              className="w-full py-3 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Log Out of Officer Account
            </button>
            <p className="text-[11px] text-gray-400">
              Need assistance? Contact SAO Adviser / Student Affairs Office.
            </p>
          </div>
        </div>
      </div>
    );
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

