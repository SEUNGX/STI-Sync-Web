import { useState, useMemo, useEffect } from 'react';
import {
  Coins,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRightLeft,
  Loader2,
  DollarSign,
  PlusCircle,
  Eye,
  Check,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEventPayablesStream } from '../hooks/usePayableStream';
import { useStudents } from '../../students/hooks/useStudentStream';
import { waivePayable } from '../services/payable.service';
import { formatCurrency } from '../../../utils/currency';
import { formatAppDate, formatAppDateTime } from '../../../utils/date';
import { AdminRecordPaymentModal } from './AdminRecordPaymentModal';
import type { PayableDocument } from '../types/payable.types';
import { TablePagination } from '../../../components/common/TablePagination';

interface EventFinesRosterViewProps {
  eventId: string;
  eventTitle: string;
  isOfficer: boolean;
  orgId?: string | null;
  orgName?: string | null;
  canAssessFines?: boolean;
  recordedByUid: string;
  semesterId?: string;
  onOpenAssessFinesModal: () => void;
  isEventCompleted: boolean;
}

export function EventFinesRosterView({
  eventId,
  eventTitle,
  isOfficer,
  orgId,
  orgName,
  canAssessFines = true,
  recordedByUid,
  semesterId,
  onOpenAssessFinesModal,
  isEventCompleted,
}: EventFinesRosterViewProps) {
  const { data: allEventPayables, loading } = useEventPayablesStream(eventId);
  const { data: students } = useStudents();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'waived' | 'transferred'>('all');
  const [selectedPaymentPayable, setSelectedPaymentPayable] = useState<PayableDocument | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [waivingId, setWaivingId] = useState<string | null>(null);

  // Student lookup map
  const studentsMap = useMemo(() => {
    const map: Record<string, any> = {};
    (students || []).forEach((s) => {
      if (s.id) map[s.id] = s;
      if (s.authUid) map[s.authUid] = s;
      if (s.studentId) map[s.studentId] = s;
    });
    return map;
  }, [students]);

  // Target payable type based on role and event ownership
  const finePayables = useMemo(() => {
    if (isOfficer) {
      return allEventPayables.filter((p) => p.type === 'org_fine');
    }
    // Admin viewing: show admin fines for institutional events, or org fines for club events
    if (canAssessFines) {
      return allEventPayables.filter((p) => p.type === 'admin_fine');
    }
    return allEventPayables.filter((p) => p.type === 'org_fine' || p.type === 'admin_fine');
  }, [allEventPayables, isOfficer, canAssessFines]);

  const getStudentDisplayName = (p: PayableDocument) => {
    const matched =
      studentsMap[p.studentId] ||
      (p.studentSchoolId ? studentsMap[p.studentSchoolId] : undefined);
    if (matched) {
      const full = `${matched.firstName || ''} ${matched.lastName || ''}`.trim();
      if (full) return full;
    }
    return p.studentName || 'Student';
  };

  const getStudentDisplayId = (p: PayableDocument) => {
    const matched =
      studentsMap[p.studentId] ||
      (p.studentSchoolId ? studentsMap[p.studentSchoolId] : undefined);
    if (matched && matched.studentId) return matched.studentId;
    return p.studentSchoolId || p.studentId || 'N/A';
  };

  const getStudentAcademicInfo = (p: PayableDocument) => {
    const matched =
      studentsMap[p.studentId] ||
      (p.studentSchoolId ? studentsMap[p.studentSchoolId] : undefined);
    if (matched) {
      return {
        course: matched.courseCode || matched.courseName || '—',
        year: matched.yearLevel ? `Year ${matched.yearLevel}` : '—',
        section: matched.section || '—',
      };
    }
    return { course: '—', year: '—', section: '—' };
  };

  // Financial statistics
  const stats = useMemo(() => {
    const totalAssigned = finePayables.reduce((a, p) => a + (p.assignedAmount || 0), 0);
    const totalCollected = finePayables.reduce((a, p) => a + (p.paidAmount || (p.status === 'paid' ? p.assignedAmount : 0)), 0);
    const totalOutstanding = Math.max(0, totalAssigned - totalCollected);
    
    const paidFines = finePayables.filter((p) => p.status === 'paid');
    const transferredFines = paidFines.filter((p) => p.transferredToBudget);
    const pendingTransferFines = paidFines.filter((p) => !p.transferredToBudget);

    const pendingTransferAmount = pendingTransferFines.reduce(
      (a, p) => a + (p.paidAmount || p.assignedAmount || 0),
      0
    );

    const transferredAmount = transferredFines.reduce(
      (a, p) => a + (p.paidAmount || p.assignedAmount || 0),
      0
    );

    return {
      totalAssigned,
      totalCollected,
      totalOutstanding,
      totalCount: finePayables.length,
      paidCount: paidFines.length,
      pendingTransferCount: pendingTransferFines.length,
      pendingTransferAmount,
      transferredAmount,
      isFullyTransferred: paidFines.length > 0 && pendingTransferFines.length === 0,
    };
  }, [finePayables]);

  // Filtered rows
  const filteredPayables = useMemo(() => {
    return finePayables.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const sName = getStudentDisplayName(p).toLowerCase();
      const sId = getStudentDisplayId(p).toLowerCase();

      const matchSearch = !q || sName.includes(q) || sId.includes(q);
      if (!matchSearch) return false;

      if (statusFilter === 'pending') return p.status === 'pending' || p.status === 'partial' || p.status === 'overdue';
      if (statusFilter === 'paid') return p.status === 'paid';
      if (statusFilter === 'waived') return p.status === 'waived';
      if (statusFilter === 'transferred') return !!p.transferredToBudget;

      return true;
    });
  }, [finePayables, searchQuery, statusFilter, studentsMap]);

  // Pagination State (8 rows per page standard)
  const PER_PAGE = 8;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPayables.length / PER_PAGE));
  const paginatedPayables = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filteredPayables.slice(start, start + PER_PAGE);
  }, [filteredPayables, currentPage]);

  // Handle Waive Fine
  const handleWaiveFine = async (payable: PayableDocument) => {
    if (!window.confirm(`Are you sure you want to waive the fine of ${formatCurrency(payable.assignedAmount)} for ${getStudentDisplayName(payable)}?`)) {
      return;
    }

    setWaivingId(payable.id);
    try {
      await waivePayable(payable.id, recordedByUid || 'admin');
      toast.success(`Waived fine for ${getStudentDisplayName(payable)}.`);
    } catch (err: any) {
      console.error('[EventFinesRosterView] Waive error:', err);
      toast.error('Failed to waive fine.');
    } finally {
      setWaivingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-[#E0E0E0] rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-gray-500">Total Fines Assessed</span>
            <div className="p-2 bg-blue-50 rounded-xl">
              <Coins className="w-5 h-5 text-[#0E4EBD]" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#001A4D] mt-2">
            {formatCurrency(stats.totalAssigned)}
          </div>
          <span className="text-xs text-gray-400 mt-1 block">
            Across {stats.totalCount} student fine record(s)
          </span>
        </div>

        <div className="p-5 bg-white border border-[#E0E0E0] rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-green-600">Total Collected</span>
            <div className="p-2 bg-green-50 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-green-700 mt-2">
            {formatCurrency(stats.totalCollected)}
          </div>
          <span className="text-xs text-gray-400 mt-1 block">
            {stats.paidCount} paid fine violation(s)
          </span>
        </div>

        <div className="p-5 bg-white border border-[#E0E0E0] rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-red-500">Outstanding Balance</span>
            <div className="p-2 bg-red-50 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-600 mt-2">
            {formatCurrency(stats.totalOutstanding)}
          </div>
          <span className="text-xs text-gray-400 mt-1 block">
            Unpaid / pending collections
          </span>
        </div>

        {/* Ledger Transfer Status Card */}
        <div className="p-5 bg-gradient-to-br from-[#001A4D] via-[#002B7F] to-[#0A47B8] text-white rounded-2xl shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-[#FFD41C]">
              {isOfficer ? 'Org Treasury Transfer' : 'Institutional Transfer'}
            </span>
            <ArrowRightLeft className="w-5 h-5 text-white/70" />
          </div>
          <div className="text-xl font-bold mt-2">
            {formatCurrency(stats.pendingTransferAmount)}
          </div>
          <div className="flex items-center justify-between mt-1 text-xs text-white/80">
            <span>Pending Transfer</span>
            {stats.transferredAmount > 0 && (
              <span className="text-green-300 font-semibold">
                ✓ {formatCurrency(stats.transferredAmount)} Transferred
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Organization Event Non-Admin Notice Banner */}
      {!canAssessFines && !isOfficer && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-900 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-sm block text-amber-900">
              Club Event — Managed by {orgName || 'Hosting Organization'}
            </span>
            <p className="mt-0.5 text-amber-800">
              This event is hosted by a student organization. Event fines and ledger transfers for this event can only be assessed and managed by the hosting club's student officers.
            </p>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by student name or student ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canAssessFines && (
              finePayables.length > 0 ? (
                <button
                  type="button"
                  onClick={onOpenAssessFinesModal}
                  className="px-4 py-2 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-[#FFD41C]" />
                  <span>View Fine Configuration ({finePayables.length})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAssessFinesModal}
                  className="px-4 py-2 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Coins className="w-4 h-4 text-[#FFD41C]" />
                  <span>Configure & Assess Fines</span>
                </button>
              )
            )}

            {canAssessFines && stats.totalCollected > 0 && (
              <div
                title="Collected fine payments are transferred directly to the budget ledger via School Budget & Fund Management / Finance Center."
                className="px-3.5 py-2 bg-blue-50 text-[#0E4EBD] border border-blue-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs select-none"
              >
                <Info className="w-4 h-4 text-[#0E4EBD]" />
                <span>
                  Collected: {formatCurrency(stats.totalCollected)} (Transfers managed in {isOfficer ? 'Finance Center' : 'Budget & Fund'})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <span className="text-xs font-bold text-gray-500 mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-gray-400" /> Filter:
          </span>
          {[
            { id: 'all', label: `All (${finePayables.length})` },
            { id: 'pending', label: `Pending (${finePayables.filter((p) => p.status !== 'paid' && p.status !== 'waived').length})` },
            { id: 'paid', label: `Paid (${stats.paidCount})` },
            { id: 'waived', label: `Waived (${finePayables.filter((p) => p.status === 'waived').length})` },
            { id: 'transferred', label: `Transferred (${finePayables.filter((p) => p.transferredToBudget).length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#001A4D] text-[#FFD41C]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fines Table */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-gray-500 space-y-2">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0E4EBD]" />
            <p className="text-xs">Loading event fine records...</p>
          </div>
        ) : filteredPayables.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-[#0E4EBD]">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#001A4D]">
                {finePayables.length === 0 ? 'No Fine Payables Assessed Yet' : 'No Matching Fine Records'}
              </p>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                {finePayables.length === 0
                  ? 'Click "Configure & Assess Fines" to evaluate attendee check-in/out violations and generate student fine obligations.'
                  : 'Try clearing your search query or adjusting status filter tabs.'}
              </p>
            </div>
            {finePayables.length === 0 && (
              <button
                type="button"
                onClick={onOpenAssessFinesModal}
                className="px-4 py-2 bg-[#001A4D] text-[#FFD41C] rounded-xl text-xs font-bold hover:bg-[#002B7F] transition-colors cursor-pointer"
              >
                Assess Event Fines Now →
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-4">Student Details</th>
                  <th className="p-4">Academic Info</th>
                  <th className="p-4">Violation Breakdown</th>
                  <th className="p-4 text-right">Assessed</th>
                  <th className="p-4 text-right">Paid</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Ledger Transfer</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedPayables.map((p) => {
                  const displayName = getStudentDisplayName(p);
                  const displayId = getStudentDisplayId(p);
                  const acad = getStudentAcademicInfo(p);
                  const isPaid = p.status === 'paid';
                  const isWaived = p.status === 'waived';
                  const remaining = Math.max(0, (p.assignedAmount || 0) - (p.paidAmount || 0));

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Student Info */}
                      <td className="p-4">
                        <span className="font-bold text-[#001A4D] block text-sm">{displayName}</span>
                        <span className="text-[11px] text-gray-500 font-mono mt-0.5 block">
                          ID: {displayId}
                        </span>
                      </td>

                      {/* Academic Info */}
                      <td className="p-4 text-gray-600">
                        <span className="font-semibold block text-[#001A4D]">{acad.course}</span>
                        <span className="text-[11px] text-gray-400 block">
                          {acad.section} • {acad.year}
                        </span>
                      </td>

                      {/* Violation Breakdown */}
                      <td className="p-4 max-w-xs">
                        {p.fineViolations && p.fineViolations.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.fineViolations.map((v, idx) => (
                              <span
                                key={idx}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  v.violationType === 'time_in_absent'
                                    ? 'bg-red-100 text-red-700'
                                    : v.violationType === 'time_in_late'
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {v.description}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs truncate block" title={p.description}>
                            {p.description || p.label}
                          </span>
                        )}
                      </td>

                      {/* Assessed */}
                      <td className="p-4 text-right font-bold text-[#001A4D]">
                        {formatCurrency(p.assignedAmount)}
                      </td>

                      {/* Paid */}
                      <td className="p-4 text-right font-bold text-green-700">
                        {formatCurrency(p.paidAmount || (isPaid ? p.assignedAmount : 0))}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            isPaid
                              ? 'bg-green-100 text-green-800'
                              : isWaived
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {p.status}
                        </span>
                        {p.paidAt && (
                          <span className="text-[10px] text-gray-400 block mt-1">
                            {formatAppDate(p.paidAt)}
                          </span>
                        )}
                      </td>

                      {/* Ledger Transfer Status */}
                      <td className="p-4 text-center">
                        {p.transferredToBudget ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-[#0E4EBD] border border-blue-200 text-[10px] font-bold rounded-full">
                            ✓ Transferred
                          </span>
                        ) : isPaid ? (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold rounded-full">
                            Pending Transfer
                          </span>
                        ) : (
                          <span className="text-gray-300 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid && !isWaived && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedPaymentPayable(p)}
                                className="px-2.5 py-1.5 bg-[#001A4D] text-[#FFD41C] hover:bg-[#002B7F] rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                Record Pay
                              </button>
                              <button
                                type="button"
                                onClick={() => handleWaiveFine(p)}
                                disabled={waivingId === p.id}
                                className="px-2.5 py-1.5 border border-gray-300 hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                              >
                                {waivingId === p.id ? '...' : 'Waive'}
                              </button>
                            </>
                          )}
                          {isPaid && (
                            <span className="text-green-600 text-xs font-semibold flex items-center gap-1 justify-end">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                            </span>
                          )}
                          {isWaived && (
                            <span className="text-gray-400 text-xs italic">Waived</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Standard Bottom Pagination Bar ── */}
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredPayables.length}
            itemsPerPage={PER_PAGE}
            onPageChange={setCurrentPage}
            itemName="event fines"
          />
        </>
      )}
      </div>

      {/* Record Payment Modal */}
      {selectedPaymentPayable && (
        <AdminRecordPaymentModal
          payable={selectedPaymentPayable}
          onClose={() => setSelectedPaymentPayable(null)}
          recordedByUid={recordedByUid || (isOfficer ? 'officer' : 'admin')}
          resolvedName={getStudentDisplayName(selectedPaymentPayable)}
          resolvedSchoolId={getStudentDisplayId(selectedPaymentPayable)}
        />
      )}
    </div>
  );
}
