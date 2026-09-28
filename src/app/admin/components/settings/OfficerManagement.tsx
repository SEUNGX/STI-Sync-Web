import { useState, useMemo } from 'react';
import {
  Users, Search, Eye, Edit2, KeyRound, UserX, X,
  AlertTriangle, Check, Copy, Shield, Building, Loader2
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { toast } from 'sonner';
import { auth, db } from '../../../../services/firebase';
import { sendOfficerPasswordResetCredentialsEmail } from '../../../../services/email.service';
import {
  useAllActiveOfficers,
  type OrganizationOfficerDocument
} from '../../../modules/organizations/hooks/useOrgOfficers';
import { useOrganizationStream } from '../../../modules/organizations/hooks/useOrganizationStream';
import { useRoles, type OfficerRoleDocument } from '../../../modules/roles';

interface OfficerManagementProps {
  onUnsavedChange: () => void;
}

export default function OfficerManagement({ onUnsavedChange }: OfficerManagementProps) {
  const { officers, loading: loadingOfficers } = useAllActiveOfficers();
  const { data: organizations, loading: loadingOrgs } = useOrganizationStream();
  const { data: roles, loading: loadingRoles } = useRoles();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState('All');

  // Modals State
  const [viewOfficer, setViewOfficer] = useState<OrganizationOfficerDocument | null>(null);
  const [editOfficer, setEditOfficer] = useState<OrganizationOfficerDocument | null>(null);
  const [editRoleId, setEditRoleId] = useState('');
  const [resetOfficer, setResetOfficer] = useState<OrganizationOfficerDocument | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [revokeOfficer, setRevokeOfficer] = useState<OrganizationOfficerDocument | null>(null);
  const [revokeConfirmation, setRevokeConfirmation] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);

  // Maps for fast lookups
  const orgMap = useMemo(() => {
    const map = new Map<string, { name: string; acronym: string; logoUrl?: string | null }>();
    organizations.forEach((org) => {
      map.set(org.id, { name: org.name, acronym: org.acronym, logoUrl: org.logoUrl });
    });
    return map;
  }, [organizations]);

  const roleMap = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach((r) => {
      map.set(r.id, r.name);
    });
    return map;
  }, [roles]);

  const activeRoles = useMemo(() => roles.filter((r) => !r.archived), [roles]);

  // Filtered Officers Roster
  const filteredOfficers = useMemo(() => {
    return officers.filter((officer) => {
      // Organization filter
      if (selectedOrgFilter !== 'All' && officer.organizationId !== selectedOrgFilter) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const orgInfo = orgMap.get(officer.organizationId);
        const roleName = (roleMap.get(officer.roleId) || (officer as any).roleName || '').toLowerCase();
        const matchName = officer.studentName?.toLowerCase().includes(q);
        const matchEmail = officer.email?.toLowerCase().includes(q);
        const matchStudentId = officer.studentId?.toLowerCase().includes(q);
        const matchOrg = orgInfo?.acronym.toLowerCase().includes(q) || orgInfo?.name.toLowerCase().includes(q);
        const matchRole = roleName.includes(q);

        if (!matchName && !matchEmail && !matchStudentId && !matchOrg && !matchRole) {
          return false;
        }
      }

      return true;
    });
  }, [officers, selectedOrgFilter, searchQuery, orgMap, roleMap]);

  // ─── Action Handlers ───────────────────────────────────────────────────────

  // 1. Edit Role
  const handleOpenEdit = (officer: OrganizationOfficerDocument) => {
    setEditOfficer(officer);
    setEditRoleId(officer.roleId || '');
  };

  const handleSaveRole = async () => {
    if (!editOfficer || !editRoleId) return;
    setIsProcessing(true);
    try {
      const newRole = activeRoles.find((r) => r.id === editRoleId);
      await updateDoc(doc(db, 'organization_officers', editOfficer.id), {
        roleId: editRoleId,
        roleName: newRole?.name || '',
        updatedAt: serverTimestamp(),
      });
      toast.success(`Position updated for ${editOfficer.studentName}.`);
      onUnsavedChange();
      setEditOfficer(null);
    } catch (err: any) {
      console.error('Failed to update officer role:', err);
      toast.error(err?.message || 'Failed to update position.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Reset Officer Password & Email New Credentials
  const handleOpenReset = (officer: OrganizationOfficerDocument) => {
    setResetOfficer(officer);
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    const tempPass = `STISync-${code}!`;
    setGeneratedPassword(tempPass);
    setCopiedPassword(false);
  };

  const handleConfirmReset = async () => {
    if (!resetOfficer || !generatedPassword) return;
    const targetEmail = (resetOfficer.email || '').trim().toLowerCase();
    if (!targetEmail) {
      toast.error('This officer does not have an email address associated with their account.');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Update organization_officers document in Firestore
      await updateDoc(doc(db, 'organization_officers', resetOfficer.id), {
        temporaryPassword: generatedPassword,
        requiresPasswordChange: true,
        updatedAt: serverTimestamp(),
      });

      // 2. Also update matching student record in students collection
      if (resetOfficer.studentId) {
        try {
          const qStudent = query(
            collection(db, 'students'),
            where('studentId', '==', resetOfficer.studentId)
          );
          const studentSnap = await getDocs(qStudent);
          for (const sDoc of studentSnap.docs) {
            await updateDoc(doc(db, 'students', sDoc.id), {
              temporaryPassword: generatedPassword,
              requiresPasswordChange: true,
              requiresChangePassword: true,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (studentErr) {
          console.warn('Could not sync to students collection:', studentErr);
        }
      }

      // 3. Dispatch email containing the new password directly to the officer!
      const orgInfo = orgMap.get(resetOfficer.organizationId);
      const roleTitle = roleMap.get(resetOfficer.roleId) || (resetOfficer as any).roleName || 'Officer';

      await sendOfficerPasswordResetCredentialsEmail({
        to: targetEmail,
        officerName: resetOfficer.studentName,
        temporaryPassword: generatedPassword,
        studentId: resetOfficer.studentId,
        orgName: orgInfo ? `${orgInfo.name} (${orgInfo.acronym})` : undefined,
        roleName: roleTitle,
      });

      // 4. Also trigger Firebase Auth password reset email as secondary
      try {
        await sendPasswordResetEmail(auth, targetEmail);
      } catch {
        // Safe to ignore
      }

      toast.success(`Password reset successful! New password emailed to ${targetEmail}.`);
      onUnsavedChange();
      setResetOfficer(null);
    } catch (err: any) {
      console.error('Failed to reset and email credentials:', err);
      toast.error(err?.message || 'Failed to email new password.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyPassword = () => {
    if (!generatedPassword) return;
    navigator.clipboard.writeText(generatedPassword);
    setCopiedPassword(true);
    toast.success('Password copied to clipboard.');
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  // 3. Revoke Officer
  const handleOpenRevoke = (officer: OrganizationOfficerDocument) => {
    setRevokeOfficer(officer);
    setRevokeConfirmation('');
  };

  const handleConfirmRevoke = async () => {
    if (!revokeOfficer) return;
    setIsProcessing(true);
    try {
      // Delete officer assignment or mark inactive
      await deleteDoc(doc(db, 'organization_officers', revokeOfficer.id));
      toast.success(`Officer assignment revoked for ${revokeOfficer.studentName}.`);
      onUnsavedChange();
      setRevokeOfficer(null);
    } catch (err: any) {
      console.error('Failed to revoke officer:', err);
      toast.error(err?.message || 'Failed to revoke officer.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isLoading = loadingOfficers || loadingOrgs || loadingRoles;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Officer Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage student organization officers, credentials, and executive assignments
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-[#001A4D] rounded-lg text-xs font-bold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#0E4EBD]" />
            {officers.length} Active Officers
          </span>
        </div>
      </div>

      {/* Main Roster Container */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-xs">
        {/* Search & Organization Filter Bar */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, student ID, position, or organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent"
            />
          </div>

          <div className="w-full md:w-64 flex-shrink-0">
            <select
              value={selectedOrgFilter}
              onChange={(e) => setSelectedOrgFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 focus:ring-2 focus:ring-[#001A4D]"
            >
              <option value="All">All Organizations ({organizations.length})</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.acronym} — {org.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Officers List */}
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#0E4EBD]" />
            Loading officer records...
          </div>
        ) : filteredOfficers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <div className="text-sm font-semibold text-gray-600">No officers found</div>
            <p className="text-xs text-gray-400 mt-1">
              {searchQuery || selectedOrgFilter !== 'All'
                ? 'Try adjusting your search criteria or organization filter.'
                : 'No active officers are currently registered in the system.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredOfficers.map((officer) => {
              const orgInfo = orgMap.get(officer.organizationId);
              const roleTitle = roleMap.get(officer.roleId) || (officer as any).roleName || 'Officer';
              const initials = (officer.studentName || 'Student')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div
                  key={officer.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-gray-50/80 transition-colors gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-xs">
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">{officer.studentName}</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-[#001A4D] rounded-full text-xs font-semibold">
                          {roleTitle}
                        </span>
                        {orgInfo && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-xs font-bold">
                            {orgInfo.acronym}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                        <span>ID: <span className="font-mono text-gray-700">{officer.studentId || '—'}</span></span>
                        <span>•</span>
                        <span>{officer.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto flex-shrink-0">
                    {/* 1. View Details */}
                    <button
                      type="button"
                      title="View Profile Details"
                      onClick={() => setViewOfficer(officer)}
                      className="p-2 text-gray-500 hover:text-[#001A4D] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* 2. Edit Role */}
                    <button
                      type="button"
                      title="Change Position / Role"
                      onClick={() => handleOpenEdit(officer)}
                      className="p-2 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* 3. Send Password Reset Email */}
                    <button
                      type="button"
                      title="Send Password Reset Email (Firebase Auth)"
                      onClick={() => handleOpenReset(officer)}
                      className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>

                    {/* 4. Revoke Officer */}
                    <button
                      type="button"
                      title="Revoke Officer Assignment"
                      onClick={() => handleOpenRevoke(officer)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 1: VIEW OFFICER DETAILS
         ═══════════════════════════════════════════════════════════════════════ */}
      {viewOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setViewOfficer(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden z-10 text-left">
            <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">Officer Profile Details</h3>
              <button
                type="button"
                onClick={() => setViewOfficer(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] flex items-center justify-center text-white font-bold text-lg">
                  {(viewOfficer.studentName || 'Student').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-base">{viewOfficer.studentName}</h4>
                  <p className="text-sm font-semibold text-[#0E4EBD]">
                    {roleMap.get(viewOfficer.roleId) || (viewOfficer as any).roleName || 'Officer'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Student ID</span>
                  <span className="font-mono font-bold text-gray-800">{viewOfficer.studentId || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Email Address</span>
                  <span className="font-medium text-gray-800">{viewOfficer.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Organization</span>
                  <span className="font-bold text-gray-800">
                    {orgMap.get(viewOfficer.organizationId)?.acronym} — {orgMap.get(viewOfficer.organizationId)?.name}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Portal Access Status</span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                    Active Officer Access
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setViewOfficer(null)}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 2: EDIT ROLE / POSITION
         ═══════════════════════════════════════════════════════════════════════ */}
      {editOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setEditOfficer(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden z-10 text-left">
            <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">Change Officer Position</h3>
              <button
                type="button"
                onClick={() => setEditOfficer(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Officer</label>
                <div className="font-bold text-gray-900">{editOfficer.studentName}</div>
                <div className="text-xs text-gray-500">
                  {orgMap.get(editOfficer.organizationId)?.acronym} • {editOfficer.studentId}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Select New Position <span className="text-red-500">*</span>
                </label>
                <select
                  value={editRoleId}
                  onChange={(e) => setEditRoleId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#001A4D]"
                >
                  <option value="">Select a role...</option>
                  {activeRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} {role.isRequired ? '(Required)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOfficer(null)}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRole}
                  disabled={isProcessing || !editRoleId}
                  className="flex-1 py-2.5 bg-[#001A4D] text-white rounded-xl text-sm font-bold hover:bg-[#001A4D]/90 disabled:opacity-40"
                >
                  {isProcessing ? 'Updating...' : 'Save Position'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 3: RESET CREDENTIALS / EMAIL NEW PASSWORD
         ═══════════════════════════════════════════════════════════════════════ */}
      {resetOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setResetOfficer(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden z-10 text-left">
            <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <KeyRound className="w-5 h-5 text-[#FFD41C]" />
                <h3 className="font-bold text-lg">Reset & Email Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setResetOfficer(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Generate and email a new temporary password for <span className="font-bold text-gray-900">{resetOfficer.studentName}</span>.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Officer</span>
                  <span className="font-bold text-gray-900">{resetOfficer.studentName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Student ID</span>
                  <span className="font-mono font-bold text-gray-800">{resetOfficer.studentId || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Recipient Email</span>
                  <span className="font-medium text-[#0E4EBD]">{resetOfficer.email}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Generated New Password
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={generatedPassword}
                    onChange={(e) => setGeneratedPassword(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono font-bold text-gray-900 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-gray-700 transition-colors"
                    title="Copy Password"
                  >
                    {copiedPassword ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 leading-relaxed">
                Clicking <strong>Confirm & Email Password</strong> will immediately dispatch an email containing this new password to <strong>{resetOfficer.email}</strong>.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetOfficer(null)}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  disabled={isProcessing || !resetOfficer.email || !generatedPassword}
                  className="flex-1 py-2.5 bg-[#001A4D] hover:bg-[#001A4D]/90 text-white rounded-xl text-sm font-bold disabled:opacity-40"
                >
                  {isProcessing ? 'Sending Email...' : 'Confirm & Email Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 4: REVOKE OFFICER CONFIRMATION
         ═══════════════════════════════════════════════════════════════════════ */}
      {revokeOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setRevokeOfficer(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden z-10 text-left">
            <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">Revoke Officer</h3>
              <button
                type="button"
                onClick={() => setRevokeOfficer(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">
                  Revoking <span className="font-bold">{revokeOfficer.studentName}</span> will immediately terminate their officer privileges and login access to the Officer Portal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Type <span className="font-mono font-bold text-red-600">REVOKE</span> to confirm
                </label>
                <input
                  type="text"
                  value={revokeConfirmation}
                  onChange={(e) => setRevokeConfirmation(e.target.value)}
                  placeholder="REVOKE"
                  className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRevokeOfficer(null)}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevoke}
                  disabled={isProcessing || revokeConfirmation !== 'REVOKE'}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-40"
                >
                  {isProcessing ? 'Revoking...' : 'Revoke Officer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
