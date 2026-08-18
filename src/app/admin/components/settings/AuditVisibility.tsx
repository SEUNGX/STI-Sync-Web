import { Eye, Activity, Download, Filter } from 'lucide-react';

interface AuditVisibilityProps {
  onUnsavedChange: () => void;
}

export default function AuditVisibility({ onUnsavedChange }: AuditVisibilityProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Audit & Visibility</h2>
        <p className="text-sm text-gray-500 mt-1">Monitor system activity and configure audit logging</p>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#001A4D]">Recent System Activity</h3>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-[#0E4EBD] border border-[#0E4EBD] rounded-lg text-sm font-medium hover:bg-[#0E4EBD]/5 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button className="px-4 py-2 text-[#0E4EBD] border border-[#0E4EBD] rounded-lg text-sm font-medium hover:bg-[#0E4EBD]/5 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {[
            { action: 'Event Approved', user: 'Riselle Lucanas', target: 'Annual Cultural Night', time: '2 minutes ago', type: 'approval' },
            { action: 'Budget Modified', user: 'Admin User', target: 'JPIA Budget Allocation', time: '15 minutes ago', type: 'finance' },
            { action: 'User Login', user: 'Juan Dela Cruz', target: 'System Access', time: '1 hour ago', type: 'auth' },
            { action: 'Certificate Generated', user: 'System', target: 'Leadership Summit 2026', time: '2 hours ago', type: 'certificate' },
            { action: 'Event Created', user: 'Maria Santos', target: 'Coding Workshop', time: '3 hours ago', type: 'event' },
            { action: 'Settings Changed', user: 'Riselle Lucanas', target: 'Notification Settings', time: '5 hours ago', type: 'settings' },
          ].map((log, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-4 flex-1">
                <Activity className={`w-5 h-5 ${
                  log.type === 'approval' ? 'text-green-600' :
                  log.type === 'finance' ? 'text-amber-600' :
                  log.type === 'auth' ? 'text-blue-600' :
                  log.type === 'certificate' ? 'text-[#0E4EBD]' :
                  log.type === 'event' ? 'text-[#001A4D]' :
                  'text-gray-600'
                }`} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{log.action}</div>
                  <div className="text-xs text-gray-500">{log.user} • {log.target}</div>
                </div>
                <div className="text-xs text-gray-500">{log.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Audit Log Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Log Retention Period (days)
            </label>
            <input
              type="number"
              defaultValue={90}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">Audit logs older than this will be archived</p>
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-200">
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Log all user authentication attempts</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Log all event approvals and rejections</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Log all financial transactions</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Log data export operations</span>
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
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Visibility Controls</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <span className="text-sm text-gray-700">Show organization budget details to officers</span>
            <button
              onClick={onUnsavedChange}
              className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
            >
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
            </button>
          </label>
          <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <span className="text-sm text-gray-700">Allow students to view event attendance records</span>
            <button
              onClick={onUnsavedChange}
              className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
            >
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
            </button>
          </label>
          <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <span className="text-sm text-gray-700">Public event calendar (no login required)</span>
            <button
              onClick={onUnsavedChange}
              className="relative w-12 h-6 rounded-full bg-gray-300"
            >
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full"></div>
            </button>
          </label>
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Activity Statistics</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-3xl font-bold text-blue-700 mb-1">1,245</div>
            <div className="text-xs text-blue-600">Events Logged Today</div>
          </div>
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-3xl font-bold text-green-700 mb-1">89</div>
            <div className="text-xs text-green-600">Active Users (24h)</div>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-3xl font-bold text-[#001A4D] mb-1">34.2 GB</div>
            <div className="text-xs text-gray-500">Total Log Size</div>
          </div>
        </div>
      </div>
    </div>
  );
}
