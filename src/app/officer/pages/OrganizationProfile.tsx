import { useState, useEffect, useRef } from 'react';
import { Camera, Building2, Save, Users, Crown, ShieldAlert, Loader2, AlertCircle } from 'lucide-react';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useRoles } from '../../modules/roles/hooks/useRoles';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useOrganizationTypes } from '../../modules/organizations/hooks/useOrganizationTypes';
import { useDepartments } from '../../modules/academic/hooks/useAcademicStream';
import { useOrgMembers } from '../../modules/organizations/hooks/useOrgMembers';
import { useOrgOfficers } from '../../modules/organizations/hooks/useOrgOfficers';
import { updateOrganization } from '../../modules/organizations/services/organization.service';
import type { OrganizationDocument } from '../../modules/organizations/types/organization.types';

export default function OrganizationProfile() {
  const { profile } = useOfficerProfile();
  const activeOrgId = profile?.activeOrganizationId || '';

  const { data: orgs, loading: orgsLoading } = useOrganizationStream();
  const { data: types, loading: typesLoading } = useOrganizationTypes();
  const { data: departments, loading: deptsLoading } = useDepartments();
  const { data: roles } = useRoles();
  const { members, loading: membersLoading } = useOrgMembers(activeOrgId);
  const { officers, loading: officersLoading } = useOrgOfficers(activeOrgId);

  const activeOrg = orgs.find(o => o.id === activeOrgId);
  const activeRoleDoc = roles.find(r => r.id === profile?.activeRoleId);
  const activeRoleName = activeRoleDoc?.name?.toLowerCase() || '';

  const canEdit = ['president', 'vice president', 'secretary'].includes(activeRoleName);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<OrganizationDocument>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize form data when org data loads
  useEffect(() => {
    if (activeOrg) {
      setFormData({
        name: activeOrg.name,
        acronym: activeOrg.acronym,
        typeId: activeOrg.typeId,
        departmentId: activeOrg.departmentId,
        description: activeOrg.description || '',
      });
      setLogoPreview(activeOrg.logoUrl || null);
    }
  }, [activeOrg]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be under 5MB');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!canEdit || !activeOrg) return;
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    
    try {
      await updateOrganization(activeOrg.id, formData, logoFile);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setLogoFile(null); // Clear the pending file since it's uploaded
    } catch (err: any) {
      setError(err.message || 'Failed to update organization profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orgsLoading || typesLoading || deptsLoading || membersLoading || officersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p>Loading Organization Profile...</p>
        </div>
      </div>
    );
  }

  if (!activeOrg) {
    return (
      <div className="text-center p-12 bg-white rounded-xl border border-[#E0E0E0]">
        <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-[#001A4D]">Organization Not Found</h3>
        <p className="text-gray-500">Please make sure you have an active organization selected.</p>
      </div>
    );
  }

  const activeOfficersList = officers.filter(o => o.isActive);
  const establishedDate = activeOrg.createdAt?.toDate 
    ? activeOrg.createdAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown';

  const inputClass = `w-full px-4 py-2 border border-[#E0E0E0] rounded-lg text-sm transition-colors focus:ring-2 focus:ring-[#1E70E8] focus:border-transparent outline-none ${
    !canEdit ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : 'bg-white'
  }`;

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[#888780] text-[13px] mb-1">Dashboard &gt; Organization Profile</div>
          <h1 className="text-[#001A4D] text-[24px] font-bold flex items-center gap-3">
            Organization Profile
            {!canEdit && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium border border-gray-200">
                <ShieldAlert className="w-3.5 h-3.5" /> Read Only
              </span>
            )}
          </h1>
        </div>
        
        {canEdit && (
          <button 
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0E4EBD] text-white rounded-lg text-[14px] font-bold hover:bg-[#0E4EBD]/90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">✓</div>
          <p className="text-sm font-medium">Organization profile updated successfully.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Identity & Details) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm overflow-hidden">
            <div className="p-6">
              <h2 className="text-[16px] font-bold text-[#001A4D] mb-6 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#888780]" /> Identity Details
              </h2>
              
              <div className="flex flex-col sm:flex-row gap-6 mb-8">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-32 h-32 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center overflow-hidden relative group">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Organization Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-10 h-10 text-gray-400" />
                    )}
                    
                    {canEdit && (
                      <div 
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Camera className="w-6 h-6 mb-1" />
                        <span className="text-xs font-medium">Change Logo</span>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                  />
                  {canEdit && <p className="text-xs text-gray-500">JPG, PNG (Max 5MB)</p>}
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
                    <input 
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      disabled={!canEdit}
                      className={inputClass}
                      placeholder="e.g. Society of Information Technology Enthusiasts"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Acronym *</label>
                    <input 
                      type="text"
                      value={formData.acronym || ''}
                      onChange={(e) => setFormData({...formData, acronym: e.target.value})}
                      disabled={!canEdit}
                      className={inputClass}
                      placeholder="e.g. SITE"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization Type *</label>
                  <select
                    value={formData.typeId || ''}
                    onChange={(e) => setFormData({...formData, typeId: e.target.value})}
                    disabled={!canEdit}
                    className={inputClass}
                  >
                    {types.filter(t => !t.archived).map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={formData.departmentId || ''}
                    onChange={(e) => setFormData({...formData, departmentId: e.target.value})}
                    disabled={!canEdit}
                    className={inputClass}
                  >
                    <option value="cross-departmental">Cross-Departmental (All)</option>
                    {departments.filter(d => !d.archived).map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description / Mission</label>
                <textarea 
                  rows={4}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  disabled={!canEdit}
                  className={`${inputClass} resize-none`}
                  placeholder="Describe your organization's purpose and goals..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Stats, Context, Officers) */}
        <div className="space-y-6">
          
          <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm p-6">
            <h3 className="text-[14px] font-bold text-[#888780] uppercase tracking-wider mb-4">Academic Context</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                  activeOrg.status === 'active' ? 'bg-[#22C55E]/10 text-[#16A34A]' : 
                  activeOrg.status === 'inactive' ? 'bg-gray-100 text-gray-600' : 
                  'bg-red-50 text-red-600'
                }`}>
                  {activeOrg.status}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Academic Year</span>
                <span className="text-sm font-medium text-[#001A4D]">{activeOrg.academicYear}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Semester</span>
                <span className="text-sm font-medium text-[#001A4D]">{activeOrg.semester}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">Date Established</span>
                <span className="text-sm font-medium text-[#001A4D]">{establishedDate}</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            {/* Decorative background circle */}
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10" />
            
            <h3 className="text-[14px] font-bold text-white/70 uppercase tracking-wider mb-6 relative z-10">Live Statistics</h3>
            
            <div className="grid grid-cols-2 gap-4 relative z-10">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                <Users className="w-5 h-5 text-[#FFC107] mb-2" />
                <div className="text-3xl font-bold mb-1">{members.length}</div>
                <div className="text-xs font-medium text-white/80">Total Members</div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                <Crown className="w-5 h-5 text-[#FFC107] mb-2" />
                <div className="text-3xl font-bold mb-1">{activeOfficersList.length}</div>
                <div className="text-xs font-medium text-white/80">Active Officers</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm p-6">
            <h3 className="text-[14px] font-bold text-[#888780] uppercase tracking-wider mb-4 flex items-center justify-between">
              Officer Roster
              <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-[10px]">Active Only</span>
            </h3>
            
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {activeOfficersList.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm italic">
                  No active officers found.
                </div>
              ) : (
                activeOfficersList.map(officer => {
                  const rName = roles.find(r => r.id === officer.roleId)?.name || officer.roleId;
                  const initials = officer.studentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                  
                  return (
                    <div key={officer.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className="w-9 h-9 rounded-full bg-[#EEEDFE] text-[#7F77DD] font-bold flex items-center justify-center text-xs flex-shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-[#001A4D] truncate">{officer.studentName}</div>
                        <div className="text-xs text-[#0E4EBD] font-medium truncate">{rName}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
