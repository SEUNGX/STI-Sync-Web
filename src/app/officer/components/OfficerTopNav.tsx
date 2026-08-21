import { useState } from 'react';
import { Search, Bell, ChevronDown, User, Settings, LogOut, Zap } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { DevDataSeederModal } from '../../../dev/components/DevDataSeederModal';

interface OfficerTopNavProps {
  title: string;
}

export function OfficerTopNav({ title }: OfficerTopNavProps) {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSeederModal, setShowSeederModal] = useState(false);

  const { profile, logout } = useOfficerProfile();

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
    navigate('/officer/login');
  };

  const initials = profile?.studentName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'OG';

  const handleSettings = () => {
    setShowUserMenu(false);
    navigate('/officer/settings');
  };

  return (
    <div className="h-14 bg-white border-b border-[#E0E0E0] flex items-center justify-between px-6">
      {/* Page Title */}
      <h1 className="text-lg font-bold text-[#001A4D]">{title}</h1>

      {/* Right Side */}
      <div className="flex items-center gap-3">
        {/* Quick Dev Data Seeder Trigger (Development Only) */}
        {import.meta.env.DEV && (
          <button
            onClick={() => setShowSeederModal(true)}
            title="Open Dev Test Data Seeder (Development Only)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-700 font-bold text-xs transition-all cursor-pointer shadow-2xs"
          >
            <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span className="hidden sm:inline">Dev Seeder</span>
          </button>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search students, events..."
            className="pl-9 pr-4 py-2 w-64 h-9 border border-[#E0E0E0] rounded-lg text-sm focus:border-[#7F77DD] focus:ring-2 focus:ring-[#7F77DD]/20 outline-none"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5 text-[#001A4D]" />
          <span className="absolute top-1 right-1 w-5 h-5 bg-[#E24B4A] rounded-full flex items-center justify-center text-white text-[10px] font-bold">
            5
          </span>
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors"
          >
            <div className="w-8 h-8 bg-[#7F77DD] rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {initials}
            </div>
            <span className="text-sm font-medium text-[#001A4D]">{profile?.studentName || 'Officer'}</span>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#E0E0E0] rounded-xl shadow-lg z-20 overflow-hidden">
                <div className="p-3 border-b border-[#E0E0E0]">
                  <p className="text-sm font-bold text-[#001A4D]">{profile?.studentName || 'Officer'}</p>
                  <p className="text-xs text-[#888780]">Organization Officer</p>
                </div>
                <div className="py-2">
                  <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors text-left">
                    <User className="w-4 h-4 text-[#888780]" />
                    <span className="text-sm text-[#001A4D]">Profile</span>
                  </button>
                  <button
                    onClick={handleSettings}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors text-left"
                  >
                    <Settings className="w-4 h-4 text-[#888780]" />
                    <span className="text-sm text-[#001A4D]">Settings</span>
                  </button>
                </div>
                <div className="border-t border-[#E0E0E0] py-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4 text-[#E24B4A]" />
                    <span className="text-sm text-[#E24B4A] font-medium">Log Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dev Test Data Seeder Modal (Development Only) */}
      {import.meta.env.DEV && (
        <DevDataSeederModal isOpen={showSeederModal} onClose={() => setShowSeederModal(false)} />
      )}
    </div>
  );
}
