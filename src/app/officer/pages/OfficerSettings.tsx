import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { Upload, Eye, EyeOff, Monitor, Smartphone, LogOut, ShieldCheck, Loader2 } from 'lucide-react';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useStudents } from '../../modules/students/hooks/useStudentStream';
import { useRoles } from '../../modules/roles/hooks/useRoles';
import { updateStudent } from '../../modules/students/services/student.service';
import { uploadToCloudinary } from '../../../services/cloudinary';
import { changeOfficerOrAdviserPassword } from '../../auth/services/password.service';
import { AlertCircle } from 'lucide-react';
import OrganizationProfile from './OrganizationProfile';
import { toast } from 'sonner';

type SettingsSection = 'account' | 'organization' | 'security';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'bg-red-500', 'bg-amber-400', 'bg-blue-500', 'bg-green-500'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${
              i <= score ? colors[score] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      {score > 0 && (
        <p className={`text-[11px] font-medium ${
          score === 1 ? 'text-red-500' : score === 2 ? 'text-amber-500' : score === 3 ? 'text-blue-500' : 'text-green-600'
        }`}>
          {labels[score]} password
        </p>
      )}
    </div>
  );
}

const NAV_ITEMS: { key: SettingsSection; label: string }[] = [
  { key: 'account', label: 'Account Profile' },
  { key: 'organization', label: 'Organization Profile' },
  { key: 'security', label: 'Security & Password' },
];

interface OfficerSettingsProps {
  defaultTab?: SettingsSection;
}

