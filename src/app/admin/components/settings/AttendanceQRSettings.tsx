import { QrCode, Clock, Download } from 'lucide-react';

interface AttendanceQRSettingsProps {
  onUnsavedChange: () => void;
}

export default function AttendanceQRSettings({ onUnsavedChange }: AttendanceQRSettingsProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Attendance & QR Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure QR code generation and attendance tracking rules</p>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">QR Code Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              QR Code Refresh Interval (seconds)
            </label>
            <input
              type="number"
              defaultValue={30}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">How often QR codes regenerate to prevent screenshot fraud</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Scan Timeout Window (minutes)
            </label>
            <input
              type="number"
              defaultValue={5}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">Time window for valid QR code scans</p>
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-200">
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Enable geolocation verification</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Allow duplicate scans prevention</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Require event staff approval for manual attendance</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-gray-300"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full"></div>
              </button>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Attendance Validation Rules</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Minimum Attendance Percentage for Certificates
            </label>
            <input
              type="number"
              defaultValue={75}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">Students must attend at least this percentage to receive a certificate</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Late Arrival Grace Period (minutes)
            </label>
            <input
              type="number"
              defaultValue={15}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">Students arriving within this time are marked as present (not late)</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Scanner Access Codes</h3>
        <p className="text-sm text-gray-500 mb-4">Active scanner codes for event staff</p>
        <div className="space-y-2">
          {[
            { code: 'SCAN2026A', name: 'Scanner Team Alpha', events: 12, lastUsed: '2 hours ago', status: 'active' },
            { code: 'SCAN2026B', name: 'Scanner Team Beta', events: 8, lastUsed: '1 day ago', status: 'active' },
            { code: 'SCAN2025X', name: 'Old Scanner Code', events: 45, lastUsed: '3 months ago', status: 'inactive' },
          ].map((scanner, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-4 flex-1">
                <QrCode className="w-5 h-5 text-[#0E4EBD]" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{scanner.name}</div>
                  <div className="text-xs text-gray-500">
                    Code: {scanner.code} • {scanner.events} events • Last used {scanner.lastUsed}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  scanner.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {scanner.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <button className="ml-4 text-red-600 text-sm font-medium hover:underline">Revoke</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
