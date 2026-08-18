import { AlertTriangle, Plus, Edit2, Trash2, ShieldAlert } from 'lucide-react';
import { formatCurrency } from '../../../utils/currency';

interface FinePenaltyRulesProps {
  onUnsavedChange: () => void;
}

export default function FinePenaltyRules({ onUnsavedChange }: FinePenaltyRulesProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Fine & Penalty Rules</h2>
          <p className="text-sm text-gray-500 mt-1">Configure violation rules and penalty amounts</p>
        </div>
        <button className="px-6 py-2.5 bg-[#0E4EBD] text-white rounded-lg font-medium hover:bg-[#0E4EBD]/90 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Active Fine Rules</h3>
        <div className="space-y-2">
          {[
            { violation: 'Late Liquidation Submission', amount: 500, per: 'day', max: 5000, severity: 'medium' },
            { violation: 'Unauthorized Event', amount: 10000, per: 'incident', max: null, severity: 'high' },
            { violation: 'Missing Attendance Report', amount: 300, per: 'event', max: 2000, severity: 'low' },
            { violation: 'Budget Overspending (>20%)', amount: 2000, per: 'event', max: 10000, severity: 'high' },
          ].map((rule, index) => (
            <div key={index} className={`p-4 border-2 rounded-lg ${
              rule.severity === 'high' ? 'border-red-200 bg-red-50' :
              rule.severity === 'medium' ? 'border-amber-200 bg-amber-50' :
              'border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <AlertTriangle className={`w-5 h-5 ${
                    rule.severity === 'high' ? 'text-red-600' :
                    rule.severity === 'medium' ? 'text-amber-600' :
                    'text-gray-600'
                  }`} />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{rule.violation}</div>
                    <div className="text-xs text-gray-500">
                      {formatCurrency(rule.amount)} per {rule.per}
                      {rule.max && ` (max ${formatCurrency(rule.max)})`}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    rule.severity === 'high' ? 'bg-red-100 text-red-700' :
                    rule.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {rule.severity === 'high' ? 'High' :
                     rule.severity === 'medium' ? 'Medium' :
                     'Low'}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={onUnsavedChange} className="p-2 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={onUnsavedChange} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Penalty Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Grace Period Before Fine Applies (days)
            </label>
            <input
              type="number"
              defaultValue={3}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-200">
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Auto-apply fines when deadline is missed</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Send warning notification before applying fine</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Allow fine appeals and waivers</span>
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
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Outstanding Fines</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-3xl font-bold text-red-700 mb-1">₱12,500.00</div>
            <div className="text-xs text-red-600">Total Outstanding</div>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-3xl font-bold text-amber-700 mb-1">8</div>
            <div className="text-xs text-amber-600">Organizations Affected</div>
          </div>
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-3xl font-bold text-green-700 mb-1">₱45,000.00</div>
            <div className="text-xs text-green-600">Collected This Semester</div>
          </div>
        </div>
      </div>
    </div>
  );
}
