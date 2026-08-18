import { useState } from 'react';
import { Plus, Archive, RotateCcw, Trash2, Edit2, X, AlertTriangle } from 'lucide-react';
import { formatAppDate } from '../../../utils/date';

interface AcademicCalendarProps {
  onUnsavedChange: () => void;
}

interface CalendarEntry {
  id: string;
  entryType: string;
  label: string;
  dateStart: string;
  dateEnd: string;
  isRange: boolean;
  description: string;
  blockProposals: boolean;
  notifyConflict: boolean;
  recurring: boolean;
  recurringType: string;
  archived: boolean;
}

type Modal =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; item: CalendarEntry }
  | { type: 'archive'; item: CalendarEntry }
  | { type: 'restore'; item: CalendarEntry }
  | { type: 'delete'; item: CalendarEntry };

const ENTRY_TYPES = [
  { label: 'Class Day', color: '#22C55E' },
  { label: 'No Class', color: '#EF4444' },
  { label: 'Exam Period', color: '#F97316' },
  { label: 'Event Blackout', color: '#001A4D' },
  { label: 'Designated Event Day', color: '#0E4EBD' },
];

const INIT_ENTRIES: CalendarEntry[] = [
  { id: 'e1', entryType: 'No Class', label: 'Buwan ng Wika', dateStart: '2026-08-28', dateEnd: '2026-08-28', isRange: false, description: 'National Language Month', blockProposals: true, notifyConflict: true, recurring: true, recurringType: 'Every Year on Same Date', archived: false },
  { id: 'e2', entryType: 'Exam Period', label: 'Midterm Examinations Week', dateStart: '2026-10-05', dateEnd: '2026-10-09', isRange: true, description: 'No events during midterm exams', blockProposals: true, notifyConflict: true, recurring: false, recurringType: '', archived: false },
  { id: 'e3', entryType: 'Designated Event Day', label: 'Foundation Day', dateStart: '2026-09-15', dateEnd: '2026-09-15', isRange: false, description: 'Annual STI Foundation Day', blockProposals: false, notifyConflict: false, recurring: true, recurringType: 'Every Year on Same Date', archived: false },
  { id: 'e4', entryType: 'No Class', label: 'Christmas Holiday', dateStart: '2026-12-24', dateEnd: '2026-12-31', isRange: true, description: 'Christmas break', blockProposals: true, notifyConflict: true, recurring: true, recurringType: 'Every Year on Same Date', archived: false },
];

const typeColor = (t: string) => ENTRY_TYPES.find(e => e.label === t)?.color ?? '#ccc';

