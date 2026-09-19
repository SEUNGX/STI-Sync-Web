import { useState, useEffect, useMemo } from 'react';
import {
  Archive,
  RotateCcw,
  Trash2,
  Search,
  Clock,
  Lock,
  X,
  AlertTriangle,
  FileText,
  Users,
  Calendar,
  Megaphone,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { useAdviserProfile } from '../../../modules/auth/hooks/useAdviserProfile';
import { restoreArchivedEvent, purgeEventPermanently } from '../../../modules/events/services/event.service';
import { restoreStudent, deleteStudentPermanently } from '../../../modules/students/services/student.service';
import { logAuditEvent } from '../../../modules/audit/services/audit.service';
import { toast } from 'sonner';
import { formatAppDate, formatAppDateTime } from '../../../utils/date';

interface ArchiveCenterProps {
  onUnsavedChange?: () => void;
}

export type ArchiveCategory = 'All' | 'Event' | 'Student' | 'Announcement' | 'Document';

export interface UnifiedArchivedRecord {
  id: string;
  category: 'Event' | 'Student' | 'Announcement' | 'Document';
  title: string;
  subtitle: string;
  badgeText: string;
  archivedAt: any;
  archivedBy: string;
  archiveReason: string;
  canDeletePermanently: boolean;
  rawDoc: any;
}

type ConfirmModalState =
  | { type: 'none' }
  | { type: 'restore'; record: UnifiedArchivedRecord }
  | { type: 'purge'; record: UnifiedArchivedRecord };

export default function ArchiveCenter({ onUnsavedChange }: ArchiveCenterProps) {
  const { profile } = useAdviserProfile();
  const [selectedCategory, setSelectedCategory] = useState<ArchiveCategory>('All');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [modal, setModal] = useState<ConfirmModalState>({ type: 'none' });
  const [purgeKeyword, setPurgeKeyword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Live Records
  const [events, setEvents] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Stream Archived / Soft-Deleted Events
  useEffect(() => {
    const unsubEvents = onSnapshot(
      collection(db, 'events'),
      (snap) => {
        const archivedEvents = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((e: any) => e.isArchived === true || e.isDeleted === true);
        setEvents(archivedEvents);
        setLoading(false);
      },
      (err) => console.warn('[ArchiveCenter] Error streaming events:', err)
    );
    return () => unsubEvents();
  }, []);

  // 2. Stream Archived Students
  useEffect(() => {
    const unsubStudents = onSnapshot(
      collection(db, 'students'),
      (snap) => {
        const archivedStudents = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s: any) => s.status === 'ARCHIVED' || s.isDeleted === true);
        setStudents(archivedStudents);
      },
      (err) => console.warn('[ArchiveCenter] Error streaming students:', err)
    );
    return () => unsubStudents();
  }, []);

  // 3. Stream Soft-Deleted Announcements
  useEffect(() => {
    const unsubAnnouncements = onSnapshot(
      collection(db, 'announcements'),
      (snap) => {
        const archivedAnnouncements = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((a: any) => a.isDeleted === true || a.isArchived === true || a.status === 'archived');
        setAnnouncements(archivedAnnouncements);
      },
      (err) => console.warn('[ArchiveCenter] Error streaming announcements:', err)
    );
    return () => unsubAnnouncements();
  }, []);

  // 4. Stream Soft-Deleted Documents
  useEffect(() => {
    const unsubDocs = onSnapshot(
      collection(db, 'documents'),
      (snap) => {
        const archivedDocs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((docItem: any) => docItem.isDeleted === true || docItem.status === 'archived');
        setDocuments(archivedDocs);
      },
      (err) => console.warn('[ArchiveCenter] Error streaming documents:', err)
    );
    return () => unsubDocs();
  }, []);

  // Map to unified records
  const unifiedRecords: UnifiedArchivedRecord[] = useMemo(() => {
    const records: UnifiedArchivedRecord[] = [];

    // Events
    events.forEach((e) => {
      records.push({
        id: e.id,
        category: 'Event',
        title: e.title || 'Untitled Event',
        subtitle: `${e.referenceId || 'EVT'} • ${e.schoolYear || 'N/A'} • ${e.status || 'event'}`,
        badgeText: e.isArchived ? 'Archived Event' : 'Soft Deleted',
        archivedAt: e.archivedAt || e.deletedAt || e.updatedAt || e.createdAt,
        archivedBy: e.deletedBy || e.supervisorId || 'SAO Administrator',
        archiveReason: e.archivedReason || e.deleteReason || 'Semester Rollover / Inactive',
        canDeletePermanently: true,
        rawDoc: e,
      });
    });

    // Students
    students.forEach((s) => {
      const studentName = `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Unknown Student';
      records.push({
        id: s.id,
        category: 'Student',
        title: studentName,
        subtitle: `${s.studentId || 'ID-N/A'} • ${s.courseCode || 'N/A'} • ${s.yearLevel || ''}`,
        badgeText: 'Archived Student',
        archivedAt: s.archivedAt || s.updatedAt || s.createdAt,
        archivedBy: s.archivedBy || 'SAO Registrar',
        archiveReason: s.archiveReason || 'Graduated / Transferred / Inactive',
        canDeletePermanently: true,
        rawDoc: s,
      });
    });

    // Announcements
    announcements.forEach((a) => {
      records.push({
        id: a.id,
        category: 'Announcement',
        title: a.title || 'Untitled Announcement',
        subtitle: `Posted by ${a.authorName || 'Admin'}`,
        badgeText: 'Archived Notice',
        archivedAt: a.deletedAt || a.updatedAt || a.createdAt,
        archivedBy: a.deletedBy || a.authorName || 'Administrator',
        archiveReason: a.deleteReason || 'Outdated / Replaced Notice',
        canDeletePermanently: true,
        rawDoc: a,
      });
    });

    // Documents
    documents.forEach((d) => {
      records.push({
        id: d.id,
        category: 'Document',
        title: d.title || d.fileName || 'Untitled Document',
        subtitle: `${d.documentType || 'File'} • Uploaded by ${d.uploadedByName || d.uploadedBy || 'User'}`,
        badgeText: 'Archived Document',
        archivedAt: d.deletedAt || d.updatedAt || d.createdAt,
        archivedBy: d.deletedBy || 'System Admin',
        archiveReason: d.deleteReason || 'Archived record',
        canDeletePermanently: true,
        rawDoc: d,
      });
    });

    return records;
  }, [events, students, announcements, documents]);

  // Counts
  const counts = useMemo(() => {
    return {
      all: unifiedRecords.length,
      events: events.length,
      students: students.length,
      announcements: announcements.length,
      documents: documents.length,
    };
  }, [unifiedRecords, events, students, announcements, documents]);

  // Filter and sort
  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unifiedRecords
      .filter((r) => {
        if (selectedCategory !== 'All' && r.category !== selectedCategory) return false;
        if (!q) return true;
        return (
          r.title.toLowerCase().includes(q) ||
          r.subtitle.toLowerCase().includes(q) ||
          r.archiveReason.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortOrder === 'name') return a.title.localeCompare(b.title);
        const getTime = (val: any) => {
          if (!val) return 0;
          if (val.seconds) return val.seconds * 1000;
          const parsed = new Date(val).getTime();
          return isNaN(parsed) ? 0 : parsed;
        };
        const timeA = getTime(a.archivedAt);
        const timeB = getTime(b.archivedAt);
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
      });
  }, [unifiedRecords, selectedCategory, search, sortOrder]);

  // Handle Restore
  const handleRestore = async (record: UnifiedArchivedRecord) => {
    setIsProcessing(true);
    const adminUid = profile?.uid || 'admin';
    const adminName = profile?.displayName || 'SAO Administrator';

    try {
      if (record.category === 'Event') {
        await restoreArchivedEvent(record.id, adminUid, adminName);
      } else if (record.category === 'Student') {
        await restoreStudent(record.id, adminUid);
      } else if (record.category === 'Announcement') {
        await updateDoc(doc(db, 'announcements', record.id), {
          isDeleted: false,
          isArchived: false,
          restoredAt: Timestamp.now(),
          restoredBy: adminUid,
        });
      } else if (record.category === 'Document') {
        await updateDoc(doc(db, 'documents', record.id), {
          isDeleted: false,
          status: 'active',
          restoredAt: Timestamp.now(),
          restoredBy: adminUid,
        });
      }

      await logAuditEvent({
        action: 'RESTORE_RECORD',
        actionType: 'UPDATE',
        details: `${record.category} "${record.title}" was restored from archive by ${adminName}.`,
        performedBy: adminName,
        userRole: 'SAO Admin',
        targetId: record.id,
        targetName: record.title,
      });

      toast.success(`${record.category} Restored`, {
        description: `"${record.title}" has been successfully restored to active records.`,
      });

      if (onUnsavedChange) onUnsavedChange();
      setModal({ type: 'none' });
    } catch (err: any) {
      console.error('[ArchiveCenter] Restore error:', err);
      toast.error('Failed to restore record', {
        description: err.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Permanent Purge
  const handlePermanentPurge = async (record: UnifiedArchivedRecord) => {
    if (purgeKeyword.trim().toUpperCase() !== 'PURGE') {
      toast.error('Please type PURGE in all caps to confirm permanent deletion.');
      return;
    }

    setIsProcessing(true);
    const adminUid = profile?.uid || 'admin';
    const adminName = profile?.displayName || 'SAO Administrator';

    try {
      if (record.category === 'Event') {
        await purgeEventPermanently(record.id, adminUid, adminName);
      } else if (record.category === 'Student') {
        await deleteStudentPermanently(record.rawDoc);
      } else if (record.category === 'Announcement') {
        await deleteDoc(doc(db, 'announcements', record.id));
      } else if (record.category === 'Document') {
        await deleteDoc(doc(db, 'documents', record.id));
      }

      await logAuditEvent({
        action: 'PERMANENT_PURGE_RECORD',
        actionType: 'DELETE',
        details: `${record.category} "${record.title}" was permanently purged by ${adminName}.`,
        performedBy: adminName,
        userRole: 'SAO Admin',
        targetId: record.id,
        targetName: record.title,
      });

      toast.success('Record Permanently Purged', {
        description: `"${record.title}" and its associated sub-documents have been permanently removed.`,
      });

      if (onUnsavedChange) onUnsavedChange();
      setModal({ type: 'none' });
      setPurgeKeyword('');
    } catch (err: any) {
      console.error('[ArchiveCenter] Purge error:', err);
      toast.error('Failed to permanently purge record', {
        description: err.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#001A4D] via-[#002B7F] to-[#0E4EBD] rounded-2xl p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Archive className="w-6 h-6 text-[#FFD41C]" />
            <h2 className="text-2xl font-bold">Admin Archive &amp; Trash Recovery Center</h2>
          </div>
          <p className="text-white/80 text-sm max-w-2xl">
            Centralized hub for soft-deleted records and semester rollover archives. Restore accidentally deleted items or permanently purge historical records with audit logging.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="px-3.5 py-1.5 bg-white/10 backdrop-blur-xs rounded-xl text-xs font-mono font-bold text-[#FFD41C] border border-white/20">
            {counts.all} Total Records in Archive
          </span>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setSelectedCategory('All')}
          className={`bg-white border rounded-2xl p-4 shadow-xs cursor-pointer transition-all ${
            selectedCategory === 'All' ? 'border-[#0E4EBD] ring-2 ring-[#0E4EBD]/20' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">All Items</span>
            <Archive className="w-4 h-4 text-[#001A4D]" />
          </div>
          <p className="text-2xl font-extrabold text-[#001A4D] mt-2">{counts.all}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Across all system modules</p>
        </div>

        <div
          onClick={() => setSelectedCategory('Event')}
          className={`bg-white border rounded-2xl p-4 shadow-xs cursor-pointer transition-all ${
            selectedCategory === 'Event' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Events</span>
            <Calendar className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 mt-2">{counts.events}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Rollover &amp; soft-deleted</p>
        </div>

        <div
          onClick={() => setSelectedCategory('Student')}
          className={`bg-white border rounded-2xl p-4 shadow-xs cursor-pointer transition-all ${
            selectedCategory === 'Student' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Students</span>
            <Users className="w-4 h-4 text-[#0E4EBD]" />
          </div>
          <p className="text-2xl font-extrabold text-[#0E4EBD] mt-2">{counts.students}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Graduated / Inactive</p>
        </div>

        <div
          onClick={() => setSelectedCategory('Announcement')}
          className={`bg-white border rounded-2xl p-4 shadow-xs cursor-pointer transition-all ${
            selectedCategory === 'Announcement' ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notices &amp; Docs</span>
            <Megaphone className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-extrabold text-purple-700 mt-2">{counts.announcements + counts.documents}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{counts.announcements} notices, {counts.documents} files</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['All', 'Event', 'Student', 'Announcement', 'Document'] as ArchiveCategory[]).map((cat) => {
            const isActive = selectedCategory === cat;
            const count =
              cat === 'All'
                ? counts.all
                : cat === 'Event'
                ? counts.events
                : cat === 'Student'
                ? counts.students
                : cat === 'Announcement'
                ? counts.announcements
                : counts.documents;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-[#001A4D] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{cat === 'All' ? 'All Records' : `${cat}s`}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-[#FFD41C] text-[#001A4D]' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Sort */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search archive..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={sortOrder}
              onChange={(e: any) => setSortOrder(e.target.value)}
              className="border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:ring-2 focus:ring-[#0E4EBD]/30 outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Records Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Record Details</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Archive Reason</th>
                <th className="px-5 py-3.5">Archived Date</th>
                <th className="px-5 py-3.5">Action Authority</th>
                <th className="px-5 py-3.5 text-right">Recovery Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0E4EBD]" />
                    <p>Loading archived records from Firestore...</p>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-gray-400">
                    <Archive className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="font-bold text-gray-700 text-sm">No archived records found.</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {search ? 'Try clearing your search filters.' : 'The archive is currently empty.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => {
                  const categoryBadgeColors: Record<string, string> = {
                    Event: 'bg-amber-100 text-amber-800 border-amber-200',
                    Student: 'bg-blue-100 text-blue-800 border-blue-200',
                    Announcement: 'bg-purple-100 text-purple-800 border-purple-200',
                    Document: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                  };

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-[#001A4D] text-sm">{item.title}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{item.subtitle}</div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            categoryBadgeColors[item.category] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {item.badgeText}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-gray-700 max-w-[240px]">
                        <span className="line-clamp-2" title={item.archiveReason}>
                          {item.archiveReason}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-gray-500 font-mono text-[11px]">
                        {formatAppDateTime(item.archivedAt) || '—'}
                      </td>

                      <td className="px-5 py-3.5 text-gray-600">
                        <span className="font-medium text-gray-800">{item.archivedBy}</span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setModal({ type: 'restore', record: item })}
                            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Restore this record back to active state"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                            <span>Restore</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPurgeKeyword('');
                              setModal({ type: 'purge', record: item });
                            }}
                            className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Permanently purge this record and remove from database"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            <span>Purge</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== RESTORE CONFIRMATION MODAL ===== */}
      {modal.type === 'restore' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-blue-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-5 h-5 text-[#FFD41C]" />
                <h3 className="font-bold text-base">Restore {modal.record.category}</h3>
              </div>
              <button
                type="button"
                onClick={() => setModal({ type: 'none' })}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                Are you sure you want to restore{' '}
                <strong className="text-[#001A4D]">"{modal.record.title}"</strong> back to active records?
              </p>

              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                <p>
                  <strong>Category:</strong> {modal.record.category}
                </p>
                <p>
                  <strong>Original Reason:</strong> {modal.record.archiveReason}
                </p>
                <p className="text-[11px] text-blue-700 pt-1">
                  ✓ This record will reappear in standard portals, registries, and reports immediately.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal({ type: 'none' })}
                  disabled={isProcessing}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleRestore(modal.record)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-[#0E4EBD] hover:bg-[#001A4D] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isProcessing ? 'Restoring...' : 'Confirm Restoration'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== PERMANENT PURGE CONFIRMATION MODAL ===== */}
      {modal.type === 'purge' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-red-300 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">Permanent Record Purge</h3>
              </div>
              <button
                type="button"
                onClick={() => setModal({ type: 'none' })}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Irreversible Administrative Action</p>
                  <p className="leading-relaxed text-red-800">
                    Purging <strong className="text-red-950">"{modal.record.title}"</strong> will permanently delete this {modal.record.category.toLowerCase()} and its related sub-documents. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Type <span className="font-mono text-red-600 font-extrabold bg-red-50 px-1 py-0.5 rounded border border-red-200">PURGE</span> to confirm deletion:
                </label>
                <input
                  type="text"
                  value={purgeKeyword}
                  onChange={(e) => setPurgeKeyword(e.target.value)}
                  placeholder="Type PURGE to unlock"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-mono focus:ring-2 focus:ring-red-400 focus:border-red-500 outline-none uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal({ type: 'none' })}
                  disabled={isProcessing}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handlePermanentPurge(modal.record)}
                  disabled={isProcessing || purgeKeyword.trim().toUpperCase() !== 'PURGE'}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isProcessing ? 'Purging...' : 'Permanently Purge'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
