import { useState, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Tag,
  Coins,
  AlertTriangle,
  Sparkles,
  Loader2,
  Shield,
  Building,
  DollarSign,
  Info,
  X,
} from 'lucide-react';
import {
  usePayableCategories,
  createPayableCategory,
  updatePayableCategory,
  deletePayableCategory,
  seedClubPayableCategories,
  type PayableCategoryDocument,
  type PayableCategoryClassification,
} from '../../../modules/finance/services/payable-category.service';
import { formatCurrency } from '../../../utils/currency';
import { toast } from 'sonner';

interface OfficerPayableCategorySettingsProps {
  organizationId: string;
  organizationName: string;
}

type FilterTab = 'all' | 'fee' | 'fine';

export default function OfficerPayableCategorySettings({
  organizationId,
  organizationName,
}: OfficerPayableCategorySettingsProps) {
  const { data: allCategories = [], loading } = usePayableCategories(organizationId);

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PayableCategoryDocument | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<PayableCategoryDocument | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCategoryType, setFormCategoryType] = useState<PayableCategoryClassification>('fee');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Filter categories scoped to organization or global
  const clubCategories = useMemo(() => {
    return allCategories.filter((c) => c.organizationId === organizationId);
  }, [allCategories, organizationId]);

  const institutionalCategories = useMemo(() => {
    return allCategories.filter((c) => !c.organizationId);
  }, [allCategories]);

  const filteredCategories = useMemo(() => {
    return allCategories.filter((cat) => {
      const isFine = cat.categoryType === 'fine' || cat.type === 'org_fine' || cat.type === 'admin_fine';
      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'fee' && !isFine) ||
        (activeTab === 'fine' && isFine);

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        cat.name.toLowerCase().includes(q) ||
        cat.code.toLowerCase().includes(q) ||
        (cat.description && cat.description.toLowerCase().includes(q));

      return matchesTab && matchesSearch;
    });
  }, [allCategories, activeTab, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = allCategories.length;
    const feesCount = allCategories.filter((c) => c.categoryType === 'fee' && c.type !== 'org_fine').length;
    const finesCount = allCategories.filter((c) => c.categoryType === 'fine' || c.type === 'org_fine' || c.type === 'admin_fine').length;
    const activeCount = allCategories.filter((c) => c.isActive).length;
    return { total, feesCount, finesCount, activeCount };
  }, [allCategories]);

  const resetForm = () => {
    setFormName('');
    setFormCode('');
    setFormCategoryType('fee');
    setFormAmount('');
    setFormDescription('');
    setFormIsActive(true);
    setEditingCategory(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (cat: PayableCategoryDocument) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormCode(cat.code);
    setFormCategoryType(cat.categoryType || (cat.type === 'org_fine' || cat.type === 'admin_fine' ? 'fine' : 'fee'));
    setFormAmount(cat.defaultAmount);
    setFormDescription(cat.description || '');
    setFormIsActive(cat.isActive);
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Category name is required.');
      return;
    }

    if (formAmount === '' || Number(formAmount) < 0) {
      toast.error('Please enter a valid non-negative default amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const generatedCode = (
        formCode.trim() ||
        formName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')
      );

      const payload = {
        name: formName.trim(),
        code: generatedCode,
        categoryType: formCategoryType,
        type: (formCategoryType === 'fine' ? 'org_fine' : 'custom') as 'custom' | 'org_fine',
        defaultAmount: Number(formAmount),
        description: formDescription.trim(),
        organizationId: organizationId,
        organizationName: organizationName,
        isActive: formIsActive,
      };

      if (editingCategory) {
        await updatePayableCategory(editingCategory.id, payload);
        toast.success(`Updated category "${formName}"`);
      } else {
        await createPayableCategory(payload);
        toast.success(`Created category "${formName}" for ${organizationName}`);
      }

      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      console.error('[OfficerPayableCategorySettings] Save error:', err);
      toast.error(`Failed to save category: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (cat: PayableCategoryDocument) => {
    try {
      await updatePayableCategory(cat.id, { isActive: !cat.isActive });
      toast.success(
        `Category "${cat.name}" is now ${!cat.isActive ? 'Active' : 'Inactive'}`
      );
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    setIsSubmitting(true);
    try {
      await deletePayableCategory(deletingCategory.id);
      toast.success(`Category "${deletingCategory.name}" deleted.`);
      setDeletingCategory(null);
    } catch (err: any) {
      toast.error(`Failed to delete category: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    try {
      const count = await seedClubPayableCategories(organizationId, organizationName);
      toast.success(`Added ${count} standard categories for ${organizationName}!`);
    } catch (err: any) {
      toast.error(`Failed to seed categories: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h2 className="text-xl font-bold text-[#001A4D] flex items-center gap-2">
            <Coins className="w-5 h-5 text-[#0E4EBD]" />
            Fee & Fine Categories
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Maintain dynamic membership dues, custom fees, and absence fines for{' '}
            <span className="font-semibold text-[#0E4EBD]">{organizationName}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {clubCategories.length === 0 && (
            <button
              onClick={handleSeedDefaults}
              disabled={isSeeding}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSeeding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#FFD41C]" />
              )}
              Seed Club Defaults
            </button>
          )}
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#FFD41C]" />
            Add Category
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Available</span>
            <Tag className="w-4 h-4 text-[#0E4EBD]" />
          </div>
          <p className="text-2xl font-bold text-[#001A4D] mt-2">{stats.total}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {clubCategories.length} club · {institutionalCategories.length} institutional
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Club Fees</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-700 mt-2">{stats.feesCount}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Dues & activity assessments</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fines & Penalties</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{stats.finesCount}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Absence & disciplinary</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Status</span>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600 mt-2">{stats.activeCount}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Available for member assignment</p>
        </div>
      </div>

      {/* Info notice */}
      <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 shadow-2xs">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#0E4EBD] flex-shrink-0" />
          <span>
            Categories configured here dynamically populate the <strong>Add Payable / Fine</strong> modal in the Finance Center, and sync directly with the student mobile app.
          </span>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 border border-gray-200 rounded-xl shadow-2xs">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'all' ? 'bg-white text-[#001A4D] shadow-xs' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            All Categories ({allCategories.length})
          </button>
          <button
            onClick={() => setActiveTab('fee')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'fee' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Club Fees ({stats.feesCount})
          </button>
          <button
            onClick={() => setActiveTab('fine')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'fine' ? 'bg-white text-amber-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Fines & Penalties ({stats.finesCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D]"
          />
        </div>
      </div>

      {/* Categories Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Category Name</th>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Scope</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Default Rate</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0E4EBD]" />
                  Loading categories...
                </td>
              </tr>
            ) : filteredCategories.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  No categories found matching filters.
                </td>
              </tr>
            ) : (
              filteredCategories.map((cat) => {
                const isClubCategory = cat.organizationId === organizationId;
                const isFine = cat.categoryType === 'fine' || cat.type === 'org_fine' || cat.type === 'admin_fine';

                return (
                  <tr key={cat.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-[#001A4D]">{cat.name}</div>
                      {cat.description && (
                        <div className="text-[11px] text-gray-400 truncate max-w-sm" title={cat.description}>
                          {cat.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-gray-500 font-semibold">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-[11px]">{cat.code}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {isClubCategory ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-[#0E4EBD] rounded font-semibold text-[11px] border border-blue-100 flex items-center gap-1 w-max">
                          <Building className="w-3 h-3" /> Club
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-semibold text-[11px] flex items-center gap-1 w-max">
                          <Shield className="w-3 h-3" /> Institutional
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          isFine
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {isFine ? 'Absence / Fine' : 'Club Fee'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-[#001A4D] text-right text-sm">
                      {formatCurrency(cat.defaultAmount)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {isClubCategory ? (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(cat)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                            cat.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                        >
                          {cat.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-green-600" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-gray-500" /> Inactive
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-[11px]">System Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {isClubCategory ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(cat)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                            title="Edit Category"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingCategory(cat)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#FFD41C]" />
                <h3 className="font-bold text-base">
                  {editingCategory ? 'Edit Club Category' : 'Add Club Fee / Fine Category'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                disabled={isSubmitting}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Club T-Shirt Fee, Meeting Absence Fine"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D] outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1">
                    Unique Code
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. TSHIRT_FEE"
                    className="w-full px-3 py-2 text-sm font-mono uppercase border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1">
                    Classification
                  </label>
                  <select
                    value={formCategoryType}
                    onChange={(e) => setFormCategoryType(e.target.value as PayableCategoryClassification)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D] outline-none bg-white cursor-pointer"
                  >
                    <option value="fee">Organization Fee / Due</option>
                    <option value="fine">Absence / Disciplinary Fine</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1">
                  Default Assessment Amount (PHP) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">₱</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 text-sm font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D] outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1">
                  Description / Rationalization
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Explain what this assessment or fine is for..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="officerCategorySettingActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-[#001A4D] rounded cursor-pointer"
                />
                <label htmlFor="officerCategorySettingActive" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Active (available when assigning member fees and fines)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FFD41C]" />
                      Saving...
                    </>
                  ) : (
                    'Save Category'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCategory && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Delete Category?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to permanently delete{' '}
                <strong>"{deletingCategory.name}"</strong>? Existing payables under this category will retain their saved data.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                disabled={isSubmitting}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
