import { useState, useEffect, useCallback } from 'react';
import {
  Tag, Plus, Trash2, GripVertical, Edit2, Check, X,
  AlertCircle, Hash, Archive, Save, Loader2,
} from 'lucide-react';

import { useDocumentCategories } from '../../../modules/documents/hooks/useDocumentCategories';
import { useDocumentSettings } from '../../../modules/documents/hooks/useDocumentSettings';
import {
  createDocumentCategory,
  updateDocumentCategory,
  deleteDocumentCategory,
} from '../../../modules/documents/services/document_category.service';
import { saveDocumentSettings } from '../../../modules/documents/services/document_settings.service';
import { DEFAULT_DOCUMENT_SETTINGS } from '../../../modules/documents/types/document.types';
import type { DocumentCategoryDocument } from '../../../modules/documents/types/document.types';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const COLOR_OPTIONS = [
  { label: 'Navy', value: 'bg-[#001A4D]/10 text-[#001A4D]', dot: 'bg-[#001A4D]' },
  { label: 'Cobalt', value: 'bg-[#0E4EBD]/10 text-[#0E4EBD]', dot: 'bg-[#0E4EBD]' },
  { label: 'Blue', value: 'bg-blue-100 text-blue-700', dot: 'bg-blue-600' },
  { label: 'Amber', value: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  { label: 'Green', value: 'bg-green-100 text-green-700', dot: 'bg-green-600' },
  { label: 'Navy', value: 'bg-[#001A4D]/10 text-[#001A4D]', dot: 'bg-[#001A4D]' },
  { label: 'Teal', value: 'bg-teal-100 text-teal-700', dot: 'bg-teal-600' },
  { label: 'Gray', value: 'bg-gray-100 text-gray-600', dot: 'bg-gray-500' },
  { label: 'Red', value: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
];

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer ${value ? 'bg-[#001A4D]' : 'bg-gray-300'}`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${value ? 'translate-x-6' : ''}`}
      />
    </button>
  );
}