export default function OfficerSettings({ defaultTab = 'account' }: OfficerSettingsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabQuery = searchParams.get('tab') as SettingsSection | null;
  const [activeSection, setActiveSection] = useState<SettingsSection>(
    tabQuery && ['account', 'organization', 'security'].includes(tabQuery)
      ? tabQuery
      : defaultTab
  );

  // Sync tabQuery with state if searchParams change
  useEffect(() => {
    if (tabQuery && ['account', 'organization', 'security'].includes(tabQuery)) {
      setActiveSection(tabQuery);
    }
  }, [tabQuery]);

  // Real Officer Data Hooks
  const { profile, loading: profileLoading, markPasswordChanged } = useOfficerProfile();
  const { data: students, loading: studentsLoading } = useStudents();
  const { data: roles } = useRoles();

  const currentStudent = students.find(
    s => s.studentId === profile?.studentId || (profile?.email && s.email?.toLowerCase() === profile.email.toLowerCase())
  );

  const activeRoleDoc = roles.find(r => r.id === profile?.activeRoleId);
  const activeRoleName = activeRoleDoc?.name || profile?.activeRoleId || 'Officer';

  // Form State
  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Security Form State
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Populate form with real data
  useEffect(() => {
    if (currentStudent) {
      const derivedName = `${currentStudent.firstName || ''} ${currentStudent.lastName || ''}`.trim();
      setFullName(derivedName || profile?.studentName || '');
      setContactNumber(currentStudent.contactNumber || '');
      setEmail(currentStudent.email || profile?.email || '');
      setPhotoUrl(currentStudent.profilePhotoUrl || '');
    } else if (profile) {
      setFullName(profile.studentName || '');
      setEmail(profile.email || '');
    }
  }, [currentStudent, profile]);

  const handleSaveAccount = async () => {
    if (!currentStudent?.id) {
      toast.error('Student record not found in system.');
      return;
    }
    setIsSaving(true);
    try {
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      await updateStudent(currentStudent.id, {
        firstName,
        lastName,
        contactNumber: contactNumber.trim(),
        email: email.trim().toLowerCase(),
        profilePhotoUrl: photoUrl,
      });

      toast.success('Account profile updated successfully!');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      toast.error('Failed to update profile: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be under 2MB.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const res = await uploadToCloudinary(file, { folder: 'students/profile' });
      setPhotoUrl(res.secureUrl);
      if (currentStudent?.id) {
        await updateStudent(currentStudent.id, { profilePhotoUrl: res.secureUrl });
      }
      toast.success('Profile photo updated successfully!');
    } catch (err: any) {
      console.error('Photo upload failed:', err);
      toast.error('Failed to upload photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (!profile?.email) {
      toast.error('Account email not found in session.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changeOfficerOrAdviserPassword(currentPassword, newPassword, profile);
      markPasswordChanged?.();
      toast.success('Password updated successfully! Your account is now secured.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('[OfficerSettings] Error updating password:', err);
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Current password is incorrect. Please try again.');
      } else if (code === 'auth/weak-password') {
        toast.error('New password is too weak. Please use a stronger password.');
      } else {
        toast.error(err.message || 'Failed to update password. Please try again.');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleTabChange = (key: SettingsSection) => {
    setActiveSection(key);
    setSearchParams({ tab: key });
  };

  const sessions = [
    { device: 'Windows PC', browser: 'Chrome 125', timestamp: 'Current Session', location: 'Ormoc City', current: true, icon: Monitor },
    { device: 'Android Phone', browser: 'Mobile App', timestamp: 'Active 2 hours ago', location: 'Ormoc City', current: false, icon: Smartphone },
  ];

  const inputClass =
    'w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[14px] focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] outline-none transition';
  const readOnlyClass =
    'w-full px-4 py-2.5 border border-gray-200 rounded-lg text-[14px] bg-gray-50 text-gray-500 cursor-not-allowed';

  const initials = fullName
    ? fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'OF';

  const courseYearLabel = currentStudent
    ? `${currentStudent.courseCode || currentStudent.courseName || 'BSIT'} · ${currentStudent.yearLevel || 'Student'}`
    : 'BSIT · Student';

  return (
    <div className="space-y-6 pb-12">
      <div>
        <div className="text-[#888780] text-[13px] mb-1">Dashboard › Settings</div>
        <h1 className="text-[#001A4D] text-[24px] font-bold">Settings</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar nav */}
        <div className="col-span-3">
          <div className="bg-white border border-[#E0E0E0] rounded-xl p-3 shadow-sm">
            <nav className="space-y-0.5">
              {NAV_ITEMS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleTabChange(key)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-[14px] font-medium transition-colors ${
                    activeSection === key
                      ? 'bg-[#F0F6FF] text-[#0E4EBD] font-bold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-[#001A4D]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content panel */}
        <div className="col-span-9">
          <div className="bg-white border border-[#E0E0E0] rounded-xl p-6 shadow-sm">

            {/* ── Account Profile ── */}
            {activeSection === 'account' && (
              <div className="space-y-6">
                <h2 className="text-[#001A4D] text-[18px] font-bold">Account Profile</h2>

                {profileLoading || studentsLoading ? (
                  <div className="py-12 text-center text-gray-500 flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#0E4EBD]" />
                    <p className="text-sm">Loading Officer Profile...</p>
                  </div>
                ) : (
                  <>
                    {/* Avatar */}
                    <div className="flex items-center gap-5">
                      <div className="relative flex-shrink-0">
                        {photoUrl ? (
                          <img src={photoUrl} alt="Officer Avatar" className="w-20 h-20 rounded-full object-cover border border-[#E0E0E0]" />
                        ) : (
                          <div className="w-20 h-20 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-xs">
                            {initials}
                          </div>
                        )}
                        <button
                          onClick={() => photoInputRef.current?.click()}
                          disabled={isUploadingPhoto}
                          className="absolute bottom-0 right-0 p-1.5 bg-white border border-[#E0E0E0] rounded-full shadow hover:bg-gray-50 transition"
                          title="Upload photo"
                        >
                          {isUploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0E4EBD]" /> : <Upload className="w-3.5 h-3.5 text-[#0E4EBD]" />}
                        </button>
                        <input
                          type="file"
                          ref={photoInputRef}
                          onChange={handlePhotoUpload}
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                        />
                      </div>
                      <div>
                        <p className="text-[#001A4D] text-[13px] font-semibold">Profile Photo</p>
                        <p className="text-[#888780] text-[12px] mt-0.5">JPG or PNG · max 2 MB</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-[#001A4D] text-[13px] font-medium mb-1.5">Full Name</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="block text-[13px] font-medium text-gray-500 mb-1.5">Student ID</label>
                        <input
                          type="text"
                          value={profile?.studentId || currentStudent?.studentId || 'N/A'}
                          readOnly
                          className={readOnlyClass}
                        />
                      </div>

                      <div>
                        <label className="block text-[13px] font-medium text-gray-500 mb-1.5">Course & Year</label>
                        <input
                          type="text"
                          value={courseYearLabel}
                          readOnly
                          className={readOnlyClass}
                        />
                      </div>

                      <div>
                        <label className="block text-[13px] font-medium text-gray-500 mb-1.5">Officer Role</label>
                        <input
                          type="text"
                          value={activeRoleName}
                          readOnly
                          className={readOnlyClass}
                        />
                      </div>

                      <div>
                        <label className="block text-[#001A4D] text-[13px] font-medium mb-1.5">Contact Number</label>
                        <input
                          type="tel"
                          value={contactNumber}
                          onChange={e => setContactNumber(e.target.value)}
                          placeholder="+63 9XX XXX XXXX"
                          className={inputClass}
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[#001A4D] text-[13px] font-medium mb-1.5">Email Address</label>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleSaveAccount}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#001A4D] text-white rounded-lg text-[14px] font-bold hover:bg-[#0E4EBD] transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isSaving ? 'Saving Changes...' : 'Save Changes'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Organization Profile ── */}
            {activeSection === 'organization' && (
              <OrganizationProfile embedded={true} />
            )}

            {/* ── Security & Password ── */}
            {activeSection === 'security' && (
              <form onSubmit={handleUpdatePassword} className="space-y-6">
                <h2 className="text-[#001A4D] text-[18px] font-bold">Security & Password</h2>

                {profile?.requiresPasswordChange && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900 animate-in fade-in">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-950 text-sm">Action Recommended: Set Your Personal Password</p>
                      <p className="mt-0.5 text-amber-800 leading-relaxed">
                        You are currently signed in with an initial temporary password. Please choose a new, private password below to secure your account.
                      </p>
                    </div>
                  </div>
                )}

                {/* Change password */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[#001A4D] text-[13px] font-medium mb-1.5">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        placeholder="Enter current / temporary password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        className={inputClass + ' pr-10'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#001A4D] text-[13px] font-medium mb-1.5">New Password</label>
                    <div className="relative">
                      <input
                        type={showNew ? 'text' : 'password'}
                        placeholder="Enter new password (min. 8 characters)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={inputClass + ' pr-10'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <PasswordStrength password={newPassword} />
                  </div>

                  <div>
                    <label className="block text-[#001A4D] text-[13px] font-medium mb-1.5">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className={inputClass + ' pr-10'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-6 py-2.5 bg-[#0E4EBD] text-white rounded-xl text-[14px] font-bold hover:bg-[#001A4D] transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {isUpdatingPassword ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Updating Password...</>
                  ) : (
                    'Update Password'
                  )}
                </button>

                {/* Active sessions */}
                <div className="pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#0E4EBD]" />
                      <h3 className="text-[#001A4D] text-[15px] font-bold">Active Sessions</h3>
                    </div>
                    <button type="button" className="text-[13px] text-red-500 hover:text-red-600 font-medium transition-colors">
                      Sign out all other sessions
                    </button>
                  </div>
                  <div className="space-y-2">
                    {sessions.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                            <s.icon className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-[#001A4D] text-[13px] font-medium">{s.device} · {s.browser}</p>
                              {s.current && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded font-medium">
                                  This device
                                </span>
                              )}
                            </div>
                            <p className="text-[#888780] text-[11px] mt-0.5">{s.timestamp} · {s.location}</p>
                          </div>
                        </div>
                        {!s.current && (
                          <button type="button" className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Sign out">
                            <LogOut className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
