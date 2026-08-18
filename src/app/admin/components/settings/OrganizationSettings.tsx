import { useState, useEffect } from 'react';
import { Building, Plus, Edit2, Trash2, Users, Shield, X, AlertTriangle, Archive, RotateCcw } from 'lucide-react';
import {
  useOrganizationTypes,
  createOrganizationType,
  updateOrganizationType,
  deleteOrganizationType,
  useOrganizationRules,
  updateOrganizationRules,
  type OrganizationTypeDocument
} from '../../../modules/organizations';

interface OrganizationSettingsProps {
  onUnsavedChange: () => void;
}

type ModalState =
  | { type: 'none' }
  | { type: 'add-org-type' }
  | { type: 'edit-org-type'; item: OrganizationTypeDocument }
  | { type: 'archive-org-type'; item: OrganizationTypeDocument }
  | { type: 'restore-org-type'; item: OrganizationTypeDocument }
  | { type: 'delete-org-type'; item: OrganizationTypeDocument };

function ConfirmModal({ type, name, onConfirm, onClose, deleteText, onDeleteTextChange, isSaving }: {
  type: 'archive' | 'restore' | 'delete';
  name: string;
  onConfirm: () => void;
  onClose: () => void;
  deleteText?: string;
  onDeleteTextChange?: (v: string) => void;
  isSaving: boolean;
}) {
  const cfg = {
    archive: { header: 'bg-gradient-to-r from-amber-500 to-amber-600', title: 'Archive', btn: 'bg-amber-500 hover:bg-amber-600', label: 'Archive' },
    restore: { header: 'bg-gradient-to-r from-green-500 to-green-600', title: 'Restore', btn: 'bg-green-600 hover:bg-green-700', label: 'Restore' },
    delete: { header: 'bg-gradient-to-r from-red-500 to-orange-600', title: 'Permanently Delete', btn: 'bg-red-600 hover:bg-red-700', label: 'Delete Forever' },
  }[type];

  return (
    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
      <div className={`${cfg.header} px-6 py-4 flex items-center justify-between`}>
        <h3 className="text-white font-bold text-lg">{cfg.title}</h3>
        <button onClick={onClose} disabled={isSaving} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-50"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-6 space-y-4">
        {type === 'delete' && (
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">Permanently delete <span className="font-bold">{name}</span>? This cannot be undone.</p>
          </div>
        )}
        {type !== 'delete' && (
          <p className="text-sm text-gray-700">{type === 'archive' ? 'Archive' : 'Restore'} <span className="font-bold">{name}</span>?{type === 'archive' ? ' It can be restored later.' : ''}</p>
        )}
        {type === 'delete' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type <span className="font-mono font-bold">DELETE</span> to confirm</label>
            <input type="text" value={deleteText} onChange={e => onDeleteTextChange?.(e.target.value)} disabled={isSaving}
              className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 font-mono disabled:opacity-50" />
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={isSaving} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={isSaving || (type === 'delete' && deleteText !== 'DELETE')}
            className={`flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-40 ${cfg.btn}`}>
            {isSaving ? 'Processing...' : cfg.label}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrganizationSettings({ onUnsavedChange }: OrganizationSettingsProps) {
  const { data: organizationTypes, loading: loadingTypes } = useOrganizationTypes();
  const { data: rulesData } = useOrganizationRules();

  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [isSaving, setIsSaving] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  
  const [orgTypeForm, setOrgTypeForm] = useState({ name: '', color: '#0E4EBD' });

  const [rulesForm, setRulesForm] = useState({ minMembers: 15, minOfficers: 7 });
  const [rulesSaved, setRulesSaved] = useState({ minMembers: 15, minOfficers: 7 });
  
  const hasRulesChanged = rulesForm.minMembers !== rulesSaved.minMembers || rulesForm.minOfficers !== rulesSaved.minOfficers;

  useEffect(() => {
    if (rulesData) {
      setRulesForm({ minMembers: rulesData.minMembersRequired, minOfficers: rulesData.minOfficersRequired });
      setRulesSaved({ minMembers: rulesData.minMembersRequired, minOfficers: rulesData.minOfficersRequired });
    }
  }, [rulesData]);

  const close = () => { if (!isSaving) { setModal({ type: 'none' }); setDeleteText(''); } };

  const handleSaveOrgType = async () => {
    setIsSaving(true);
    try {
      if (modal.type === 'add-org-type') {
        await createOrganizationType({ name: orgTypeForm.name, color: orgTypeForm.color, archived: false });
      } else if (modal.type === 'edit-org-type') {
        await updateOrganizationType(modal.item.id, { name: orgTypeForm.name, color: orgTypeForm.color });
      }
      onUnsavedChange();
      close();
    } catch (e) {
      console.error(e);
      alert('Failed to save organization type.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAction = async (actionFn: () => Promise<void>, isDelete = false, typeId = '') => {
    if (isDelete) {
      // Validation: Check if type is used by active organization
      // Note: we're using mock org data here right now, so we will bypass for now
      // In a real scenario we would check the active organizations here
    }

    setIsSaving(true);
    try {
      await actionFn();
      onUnsavedChange();
      close();
    } catch (e) {
      console.error(e);
      alert('Operation failed.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Organization Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Manage student organizations, types, and registration rules</p>
        </div>
      </div>

      {/* Active Organizations */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#001A4D] mb-4">Active Organizations</h3>

        <div className="space-y-2">
          {[
            { name: 'Junior Philippine Institute of Accountants', acronym: 'JPIA', type: 'Academic', members: 156, officers: 12, status: 'active' },
            { name: 'Computer Studies Society', acronym: 'CSS', type: 'Academic', members: 203, officers: 15, status: 'active' },
            { name: 'Red Cross Youth Council', acronym: 'RCY', type: 'Civic', members: 89, officers: 10, status: 'active' }
          ].map((org, i) => (
            <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:border-[#0E4EBD]/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {org.acronym.slice(0,2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{org.acronym}</span>
                    <span className="text-sm text-gray-500">{org.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1"><Building className="w-3 h-3" /> {org.type}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {org.members} members</span>
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {org.officers} officers</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Active</span>
                <button className="p-2 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                <button className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Organization Types */}
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#001A4D]">Organization Types</h3>
            <button 
              onClick={() => { setOrgTypeForm({ name: '', color: '#0E4EBD' }); setModal({ type: 'add-org-type' }); }}
              className="text-sm text-[#0E4EBD] font-medium hover:underline flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add Type
            </button>
          </div>
          {loadingTypes ? (
            <div className="text-sm text-gray-500 py-4">Loading organization types...</div>
          ) : organizationTypes.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-300 rounded-lg">
              No organization types defined yet.
            </div>
          ) : (
            <div className="space-y-3">
              {organizationTypes.map((type) => (
                <div 
                  key={type.id} 
                  className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${type.archived ? 'bg-gray-50 border-gray-200 opacity-60' : 'border-gray-100 hover:border-blue-300'}`}
                  onMouseEnter={() => setHoveredRow(type.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }}></div>
                    <span className={`font-medium ${type.archived ? 'text-gray-500 line-through' : 'text-gray-700'}`}>{type.name}</span>
                  </div>
                  <div className={`flex items-center gap-1 transition-opacity ${hoveredRow === type.id ? 'opacity-100' : 'opacity-0'}`}>
                    {!type.archived ? (
                      <>
                        <button onClick={() => { setOrgTypeForm({ name: type.name, color: type.color }); setModal({ type: 'edit-org-type', item: type }); }} className="p-1.5 rounded hover:bg-blue-50 text-[#1E70E8]"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setModal({ type: 'archive-org-type', item: type })} className="p-1.5 rounded hover:bg-amber-50 text-amber-500"><Archive className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setModal({ type: 'restore-org-type', item: type })} className="p-1.5 rounded hover:bg-green-50 text-green-600"><RotateCcw className="w-4 h-4" /></button>
                        <button onClick={() => setModal({ type: 'delete-org-type', item: type })} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Registration Rules */}
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
          <h3 className="text-lg font-bold text-[#001A4D] mb-4">Registration Rules</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Minimum Members Required
            </label>
            <input
              type="number"
              value={rulesForm.minMembers}
              onChange={(e) => {
                setRulesForm({ ...rulesForm, minMembers: Number(e.target.value) });
                onUnsavedChange();
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">Organizations must have at least this many members to register</p>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Minimum Officers Required
            </label>
            <input
              type="number"
              value={rulesForm.minOfficers}
              onChange={(e) => {
                setRulesForm({ ...rulesForm, minOfficers: Number(e.target.value) });
                onUnsavedChange();
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
            />
            <p className="text-xs text-gray-500 mt-1">Number of officer positions required</p>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={async () => {
                setIsSaving(true);
                try {
                  await updateOrganizationRules({
                    minMembersRequired: rulesForm.minMembers,
                    minOfficersRequired: rulesForm.minOfficers
                  });
                  setRulesSaved(rulesForm);
                  alert('Rules saved successfully');
                  onUnsavedChange();
                } catch (e) {
                  console.error(e);
                  alert('Failed to save rules');
                } finally {
                  setIsSaving(false);
                }
              }}
              disabled={isSaving || !hasRulesChanged}
              className="px-6 py-2 bg-[#001A4D] text-white rounded-lg text-sm font-medium hover:bg-[#001A4D]/90 disabled:opacity-50 disabled:bg-gray-400"
            >
              {isSaving ? 'Saving...' : 'Save Rules'}
            </button>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {modal.type !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={close} />
          
          {/* ADD / EDIT TYPE */}
          {(modal.type === 'add-org-type' || modal.type === 'edit-org-type') && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">{modal.type === 'add-org-type' ? 'Add Organization Type' : 'Edit Organization Type'}</h3>
                <button onClick={close} disabled={isSaving} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-50"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type Name <span className="text-red-500">*</span></label>
                  <input type="text" value={orgTypeForm.name} onChange={e => setOrgTypeForm({ ...orgTypeForm, name: e.target.value })} disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent disabled:opacity-50"
                    placeholder="e.g. Academic, Civic" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Color <span className="text-red-500">*</span></label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={orgTypeForm.color} onChange={e => setOrgTypeForm({ ...orgTypeForm, color: e.target.value })} disabled={isSaving}
                      className="w-10 h-10 rounded border border-gray-300 cursor-pointer disabled:opacity-50" />
                    <input type="text" value={orgTypeForm.color} onChange={e => setOrgTypeForm({ ...orgTypeForm, color: e.target.value })} disabled={isSaving}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-[#001A4D] focus:border-transparent disabled:opacity-50" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={close} disabled={isSaving} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                  <button onClick={handleSaveOrgType} disabled={!orgTypeForm.name || isSaving}
                    className="flex-1 py-2.5 bg-[#001A4D] text-white rounded-xl text-sm font-bold hover:bg-[#001A4D]/90 disabled:opacity-40">
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CONFIRMS */}
          {modal.type === 'archive-org-type' && <ConfirmModal type="archive" name={modal.item.name} isSaving={isSaving} onConfirm={() => handleAction(() => updateOrganizationType(modal.item.id, { archived: true }))} onClose={close} />}
          {modal.type === 'restore-org-type' && <ConfirmModal type="restore" name={modal.item.name} isSaving={isSaving} onConfirm={() => handleAction(() => updateOrganizationType(modal.item.id, { archived: false }))} onClose={close} />}
          {modal.type === 'delete-org-type' && <ConfirmModal type="delete" name={modal.item.name} isSaving={isSaving} onConfirm={() => handleAction(() => deleteOrganizationType(modal.item.id), true, modal.item.id)} onClose={close} deleteText={deleteText} onDeleteTextChange={setDeleteText} />}
        </div>
      )}
    </div>
  );
}