// ─── Category Row ──────────────────────────────────────────────────────────────
function CategoryRow({
  cat,
  onUpdate,
  onDelete,
}: {
  cat: DocumentCategoryDocument;
  onUpdate: (fields: Partial<Omit<DocumentCategoryDocument, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cat.name);
  const [colorPicker, setColorPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentColor = COLOR_OPTIONS.find((c) => c.value === cat.color) || COLOR_OPTIONS[0];

  const save = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await onUpdate({ name: draft.trim() });
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleColorChange = async (opt: typeof COLOR_OPTIONS[0]) => {
    setSaving(true);
    try {
      await onUpdate({ color: opt.value, colorDot: opt.dot });
    } finally {
      setSaving(false);
      setColorPicker(false);
    }
  };

  return (
    <div className={`flex items-center gap-3 p-3 border rounded-xl transition-colors ${cat.active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
      <GripVertical className="w-4 h-4 text-gray-300 cursor-grab flex-shrink-0" />

      {/* Color dot / picker trigger */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setColorPicker(!colorPicker)}
          className={`w-4 h-4 rounded-full ${currentColor.dot} ring-2 ring-white ring-offset-1`}
        />
        {colorPicker && (
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-2 flex flex-wrap gap-1 w-44">
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleColorChange(opt)}
                className={`w-5 h-5 rounded-full ${opt.dot} hover:scale-110 transition-transform ${cat.color === opt.value ? 'ring-2 ring-offset-1 ring-[#0E4EBD]' : ''}`}
                title={opt.label}
              />
            ))}
          </div>
        )}
      </div>

      {/* Name */}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="flex-1 px-2 py-1 border border-[#0E4EBD] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E4EBD]"
        />
      ) : (
        <span className="flex-1 text-sm font-medium inline-flex items-center">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.color}`}>{cat.name}</span>
        </span>
      )}

      {/* Toggles */}
      <div className="flex items-center gap-4 flex-shrink-0 text-xs text-gray-500">
        <label className="flex items-center gap-1.5 cursor-pointer" title="Officer can submit this category">
          <input
            type="checkbox"
            checked={cat.officerCanSubmit}
            onChange={(e) => onUpdate({ officerCanSubmit: e.target.checked })}
            className="accent-[#0E4EBD] w-3.5 h-3.5"
          />
          <span className="hidden xl:inline">Officers</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer" title="Rejection requires remarks">
          <input
            type="checkbox"
            checked={cat.requiresRemarks}
            onChange={(e) => onUpdate({ requiresRemarks: e.target.checked })}
            className="accent-[#0E4EBD] w-3.5 h-3.5"
          />
          <span className="hidden xl:inline">Req. remarks</span>
        </label>
      </div>

      {/* Active toggle */}
      <Toggle value={cat.active} onChange={(v) => onUpdate({ active: v })} />

      {/* Actions */}
      <div className="flex gap-1 flex-shrink-0">
        {saving ? (
          <div className="w-7 h-7 flex items-center justify-center">
            <Loader2 className="w-3.5 h-3.5 text-[#0E4EBD] animate-spin" />
          </div>
        ) : editing ? (
          <>
            <button onClick={save} className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditing(false)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"><X className="w-3.5 h-3.5" /></button>
          </>
        ) : (
          <>
            <button onClick={() => { setDraft(cat.name); setEditing(true); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
            <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Per-Box Save Button ───────────────────────────────────────────────────────
function BoxSaveButton({ dirty, saving, onSave }: { dirty: boolean; saving: boolean; onSave: () => void }) {
  if (!dirty && !saving) return null;
  return (
    <div className="flex justify-end mt-4 pt-3 border-t border-gray-100">
      <button
        onClick={onSave}
        disabled={saving}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
          saving
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-[#001A4D] text-[#FFD41C] hover:bg-[#001A4D]/90'
        }`}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}

// ─── Main Settings Component ───────────────────────────────────────────────────
export default function DocumentManagementSettings() {
  // ── Document Categories (Firestore-backed) ─────────────────────────────────
  const { data: categories, loading: catLoading } = useDocumentCategories();
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(COLOR_OPTIONS[0].value);
  const [newCatDot, setNewCatDot] = useState(COLOR_OPTIONS[0].dot);
  const [addingCat, setAddingCat] = useState(false);
  const [addingSaving, setAddingSaving] = useState(false);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingSaving(true);
    try {
      await createDocumentCategory({
        name: newCatName.trim(),
        color: newCatColor,
        colorDot: newCatDot,
        requiresRemarks: false,
        officerCanSubmit: true,
        active: true,
        sortOrder: categories.length,
        archived: false,
      });
      setNewCatName('');
      setAddingCat(false);
    } finally {
      setAddingSaving(false);
    }
  };

  const handleUpdateCategory = async (id: string, fields: Partial<Omit<DocumentCategoryDocument, 'id' | 'createdAt' | 'updatedAt'>>) => {
    await updateDocumentCategory(id, fields);
  };

  const handleDeleteCategory = async (id: string) => {
    const confirmed = confirm('Are you sure you want to delete this document category? This cannot be undone.');
    if (!confirmed) return;
    await deleteDocumentCategory(id);
  };

  // ── Reference Number Format (Firestore-backed) ─────────────────────────────
  const { data: settings, loading: settingsLoading } = useDocumentSettings();

  // Local form state for Reference Number
  const [refPrefix, setRefPrefix] = useState(DEFAULT_DOCUMENT_SETTINGS.refPrefix);
  const [refSeparator, setRefSeparator] = useState(DEFAULT_DOCUMENT_SETTINGS.refSeparator);
  const [refIncludeYear, setRefIncludeYear] = useState(DEFAULT_DOCUMENT_SETTINGS.refIncludeYear);
  const [refPadding, setRefPadding] = useState(DEFAULT_DOCUMENT_SETTINGS.refPadding);
  const [refDirty, setRefDirty] = useState(false);
  const [refSaving, setRefSaving] = useState(false);

  // Local form state for Retention & Archival
  const [retentionYears, setRetentionYears] = useState(DEFAULT_DOCUMENT_SETTINGS.retentionYears);
  const [autoArchiveCompleted, setAutoArchiveCompleted] = useState(DEFAULT_DOCUMENT_SETTINGS.autoArchiveCompleted);
  const [archiveAfterSemesters, setArchiveAfterSemesters] = useState(DEFAULT_DOCUMENT_SETTINGS.archiveAfterSemesters);
  const [allowOfficerDelete, setAllowOfficerDelete] = useState(DEFAULT_DOCUMENT_SETTINGS.allowOfficerDelete);
  const [draftExpiryDays, setDraftExpiryDays] = useState(DEFAULT_DOCUMENT_SETTINGS.draftExpiryDays);
  const [retDirty, setRetDirty] = useState(false);
  const [retSaving, setRetSaving] = useState(false);

  // Hydrate local form state from Firestore when data arrives
  useEffect(() => {
    if (settings) {
      setRefPrefix(settings.refPrefix ?? DEFAULT_DOCUMENT_SETTINGS.refPrefix);
      setRefSeparator(settings.refSeparator ?? DEFAULT_DOCUMENT_SETTINGS.refSeparator);
      setRefIncludeYear(settings.refIncludeYear ?? DEFAULT_DOCUMENT_SETTINGS.refIncludeYear);
      setRefPadding(settings.refPadding ?? DEFAULT_DOCUMENT_SETTINGS.refPadding);

      setRetentionYears(settings.retentionYears ?? DEFAULT_DOCUMENT_SETTINGS.retentionYears);
      setAutoArchiveCompleted(settings.autoArchiveCompleted ?? DEFAULT_DOCUMENT_SETTINGS.autoArchiveCompleted);
      setArchiveAfterSemesters(settings.archiveAfterSemesters ?? DEFAULT_DOCUMENT_SETTINGS.archiveAfterSemesters);
      setAllowOfficerDelete(settings.allowOfficerDelete ?? DEFAULT_DOCUMENT_SETTINGS.allowOfficerDelete);
      setDraftExpiryDays(settings.draftExpiryDays ?? DEFAULT_DOCUMENT_SETTINGS.draftExpiryDays);
    }
  }, [settings]);

  // Dirty detection — compare local state with Firestore state
  const checkRefDirty = useCallback(() => {
    const saved = settings ?? DEFAULT_DOCUMENT_SETTINGS;
    const dirty =
      refPrefix !== (saved.refPrefix ?? DEFAULT_DOCUMENT_SETTINGS.refPrefix) ||
      refSeparator !== (saved.refSeparator ?? DEFAULT_DOCUMENT_SETTINGS.refSeparator) ||
      refIncludeYear !== (saved.refIncludeYear ?? DEFAULT_DOCUMENT_SETTINGS.refIncludeYear) ||
      refPadding !== (saved.refPadding ?? DEFAULT_DOCUMENT_SETTINGS.refPadding);
    setRefDirty(dirty);
  }, [refPrefix, refSeparator, refIncludeYear, refPadding, settings]);

  const checkRetDirty = useCallback(() => {
    const saved = settings ?? DEFAULT_DOCUMENT_SETTINGS;
    const dirty =
      retentionYears !== (saved.retentionYears ?? DEFAULT_DOCUMENT_SETTINGS.retentionYears) ||
      autoArchiveCompleted !== (saved.autoArchiveCompleted ?? DEFAULT_DOCUMENT_SETTINGS.autoArchiveCompleted) ||
      archiveAfterSemesters !== (saved.archiveAfterSemesters ?? DEFAULT_DOCUMENT_SETTINGS.archiveAfterSemesters) ||
      allowOfficerDelete !== (saved.allowOfficerDelete ?? DEFAULT_DOCUMENT_SETTINGS.allowOfficerDelete) ||
      draftExpiryDays !== (saved.draftExpiryDays ?? DEFAULT_DOCUMENT_SETTINGS.draftExpiryDays);
    setRetDirty(dirty);
  }, [retentionYears, autoArchiveCompleted, archiveAfterSemesters, allowOfficerDelete, draftExpiryDays, settings]);

  useEffect(() => { checkRefDirty(); }, [checkRefDirty]);
  useEffect(() => { checkRetDirty(); }, [checkRetDirty]);

  // Save handlers
  const saveRefSettings = async () => {
    setRefSaving(true);
    try {
      await saveDocumentSettings({ refPrefix, refSeparator, refIncludeYear, refPadding });
    } finally {
      setRefSaving(false);
    }
  };

  const saveRetSettings = async () => {
    setRetSaving(true);
    try {
      await saveDocumentSettings({ retentionYears, autoArchiveCompleted, archiveAfterSemesters, allowOfficerDelete, draftExpiryDays });
    } finally {
      setRetSaving(false);
    }
  };

  // Preview
  const refPreview = `${refPrefix}${refSeparator}${refIncludeYear ? '2026' + refSeparator : ''}${'0'.repeat(Math.max(0, refPadding - 1))}1`;

  // Loading state
  if (catLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#0E4EBD] animate-spin mr-3" />
        <span className="text-gray-500 text-sm">Loading document settings…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Document Management Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure the Electronic Document Management System (EDMS) — categories, reference format, and retention rules.</p>
      </div>

      {/* ── 1. Document Categories ─────────────────────────────────────────── */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="border-l-4 border-[#0E4EBD] pl-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#0E4EBD]" />
              <h3 className="text-base font-bold text-[#001A4D]">Document Categories</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Manage the categories officers can select when submitting documents.</p>
          </div>
          <button
            onClick={() => setAddingCat(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#001A4D] text-[#FFD41C] text-sm font-bold rounded-lg hover:bg-[#001A4D]/90 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 px-3 mb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">
          <div className="w-4 flex-shrink-0" />
          <div className="w-4 flex-shrink-0" />
          <div className="flex-1">Category Name</div>
          <div className="flex items-center gap-4 flex-shrink-0 mr-14">
            <span title="Officers can submit this category" className="hidden xl:inline">Officers</span>
            <span title="Rejection requires remarks" className="hidden xl:inline">Req. remarks</span>
            <span>Active</span>
          </div>
        </div>

        {categories.length === 0 && !addingCat ? (
          <div className="text-center py-8 text-gray-400">
            <Tag className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No document categories yet.</p>
            <p className="text-xs">Click "Add Category" to create your first one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                onUpdate={(fields) => handleUpdateCategory(cat.id, fields)}
                onDelete={() => handleDeleteCategory(cat.id)}
              />
            ))}
          </div>
        )}

        {/* Add new category inline */}
        {addingCat && (
          <div className="flex items-center gap-3 mt-3 p-3 border-2 border-dashed border-[#0E4EBD]/40 rounded-xl bg-blue-50/40">
            <div className="flex gap-1 flex-shrink-0">
              {COLOR_OPTIONS.slice(0, 4).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setNewCatColor(opt.value); setNewCatDot(opt.dot); }}
                  className={`w-5 h-5 rounded-full ${opt.dot} hover:scale-110 transition-transform ${newCatColor === opt.value ? 'ring-2 ring-offset-1 ring-[#0E4EBD]' : ''}`}
                />
              ))}
            </div>
            <input
              autoFocus
              type="text"
              placeholder="New category name..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') setAddingCat(false); }}
              className="flex-1 px-3 py-2 border border-[#0E4EBD] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E4EBD]"
              disabled={addingSaving}
            />
            <button
              onClick={addCategory}
              disabled={addingSaving || !newCatName.trim()}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                addingSaving || !newCatName.trim()
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white hover:opacity-90 cursor-pointer shadow-xs'
              }`}
            >
              {addingSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
            </button>
            <button onClick={() => setAddingCat(false)} disabled={addingSaving} className="px-3 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm">Cancel</button>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-700"><strong>Officers</strong> — category is visible in the officer submission form. <strong>Req. remarks</strong> — SAS must provide remarks when rejecting a document of this type. Changes are saved immediately.</p>
        </div>
      </div>

      {/* ── 2. Reference Number Format ─────────────────────────────────────── */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <div className="border-l-4 border-[#0E4EBD] pl-3 mb-5">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-[#0E4EBD]" />
            <h3 className="text-base font-bold text-[#001A4D]">Reference Number Format</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Configure the auto-generated reference number assigned to each submitted document.</p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Prefix</label>
              <input
                type="text"
                maxLength={6}
                value={refPrefix}
                onChange={(e) => setRefPrefix(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">Max 6 characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Separator</label>
              <select
                value={refSeparator}
                onChange={(e) => setRefSeparator(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] font-mono"
              >
                <option value="-">- (dash)</option>
                <option value="/">&nbsp;/ (slash)</option>
                <option value="_">_ (underscore)</option>
                <option value=".">. (dot)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Number Padding (digits)</label>
              <input
                type="number"
                min={3}
                max={8}
                value={refPadding}
                onChange={(e) => setRefPadding(+e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Include Year in Reference</p>
              <p className="text-xs text-gray-500">e.g. DOC-2026-0001 vs DOC-0001</p>
            </div>
            <Toggle value={refIncludeYear} onChange={setRefIncludeYear} />
          </div>

          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <Hash className="w-4 h-4 text-[#0E4EBD]" />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Preview — next reference number:</p>
              <p className="text-[#001A4D] font-bold font-mono text-lg">{refPreview}</p>
            </div>
          </div>
        </div>

        <BoxSaveButton dirty={refDirty} saving={refSaving} onSave={saveRefSettings} />
      </div>

      {/* ── 3. Retention & Archive ─────────────────────────────────────────── */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6">
        <div className="border-l-4 border-[#0E4EBD] pl-3 mb-5">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-[#0E4EBD]" />
            <h3 className="text-base font-bold text-[#001A4D]">Retention & Archival</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Set how long documents are kept, when they are auto-archived, and what officers can delete.</p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Document Retention Period (years)</label>
              <input
                type="number"
                min={1}
                max={20}
                value={retentionYears}
                onChange={(e) => setRetentionYears(+e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
              />
              <p className="text-xs text-gray-500 mt-1">Documents are preserved for this period before permanent deletion is allowed.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Draft Expiry (days inactive)</label>
              <input
                type="number"
                min={7}
                max={365}
                value={draftExpiryDays}
                onChange={(e) => setDraftExpiryDays(+e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
              />
              <p className="text-xs text-gray-500 mt-1">Unsent draft submissions are auto-deleted after this many days.</p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">Auto-Archive Completed Documents</p>
                <p className="text-xs text-gray-500">Approved and Rejected documents are automatically archived after a set period.</p>
              </div>
              <Toggle value={autoArchiveCompleted} onChange={setAutoArchiveCompleted} />
            </div>

            {autoArchiveCompleted && (
              <div className="ml-4 pl-3 border-l-2 border-[#0E4EBD]/30">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Archive After (semesters past)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={archiveAfterSemesters}
                  onChange={(e) => setArchiveAfterSemesters(+e.target.value)}
                  className="w-40 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD]"
                />
                <p className="text-xs text-gray-500 mt-1">Documents from semesters older than this threshold are archived automatically.</p>
              </div>
            )}

            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">Allow Officers to Delete Draft Documents</p>
                <p className="text-xs text-gray-500">Officers can permanently delete their own unsent draft submissions. Submitted documents can never be deleted by officers.</p>
              </div>
              <Toggle value={allowOfficerDelete} onChange={setAllowOfficerDelete} />
            </div>
          </div>
        </div>

        <BoxSaveButton dirty={retDirty} saving={retSaving} onSave={saveRetSettings} />
      </div>
    </div>
  );
}
