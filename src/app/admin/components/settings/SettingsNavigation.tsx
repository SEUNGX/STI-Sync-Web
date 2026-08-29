import {
  UserCircle, Lock, Activity, Calendar, Book,
  Building, Shield, Users, CalendarDays, QrCode, Award,
  Receipt, AlertTriangle, Coins,
  Database, Eye, Files,
} from 'lucide-react';

interface SettingsNavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  searchQuery: string;
  hasUnsavedChanges: boolean;
}

const navItems = [
  {
    group: 'ACCOUNT',
    items: [
      { id: 'adviser-profile', icon: UserCircle, label: 'Adviser Profile' },
      { id: 'security-password', icon: Lock, label: 'Security & Password' },
      { id: 'login-activity', icon: Activity, label: 'Login Activity' },
    ]
  },
  {
    group: 'ACADEMIC',
    items: [
      { id: 'academic-calendar', icon: Calendar, label: 'Academic Calendar' },
      { id: 'course-department', icon: Book, label: 'Course & Department Registry' },
    ]
  },
  {
    group: 'ORGANIZATIONS',
    items: [
      { id: 'organization-settings', icon: Building, label: 'Organization Settings' },
      { id: 'roles-permissions', icon: Shield, label: 'Roles & Permissions' },
      { id: 'officer-management', icon: Users, label: 'Officer Management' },
    ]
  },
  {
    group: 'EVENTS',
    items: [
      { id: 'event-configuration', icon: CalendarDays, label: 'Event Configuration' },
      { id: 'attendance-qr', icon: QrCode, label: 'Attendance & QR Settings' },
      { id: 'certificate-settings', icon: Award, label: 'Certificate Settings' },
    ]
  },
  {
    group: 'FINANCE',
    items: [
      { id: 'payable-categories', icon: Coins, label: 'Fee & Fine Categories' },
      { id: 'liquidation-settings', icon: Receipt, label: 'Liquidation Settings' },
      { id: 'fine-penalty', icon: AlertTriangle, label: 'Fine & Penalty Rules' },
    ]
  },
  {
    group: 'DOCUMENTS',
    items: [
      { id: 'document-management', icon: Files, label: 'Document Management' },
    ]
  },
  {
    group: 'SYSTEM',
    items: [
      { id: 'data-management', icon: Database, label: 'Data Management' },
      { id: 'audit-visibility', icon: Eye, label: 'Audit & Visibility' },
    ]
  },
];

export default function SettingsNavigation({
  activeSection,
  onSectionChange,
  searchQuery,
  hasUnsavedChanges
}: SettingsNavigationProps) {
  const filteredItems = navItems.map(group => ({
    ...group,
    items: group.items.filter(item =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(group => group.items.length > 0);

  return (
    <nav className="py-2">
      {filteredItems.map((group) => (
        <div key={group.group} className="mb-6">
          <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
            {group.group}
          </div>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors relative ${
                    isActive
                      ? 'bg-[#001A4D] text-white'
                      : 'text-[#001A4D] hover:bg-gray-50'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FFD41C]"></div>
                  )}
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[#001A4D]'}`} />
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {item.badge && (
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      item.badgeColor === 'green' ? 'bg-green-100 text-green-700' :
                      item.badgeColor === 'amber' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  {hasUnsavedChanges && isActive && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                      Unsaved
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
