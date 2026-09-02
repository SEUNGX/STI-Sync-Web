import { useState, useMemo, useEffect } from 'react';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Coins,
  AlertTriangle,
  FileText,
  X,
  Loader2,
  Shield,
} from 'lucide-react';
import {
  usePayableCategories,
  createPayableCategory,
  updatePayableCategory,
  deletePayableCategory,
  type PayableCategoryDocument,
  type PayableCategoryClassification,
} from '../../../modules/finance/services/payable-category.service';
import { formatCurrency } from '../../../utils/currency';
import { toast } from 'sonner';
import { TablePagination } from '../../../components/common/TablePagination';

interface PayableCategorySettingsProps {
  onUnsavedChange?: () => void;
}

type FilterTab = 'all' | 'fee' | 'fine';

export default function PayableCategorySettings({ onUnsavedChange }: PayableCategorySettingsProps) {
  const { data: categories = [], loading } = usePayableCategories();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PayableCategoryDocument | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<PayableCategoryDocument | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCategoryType, setFormCategoryType] = useState<PayableCategoryClassification>('fee');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form
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
    setFormCategoryType(cat.categoryType || (cat.type === 'admin_fine' ? 'fine' : 'fee'));
    setFormAmount(cat.defaultAmount);
    setFormDescription(cat.description || '');
    setFormIsActive(cat.isActive);
    setShowAddModal(true);
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesTab =
        activeTab === 'all' ||
        cat.categoryType === activeTab ||
        (activeTab === 'fine' && cat.type === 'admin_fine') ||
        (activeTab === 'fee' && cat.type !== 'admin_fine');

      const q = searchQuery.toLowerCase().trim();
      const matchesName = cat.name.toLowerCase().includes(q);
      const matchesCode = cat.code.toLowerCase().includes(q);
      const matchesDesc = cat.description && cat.description.toLowerCase().includes(q);

      return matchesTab && (!q || matchesName || matchesCode || matchesDesc);
    });
  }, [categories, activeTab, searchQuery]);

  // Pagination State (8 rows per page standard)
  const PER_PAGE = 8;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / PER_PAGE));
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filteredCategories.slice(start, start + PER_PAGE);
  }, [filteredCategories, currentPage]);

  // Statistics
  const stats = useMemo(() => {
    const total = categories.length;
    const fees = categories.filter((c) => c.categoryType === 'fee' || c.type !== 'admin_fine').length;
    const fines = categories.filter((c) => c.categoryType === 'fine' || c.type === 'admin_fine').length;
    const active = categories.filter((c) => c.isActive).length;
    return { total, fees, fines, active };
  }, [categories]);

  // Save Add/Edit
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
        type: (formCategoryType === 'fine' ? 'admin_fine' : 'custom') as 'custom' | 'admin_fine',
        defaultAmount: Number(formAmount),
        description: formDescription.trim(),
        isActive: formIsActive,
      };

      if (editingCategory) {
        await updatePayableCategory(editingCategory.id, payload);
        toast.success(`Updated category "${formName}"`);
      } else {
        await createPayableCategory(payload);
        toast.success(`Created category "${formName}"`);
      }

      onUnsavedChange?.();
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      console.error('[PayableCategorySettings] Save error:', err);
      toast.error(`Failed to save category: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active status in table
  const handleToggleStatus = async (cat: PayableCategoryDocument) => {
    try {
      await updatePayableCategory(cat.id, { isActive: !cat.isActive });
      toast.success(
        `Category "${cat.name}" is now ${!cat.isActive ? 'Active' : 'Inactive'}`
      );
      onUnsavedChange?.();
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message}`);
    }
  };

  // Confirm delete
  const handleDelete = async () => {
    if (!deletingCategory) return;
    setIsSubmitting(true);
    try {
      await deletePayableCategory(deletingCategory.id);
      toast.success(`Category "${deletingCategory.name}" removed.`);
      setDeletingCategory(null);
      onUnsavedChange?.();
    } catch (err: any) {
      toast.error(`Failed to delete category: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D] flex items-center gap-2.5">
            <Coins className="w-7 h-7 text-[#FFD41C]" />
            Fee & Fine Category Maintenance
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage dynamic categories and default rates for institutional student assessments and administrative penalties
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-5 py-2.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#FFD41C]" />
          Add Category
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Categories</span>
          <p className="text-2xl font-bold text-[#001A4D] mt-1">{stats.total}</p>
          <span className="text-[11px] text-gray-400">In database registry</span>
        </div>
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Institutional Fees</span>
          <p className="text-2xl font-bold text-blue-700 mt-1">{stats.fees}</p>
          <span className="text-[11px] text-gray-400">ID, certs, evaluations</span>
        </div>
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Admin Penalties</span>
          <p className="text-2xl font-bold text-amber-700 mt-1">{stats.fines}</p>
          <span className="text-[11px] text-gray-400">Disciplinary & property</span>
        </div>
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
          <span className="text-xs font-bold text-green-600 uppercase tracking-wider">Active Status</span>
          <p className="text-2xl font-bold text-green-700 mt-1">{stats.active}</p>
          <span className="text-[11px] text-gray-400">Available in assessment modal</span>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-xs">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Sub-tabs */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'all' ? 'bg-white text-[#001A4D] shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              All ({categories.length})
            </button>
            <button
              onClick={() => setActiveTab('fee')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'fee' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Institutional Fees ({stats.fees})
            </button>
            <button
              onClick={() => setActiveTab('fine')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'fine' ? 'bg-white text-amber-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Administrative Fines ({stats.fines})
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search category or code..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D]"
            />
          </div>
        </div>

        {/* Categories Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-[#E0E0E0]">
              <tr>
                {['Category Name', 'Code', 'Classification', 'Default Rate', 'Description', 'Status', 'Actions'].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0E4EBD]" />
                    Loading categories from database...
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No categories found. Click <strong>Add Category</strong> to create one.
                  </td>
                </tr>
              ) : (
                paginatedCategories.map((cat) => {
                  const isFine = cat.categoryType === 'fine' || cat.type === 'admin_fine';
                  return (
                    <tr key={cat.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[#001A4D] text-sm">{cat.name}</div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-gray-500 font-semibold">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-[11px]">
                          {cat.code}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isFine
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {isFine ? 'Administrative Fine' : 'Institutional Fee'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-[#001A4D] text-sm">
                        {formatCurrency(cat.defaultAmount)}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 max-w-xs truncate" title={cat.description}>
                        {cat.description || <span className="text-gray-300 italic">No description</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(cat)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                            cat.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                        >
                          {cat.isActive ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-gray-500" /> Inactive
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(cat)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Category"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingCategory(cat)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Standard Bottom Pagination Bar ── */}
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredCategories.length}
          itemsPerPage={PER_PAGE}
          onPageChange={setCurrentPage}
          itemName="categories"
        />
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#FFD41C]" />
                <h3 className="font-bold text-base">
                  {editingCategory ? 'Edit Category' : 'Add Fee / Fine Category'}
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
                  placeholder="e.g. ID Replacement Fee"
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
                    placeholder="e.g. ID_REPLACE"
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
                    <option value="fee">Institutional Fee</option>
                    <option value="fine">Administrative Fine</option>
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
                  placeholder="Explain what this assessment accounts for..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="categoryIsActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-[#001A4D] rounded cursor-pointer"
                />
                <label htmlFor="categoryIsActive" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Active (available when assessing student fees and fines)
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
        <div className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4">
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
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
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
