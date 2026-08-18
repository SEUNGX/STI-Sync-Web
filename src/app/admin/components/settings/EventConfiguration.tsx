import { useState } from 'react';
import { Plus, Archive, RotateCcw, Trash2, Edit2, X, AlertTriangle } from 'lucide-react';
import { useEventTypesStream, useEventCategoriesStream, useVenuesStream, useEventConfigMutations, EventTypeDocument, EventCategoryDocument, VenueDocument } from '@/app/modules/events';

interface EventConfigurationProps {
  onUnsavedChange: () => void;
}

type SubTab = 'types' | 'categories' | 'venues';

type ModalState =
  | { type: 'none' }
  | { type: 'add-type' }
  | { type: 'edit-type'; item: EventTypeDocument }
  | { type: 'archive-type'; item: EventTypeDocument }
  | { type: 'restore-type'; item: EventTypeDocument }
  | { type: 'delete-type'; item: EventTypeDocument }
  | { type: 'add-cat' }
  | { type: 'edit-cat'; item: EventCategoryDocument }
  | { type: 'archive-cat'; item: EventCategoryDocument }
  | { type: 'restore-cat'; item: EventCategoryDocument }
  | { type: 'delete-cat'; item: EventCategoryDocument }
  | { type: 'add-venue' }
  | { type: 'edit-venue'; item: VenueDocument }
  | { type: 'archive-venue'; item: VenueDocument }
  | { type: 'restore-venue'; item: VenueDocument }
  | { type: 'delete-venue'; item: VenueDocument };

const COLORS = ['#001A4D', '#002B7F', '#0E4EBD', '#1E70E8', '#22C55E', '#FFD41C', '#EF4444', '#0EA5E9'];
const FACILITY_OPTIONS = ['Projector', 'Sound System', 'Air Conditioning', 'Stage', 'Whiteboard', 'Podium', 'Lighting', 'Tables & Chairs'];

