import { Eye, EyeOff, Check, X, Lock, Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '../../../../services/firebase';
import { useAdviserProfile } from '../../../modules/auth';
import { toast } from 'sonner';

interface SecurityPasswordProps {
  onUnsavedChange: () => void;
}

export default function SecurityPassword({ onUnsavedChange }: SecurityPasswordProps) {
  const { user } = useAdviserProfile();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { level: 0, label: '' };
    if (password.length < 8) return { level: 1, label: 'Too short (min 8 chars)' };
    
    let score = 1;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score === 1) return { level: 1, label: 'Weak' };
    if (score === 2) return { level: 2, label: 'Fair' };
    if (score === 3) return { level: 3, label: 'Strong' };
    return { level: 4, label: 'Very Strong' };
  };

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }

    if (!newPassword) {
      toast.error('Please enter your new password.');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword === currentPassword) {
      toast.error('New password cannot be the same as your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    const targetUser = auth.currentUser || user;
    if (!targetUser || !targetUser.email) {
      toast.error('Unable to verify active session. Please sign in again.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Re-authenticate user
      const credential = EmailAuthProvider.credential(targetUser.email, currentPassword);
      await reauthenticateWithCredential(targetUser, credential);

      // 2. Update password
      await updatePassword(targetUser, newPassword);

      toast.success('Admin password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('[SecurityPassword] Error updating password:', err);
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Incorrect current password. Please verify and try again.');
      } else if (code === 'auth/weak-password') {
        toast.error('Password is too weak. Please include letters, numbers, and symbols.');
      } else if (code === 'auth/requires-recent-login') {
        toast.error('For security, please log out and sign back in before changing your password.');
      } else {
        toast.error(err?.message || 'Failed to update password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Security & Password</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage your SAO administrator account credentials and password security
        </p>
      </div>

      {/* Account Info Pill */}
      {user?.email && (
        <div className="flex items-center gap-3 p-4 bg-blue-50/70 border border-blue-100 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-[#001A4D] flex items-center justify-center text-white font-bold flex-shrink-0">
            <Lock className="w-5 h-5 text-[#FFD41C]" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Admin Account</div>
            <div className="text-sm font-bold text-[#001A4D]">{user.email}</div>
          </div>
        </div>
      )}

      {/* Password Management Card */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
          <ShieldCheck className="w-5 h-5 text-[#001A4D]" />
          <h3 className="text-lg font-bold text-[#001A4D]">Change Admin Password</h3>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Current Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  onUnsavedChange();
                }}
                disabled={isSubmitting}
                placeholder="Enter your current password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] pr-10 text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  onUnsavedChange();
                }}
                disabled={isSubmitting}
                placeholder="Enter new password (min. 8 characters)"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] pr-10 text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && (
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        strength.level === 1 ? 'w-1/4 bg-red-500' :
                        strength.level === 2 ? 'w-2/4 bg-amber-500' :
                        strength.level === 3 ? 'w-3/4 bg-green-500' :
                        strength.level === 4 ? 'w-full bg-green-600' :
                        'w-0'
                      }`}
                    ></div>
                  </div>
                  <span className={`text-xs font-semibold ${
                    strength.level === 1 ? 'text-red-600' :
                    strength.level === 2 ? 'text-amber-600' :
                    strength.level >= 3 ? 'text-green-600' :
                    ''
                  }`}>
                    {strength.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  onUnsavedChange();
                }}
                disabled={isSubmitting}
                placeholder="Confirm your new password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] pr-10 text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {confirmPassword && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {passwordsMatch ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <X className="w-5 h-5 text-red-600" />
                  )}
                </div>
              )}
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword || !passwordsMatch}
              className="px-6 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
