import { useState } from 'react';
import { X, Users, Crown, Calendar, Building2, Shield, Mail, FileText, CheckCircle2 } from 'lucide-react';
import type { OrganizationDocument } from '../../modules/organizations/types/organization.types';
import { useOrgOfficers } from '../../modules/organizations/hooks/useOrgOfficers';
import { useOrgMembers } from '../../modules/organizations/hooks/useOrgMembers';
import { useOrganizationTypes } from '../../modules/organizations/hooks/useOrganizationTypes';
import { useRoles } from '../../modules/roles/hooks/useRoles';

interface OrganizationDetailModalProps {
  organization: OrganizationDocument | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OrganizationDetailModal({ organization, isOpen, onClose }: OrganizationDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'officers' | 'members'>('overview');

  const orgId = organization?.id || '';
  const { officers, loading: loadingOfficers } = useOrgOfficers(orgId);
  const { members, loading: loadingMembers } = useOrgMembers(orgId);
  const { data: orgTypes } = useOrganizationTypes();
  const { data: roles } = useRoles();

  if (!isOpen || !organization) return null;

  const orgType = orgTypes.find(t => t.id === organization.typeId);

  const getRoleName = (roleId: string) => {
    const r = roles.find(role => role.id === roleId);
    return r ? r.name : roleId || 'Officer';
  };

  const activeMembers = members.filter(m => m.status === 'active');

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10">
        
        {/* Banner / Header */}
        <div className="h-28 bg-gradient-to-r from-[#001A4D] via-[#002B7F] to-[#0E4EBD] relative p-6 flex items-end justify-between flex-shrink-0"
          style={orgType?.color ? { background: `linear-gradient(135deg, ${orgType.color}, #001A4D)` } : {}}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 p-2 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Logo overlapping banner */}
          <div className="absolute -bottom-8 left-6 flex items-center gap-4">
            <div className="w-20 h-20 bg-[#001A4D] rounded-2xl flex items-center justify-center text-white font-bold text-xl border-4 border-white shadow-xl overflow-hidden">
              {organization.logoUrl ? (
                <img src={organization.logoUrl} alt={organization.acronym} className="w-full h-full object-cover" />
              ) : (
                organization.acronym || 'ORG'
              )}
            </div>
          </div>
        </div>

        {/* Title Bar */}
        <div className="pt-10 px-6 pb-4 border-b border-gray-100 flex-shrink-0 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#001A4D]">{organization.name}</h2>
              <span className="text-xs font-mono px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                ({organization.acronym})
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Department: <span className="font-semibold text-gray-700">{organization.department || 'General'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-[#FFD54F] text-[#001A4D] font-bold text-xs rounded-full">
              {orgType?.name || 'Student Org'}
            </span>
            <span className={`px-3 py-1 text-xs font-bold rounded-full capitalize ${
              organization.status === 'active' ? 'bg-green-100 text-green-700 border border-green-300' :
              organization.status === 'suspended' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
              'bg-gray-100 text-gray-600 border border-gray-300'
            }`}>
              {organization.status}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-200 flex gap-4 text-sm font-medium flex-shrink-0 bg-gray-50/50">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-1 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-[#001A4D] text-[#001A4D] font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('officers')}
            className={`py-3 px-1 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'officers'
                ? 'border-[#001A4D] text-[#001A4D] font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Crown className="w-4 h-4 text-amber-500" />
            Officers ({officers.length})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`py-3 px-1 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'members'
                ? 'border-[#001A4D] text-[#001A4D] font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 text-blue-500" />
            Active Members ({activeMembers.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Description</h4>
                <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-200 leading-relaxed">
                  {organization.description || 'No description provided.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl">
                  <div className="text-xs text-blue-600 font-semibold mb-1">Active Members</div>
                  <div className="text-2xl font-bold text-[#001A4D]">{activeMembers.length}</div>
                </div>

                <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-xl">
                  <div className="text-xs text-amber-700 font-semibold mb-1">Appointed Officers</div>
                  <div className="text-2xl font-bold text-[#001A4D]">{officers.length}</div>
                </div>

                <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl">
                  <div className="text-xs text-[#0E4EBD] font-semibold mb-1">Organization Type</div>
                  <div className="text-base font-bold text-[#001A4D] truncate">{orgType?.name || 'General'}</div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4 text-xs text-gray-500">
                <div>
                  <span className="font-semibold text-gray-700 block mb-0.5">Academic Department</span>
                  <span>{organization.department || 'College-wide'}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700 block mb-0.5">Created By</span>
                  <span>{organization.createdBy || 'System Administrator'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'officers' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Appointed Organization Officers</h4>
              {loadingOfficers ? (
                <div className="text-center py-8 text-xs text-gray-400">Loading officers...</div>
              ) : officers.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 border border-dashed rounded-xl text-gray-400 text-xs">
                  No officers appointed yet for this organization.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {officers.map((off) => (
                    <div key={off.id} className="p-3.5 bg-white border border-gray-200 rounded-xl flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#001A4D] text-amber-300 font-bold rounded-lg flex items-center justify-center text-xs">
                          <Crown className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#001A4D]">{off.studentName}</p>
                          <p className="text-xs text-gray-500 font-mono">{off.studentId} • {off.email}</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold text-[11px] rounded-full border border-amber-200">
                        {getRoleName(off.roleId)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Active Member Roster</h4>
              {loadingMembers ? (
                <div className="text-center py-8 text-xs text-gray-400">Loading members...</div>
              ) : activeMembers.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 border border-dashed rounded-xl text-gray-400 text-xs">
                  No active members registered in this organization.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#001A4D] text-white">
                      <tr>
                        <th className="p-3 font-bold uppercase">Student ID</th>
                        <th className="p-3 font-bold uppercase">Name</th>
                        <th className="p-3 font-bold uppercase">Course</th>
                        <th className="p-3 font-bold uppercase">Year</th>
                        <th className="p-3 font-bold uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeMembers.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="p-3 font-mono font-medium text-gray-600">{m.studentId}</td>
                          <td className="p-3 font-bold text-[#001A4D]">{m.studentName}</td>
                          <td className="p-3 text-[#0E4EBD] font-semibold">{m.course || '—'}</td>
                          <td className="p-3 text-gray-600">{m.year || '—'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold text-[10px]">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#001A4D] text-white rounded-xl text-xs font-bold hover:bg-[#0E4EBD] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
