import { useState, useEffect } from 'react';
import { Plus, Trash2, Shield } from 'lucide-react';
import { useOrgOfficers } from '../../../organizations';
import type { EventFormData, EventScanner } from '../../types/event.types';

interface Step4Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
}

export default function Step4Staff({ data, onUpdate }: Step4Props) {
  const { officers, loading: officersLoading } = useOrgOfficers(data.hostingOrgId);
  
  // Set default scanners if none exist
  useEffect(() => {
    if (!data.scanners || data.scanners.length === 0) {
      onUpdate({
        scanners: [{
          id: Date.now().toString(),
          officerName: '',
          officerUserId: null,
          fullAccess: false,
          canCheckIn: true,
          canCheckOut: true,
          canViewList: true,
          canEditRecords: false,
          allowManualAttendance: false
        }]
      });
    }
  }, []);

  const scanners = data.scanners || [];

  const updateField = (field: keyof EventFormData, value: any) => {
    onUpdate({ [field]: value });
  };

  const addScanner = () => {
    const newScanner: EventScanner = {
      id: Date.now().toString(),
      officerName: '',
      officerUserId: null,
      fullAccess: false,
      canCheckIn: true,
      canCheckOut: true,
      canViewList: true,
      canEditRecords: false,
      allowManualAttendance: false
    };
    updateField('scanners', [...scanners, newScanner]);
  };

  const removeScanner = (id: string) => {
    updateField('scanners', scanners.filter(s => s.id !== id));
  };

  const updateScanner = (id: string, updates: Partial<EventScanner>) => {
    updateField('scanners', scanners.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const toggleScannerFullAccess = (id: string) => {
    updateField('scanners', scanners.map(s =>
      s.id === id ? { 
        ...s, 
        fullAccess: !s.fullAccess, 
        canCheckIn: true, 
        canCheckOut: true, 
        canViewList: true, 
        canEditRecords: true 
      } : s
    ));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-6">

        {/* Section A — Event Core Team (Reduced to Supervisor Only) */}
        <div>
          <div className="border-l-4 border-[#83358E] pl-3 mb-4">
            <h3 className="text-[#001A4D] font-bold text-base">Event Core Team</h3>
          </div>

          <div className="space-y-3">
            {/* SAO Supervisor banner */}
            <div className="p-4 bg-gradient-to-br from-[#001A4D] to-[#83358E] rounded-lg border-2 border-[#FFC107]">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-[#FFC107]" />
                <h4 className="font-bold text-white">SAO Event Supervisor</h4>
                <span className="px-2 py-0.5 bg-[#FFC107] text-[#001A4D] text-xs rounded font-medium">Admin Role</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-lg">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0E4EBD] to-[#83358E] flex items-center justify-center text-white font-bold text-sm">SAO</div>
                <div>
                  <div className="font-medium text-gray-900">SAO Adviser</div>
                  <div className="text-xs text-gray-500">System Administrator • Full Oversight</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section B — Scanner Assignment */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="border-l-4 border-[#83358E] pl-3">
              <h3 className="text-[#001A4D] font-bold text-base">Scanner Assignment</h3>
            </div>
            <button
              onClick={addScanner}
              className="px-4 py-2 bg-[#1E70E8] text-white rounded-lg text-sm font-medium hover:bg-[#0E4EBD] flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Scanner
            </button>
          </div>

          {!data.hostingOrgId && (
            <div className="p-3 mb-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">
              Please select a Hosting Organization in Step 1 first to assign scanners.
            </div>
          )}

          <div className="space-y-3">
            {scanners.map((scanner, index) => (
              <div key={scanner.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Scanner Officer {index + 1}</h4>
                  {scanners.length > 1 && (
                    <button onClick={() => removeScanner(scanner.id)} className="text-red-600 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Assign Officer <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={scanner.officerUserId || ''}
                    onChange={(e) => {
                      const selStr = e.target.value;
                      const officer = officers.find(o => o.studentId === selStr);
                      updateScanner(scanner.id, { 
                        officerUserId: selStr, 
                        officerName: officer ? officer.studentName : '' 
                      });
                    }}
                    disabled={officersLoading || !data.hostingOrgId}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] focus:border-transparent disabled:opacity-50"
                  >
                    <option value="">
                      {officersLoading
                        ? 'Loading officers...'
                        : officers.length === 0
                        ? 'No active officers found for this organization'
                        : 'Select officer...'}
                    </option>
                    {officers.map(o => {
                      const val = o.studentId || o.id;
                      const label = o.studentName || o.email || 'Unnamed Officer';
                      return (
                        <option key={o.id || o.studentId} value={val}>
                          {label} {o.studentId ? `(${o.studentId})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Grant Full Admin Scanner Access */}
                <div className="mb-3 flex items-center gap-3 p-3 bg-[#83358E]/5 border border-[#83358E] rounded">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      Grant Full Admin Scanner Access
                      <span className="px-2 py-0.5 bg-[#83358E] text-white text-xs rounded ml-2">Admin</span>
                    </div>
                    <div className="text-xs text-gray-600">Override all permissions to full access</div>
                  </div>
                  <button
                    onClick={() => toggleScannerFullAccess(scanner.id)}
                    className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${scanner.fullAccess ? 'bg-[#83358E]' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${scanner.fullAccess ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                {/* Permissions */}
                {!scanner.fullAccess && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-700 mb-2">Scanner Permissions</div>
                    {[
                      { key: 'canCheckIn', label: 'Check-in Attendees' },
                      { key: 'canCheckOut', label: 'Check-out Attendees' },
                      { key: 'canViewList', label: 'View Attendance List' },
                      { key: 'canEditRecords', label: 'Edit Attendance Records' },
                    ].map((perm) => (
                      <label key={perm.key} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scanner[perm.key as keyof EventScanner] as boolean}
                          onChange={(e) => updateScanner(scanner.id, { [perm.key]: e.target.checked })}
                          className="text-[#83358E] focus:ring-[#83358E] rounded"
                        />
                        <span className="text-sm text-gray-700">{perm.label}</span>
                      </label>
                    ))}

                    {/* Allow manual or flagged attendance */}
                    <label className="flex items-center gap-2 px-3 py-2 border border-[#FFC107]/40 bg-amber-50 rounded hover:bg-amber-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scanner.allowManualAttendance}
                        onChange={(e) => updateScanner(scanner.id, { allowManualAttendance: e.target.checked })}
                        className="text-[#FFC107] focus:ring-[#FFC107] rounded"
                      />
                      <span className="text-sm text-gray-700">Allow Manual or Flagged Attendance</span>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Team Hierarchy */}
      <div className="sticky top-0 h-fit">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h4 className="font-bold text-gray-900 mb-3">Team Hierarchy</h4>
          <div className="space-y-3">
            <div className="p-3 bg-gradient-to-br from-[#001A4D] to-[#83358E] rounded-lg text-white text-center">
              <Shield className="w-6 h-6 mx-auto mb-1 text-[#FFC107]" />
              <div className="font-bold text-sm">SAO Adviser</div>
              <div className="text-xs opacity-80">System Administrator</div>
            </div>

            <div className="h-4 border-l-2 border-gray-300 mx-auto w-0" />

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Scanner Officers</span>
                <span className="font-bold text-[#001A4D]">{scanners.length}</span>
              </div>
            </div>
            
            <div className="space-y-2 mt-2">
              {scanners.map((scanner, index) => (
                <div key={scanner.id} className="p-2 border border-gray-200 rounded text-sm text-gray-700">
                  {scanner.officerName || `Unassigned Scanner ${index + 1}`}
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 text-center">
              Scanner activation code will be automatically generated upon publishing.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
