import { useState } from 'react';
import { Calendar, MapPin, Users, Edit, Trash2, Plus, Search, X, Check, Clock, AlertCircle } from 'lucide-react';
import OfficerEventProposalModal from '../components/OfficerEventProposalModal';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useOrgEvents } from '../../modules/events/hooks/useEventStream';
import { deleteEvent } from '../../modules/events/services/event.service';
import type { EventDocument } from '../../modules/events/types/event.types';

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

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
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

function EventDetailModal({
  event,
  onClose,
  onEdit,
}: {
  event: EventDocument;
  onClose: () => void;
  onEdit: () => void;
}) {
  const isEditable =
    event.proposalStatus === 'draft' ||
    event.proposalStatus === 'returned' ||
    (event.proposalStatus === 'rejected' && event.allowResubmission !== false);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
        <div className="sticky top-0 bg-[#001A4D] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-[#FFD41C]">{event.referenceId}</span>
            <h2 className="text-lg font-bold">{event.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Status Banners */}
          {event.proposalStatus === 'returned' && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-[#83358E] font-bold text-sm">
                <AlertCircle className="w-5 h-5" />
                <span>Returned for Revision by SAO Adviser</span>
              </div>
              {event.adviserRemarks && (
                <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-purple-100">
                  <strong>Remarks:</strong> {event.adviserRemarks}
                </p>
              )}
              {event.returnFlags && event.returnFlags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {event.returnFlags.map((flag, idx) => (
                    <span key={idx} className="px-2.5 py-0.5 bg-purple-200 text-purple-900 text-xs rounded-full font-semibold">
                      ⚠ {flag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {event.proposalStatus === 'rejected' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                  <X className="w-5 h-5" />
                  <span>Proposal Rejected</span>
                </div>
                {event.allowResubmission !== false ? (
                  <span className="px-2.5 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-bold">
                    Re-editing Allowed
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-red-200 text-red-900 text-xs rounded-full font-bold">
                    Resubmission Locked
                  </span>
                )}
              </div>

              {event.rejectionReason && (
                <p className="text-sm text-red-900">
                  <strong>Reason Category:</strong> {event.rejectionReason}
                </p>
              )}

              {event.adviserRemarks && (
                <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-red-100">
                  <strong>Adviser Remarks:</strong> {event.adviserRemarks}
                </p>
              )}

              {event.allowResubmission !== false && (
                <p className="text-xs text-red-700 italic">
                  Tip: You can edit this proposal to fix the issues mentioned by SAO, then click <strong>"Revise & Resubmit Proposal"</strong> below to send it back for review.
                </p>
              )}
            </div>
          )}

          {/* Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div>
              <span className="text-xs text-gray-500 font-medium">Event Format</span>
              <p className="text-sm font-bold text-[#001A4D] mt-0.5">{event.eventFormat || 'On-Campus'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 font-medium">Expected Participants</span>
              <p className="text-sm font-bold text-[#83358E] mt-0.5">{event.expectedParticipantCount || 0} students</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 font-medium">Approved Budget Ceiling</span>
              <p className="text-sm font-bold text-green-600 mt-0.5">₱{(event.totalApprovedBudget || 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div>
              <h4 className="font-bold text-sm text-[#001A4D] mb-1">Description & Objectives</h4>
              <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">{event.description}</p>
            </div>
          )}

          {/* Sessions Schedule */}
          {event.sessions && event.sessions.length > 0 && (
            <div>
              <h4 className="font-bold text-sm text-[#001A4D] mb-2">Sessions Schedule</h4>
              <div className="space-y-2">
                {event.sessions.map((session, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                    <span className="font-bold text-gray-800">{session.title || `Session ${idx + 1}`}</span>
                    <span className="text-gray-600">{session.date} · {session.startTime} to {session.endTime}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Budget Line Items */}
          {event.budgetItems && event.budgetItems.length > 0 && (
            <div>
              <h4 className="font-bold text-sm text-[#001A4D] mb-2">Proposed Budget Items</h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100 font-bold text-gray-700">
                    <tr>
                      <th className="p-2.5">Item</th>
                      <th className="p-2.5">Qty</th>
                      <th className="p-2.5">Unit Cost</th>
                      <th className="p-2.5">Approved Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {event.budgetItems.map((bi, i) => (
                      <tr key={i}>
                        <td className="p-2.5 font-medium text-gray-900">{bi.item || bi.description}</td>
                        <td className="p-2.5">{bi.quantity}</td>
                        <td className="p-2.5">₱{(bi.unitCost || 0).toLocaleString()}</td>
                        <td className="p-2.5 font-bold text-[#83358E]">₱{(bi.approvedAmount || bi.unitCost * bi.quantity || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
          {isEditable && (
            <button
              onClick={onEdit}
              className="px-5 py-2 bg-[#83358E] text-white rounded-lg text-xs font-bold hover:bg-[#6D2A78] transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Edit className="w-4 h-4" />
              Revise / Edit Proposal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
