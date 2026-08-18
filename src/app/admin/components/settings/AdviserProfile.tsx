import { useState, useEffect } from 'react';
import { Camera, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAdviserProfile, updateAdviserProfile } from '../../../modules/auth';

interface AdviserProfileProps {
  onUnsavedChange: () => void;
}

export default function AdviserProfile({ onUnsavedChange }: AdviserProfileProps) {
  const { profile, loading } = useAdviserProfile();
  
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setMiddleName(profile.middleName || '');
      setLastName(profile.lastName || '');
      setPhoneNumber(profile.phoneNumber || '');
      setDepartment(profile.department || '');
      setPosition(profile.position || '');
    }
  }, [profile]);

  if (loading) {
    return <div className="p-6 text-gray-500">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="p-6 text-red-500">Profile not found.</div>;
  }

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');
    
    try {
      const displayName = [firstName, middleName, lastName].filter(Boolean).join(' ');
      
      await updateAdviserProfile(profile.uid, {
        firstName,
        middleName: middleName || null,
        lastName,
        displayName,
        phoneNumber: phoneNumber || null,
        department,
        position,
      });
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setSaveStatus('error');
      setErrorMessage(err.message || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    onUnsavedChange();
    setSaveStatus('idle');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Adviser Profile</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your personal information and profile settings</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg font-bold hover:opacity-90 flex items-center gap-2 disabled:opacity-70 transition-opacity cursor-pointer shadow-sm"
        >
          {isSaving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {saveStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 text-green-700">
          <CheckCircle2 className="w-5 h-5" />
          <p className="font-medium">Profile updated successfully.</p>
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        {/* Avatar Section */}
        <div className="flex items-start gap-6 pb-6 border-b border-gray-200 mb-6">
          <div className="relative group">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.displayName} className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] flex items-center justify-center text-white font-bold text-2xl">
                {initials || '?'}
              </div>
            )}
            <div className="absolute inset-0 bg-[#001A4D]/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-xl font-bold text-[#001A4D]">{profile.displayName}</h3>
            <p className="text-[#0E4EBD] font-medium">{profile.position}</p>
            <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              {profile.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={handleChange(setFirstName)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Middle Name
            </label>
            <input
              type="text"
              value={middleName}
              onChange={handleChange(setMiddleName)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Last Name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={handleChange(setLastName)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-gray-600"
              />
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Email address cannot be changed here.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Contact Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={handleChange(setPhoneNumber)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Department / Office
            </label>
            <input
              type="text"
              value={department}
              onChange={handleChange(setDepartment)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Position Title
            </label>
            <input
              type="text"
              value={position}
              onChange={handleChange(setPosition)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
