import { useState, useEffect } from 'react';
import { X, Upload, Loader2, Edit3, Image as ImageIcon } from 'lucide-react';
import type { OrganizationDocument } from '../../modules/organizations/types/organization.types';
import { useOrganizationTypes } from '../../modules/organizations/hooks/useOrganizationTypes';
import { useDepartments } from '../../modules/academic/hooks/useAcademicStream';
import { updateOrganization } from '../../modules/organizations/services/organization.service';
import { toast } from 'sonner';

interface EditOrganizationModalProps {
  organization: OrganizationDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditOrganizationModal({ organization, isOpen, onClose, onSuccess }: EditOrganizationModalProps) {
  const { data: orgTypes, loading: loadingTypes } = useOrganizationTypes();
  const { data: departments, loading: loadingDepts } = useDepartments();

  const [formData, setFormData] = useState({
    name: '',
    acronym: '',
    typeId: '',
    department: '',
    description: '',
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        acronym: organization.acronym || '',
        typeId: organization.typeId || '',
        department: organization.department || '',
        description: organization.description || '',
      });
      setLogoPreview(organization.logoUrl || null);
      setLogoFile(null);
    }
  }, [organization]);

  if (!isOpen || !organization) return null;

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Organization Name is required.');
      return;
    }
    if (!formData.acronym.trim()) {
      toast.error('Acronym is required.');
      return;
    }
    if (!formData.typeId) {
      toast.error('Organization Type is required.');
      return;
    }

    setIsSaving(true);
    try {
      await updateOrganization(
        organization.id,
        {
          name: formData.name.trim(),
          acronym: formData.acronym.trim().toUpperCase(),
          typeId: formData.typeId,
          department: formData.department,
          description: formData.description.trim(),
        },
        logoFile
      );

      toast.success('Organization updated successfully!', {
        description: `${formData.name} details have been saved.`,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Update organization failed:', err);
      toast.error('Failed to update organization', {
        description: err?.message || 'Something went wrong.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden z-10">
        
        {/* Header */}
        <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5 text-white">
            <Edit3 className="w-5 h-5 text-[#FFC107]" />
            <h2 className="font-bold text-lg">Edit Organization Details</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form id="edit-org-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Logo Upload Section */}
          <div className="flex items-center gap-5 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="w-16 h-16 bg-[#001A4D] rounded-xl border-2 border-white shadow-md overflow-hidden flex items-center justify-center flex-shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-700 mb-1">Organization Logo</label>
              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                <Upload className="w-3.5 h-3.5 text-[#0E4EBD]" />
                Change Logo Image
                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              </label>
              <p className="text-[11px] text-gray-400 mt-1">PNG, JPG or WebP (max 5MB)</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">Organization Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Acronym *</label>
              <input
                type="text"
                required
                value={formData.acronym}
                onChange={(e) => setFormData({ ...formData, acronym: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-[#83358E] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Organization Type *</label>
              <select
                value={formData.typeId}
                onChange={(e) => setFormData({ ...formData, typeId: e.target.value })}
                disabled={loadingTypes}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] outline-none disabled:opacity-50"
              >
                <option value="">Select type...</option>
                {orgTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Department</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                disabled={loadingDepts}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] outline-none disabled:opacity-50"
              >
                <option value="">College-wide / All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.code || d.name}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter brief summary of the organization..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] outline-none resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-org-form"
            disabled={isSaving}
            className="px-5 py-2 text-xs font-bold text-white bg-[#001A4D] rounded-lg hover:bg-[#0E4EBD] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
