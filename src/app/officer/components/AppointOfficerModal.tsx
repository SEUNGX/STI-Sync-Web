import { useState, useEffect, useMemo } from 'react';
import { X, Search, Crown, Lock, Loader2, Eye, EyeOff, AlertCircle, UserCheck, GraduationCap } from 'lucide-react';
import { useRoles } from '../../modules/roles/hooks/useRoles';
import { useOrgMembers } from '../../modules/organizations/hooks/useOrgMembers';
import { useStudents } from '../../modules/students/hooks/useStudentStream';
import { appointAsOfficer } from '../../modules/organizations/services/member.service';
import { sendOfficerAppointmentEmail } from '../../../services/email.service';
import type { OrganizationMemberDocument } from '../../modules/organizations/types/member.types';
import type { OrganizationOfficerDocument } from '../../modules/organizations/hooks/useOrgOfficers';

interface AppointOfficerModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  preselectedMember?: OrganizationMemberDocument | null;
  currentOfficers: OrganizationOfficerDocument[];
}

interface AppointCandidate {
  memberDocId?: string;
  studentId: string;
  studentName: string;
  email: string;
  course?: string;
  year?: string;
  department?: string;
  contactNumber?: string;
  isExistingMember: boolean;
}

export function AppointOfficerModal({
  isOpen,
  onClose,
  organizationId,
  preselectedMember,
  currentOfficers,
}: AppointOfficerModalProps) {
  const { data: roles, loading: loadingRoles } = useRoles();
  const { members, loading: loadingMembers } = useOrgMembers(organizationId);
  const { data: allStudents = [], loading: loadingStudents } = useStudents();

  const [selectedCandidate, setSelectedCandidate] = useState<AppointCandidate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const [roleId, setRoleId] = useState('');
  const [tempPassword, setTempPassword] = useState('TempPass123!');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or reset candidate when modal opens
  useEffect(() => {
    if (isOpen) {
      if (preselectedMember) {
        setSelectedCandidate({
          memberDocId: preselectedMember.id,
          studentId: preselectedMember.studentId,
          studentName: preselectedMember.studentName,
          email: preselectedMember.email,
          course: preselectedMember.course,
          year: preselectedMember.year,
          department: preselectedMember.department,
          contactNumber: preselectedMember.contactNumber,
          isExistingMember: true,
        });
      } else {
        setSelectedCandidate(null);
      }
      setSearchQuery('');
      setRoleId('');
      setTempPassword('TempPass123!');
      setError(null);
    }
  }, [isOpen, preselectedMember]);

  if (!isOpen) return null;

  const activeRoles = roles.filter((r) => !r.archived);

  // Set of student IDs that are already active officers in this organization
  const activeOfficerStudentIds = new Set(
    currentOfficers
      .filter((o) => o.isActive)
      .map((o) => (o.studentId || '').trim().toLowerCase())
      .filter(Boolean)
  );

  // Map of club members by studentId for fast lookup
  const membersByStudentId = new Map<string, OrganizationMemberDocument>();
  members.forEach((m) => {
    if (m.studentId) membersByStudentId.set(m.studentId.trim().toLowerCase(), m);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate) {
      setError('Please select a student candidate first.');
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

    const selectedRole = activeRoles.find((r) => r.id === roleId);
    const roleName = selectedRole?.name || '';

    // Check if role is already filled
    const isRoleFilled = currentOfficers.some((o) => o.roleId === roleId && o.isActive);
    if (isRoleFilled) {
      const confirm = window.confirm(
        `The role "${roleName}" is currently filled by another officer. Are you sure you want to appoint another?`
      );
      if (!confirm) return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await appointAsOfficer(
        organizationId,
        selectedCandidate.memberDocId || '',
        roleId,
        selectedCandidate.studentId,
        selectedCandidate.studentName,
        selectedCandidate.email,
        tempPassword,
        roleName,
        {
          course: selectedCandidate.course,
          year: selectedCandidate.year,
          department: selectedCandidate.department,
          contactNumber: selectedCandidate.contactNumber,
        }
      );

      // Send appointment notification email asynchronously
      if (selectedCandidate.email) {
        sendOfficerAppointmentEmail({
          to: selectedCandidate.email,
          officerName: selectedCandidate.studentName,
          orgName: 'Student Organization',
          roleName: roleName || 'Executive Officer',
          studentId: selectedCandidate.studentId,
        }).catch((err) => {
          console.warn('[AppointOfficerModal] Email notice failed:', err);
        });
      }

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
      <div className="bg-white rounded-2xl w-full max-w-[520px] shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-[#001A4D] px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-[#FFC107]" />
            <h2 className="text-white font-semibold text-lg">Appoint Officer</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
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

          {!selectedCandidate ? (
            <div className="mb-6 relative">
              <label className="block text-sm font-semibold text-[#001A4D] mb-1.5">
                Select Candidate <span className="text-gray-400 font-normal">(Club Members or Enrolled Students)</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by student name or ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full pl-9 pr-4 py-2 border border-[#E0E0E0] rounded-xl text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent outline-none"
                />
              </div>

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E0E0E0] rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
                  {loadingMembers || loadingStudents ? (
                    <div className="p-3 text-sm text-gray-500 text-center flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#0E4EBD]" /> Loading directory...
                    </div>
                  ) : (
                    (() => {
                      const q = searchQuery.toLowerCase().trim();

                      // 1. Existing Club Members matching query
                      const matchingClubMembers: AppointCandidate[] = members
                        .filter((m) => {
                          const fullName = (m.studentName || '').toLowerCase();
                          const sId = (m.studentId || '').toLowerCase();
                          return !q || fullName.includes(q) || sId.includes(q);
                        })
                        .map((m) => ({
                          memberDocId: m.id,
                          studentId: m.studentId,
                          studentName: m.studentName,
                          email: m.email,
                          course: m.course,
                          year: m.year,
                          department: m.department,
                          contactNumber: m.contactNumber,
                          isExistingMember: true,
                        }));

                      // 2. Enrolled Students matching query (excluding those already in matchingClubMembers)
                      const matchingStudents: AppointCandidate[] = allStudents
                        .filter((s) => {
                          const sIdNorm = (s.studentId || s.id || '').trim().toLowerCase();
                          if (membersByStudentId.has(sIdNorm)) return false; // already counted in club members
                          const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
                          return !q || fullName.includes(q) || sIdNorm.includes(q);
                        })
                        .map((s) => ({
                          memberDocId: undefined,
                          studentId: s.studentId || s.id,
                          studentName: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
                          email: s.email || '',
                          course: s.courseCode || s.courseName || '',
                          year: s.yearLevel || '',
                          department: s.departmentId || s.department || '',
                          contactNumber: s.contactNumber || '',
                          isExistingMember: false,
                        }));

                      const combined = [...matchingClubMembers, ...matchingStudents].slice(0, 30);

                      if (combined.length === 0) {
                        return (
                          <div className="p-4 text-sm text-gray-500 text-center">
                            No matching students found for "{searchQuery}".
                          </div>
                        );
                      }

                      return combined.map((candidate) => {
                        const isAlreadyOfficer = activeOfficerStudentIds.has(
                          (candidate.studentId || '').trim().toLowerCase()
                        );

                        return (
                          <div
                            key={candidate.studentId}
                            onClick={() => {
                              if (isAlreadyOfficer) return;
                              setSelectedCandidate(candidate);
                              setShowDropdown(false);
                              setSearchQuery('');
                            }}
                            className={`px-4 py-2.5 border-b border-gray-100 last:border-0 flex items-center justify-between transition-colors ${
                              isAlreadyOfficer
                                ? 'bg-gray-50/70 opacity-60 cursor-not-allowed'
                                : 'hover:bg-blue-50/60 cursor-pointer'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-[#001A4D] text-sm">
                                  {candidate.studentName}
                                </span>
                                {candidate.isExistingMember ? (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                                    Member
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold">
                                    Student
                                  </span>
                                )}
                                {isAlreadyOfficer && (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
                                    Active Officer
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 font-mono mt-0.5">
                                {candidate.studentId} · {candidate.course || 'Enrolled'} {candidate.year ? `(${candidate.year})` : ''}
                              </div>
                            </div>
                            <span className="text-xs text-blue-600 font-medium hover:underline">
                              {isAlreadyOfficer ? 'Holding Role' : 'Select'}
                            </span>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-6 p-4 border border-[#E0E0E0] rounded-xl flex items-center justify-between bg-blue-50/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#001A4D] rounded-full flex items-center justify-center text-[#FFD41C] font-bold text-sm shadow-xs">
                  {selectedCandidate.studentName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#001A4D] text-sm">
                      {selectedCandidate.studentName}
                    </span>
                    {selectedCandidate.isExistingMember ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                        Club Member
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold">
                        Enrolled Student
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    ID: {selectedCandidate.studentId} {selectedCandidate.course ? `· ${selectedCandidate.course} (${selectedCandidate.year})` : ''}
                  </div>
                </div>
              </div>
              {!preselectedMember && (
                <button
                  type="button"
                  onClick={() => setSelectedCandidate(null)}
                  className="text-xs text-[#0E4EBD] hover:underline font-bold cursor-pointer"
                >
                  Change
                </button>
              )}
            </div>
          )}

          <form id="appoint-officer-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#001A4D] mb-1.5">
                Executive Position / Role <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#E0E0E0] rounded-xl text-sm focus:ring-2 focus:ring-[#0E4EBD] bg-white outline-none"
                disabled={loadingRoles}
              >
                <option value="">Select a role...</option>
                {activeRoles.map((role) => {
                  const isFilled = currentOfficers.some(
                    (o) => o.roleId === role.id && o.isActive
                  );
                  return (
                    <option key={role.id} value={role.id}>
                      {role.name} {isFilled ? '(Currently Assigned)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-[#001A4D] font-bold text-sm mb-3">Portal Login Credentials</h4>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Student Official Email
                  </label>
                  <input
                    type="email"
                    readOnly
                    value={selectedCandidate?.email || ''}
                    className="w-full px-3 py-2 border border-[#E0E0E0] bg-gray-50 rounded-xl text-sm text-gray-700"
                    placeholder="Candidate email address"
                  />
                  {!selectedCandidate?.email && selectedCandidate && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Notice: Student has no email address on record. An email is required for login.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Temporary Initial Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 border border-[#E0E0E0] rounded-xl text-sm focus:ring-2 focus:ring-[#0E4EBD] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    The student officer will use this password to sign into the Officer Portal for the first time.
                  </p>
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
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="appoint-officer-form"
            disabled={isSubmitting || !selectedCandidate || !selectedCandidate.email}
            className="px-5 py-2 text-sm font-bold text-[#001A4D] bg-[#FFC107] hover:bg-[#FFC107]/90 rounded-xl transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Appointing...' : 'Appoint Officer'}
          </button>
        </div>
      </div>
    </div>
  );
}
