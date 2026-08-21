import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Shield, Search, Building2 } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../../services/firebase';
import { useOrgOfficers, useOrganizationStream } from '../../../organizations';
import type { EventFormData, EventScanner } from '../../types/event.types';
import { useOfficerProfile } from '../../../../auth/hooks/useOfficerProfile';

interface Step4Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
  isOfficer?: boolean;
}

export default function Step4Staff({ data, onUpdate, isOfficer }: Step4Props) {
  const { profile: officerProfile } = useOfficerProfile();
  const showOfficerMode = isOfficer !== undefined ? isOfficer : !!officerProfile;

  // Dynamic Theme Styling based on Officer vs Admin
  const accentBorder = 'border-[#0E4EBD]';
  const accentText = 'text-[#0E4EBD]';
  const accentBg = 'bg-[#0E4EBD]';
  const accentFocusRing = 'focus:ring-[#0E4EBD]';
  const accentGradient = 'from-[#001A4D] to-[#0E4EBD]';

  // Stream active organizations for Admin org filter
  const { data: orgs, loading: orgsLoading } = useOrganizationStream();
  const activeOrgs = useMemo(() => orgs.filter(o => !o.archived), [orgs]);

  // Admin filter states
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('all');
  const [officerSearchQuery, setOfficerSearchQuery] = useState<string>('');

  // Target org ID for fetching officers
  const queryOrgId = showOfficerMode ? data.hostingOrgId : selectedOrgFilter;
  const { officers, loading: officersLoading } = useOrgOfficers(queryOrgId || (showOfficerMode ? '' : 'all'));

  const [advisers, setAdvisers] = useState<any[]>([]);

  // Fetch real SAS Adviser / Admin profiles from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'sas_admins'), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAdvisers(docs);
    }, (err) => {
      console.warn('Failed to stream sas_admins:', err);
    });
    return () => unsub();
  }, []);
  
  // Set default scanners if none exist
  useEffect(() => {
    if (!data.scanners || data.scanners.length === 0) {
      onUpdate({
        scanners: [{
          id: Date.now().toString(),
          officerName: '',
          officerUserId: null,
          organizationId: null,
          organizationName: null,
          fullAccess: false,
          canCheckIn: true,
          canCheckOut: true,
          canViewList: false,
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
      organizationId: null,
      organizationName: null,
      fullAccess: false,
      canCheckIn: true,
      canCheckOut: true,
      canViewList: false,
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
        canViewList: false, 
        canEditRecords: false 
      } : s
    ));
  };

  // Filter officers based on search query
  const filteredOfficers = useMemo(() => {
    const query = officerSearchQuery.trim().toLowerCase();
    if (!query) return officers;
    return officers.filter(o => {
      const name = (o.studentName || '').toLowerCase();
      const studentId = (o.studentId || '').toLowerCase();
      const email = (o.email || '').toLowerCase();
      const org = activeOrgs.find(orgItem => orgItem.id === o.organizationId);
      const orgName = (org?.name || '').toLowerCase();
      const orgAcronym = (org?.acronym || '').toLowerCase();
      return name.includes(query) || studentId.includes(query) || email.includes(query) || orgName.includes(query) || orgAcronym.includes(query);
    });
  }, [officers, officerSearchQuery, activeOrgs]);

  const activeAdviser = advisers.find(a => a.status === 'active') || advisers[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">

        {/* Section A — Event Core Team & SAS Adviser */}
        <div>
          <div className={`border-l-4 ${accentBorder} pl-3 mb-4`}>
            <h3 className="text-[#001A4D] font-bold text-base">Event Core Team</h3>
          </div>

          <div className="space-y-3">
            {/* SAS Supervisor banner */}
            <div className={`p-4 bg-gradient-to-br ${accentGradient} rounded-xl border-2 border-[#FFC107] text-white shadow-xs`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#FFC107]" />
                  <h4 className="font-bold text-white text-sm">SAS Event Supervisor</h4>
                </div>
                <span className="px-2 py-0.5 bg-[#FFC107] text-[#001A4D] text-xs rounded font-bold uppercase">
                  SAS Oversight
                </span>
              </div>

              <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg text-gray-900 shadow-xs">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${accentGradient} flex items-center justify-center text-white font-bold text-sm`}>
                  {activeAdviser?.fullName?.charAt(0) || 'S'}
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-sm">
                    {activeAdviser?.fullName || activeAdviser?.name || 'Student Affairs and Services (SAS)'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {activeAdviser?.email || 'sas.adviser@sti.edu'} • {activeAdviser?.role || 'SAS Administrator'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section B — Scanner Assignment */}
        {data.enableQRTickets === true || (data as any).enableQR === true ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className={`border-l-4 ${accentBorder} pl-3`}>
                <h3 className="text-[#001A4D] font-bold text-base">Scanner Assignment</h3>
              </div>
              <button
                onClick={addScanner}
                className="px-4 py-2 bg-[#1E70E8] text-white rounded-lg text-sm font-medium hover:bg-[#0E4EBD] flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Scanner
              </button>
            </div>

            {/* Admin Controls: Organization Filter & Officer Search */}
            {!showOfficerMode ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#001A4D] uppercase tracking-wider">
                  <Building2 className={`w-4 h-4 ${accentText}`} />
                  <span>Recruit Scanners from Student Organizations</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Select Organization */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Organization Scope
                    </label>
                    <select
                      value={selectedOrgFilter}
                      onChange={(e) => setSelectedOrgFilter(e.target.value)}
                      disabled={orgsLoading}
                      className={`w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-2 ${accentFocusRing} focus:border-transparent`}
                    >
                      <option value="all">🌐 All Student Organizations ({activeOrgs.length})</option>
                      {activeOrgs.map(org => (
                        <option key={org.id} value={org.id}>
                          {org.acronym ? `${org.acronym} — ${org.name}` : org.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Officer */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Filter Officer by Name / ID / Club
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search officer..."
                        value={officerSearchQuery}
                        onChange={(e) => setOfficerSearchQuery(e.target.value)}
                        className={`w-full pl-8 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 ${accentFocusRing} focus:border-transparent`}
                      />
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1">
                  <span>
                    Available active officers: <strong className="text-gray-800">{filteredOfficers.length}</strong>
                  </span>
                  {selectedOrgFilter !== 'all' && (
                    <button
                      onClick={() => setSelectedOrgFilter('all')}
                      className={`${accentText} hover:underline font-semibold cursor-pointer`}
                    >
                      Reset to All Organizations
                    </button>
                  )}
                </div>
              </div>
            ) : (
              !data.hostingOrgId && (
                <div className="p-3 mb-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">
                  Please verify your active club in Step 1 to assign scanners.
                </div>
              )
            )}

            <div className="space-y-4">
              {scanners.map((scanner, index) => {
                const assignedOrg = activeOrgs.find(o => o.id === scanner.organizationId);

                return (
                  <div key={scanner.id} className="p-4 border border-gray-200 rounded-xl bg-white shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#0E4EBD]/10 text-[#0E4EBD] text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <h4 className="font-semibold text-gray-900 text-sm">Scanner Officer {index + 1}</h4>
                        {scanner.organizationName && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-md font-medium border border-blue-200">
                            {assignedOrg?.acronym || scanner.organizationName}
                          </span>
                        )}
                      </div>
                      {scanners.length > 1 && (
                        <button
                          onClick={() => removeScanner(scanner.id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                          title="Remove Scanner"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Assign Officer <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={scanner.officerUserId || ''}
                        onChange={(e) => {
                          const selStr = e.target.value;
                          const officer = officers.find(o => o.studentId === selStr || (o as any).authUid === selStr || o.id === selStr);
                          const org = officer ? activeOrgs.find(o => o.id === officer.organizationId) : null;

                          updateScanner(scanner.id, { 
                            officerUserId: officer?.studentId || (officer as any)?.authUid || selStr, 
                            officerName: officer ? officer.studentName : '',
                            organizationId: officer ? officer.organizationId : null,
                            organizationName: org ? (org.acronym || org.name) : null,
                          });
                        }}
                        disabled={officersLoading}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 ${accentFocusRing} focus:border-transparent disabled:opacity-50`}
                      >
                        <option value="">
                          {officersLoading
                            ? 'Loading officers...'
                            : filteredOfficers.length === 0
                            ? 'No matching active officers found'
                            : 'Select officer from list...'}
                        </option>
                        {filteredOfficers.map(o => {
                          const val = o.studentId || (o as any).authUid || o.id;
                          const studentIdPart = o.studentId ? ` (${o.studentId})` : '';
                          const org = activeOrgs.find(orgItem => orgItem.id === o.organizationId);
                          const orgTag = org ? `[${org.acronym || org.name.slice(0, 15)}] ` : '';
                          const label = `${orgTag}${o.studentName || o.email || 'Unnamed Officer'}${studentIdPart}`;

                          return (
                            <option key={o.id || o.studentId} value={val}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Grant Full Admin Scanner Access */}
                    <div className="mb-3 flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-200 rounded-lg">
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                          <span>Grant Full Scanner Access</span>
                          <span className={`px-1.5 py-0.2 ${accentBg} text-white text-[10px] rounded font-bold`}>All Modes</span>
                        </div>
                        <div className="text-[11px] text-gray-600">Enables full check-in, check-out, and manual attendance entry</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleScannerFullAccess(scanner.id)}
                        className={`relative w-11 h-5.5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${scanner.fullAccess ? accentBg : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full transition-transform ${scanner.fullAccess ? 'translate-x-5.5' : ''}`} />
                      </button>
                    </div>

                    {/* Permissions */}
                    {!scanner.fullAccess && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-gray-700 mb-1">Scanner Permissions</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { key: 'canCheckIn', label: 'Check-in Attendees' },
                            { key: 'canCheckOut', label: 'Check-out Attendees' },
                          ].map((perm) => (
                            <label key={perm.key} className="flex items-center gap-2 px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={scanner[perm.key as keyof EventScanner] as boolean}
                                onChange={(e) => updateScanner(scanner.id, { [perm.key]: e.target.checked })}
                                className={`${accentText} ${accentFocusRing} rounded w-3.5 h-3.5`}
                              />
                              <span className="text-gray-700 font-medium">{perm.label}</span>
                            </label>
                          ))}
                        </div>

                        {/* Allow manual or flagged attendance */}
                        <label className="flex items-center gap-2 px-2.5 py-2 border border-[#FFC107]/40 bg-amber-50/70 rounded-lg hover:bg-amber-100/70 cursor-pointer text-xs mt-2">
                          <input
                            type="checkbox"
                            checked={scanner.allowManualAttendance}
                            onChange={(e) => updateScanner(scanner.id, { allowManualAttendance: e.target.checked })}
                            className="text-[#FFC107] focus:ring-[#FFC107] rounded w-3.5 h-3.5"
                          />
                          <span className="text-gray-800 font-medium">Allow Manual or Flagged Attendance Entry</span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 text-sm">
            <span className="font-semibold text-gray-800">QR Tickets & Scanner Assignment Disabled</span>
            <p className="text-xs text-gray-500 mt-1">To assign attendance scanners, enable "Enable QR Tickets" in Step 1 Event Settings.</p>
          </div>
        )}
      </div>

      {/* Right Panel — Team Hierarchy */}
      <div className="sticky top-0 h-fit">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
          <h4 className="font-bold text-gray-900 text-sm">Staff & Scanner Hierarchy</h4>
          
          <div className="space-y-3">
            <div className={`p-3 bg-gradient-to-br ${accentGradient} rounded-lg text-white text-center shadow-xs`}>
              <Shield className="w-5 h-5 mx-auto mb-1 text-[#FFC107]" />
              <div className="font-bold text-xs">
                {showOfficerMode ? 'Club Event Head' : 'SAS Event Adviser'}
              </div>
              <div className="text-[11px] opacity-80">
                {showOfficerMode ? 'Officer Supervisor' : 'Student Affairs and Services'}
              </div>
            </div>

            <div className="h-3 border-l-2 border-gray-300 mx-auto w-0" />

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-700 font-medium">Assigned Scanners</span>
                <span className="font-bold text-[#001A4D] text-xs px-2 py-0.5 bg-blue-100 rounded-full">
                  {scanners.filter(s => !!s.officerUserId || !!s.officerName).length} / {scanners.length}
                </span>
              </div>
            </div>
            
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
              {scanners.map((scanner, index) => (
                <div key={scanner.id} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-700 flex items-center justify-between bg-gray-50/50">
                  <span className="truncate max-w-[170px] font-medium">
                    {scanner.officerName || `Unassigned Scanner ${index + 1}`}
                  </span>
                  {scanner.organizationName && (
                    <span className={`text-[10px] px-1.5 py-0.5 ${showOfficerMode ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'} rounded font-semibold flex-shrink-0`}>
                      {scanner.organizationName}
                    </span>
                  )}
                </div>
              ))}
            </div>
            
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-500 text-center">
              Scanner activation codes will be generated automatically upon publishing.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
