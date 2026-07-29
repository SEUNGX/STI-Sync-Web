import { useState, useMemo } from 'react';
import { Plus, Upload, Search, MoreVertical, Crown, Users } from 'lucide-react';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useRoles } from '../../modules/roles/hooks/useRoles';
import { useOrgMembers } from '../../modules/organizations/hooks/useOrgMembers';
import { useOrgOfficers } from '../../modules/organizations/hooks/useOrgOfficers';
import { MemberProfilePanel } from '../components/MemberProfilePanel';
import { AddMemberModal } from '../components/AddMemberModal';
import { AppointOfficerModal } from '../components/AppointOfficerModal';
import type { OrganizationMemberDocument } from '../../modules/organizations/types/member.types';

export default function MemberDirectory() {
  const { profile } = useOfficerProfile();
  const activeOrgId = profile?.activeOrganizationId || '';
  
  const { data: roles } = useRoles();
  const { members, loading: loadingMembers } = useOrgMembers(activeOrgId);
  const { officers, loading: loadingOfficers } = useOrgOfficers(activeOrgId);

  const [activeTab, setActiveTab] = useState<'members' | 'officers'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  
  const [selectedMember, setSelectedMember] = useState<OrganizationMemberDocument | null>(null);
  
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAppointOfficerOpen, setIsAppointOfficerOpen] = useState(false);
  const [appointPreselected, setAppointPreselected] = useState<OrganizationMemberDocument | null>(null);

  // Check if current user has permission to appoint officers
  const activeRoleDoc = roles.find(r => r.id === profile?.activeRoleId);
  const activeRoleName = activeRoleDoc?.name?.toLowerCase() || '';
  const canAppointOfficers = ['president', 'vice president', 'secretary'].includes(activeRoleName);

  // Filter Members
  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.studentId.includes(searchQuery);
    const matchesDepartment = filterDepartment === 'All' || member.department === filterDepartment;
    const matchesYear = filterYear === 'All' || member.year === filterYear;
    const matchesStatus = filterStatus === 'All' || member.status === filterStatus;

    return matchesSearch && matchesDepartment && matchesYear && matchesStatus;
  });
  
  // Filter Officers
  const filteredOfficers = officers.filter((officer) => {
    return officer.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
           officer.studentId.includes(searchQuery);
  });

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[#888780] text-[13px] mb-1">Dashboard &gt; Member Directory</div>
          <h1 className="text-[#001A4D] text-[24px] font-bold">Member Directory</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 border border-[#E0E0E0] text-[#001A4D] rounded-lg text-[14px] font-medium hover:bg-[#F8F8F8]">
            <Upload className="w-4 h-4" />
            Import Members (CSV)
          </button>
          <button 
            onClick={() => setIsAddMemberOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0E4EBD] text-white rounded-lg text-[14px] font-medium hover:bg-[#0E4EBD]/90"
          >
            <Plus className="w-5 h-5 text-[#FFC107]" />
            Add Member
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-[#E0E0E0]">
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'members' ? 'border-[#0E4EBD] text-[#0E4EBD]' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Members ({members.length})
        </button>
        <button
          onClick={() => setActiveTab('officers')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'officers' ? 'border-[#0E4EBD] text-[#0E4EBD]' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Crown className="w-4 h-4" />
          Officers ({officers.length})
        </button>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888780]" />
            <input
              type="text"
              placeholder={activeTab === 'members' ? "Search by name or student ID..." : "Search officers by name or ID..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-[#E0E0E0] rounded-lg text-[14px] focus:border-[#1E70E8] focus:ring-2 focus:ring-[#1E70E8]/20 outline-none"
            />
          </div>

          {activeTab === 'members' && (
            <>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-4 py-2 border border-[#E0E0E0] rounded-lg text-[14px] text-[#001A4D] focus:border-[#1E70E8] focus:ring-2 focus:ring-[#1E70E8]/20 outline-none"
              >
                <option>All</option>
                <option>BSIT</option>
                <option>BSCS</option>
                <option>BSA</option>
                <option>BSBA</option>
                <option>BSHM</option>
              </select>

              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="px-4 py-2 border border-[#E0E0E0] rounded-lg text-[14px] text-[#001A4D] focus:border-[#1E70E8] focus:ring-2 focus:ring-[#1E70E8]/20 outline-none"
              >
                <option>All</option>
                <option>1st Year</option>
                <option>2nd Year</option>
                <option>3rd Year</option>
                <option>4th Year</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-[#E0E0E0] rounded-lg text-[14px] text-[#001A4D] focus:border-[#1E70E8] focus:ring-2 focus:ring-[#1E70E8]/20 outline-none"
              >
                <option>All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </>
          )}
        </div>
      </div>

      {activeTab === 'members' ? (
        loadingMembers ? (
          <div className="flex justify-center p-12 text-gray-500">Loading members...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center p-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-500">
            No members found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="bg-white border border-[#E0E0E0] rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden"
              >
                {member.isOfficer && (
                  <div className="absolute top-0 right-0 bg-[#FFC107] text-[#001A4D] px-3 py-1 rounded-bl-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <Crown className="w-3 h-3" /> Officer
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#0E4EBD] to-[#1E70E8] rounded-full flex items-center justify-center text-white font-bold text-xl shadow-inner">
                    {getInitials(member.studentName)}
                  </div>
                  <div className="relative group">
                    <button className="p-1.5 hover:bg-[#F8F8F8] rounded-lg">
                      <MoreVertical className="w-4 h-4 text-[#888780]" />
                    </button>
                    {/* Action Menu (CSS-based hover for simplicity) */}
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#E0E0E0] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <button onClick={() => setSelectedMember(member)} className="w-full text-left px-4 py-2 text-sm text-[#001A4D] hover:bg-gray-50 rounded-t-lg">View Profile</button>
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
                    </div>
                  </div>
                </div>

                <h3 className="text-[#001A4D] text-[16px] font-bold mb-1 truncate" title={member.studentName}>{member.studentName}</h3>
                <p className="text-[#888780] text-[13px] mb-3">{member.studentId}</p>

                <p className="text-[#001A4D] text-[14px] mb-3">
                  {member.course || 'N/A'} {member.year ? `· ${member.year}` : ''}
                </p>

                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider ${
                    member.status === 'active' ? 'bg-[#22C55E]/10 text-[#16A34A]' : 
                    member.status === 'inactive' ? 'bg-gray-100 text-gray-600' : 
                    'bg-red-50 text-red-600'
                  }`}>
                    {member.status}
                  </span>
                  <span className={`px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider ${
                    member.paymentStatus === 'paid' ? 'bg-[#22C55E]/10 text-[#16A34A]' : 'bg-[#E24B4A]/10 text-[#DC2626]'
                  }`}>
                    {member.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-[#E0E0E0]">
                  <button
                    onClick={() => setSelectedMember(member)}
                    className="flex-1 text-[#0E4EBD] text-[13px] font-medium hover:underline text-center"
                  >
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Officers Tab */
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
              <div className="text-center p-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-500">
                No officers found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOfficers.map((officer) => {
                  const roleDoc = roles.find(r => r.id === officer.roleId);
                  const roleName = roleDoc?.name || officer.roleId;
                  
                  return (
                    <div key={officer.id} className="bg-white border border-[#E0E0E0] rounded-xl p-5 hover:shadow-lg transition-shadow">
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
                          Access: {officer.isActive ? <span className="text-green-600 font-medium">Active</span> : <span className="text-red-500 font-medium">Revoked</span>}
                        </span>
                        {officer.isActive && canAppointOfficers && (
                          <button className="text-xs font-medium text-red-600 hover:underline">Revoke Access</button>
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

      {selectedMember && (
        <MemberProfilePanel 
          member={selectedMember} 
          officerRecord={officers.find(o => o.studentId === selectedMember.studentId && o.isActive)}
          onClose={() => setSelectedMember(null)}
          onAppointOfficer={canAppointOfficers && !selectedMember.isOfficer ? () => {
            setSelectedMember(null);
            setAppointPreselected(selectedMember);
            setIsAppointOfficerOpen(true);
          } : undefined}
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
    </div>
  );
}
