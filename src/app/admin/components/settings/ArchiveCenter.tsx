import { useState } from 'react';
import { Archive, RotateCcw, Trash2, Search, Clock, Lock, X, AlertTriangle } from 'lucide-react';

interface ArchiveCenterProps {
  onUnsavedChange: () => void;
}

interface ArchivedItem {
  id: string;
  itemType: string;
  itemName: string;
  description: string;
  archivedDate: string;
  archivedBy: string;
  archiveReason: string;
  associatedRecords: number;
  canDelete: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  'Department': '#1E70E8',
  'Course': '#0E4EBD',
  'Section': '#002B7F',
  'Event Type': '#F97316',
  'Event Category': '#FFC107',
  'Venue': '#22C55E',
  'Club Type': '#001A4D',
  'Compliance Req.': '#EF4444',
  'Semester': '#0EA5E9',
  'Calendar Entry': '#10B981',
  'Grade Period': '#6366F1',
};

const ALL_TYPES = Object.keys(TYPE_COLORS);

const MOCK_ITEMS: ArchivedItem[] = [
  { id: 'a1', itemType: 'Department', itemName: 'School of Engineering', description: 'Engineering programs', archivedDate: '2025-03-15', archivedBy: 'Admin SAO', archiveReason: 'Program discontinued', associatedRecords: 0, canDelete: true },
  { id: 'a2', itemType: 'Course', itemName: 'Bachelor of Science in Nursing', description: 'BSN Program', archivedDate: '2025-06-01', archivedBy: 'Admin SAO', archiveReason: 'No longer offered', associatedRecords: 23, canDelete: false },
  { id: 'a3', itemType: 'Event Type', itemName: 'Sports', description: 'Athletics and sports events', archivedDate: '2025-08-20', archivedBy: 'Admin SAO', archiveReason: 'Merged into Cultural type', associatedRecords: 5, canDelete: false },
  { id: 'a4', itemType: 'Venue', itemName: 'Old Library Hall', description: 'Now used as storage', archivedDate: '2025-09-10', archivedBy: 'Admin SAO', archiveReason: 'Renovated', associatedRecords: 0, canDelete: true },
  { id: 'a5', itemType: 'Section', itemName: 'BSIT-3C', description: 'Dissolved section', archivedDate: '2025-11-01', archivedBy: 'Admin SAO', archiveReason: 'Low enrollment', associatedRecords: 0, canDelete: true },
  { id: 'a6', itemType: 'Club Type', itemName: 'Debate', description: 'Debate clubs category', archivedDate: '2025-12-05', archivedBy: 'Admin SAO', archiveReason: 'Reclassified as Academic', associatedRecords: 2, canDelete: false },
  { id: 'a7', itemType: 'Calendar Entry', itemName: 'Field Trip Day', description: 'Annual field trip holiday', archivedDate: '2026-01-10', archivedBy: 'Admin SAO', archiveReason: 'Policy discontinued', associatedRecords: 0, canDelete: true },
  { id: 'a8', itemType: 'Grade Period', itemName: 'Long Exam Week', description: 'Mid-sem long exam', archivedDate: '2026-02-20', archivedBy: 'Admin SAO', archiveReason: 'Schedule restructured', associatedRecords: 0, canDelete: true },
];

type ConfirmModal =
  | { type: 'none' }
  | { type: 'restore'; item: ArchivedItem }
  | { type: 'delete'; item: ArchivedItem };

