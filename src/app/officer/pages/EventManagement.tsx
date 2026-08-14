import { useState } from 'react';
import { Calendar, MapPin, Users, Edit, Trash2, Plus, Search, X, Check, Clock, AlertCircle } from 'lucide-react';
import OfficerEventProposalModal from '../components/OfficerEventProposalModal';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useOrgEvents } from '../../modules/events/hooks/useEventStream';
import { deleteEvent } from '../../modules/events/services/event.service';
import type { EventDocument } from '../../modules/events/types/event.types';
import { OfficerEventDetailView } from '../../modules/events';

type EventStatusTab = 'all' | 'draft' | 'pending' | 'approved' | 'completed' | 'rejected' | 'returned';

export default function EventManagement() {
  const [activeStatus, setActiveStatus] = useState<EventStatusTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { profile } = useOfficerProfile();
  const { data: orgs } = useOrganizationStream();

  const activeOrgId = profile?.activeOrganizationId || '';
  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const activeOrgName = activeOrg ? activeOrg.name : 'My Organization';

  const { events, loading } = useOrgEvents(activeOrgId);

  const filteredEvents = events.filter((event) => {
    let statusMatch = true;
    const currentStatus = (event.proposalStatus || 'draft').toLowerCase();

    if (activeStatus === 'draft') statusMatch = currentStatus === 'draft';
    else if (activeStatus === 'pending') statusMatch = currentStatus === 'pending' || currentStatus === 'pending_review';
    else if (activeStatus === 'approved') statusMatch = currentStatus === 'approved';
    else if (activeStatus === 'completed') statusMatch = currentStatus === 'completed';
    else if (activeStatus === 'rejected') statusMatch = currentStatus === 'rejected';
    else if (activeStatus === 'returned') statusMatch = currentStatus === 'returned';

    const titleMatch = (event.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const refMatch = (event.referenceId || '').toLowerCase().includes(searchQuery.toLowerCase());

    return statusMatch && (titleMatch || refMatch);
  });

  const statusColors: Record<string, string> = {
    draft: 'bg-[#888780]',
    pending: 'bg-[#BA7517]',
    pending_review: 'bg-[#BA7517]',
    approved: 'bg-[#639922]',
    completed: 'bg-[#0E4EBD]',
    rejected: 'bg-[#E24B4A]',
    returned: 'bg-purple-600',
  };

  const statusCounts = {
    all: events.length,
    draft: events.filter((e) => e.proposalStatus === 'draft').length,
    pending: events.filter((e) => e.proposalStatus === 'pending' || e.proposalStatus === 'pending_review').length,
    approved: events.filter((e) => e.proposalStatus === 'approved').length,
    completed: events.filter((e) => e.proposalStatus === 'completed').length,
    rejected: events.filter((e) => e.proposalStatus === 'rejected').length,
    returned: events.filter((e) => e.proposalStatus === 'returned').length,
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this event proposal?')) return;
    setDeletingId(id);
    try {
      await deleteEvent(id);
    } catch (e) {
      console.error(e);
      alert('Failed to delete event proposal.');
    } finally {
      setDeletingId(null);
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[#888780] text-[13px] mb-1">
            Dashboard &gt; Event Management {activeOrgName && <span className="font-semibold text-[#83358E]">({activeOrgName})</span>}
          </div>
          <h1 className="text-[#001A4D] text-[24px] font-bold">Event Management</h1>
        </div>
        <button
          onClick={() => {
            setEditingEvent(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#83358E] text-white rounded-lg text-[14px] font-medium hover:bg-[#6D2A78] transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Create Event Proposal
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888780]" />
            <input
              type="text"
              placeholder="Search events by title or reference ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-[#E0E0E0] rounded-lg text-[14px] focus:border-[#83358E] focus:ring-2 focus:ring-[#83358E]/20 outline-none"
            />
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'draft', label: 'Draft' },
            { key: 'pending', label: 'Pending Review' },
            { key: 'returned', label: 'Returned' },
            { key: 'approved', label: 'Approved' },
            { key: 'completed', label: 'Completed' },
            { key: 'rejected', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key as EventStatusTab)}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${
                activeStatus === tab.key
                  ? 'bg-[#83358E] text-white font-bold'
                  : 'bg-[#F8F8F8] text-[#888780] hover:bg-[#EEEDFE] hover:text-[#83358E]'
              }`}
            >
              {tab.label} ({statusCounts[tab.key as EventStatusTab]})
            </button>
          ))}
        </div>
      </div>

      {/* Event Cards Grid */}
      {loading ? (
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-12 text-center text-gray-500">
          Loading events from database...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-12 text-center">
          <Calendar className="w-16 h-16 text-[#888780] mx-auto mb-4" />
          <p className="text-[#888780] text-[14px]">No events found. Click "+ Create Event Proposal" to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => {
            const firstSession = event.sessions && event.sessions[0];
            const dateStr = firstSession ? firstSession.date : 'TBD';
            const timeStr = firstSession ? `${firstSession.startTime} - ${firstSession.endTime}` : '';
            const statusKey = (event.proposalStatus || 'draft').toLowerCase();

            return (
              <div key={event.id} className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden hover:shadow-lg transition-shadow flex flex-col justify-between">
                {/* Category Color Strip */}
                <div className={`h-2 ${statusColors[statusKey] || 'bg-[#83358E]'}`} />

                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-mono font-semibold text-gray-400">
                        {event.referenceId || event.id.slice(0, 10)}
                      </span>
                      <span className={`inline-block px-2.5 py-0.5 ${statusColors[statusKey] || 'bg-gray-500'} text-white rounded-full text-[11px] font-bold capitalize`}>
                        {event.proposalStatus === 'pending_review' ? 'Pending Review' : event.proposalStatus}
                      </span>
                    </div>

                    {/* Event Name */}
                    <h3 className="text-[#001A4D] text-[16px] font-bold mb-1 leading-snug">{event.title}</h3>
                    {event.tagline && <p className="text-gray-500 text-xs italic mb-2 line-clamp-1">{event.tagline}</p>}

                    {/* Date, Time, Venue */}
                    <div className="space-y-1.5 mb-3 text-xs text-[#888780]">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-[#83358E]" />
                        <span>{dateStr} {timeStr ? `· ${timeStr}` : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#83358E]" />
                        <span>{event.eventFormat || 'On-Campus'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-[#83358E]" />
                        <span>{event.expectedParticipantCount || 0} expected attendees</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {/* Organization Badge */}
                    <div className="mb-3">
                      <span className="inline-block px-2 py-0.5 bg-[#F3E8FF] text-[#83358E] rounded text-[11px] font-bold">
                        {activeOrgName}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#E0E0E0]">
                      <button
                        onClick={() => setSelectedEventId(event.id)}
                        className="text-[#83358E] text-[13px] font-bold hover:underline"
                      >
                        View Details
                      </button>

                      <div className="flex items-center gap-1">
                        {(event.proposalStatus === 'draft' || event.proposalStatus === 'returned' || (event.proposalStatus === 'rejected' && event.allowResubmission !== false)) && (
                          <button
                            onClick={() => {
                              setEditingEvent(event);
                              setShowCreateModal(true);
                            }}
                            className="p-1.5 rounded hover:bg-gray-100 text-[#83358E]"
                            title={event.proposalStatus === 'rejected' ? "Revise & Resubmit Proposal" : "Edit Proposal"}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {event.proposalStatus !== 'approved' && (
                          <button
                            onClick={() => handleDelete(event.id)}
                            disabled={deletingId === event.id}
                            className="p-1.5 rounded hover:bg-red-50 text-[#E24B4A]"
                            title="Delete Proposal"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Event Modal */}
      {showCreateModal && (
        <OfficerEventProposalModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditingEvent(null);
          }}
          initialDraft={editingEvent || undefined}
          draftId={editingEvent?.id}
        />
      )}

      {/* Rich Officer Event Detail View */}
      {selectedEvent && (
        <OfficerEventDetailView
          event={selectedEvent}
          onClose={() => setSelectedEventId(null)}
          onEdit={() => {
            setEditingEvent(selectedEvent);
            setSelectedEventId(null);
            setShowCreateModal(true);
          }}
        />
      )}
    </div>
  );
}

