import { useState, useMemo } from 'react';
import { Search, Lock, Unlock, Loader2, Coins, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { useEventPayablesStream } from '../hooks/usePayableStream';
import { toggleQRTicketUnlock } from '../services/payable.service';
import type { PayableDocument } from '../types/payable.types';
import { AdminRecordPaymentModal } from './AdminRecordPaymentModal';
import { useStudents } from '../../students/hooks/useStudentStream';
import { generatePayablesForEvent } from '../../events/services/event.service';
import { formatCurrency } from '../../../utils/currency';

interface EventPayablesQRControlProps {
  eventId: string;
  eventTitle: string;
  adminFeeAmount?: number | null;
  recordedByUid: string;
  isOfficer?: boolean;
  isClubEvent?: boolean;
  hostingOrgName?: string;
  readOnly?: boolean;
}

export function EventPayablesQRControl({
  eventId,
  eventTitle,
  adminFeeAmount,
  recordedByUid,
  isOfficer = false,
  isClubEvent = false,
  hostingOrgName,
  readOnly = false,
}: EventPayablesQRControlProps) {
  const { data: payables, loading } = useEventPayablesStream(eventId);
  const { data: students } = useStudents();

  // Admin cannot accept payment or unlock QR tickets for club events
  const canManagePayments = !readOnly && (isOfficer ? true : !isClubEvent);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'locked' | 'unlocked'>('all');
  const [selectedPayable, setSelectedPayable] = useState<PayableDocument | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Map student records by id, authUid, and studentId
  const studentsMap = useMemo(() => {
    const map: Record<string, any> = {};
    (students || []).forEach((s) => {
      if (s.id) map[s.id] = s;
      if (s.authUid) map[s.authUid] = s;
      if (s.studentId) map[s.studentId] = s;
    });
    return map;
  }, [students]);

  const getStudentDisplayName = (p: PayableDocument) => {
    const matched =
      studentsMap[p.studentId] ||
      (p.studentSchoolId ? studentsMap[p.studentSchoolId] : undefined) ||
      ((p as any).authUid ? studentsMap[(p as any).authUid] : undefined);

    if (matched) {
      const full = `${matched.firstName || ''} ${matched.lastName || ''}`.trim();
      if (full) return full;
    }

    if (p.studentName && p.studentName.trim() && p.studentName !== 'Student') return p.studentName;
    const raw = p as any;
    if (raw.name && String(raw.name).trim()) return raw.name;
    if (raw.student_name && String(raw.student_name).trim()) return raw.student_name;
    if (raw.fullName && String(raw.fullName).trim()) return raw.fullName;
    return p.studentName || 'Student';
  };

  const getStudentDisplayId = (p: PayableDocument) => {
    const matched =
      studentsMap[p.studentId] ||
      (p.studentSchoolId ? studentsMap[p.studentSchoolId] : undefined) ||
      ((p as any).authUid ? studentsMap[(p as any).authUid] : undefined);

    // Official 11-digit STI Student ID
    if (matched && matched.studentId && matched.studentId.trim()) {
      return matched.studentId;
    }

    if (p.studentSchoolId && p.studentSchoolId.trim()) return p.studentSchoolId;
    const raw = p as any;
    if (raw.schoolId && String(raw.schoolId).trim()) return raw.schoolId;
    if (raw.studentNumber && String(raw.studentNumber).trim()) return raw.studentNumber;
    if (raw.stiId && String(raw.stiId).trim()) return raw.stiId;
    if (p.studentId && p.studentId.trim() && !p.studentId.includes('-') && p.studentId.length >= 8) {
      return p.studentId;
    }
    return 'N/A';
  };

  const filteredPayables = useMemo(() => {
    return payables.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const sName = getStudentDisplayName(p).toLowerCase();
      const sId = getStudentDisplayId(p).toLowerCase();

      const matchesSearch = !q || sName.includes(q) || sId.includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'unpaid') return p.status !== 'paid' && p.status !== 'waived';
      if (statusFilter === 'paid') return p.status === 'paid' || p.status === 'waived';
      if (statusFilter === 'locked') return !p.qrTicketUnlocked;
      if (statusFilter === 'unlocked') return !!p.qrTicketUnlocked;

      return true;
    });
  }, [payables, searchQuery, statusFilter]);

  const totalAssigned = useMemo(() => payables.reduce((a, p) => a + (p.assignedAmount || 0), 0), [payables]);
  const totalCollected = useMemo(() => payables.reduce((a, p) => a + (p.paidAmount || 0), 0), [payables]);
  const unlockedCount = useMemo(() => payables.filter((p) => p.qrTicketUnlocked).length, [payables]);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleToggleQR = async (payableId: string, currentUnlocked: boolean) => {
    if (!canManagePayments) return;
    setTogglingId(payableId);
    try {
      await toggleQRTicketUnlock(payableId, !currentUnlocked);
    } catch (err) {
      console.error('Failed to toggle QR code unlock:', err);
      alert('Error updating QR ticket state.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSyncPayablesData = async () => {
    setIsSyncing(true);
    try {
      // If no payables exist, generate them for this event
      if (payables.length === 0) {
        const eventDocRef = doc(db, 'events', eventId);
        const snap = await getDoc(eventDocRef);
        if (snap.exists()) {
          await generatePayablesForEvent({ ...snap.data(), proposalStatus: 'approved' }, eventId, recordedByUid);
        }
      }

      // Update missing fields in existing Firestore payables documents
      if (payables.length > 0) {
        const batch = writeBatch(db);
        let count = 0;
        for (const p of payables) {
          const name = getStudentDisplayName(p);
          const schoolId = getStudentDisplayId(p);
          const ref = doc(db, 'payables', p.id);

          const updates: Record<string, any> = {};
          if (!p.studentName || p.studentName === 'Student') updates.studentName = name;
          if (!p.studentSchoolId || p.studentSchoolId !== schoolId) updates.studentSchoolId = schoolId;
          if (p.qrTicketUnlocked === undefined) updates.qrTicketUnlocked = false;

          if (Object.keys(updates).length > 0) {
            batch.update(ref, updates);
            count++;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      }
      alert('Database payables synced successfully!');
    } catch (err) {
      console.error('Error syncing payables:', err);
      alert('Failed to sync payables database records.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-8 text-center space-y-2">
        <Loader2 className="w-6 h-6 animate-spin text-[#83358E] mx-auto" />
        <p className="text-gray-500 text-xs font-medium">Loading event student payables & QR access control...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-sm space-y-0">
      {/* Header Banner */}
      <div className="bg-[#001A4D] text-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-5 h-5 text-[#FFC107]" />
            <h3 className="text-lg font-bold">Student Payables & QR Access Control</h3>
          </div>
          <p className="text-gray-300 text-xs">
            {canManagePayments
              ? `Manage student payments and explicitly unlock or lock event QR ticket entry for ${eventTitle}`
              : `View student payables roster and QR ticket entry status for ${eventTitle}`}
          </p>
        </div>

        {/* Metrics Summary & Sync Action */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="bg-white/10 px-3.5 py-2 rounded-lg border border-white/10">
            <p className="text-gray-400 text-[10px] uppercase font-semibold">Total Collection</p>
            <p className="font-bold text-sm text-[#FFC107]">{formatCurrency(totalCollected)} <span className="text-gray-300 font-normal text-xs">/ {formatCurrency(totalAssigned)}</span></p>
          </div>
          <div className="bg-white/10 px-3.5 py-2 rounded-lg border border-white/10">
            <p className="text-gray-400 text-[10px] uppercase font-semibold">Unlocked Tickets</p>
            <p className="font-bold text-sm text-emerald-400">{unlockedCount} <span className="text-gray-300 font-normal text-xs">/ {payables.length}</span></p>
          </div>
          <button
            onClick={handleSyncPayablesData}
            disabled={isSyncing}
            className="bg-[#FFC107] hover:bg-[#F59E0B] text-[#001A4D] px-3.5 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Sync missing student names, 11-digit STI IDs, or generate payables"
          >
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sync Roster Data
          </button>
        </div>
      </div>

      {/* Notice Banner when Admin is viewing a club event */}
      {!canManagePayments && (
        <div className="p-3.5 bg-amber-50 border-b border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Club-Managed Event Fee & QR Gate Access</p>
            <p className="text-amber-800 text-[11px] mt-0.5">
              Payment collection and QR ticket unlocking for this event are handled directly by {hostingOrgName ? `the ${hostingOrgName} officers` : 'the club officers'}. The SAS Admin view is read-only for institutional monitoring.
            </p>
          </div>
        </div>
      )}

      {/* Toolbar: Search & Status Filters */}
      <div className="p-4 border-b border-[#E0E0E0] bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search student name, school ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#001A4D] bg-white"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: `All (${payables.length})` },
            { id: 'unpaid', label: 'Unpaid' },
            { id: 'paid', label: 'Paid' },
            { id: 'locked', label: '🔒 Locked QR' },
            { id: 'unlocked', label: '🔓 Unlocked QR' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-[#001A4D] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Payables Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F8F8F8] border-b border-[#E0E0E0] text-[#888780] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Student Name</th>
              <th className="px-5 py-3">School ID</th>
              <th className="px-5 py-3">Fee Amount</th>
              <th className="px-5 py-3">Paid Amount</th>
              <th className="px-5 py-3">Payment Status</th>
              <th className="px-5 py-3">QR Ticket Access</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0]">
            {filteredPayables.map((payable) => {
              const isPaid = payable.status === 'paid' || payable.status === 'waived';
              const isPartial = payable.status === 'partial';
              const isUnlocked = !!payable.qrTicketUnlocked;

              return (
                <tr key={payable.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-[#001A4D]">
                    {getStudentDisplayName(payable)}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-gray-600">
                    {getStudentDisplayId(payable)}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-[#001A4D]">
                    {formatCurrency(payable.assignedAmount)}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-emerald-700">
                    {formatCurrency(payable.paidAmount || 0)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-800'
                          : isPartial
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {payable.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {canManagePayments ? (
                      <button
                        onClick={() => handleToggleQR(payable.id, isUnlocked)}
                        disabled={togglingId === payable.id}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                          isUnlocked
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                        }`}
                        title="Click to toggle QR ticket access status"
                      >
                        {togglingId === payable.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isUnlocked ? (
                          <>
                            <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Unlocked</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 text-amber-700" />
                            <span>Locked</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 ${
                          isUnlocked
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isUnlocked ? (
                          <>
                            <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Unlocked</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 text-amber-700" />
                            <span>Locked</span>
                          </>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {canManagePayments ? (
                      <button
                        onClick={() => setSelectedPayable(payable)}
                        className="px-3 py-1.5 bg-[#001A4D] hover:bg-[#001A4D]/90 text-white rounded-lg font-bold text-[11px] transition-colors shadow-sm inline-flex items-center gap-1"
                      >
                        <Coins className="w-3.5 h-3.5 text-[#FFC107]" />
                        Record Payment
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg text-[11px] font-semibold inline-block">
                        Club Managed
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {filteredPayables.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-xs">
                  {payables.length === 0
                    ? 'No student payables found for this event. Verify that student payables were enabled.'
                    : 'No student payables match your search criteria.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <div className="p-4 bg-gray-50 border-t border-[#E0E0E0] flex items-center justify-between text-xs text-gray-500">
        <span>Showing {filteredPayables.length} of {payables.length} student records</span>
        <span className="text-[11px] text-gray-400">
          {canManagePayments
            ? 'Advisers & Officers have permission to record cash payments and manage QR ticket gate access'
            : 'Payment collections and QR ticket unlocking for club events are managed by student officers.'}
        </span>
      </div>

      {/* Record Payment Modal */}
      {selectedPayable && canManagePayments && (
        <AdminRecordPaymentModal
          payable={selectedPayable}
          onClose={() => setSelectedPayable(null)}
          recordedByUid={recordedByUid}
          resolvedName={getStudentDisplayName(selectedPayable)}
          resolvedSchoolId={getStudentDisplayId(selectedPayable)}
        />
      )}
    </div>
  );
}
