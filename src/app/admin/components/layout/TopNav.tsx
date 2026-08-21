import { useState } from "react";
import { Search, Bell, ChevronDown, LogOut, Settings, User, Zap } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { useAdviserProfile, signOutAdviser } from '../../../modules/auth';
import { DevDataSeederModal } from '../../../../dev/components/DevDataSeederModal';

interface TopNavProps {
  title: string;
  globalSearch?: string;
  onSearchChange?: (val: string) => void;
  onLogout?: () => void;
  onNavigateSettings?: () => void;
}

export function TopNav({ title, globalSearch, onSearchChange, onLogout, onNavigateSettings }: TopNavProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSeederModal, setShowSeederModal] = useState(false);
  const { profile } = useAdviserProfile();

  // Initials derived from live profile
  const initials = profile
    ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase()
    : '?';

  const handleLogout = async () => {
    setShowUserMenu(false);
    await signOutAdviser();
    if (onLogout) onLogout();
  };

  const handleSettings = () => {
    setShowUserMenu(false);
    if (onNavigateSettings) {
      onNavigateSettings();
    }
  };
  return (
    <div className="h-14 bg-white border-b border-[#E0E0E0] flex items-center justify-between px-6">
      {/* Page Title */}
      <h1 className="text-lg font-bold text-[#001A4D]">{title}</h1>

      {/* Right Side */}
      <div className="flex items-center gap-3">
        {/* Quick Dev Data Seeder Trigger */}
        <button
          onClick={() => setShowSeederModal(true)}
          title="Open Dev Test Data Seeder"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-700 font-bold text-xs transition-all cursor-pointer shadow-2xs"
        >
          <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
          <span className="hidden sm:inline">Dev Seeder</span>
        </button>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Search..."
            value={globalSearch || ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-9 w-64 h-9 border-[#E0E0E0] focus-visible:ring-[#1E70E8]"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5 text-[#001A4D]" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors"
          >
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-[#0E4EBD] to-[#1E70E8] rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {initials}
              </div>
            )}
            <span className="text-sm font-medium text-[#001A4D]">
              {profile?.displayName ?? 'Loading...'}
            </span>
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
                  <p className="text-sm font-bold text-[#001A4D]">
                    {profile?.displayName ?? 'SAO Adviser'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {profile?.position ?? ''}
                  </p>
                </div>
                <div className="py-2">
                  <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors text-left">
                    <User className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-[#001A4D]">Profile</span>
                  </button>
                  <button
                    onClick={handleSettings}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors text-left"
                  >
                    <Settings className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-[#001A4D]">Settings</span>
                  </button>
                </div>
                <div className="border-t border-[#E0E0E0] py-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-600 font-medium">Log Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dev Test Data Seeder Modal */}
      <DevDataSeederModal isOpen={showSeederModal} onClose={() => setShowSeederModal(false)} />
    </div>
  );
}
