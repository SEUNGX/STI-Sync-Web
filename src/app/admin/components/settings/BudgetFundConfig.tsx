import { Wallet, TrendingUp, Plus } from 'lucide-react';
import { formatCurrency } from '../../../utils/currency';

interface BudgetFundConfigProps {
  onUnsavedChange: () => void;
}

export default function BudgetFundConfig({ onUnsavedChange }: BudgetFundConfigProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Budget & Fund Configuration</h2>
        <p className="text-sm text-gray-500 mt-1">Manage organization budgets, fund allocation, and spending limits</p>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#001A4D]">Organization Budget Allocations</h3>
          <button className="px-6 py-2.5 bg-[#0E4EBD] text-white rounded-lg font-medium hover:bg-[#0E4EBD]/90 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Set Budget
          </button>
        </div>

        <div className="space-y-2">
          {[
            { org: 'JPIA', allocated: 120000, spent: 98000, events: 12 },
            { org: 'CSS', allocated: 150000, spent: 142000, events: 15 },
            { org: 'RCY', allocated: 80000, spent: 75000, events: 8 },
            { org: 'ACSS', allocated: 110000, spent: 95000, events: 10 },
          ].map((budget, index) => {
            const remaining = budget.allocated - budget.spent;
            const percentage = (budget.spent / budget.allocated) * 100;
            return (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900">{budget.org}</div>
                  <div className="text-sm text-gray-500">{budget.events} events</div>
                </div>
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{formatCurrency(budget.spent)} spent</span>
                      <span>{formatCurrency(remaining)} left</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          percentage > 90 ? 'bg-red-500' :
                          percentage > 75 ? 'bg-amber-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(budget.allocated)}</div>
                    <div className="text-xs text-gray-500">Total</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Budget Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Default Per-Organization Budget (₱)
            </label>
            <input
              type="number"
              defaultValue={100000}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Maximum Single Event Budget (₱)
            </label>
            <input
              type="number"
              defaultValue={25000}
              onChange={onUnsavedChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-200">
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Require budget approval for events over ₱10,000.00</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Alert when organization reaches 80% budget</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-[#001A4D] cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full translate-x-6"></div>
              </button>
            </label>
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">Allow budget rollover to next semester</span>
              <button
                onClick={onUnsavedChange}
                className="relative w-12 h-6 rounded-full bg-gray-300 cursor-pointer"
              >
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full"></div>
              </button>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Expense Categories</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: 'Venue Rental', limit: '₱15,000.00', color: '#001A4D' },
            { name: 'Food & Beverages', limit: '₱20,000.00', color: '#22C55E' },
            { name: 'Materials & Supplies', limit: '₱8,000.00', color: '#FFD41C' },
            { name: 'Marketing & Promotion', limit: '₱5,000.00', color: '#0E4EBD' },
          ].map((cat, index) => (
            <div key={index} className="p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                <span className="text-sm font-medium text-gray-900">{cat.name}</span>
              </div>
              <div className="text-xs text-gray-500">Max per event: {cat.limit}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
