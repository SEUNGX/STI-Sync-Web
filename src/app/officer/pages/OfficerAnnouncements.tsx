import { useState, useMemo } from 'react';
import { Plus, X, Eye, Trash2, Pin, Globe, Building2, Users, Calendar, Search, Loader2, Megaphone, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useRoles } from '../../modules/roles/hooks/useRoles';
import { useAllEvents } from '../../modules/events/hooks/useEventStream';
import { useAnnouncementStream } from '../../modules/announcements/hooks/useAnnouncementStream';
import { createAnnouncement, togglePin, deleteAnnouncement } from '../../modules/announcements/services/announcement.service';
import type { AnnouncementPriority, AnnouncementAudience } from '../../modules/announcements/types/announcement.types';

export default function OfficerAnnouncements() {
  const { profile, loading: profileLoading } = useOfficerProfile();
  const activeOrgId = profile?.activeOrganizationId || '';

  const { data: orgs } = useOrganizationStream();
  const { data: roles } = useRoles();
  const { events: dbEvents } = useAllEvents();
  const { announcements, loading: announcementsLoading } = useAnnouncementStream(activeOrgId);

  const [activeTab, setActiveTab] = useState<'all' | 'sao' | 'org' | 'priority'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const activeOrgName = activeOrg ? activeOrg.name : 'Student Organization';
  const activeOrgInitials = activeOrg ? (activeOrg.acronym || activeOrg.name.substring(0, 3).toUpperCase()) : 'ORG';

  const activeRoleDoc = roles.find((r) => r.id === profile?.activeRoleId);
  const activeRoleName = activeRoleDoc ? activeRoleDoc.name : 'Officer';

  // Events hosted by this org that can be linked
  const orgEvents = useMemo(() => {
    if (!dbEvents) return [];
    return dbEvents.filter(
      (e) => (activeOrgId && e.hostingOrgId === activeOrgId) || (profile?.studentId && e.createdBy === profile.studentId)
    );
  }, [dbEvents, activeOrgId, profile?.studentId]);

  // Filtered Announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      // Search filter
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        (a.authorName && a.authorName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Tab filter
      if (activeTab === 'sao') {
        return a.audience === 'campus-wide' || a.audience === 'all-organizations' || !a.organizationId;
      }
      if (activeTab === 'org') {
        return a.organizationId === activeOrgId;
      }
      if (activeTab === 'priority') {
        return a.priority === 'Urgent' || a.priority === 'Important';
      }

      return true;
    });
  }, [announcements, searchQuery, activeTab, activeOrgId]);

  const handleTogglePin = async (id: string, currentPinned: boolean) => {
    try {
      await togglePin(id, !currentPinned);
    } catch (err) {
      console.error('Failed to toggle pin status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      try {
        await deleteAnnouncement(id);
      } catch (err) {
        console.error('Failed to delete announcement:', err);
      }
    }
  };

  const isLoading = profileLoading || announcementsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[#888780] text-[13px] mb-1">Dashboard &gt; Announcements</div>
          <h1 className="text-[#001A4D] text-[24px] font-bold">Announcements</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Broadcast updates to your members and view campus announcements from SAO
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#7F77DD] text-white rounded-lg text-[14px] font-medium hover:bg-[#7F77DD]/90 transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Post Announcement
        </button>
      </div>

      {/* Toolbar: Search & Category Tabs */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search announcement title or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#7F77DD] focus:border-transparent bg-white outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Feed' },
            { id: 'sao', label: 'SAO Campus' },
            { id: 'org', label: 'My Org Announcements' },
            { id: 'priority', label: 'Important / Urgent' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#001A4D] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Announcements Feed */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#7F77DD] mb-3" />
          <p className="text-gray-500 text-sm font-medium">Loading announcements...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((announcement) => {
            const isSAO = !announcement.organizationId || announcement.audience === 'campus-wide' || announcement.audience === 'all-organizations';
            const isMyOrgPost = announcement.organizationId === activeOrgId;

            return (
              <div
                key={announcement.id}
                className={`bg-white border ${
                  announcement.pinned ? 'border-2 border-[#BA7517]' : 'border-[#E0E0E0]'
                } rounded-xl p-6 hover:shadow-md transition-shadow relative overflow-hidden`}
              >
                {announcement.pinned && (
                  <div className="absolute top-0 right-0 bg-[#BA7517] text-white px-3 py-1 rounded-bl-lg text-[11px] font-bold flex items-center gap-1">
                    <Pin className="w-3 h-3 fill-white" />
                    PINNED
                  </div>
                )}

                {/* Header Info */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${
                        isSAO ? 'bg-[#001A4D] ring-2 ring-[#BA7517]' : 'bg-[#7F77DD]'
                      }`}
                    >
                      {isSAO ? 'SAO' : (announcement.organizationName ? announcement.organizationName.substring(0, 3).toUpperCase() : activeOrgInitials)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[#001A4D] text-[14px] font-bold">{announcement.authorName || 'Author'}</h3>
                        <span className="text-gray-400 text-xs">•</span>
                        <span className="text-gray-500 text-xs font-medium">
                          {announcement.authorRole || (isSAO ? 'SAO Adviser' : 'Officer')}
                        </span>
                        {isSAO && (
                          <span className="px-2 py-0.5 bg-[#001A4D] text-white rounded-full text-[10px] font-bold">
                            Official SAO
                          </span>
                        )}
                        {isMyOrgPost && (
                          <span className="px-2 py-0.5 bg-[#EEEDFE] text-[#7F77DD] rounded-full text-[10px] font-bold">
                            {activeOrgInitials} Post
                          </span>
                        )}
                      </div>
                      <p className="text-[#888780] text-[12px] mt-0.5">
                        {announcement.createdAt?.toDate
                          ? format(announcement.createdAt.toDate(), 'MMM dd, yyyy') + ' at ' + format(announcement.createdAt.toDate(), 'h:mm a')
                          : 'Recently'}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Priority Badges */}
                  <div className="flex items-center gap-2 pr-16 md:pr-0">
                    {/* Priority Badge */}
                    {announcement.priority === 'Urgent' && (
                      <span className="px-2.5 py-1 bg-red-600 text-white rounded-full text-[11px] font-bold">
                        Urgent
                      </span>
                    )}
                    {announcement.priority === 'Important' && (
                      <span className="px-2.5 py-1 bg-[#BA7517] text-white rounded-full text-[11px] font-bold">
                        Important
                      </span>
                    )}
                    {announcement.priority === 'Normal' && (
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-[11px] font-medium border border-gray-200">
                        Normal
                      </span>
                    )}

                    {/* Management Actions (For Org Authored Posts) */}
                    {isMyOrgPost && (
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => handleTogglePin(announcement.id, announcement.pinned)}
                          title={announcement.pinned ? 'Unpin Announcement' : 'Pin Announcement'}
                          className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600 transition-colors"
                        >
                          <Pin className={`w-4 h-4 ${announcement.pinned ? 'fill-amber-600' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleDelete(announcement.id)}
                          title="Delete Announcement"
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Announcement Title & Body */}
                <h2 className="text-[#001A4D] text-[17px] font-bold mb-2">{announcement.title}</h2>
                <p className="text-[#333333] text-[14px] leading-relaxed whitespace-pre-wrap mb-4">
                  {announcement.content}
                </p>

                {/* Linked Event Pill */}
                {announcement.linkedEventTitle && (
                  <div className="mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EEEDFE] border border-[#7F77DD]/30 text-[#7F77DD] rounded-lg text-[12px] font-semibold">
                      <Calendar className="w-3.5 h-3.5" />
                      Linked Event: {announcement.linkedEventTitle}
                    </span>
                  </div>
                )}

                {/* Footer Metadata */}
                <div className="flex items-center justify-between pt-3 border-t border-[#E0E0E0] text-[12px] text-gray-500">
                  <div className="flex items-center gap-2">
                    {announcement.audience === 'campus-wide' ? (
                      <span className="flex items-center gap-1 text-blue-700 font-medium">
                        <Globe className="w-3.5 h-3.5" /> Campus-Wide Audience
                      </span>
                    ) : announcement.audience === 'all-organizations' ? (
                      <span className="flex items-center gap-1 text-indigo-700 font-medium">
                        <Building2 className="w-3.5 h-3.5" /> All Organizations
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-purple-700 font-medium">
                        <Users className="w-3.5 h-3.5" /> Targeted Members
                        {announcement.targetDepartments && announcement.targetDepartments.length > 0 && (
                          <span className="bg-purple-100 px-1.5 py-0.5 rounded text-[10px]">
                            Depts: {announcement.targetDepartments.join(', ')}
                          </span>
                        )}
                        {announcement.targetYearLevels && announcement.targetYearLevels.length > 0 && (
                          <span className="bg-purple-100 px-1.5 py-0.5 rounded text-[10px]">
                            Years: {announcement.targetYearLevels.join(', ')}
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {announcement.schoolYear && (
                    <span className="text-gray-400 font-mono text-[11px]">S.Y. {announcement.schoolYear}</span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredAnnouncements.length === 0 && (
            <div className="bg-white border border-[#E0E0E0] rounded-xl p-12 text-center">
              <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-[#001A4D] font-bold text-lg mb-1">No Announcements Found</h3>
              <p className="text-gray-500 text-sm max-w-md mx-auto mb-4">
                There are no active announcements in this view. Click below to post a new announcement for your members.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-[#7F77DD] text-white rounded-lg text-sm font-medium hover:bg-[#7F77DD]/90"
              >
                Post New Announcement
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Announcement Modal */}
      {showCreateModal && (
        <CreateModal
          onClose={() => setShowCreateModal(false)}
          activeOrgId={activeOrgId}
          activeOrgName={activeOrgName}
          authorUid={profile?.studentId || ''}
          authorName={profile?.displayName || 'Officer'}
          authorRole={activeRoleName}
          orgEvents={orgEvents}
        />
      )}
    </div>
  );
}

interface CreateModalProps {
  onClose: () => void;
  activeOrgId: string;
  activeOrgName: string;
  authorUid: string;
  authorName: string;
  authorRole: string;
  orgEvents: any[];
}

function CreateModal({
  onClose,
  activeOrgId,
  activeOrgName,
  authorUid,
  authorName,
  authorRole,
  orgEvents,
}: CreateModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('Normal');
  const [targetType, setTargetType] = useState<'all' | 'department' | 'year'>('all');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableDepts = ['BSIT', 'BSCS', 'BSA', 'BSBA', 'BSHM'];
  const availableYears = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

  const toggleDept = (dept: string) => {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const toggleYear = (year: string) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    try {
      const linkedEvent = orgEvents.find((evt) => evt.id === selectedEventId);

      await createAnnouncement(
        {
          title: title.trim(),
          content: content.trim(),
          priority,
          audience: targetType === 'all' ? 'specific' : 'specific',
          targetOrgIds: [activeOrgId],
          targetOrgNames: [activeOrgName],
          targetDepartments: targetType === 'department' ? selectedDepts : [],
          targetYearLevels: targetType === 'year' ? selectedYears : [],
          organizationId: activeOrgId,
          organizationName: activeOrgName,
          linkedEventId: selectedEventId || null,
          linkedEventTitle: linkedEvent ? linkedEvent.title : null,
          pinned: isPinned,
          semesterId: '1st-sem-2026',
          schoolYear: '2025-2026',
          authorRole,
        },
        authorUid,
        authorName,
        authorRole
      );

      onClose();
    } catch (err) {
      console.error('Failed to post announcement:', err);
      alert('Error creating announcement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#E0E0E0] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-[#001A4D] text-[18px] font-bold">Post Organization Announcement</h2>
            <p className="text-gray-500 text-xs">Publishing for {activeOrgName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-[#001A4D] text-[13px] font-semibold mb-1.5">
              Announcement Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. General Assembly & Membership Dues Reminder"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#7F77DD] outline-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-[#001A4D] text-[13px] font-semibold mb-1.5">Priority Level</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'Normal', label: 'Normal', desc: 'Standard update', border: 'border-gray-200' },
                { id: 'Important', label: 'Important', desc: 'High visibility', border: 'border-amber-400' },
                { id: 'Urgent', label: 'Urgent', desc: 'Critical alert', border: 'border-red-400' },
              ].map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPriority(p.id as AnnouncementPriority)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    priority === p.id
                      ? 'bg-[#EEEDFE] border-[#7F77DD] ring-2 ring-[#7F77DD]/20'
                      : `bg-white ${p.border} hover:bg-gray-50`
                  }`}
                >
                  <p className="text-xs font-bold text-[#001A4D]">{p.label}</p>
                  <p className="text-[11px] text-gray-500">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-[#001A4D] text-[13px] font-semibold mb-1.5">
              Content Details <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your announcement message for members..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#7F77DD] outline-none resize-none"
            />
          </div>

          {/* Target Audience Options */}
          <div>
            <label className="block text-[#001A4D] text-[13px] font-semibold mb-1.5">Target Audience</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-[#001A4D] cursor-pointer">
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === 'all'}
                  onChange={() => setTargetType('all')}
                  className="w-4 h-4 text-[#7F77DD]"
                />
                <span>All Organization Members</span>
              </label>

              <label className="flex items-center gap-2 text-sm text-[#001A4D] cursor-pointer">
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === 'department'}
                  onChange={() => setTargetType('department')}
                  className="w-4 h-4 text-[#7F77DD]"
                />
                <span>Filter by Department</span>
              </label>

              {targetType === 'department' && (
                <div className="ml-6 grid grid-cols-3 gap-2 pt-1">
                  {availableDepts.map((dept) => (
                    <label key={dept} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDepts.includes(dept)}
                        onChange={() => toggleDept(dept)}
                        className="rounded text-[#7F77DD]"
                      />
                      <span>{dept}</span>
                    </label>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-[#001A4D] cursor-pointer">
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === 'year'}
                  onChange={() => setTargetType('year')}
                  className="w-4 h-4 text-[#7F77DD]"
                />
                <span>Filter by Year Level</span>
              </label>

              {targetType === 'year' && (
                <div className="ml-6 grid grid-cols-2 gap-2 pt-1">
                  {availableYears.map((year) => (
                    <label key={year} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedYears.includes(year)}
                        onChange={() => toggleYear(year)}
                        className="rounded text-[#7F77DD]"
                      />
                      <span>{year}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Link to Approved Event */}
          <div>
            <label className="block text-[#001A4D] text-[13px] font-semibold mb-1.5">
              Link to Approved Event (Optional)
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#7F77DD] outline-none bg-white"
            >
              <option value="">None (General Announcement)</option>
              {orgEvents.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  🎯 {evt.title} ({evt.sessions?.[0]?.date || 'Event'})
                </option>
              ))}
            </select>
          </div>

          {/* Pin Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <p className="text-xs font-semibold text-[#001A4D]">Pin Announcement to Top</p>
              <p className="text-[11px] text-gray-500">Pinned posts stay at the top of the feed</p>
            </div>
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="w-4 h-4 text-[#7F77DD] rounded border-gray-300"
            />
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-white pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 bg-[#7F77DD] text-white rounded-lg text-sm font-medium hover:bg-[#7F77DD]/90 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Publish Announcement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