export default function ArchiveCenter({ onUnsavedChange }: ArchiveCenterProps) {
  const [items, setItems] = useState<ArchivedItem[]>(MOCK_ITEMS);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [modal, setModal] = useState<ConfirmModal>({ type: 'none' });
  const [deleteText, setDeleteText] = useState('');
  const [autoPurgeDays, setAutoPurgeDays] = useState(365);
  const [weeklyReport, setWeeklyReport] = useState(false);

  const close = () => { setModal({ type: 'none' }); setDeleteText(''); };

  const restore = (item: ArchivedItem) => { setItems(items.filter(i => i.id !== item.id)); onUnsavedChange(); close(); };
  const permanentDelete = (item: ArchivedItem) => { setItems(items.filter(i => i.id !== item.id)); onUnsavedChange(); close(); };

  const filtered = items
    .filter(i => typeFilter === 'All' || i.itemType === typeFilter)
    .filter(i => i.itemName.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.archivedDate).getTime() - new Date(a.archivedDate).getTime();
      if (sortOrder === 'oldest') return new Date(a.archivedDate).getTime() - new Date(b.archivedDate).getTime();
      return a.itemName.localeCompare(b.itemName);
    });

  const restorableCount = items.filter(i => i.canDelete || i.associatedRecords === 0).length;
  const pendingPurge = items.filter(i => {
    const daysAgo = (Date.now() - new Date(i.archivedDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo > 90;
  }).length;
  const cannotDelete = items.filter(i => !i.canDelete && i.associatedRecords > 0).length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Archive Center</h2>
        <p className="text-sm text-gray-500 mt-1">View and manage all archived items across your system settings.</p>
        <p className="text-xs text-gray-400 mt-0.5 italic">This is a read-only audit trail of all soft-deleted settings items.</p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 flex items-center gap-3">
          <Archive className="w-6 h-6 text-gray-400" />
          <div>
            <div className="text-2xl font-bold text-[#001A4D]">{items.length}</div>
            <div className="text-xs text-gray-500">Total Archived</div>
          </div>
        </div>
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 flex items-center gap-3">
          <RotateCcw className="w-6 h-6 text-green-500" />
          <div>
            <div className="text-2xl font-bold text-green-600">{restorableCount}</div>
            <div className="text-xs text-gray-500">Restorable Items</div>
          </div>
        </div>
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-6 h-6 text-amber-500" />
          <div>
            <div className="text-2xl font-bold text-amber-600">{pendingPurge}</div>
            <div className="text-xs text-gray-500">Pending Purge (&gt;90 days)</div>
          </div>
        </div>
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 flex items-center gap-3">
          <Lock className="w-6 h-6 text-red-400" />
          <div>
            <div className="text-2xl font-bold text-red-500">{cannotDelete}</div>
            <div className="text-xs text-gray-500">Cannot Delete</div>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent"
              placeholder="Search archived items..." />
          </div>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value as typeof sortOrder)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {['All', ...ALL_TYPES].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${typeFilter === t ? 'bg-[#001A4D] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Item Type</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Item Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Archived Date</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Archived By</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Reason</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Associated</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: (TYPE_COLORS[item.itemType] ?? '#ccc') + '20', color: TYPE_COLORS[item.itemType] ?? '#666' }}>
                    {item.itemType}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{item.itemName}</div>
                  <div className="text-xs text-gray-400 truncate max-w-48">{item.description}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.archivedDate}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.archivedBy}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-36 truncate">{item.archiveReason || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${item.associatedRecords > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {item.associatedRecords > 0 ? `${item.associatedRecords} records` : 'None'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setModal({ type: 'restore', item })}
                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Restore
                    </button>
                    <button
                      onClick={() => item.canDelete && setModal({ type: 'delete', item })}
                      disabled={!item.canDelete}
                      title={!item.canDelete ? `Cannot delete — ${item.associatedRecords} associated records` : 'Permanently delete'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-colors ${item.canDelete ? 'border-red-400 text-red-600 hover:bg-red-50' : 'border-gray-200 text-gray-300 cursor-not-allowed'}`}>
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                <Archive className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                No archived items found.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* AUTO-PURGE CONFIG */}
      <div className="bg-white border-l-4 border-[#0E4EBD] border border-[#E0E0E0] rounded-xl p-5 shadow-xs">
        <h3 className="font-bold text-[#001A4D] mb-4">Auto-Purge Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Auto-Permanently Delete After</label>
              <div className="flex items-center gap-2">
                <input type="number" value={autoPurgeDays} onChange={e => setAutoPurgeDays(Number(e.target.value))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]" min={30} />
                <span className="text-sm text-gray-500">days after archiving</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Items archived longer than this will be flagged for permanent deletion review.</p>
            </div>
          </div>
          <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-700">Send Weekly Archive Report to Adviser Email</p>
              <p className="text-xs text-gray-400 mt-0.5">Receive a summary of archived items and pending deletions.</p>
            </div>
            <button onClick={() => setWeeklyReport(!weeklyReport)}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${weeklyReport ? 'bg-[#001A4D]' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${weeklyReport ? 'translate-x-5' : ''}`} />
            </button>
          </label>
          <div className="flex justify-end">
            <button onClick={() => onUnsavedChange()} className="px-5 py-2 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-xs">
              Save Auto-Purge Settings
            </button>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {modal.type !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={close} />

          {modal.type === 'restore' && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Restore Item</h3>
                <button onClick={close} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-700 mb-1">Restore <span className="font-bold">{modal.item.itemName}</span> back to active?</p>
                <p className="text-xs text-gray-400 mb-4">Type: {modal.item.itemType}</p>
                <div className="flex gap-3">
                  <button onClick={close} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={() => restore(modal.item)} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700">Restore Item</button>
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
                  <p className="text-sm text-red-700">All data associated with <span className="font-bold">{modal.item.itemName}</span> will be permanently removed. This cannot be undone.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type <span className="font-mono font-bold">DELETE</span> to confirm</label>
                  <input type="text" value={deleteText} onChange={e => setDeleteText(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-red-500" />
                </div>
                <div className="flex gap-3">
                  <button onClick={close} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={() => permanentDelete(modal.item)} disabled={deleteText !== 'DELETE'}
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
