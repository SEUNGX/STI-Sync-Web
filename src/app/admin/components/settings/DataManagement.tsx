import { Database, Download, Upload, Trash2, AlertTriangle } from 'lucide-react';

interface DataManagementProps {
  onUnsavedChange: () => void;
}

export default function DataManagement({ onUnsavedChange }: DataManagementProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Data Management</h2>
        <p className="text-sm text-gray-500 mt-1">Manage system data, backups, and exports</p>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Database Backups</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Automatic Backup Frequency
            </label>
            <select
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            >
              <option>Daily</option>
              <option>Every 12 hours</option>
              <option>Every 6 hours</option>
              <option>Weekly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Backup Retention Period (days)
            </label>
            <input
              type="number"
              defaultValue={30}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <button className="w-full px-6 py-3 bg-[#0E4EBD] text-white rounded-lg font-medium hover:bg-[#0E4EBD]/90 flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            Create Backup Now
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Recent Backups</h3>
        <div className="space-y-2">
          {[
            { date: 'May 31, 2026 - 3:00 AM', size: '245 MB', status: 'success' },
            { date: 'May 30, 2026 - 3:00 AM', size: '243 MB', status: 'success' },
            { date: 'May 29, 2026 - 3:00 AM', size: '241 MB', status: 'success' },
            { date: 'May 28, 2026 - 3:00 AM', size: '238 MB', status: 'failed' },
          ].map((backup, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-4 flex-1">
                <Database className={`w-5 h-5 ${
                  backup.status === 'success' ? 'text-green-600' : 'text-red-600'
                }`} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{backup.date}</div>
                  <div className="text-xs text-gray-500">{backup.size}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  backup.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {backup.status === 'success' ? 'Success' : 'Failed'}
                </span>
              </div>
              {backup.status === 'success' && (
                <button className="ml-4 p-2 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded" title="Download">
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Data Export</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: 'Events Data', format: 'CSV, Excel', size: '2.4 MB' },
            { name: 'Student Registry', format: 'CSV, Excel', size: '5.8 MB' },
            { name: 'Attendance Records', format: 'CSV, Excel', size: '12.1 MB' },
            { name: 'Financial Reports', format: 'PDF, Excel', size: '3.2 MB' },
          ].map((export_item, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="font-medium text-gray-900 mb-1">{export_item.name}</div>
              <div className="text-xs text-gray-500 mb-3">{export_item.format} • {export_item.size}</div>
              <button className="w-full px-4 py-2 text-[#0E4EBD] border border-[#0E4EBD] rounded-lg text-sm font-medium hover:bg-[#0E4EBD]/5 flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Data Import</h3>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#0E4EBD] hover:bg-blue-50/20 transition-colors cursor-pointer">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <div className="text-sm text-gray-700 mb-2">Click to upload or drag and drop</div>
          <div className="text-xs text-gray-500">Supported formats: CSV, Excel (.xlsx)</div>
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-red-700 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h3>
        <div className="space-y-3">
          <div className="p-4 border-2 border-red-200 bg-red-50 rounded-lg">
            <div className="font-medium text-red-900 mb-2">Clear All Event Data</div>
            <div className="text-sm text-red-700 mb-3">Permanently delete all events and related records</div>
            <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
              Clear Events
            </button>
          </div>
          <div className="p-4 border-2 border-red-200 bg-red-50 rounded-lg">
            <div className="font-medium text-red-900 mb-2">Reset Database</div>
            <div className="text-sm text-red-700 mb-3">Restore database to factory settings (cannot be undone)</div>
            <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
              Reset Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
