import { Eye, EyeOff, Check, X, LogOut } from 'lucide-react';
import { useState } from 'react';

interface SecurityPasswordProps {
  onUnsavedChange: () => void;
}

export default function SecurityPassword({ onUnsavedChange }: SecurityPasswordProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { level: 0, label: '' };
    if (password.length < 6) return { level: 1, label: 'Weak' };
    if (password.length < 10) return { level: 2, label: 'Fair' };
    if (password.length < 14) return { level: 3, label: 'Strong' };
    return { level: 4, label: 'Very Strong' };
  };

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Security & Password</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your account security and authentication settings</p>
      </div>

      {/* Password Management Card */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Password Management</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                onChange={onUnsavedChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] pr-10"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  onUnsavedChange();
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
              />
            </div>
            {newPassword && (
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
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
                  <span className={`text-xs font-medium ${
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  onUnsavedChange();
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] pr-10"
              />
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
          </div>

          <button className="px-6 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-sm">
            Update Password
          </button>
        </div>
      </div>

      {/* Two-Factor Authentication Card */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-[#001A4D]">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-500 mt-1">Add an extra layer of security to your account</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              twoFactorEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              onClick={() => {
                setTwoFactorEnabled(!twoFactorEnabled);
                onUnsavedChange();
              }}
              className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                twoFactorEnabled ? 'bg-[#001A4D]' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  twoFactorEnabled ? 'translate-x-6' : ''
                }`}
              ></div>
            </button>
          </div>
        </div>

        {twoFactorEnabled && (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">2FA Method</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="2fa-method" defaultChecked className="text-[#0E4EBD] focus:ring-[#0E4EBD]" />
                  <span className="text-sm text-gray-700">Email OTP</span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="2fa-method" className="text-[#0E4EBD] focus:ring-[#0E4EBD]" />
                  <span className="text-sm text-gray-700">Authenticator App</span>
                </label>
              </div>
            </div>
            <button className="text-sm text-[#0E4EBD] font-medium hover:underline cursor-pointer">
              Re-configure 2FA
            </button>
          </div>
        )}
      </div>

      {/* Session Management Card */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Session Management</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Session Timeout (minutes)
            </label>
            <input
              type="number"
              defaultValue={30}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">Automatically log out after this many minutes of inactivity</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Maximum Concurrent Sessions
            </label>
            <input
              type="number"
              defaultValue={1}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">Prevent login from multiple devices simultaneously</p>
          </div>

          <button className="px-6 py-2.5 border-2 border-red-500 text-red-600 rounded-lg font-medium hover:bg-red-50 flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Force Logout All Sessions
            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">3 active</span>
          </button>
        </div>
      </div>

      {/* Trusted Devices Card */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Trusted Devices</h3>

        <div className="space-y-2 mb-4">
          {[
            { device: 'Chrome on Windows', ip: '192.168.1.1', location: 'Ormoc City', lastActive: '2 minutes ago' },
            { device: 'Safari on iPhone', ip: '192.168.1.45', location: 'Ormoc City', lastActive: '1 hour ago' },
          ].map((device, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-gray-900 text-sm">{device.device}</div>
                <div className="text-xs text-gray-500">{device.ip} • {device.location} • {device.lastActive}</div>
              </div>
              <button className="text-red-600 text-sm font-medium hover:underline">Revoke</button>
            </div>
          ))}
        </div>

        <button className="text-red-600 text-sm font-medium hover:underline">Revoke All Devices</button>
      </div>
    </div>
  );
}
