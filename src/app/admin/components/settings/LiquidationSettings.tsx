import { Receipt, Upload, AlertCircle } from 'lucide-react';

interface LiquidationSettingsProps {
  onUnsavedChange: () => void;
}

export default function LiquidationSettings({ onUnsavedChange }: LiquidationSettingsProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Liquidation Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure financial liquidation requirements and approval workflows</p>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Liquidation Rules</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Liquidation Deadline After Event (days)
            </label>
            <input
              type="number"
              defaultValue={7}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">Organizations must submit liquidation reports within this period</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Variance Tolerance Percentage (%)
            </label>
            <input
              type="number"
              defaultValue={10}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">Acceptable variance between projected and actual expenses</p>
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-200">
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Require original receipts for expenses over ₱1,000.00</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Auto-flag reports with variance above tolerance</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Allow partial liquidation submissions</span>
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
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Required Documents</h3>
        <div className="space-y-2">
          {[
            { name: 'Official Receipts', required: true },
            { name: 'Budget vs Actual Report', required: true },
            { name: 'Bank Statements', required: true },
            { name: 'Attendance Sheet', required: false },
            { name: 'Event Photos', required: false },
          ].map((doc, index) => (
            <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Receipt className="w-4 h-4 text-[#0E4EBD]" />
                <span className="text-sm text-gray-700">{doc.name}</span>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                doc.required ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {doc.required ? 'Required' : 'Optional'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Approval Workflow</h3>
        <div className="space-y-3">
          {[
            { step: 1, role: 'Organization Treasurer', action: 'Prepares liquidation report' },
            { step: 2, role: 'Organization President', action: 'Reviews and approves' },
            { step: 3, role: 'Organization Adviser', action: 'Validates accuracy' },
            { step: 4, role: 'SAO Finance Officer', action: 'Final approval' },
          ].map((step) => (
            <div key={step.step} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
              <div className="w-8 h-8 bg-[#0E4EBD] text-white rounded-full flex items-center justify-center font-bold text-sm">
                {step.step}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{step.role}</div>
                <div className="text-xs text-gray-500">{step.action}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