function ActiveArchivedTabs({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
      <button onClick={() => onChange(false)}
        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${!active ? 'bg-white text-[#001A4D] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
        Active
      </button>
      <button onClick={() => onChange(true)}
        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${active ? 'bg-white text-[#001A4D] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
        Archived
      </button>
    </div>
  );
}

export default function EventConfiguration({ onUnsavedChange }: EventConfigurationProps) {
  const [subTab, setSubTab] = useState<SubTab>('types');
  
  const { eventTypes, loading: loadingTypes } = useEventTypesStream();
  const { categories, loading: loadingCats } = useEventCategoriesStream();
  const { venues, loading: loadingVenues } = useVenuesStream();
  const mutations = useEventConfigMutations();

  const [typeArchivedView, setTypeArchivedView] = useState(false);
  const [catArchivedView, setCatArchivedView] = useState(false);
  const [venueArchivedView, setVenueArchivedView] = useState(false);

  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [deleteText, setDeleteText] = useState('');

  const [typeForm, setTypeForm] = useState({ name: '', color: '#1E70E8' });
  const [catForm, setCatForm] = useState({ name: '', typeId: '' });
  const [venueForm, setVenueForm] = useState({ name: '', capacity: 50, facilities: [] as string[], status: 'available' as VenueDocument['status'] });
  const [customFacility, setCustomFacility] = useState('');

  const close = () => { setModal({ type: 'none' }); setDeleteText(''); setCustomFacility(''); };

  const activeTypes = eventTypes.filter(t => !t.archived);
  const archivedTypes = eventTypes.filter(t => t.archived);
  const activeCats = categories.filter(c => !c.archived);
  const archivedCats = categories.filter(c => c.archived);
  const activeVenues = venues.filter(v => !v.archived);
  const archivedVenues = venues.filter(v => v.archived);

  const getTypeName = (id: string) => eventTypes.find(t => t.id === id)?.name ?? '—';
  const getTypeColor = (id: string) => eventTypes.find(t => t.id === id)?.color ?? '#ccc';

  const statusPill = (s: VenueDocument['status']) =>
    s === 'available' ? 'bg-green-100 text-green-700' :
    s === 'maintenance' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';

  const toggleFacility = (f: string) =>
    setVenueForm(p => ({ ...p, facilities: p.facilities.includes(f) ? p.facilities.filter(x => x !== f) : [...p.facilities, f] }));

  const handleAddCustomFacility = () => {
    if (customFacility.trim() && !venueForm.facilities.includes(customFacility.trim())) {
      setVenueForm(p => ({ ...p, facilities: [...p.facilities, customFacility.trim()] }));
      setCustomFacility('');
    }
  };

  const saveType = async () => {
    if (modal.type === 'add-type') await mutations.createEventType({ ...typeForm, archived: false });
    else if (modal.type === 'edit-type') await mutations.updateEventType(modal.item.id, typeForm);
    close();
  };
  const saveCat = async () => {
    if (modal.type === 'add-cat') await mutations.createEventCategory({ ...catForm, archived: false });
    else if (modal.type === 'edit-cat') await mutations.updateEventCategory(modal.item.id, catForm);
    close();
  };
  const saveVenue = async () => {
    if (modal.type === 'add-venue') await mutations.createVenue({ ...venueForm, archived: false });
    else if (modal.type === 'edit-venue') await mutations.updateVenue(modal.item.id, venueForm);
    close();
  };

  const isLoading = loadingTypes || loadingCats || loadingVenues;

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading configuration...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Event Configuration</h2>
        <p className="text-sm text-gray-500 mt-1">Manage event types, categories, and venue registry</p>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200">
        {([['types', 'Event Types'], ['categories', 'Event Categories'], ['venues', 'Venue Registry']] as [SubTab, string][]).map(([tab, label]) => (
          <button key={tab} onClick={() => setSubTab(tab)}
            className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${subTab === tab ? 'border-[#001A4D] text-[#001A4D]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* EVENT TYPES */}
      {subTab === 'types' && (
        <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-[#001A4D]">Event Types</h3>
              <ActiveArchivedTabs active={typeArchivedView} onChange={setTypeArchivedView} />
            </div>
            <button onClick={() => { setTypeForm({ name: '', color: '#1E70E8' }); setModal({ type: 'add-type' }); }}
              className="px-4 py-2 bg-[#001A4D] text-white rounded-lg text-sm font-medium hover:bg-[#001A4D]/90 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Type
            </button>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Type</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Color</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(typeArchivedView ? archivedTypes : activeTypes).map(et => (
                <tr key={et.id} className="hover:bg-gray-50 transition-colors"
                  onMouseEnter={() => setHoveredRow(et.id)} onMouseLeave={() => setHoveredRow(null)}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{et.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: et.color }} />
                      <span className="text-xs font-mono text-gray-500">{et.color}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`flex justify-end gap-1 transition-opacity ${hoveredRow === et.id ? 'opacity-100' : 'opacity-0'}`}>
                      {!et.archived ? (
                        <>
                          <button onClick={() => { setTypeForm({ name: et.name, color: et.color }); setModal({ type: 'edit-type', item: et }); }} className="p-1.5 rounded hover:bg-blue-50 text-[#1E70E8]"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setModal({ type: 'archive-type', item: et })} className="p-1.5 rounded hover:bg-amber-50 text-amber-500"><Archive className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setModal({ type: 'restore-type', item: et })} className="p-1.5 rounded hover:bg-green-50 text-green-600"><RotateCcw className="w-4 h-4" /></button>
                          <button onClick={() => setModal({ type: 'delete-type', item: et })} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(typeArchivedView ? archivedTypes : activeTypes).length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">No {typeArchivedView ? 'archived' : 'active'} event types.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CATEGORIES */}
      {subTab === 'categories' && (
        <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-[#001A4D]">Event Categories</h3>
              <ActiveArchivedTabs active={catArchivedView} onChange={setCatArchivedView} />
            </div>
            <button onClick={() => { setCatForm({ name: '', typeId: '' }); setModal({ type: 'add-cat' }); }}
              className="px-4 py-2 bg-[#001A4D] text-white rounded-lg text-sm font-medium hover:bg-[#001A4D]/90 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Category
            </button>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Category Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Event Type</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(catArchivedView ? archivedCats : activeCats).map(cat => (
                <tr key={cat.id} className="hover:bg-gray-50 transition-colors"
                  onMouseEnter={() => setHoveredRow(cat.id)} onMouseLeave={() => setHoveredRow(null)}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{cat.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getTypeColor(cat.typeId) }} />
                      {getTypeName(cat.typeId)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`flex justify-end gap-1 transition-opacity ${hoveredRow === cat.id ? 'opacity-100' : 'opacity-0'}`}>
                      {!cat.archived ? (
                        <>
                          <button onClick={() => { setCatForm({ name: cat.name, typeId: cat.typeId }); setModal({ type: 'edit-cat', item: cat }); }} className="p-1.5 rounded hover:bg-blue-50 text-[#1E70E8]"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setModal({ type: 'archive-cat', item: cat })} className="p-1.5 rounded hover:bg-amber-50 text-amber-500"><Archive className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setModal({ type: 'restore-cat', item: cat })} className="p-1.5 rounded hover:bg-green-50 text-green-600"><RotateCcw className="w-4 h-4" /></button>
                          <button onClick={() => setModal({ type: 'delete-cat', item: cat })} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(catArchivedView ? archivedCats : activeCats).length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">No {catArchivedView ? 'archived' : 'active'} categories.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VENUES */}
      {subTab === 'venues' && (
        <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-[#001A4D]">Venue Registry</h3>
              <ActiveArchivedTabs active={venueArchivedView} onChange={setVenueArchivedView} />
            </div>
            <button onClick={() => { setVenueForm({ name: '', capacity: 50, facilities: [], status: 'available' }); setModal({ type: 'add-venue' }); }}
              className="px-4 py-2 bg-[#001A4D] text-white rounded-lg text-sm font-medium hover:bg-[#001A4D]/90 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Venue
            </button>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Venue</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Capacity</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Facilities</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(venueArchivedView ? archivedVenues : activeVenues).map(venue => (
                <tr key={venue.id} className="hover:bg-gray-50 transition-colors"
                  onMouseEnter={() => setHoveredRow(venue.id)} onMouseLeave={() => setHoveredRow(null)}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{venue.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{venue.capacity.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {venue.facilities.slice(0, 3).map(f => <span key={f} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{f}</span>)}
                      {venue.facilities.length > 3 && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">+{venue.facilities.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${statusPill(venue.status)}`}>{venue.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`flex justify-end gap-1 transition-opacity ${hoveredRow === venue.id ? 'opacity-100' : 'opacity-0'}`}>
                      {!venue.archived ? (
                        <>
                          <button onClick={() => { setVenueForm({ name: venue.name, capacity: venue.capacity, facilities: [...venue.facilities], status: venue.status }); setModal({ type: 'edit-venue', item: venue }); }} className="p-1.5 rounded hover:bg-blue-50 text-[#1E70E8]"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setModal({ type: 'archive-venue', item: venue })} className="p-1.5 rounded hover:bg-amber-50 text-amber-500"><Archive className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setModal({ type: 'restore-venue', item: venue })} className="p-1.5 rounded hover:bg-green-50 text-green-600"><RotateCcw className="w-4 h-4" /></button>
                          <button onClick={() => setModal({ type: 'delete-venue', item: venue })} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(venueArchivedView ? archivedVenues : activeVenues).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No {venueArchivedView ? 'archived' : 'active'} venues.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODALS */}
      {modal.type !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={close} />

          {/* ADD / EDIT TYPE */}
          {(modal.type === 'add-type' || modal.type === 'edit-type') && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-bold text-lg">{modal.type === 'add-type' ? 'Add Event Type' : 'Edit Event Type'}</h3>
                  {modal.type === 'edit-type' && <span className="px-2 py-0.5 bg-[#1E70E8] text-white text-xs rounded-full">Editing: {modal.item.name}</span>}
                </div>
                <button onClick={close} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type Name <span className="text-red-500">*</span></label>
                  <input type="text" value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" placeholder="e.g. Academic" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setTypeForm({ ...typeForm, color: c })}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${typeForm.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={close} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={saveType} disabled={!typeForm.name || mutations.loading}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer">
                    {mutations.loading ? 'Saving...' : (modal.type === 'add-type' ? 'Save' : 'Save Changes')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ADD / EDIT CATEGORY */}
          {(modal.type === 'add-cat' || modal.type === 'edit-cat') && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-bold text-lg">{modal.type === 'add-cat' ? 'Add Category' : 'Edit Category'}</h3>
                  {modal.type === 'edit-cat' && <span className="px-2 py-0.5 bg-[#1E70E8] text-white text-xs rounded-full">Editing: {modal.item.name}</span>}
                </div>
                <button onClick={close} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Category Name <span className="text-red-500">*</span></label>
                  <input type="text" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" placeholder="e.g. Seminar / Webinar" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {modal.type === 'edit-cat' ? 'Event Type (read-only)' : 'Event Type'} <span className="text-red-500">*</span>
                  </label>
                  {modal.type === 'edit-cat' ? (
                    <input type="text" readOnly value={getTypeName(modal.item.typeId)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500" />
                  ) : (
                    <select value={catForm.typeId} onChange={e => setCatForm({ ...catForm, typeId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent">
                      <option value="">Select type...</option>
                      {activeTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={close} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={saveCat} disabled={!catForm.name || (!catForm.typeId && modal.type === 'add-cat') || mutations.loading}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer">
                    {mutations.loading ? 'Saving...' : (modal.type === 'add-cat' ? 'Save' : 'Save Changes')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ADD / EDIT VENUE */}
          {(modal.type === 'add-venue' || modal.type === 'edit-venue') && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-bold text-lg">{modal.type === 'add-venue' ? 'Add Venue' : 'Edit Venue'}</h3>
                  {modal.type === 'edit-venue' && <span className="px-2 py-0.5 bg-[#1E70E8] text-white text-xs rounded-full">Editing: {modal.item.name}</span>}
                </div>
                <button onClick={close} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Venue Name <span className="text-red-500">*</span></label>
                  <input type="text" value={venueForm.name} onChange={e => setVenueForm({ ...venueForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" placeholder="e.g. Main Auditorium" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Capacity <span className="text-red-500">*</span></label>
                    <input type="number" value={venueForm.capacity} onChange={e => setVenueForm({ ...venueForm, capacity: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" min={1} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                    <select value={venueForm.status} onChange={e => setVenueForm({ ...venueForm, status: e.target.value as VenueDocument['status'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent">
                      <option value="available">Available</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="reserved">Reserved</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Facilities</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {/* Unique active facilities combining predefined and custom already added */}
                    {Array.from(new Set([...FACILITY_OPTIONS, ...venueForm.facilities])).map(f => (
                      <button key={f} onClick={() => toggleFacility(f)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${venueForm.facilities.includes(f) ? 'bg-[#001A4D] text-white border-[#001A4D]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#001A4D]'}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" value={customFacility} onChange={e => setCustomFacility(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddCustomFacility()}
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" placeholder="Other facility..." />
                    <button onClick={handleAddCustomFacility} disabled={!customFacility.trim()}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
                      Add
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={close} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={saveVenue} disabled={!venueForm.name || mutations.loading}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer">
                    {mutations.loading ? 'Saving...' : (modal.type === 'add-venue' ? 'Save' : 'Save Changes')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ARCHIVE CONFIRMS (shared) */}
          {(modal.type === 'archive-type' || modal.type === 'archive-cat' || modal.type === 'archive-venue') && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Archive</h3>
                <button onClick={close} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-700 mb-4">Archive <span className="font-bold">{modal.item.name}</span>? It can be restored later.</p>
                <div className="flex gap-3">
                  <button onClick={close} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={async () => {
                    if (modal.type === 'archive-type') await mutations.archiveEventType(modal.item.id);
                    else if (modal.type === 'archive-cat') await mutations.archiveEventCategory(modal.item.id);
                    else if (modal.type === 'archive-venue') await mutations.archiveVenue(modal.item.id);
                    close();
                  }} disabled={mutations.loading} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 disabled:opacity-40">
                    {mutations.loading ? 'Archiving...' : 'Archive'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RESTORE CONFIRMS */}
          {(modal.type === 'restore-type' || modal.type === 'restore-cat' || modal.type === 'restore-venue') && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Restore</h3>
                <button onClick={close} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-700 mb-4">Restore <span className="font-bold">{modal.item.name}</span> to active?</p>
                <div className="flex gap-3">
                  <button onClick={close} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={async () => {
                    if (modal.type === 'restore-type') await mutations.restoreEventType(modal.item.id);
                    else if (modal.type === 'restore-cat') await mutations.restoreEventCategory(modal.item.id);
                    else if (modal.type === 'restore-venue') await mutations.restoreVenue(modal.item.id);
                    close();
                  }} disabled={mutations.loading} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-40">
                    {mutations.loading ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DELETE CONFIRMS */}
          {(modal.type === 'delete-type' || modal.type === 'delete-cat' || modal.type === 'delete-venue') && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-orange-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Permanently Delete</h3>
                <button onClick={close} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">Permanently delete <span className="font-bold">{modal.item.name}</span>? This cannot be undone.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type <span className="font-mono font-bold">DELETE</span> to confirm</label>
                  <input type="text" value={deleteText} onChange={e => setDeleteText(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 font-mono" />
                </div>
                <div className="flex gap-3">
                  <button onClick={close} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={async () => {
                    if (modal.type === 'delete-type') await mutations.deleteEventTypeForever(modal.item.id);
                    else if (modal.type === 'delete-cat') await mutations.deleteEventCategoryForever(modal.item.id);
                    else if (modal.type === 'delete-venue') await mutations.deleteVenueForever(modal.item.id);
                    close();
                  }} disabled={deleteText !== 'DELETE' || mutations.loading}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-40">
                    {mutations.loading ? 'Deleting...' : 'Delete Forever'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