function ActiveArchivedTabs({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
      <button onClick={() => onChange(false)} className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${!active ? 'bg-white text-[#001A4D] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Active</button>
      <button onClick={() => onChange(true)} className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${active ? 'bg-white text-[#001A4D] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Archived</button>
    </div>
  );
}

const EMPTY_FORM = {
  entryType: 'Class Day', label: '', dateStart: '', dateEnd: '', isRange: false,
  description: '', blockProposals: false, notifyConflict: false, recurring: false, recurringType: 'Every Year on Same Date',
};

export default function AcademicCalendar({ onUnsavedChange }: AcademicCalendarProps) {
  const [entries, setEntries] = useState<CalendarEntry[]>(INIT_ENTRIES);
  const [archivedView, setArchivedView] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>({ type: 'none' });
  const [deleteText, setDeleteText] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const close = () => { setModal({ type: 'none' }); setDeleteText(''); };
  const change = () => onUnsavedChange();

  const active = entries.filter(e => !e.archived);
  const archived = entries.filter(e => e.archived);

  const save = () => {
    if (modal.type === 'add') {
      setEntries([...entries, { id: `e${Date.now()}`, ...form, archived: false }]);
    } else if (modal.type === 'edit') {
      setEntries(entries.map(e => e.id === modal.item.id ? { ...e, ...form } : e));
    }
    change(); close();
  };

  const displayed = archivedView ? archived : active;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Academic Calendar</h2>
        <p className="text-sm text-gray-500 mt-1">Manage calendar entries, blackout dates, and designated event days</p>
      </div>

      {/* ENTRY TYPE LEGEND */}
      <div className="flex flex-wrap gap-3">
        {ENTRY_TYPES.map(et => (
          <span key={et.label} className="flex items-center gap-1.5 text-xs text-gray-600 px-2.5 py-1 bg-white border border-gray-200 rounded-full">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: et.color }} />
            {et.label}
          </span>
        ))}
      </div>

      {/* CALENDAR ENTRIES TABLE */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-[#001A4D]">Calendar Entries</h3>
            <ActiveArchivedTabs active={archivedView} onChange={setArchivedView} />
          </div>
          <button onClick={() => { setForm({ ...EMPTY_FORM }); setModal({ type: 'add' }); }}
            className="px-4 py-2 bg-[#001A4D] text-white rounded-lg text-sm font-medium hover:bg-[#001A4D]/90 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Label</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Type</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Date(s)</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Block Proposals</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Recurring</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.map(entry => (
              <tr key={entry.id} className="hover:bg-gray-50 transition-colors"
                onMouseEnter={() => setHoveredRow(entry.id)} onMouseLeave={() => setHoveredRow(null)}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{entry.label}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: typeColor(entry.entryType) + '20', color: typeColor(entry.entryType) }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeColor(entry.entryType) }} />
                    {entry.entryType}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {entry.isRange ? `${entry.dateStart} → ${entry.dateEnd}` : entry.dateStart}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${entry.blockProposals ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                    {entry.blockProposals ? 'Blocked' : 'Allowed'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {entry.recurring ? (
                    <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-blue-100 text-blue-700">Recurring</span>
                  ) : (
                    <span className="text-xs text-gray-400">One-time</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className={`flex justify-end gap-1 transition-opacity ${hoveredRow === entry.id ? 'opacity-100' : 'opacity-0'}`}>
                    {!entry.archived ? (
                      <>
                        <button onClick={() => { setForm({ entryType: entry.entryType, label: entry.label, dateStart: entry.dateStart, dateEnd: entry.dateEnd, isRange: entry.isRange, description: entry.description, blockProposals: entry.blockProposals, notifyConflict: entry.notifyConflict, recurring: entry.recurring, recurringType: entry.recurringType }); setModal({ type: 'edit', item: entry }); }} className="p-1.5 rounded hover:bg-blue-50 text-[#1E70E8]"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setModal({ type: 'archive', item: entry })} className="p-1.5 rounded hover:bg-amber-50 text-amber-500"><Archive className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setModal({ type: 'restore', item: entry })} className="p-1.5 rounded hover:bg-green-50 text-green-600"><RotateCcw className="w-4 h-4" /></button>
                        <button onClick={() => setModal({ type: 'delete', item: entry })} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No {archivedView ? 'archived' : 'active'} calendar entries.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODALS */}
      {modal.type !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={close} />

          {(modal.type === 'add' || modal.type === 'edit') && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh] overflow-hidden">
              <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between sticky top-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-bold text-lg">{modal.type === 'add' ? 'Add Calendar Entry' : 'Edit Calendar Entry'}</h3>
                  {modal.type === 'edit' && <span className="px-2 py-0.5 bg-[#1E70E8] text-white text-xs rounded-full">Editing: {modal.item.label}</span>}
                </div>
                <button onClick={close} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Entry Type <span className="text-red-500">*</span></label>
                  <select value={form.entryType} onChange={e => setForm({ ...form, entryType: e.target.value, blockProposals: e.target.value === 'Event Blackout' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent">
                    {ENTRY_TYPES.map(t => <option key={t.label}>{t.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Type</label>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={!form.isRange} onChange={() => setForm({ ...form, isRange: false })} className="accent-[#001A4D]" />
                      <span className="text-sm text-gray-700">Single Date</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={form.isRange} onChange={() => setForm({ ...form, isRange: true })} className="accent-[#001A4D]" />
                      <span className="text-sm text-gray-700">Date Range</span>
                    </label>
                  </div>
                  <div className={`grid gap-3 ${form.isRange ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{form.isRange ? 'Start Date' : 'Date'}</label>
                      <input type="date" value={form.dateStart} onChange={e => setForm({ ...form, dateStart: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" />
                    </div>
                    {form.isRange && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">End Date</label>
                        <input type="date" value={form.dateEnd} onChange={e => setForm({ ...form, dateEnd: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Label <span className="text-red-500">*</span></label>
                  <input type="text" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent"
                    placeholder="e.g. Christmas Holiday / Final Examinations Week" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent resize-none" />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer">
                    <span className="text-sm text-gray-700">Block Event Proposals on This Date</span>
                    <button onClick={() => setForm({ ...form, blockProposals: !form.blockProposals })}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${form.blockProposals ? 'bg-[#001A4D]' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.blockProposals ? 'translate-x-5' : ''}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer">
                    <span className="text-sm text-gray-700">Notify Officers When Scheduling Conflict</span>
                    <button onClick={() => setForm({ ...form, notifyConflict: !form.notifyConflict })}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${form.notifyConflict ? 'bg-[#001A4D]' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.notifyConflict ? 'translate-x-5' : ''}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer">
                    <span className="text-sm text-gray-700">Recurring</span>
                    <button onClick={() => setForm({ ...form, recurring: !form.recurring })}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${form.recurring ? 'bg-[#001A4D]' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.recurring ? 'translate-x-5' : ''}`} />
                    </button>
                  </label>
                  {form.recurring && (
                    <select value={form.recurringType} onChange={e => setForm({ ...form, recurringType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent">
                      <option>Every Year on Same Date</option>
                      <option>Every Semester</option>
                    </select>
                  )}
                </div>

                {modal.type === 'edit' && <p className="text-xs text-gray-400 italic">Last modified: {formatAppDate(new Date())}</p>}

                <div className="flex gap-3 pt-2">
                  <button onClick={close} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={save} disabled={!form.label || !form.dateStart}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer shadow-xs">
                    {modal.type === 'add' ? 'Save' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {modal.type === 'archive' && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Archive Entry</h3>
                <button onClick={close} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-700 mb-4">Archive <span className="font-bold">{modal.item.label}</span>? It can be restored later.</p>
                <div className="flex gap-3">
                  <button onClick={close} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={() => { setEntries(entries.map(e => e.id === modal.item.id ? { ...e, archived: true } : e)); change(); close(); }} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600">Archive</button>
                </div>
              </div>
            </div>
          )}

          {modal.type === 'restore' && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Restore Entry</h3>
                <button onClick={close} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-700 mb-4">Restore <span className="font-bold">{modal.item.label}</span>?</p>
                <div className="flex gap-3">
                  <button onClick={close} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={() => { setEntries(entries.map(e => e.id === modal.item.id ? { ...e, archived: false } : e)); change(); close(); }} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700">Restore</button>
                </div>
              </div>
            </div>
          )}

          {modal.type === 'delete' && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-orange-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Permanently Delete</h3>
                <button onClick={close} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">Permanently delete <span className="font-bold">{modal.item.label}</span>? This cannot be undone.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type <span className="font-mono font-bold">DELETE</span> to confirm</label>
                  <input type="text" value={deleteText} onChange={e => setDeleteText(e.target.value)} className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm font-mono" />
                </div>
                <div className="flex gap-3">
                  <button onClick={close} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={() => { setEntries(entries.filter(e => e.id !== modal.item.id)); change(); close(); }} disabled={deleteText !== 'DELETE'}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-40">Delete Forever</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
