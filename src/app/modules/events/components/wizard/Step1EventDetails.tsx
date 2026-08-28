import { useState, useEffect, KeyboardEvent } from 'react';
import { Lock, Upload, Tag, Layers, X, Check, Plus, Edit2, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganizationStream } from '../../../organizations';
import { useEventTypesStream, useEventCategoriesStream } from '../../hooks/useEventConfigStream';
import { createEventType, createEventCategory } from '../../services/event-config.service';
import type { EventFormData } from '../../types/event.types';
import { useOfficerProfile } from '../../../../auth/hooks/useOfficerProfile';
import { useAdviserProfile } from '../../../auth/hooks/useAdviserProfile';
import { uploadToCloudinary } from '../../../../../services/cloudinary';

const TYPE_COLORS = ['#001A4D', '#002B7F', '#0E4EBD', '#1E70E8', '#22C55E', '#FFD41C', '#EF4444', '#0EA5E9'];

interface Step1Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
  isOfficer?: boolean;
  errors?: Record<string, string>;
}

export default function Step1EventDetails({ data, onUpdate, isOfficer, errors = {} }: Step1Props) {
  const { profile: officerProfile } = useOfficerProfile();
  const { profile: adviserProfile } = useAdviserProfile();

  // Streams
  const { data: orgs, loading: orgsLoading } = useOrganizationStream();
  const { eventTypes, loading: typesLoading } = useEventTypesStream();
  const { categories, loading: categoriesLoading } = useEventCategoriesStream();

  // Custom Event Type Modal State
  const [showCustomTypeModal, setShowCustomTypeModal] = useState(false);
  const [customTypeName, setCustomTypeName] = useState('');
  const [customTypeColor, setCustomTypeColor] = useState('#1E70E8');
  const [saveTypePermanently, setSaveTypePermanently] = useState(true);
  const [isSavingType, setIsSavingType] = useState(false);

  // Custom Event Category Modal State
  const [showCustomCategoryModal, setShowCustomCategoryModal] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customCategoryTypeId, setCustomCategoryTypeId] = useState(data.eventTypeId || '');
  const [saveCategoryPermanently, setSaveCategoryPermanently] = useState(true);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Determine Creator Details
  const showOfficerMode = isOfficer !== undefined ? isOfficer : !!officerProfile;
  const creatorName = showOfficerMode
    ? (officerProfile?.studentName || data.createdByName || 'Student Officer')
    : (adviserProfile?.displayName || 'SAO Adviser');

  const creatorRole = showOfficerMode
    ? (officerProfile?.activeRoleId || 'Club Officer')
    : (adviserProfile?.jobTitle || 'System Administrator');

  const getInitials = (name: string) => {
    if (!name) return 'SO';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const creatorAvatar = showOfficerMode ? getInitials(creatorName) : 'SAO';

  // Dynamic Theme Styling based on Officer vs Admin
  const accentBorder = 'border-[#0E4EBD]';
  const accentText = 'text-[#0E4EBD]';
  const accentBg = 'bg-[#0E4EBD]';
  const accentFocusRing = 'focus:ring-[#0E4EBD]';
  const accentGradient = 'from-[#001A4D] to-[#0E4EBD]';

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

  const handleEventTypeChange = (val: string) => {
    if (val === '__other__') {
      setShowCustomTypeModal(true);
    } else {
      onUpdate({
        eventTypeId: val,
        customEventTypeName: null,
        customEventTypeColor: null,
        eventCategoryId: '',
        customEventCategoryName: null,
      });
      setCustomCategoryTypeId(val);
    }
  };

  const handleEventCategoryChange = (val: string) => {
    if (val === '__other__') {
      setCustomCategoryTypeId(data.eventTypeId || '');
      setShowCustomCategoryModal(true);
    } else {
      onUpdate({
        eventCategoryId: val,
        customEventCategoryName: null,
      });
    }
  };

  const handleCreateCustomType = async () => {
    if (!customTypeName.trim()) {
      toast.error('Please enter an event type name.');
      return;
    }
    setIsSavingType(true);
    try {
      if (saveTypePermanently) {
        const docRef = await createEventType({
          name: customTypeName.trim(),
          color: customTypeColor,
          archived: false,
        });
        onUpdate({
          eventTypeId: docRef.id,
          customEventTypeName: null,
          customEventTypeColor: null,
          eventCategoryId: '',
          customEventCategoryName: null,
        });
        setCustomCategoryTypeId(docRef.id);
        toast.success(`Event type "${customTypeName.trim()}" saved and selected!`);
      } else {
        onUpdate({
          eventTypeId: '__other__',
          customEventTypeName: customTypeName.trim(),
          customEventTypeColor: customTypeColor,
          eventCategoryId: '',
          customEventCategoryName: null,
        });
        setCustomCategoryTypeId('__other__');
        toast.success(`Custom event type "${customTypeName.trim()}" set for this event.`);
      }
      setShowCustomTypeModal(false);
      setCustomTypeName('');
    } catch (err) {
      console.error('Failed to create event type:', err);
      toast.error('Failed to create event type. Please try again.');
    } finally {
      setIsSavingType(false);
    }
  };

  const handleCreateCustomCategory = async () => {
    if (!customCategoryName.trim()) {
      toast.error('Please enter a category name.');
      return;
    }
    setIsSavingCategory(true);
    try {
      const typeIdToUse = customCategoryTypeId || data.eventTypeId || '';
      if (saveCategoryPermanently && typeIdToUse && typeIdToUse !== '__other__') {
        const docRef = await createEventCategory({
          name: customCategoryName.trim(),
          typeId: typeIdToUse,
          archived: false,
        });
        onUpdate({
          eventCategoryId: docRef.id,
          customEventCategoryName: null,
        });
        toast.success(`Category "${customCategoryName.trim()}" saved and selected!`);
      } else {
        onUpdate({
          eventCategoryId: '__other__',
          customEventCategoryName: customCategoryName.trim(),
        });
        toast.success(`Custom category "${customCategoryName.trim()}" set for this event.`);
      }
      setShowCustomCategoryModal(false);
      setCustomCategoryName('');
    } catch (err) {
      console.error('Failed to create category:', err);
      toast.error('Failed to create category. Please try again.');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const selectedOrg = activeOrgs.find(o => o.id === data.hostingOrgId) ||
    (showOfficerMode && officerProfile?.activeOrganizationId ? activeOrgs.find(o => o.id === officerProfile.activeOrganizationId) : null);
  const selectedType = activeTypes.find(t => t.id === data.eventTypeId);
  const selectedCategory = activeCategories.find(c => c.id === data.eventCategoryId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      {/* Left Panel */}
      <div className="space-y-6">

        {/* Section A — Administrative Context */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4`}>
            <h3 className="text-[#001A4D] font-bold text-base">Administrative Context</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Reference ID</label>
              <div className="relative">
                <input
                  type="text"
                  value={data.referenceId || (showOfficerMode ? 'EVT-PROP-[Auto-Generated]' : 'EVT-ADM-[Auto-Generated]')}
                  disabled
                  className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 pr-10"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Created By</label>
              <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${accentGradient} flex items-center justify-center text-white font-bold text-sm`}>
                  {creatorAvatar}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{creatorName}</div>
                  <div className="text-xs text-gray-500">{creatorRole}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section B — Organization Hosting Assignment */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4`}>
            <h3 className="text-[#001A4D] font-bold text-base">
              {showOfficerMode ? 'Hosting Organization' : 'Institutional Organization Context'}
            </h3>
          </div>
          {showOfficerMode ? (
            <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#83358E] to-[#0E4EBD] flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    {selectedOrg?.acronym?.slice(0, 3) || 'ORG'}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">
                      {selectedOrg ? `${selectedOrg.name} (${selectedOrg.acronym || 'Club'})` : (orgsLoading ? 'Loading organization...' : 'My Organization')}
                    </div>
                    <div className="text-xs text-[#83358E] flex items-center gap-1.5 font-medium mt-0.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Auto-populated and locked to your active club</span>
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-[#83358E] text-white text-xs font-semibold rounded-md">
                  Club Event
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] flex items-center justify-center text-white font-bold text-xs shadow-sm">
                    SAS
                  </div>
                  <div>
                    <div className="font-bold text-[#001A4D] text-sm">
                      Student Affairs and Services (SAS)
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      Institutional Event • Independent from student club ledgers and proposals
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-[#001A4D] text-white text-xs font-semibold rounded-md shadow-xs">
                  Institutional / SAS
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2.5 pt-2.5 border-t border-blue-200">
                💡 <span className="font-medium text-gray-700">Scanner recruitment:</span> In Step 4 (Staff), you can select and recruit student officers as scanners from specific organizations or across all organizations.
              </p>
            </div>
          )}
        </div>

        {/* Section C — Event Identity */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4`}>
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
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent transition-colors ${
                  errors.title
                    ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                    : `border-gray-300 ${accentFocusRing}`
                }`}
              />
              {errors.title && (
                <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.title}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Event Description <span className="text-gray-400 font-normal text-xs">(Optional)</span>
              </label>
              <textarea
                rows={5}
                placeholder="Detailed description of the event (optional)..."
                value={data.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 ${accentFocusRing} focus:border-transparent resize-none`}
              />
            </div>
          </div>
        </div>

        {/* Section D — Classification */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4`}>
            <h3 className="text-[#001A4D] font-bold text-base">Classification</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Event Type <span className="text-red-500">*</span>
              </label>
              <select
                value={data.customEventTypeName ? '__other__' : (data.eventTypeId || '')}
                onChange={(e) => handleEventTypeChange(e.target.value)}
                disabled={typesLoading}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent disabled:opacity-50 transition-colors ${
                  errors.eventTypeId
                    ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                    : `border-gray-300 ${accentFocusRing}`
                }`}
              >
                <option value="">{typesLoading ? 'Loading types...' : 'Select type...'}</option>
                {activeTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                <option value="__other__">Other / Custom Event Type...</option>
              </select>
              {errors.eventTypeId && (
                <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.eventTypeId}</span>
                </p>
              )}

              {data.customEventTypeName && (
                <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full border border-white shadow-xs"
                      style={{ backgroundColor: data.customEventTypeColor || '#1E70E8' }}
                    />
                    <span>Custom Event Type: <strong>{data.customEventTypeName}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomTypeName(data.customEventTypeName || '');
                      setCustomTypeColor(data.customEventTypeColor || '#1E70E8');
                      setShowCustomTypeModal(true);
                    }}
                    className="text-[#0E4EBD] hover:underline font-bold text-xs cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={data.customEventCategoryName ? '__other__' : (data.eventCategoryId || '')}
                onChange={(e) => handleEventCategoryChange(e.target.value)}
                disabled={(!data.eventTypeId && !data.customEventTypeName) || categoriesLoading}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent disabled:opacity-50 transition-colors ${
                  errors.eventCategoryId
                    ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                    : `border-gray-300 ${accentFocusRing}`
                }`}
              >
                <option value="">
                  {!data.eventTypeId && !data.customEventTypeName
                    ? 'Select a type first'
                    : categoriesLoading
                    ? 'Loading...'
                    : 'Select category...'}
                </option>
                {activeCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="__other__">Other / Custom Category...</option>
              </select>
              {errors.eventCategoryId && (
                <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.eventCategoryId}</span>
                </p>
              )}

              {data.customEventCategoryName && (
                <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#0E4EBD]" />
                    <span>Custom Category: <strong>{data.customEventCategoryName}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomCategoryName(data.customEventCategoryName || '');
                      setShowCustomCategoryModal(true);
                    }}
                    className="text-[#0E4EBD] hover:underline font-bold text-xs cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section E — Event Settings */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4`}>
            <h3 className="text-[#001A4D] font-bold text-base">Event Settings</h3>
          </div>
          <div className="space-y-3">
            {[
              { key: 'enableQRTickets', label: 'Enable QR Tickets', desc: 'Generate scannable QR code tickets & attendance scanner option', admin: false },
            ].map((setting) => {
              const isQRActive = data.enableQRTickets === true || (data as any).enableQR === true;
              return (
                <div key={setting.key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{setting.label}</span>
                    </div>
                    <p className="text-sm text-gray-600">{setting.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateField('enableQRTickets' as keyof EventFormData, !isQRActive)}
                    className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-4 cursor-pointer ${isQRActive ? accentBg : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${isQRActive ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section F — Event Media */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4`}>
            <h3 className="text-[#001A4D] font-bold text-base">Event Media</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Banner Image <span className="text-red-500">*</span>
              </label>
              <div className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer overflow-hidden group ${
                errors.bannerImageUrl
                  ? 'border-red-500 bg-red-50/40 ring-2 ring-red-200'
                  : `border-gray-300 hover:${accentBorder}`
              }`}>
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
                    <Upload className={`w-8 h-8 ${isUploadingBanner ? `${accentText} animate-bounce` : errors.bannerImageUrl ? 'text-red-500' : 'text-gray-400'} mx-auto mb-2`} />
                    <p className={`text-sm font-medium ${errors.bannerImageUrl ? 'text-red-700 font-bold' : 'text-gray-600'}`}>
                      {isUploadingBanner ? 'Uploading...' : errors.bannerImageUrl ? 'Event Banner Image is Required — Click to upload' : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB • Recommended: 1200x630px</p>
                  </>
                )}
              </div>
              {errors.bannerImageUrl && (
                <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.bannerImageUrl}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section G — Event Visibility */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4`}>
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
                type="button"
                onClick={() => updateField('isVisible', data.isVisible === undefined ? false : !data.isVisible)}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-4 cursor-pointer ${(data.isVisible !== false) ? accentBg : 'bg-gray-300'}`}
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
                  min={new Date().toISOString().slice(0, 16)}
                  value={data.visibilityStart || ''}
                  onChange={(e) => updateField('visibilityStart', e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent transition-colors ${
                    errors.visibilityStart
                      ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                      : `border-gray-300 ${accentFocusRing}`
                  }`}
                />
                {errors.visibilityStart ? (
                  <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.visibilityStart}</span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">If blank, it becomes visible immediately upon publishing.</p>
                )}
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
            <div className={`aspect-video bg-gradient-to-br ${accentGradient} rounded-lg mb-3 flex items-center justify-center overflow-hidden`}>
              {data.bannerImageUrl ? (
                <img src={data.bannerImageUrl} alt="Banner Preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white/50 text-sm">Event Banner</span>
              )}
            </div>
            <h5 className="font-bold text-gray-900 mb-1">{data.title || 'Event Title'}</h5>
            <p className="text-sm text-gray-600 mb-3 line-clamp-3">{data.description || 'Event description will appear here'}</p>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${accentGradient}`} />
              <span className="text-xs text-gray-600 font-medium">
                {showOfficerMode ? (selectedOrg ? selectedOrg.name : 'Club Name') : 'Student Affairs and Services (SAS)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span
                className="px-2 py-1 text-xs rounded font-medium"
                style={{
                  backgroundColor: data.customEventTypeColor
                    ? `${data.customEventTypeColor}20`
                    : selectedType?.color
                    ? `${selectedType.color}20`
                    : '#EFF6FF',
                  color: data.customEventTypeColor || selectedType?.color || '#1E70E8',
                }}
              >
                {data.customEventTypeName || (selectedType ? selectedType.name : 'Type')}
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">Approved</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h5 className="text-sm font-bold text-gray-900 mb-2">Admin Controls Preview</h5>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`px-3 py-1.5 text-xs border ${accentBorder} ${accentText} rounded hover:bg-gray-50 disabled:opacity-50`}>Edit</button>
              <button type="button" className="px-3 py-1.5 text-xs border border-amber-600 text-amber-600 rounded hover:bg-amber-50 disabled:opacity-50">Suspend</button>
              <button type="button" className="px-3 py-1.5 text-xs border border-red-600 text-red-600 rounded hover:bg-red-50 disabled:opacity-50">Cancel Event</button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Event Type Modal */}
      {showCustomTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Tag className={`w-5 h-5 ${accentText}`} />
                <h3 className="font-bold text-[#001A4D] text-base">Add Event Type</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomTypeModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Type Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Workshop, Seminar, Hackathon"
                  value={customTypeName}
                  onChange={(e) => setCustomTypeName(e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Type Color Tag
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {TYPE_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setCustomTypeColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                        customTypeColor === c ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {customTypeColor === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Permanently Checkbox */}
              <div className={`p-3 ${isOfficer ? 'bg-purple-50/60 border-purple-200/80' : 'bg-blue-50/60 border-blue-200/80'} border rounded-xl`}>
                <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={saveTypePermanently}
                    onChange={(e) => setSaveTypePermanently(e.target.checked)}
                    className={`mt-0.5 ${accentText} ${accentFocusRing} rounded w-4 h-4`}
                  />
                  <div>
                    <p className="font-bold text-[#001A4D]">Save this event type for future use?</p>
                    <p className="text-gray-600 text-[11px] mt-0.5 leading-normal">
                      If checked, this event type will be permanently added to the Event Types registry so it can be re-used in future events.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomTypeModal(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCustomType}
                disabled={isSavingType || !customTypeName.trim()}
                className={`flex-1 py-2.5 ${accentBg} text-white rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-colors cursor-pointer`}
              >
                {isSavingType ? 'Saving...' : 'Apply Event Type'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Category Modal */}
      {showCustomCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Layers className={`w-5 h-5 ${accentText}`} />
                <h3 className="font-bold text-[#001A4D] text-base">Add Category</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomCategoryModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Associated Event Type
                </label>
                <select
                  value={customCategoryTypeId || data.eventTypeId || ''}
                  onChange={(e) => setCustomCategoryTypeId(e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent`}
                >
                  <option value="">Select Event Type...</option>
                  {activeTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                  {data.customEventTypeName && (
                    <option value="__other__">{data.customEventTypeName} (Custom Type)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Academic, Leadership, Cultural, Sports"
                  value={customCategoryName}
                  onChange={(e) => setCustomCategoryName(e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 ${accentFocusRing} focus:border-transparent`}
                />
              </div>

              {/* Save Permanently Checkbox */}
              <div className={`p-3 ${isOfficer ? 'bg-purple-50/60 border-purple-200/80' : 'bg-blue-50/60 border-blue-200/80'} border rounded-xl`}>
                <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={saveCategoryPermanently}
                    onChange={(e) => setSaveCategoryPermanently(e.target.checked)}
                    className={`mt-0.5 ${accentText} ${accentFocusRing} rounded w-4 h-4`}
                  />
                  <div>
                    <p className="font-bold text-[#001A4D]">Save this category for future use?</p>
                    <p className="text-gray-600 text-[11px] mt-0.5 leading-normal">
                      If checked, this category will be permanently added under this Event Type in the Category registry.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomCategoryModal(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCustomCategory}
                disabled={isSavingCategory || !customCategoryName.trim()}
                className={`flex-1 py-2.5 ${accentBg} text-white rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-colors cursor-pointer`}
              >
                {isSavingCategory ? 'Saving...' : 'Apply Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
