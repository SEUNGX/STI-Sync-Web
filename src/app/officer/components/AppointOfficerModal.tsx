import { useState, useEffect } from 'react';
import { X, Search, Crown, Lock, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useRoles } from '../../modules/roles/hooks/useRoles';
import { useOrgMembers } from '../../modules/organizations/hooks/useOrgMembers';
import { appointAsOfficer } from '../../modules/organizations/services/member.service';
import type { OrganizationMemberDocument } from '../../modules/organizations/types/member.types';
import type { OrganizationOfficerDocument } from '../../modules/organizations/hooks/useOrgOfficers';

interface AppointOfficerModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  preselectedMember?: OrganizationMemberDocument | null;
  currentOfficers: OrganizationOfficerDocument[];
}

export function AppointOfficerModal({ isOpen, onClose, organizationId, preselectedMember, currentOfficers }: AppointOfficerModalProps) {
  const { data: roles, loading: loadingRoles } = useRoles();
  const { members, loading: loadingMembers } = useOrgMembers(organizationId);
  
  const [selectedMember, setSelectedMember] = useState<OrganizationMemberDocument | null>(preselectedMember || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [roleId, setRoleId] = useState('');
  const [tempPassword, setTempPassword] = useState('TempPass123!');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When opened with a preselected member, reset state
  useEffect(() => {
    if (isOpen) {
      setSelectedMember(preselectedMember || null);
      setSearchQuery('');
      setRoleId('');
      setTempPassword('TempPass123!');
      setError(null);
    }
  }, [isOpen, preselectedMember]);

  if (!isOpen) return null;

  const activeRoles = roles.filter(r => !r.archived);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) {
      setError('Please select a member first.');
      return;
    }
    if (!roleId) {
      setError('Please select a role.');
      return;
    }
    if (!tempPassword) {
      setError('Please provide a temporary password.');
      return;
    }

    // Check if role is already filled
    const isRoleFilled = currentOfficers.some(o => o.roleId === roleId && o.isActive);
    if (isRoleFilled) {
      const confirm = window.confirm(`This role is already filled by another officer. Are you sure you want to appoint another?`);
      if (!confirm) return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await appointAsOfficer(
        organizationId,
        selectedMember.id,
        roleId,
        selectedMember.studentId,
        selectedMember.studentName,
        selectedMember.email,
        tempPassword
      );
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to appoint officer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[500px] shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-[#001A4D] px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-[#FFC107]" />
            <h2 className="text-white font-semibold text-lg">Appoint Officer</h2>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {!selectedMember ? (
            <div className="mb-6 relative">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Member from Organization</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full pl-9 pr-4 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8] focus:border-transparent outline-none"
                />
              </div>

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E0E0E0] rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                  {loadingMembers ? (
                    <div className="p-3 text-sm text-gray-500 text-center">Loading members...</div>
                  ) : (
                    (() => {
                      const query = searchQuery.toLowerCase();
                      const matches = members.filter(m => 
                        !m.isOfficer && // Only show non-officers
                        (`${m.studentName}`.toLowerCase().includes(query) ||
                        m.studentId.toLowerCase().includes(query))
                      );

                      if (matches.length === 0) {
                        return <div className="p-3 text-sm text-gray-500 text-center">No available members found</div>;
                      }

                      return matches.map(m => (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedMember(m);
                            setShowDropdown(false);
                            setSearchQuery('');
                          }}
                          className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                        >
                          <div className="font-medium text-[#001A4D] text-sm">{m.studentName}</div>
                          <div className="text-xs text-gray-500">{m.studentId} • {m.course} {m.year}</div>
                        </div>
                      ));
                    })()
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-6 p-4 border border-[#E0E0E0] rounded-xl flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#0E4EBD] rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {selectedMember.studentName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-[#001A4D] text-sm">{selectedMember.studentName}</div>
                  <div className="text-xs text-gray-500">{selectedMember.studentId}</div>
                </div>
              </div>
              {!preselectedMember && (
                <button 
                  onClick={() => setSelectedMember(null)}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Change
                </button>
              )}
            </div>
          )}

          <form id="appoint-officer-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Role *</label>
              <select
                required
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
                disabled={loadingRoles}
              >
                <option value="">Select a role...</option>
                {activeRoles.map(role => {
                  const isFilled = currentOfficers.some(o => o.roleId === role.id && o.isActive);
                  return (
                    <option key={role.id} value={role.id}>
                      {role.name} {isFilled ? '(Already Filled)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-[#001A4D] font-bold text-sm mb-3">Login Credentials</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    readOnly
                    value={selectedMember?.email || ''}
                    className="w-full px-3 py-2 border border-[#E0E0E0] bg-gray-50 rounded-lg text-sm text-gray-500"
                    placeholder="Member has no email"
                  />
                  {!selectedMember?.email && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Member needs an email to log in. Please edit their profile first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Temporary Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">The officer will use this to log in for the first time.</p>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="border-t border-[#E0E0E0] px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="appoint-officer-form"
            disabled={isSubmitting || !selectedMember?.email}
            className="px-4 py-2 text-sm font-bold text-white bg-[#FFC107] text-[#001A4D] rounded-lg hover:bg-[#FFC107]/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Appointing...' : 'Appoint Officer'}
          </button>
        </div>
      </div>
    </div>
  );
}
