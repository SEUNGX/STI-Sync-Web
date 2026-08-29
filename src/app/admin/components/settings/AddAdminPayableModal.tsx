import { useState, useMemo } from 'react';
import {
  X,
  Loader2,
  Plus,
  Check,
  Search,
  Users,
  DollarSign,
  Calendar,
  AlertCircle,
  Shield,
  Tag,
  BookOpen,
  GraduationCap,
  ExternalLink,
} from 'lucide-react';
import { useSemesters, useCourses, useDepartments } from '../../../modules/academic';
import { useStudents } from '../../../modules/students/hooks/useStudentStream';
import { createPayable } from '../../../modules/finance/services/payable.service';
import { usePayableCategories } from '../../../modules/finance/services/payable-category.service';
import type { PayableType } from '../../../modules/finance/types/payable.types';
import { toast } from 'sonner';
import { formatCurrency } from '../../../utils/currency';

interface AddAdminPayableModalProps {
  isOpen: boolean;
  onClose: () => void;
  addedBy?: string;
}

export function AddAdminPayableModal({
  isOpen,
  onClose,
  addedBy = 'SAO Administration',
}: AddAdminPayableModalProps) {
  const { data: semesters = [] } = useSemesters();
  const activeSemester = semesters.find((s) => s.status === 'ACTIVE') || semesters[0];

  // Dynamic database courses & departments
  const { data: dbCourses = [] } = useCourses();
  const { data: dbDepartments = [] } = useDepartments();

  // Dynamic fee/fine categories
  const { data: dbCategories = [] } = usePayableCategories();
  const activeCategories = useMemo(() => {
    return dbCategories.filter((c) => c.isActive);
  }, [dbCategories]);

  const { data: allStudents = [], loading: loadingStudents } = useStudents();

  const [selectedSemId, setSelectedSemId] = useState<string>(activeSemester?.id || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [payableType, setPayableType] = useState<PayableType>('custom');
  const [categoryName, setCategoryName] = useState<string>('Institutional Assessment');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState('');

  // Target selection mode: 'specific' | 'all'
  const [targetMode, setTargetMode] = useState<'specific' | 'all'>('specific');
  const [courseFilter, setCourseFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active students pool strictly matching Student Registry criteria
  const activeStudents = useMemo(() => {
    return (allStudents || []).filter(
      (s) => s && (s.status === 'ACTIVE' || s.status?.toUpperCase() === 'ACTIVE') && !s.archived
    );
  }, [allStudents]);

  // Active courses from database
  const activeCourses = useMemo(() => {
    return dbCourses.filter((c) => !c.archived);
  }, [dbCourses]);

  // Dynamic year levels derived from selected course or academic standards
  const dynamicYearLevels = useMemo(() => {
    if (courseFilter !== 'all') {
      const selectedCourse = activeCourses.find((c) => c.id === courseFilter || c.code === courseFilter);
      if (selectedCourse) {
        if (selectedCourse.academicLevel === 'SHS' || selectedCourse.yearLevels === 2) {
          return ['Grade 11', 'Grade 12'];
        }
        const maxYears = selectedCourse.yearLevels || 4;
        const collegeYears = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];
        return collegeYears.slice(0, maxYears);
      }
    }
    // Default standard list of academic year levels across College and SHS
    return ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Grade 11', 'Grade 12'];
  }, [courseFilter, activeCourses]);

  // Handle choosing a category
  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    const cat = activeCategories.find((c) => c.id === catId);
    if (cat) {
      setLabel(cat.name);
      setAmount(cat.defaultAmount);
      setPayableType(cat.type);
      setCategoryName(cat.name);
      if (cat.description) {
        setDescription(cat.description);
      }
    }
  };

  // Filtered students based on search, database course, and year level
  const filteredStudents = useMemo(() => {
    return activeStudents.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (s.firstName && s.firstName.toLowerCase().includes(q)) ||
        (s.lastName && s.lastName.toLowerCase().includes(q)) ||
        (s.studentId && s.studentId.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q));

      // Match database program/course
      let matchesCourse = true;
      if (courseFilter !== 'all') {
        const targetCourse = activeCourses.find(
          (c) => c.id === courseFilter || c.code === courseFilter
        );
        if (targetCourse) {
          const sCourseId = s.courseId || '';
          const sCourseCode = (s.courseCode || s.course || '').toLowerCase().trim();
          const sCourseName = (s.courseName || s.department || '').toLowerCase().trim();

          matchesCourse =
            sCourseId === targetCourse.id ||
            sCourseCode === targetCourse.code.toLowerCase() ||
            sCourseName.includes(targetCourse.code.toLowerCase()) ||
            sCourseName.includes(targetCourse.name.toLowerCase());
        }
      }

      // Match year level
      let matchesYear = true;
      if (yearFilter !== 'all') {
        const sYear = String((s as any).yearLevel || s.year || '').toLowerCase().trim();
        matchesYear = sYear === yearFilter.toLowerCase() || sYear.includes(yearFilter.toLowerCase());
      }

      return matchesSearch && matchesCourse && matchesYear;
    });
  }, [activeStudents, searchQuery, courseFilter, yearFilter, activeCourses]);

  if (!isOpen) return null;

  const toggleStudentSelection = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((sId) => sId !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredStudents.map((s) => s.id || s.studentId);
    const allSelected = filteredIds.every((id) => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds(selectedStudentIds.filter((id) => !filteredIds.includes(id)));
    } else {
      const combined = new Set([...selectedStudentIds, ...filteredIds]);
      setSelectedStudentIds(Array.from(combined));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!label.trim()) {
      toast.error('Payable title is required.');
      return;
    }

    if (!amount || Number(amount) <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }

    const semId = selectedSemId || activeSemester?.id;
    if (!semId) {
      toast.error('Please select an academic semester.');
      return;
    }

    const selectedSemesterObj = semesters.find((s) => s.id === semId);

    // Determine target students
    const targetStudents =
      targetMode === 'all'
        ? activeStudents
        : activeStudents.filter((s) => selectedStudentIds.includes(s.id || s.studentId));

    if (targetStudents.length === 0) {
      toast.error('Please select at least one student to assign this institutional payable.');
      return;
    }

    setIsSubmitting(true);

    try {
      let createdCount = 0;
      for (const s of targetStudents) {
        const authUid = s.id || s.studentId;
        const studentFullName =
          [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ').trim() ||
          s.name ||
          'Student';

        // Full mobile app compatibility + event fee parity fields
        await createPayable({
          studentId: authUid,
          studentName: studentFullName,
          studentSchoolId: s.studentId || '',
          type: payableType,
          label: label.trim(),
          title: label.trim(),
          feeTitle: label.trim(),
          category: categoryName.trim() || (payableType === 'admin_fine' ? 'Administrative Fine' : 'Institutional Assessment'),
          description: description.trim() || `Institutional assessment by ${addedBy}`,
          organizationId: null,
          organizationName: 'SAO Administration',
          semesterId: semId,
          semester: selectedSemesterObj?.label || selectedSemesterObj?.semester || '',
          schoolYear: selectedSemesterObj?.academicYear || '',
          assignedAmount: Number(amount),
          amount: Number(amount),
          paymentStatus: 'UNPAID',
          dueDate: dueDate ? new Date(dueDate) : null,
          courseCode: s.courseCode || s.course || '',
          courseName: s.courseName || '',
          departmentId: s.departmentId || '',
          departmentName: s.department || s.departmentName || '',
          yearLevel: s.yearLevel || s.year || '',
          section: s.section || '',
          academicLevel: s.academicLevel || (String(s.yearLevel || '').includes('Grade') ? 'SHS' : 'COLLEGE'),
          createdBy: addedBy,
        });
        createdCount++;
      }

      toast.success(`Successfully assigned "${label}" to ${createdCount} student(s).`);
      onClose();
    } catch (err: any) {
      console.error('[AddAdminPayableModal] Creation error:', err);
      toast.error(`Failed to assign payable: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[660px] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-white">
            <Shield className="w-5 h-5 text-[#FFD41C]" />
            <div>
              <h2 className="font-bold text-base text-white">Add Institutional Payable / Fine</h2>
              <p className="text-white/70 text-xs">
                Assess school-level student fees, dues, or penalties (synced with mobile app)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Dynamic Categories from Settings */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#0E4EBD]" />
                Dynamic Fee & Fine Categories
              </label>
              <a
                href="/admin/settings"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-[#0E4EBD] hover:underline flex items-center gap-1 cursor-pointer"
                title="Manage categories in System Settings"
              >
                Category Maintenance <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Category selection chips */}
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1 bg-gray-50 rounded-xl border border-gray-200">
              {activeCategories.length === 0 ? (
                <span className="text-xs text-gray-400 p-1">No custom categories configured in settings.</span>
              ) : (
                activeCategories.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  const isFine = cat.categoryType === 'fine' || cat.type === 'admin_fine';
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => handleSelectCategory(cat.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#001A4D] text-white shadow-2xs font-bold'
                          : 'bg-white hover:bg-blue-50 border border-gray-200 text-gray-700'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isFine ? 'bg-amber-500' : 'bg-[#0E4EBD]'
                        }`}
                      />
                      {cat.name} ({formatCurrency(cat.defaultAmount)})
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title / Label */}
            <div>
              <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1.5">
                Payable Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. ID Replacement Fee"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D] outline-none font-medium"
                required
              />
            </div>

            {/* Category / Type */}
            <div>
              <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1.5">
                Assessment Category
              </label>
              <select
                value={selectedCategoryId || payableType}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom' || val === 'admin_fine') {
                    setPayableType(val as PayableType);
                    setSelectedCategoryId('');
                  } else {
                    handleSelectCategory(val);
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D] outline-none bg-white cursor-pointer"
              >
                <optgroup label="System Preset Types">
                  <option value="custom">Institutional Fee / Assessment</option>
                  <option value="admin_fine">Administrative Fine / Penalty</option>
                </optgroup>
                {activeCategories.length > 0 && (
                  <optgroup label="Settings Defined Categories">
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({formatCurrency(c.defaultAmount)})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1.5">
                Amount (PHP) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">
                  ₱
                </span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D] outline-none font-semibold text-gray-900"
                  required
                />
              </div>
            </div>

            {/* Semester */}
            <div>
              <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1.5">
                Semester <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSemId}
                onChange={(e) => setSelectedSemId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D] outline-none bg-white cursor-pointer"
              >
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1.5">
                Due Date (Optional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D] outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1.5">
              Description / Justification Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Assessment reason, terms, or guidelines for student settlement."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#001A4D]/20 focus:border-[#001A4D] outline-none"
            />
          </div>

          {/* Target Selection */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#001A4D] uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#0E4EBD]" />
                Target Students
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTargetMode('specific')}
                  className={`px-3 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                    targetMode === 'specific'
                      ? 'bg-[#001A4D] text-white shadow-2xs'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Select Specific ({selectedStudentIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('all')}
                  className={`px-3 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                    targetMode === 'all'
                      ? 'bg-[#001A4D] text-white shadow-2xs'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  All Active Students ({activeStudents.length})
                </button>
              </div>
            </div>

            {targetMode === 'all' ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#0E4EBD] flex-shrink-0" />
                <span>
                  This payable of{' '}
                  <strong>{amount ? formatCurrency(Number(amount)) : '₱0.00'}</strong> will be
                  automatically assigned to all{' '}
                  <strong>{activeStudents.length} active students</strong> across all programs.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Database-backed Program & Year Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="relative sm:col-span-1">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search student or ID..."
                      className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#001A4D]/20"
                    />
                  </div>

                  {/* Database-Driven Program / Course Dropdown */}
                  <select
                    value={courseFilter}
                    onChange={(e) => {
                      setCourseFilter(e.target.value);
                      setYearFilter('all'); // Reset year when program changes
                    }}
                    className="px-2 py-1.5 text-xs bg-white border border-gray-300 rounded-lg outline-none cursor-pointer"
                  >
                    <option value="all">All Programs / Courses ({activeCourses.length})</option>
                    {activeCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} — {course.name}
                      </option>
                    ))}
                  </select>

                  {/* Dynamic Year Level Dropdown */}
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="px-2 py-1.5 text-xs bg-white border border-gray-300 rounded-lg outline-none cursor-pointer"
                  >
                    <option value="all">All Year Levels</option>
                    {dynamicYearLevels.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Roster Selection Table */}
                <div className="border border-gray-200 rounded-lg bg-white overflow-hidden max-h-48 overflow-y-auto">
                  <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs font-semibold text-gray-600">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="text-[#0E4EBD] hover:underline font-bold text-xs cursor-pointer"
                    >
                      Toggle All Filtered ({filteredStudents.length})
                    </button>
                    <span>{selectedStudentIds.length} student(s) selected</span>
                  </div>

                  {loadingStudents ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      Loading student directory...
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      No students match filter criteria.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {filteredStudents.map((student) => {
                        const sId = student.id || student.studentId;
                        const isSelected = selectedStudentIds.includes(sId);
                        const sName =
                          [student.firstName, student.lastName].filter(Boolean).join(' ') ||
                          'Student';
                        const progDisplay = student.courseCode || student.course || student.department || 'N/A';
                        const yrDisplay = student.yearLevel || student.year || '';

                        return (
                          <div
                            key={sId}
                            onClick={() => toggleStudentSelection(sId)}
                            className={`px-3 py-2 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50/70 font-semibold' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                  isSelected
                                    ? 'bg-[#001A4D] border-[#001A4D] text-white'
                                    : 'border-gray-300'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3" />}
                              </div>
                              <div>
                                <span className="text-[#001A4D]">{sName}</span>
                                <span className="text-gray-400 ml-1.5 font-mono">
                                  ({student.studentId})
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-gray-600 font-medium">{progDisplay}</span>
                              {yrDisplay && (
                                <span className="text-gray-400 text-[11px] ml-1.5">
                                  · {yrDisplay}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#FFD41C]" />
                  Assigning Payables...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-[#FFD41C]" />
                  Create & Assign Payable
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
