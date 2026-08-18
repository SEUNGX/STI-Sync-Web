import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Mail,
  Phone,
  Crown,
  UserMinus,
  UserCheck,
  Coins,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Receipt,
  FileText,
  User,
  GraduationCap,
  Building2,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { collection, query, where, onSnapshot, collectionGroup } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import type { OrganizationMemberDocument } from '../../modules/organizations/types/member.types';
import type { OrganizationOfficerDocument } from '../../modules/organizations/hooks/useOrgOfficers';
import { formatCurrency } from '../../utils/currency';
import { formatAppDate, formatAppDateTime } from '../../utils/date';
import type { PayableDocument } from '../../modules/finance/types/payable.types';
import { updateMemberStatus } from '../../modules/organizations/services/member.service';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';

interface MemberProfilePanelProps {
  member: OrganizationMemberDocument;
  officerRecord?: OrganizationOfficerDocument;
  onClose: () => void;
  onAppointOfficer?: () => void;
  onRemoveMember?: () => void;
}

type ModalTab = 'ledger' | 'overview' | 'attendance';

export function MemberProfilePanel({
  member,
  officerRecord,
  onClose,
  onAppointOfficer,
  onRemoveMember,
}: MemberProfilePanelProps) {
  const { profile } = useOfficerProfile();
  const activeOrgId = profile?.activeOrganizationId || member.organizationId || '';

  const [activeTab, setActiveTab] = useState<ModalTab>('ledger');
  const [allPayables, setAllPayables] = useState<PayableDocument[]>([]);
  const [loadingPayables, setLoadingPayables] = useState(true);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const getInitials = (name: string) =>
    (name || 'Student')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const formattedDateJoined = formatAppDate(member.dateJoined, 'Recently Joined');

  // ─── Real-time Payables & Financial Ledger Listener (Scoped to Student) ────
  useEffect(() => {
    if (!member) return;
    setLoadingPayables(true);

    const sId = member.studentId;
    const payablesRef = collection(db, 'payables');

    // Subscribe to payables matching either studentId or studentSchoolId
    const q1 = query(payablesRef, where('studentId', '==', sId));
    const q2 = query(payablesRef, where('studentSchoolId', '==', sId));

    let docsMap = new Map<string, PayableDocument>();

    const updateDocs = () => {
      const all = Array.from(docsMap.values());
      all.sort((a, b) => {
        const aTime = (a.createdAt as any)?.seconds ?? 0;
        const bTime = (b.createdAt as any)?.seconds ?? 0;
        return bTime - aTime;
      });
      setAllPayables(all);
      setLoadingPayables(false);
    };

    const unsub1 = onSnapshot(q1, (snap) => {
      snap.docs.forEach((d) => docsMap.set(d.id, { id: d.id, ...d.data() } as PayableDocument));
      updateDocs();
    });

    const unsub2 = onSnapshot(q2, (snap) => {
      snap.docs.forEach((d) => docsMap.set(d.id, { id: d.id, ...d.data() } as PayableDocument));
      updateDocs();
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [member]);

  // ─── Filter Payables to THIS Specific Organization (All Events, Fines, Dues) ─
  const orgPayables = useMemo(() => {
    if (!activeOrgId) return allPayables;
    return allPayables.filter((p) => p.organizationId === activeOrgId);
  }, [allPayables, activeOrgId]);

  // ─── Real-time Attendance History Logs Listener ────────────────────────────
  useEffect(() => {
    if (!member) return;
    setLoadingAttendance(true);

    const sId = member.studentId;
    const attRef = collectionGroup(db, 'attendance');

    const unsubscribe = onSnapshot(
      attRef,
      (snapshot) => {
        const logs: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const matchesStudent =
            data.studentId === sId ||
            data.studentSchoolId === sId ||
            data.studentNumber === sId ||
            (data.email && member.email && data.email.toLowerCase() === member.email.toLowerCase());

          if (matchesStudent) {
            logs.push({ id: docSnap.id, ...data });
          }
        });

        logs.sort((a, b) => {
          const aTime = a.scannedAt?.seconds || a.createdAt?.seconds || 0;
          const bTime = b.scannedAt?.seconds || b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

        setAttendances(logs);
        setLoadingAttendance(false);
      },
      (err) => {
        console.error('[MemberProfilePanel] Error streaming attendance:', err);
        setLoadingAttendance(false);
      }
    );

    return () => unsubscribe();
  }, [member]);

  // Handle Reactivate Member Action
  const handleReactivate = async () => {
    setIsUpdatingStatus(true);
    try {
      await updateMemberStatus(member.id, 'active', profile?.studentId || 'Officer');
      setActionFeedback(`Successfully reactivated ${member.studentName}! Membership is now Active.`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to reactivate member: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Financial Computations for this Specific Organization
  const totalAssigned = useMemo(
    () => orgPayables.reduce((sum, p) => sum + (Number(p.assignedAmount) || 0), 0),
    [orgPayables]
  );
  const totalPaid = useMemo(
    () => orgPayables.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0),
    [orgPayables]
  );
  const totalOutstanding = totalAssigned - totalPaid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-[#E0E0E0] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#001A4D] via-[#0E4EBD] to-[#83358E] px-6 py-4 flex items-center justify-between text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-base shadow-inner backdrop-blur-sm">
              {getInitials(member.studentName)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold leading-tight">{member.studentName}</h2>
                {officerRecord && (
                  <span className="px-2 py-0.5 bg-[#FFD41C] text-[#001A4D] text-[10px] font-bold rounded-full uppercase flex items-center gap-1">
                    <Crown className="w-3 h-3" /> {officerRecord.roleId || 'Officer'}
                  </span>
                )}
                {member.status !== 'active' && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full uppercase">
                    {member.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/80 font-mono mt-0.5">
                ID: {member.studentId} · {member.course || 'Student'} {member.year ? `(${member.year})` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action feedback toast */}
        {actionFeedback && (
          <div className="p-3.5 bg-green-50 border-b border-green-200 flex items-center gap-2 text-xs font-semibold text-green-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Modal Tabs Bar */}
        <div className="px-6 border-b border-gray-200 bg-gray-50/70 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'ledger'
                  ? 'border-[#83358E] text-[#83358E]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Coins className="w-4 h-4" />
              Financial Ledger ({orgPayables.length})
            </button>

            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'border-[#0E4EBD] text-[#0E4EBD]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <User className="w-4 h-4" />
              Member Profile & Info
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'attendance'
                  ? 'border-[#0E4EBD] text-[#0E4EBD]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Attendance History ({attendances.length})
            </button>
          </div>

          {/* Quick Balance Pill */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="text-gray-500">Club Balance:</span>
            <span
              className={`font-bold font-mono px-2.5 py-0.5 rounded-full ${
                totalOutstanding > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-800'
              }`}
            >
              {formatCurrency(totalOutstanding)}
            </span>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* ─── TAB 1: FINANCIAL LEDGER & PAYABLES (SPECIFIC TO THIS ORG) ──── */}
          {activeTab === 'ledger' && (
            <div className="space-y-5">
              {/* Financial Metrics Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                  <span className="text-xs font-semibold text-gray-500 block uppercase tracking-wider">
                    Total Assigned Dues
                  </span>
                  <div className="text-2xl font-bold font-mono text-[#001A4D] mt-1">
                    {formatCurrency(totalAssigned)}
                  </div>
                  <span className="text-[11px] text-gray-400">Club dues, fines & event fees</span>
                </div>

                <div className="p-4 bg-green-50/60 border border-green-200 rounded-2xl">
                  <span className="text-xs font-semibold text-green-800 block uppercase tracking-wider">
                    Total Paid
                  </span>
                  <div className="text-2xl font-bold font-mono text-green-700 mt-1">
                    {formatCurrency(totalPaid)}
                  </div>
                  <span className="text-[11px] text-green-600">Recorded club payments</span>
                </div>

                <div
                  className={`p-4 rounded-2xl border ${
                    totalOutstanding > 0
                      ? 'bg-red-50/60 border-red-200'
                      : 'bg-emerald-50/60 border-emerald-200'
                  }`}
                >
                  <span
                    className={`text-xs font-semibold block uppercase tracking-wider ${
                      totalOutstanding > 0 ? 'text-red-800' : 'text-emerald-800'
                    }`}
                  >
                    Outstanding Balance
                  </span>
                  <div
                    className={`text-2xl font-bold font-mono mt-1 ${
                      totalOutstanding > 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatCurrency(totalOutstanding)}
                  </div>
                  <span className="text-[11px] text-gray-500">
                    {totalOutstanding > 0 ? 'Payment required' : 'Fully settled'}
                  </span>
                </div>
              </div>

              {/* Payables Ledger Table */}
              <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h4 className="font-bold text-[#001A4D] text-sm flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#83358E]" />
                    Statement of Account & Organization Dues
                  </h4>
                  <span className="text-xs text-gray-500 font-mono">
                    {orgPayables.length} record(s) found
                  </span>
                </div>

                {loadingPayables ? (
                  <div className="p-10 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#83358E]" />
                    Loading student ledger...
                  </div>
                ) : orgPayables.length === 0 ? (
                  <div className="p-10 text-center text-gray-400">
                    <Coins className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="font-bold text-gray-600">No payables recorded for this member in this organization.</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Membership dues, event fees, and fines assigned by this organization will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50/80 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200">
                        <tr>
                          <th className="px-5 py-3">Payable Item</th>
                          <th className="px-5 py-3">Type</th>
                          <th className="px-5 py-3 text-right">Assigned</th>
                          <th className="px-5 py-3 text-right">Paid</th>
                          <th className="px-5 py-3 text-right">Balance</th>
                          <th className="px-5 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {orgPayables.map((p) => {
                          const assigned = Number(p.assignedAmount) || 0;
                          const paid = Number(p.paidAmount) || 0;
                          const bal = assigned - paid;
                          const isSettled = p.status === 'paid' || p.status === 'waived' || bal <= 0;

                          return (
                            <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="font-bold text-[#001A4D]">{p.label}</div>
                                <div className="text-[11px] text-gray-400">
                                  {p.organizationName || 'Club Dues'}
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[11px] font-medium capitalize">
                                  {p.type?.replace('_', ' ') || 'Fee'}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-mono font-semibold text-gray-800 text-right">
                                {formatCurrency(assigned)}
                              </td>
                              <td className="px-5 py-3.5 font-mono text-green-700 font-semibold text-right">
                                {formatCurrency(paid)}
                              </td>
                              <td
                                className={`px-5 py-3.5 font-mono font-bold text-right ${
                                  bal > 0 ? 'text-red-600' : 'text-gray-400'
                                }`}
                              >
                                {formatCurrency(bal)}
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    isSettled
                                      ? 'bg-green-100 text-green-800'
                                      : p.status === 'partial'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {isSettled ? 'Paid' : p.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── TAB 2: MEMBER PROFILE OVERVIEW ─────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Academic & Personal Information */}
              <div className="bg-gray-50/70 border border-gray-200 rounded-2xl p-5 space-y-4">
                <h4 className="font-bold text-[#001A4D] text-sm flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#0E4EBD]" /> Academic & Identity Details
                </h4>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-gray-200">
                    <span className="text-gray-500">Student ID Number</span>
                    <span className="font-bold font-mono text-[#001A4D]">{member.studentId}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-200">
                    <span className="text-gray-500">Degree Program / Course</span>
                    <span className="font-semibold text-gray-800">{member.course || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-200">
                    <span className="text-gray-500">Year Level</span>
                    <span className="font-semibold text-gray-800">{member.year || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500">Department</span>
                    <span className="font-semibold text-gray-800">{member.department || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Organization & Contact Details */}
              <div className="bg-gray-50/70 border border-gray-200 rounded-2xl p-5 space-y-4">
                <h4 className="font-bold text-[#001A4D] text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#83358E]" /> Organization Membership Details
                </h4>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-gray-200">
                    <span className="text-gray-500">Date Joined</span>
                    <span className="font-semibold text-gray-800">{formattedDateJoined}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-200">
                    <span className="text-gray-500">Membership Status</span>
                    <span
                      className={`font-bold uppercase ${
                        member.status === 'active' ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      {member.status}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-200">
                    <span className="text-gray-500">Email Address</span>
                    <span className="font-mono text-gray-700">{member.email || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500">Contact Number</span>
                    <span className="font-mono text-gray-700">{member.contactNumber || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 3: ATTENDANCE HISTORY ──────────────────────────────────── */}
          {activeTab === 'attendance' && (
            <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-2xs">
              <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h4 className="font-bold text-[#001A4D] text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#0E4EBD]" /> Event Attendance Logs
                </h4>
                <span className="text-xs text-gray-500 font-mono">{attendances.length} event(s)</span>
              </div>

              {loadingAttendance ? (
                <div className="p-10 text-center text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0E4EBD]" />
                  Loading attendance scans...
                </div>
              ) : attendances.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="font-bold text-gray-600">No attendance scans on record.</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    When this student scans their QR pass at event gates, logs will show here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200">
                      <tr>
                        <th className="px-5 py-3">Event Name</th>
                        <th className="px-5 py-3">Check-In Time</th>
                        <th className="px-5 py-3">Gate Type</th>
                        <th className="px-5 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {attendances.map((att) => {
                        const scanTime = att.scannedAt
                          ? formatAppDateTime(att.scannedAt)
                          : att.checkIn || 'Logged';

                        return (
                          <tr key={att.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 font-semibold text-[#001A4D]">
                              {att.eventName || att.event || 'Campus Event'}
                            </td>
                            <td className="px-5 py-3 font-mono text-gray-600">{scanTime}</td>
                            <td className="px-5 py-3">
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px] font-medium uppercase">
                                {att.gateType || 'Time In'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className="px-2.5 py-0.5 bg-green-100 text-green-800 rounded-full font-bold text-[10px]">
                                {att.status || 'Present'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Reactivate Member Button when status is not active */}
            {member.status !== 'active' && (
              <button
                onClick={handleReactivate}
                disabled={isUpdatingStatus}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
              >
                {isUpdatingStatus ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-[#FFD41C]" />
                )}
                Reactivate Member
              </button>
            )}

            {onAppointOfficer && !officerRecord && member.status === 'active' && (
              <button
                onClick={onAppointOfficer}
                className="px-4 py-2 bg-[#FFC107] text-[#001A4D] hover:bg-[#FFC107]/90 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Crown className="w-3.5 h-3.5" /> Appoint as Officer
              </button>
            )}

            {onRemoveMember && member.status === 'active' && (
              <button
                onClick={onRemoveMember}
                className="px-4 py-2 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <UserMinus className="w-3.5 h-3.5" /> Remove Member
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition-colors ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
