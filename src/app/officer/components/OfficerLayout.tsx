import { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate, useNavigate } from 'react-router';
import { ShieldAlert, LogOut, Mail, Lock, KeyRound, ArrowRight } from 'lucide-react';
import { OfficerSidebar } from './OfficerSidebar';
import { OfficerTopNav } from './OfficerTopNav';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { FirstTimePasswordReminderModal } from './FirstTimePasswordReminderModal';

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
  const navigate = useNavigate();
  const { profile, activeOrgStatus, activeOrgName, loading, logout } = useOfficerProfile();
  const title = pageTitles[location.pathname] || 'Officer Portal';

  const [showReminderModal, setShowReminderModal] = useState(false);

  useEffect(() => {
    if (profile?.requiresPasswordChange) {
      const dismissed = sessionStorage.getItem('sti_dismissed_pwd_reminder');
      if (!dismissed) {
        setShowReminderModal(true);
      }
    }
  }, [profile?.requiresPasswordChange]);

  const handleDismissReminder = () => {
    sessionStorage.setItem('sti_dismissed_pwd_reminder', 'true');
    setShowReminderModal(false);
  };

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
          {/* Subtle Security Reminder Banner if temporary password is in use */}
          {profile.requiresPasswordChange && location.pathname !== '/officer/settings' && (
            <div className="mb-6 px-4 py-3 bg-white border-l-4 border-[#FFC107] border-y border-r border-gray-200/80 rounded-r-2xl shadow-xs flex items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                  <KeyRound className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#001A4D]">Temporary Password In Use</p>
                  <p className="text-[11px] text-gray-500">Protect your account by creating your personal password in Settings.</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/officer/settings?tab=security')}
                className="px-3.5 py-1.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-[#FFD41C] text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
              >
                <span>Change Password</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <Outlet />
        </main>
      </div>

      {/* Exitable First-Time Login Password Reminder Modal */}
      <FirstTimePasswordReminderModal
        isOpen={showReminderModal}
        onClose={handleDismissReminder}
        isAdviser={profile.isAdviser}
      />
    </div>
  );
}

