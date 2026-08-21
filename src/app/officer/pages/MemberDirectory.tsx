import { useState, useMemo } from 'react';
import {
  Plus,
  Upload,
  Search,
  MoreVertical,
  Crown,
  Users,
  UserMinus,
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Mail,
  Phone,
  GraduationCap,
} from 'lucide-react';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useRoles } from '../../modules/roles/hooks/useRoles';
import { useOrgMembers } from '../../modules/organizations/hooks/useOrgMembers';
import { useOrgOfficers } from '../../modules/organizations/hooks/useOrgOfficers';
import { formatCurrency } from '../../utils/currency';
import {
  approveMemberApplication,
  rejectMemberApplication,
} from '../../modules/organizations/services/member.service';
import { MemberProfilePanel } from '../components/MemberProfilePanel';
import { AddMemberModal } from '../components/AddMemberModal';
import { AppointOfficerModal } from '../components/AppointOfficerModal';
import { RemoveMemberModal } from '../components/RemoveMemberModal';
import type { OrganizationMemberDocument } from '../../modules/organizations/types/member.types';
import { formatTimestampDate } from '../../modules/students/utils/date.utils';

export default function MemberDirectory() {
  const { profile } = useOfficerProfile();
  const activeOrgId = profile?.activeOrganizationId || '';

  const { data: roles = [] } = useRoles();
  const { members = [], loading: loadingMembers } = useOrgMembers(activeOrgId);
  const { officers = [], loading: loadingOfficers } = useOrgOfficers(activeOrgId);

  const [activeTab, setActiveTab] = useState<'members' | 'pending' | 'officers'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const [selectedMember, setSelectedMember] = useState<OrganizationMemberDocument | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAppointOfficerOpen, setIsAppointOfficerOpen] = useState(false);
  const [appointPreselected, setAppointPreselected] = useState<OrganizationMemberDocument | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMemberDocument | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Split members into Active Roster and Pending Applications
  const activeMembersList = useMemo(() => {
    return members.filter((m) => m.status !== 'pending' && m.status !== 'rejected');
  }, [members]);

  const pendingMembersList = useMemo(() => {
    return members.filter((m) => m.status === 'pending');
  }, [members]);

  // Check if current user has permission to appoint officers
  const activeRoleDoc = roles.find((r) => r.id === profile?.activeRoleId);
  const activeRoleName = activeRoleDoc?.name?.toLowerCase() || '';
  const canAppointOfficers = ['president', 'vice president', 'secretary'].includes(activeRoleName);

  // Filter Active Members
  const filteredActiveMembers = useMemo(() => {
    return activeMembersList.filter((member) => {
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch =
        (member.studentName || '').toLowerCase().includes(q) ||
        (member.studentId || '').toLowerCase().includes(q);
      const matchesDepartment = filterDepartment === 'All' || member.department === filterDepartment;
      const matchesYear = filterYear === 'All' || member.year === filterYear;
      const matchesStatus = filterStatus === 'All' || member.status === filterStatus;

      return matchesSearch && matchesDepartment && matchesYear && matchesStatus;
    });
  }, [activeMembersList, searchQuery, filterDepartment, filterYear, filterStatus]);

  // Filter Pending Applicants
  const filteredPendingMembers = useMemo(() => {
    return pendingMembersList.filter((member) => {
      const q = (searchQuery || '').toLowerCase();
      return (
        (member.studentName || '').toLowerCase().includes(q) ||
        (member.studentId || '').toLowerCase().includes(q) ||
        (member.course || '').toLowerCase().includes(q)
      );
    });
  }, [pendingMembersList, searchQuery]);

  // Filter Officers
  const filteredOfficers = useMemo(() => {
    return officers.filter((officer) => {
      const q = (searchQuery || '').toLowerCase();
      return (
        (officer.studentName || '').toLowerCase().includes(q) ||
        (officer.studentId || '').toLowerCase().includes(q)
      );
    });
  }, [officers, searchQuery]);

  const getInitials = (name: string) =>
    (name || 'Student')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  // Approve Application Handler (Triggers auto-payable if club fee is configured)
  const handleApprove = async (member: OrganizationMemberDocument) => {
    setProcessingId(member.id);
    try {
      const res = await approveMemberApplication(member.id, profile?.studentId || 'Officer');
      let msg = `Approved membership for ${member.studentName}!`;
      if (res.payableCreated && res.feeAmount) {
        msg += ` Automatically assigned ${formatCurrency(res.feeAmount)} membership payable.`;
      }
      setActionFeedback(msg);
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to approve member: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Reject Application Handler
  const handleReject = async (member: OrganizationMemberDocument) => {
    if (!confirm(`Are you sure you want to reject ${member.studentName}'s membership application?`)) {
      return;
    }
    setProcessingId(member.id);
    try {
      await rejectMemberApplication(member.id);
      setActionFeedback(`Rejected membership application for ${member.studentName}.`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to reject application: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[#888780] text-[13px] mb-1">Dashboard &gt; Member Directory</div>
          <h1 className="text-[#001A4D] text-[24px] font-bold">Member Directory</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 border border-[#E0E0E0] text-[#001A4D] rounded-lg text-[14px] font-medium hover:bg-[#F8F8F8] transition-colors">
            <Upload className="w-4 h-4" />
            Import Members (CSV)
          </button>
          <button
            onClick={() => setIsAddMemberOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0E4EBD] text-white rounded-lg text-[14px] font-medium hover:bg-[#0E4EBD]/90 shadow-sm transition-colors"
          >
            <Plus className="w-5 h-5 text-[#FFD41C]" />
            Add Member
          </button>
        </div>
      </div>

      {/* Action feedback toast */}
      {actionFeedback && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-sm text-green-800 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span className="font-semibold">{actionFeedback}</span>
        </div>
      )}

      {/* Navigation Tabs with Pending Application Badge */}
      <div className="flex items-center gap-6 border-b border-[#E0E0E0]">
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'members'
              ? 'border-[#0E4EBD] text-[#0E4EBD]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Active Members ({activeMembersList.length})
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 relative cursor-pointer ${
            activeTab === 'pending'
              ? 'border-[#0E4EBD] text-[#0E4EBD]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending Applications
          {pendingMembersList.length > 0 ? (
            <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs font-bold font-mono animate-pulse">
              {pendingMembersList.length}
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-mono">0</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('officers')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'officers'
              ? 'border-[#0E4EBD] text-[#0E4EBD]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Crown className="w-4 h-4" />
          Officers ({officers.length})
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888780]" />
            <input
              type="text"
              placeholder={
                activeTab === 'members'
                  ? 'Search active members by name or ID...'
                  : activeTab === 'pending'
                  ? 'Search pending applicants by name, course, or ID...'
                  : 'Search officers by name or ID...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-[#E0E0E0] rounded-lg text-[14px] focus:border-[#1E70E8] focus:ring-2 focus:ring-[#1E70E8]/20 outline-none"
            />
          </div>

          {activeTab === 'members' && (
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-2 border border-[#E0E0E0] rounded-lg text-[14px] text-[#001A4D] focus:border-[#1E70E8] outline-none"
              >
                <option value="All">All Programs</option>
                <option value="BSIT">BSIT</option>
                <option value="BSCS">BSCS</option>
                <option value="BSA">BSA</option>
                <option value="BSBA">BSBA</option>
                <option value="BSHM">BSHM</option>
              </select>

              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="px-3 py-2 border border-[#E0E0E0] rounded-lg text-[14px] text-[#001A4D] focus:border-[#1E70E8] outline-none"
              >
                <option value="All">All Years</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-[#E0E0E0] rounded-lg text-[14px] text-[#001A4D] focus:border-[#1E70E8] outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ─── TAB 1: ACTIVE MEMBERS ─────────────────────────────────────────── */}
      {activeTab === 'members' && (
        loadingMembers ? (
          <div className="flex justify-center p-12 text-gray-500">Loading members...</div>
        ) : filteredActiveMembers.length === 0 ? (
          <div className="text-center p-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 bg-white">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="font-bold text-gray-700">No active members found.</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {pendingMembersList.length > 0
                ? `There are ${pendingMembersList.length} pending application(s) awaiting your review under the Pending Applications tab.`
                : 'Members who join or are approved will appear here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredActiveMembers.map((member) => (
              <div
                key={member.id}
                className="bg-white border border-[#E0E0E0] rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden flex flex-col justify-between"
              >
                {member.isOfficer && (
                  <div className="absolute top-0 right-0 bg-[#FFC107] text-[#001A4D] px-3 py-1 rounded-bl-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs">
                    <Crown className="w-3 h-3" /> Officer
                  </div>
                )}

                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#0E4EBD] to-[#1E70E8] rounded-full flex items-center justify-center text-white font-bold text-lg shadow-inner">
                      {getInitials(member.studentName)}
                    </div>
                    <div className="relative group">
                      <button className="p-1.5 hover:bg-[#F8F8F8] rounded-lg">
                        <MoreVertical className="w-4 h-4 text-[#888780]" />
                      </button>
                      {/* Action Menu */}
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#E0E0E0] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 overflow-hidden">
                        <button
                          onClick={() => setSelectedMember(member)}
                          className="w-full text-left px-4 py-2 text-sm text-[#001A4D] hover:bg-gray-50 font-medium"
                        >
                          View Profile
                        </button>
                        {canAppointOfficers && !member.isOfficer && (
                          <button
                            onClick={() => {
                              setAppointPreselected(member);
                              setIsAppointOfficerOpen(true);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-[#0E4EBD] hover:bg-blue-50 font-medium"
                          >
                            Appoint as Officer
                          </button>
                        )}
                        <button
                          onClick={() => setMemberToRemove(member)}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium border-t border-gray-100 flex items-center gap-2"
                        >
                          <UserMinus className="w-4 h-4" /> Remove Member
                        </button>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-[#001A4D] text-[16px] font-bold mb-0.5 truncate" title={member.studentName}>
                    {member.studentName}
                  </h3>
                  <p className="text-[#888780] font-mono text-[12px] mb-2">{member.studentId}</p>

                  <p className="text-gray-700 text-[13px] mb-3">
                    {member.course || 'N/A'} {member.year ? `· ${member.year}` : ''}
                  </p>

                  <div className="flex items-center gap-2 mb-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        member.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : member.status === 'inactive'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {member.status}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        member.paymentStatus === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {member.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E0E0E0] flex items-center justify-between">
                  <button
                    onClick={() => setSelectedMember(member)}
                    className="text-[#0E4EBD] text-[13px] font-bold hover:underline"
                  >
                    View Details & Ledger →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ─── TAB 2: PENDING MEMBERSHIP APPLICATIONS ─────────────────────────── */}
      {activeTab === 'pending' && (
        loadingMembers ? (
          <div className="flex justify-center p-12 text-gray-500">Loading pending applications...</div>
        ) : filteredPendingMembers.length === 0 ? (
          <div className="text-center p-16 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500 bg-white shadow-xs">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-[#001A4D]">All Applications Reviewed!</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              There are currently no new student membership applications awaiting officer approval.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-[#0E4EBD] flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-[#0E4EBD] flex-shrink-0" />
                <span className="text-gray-700">
                  Approving an applicant grants official club membership and automatically creates a membership fee payable if configured for this organization.
                </span>
              </div>
              <span className="font-bold font-mono text-[#001A4D]">{filteredPendingMembers.length} Applicant(s)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPendingMembers.map((member) => {
                const isProcessing = processingId === member.id;
                return (
                  <div
                    key={member.id}
                    className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-full flex items-center justify-center text-white font-bold text-base shadow-xs flex-shrink-0">
                            {getInitials(member.studentName)}
                          </div>
                          <div>
                            <h3 className="font-bold text-[#001A4D] text-base leading-tight">
                              {member.studentName}
                            </h3>
                            <p className="text-xs font-mono text-gray-500 mt-0.5">
                              ID: {member.studentId || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pending Review
                        </span>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-3.5 space-y-2 text-xs text-gray-700 border border-gray-100 mb-4">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="w-3.5 h-3.5 text-gray-400" />
                          <span>
                            <strong>Course & Year:</strong> {member.course || 'N/A'} {member.year ? `· ${member.year}` : ''}
                          </span>
                        </div>
                        {member.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <span className="truncate">{member.email}</span>
                          </div>
                        )}
                        {member.contactNumber && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            <span>{member.contactNumber}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-gray-500 pt-1 border-t border-gray-200/60">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>Applied on: {formatTimestampDate(member.createdAt || member.applicationDate)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleReject(member)}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-2 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <UserX className="w-4 h-4" /> Reject
                      </button>
                      <button
                        onClick={() => handleApprove(member)}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-2 bg-[#001A4D] hover:bg-[#0E4EBD] text-[#FFD41C] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserCheck className="w-4 h-4" />
                        )}
                        Approve Membership
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* ─── TAB 3: OFFICERS ──────────────────────────────────────────────── */}
      {activeTab === 'officers' && (
        loadingOfficers ? (
          <div className="flex justify-center p-12 text-gray-500">Loading officers...</div>
        ) : (
          <div className="space-y-6">
            {canAppointOfficers && (
              <div className="flex justify-end">
                <button
                  onClick={() => setIsAppointOfficerOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FFC107] text-[#001A4D] rounded-lg text-sm font-bold shadow-sm hover:bg-[#FFC107]/90 transition-colors"
                >
                  <Crown className="w-4 h-4" /> Appoint Officer
                </button>
              </div>
            )}

            {filteredOfficers.length === 0 ? (
              <div className="text-center p-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 bg-white">
                No officers found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOfficers.map((officer) => {
                  const roleDoc = roles.find((r) => r.id === officer.roleId);
                  const roleName = roleDoc?.name || officer.roleId;

                  return (
                    <div
                      key={officer.id}
                      className="bg-white border border-[#E0E0E0] rounded-xl p-5 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-[#001A4D] rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {getInitials(officer.studentName)}
                        </div>
                        <span className="px-3 py-1 bg-[#0E4EBD] text-white text-[11px] font-bold rounded-full uppercase tracking-wider">
                          {roleName}
                        </span>
                      </div>

                      <h3 className="text-[#001A4D] text-[16px] font-bold mb-1">{officer.studentName}</h3>
                      <p className="text-[#888780] text-[13px] mb-3">{officer.studentId}</p>
                      <p className="text-[#001A4D] text-[13px]">{officer.email}</p>

                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#E0E0E0]">
                        <span className="text-xs text-gray-500 flex-1">
                          Access:{' '}
                          {officer.isActive ? (
                            <span className="text-green-600 font-medium">Active</span>
                          ) : (
                            <span className="text-red-500 font-medium">Revoked</span>
                          )}
                        </span>
                        {officer.isActive && canAppointOfficers && (
                          <button className="text-xs font-medium text-red-600 hover:underline">
                            Revoke Access
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}

      {/* Profile & Action Modals */}
      {selectedMember && (
        <MemberProfilePanel
          member={selectedMember}
          officerRecord={officers.find((o) => o.studentId === selectedMember.studentId && o.isActive)}
          onClose={() => setSelectedMember(null)}
          onAppointOfficer={
            canAppointOfficers && !selectedMember.isOfficer
              ? () => {
                  setSelectedMember(null);
                  setAppointPreselected(selectedMember);
                  setIsAppointOfficerOpen(true);
                }
              : undefined
          }
          onRemoveMember={() => {
            setMemberToRemove(selectedMember);
            setSelectedMember(null);
          }}
        />
      )}

      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        organizationId={activeOrgId}
        addedBy={profile?.studentId || 'system'}
      />

      <AppointOfficerModal
        isOpen={isAppointOfficerOpen}
        onClose={() => {
          setIsAppointOfficerOpen(false);
          setAppointPreselected(null);
        }}
        organizationId={activeOrgId}
        preselectedMember={appointPreselected}
        currentOfficers={officers}
      />

      <RemoveMemberModal
        member={memberToRemove}
        organizationId={activeOrgId}
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
      />
    </div>
  );
}
