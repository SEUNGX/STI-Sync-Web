import { Users, Plus, Search, UserX, Mail } from 'lucide-react';

interface OfficerManagementProps {
  onUnsavedChange: () => void;
}

export default function OfficerManagement({ onUnsavedChange }: OfficerManagementProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Officer Management</h2>
          <p className="text-sm text-gray-500 mt-1">Manage organization officers and their assignments</p>
        </div>
        <button className="px-6 py-2.5 bg-[#0E4EBD] text-white rounded-lg font-medium hover:bg-[#0E4EBD]/90 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Officer
        </button>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search officers by name, organization, or position..."
              onChange={onUnsavedChange}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>
          <select className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]">
            <option>All Organizations</option>
            <option>JPIA</option>
            <option>CSS</option>
            <option>RCY</option>
          </select>
        </div>

        <div className="space-y-2">
          {[
            { name: 'Maria Santos', org: 'JPIA', position: 'President', email: 'maria.santos@sti.edu', status: 'active' },
            { name: 'Juan Dela Cruz', org: 'CSS', position: 'President', email: 'juan.delacruz@sti.edu', status: 'active' },
            { name: 'Ana Reyes', org: 'RCY', position: 'Vice President', email: 'ana.reyes@sti.edu', status: 'active' },
            { name: 'Carlos Garcia', org: 'JPIA', position: 'Treasurer', email: 'carlos.garcia@sti.edu', status: 'inactive' },
          ].map((officer, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] flex items-center justify-center text-white font-bold text-sm">
                  {officer.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{officer.name}</div>
                  <div className="text-xs text-gray-500">{officer.position} • {officer.org} • {officer.email}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  officer.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {officer.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button className="p-2 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded" title="Send email">
                  <Mail className="w-4 h-4" />
                </button>
                <button onClick={onUnsavedChange} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Remove officer">
                  <UserX className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Officer Assignment Rules</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <span className="text-sm text-gray-700">Require minimum GPA for officer positions</span>
            <button
              onClick={onUnsavedChange}
              className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
            >
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
            </button>
          </label>
          <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <span className="text-sm text-gray-700">Limit one officer position per student</span>
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
