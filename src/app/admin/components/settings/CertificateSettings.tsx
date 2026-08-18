import { Award, Upload, Eye, Download } from 'lucide-react';

interface CertificateSettingsProps {
  onUnsavedChange: () => void;
}

export default function CertificateSettings({ onUnsavedChange }: CertificateSettingsProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Certificate Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure certificate templates and issuance rules</p>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Certificate Templates</h3>
        <div className="space-y-3">
          {[
            { name: 'Attendance Certificate', type: 'attendance', active: true, issued: 245 },
            { name: 'Participation Certificate', type: 'participation', active: true, issued: 189 },
            { name: 'Speaker Certificate', type: 'speaker', active: true, issued: 34 },
            { name: 'Organizer Certificate', type: 'organizer', active: false, issued: 12 },
          ].map((template, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-4 flex-1">
                <Award className="w-5 h-5 text-[#FFD41C]" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{template.name}</div>
                  <div className="text-xs text-gray-500">{template.issued} certificates issued</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  template.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {template.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button className="p-2 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded" title="Preview">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={onUnsavedChange} className="p-2 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded" title="Edit">
                  <Upload className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button className="mt-4 px-6 py-2.5 bg-[#0E4EBD] text-white rounded-lg font-medium hover:bg-[#0E4EBD]/90 flex items-center gap-2 w-full justify-center">
          <Upload className="w-4 h-4" />
          Upload New Template
        </button>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Issuance Rules</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Minimum Attendance for Certificates (%)
            </label>
            <input
              type="number"
              defaultValue={75}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-200">
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Require event evaluation completion before certificate release</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Auto-generate certificates after event ends</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-gray-300 cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Include QR code verification on certificates</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Signature Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Default Signatory Name
            </label>
            <input
              type="text"
              defaultValue="Ms. Riselle Mae B. Lucanas"
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Default Signatory Title
            </label>
            <input
              type="text"
              defaultValue="Student Affairs Adviser, STI College Ormoc"
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Upload Signature Image
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#0E4EBD] hover:bg-blue-50/20 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
              <p className="text-xs text-gray-500">PNG, JPG up to 2MB (Transparent PNG recommended)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
