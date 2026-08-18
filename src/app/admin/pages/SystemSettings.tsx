import { Search, AlertTriangle, X } from "lucide-react";
import { useState } from 'react';
import SettingsNavigation from '../components/settings/SettingsNavigation';
import AdviserProfile from '../components/settings/AdviserProfile';
import SecurityPassword from '../components/settings/SecurityPassword';
import LoginActivity from '../components/settings/LoginActivity';
import AcademicCalendar from '../components/settings/AcademicCalendar';
import CourseDepartment from '../components/settings/CourseDepartment';
import OrganizationSettings from '../components/settings/OrganizationSettings';
import RolesPermissions from '../components/settings/RolesPermissions';
import OfficerManagement from '../components/settings/OfficerManagement';
import EventConfiguration from '../components/settings/EventConfiguration';
import AttendanceQRSettings from '../components/settings/AttendanceQRSettings';
import CertificateSettings from '../components/settings/CertificateSettings';
import LiquidationSettings from '../components/settings/LiquidationSettings';
import FinePenaltyRules from '../components/settings/FinePenaltyRules';
import DocumentManagementSettings from '../components/settings/DocumentManagementSettings';
import DataManagement from '../components/settings/DataManagement';
import AuditVisibility from '../components/settings/AuditVisibility';
import ArchiveCenter from '../components/settings/ArchiveCenter';

export function SystemSettings() {
  const [activeSection, setActiveSection] = useState('adviser-profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleUnsavedChange = () => {
    setHasUnsavedChanges(true);
  };

  const handleSectionChange = (section: string) => {
    if (hasUnsavedChanges) {
      const confirmed = confirm('You have unsaved changes. Are you sure you want to leave this section?');
      if (!confirmed) return;
      setHasUnsavedChanges(false);
    }
    setActiveSection(section);
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'adviser-profile':
        return <AdviserProfile onUnsavedChange={handleUnsavedChange} />;
      case 'security-password':
        return <SecurityPassword onUnsavedChange={handleUnsavedChange} />;
      case 'login-activity':
        return <LoginActivity onUnsavedChange={handleUnsavedChange} />;
      case 'academic-calendar':
        return <AcademicCalendar onUnsavedChange={handleUnsavedChange} />;
      case 'course-department':
        return <CourseDepartment onUnsavedChange={handleUnsavedChange} />;
      case 'organization-settings':
        return <OrganizationSettings onUnsavedChange={handleUnsavedChange} />;
      case 'roles-permissions':
        return <RolesPermissions onUnsavedChange={handleUnsavedChange} />;
      case 'officer-management':
        return <OfficerManagement onUnsavedChange={handleUnsavedChange} />;
      case 'event-configuration':
        return <EventConfiguration onUnsavedChange={handleUnsavedChange} />;
      case 'attendance-qr':
        return <AttendanceQRSettings onUnsavedChange={handleUnsavedChange} />;
      case 'certificate-settings':
        return <CertificateSettings onUnsavedChange={handleUnsavedChange} />;
      case 'liquidation-settings':
        return <LiquidationSettings onUnsavedChange={handleUnsavedChange} />;
      case 'fine-penalty':
        return <FinePenaltyRules onUnsavedChange={handleUnsavedChange} />;
      case 'document-management':
        return <DocumentManagementSettings />;
      case 'data-management':
        return <DataManagement onUnsavedChange={handleUnsavedChange} />;
      case 'audit-visibility':
        return <AuditVisibility onUnsavedChange={handleUnsavedChange} />;
      case 'archive-center':
        return <ArchiveCenter onUnsavedChange={handleUnsavedChange} />;
      default:
        return <AdviserProfile onUnsavedChange={handleUnsavedChange} />;
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      {/* Left Sidebar Navigation */}
      <div className="w-[280px] bg-white border border-[#E0E0E0] rounded-xl overflow-hidden flex-shrink-0">
        {/* Search */}
        <div className="p-4 border-b border-[#E0E0E0]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>
        </div>

        {/* Navigation Items */}
        <div className="overflow-y-auto h-[calc(100%-73px)]">
          <SettingsNavigation
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            searchQuery={searchQuery}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
        {/* Unsaved Changes Banner */}
        {hasUnsavedChanges && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-900">You have unsaved changes</span>
            </div>
            <button
              onClick={() => setHasUnsavedChanges(false)}
              className="text-amber-600 hover:text-amber-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto h-full p-8">
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
