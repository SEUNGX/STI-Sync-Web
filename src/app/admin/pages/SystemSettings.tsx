import { Search } from "lucide-react";
import { useState, useEffect } from 'react';
import SettingsNavigation from '../components/settings/SettingsNavigation';
import AdviserProfile from '../components/settings/AdviserProfile';
import SecurityPassword from '../components/settings/SecurityPassword';
import AcademicCalendar from '../components/settings/AcademicCalendar';
import CourseDepartment from '../components/settings/CourseDepartment';
import OrganizationSettings from '../components/settings/OrganizationSettings';
import OfficerManagement from '../components/settings/OfficerManagement';
import EventConfiguration from '../components/settings/EventConfiguration';
import PayableCategorySettings from '../components/settings/PayableCategorySettings';
import DocumentManagementSettings from '../components/settings/DocumentManagementSettings';
import ArchiveCenter from '../components/settings/ArchiveCenter';
import { useSearchParams } from 'react-router';

export function SystemSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = searchParams.get('section') || 'adviser-profile';
  const [activeSection, setActiveSection] = useState(initialSection);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const sec = searchParams.get('section');
    if (sec && sec !== activeSection) {
      setActiveSection(sec);
    }
  }, [searchParams]);

  const handleUnsavedChange = () => {
    // No-op: unsaved changes indicator removed per user request
  };

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    setSearchParams({ section });
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'adviser-profile':
        return <AdviserProfile onUnsavedChange={handleUnsavedChange} />;
      case 'security-password':
        return <SecurityPassword onUnsavedChange={handleUnsavedChange} />;
      case 'academic-calendar':
        return <AcademicCalendar onUnsavedChange={handleUnsavedChange} />;
      case 'course-department':
        return <CourseDepartment onUnsavedChange={handleUnsavedChange} />;
      case 'organization-settings':
        return <OrganizationSettings onUnsavedChange={handleUnsavedChange} />;
      case 'roles-permissions':
        return <OrganizationSettings onUnsavedChange={handleUnsavedChange} initialSubTab="roles" />;
      case 'officer-management':
        return <OfficerManagement onUnsavedChange={handleUnsavedChange} />;
      case 'event-configuration':
        return <EventConfiguration onUnsavedChange={handleUnsavedChange} />;
      case 'payable-categories':
        return <PayableCategorySettings onUnsavedChange={handleUnsavedChange} />;
      case 'document-management':
        return <DocumentManagementSettings />;
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
            hasUnsavedChanges={false}
          />
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
        {/* Content */}
        <div className="overflow-y-auto h-full p-8">
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
