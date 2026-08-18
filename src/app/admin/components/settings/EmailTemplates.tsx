import { Mail, Eye, Edit2, Copy } from 'lucide-react';

interface EmailTemplatesProps {
  onUnsavedChange: () => void;
}

export default function EmailTemplates({ onUnsavedChange }: EmailTemplatesProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Email Templates</h2>
        <p className="text-sm text-gray-500 mt-1">Customize email templates for system notifications</p>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Template Library</h3>
        <div className="space-y-2">
          {[
            { name: 'Event Approval Notification', category: 'Event Management', lastUsed: '2 hours ago', status: 'active' },
            { name: 'Event Rejection Notification', category: 'Event Management', lastUsed: '1 day ago', status: 'active' },
            { name: 'Attendance Reminder', category: 'Attendance', lastUsed: '3 hours ago', status: 'active' },
            { name: 'Certificate Available', category: 'Certificates', lastUsed: '5 days ago', status: 'active' },
            { name: 'Liquidation Deadline Reminder', category: 'Finance', lastUsed: '1 week ago', status: 'active' },
            { name: 'Organization Membership Confirmation', category: 'Membership', lastUsed: '3 days ago', status: 'inactive' },
          ].map((template, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-4 flex-1">
                <Mail className="w-5 h-5 text-[#0E4EBD]" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{template.name}</div>
                  <div className="text-xs text-gray-500">{template.category} • Last used {template.lastUsed}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  template.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {template.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button className="p-2 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded" title="Preview">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={onUnsavedChange} className="p-2 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded" title="Edit">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button className="p-2 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded" title="Duplicate">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Template Variables</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-900 mb-3 font-medium">Available Variables:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { var: '{{student_name}}', desc: 'Student full name' },
              { var: '{{event_title}}', desc: 'Event title' },
              { var: '{{event_date}}', desc: 'Event date and time' },
              { var: '{{organization_name}}', desc: 'Organization name' },
              { var: '{{venue}}', desc: 'Event venue' },
              { var: '{{certificate_link}}', desc: 'Certificate download link' },
            ].map((v, index) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-white rounded">
                <code className="text-[#0E4EBD] font-mono">{v.var}</code>
                <span className="text-gray-600">— {v.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Email Branding</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Header Logo URL
            </label>
            <input
              type="url"
              placeholder="https://example.com/logo.png"
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Primary Brand Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                defaultValue="#001A4D"
                onChange={onUnsavedChange}
                className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                defaultValue="#001A4D"
                onChange={onUnsavedChange}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Footer Text
            </label>
            <textarea
              defaultValue="STI College Ormoc - Student Affairs Office&#10;Ormoc City, Leyte&#10;© 2026 All Rights Reserved"
              onChange={onUnsavedChange}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
