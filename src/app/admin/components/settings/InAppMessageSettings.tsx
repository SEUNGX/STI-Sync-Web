import { MessageSquare, Bell, AlertCircle } from 'lucide-react';

interface InAppMessageSettingsProps {
  onUnsavedChange: () => void;
}

export default function InAppMessageSettings({ onUnsavedChange }: InAppMessageSettingsProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">In-App Message Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure in-app notifications and message behavior</p>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Message Display Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Message Retention Period (days)
            </label>
            <input
              type="number"
              defaultValue={30}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">Messages older than this will be automatically archived</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Maximum Unread Messages
            </label>
            <input
              type="number"
              defaultValue={100}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">Older unread messages will be marked as read automatically</p>
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-200">
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Show desktop notifications for new messages</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Play sound for high-priority messages</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Group related messages automatically</span>
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
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Message Priority Levels</h3>
        <div className="space-y-2">
          {[
            { level: 'Critical', color: '#EF4444', badge: 'bg-red-100 text-red-700', example: 'Event cancellation, urgent deadline' },
            { level: 'High', color: '#F59E0B', badge: 'bg-amber-100 text-amber-700', example: 'Approval required, budget alert' },
            { level: 'Normal', color: '#3B82F6', badge: 'bg-blue-100 text-blue-700', example: 'General updates, reminders' },
            { level: 'Low', color: '#6B7280', badge: 'bg-gray-100 text-gray-700', example: 'System updates, tips' },
          ].map((priority, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: priority.color }}></div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{priority.level} Priority</div>
                  <div className="text-xs text-gray-500">{priority.example}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${priority.badge}`}>
                  {priority.level}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Notification Banner Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Banner Display Duration (seconds)
            </label>
            <input
              type="number"
              defaultValue={5}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">How long notification banners stay visible</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Banner Position
            </label>
            <select
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            >
              <option>Top Right</option>
              <option>Top Center</option>
              <option>Top Left</option>
              <option>Bottom Right</option>
              <option>Bottom Center</option>
              <option>Bottom Left</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Message Statistics</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-3xl font-bold text-blue-700 mb-1">2,456</div>
            <div className="text-xs text-blue-600">Messages Sent This Month</div>
          </div>
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-3xl font-bold text-green-700 mb-1">94%</div>
            <div className="text-xs text-green-600">Read Rate</div>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-3xl font-bold text-amber-700 mb-1">3.2 min</div>
            <div className="text-xs text-amber-600">Average Response Time</div>
          </div>
        </div>
      </div>
    </div>
  );
}
