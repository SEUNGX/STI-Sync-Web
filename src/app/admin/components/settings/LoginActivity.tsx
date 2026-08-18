import { Monitor, Smartphone, MapPin, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface LoginActivityProps {
  onUnsavedChange: () => void;
}

export default function LoginActivity({ onUnsavedChange }: LoginActivityProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Login Activity</h2>
        <p className="text-sm text-gray-500 mt-1">Monitor and review your account login history and suspicious activities</p>
      </div>

      {/* Current Session */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Current Session</h3>
        <div className="flex items-start gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <div className="font-medium text-green-900 mb-1">Active Session</div>
            <div className="text-sm text-green-800 space-y-1">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                <span>Chrome on Windows 11</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>Ormoc City, Leyte • IP: 192.168.1.1</span>
              </div>
              <div className="text-xs text-green-700">Started: May 31, 2026 at 9:23 AM</div>
            </div>
          </div>
          <button className="text-green-700 text-sm font-medium hover:underline">End Session</button>
        </div>
      </div>

      {/* Recent Login Activity */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#001A4D]">Recent Login Activity</h3>
          <button className="text-[#0E4EBD] text-sm font-medium hover:underline">
            Download Full Log
          </button>
        </div>

        <div className="space-y-2">
          {[
            {
              status: 'success',
              device: 'Chrome on Windows',
              location: 'Ormoc City, Leyte',
              ip: '192.168.1.1',
              time: '2 hours ago',
              icon: Monitor,
            },
            {
              status: 'success',
              device: 'Safari on iPhone',
              location: 'Ormoc City, Leyte',
              ip: '192.168.1.45',
              time: '5 hours ago',
              icon: Smartphone,
            },
            {
              status: 'success',
              device: 'Chrome on Windows',
              location: 'Ormoc City, Leyte',
              ip: '192.168.1.1',
              time: '1 day ago',
              icon: Monitor,
            },
            {
              status: 'failed',
              device: 'Unknown Browser',
              location: 'Manila, Metro Manila',
              ip: '203.177.45.89',
              time: '2 days ago',
              icon: Monitor,
              reason: 'Invalid password',
            },
            {
              status: 'success',
              device: 'Safari on iPhone',
              location: 'Ormoc City, Leyte',
              ip: '192.168.1.45',
              time: '3 days ago',
              icon: Smartphone,
            },
            {
              status: 'warning',
              device: 'Chrome on Windows',
              location: 'Cebu City, Cebu',
              ip: '112.205.23.156',
              time: '5 days ago',
              icon: Monitor,
              reason: 'New location',
            },
          ].map((activity, index) => {
            const Icon = activity.icon;
            return (
              <div
                key={index}
                className={`flex items-center justify-between p-4 border rounded-lg ${
                  activity.status === 'failed'
                    ? 'border-red-200 bg-red-50'
                    : activity.status === 'warning'
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      activity.status === 'failed'
                        ? 'bg-red-100'
                        : activity.status === 'warning'
                        ? 'bg-amber-100'
                        : 'bg-green-100'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        activity.status === 'failed'
                          ? 'text-red-600'
                          : activity.status === 'warning'
                          ? 'text-amber-600'
                          : 'text-green-600'
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{activity.device}</span>
                      {activity.status === 'failed' && (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <XCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                      {activity.status === 'warning' && (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="w-3 h-3" />
                          Unusual
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {activity.location} • {activity.ip}
                      {activity.reason && ` • ${activity.reason}`}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{activity.time}</div>
                </div>
                {activity.status === 'warning' && (
                  <button className="ml-4 text-[#0E4EBD] text-sm font-medium hover:underline">
                    Mark as Safe
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Security Alerts */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Security Alerts</h3>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Email me when there's a new login</div>
              <div className="text-xs text-gray-500">Get notified immediately for any new device or location</div>
            </div>
            <button
              onClick={onUnsavedChange}
              className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
            >
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
            </button>
          </label>

          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Alert on failed login attempts</div>
              <div className="text-xs text-gray-500">Notify me if someone tries to access my account</div>
            </div>
            <button
              onClick={onUnsavedChange}
              className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
            >
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
            </button>
          </label>

          <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Require approval for new locations</div>
              <div className="text-xs text-gray-500">Ask for confirmation when logging in from a new city</div>
            </div>
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
  );
}
