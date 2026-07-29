import { useState, KeyboardEvent } from 'react';
import { Lock, Upload } from 'lucide-react';
import { useOrganizationStream } from '../../../organizations';
import { useEventTypesStream, useEventCategoriesStream } from '../../hooks/useEventConfigStream';
import type { EventFormData } from '../../types/event.types';
import { useAuth } from '../../../auth/hooks/useAuth'; // Replace with useAdviserProfile if it exists
import { uploadToCloudinary } from '../../../../../services/cloudinary';

interface Step1Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
}

export default function Step1EventDetails({ data, onUpdate }: Step1Props) {
  // Streams
  const { data: orgs, loading: orgsLoading } = useOrganizationStream();
  const { eventTypes, loading: typesLoading } = useEventTypesStream();
  const { categories, loading: categoriesLoading } = useEventCategoriesStream();

  // Active Orgs, Types, Categories
  const activeOrgs = orgs.filter(o => !o.archived);
  const activeTypes = eventTypes.filter(t => !t.archived);
  
  // Filter categories based on selected event type
  const activeCategories = categories.filter(c => !c.archived && c.typeId === data.eventTypeId);

  const [objectiveInput, setObjectiveInput] = useState('');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const updateField = (field: keyof EventFormData, value: any) => {
    const updates: any = { [field]: value };
    if (field === 'enableQRTickets' || (field as string) === 'enableQR') {
      updates.enableQRTickets = value;
      updates.enableQR = value;
    }
    onUpdate(updates);
  };

  const handleAddObjective = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && objectiveInput.trim()) {
      const current = data.objectives || [];
      if (!current.includes(objectiveInput.trim())) {
        updateField('objectives', [...current, objectiveInput.trim()]);
      }
      setObjectiveInput('');
    }
  };

  const handleRemoveObjective = (objToRemove: string) => {
    const current = data.objectives || [];
    updateField('objectives', current.filter(o => o !== objToRemove));
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBanner(true);
    try {
      const result = await uploadToCloudinary(file, { folder: 'events/banners' });
      updateField('bannerImageUrl', result.secureUrl);
    } catch (error) {
      console.error('Failed to upload banner', error);
      alert('Failed to upload banner image.');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const selectedOrg = activeOrgs.find(o => o.id === data.hostingOrgId);
  const selectedType = activeTypes.find(t => t.id === data.eventTypeId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      {/* Left Panel */}
      <div className="space-y-6">

        {/* Section A — Administrative Context */}
        <div>
          <div className="border-l-4 border-[#83358E] pl-3 mb-4">
            <h3 className="text-[#001A4D] font-bold text-base">Administrative Context</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Reference ID</label>
              <div className="relative">
                <input
                  type="text"
                  value={data.referenceId || 'EVT-ADM-[Auto-Generated]'}
                  disabled
                  className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 pr-10"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Created By</label>
              <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0E4EBD] to-[#83358E] flex items-center justify-center text-white font-bold text-sm">SAO</div>
                <div>
                  <div className="font-medium text-gray-900">SAO Adviser</div>
                  <div className="text-xs text-gray-500">System Administrator</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section B — Organization Assignment */}
        <div>
          <div className="border-l-4 border-[#83358E] pl-3 mb-4">
            <h3 className="text-[#001A4D] font-bold text-base">Organization Assignment</h3>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Hosting Organization <span className="text-red-500">*</span>
            </label>
            <select
              value={data.hostingOrgId || ''}
              onChange={(e) => updateField('hostingOrgId', e.target.value)}
              disabled={orgsLoading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent disabled:opacity-50"
            >
              <option value="">{orgsLoading ? 'Loading organizations...' : 'Select organization...'}</option>
              {activeOrgs.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Section C — Event Identity */}
        <div>
          <div className="border-l-4 border-[#83358E] pl-3 mb-4">
            <h3 className="text-[#001A4D] font-bold text-base">Event Identity</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Event Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter event title..."
                value={data.title || ''}
                onChange={(e) => updateField('title', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Event Description <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={5}
                placeholder="Detailed description of the event..."
                value={data.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section D — Classification */}
        <div>
          <div className="border-l-4 border-[#83358E] pl-3 mb-4">
            <h3 className="text-[#001A4D] font-bold text-base">Classification</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Event Type <span className="text-red-500">*</span>
              </label>
              <select
                value={data.eventTypeId || ''}
                onChange={(e) => {
                  onUpdate({ eventTypeId: e.target.value, eventCategoryId: '' });
                }}
                disabled={typesLoading}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent disabled:opacity-50"
              >
                <option value="">{typesLoading ? 'Loading types...' : 'Select type...'}</option>
                {activeTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={data.eventCategoryId || ''}
                onChange={(e) => updateField('eventCategoryId', e.target.value)}
                disabled={!data.eventTypeId || categoriesLoading}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent disabled:opacity-50"
              >
                <option value="">
                  {!data.eventTypeId ? 'Select a type first' : categoriesLoading ? 'Loading...' : 'Select category...'}
                </option>
                {activeCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section E — Event Settings */}
        <div>
          <div className="border-l-4 border-[#83358E] pl-3 mb-4">
            <h3 className="text-[#001A4D] font-bold text-base">Event Settings</h3>
          </div>
          <div className="space-y-3">
            {[
              { key: 'enableQRTickets', label: 'Enable QR Tickets', desc: 'Generate scannable QR code tickets & attendance scanner option', admin: false },
            ].map((setting) => (
              <div key={setting.key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{setting.label}</span>
                  </div>
                  <p className="text-sm text-gray-600">{setting.desc}</p>
                </div>
                <button
                  onClick={() => updateField(setting.key as keyof EventFormData, data[setting.key as keyof EventFormData] === false ? true : false)}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${(data[setting.key as keyof EventFormData] !== false && data[setting.key as keyof EventFormData] !== undefined) ? 'bg-[#83358E]' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${(data[setting.key as keyof EventFormData] !== false && data[setting.key as keyof EventFormData] !== undefined) ? 'translate-x-6' : ''}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section F — Event Media */}
        <div>
          <div className="border-l-4 border-[#83358E] pl-3 mb-4">
            <h3 className="text-[#001A4D] font-bold text-base">Event Media</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Banner Image <span className="text-red-500">*</span>
              </label>
              <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#83358E] transition-colors cursor-pointer overflow-hidden group">
                <input 
                  type="file" 
                  accept="image/png, image/jpeg" 
                  onChange={handleBannerUpload} 
                  disabled={isUploadingBanner}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" 
                />
                {data.bannerImageUrl ? (
                  <div className="absolute inset-0">
                    <img src={data.bannerImageUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white font-medium">Click to change</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className={`w-8 h-8 ${isUploadingBanner ? 'text-[#83358E] animate-bounce' : 'text-gray-400'} mx-auto mb-2`} />
                    <p className="text-sm text-gray-600">{isUploadingBanner ? 'Uploading...' : 'Click to upload or drag and drop'}</p>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB • Recommended: 1200x630px</p>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Section G — Event Visibility */}
        <div>
          <div className="border-l-4 border-[#83358E] pl-3 mb-4">
            <h3 className="text-[#001A4D] font-bold text-base">Event Visibility</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">Show Event in Student Feed</span>
                </div>
                <p className="text-sm text-gray-600">Controls if this event appears in the STI Sync mobile app.</p>
              </div>
              <button
                onClick={() => updateField('isVisible', data.isVisible === undefined ? false : !data.isVisible)}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${(data.isVisible !== false) ? 'bg-[#83358E]' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${(data.isVisible !== false) ? 'translate-x-6' : ''}`} />
              </button>
            </div>

            {data.isVisible !== false && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Visible From
                </label>
                <input
                  type="datetime-local"
                  value={data.visibilityStart || ''}
                  onChange={(e) => updateField('visibilityStart', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">If blank, it becomes visible immediately upon publishing.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel — Preview */}
      <div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm sticky top-0">
          <h4 className="font-bold text-gray-900 mb-3">Student Feed Preview</h4>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="aspect-video bg-gradient-to-br from-[#0E4EBD] to-[#83358E] rounded-lg mb-3 flex items-center justify-center overflow-hidden">
              {data.bannerImageUrl ? (
                <img src={data.bannerImageUrl} alt="Banner Preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white/50 text-sm">Event Banner</span>
              )}
            </div>
            <h5 className="font-bold text-gray-900 mb-1">{data.title || 'Event Title'}</h5>
            <p className="text-sm text-gray-600 mb-3">{data.tagline || 'Event tagline will appear here'}</p>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0E4EBD] to-[#83358E]" />
              <span className="text-xs text-gray-600">{selectedOrg ? selectedOrg.name : 'Organization Name'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded" style={{ backgroundColor: selectedType?.color ? `${selectedType.color}20` : undefined, color: selectedType?.color }}>
                {selectedType ? selectedType.name : 'Type'}
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">Approved</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h5 className="text-sm font-bold text-gray-900 mb-2">Admin Controls Preview</h5>
            <div className="flex flex-wrap gap-2">
              <button className="px-3 py-1.5 text-xs border border-[#83358E] text-[#83358E] rounded hover:bg-[#83358E]/5 disabled:opacity-50">Edit</button>
              <button className="px-3 py-1.5 text-xs border border-amber-600 text-amber-600 rounded hover:bg-amber-50 disabled:opacity-50">Suspend</button>
              <button className="px-3 py-1.5 text-xs border border-red-600 text-red-600 rounded hover:bg-red-50 disabled:opacity-50">Cancel Event</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
