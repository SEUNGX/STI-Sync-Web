import { useState, useEffect, useMemo } from 'react';
import { Shield, Plus, Trash2, PieChart, Users, QrCode, X, Calculator, Lock, Wallet, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { EventFormData, BudgetLineItem } from '../../types/event.types';
import { formatCurrency, formatVariance } from '../../../../utils/currency';
import { useOrgLedger, useSaoLedger } from '../../../finance/hooks/useFinanceStream';

interface Step5Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
  isOfficer?: boolean;
  errors?: Record<string, string>;
}

export default function Step5Budget({ data, onUpdate, isOfficer, errors = {} }: Step5Props) {
  const [showPayables, setShowPayables] = useState(false);

  // Dynamic Theme Styling based on Officer vs Admin
  const accentBorder = 'border-[#0E4EBD]';
  const accentText = 'text-[#0E4EBD]';
  const accentBg = 'bg-[#0E4EBD]';
  const accentFocusRing = 'focus:ring-[#0E4EBD]';
  const accentGradient = 'from-[#001A4D] to-[#0E4EBD]';
  const pieStroke = '#0E4EBD';

  // Treasury balance stream
  const { data: orgLedgerData, loading: orgLedgerLoading } = useOrgLedger(data.hostingOrgId || null);
  const { data: saoLedgerData, loading: saoLedgerLoading } = useSaoLedger();

  const isClubEvent = isOfficer || (Boolean(data.hostingOrgId) && data.hostingOrgId !== 'sas');
  const ledger = isClubEvent ? orgLedgerData : saoLedgerData;
  const ledgerLoading = isClubEvent ? orgLedgerLoading : saoLedgerLoading;

  const availableTreasuryBalance = useMemo(() => {
    const totalIncome = ledger
      .filter((t) => String(t.type || '').toLowerCase() === 'income')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalExpenses = ledger
      .filter((t) => String(t.type || '').toLowerCase() === 'expense')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return Math.max(0, totalIncome - totalExpenses);
  }, [ledger]);

  // Sync available balance to formData for validation
  useEffect(() => {
    if (!ledgerLoading && data.maxAllowedBudget !== availableTreasuryBalance) {
      onUpdate({ maxAllowedBudget: availableTreasuryBalance });
    }
  }, [availableTreasuryBalance, ledgerLoading]);

  const budgetItems = data.budgetItems || [];

  const updateField = (field: keyof EventFormData, value: any) => {
    onUpdate({ [field]: value });
  };

  const addBudgetItem = () => {
    const newItem: BudgetLineItem = { id: Date.now().toString(), item: '', description: '', quantity: 1, unitCost: 0, approvedAmount: 0, status: 'approved' };
    updateField('budgetItems', [...budgetItems, newItem]);
  };

  const removeBudgetItem = (id: string) => {
    updateField('budgetItems', budgetItems.filter(i => i.id !== id));
  };

  const updateItem = (id: string, updates: Partial<BudgetLineItem>) => {
    updateField('budgetItems', budgetItems.map(i => {
      if (i.id === id) {
        const merged = { ...i, ...updates };
        merged.approvedAmount = (merged.quantity || 0) * (merged.unitCost || 0);
        return merged;
      }
      return i;
    }));
  };

  const totalProposed = budgetItems.reduce((sum, i) => sum + ((i.quantity || 0) * (i.unitCost || 0)), 0);
  const isOverBudget = totalProposed > availableTreasuryBalance && totalProposed > 0 && !ledgerLoading;

  // Sync total proposed budget to data
  useEffect(() => {
    if (data.totalApprovedBudget !== totalProposed || data.totalRequestedBudget !== totalProposed) {
      onUpdate({ totalApprovedBudget: totalProposed, totalRequestedBudget: totalProposed });
    }
  }, [totalProposed]);

  const participantCount = data.expectedParticipantCount || 0;
  const calculatedPerStudent = participantCount > 0 ? Math.ceil(totalProposed / participantCount) : 0;
  const amountPerStudent = data.adminFeeOverride !== undefined ? data.adminFeeOverride : calculatedPerStudent;
  const totalCollected = amountPerStudent * participantCount;
  const surplus = totalCollected - totalProposed;

  useEffect(() => {
    if (data.studentPayablesEnabled && data.adminFeeOverride === undefined) {
      onUpdate({ adminFeeOverride: calculatedPerStudent, totalExpectedCollection: calculatedPerStudent * participantCount });
    }
  }, [data.studentPayablesEnabled, calculatedPerStudent]);

  const handleAmountOverrideChange = (val: number) => {
    onUpdate({ adminFeeOverride: val, totalExpectedCollection: val * participantCount });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-6">

        {/* Top KPIs: Treasury Balance & Proposed Budget */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {isClubEvent ? 'Organization Treasury' : 'SAS Fund Balance'}
                </div>
                <div className="text-xl font-black text-gray-900">
                  {ledgerLoading ? 'Loading...' : formatCurrency(availableTreasuryBalance)}
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full uppercase">
              Available
            </span>
          </div>

          <div className={`p-4 bg-gradient-to-r ${accentGradient} rounded-xl text-white shadow-xs flex items-center justify-between`}>
            <div>
              <div className="text-xs text-white/70 uppercase tracking-wider font-semibold">Total Proposed Budget</div>
              <div className="text-xl font-black text-[#FFC107]">{formatCurrency(totalProposed)}</div>
            </div>
            <span className={`px-2.5 py-1 font-bold text-[10px] rounded-full uppercase ${
              totalProposed === 0 ? 'bg-white/20 text-white' : isOverBudget ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-400 text-emerald-950'
            }`}>
              {totalProposed === 0 ? 'Zero Budget' : isOverBudget ? 'Exceeded' : 'Within Budget'}
            </span>
          </div>
        </div>

        {/* Over Budget Alert */}
        {isOverBudget && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-red-900">Budget Limit Exceeded</h4>
              <p className="text-xs text-red-800 mt-0.5">
                The total proposed budget (<strong>{formatCurrency(totalProposed)}</strong>) exceeds the available treasury balance of <strong>{formatCurrency(availableTreasuryBalance)}</strong>. Please adjust line items before proceeding.
              </p>
            </div>
          </div>
        )}

        {/* Budget Table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className={`border-l-4 ${accentBorder} pl-3`}>
                <h3 className="text-[#001A4D] font-bold text-base">Proposed Line Items Breakdown</h3>
              </div>
              <p className="text-xs text-gray-500 pl-4 mt-0.5">
                Optional: If your event requires no funding, you can leave line items empty (no financial liquidation required).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-gray-100 rounded-lg p-1 mr-2">
                <span className="text-sm text-gray-700 mr-2 ml-1">Payables:</span>
                <button
                  type="button"
                  onClick={() => updateField('studentPayablesEnabled', false)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${!data.studentPayablesEnabled ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  None
                </button>
                <button
                  type="button"
                  onClick={() => updateField('studentPayablesEnabled', true)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${data.studentPayablesEnabled ? `bg-white shadow ${accentText}` : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Required
                </button>
              </div>

              {data.studentPayablesEnabled && (
                <button
                  type="button"
                  onClick={() => setShowPayables(true)}
                  className="px-4 py-2 bg-[#FFC107] text-[#001A4D] rounded-lg text-sm font-bold hover:bg-[#FFD41C] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Users className="w-4 h-4" /> Config Payables
                </button>
              )}
              
              <button
                type="button"
                onClick={addBudgetItem}
                className="px-4 py-2 bg-[#1E70E8] text-white rounded-lg text-sm font-medium hover:bg-[#0E4EBD] flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>
          </div>

          {budgetItems.length === 0 ? (
            <div className="p-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-[#0E4EBD] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">Zero-Budget Event (Optional)</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                No budget line items proposed. This event will not require treasury fund disbursement or post-event financial liquidation.
              </p>
              <button
                type="button"
                onClick={addBudgetItem}
                className="mt-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Budget Item
              </button>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-700 w-[25%]">Item Name / Category</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-700 w-[30%]">Description</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-700 w-[12%]">Quantity</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-700 w-[18%]">Estimated Unit Cost</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-700 w-[15%]">Total Proposed</th>
                      <th className="px-3 py-2.5 w-[30px]" />
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {budgetItems.map((item, idx) => {
                      const total = (item.quantity || 0) * (item.unitCost || 0);
                      const itemErr = errors[`budget_${idx}_item`];
                      const qtyErr = errors[`budget_${idx}_quantity`];
                      const costErr = errors[`budget_${idx}_unitCost`];

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              list={`item-suggestions-${item.id}`}
                              placeholder="e.g. Catering / Food"
                              value={item.item || ''}
                              onChange={(e) => updateItem(item.id, { item: e.target.value })}
                              className={`w-full px-2 py-1.5 border rounded text-xs focus:ring-2 focus:border-transparent transition-colors ${
                                itemErr
                                  ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                                  : `border-gray-300 ${accentFocusRing}`
                              }`}
                            />
                            {itemErr && (
                              <p className="text-[10px] text-red-600 mt-0.5 font-medium">{itemErr}</p>
                            )}
                            <datalist id={`item-suggestions-${item.id}`}>
                              <option>Venue & Facilities</option>
                              <option>Materials & Printing</option>
                              <option>Food & Catering</option>
                              <option>Honorarium</option>
                              <option>Transportation</option>
                              <option>Equipment Rental</option>
                              <option>Miscellaneous</option>
                            </datalist>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              placeholder="Detailed description..."
                              value={item.description || ''}
                              onChange={(e) => updateItem(item.id, { description: e.target.value })}
                              className={`w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 ${accentFocusRing} focus:border-transparent`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              placeholder="1"
                              min="1"
                              value={item.quantity || ''}
                              onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })}
                              className={`w-full px-2 py-1.5 border rounded text-xs focus:ring-2 focus:border-transparent transition-colors ${
                                qtyErr
                                  ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                                  : `border-gray-300 ${accentFocusRing}`
                              }`}
                            />
                            {qtyErr && (
                              <p className="text-[10px] text-red-600 mt-0.5 font-medium">{qtyErr}</p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              placeholder="0"
                              min="0"
                              value={item.unitCost || ''}
                              onChange={(e) => updateItem(item.id, { unitCost: Number(e.target.value) })}
                              className={`w-full px-2 py-1.5 border rounded text-xs focus:ring-2 focus:border-transparent transition-colors ${
                                costErr
                                  ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                                  : `border-gray-300 ${accentFocusRing}`
                              }`}
                            />
                            {costErr && (
                              <p className="text-[10px] text-red-600 mt-0.5 font-medium">{costErr}</p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className={`text-xs font-bold ${accentText}`}>{formatCurrency(total)}</div>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeBudgetItem(item.id)}
                              className="text-red-600 hover:text-red-700 p-1 cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <div className="mt-3 p-3 bg-[#001A4D]/5 border border-[#001A4D]/20 rounded-lg flex items-center justify-between">
            <div>
              <span className="font-bold text-[#001A4D]">Total Overall Proposed Budget</span>
              <p className="text-xs text-gray-500">Sum of all proposed line items for this event</p>
            </div>
            <span className={`text-2xl font-black ${accentText}`}>{formatCurrency(totalProposed)}</span>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="sticky top-0 h-fit">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <PieChart className={`w-5 h-5 ${accentText}`} />
            Proposed Budget Summary
          </h4>
          <div className="space-y-4">
            <div className="relative aspect-square max-w-[180px] mx-auto">
              <svg viewBox="0 0 100 100" className="transform -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#E5E7EB" strokeWidth="20" />
                <circle cx="50" cy="50" r="40" fill="none" stroke={pieStroke} strokeWidth="20"
                  strokeDasharray={`${totalProposed > 0 ? 251.2 : 0} 251.2`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-lg font-bold text-gray-900">{formatCurrency(totalProposed)}</div>
                <div className="text-xs text-gray-500 font-medium">Proposed Total</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${accentBg}`} />
                  <span className="text-sm text-gray-700 font-medium">Proposed Budget</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">{formatCurrency(totalProposed)}</div>
                  <div className="text-xs text-gray-500">100%</div>
                </div>
              </div>
            </div>

            <div className={`p-3 bg-gradient-to-br ${accentGradient} rounded-lg text-center shadow-xs`}>
              <Shield className="w-6 h-6 text-[#FFC107] mx-auto mb-1" />
              <div className="text-white text-xs font-bold mb-1">Budget Authority Seal</div>
              <div className="text-white/80 text-xs">Auto-applied to all exported financial documents</div>
            </div>
          </div>
        </div>
      </div>

      {/* Student Payables Modal */}
      {showPayables && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowPayables(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">

            {/* Modal Header */}
            <div className={`bg-gradient-to-r ${accentGradient} px-6 py-5`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FFC107] rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#001A4D]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">Student Payables Config</h3>
                    <p className="text-white/70 text-xs">Budget-to-participant cost calculator</p>
                  </div>
                </div>
                <button onClick={() => setShowPayables(false)} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Event Budget + Participant Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-[#001A4D]/5 border border-[#001A4D]/20 rounded-xl">
                  <div className="text-xs text-gray-500 mb-1">Total Proposed Budget</div>
                  <div className="text-2xl font-bold text-[#001A4D]">{formatCurrency(totalProposed)}</div>
                  <div className="text-xs text-gray-500 mt-1">Sum of all proposed line items</div>
                </div>
                <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl">
                  <div className="text-xs text-gray-500 mb-1">Target Audience (Step 3)</div>
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      value={participantCount}
                      onChange={(e) => updateField('expectedParticipantCount', Math.max(1, Number(e.target.value)))}
                      className={`w-24 text-2xl font-bold ${accentText} bg-transparent border-b-2 ${accentBorder} focus:outline-none`}
                    />
                    <span className="text-xs text-gray-500 font-medium">students</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Matching active audience</div>
                </div>
              </div>

              {/* Calculation Display */}
              <div className="p-4 bg-gradient-to-br from-[#FFC107]/10 to-[#FFD41C]/5 border-2 border-[#FFC107] rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="w-5 h-5 text-[#001A4D]" />
                  <span className="font-bold text-[#001A4D]">Suggested Baseline Contribution Per Student</span>
                </div>

                <div className="flex items-center justify-center gap-4 py-3">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Total Budget</div>
                    <div className="text-xl font-bold text-[#001A4D]">{formatCurrency(totalProposed)}</div>
                  </div>
                  <div className="text-2xl text-gray-400 font-light">÷</div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Students</div>
                    <div className={`text-xl font-bold ${accentText}`}>{participantCount.toLocaleString()}</div>
                  </div>
                  <div className="text-2xl text-gray-400 font-light">=</div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Baseline Fee</div>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(calculatedPerStudent)}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Set amount per student */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Set Amount Per Student <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center border-2 border-[#001A4D] rounded-xl px-4 py-3 bg-white flex-1 focus-within:${accentBorder} transition-colors`}>
                      <span className="text-xl font-bold text-gray-500 mr-2">₱</span>
                      <input
                        type="number"
                        min="0"
                        value={amountPerStudent || ''}
                        onChange={(e) => handleAmountOverrideChange(Math.max(0, Number(e.target.value)))}
                        placeholder={calculatedPerStudent.toString()}
                        className="flex-1 text-2xl font-bold text-[#001A4D] focus:outline-none bg-transparent"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    You can set a higher amount to cover miscellaneous or buffer expenses.
                  </p>
                </div>

                {/* Summary card */}
                <div className="p-4 bg-[#001A4D] rounded-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div>
                        <div className="text-white/60 text-xs mb-0.5">Required Payment Per Student</div>
                        <div className="text-3xl font-bold text-[#FFC107]">{formatCurrency(amountPerStudent)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                        <div>
                          <div className="text-white/50 text-xs mb-0.5">Total Expected</div>
                          <div className="text-white font-bold">{formatCurrency(totalCollected)}</div>
                        </div>
                        <div>
                          <div className="text-white/50 text-xs mb-0.5">{surplus >= 0 ? 'Buffer' : 'Shortfall'}</div>
                          <div className={`font-bold ${surplus >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatVariance(surplus)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="w-14 h-14 bg-[#FFC107]/20 border-2 border-[#FFC107] rounded-xl flex items-center justify-center flex-shrink-0">
                      <QrCode className="w-7 h-7 text-[#FFC107]" />
                    </div>
                  </div>
                </div>

                {/* QR Lock Notice */}
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <Lock className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-red-800 text-sm mb-1">QR Attendance Ticket Lock Policy</div>
                    <p className="text-red-700 text-sm">
                      A student's QR code for attendance check-in will <strong>not be unlocked</strong> until their event payment has been confirmed. Unpaid students will be blocked from scanning in at the event gate.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowPayables(false)}
                  className="px-5 py-2.5 bg-[#001A4D] text-white rounded-lg text-sm font-bold hover:bg-[#001A4D]/90 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
