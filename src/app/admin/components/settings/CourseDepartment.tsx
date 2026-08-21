import { useState } from 'react';
import { Plus, Archive, RotateCcw, Trash2, Edit2, X, AlertTriangle } from 'lucide-react';
import {
  useDepartments,
  useCourses,
  useSections,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createCourse,
  updateCourse,
  deleteCourse,
  createSection,
  updateSection,
  deleteSection,
  type DepartmentDocument,
  type CourseDocument,
  type SectionDocument,
  type AcademicLevel
} from '../../../modules/academic';

interface CourseDepartmentProps {
  onUnsavedChange: () => void;
}

type SubTab = 'departments' | 'courses' | 'sections';

type ModalState =
  | { type: 'none' }
  | { type: 'add-dept' }
  | { type: 'edit-dept'; item: DepartmentDocument }
  | { type: 'archive-dept'; item: DepartmentDocument }
  | { type: 'restore-dept'; item: DepartmentDocument }
  | { type: 'delete-dept'; item: DepartmentDocument }
  | { type: 'add-course' }
  | { type: 'edit-course'; item: CourseDocument }
  | { type: 'archive-course'; item: CourseDocument }
  | { type: 'restore-course'; item: CourseDocument }
  | { type: 'delete-course'; item: CourseDocument }
  | { type: 'add-section' }
  | { type: 'edit-section'; item: SectionDocument }
  | { type: 'archive-section'; item: SectionDocument }
  | { type: 'restore-section'; item: SectionDocument }
  | { type: 'delete-section'; item: SectionDocument };

function ActiveArchivedTabs({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
      <button onClick={() => onChange(false)}
        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${!active ? 'bg-white text-[#001A4D] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
        Active
      </button>
      <button onClick={() => onChange(true)}
        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${active ? 'bg-white text-[#001A4D] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
        Archived
      </button>
    </div>
  );
}

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

export default function CourseDepartment({ onUnsavedChange }: CourseDepartmentProps) {
  const [subTab, setSubTab] = useState<SubTab>('departments');
  
  const { data: departments, loading: loadingDepts } = useDepartments();
  const { data: courses, loading: loadingCourses } = useCourses();
  const { data: sections, loading: loadingSections } = useSections();

  const [deptArchivedView, setDeptArchivedView] = useState(false);
  const [courseArchivedView, setCourseArchivedView] = useState(false);
  const [sectionArchivedView, setSectionArchivedView] = useState(false);

  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [deleteText, setDeleteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [deptForm, setDeptForm] = useState<{ name: string; code: string; academicLevel: AcademicLevel }>({
    name: '',
    code: '',
    academicLevel: 'COLLEGE',
  });
  const [courseForm, setCourseForm] = useState<{
    name: string;
    code: string;
    departmentId: string;
    academicLevel: AcademicLevel;
    yearLevels: number;
  }>({
    name: '',
    code: '',
    departmentId: '',
    academicLevel: 'COLLEGE',
    yearLevels: 4,
  });
  const [sectionForm, setSectionForm] = useState<{ name: string; courseId: string; yearLevel: number }>({
    name: '',
    courseId: '',
    yearLevel: 1,
  });

  const close = () => { if(!isSaving) { setModal({ type: 'none' }); setDeleteText(''); } };
  const change = () => onUnsavedChange();

  const activeDepts = departments.filter(d => !d.archived);
  const archivedDepts = departments.filter(d => d.archived);
  const activeCourses = courses.filter(c => !c.archived);
  const archivedCourses = courses.filter(c => c.archived);
  const activeSections = sections.filter(s => !s.archived);
  const archivedSections = sections.filter(s => s.archived);

  const getDept = (id: string) => departments.find(d => d.id === id);
  const getDeptName = (id: string) => getDept(id)?.name ?? '—';
  const getCourse = (id: string) => courses.find(c => c.id === id);
  const getCourseCode = (id: string) => getCourse(id)?.code ?? '—';
  const getCourseDept = (id: string) => { const c = getCourse(id); return c ? getDeptName(c.departmentId) : '—'; };

  const isShsCourse = (course?: CourseDocument) => {
    if (!course) return false;
    const dept = getDept(course.departmentId);
    return (
      course.academicLevel === 'SHS' ||
      dept?.academicLevel === 'SHS' ||
      course.code.toUpperCase().includes('SHS') ||
      course.code.toUpperCase().includes('STEM') ||
      course.code.toUpperCase().includes('ABM') ||
      course.code.toUpperCase().includes('HUMSS') ||
      course.code.toUpperCase().includes('TVL') ||
      course.code.toUpperCase().includes('GAS') ||
      dept?.name.toLowerCase().includes('senior high')
    );
  };

  const handleSaveDept = async () => {
    setIsSaving(true);
    try {
      if (modal.type === 'add-dept') {
        await createDepartment({ name: deptForm.name, code: deptForm.code, academicLevel: deptForm.academicLevel });
      } else if (modal.type === 'edit-dept') {
        await updateDepartment(modal.item.id, { name: deptForm.name, code: deptForm.code, academicLevel: deptForm.academicLevel });
      }
      change(); close();
    } catch (e) {
      console.error(e);
      alert('Failed to save department.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCourse = async () => {
    setIsSaving(true);
    try {
      if (modal.type === 'add-course') {
        await createCourse({ ...courseForm });
      } else if (modal.type === 'edit-course') {
        await updateCourse(modal.item.id, { ...courseForm });
      }
      change(); close();
    } catch (e) {
      console.error(e);
      alert('Failed to save course.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSection = async () => {
    setIsSaving(true);
    try {
      const course = getCourse(sectionForm.courseId);
      if (!course) throw new Error("Course not found");

      if (modal.type === 'add-section') {
        await createSection({ 
          name: sectionForm.name, 
          courseId: sectionForm.courseId, 
          departmentId: course.departmentId, 
          yearLevel: Number(sectionForm.yearLevel)
        });
      } else if (modal.type === 'edit-section') {
        await updateSection(modal.item.id, { 
          name: sectionForm.name,
          courseId: sectionForm.courseId,
          departmentId: course.departmentId,
          yearLevel: Number(sectionForm.yearLevel)
        });
      }
      change(); close();
    } catch (e) {
      console.error(e);
      alert('Failed to save section.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAction = async (actionFn: () => Promise<void>) => {
    setIsSaving(true);
    try {
      await actionFn();
      change(); close();
    } catch (e) {
      console.error(e);
      alert('Operation failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const isLoadingAny = loadingDepts || loadingCourses || loadingSections;

  if (isLoadingAny) {
    return <div className="p-6 text-gray-500">Loading academic data...</div>;
  }

  // Format year level for presentation in table
  const formatSectionYear = (sec: SectionDocument) => {
    const course = getCourse(sec.courseId);
    const shs = isShsCourse(course);
    if (shs) {
      if (sec.yearLevel === 11 || sec.yearLevel === 1) return 'Grade 11';
      if (sec.yearLevel === 12 || sec.yearLevel === 2) return 'Grade 12';
      return `Grade ${sec.yearLevel}`;
    }
    if (sec.yearLevel === 1) return '1st Year';
    if (sec.yearLevel === 2) return '2nd Year';
    if (sec.yearLevel === 3) return '3rd Year';
    if (sec.yearLevel === 4) return '4th Year';
    if (sec.yearLevel === 5) return '5th Year';
    return `Year ${sec.yearLevel}`;
  };

  const selectedCourseForSection = getCourse(sectionForm.courseId);
  const selectedCourseIsShs = isShsCourse(selectedCourseForSection);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Course & Department Registry</h2>
        <p className="text-sm text-gray-500 mt-1">Manage College & Senior High School departments, academic programs, and class sections</p>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200">
        {([['departments', 'Departments'], ['courses', 'Courses / Programs'], ['sections', 'Sections']] as [SubTab, string][]).map(([tab, label]) => (
          <button key={tab} onClick={() => setSubTab(tab)}
            className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${subTab === tab ? 'border-[#001A4D] text-[#001A4D]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          DEPARTMENTS
         ═══════════════════════════════════════════════════════════════════════ */}
      {subTab === 'departments' && (
        <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-xs">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-[#001A4D]">Departments</h3>
              <ActiveArchivedTabs active={deptArchivedView} onChange={setDeptArchivedView} />
            </div>
            <button onClick={() => { setDeptForm({ name: '', code: '', academicLevel: 'COLLEGE' }); setModal({ type: 'add-dept' }); }}
              className="px-4 py-2 bg-[#001A4D] text-white rounded-lg text-sm font-medium hover:bg-[#001A4D]/90 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Department
            </button>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Department Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Code</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Track</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Programs</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(deptArchivedView ? archivedDepts : activeDepts).map(dept => {
                const isShs = dept.academicLevel === 'SHS' || dept.name.toLowerCase().includes('senior high') || dept.code === 'SHS';
                return (
                  <tr key={dept.id} className="hover:bg-gray-50 transition-colors"
                    onMouseEnter={() => setHoveredRow(dept.id)} onMouseLeave={() => setHoveredRow(null)}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{dept.name}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{dept.code}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        isShs ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-[#0E4EBD]'
                      }`}>
                        {isShs ? 'SHS' : 'College'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{activeCourses.filter(c => c.departmentId === dept.id).length}</td>
                    <td className="px-4 py-3">
                      <div className={`flex justify-end gap-1 transition-opacity ${hoveredRow === dept.id ? 'opacity-100' : 'opacity-0'}`}>
                        {!dept.archived ? (
                          <>
                            <button onClick={() => {
                              setDeptForm({
                                name: dept.name,
                                code: dept.code,
                                academicLevel: dept.academicLevel || (isShs ? 'SHS' : 'COLLEGE'),
                              });
                              setModal({ type: 'edit-dept', item: dept });
                            }} className="p-1.5 rounded hover:bg-blue-50 text-[#1E70E8]"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => setModal({ type: 'archive-dept', item: dept })} className="p-1.5 rounded hover:bg-amber-50 text-amber-500"><Archive className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setModal({ type: 'restore-dept', item: dept })} className="p-1.5 rounded hover:bg-green-50 text-green-600"><RotateCcw className="w-4 h-4" /></button>
                            <button onClick={() => setModal({ type: 'delete-dept', item: dept })} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(deptArchivedView ? archivedDepts : activeDepts).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No {deptArchivedView ? 'archived' : 'active'} departments.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          COURSES / PROGRAMS
         ═══════════════════════════════════════════════════════════════════════ */}
      {subTab === 'courses' && (
        <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-xs">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-[#001A4D]">Courses & Strands</h3>
              <ActiveArchivedTabs active={courseArchivedView} onChange={setCourseArchivedView} />
            </div>
            <button onClick={() => {
              setCourseForm({ name: '', code: '', departmentId: '', academicLevel: 'COLLEGE', yearLevels: 4 });
              setModal({ type: 'add-course' });
            }}
              className="px-4 py-2 bg-[#001A4D] text-white rounded-lg text-sm font-medium hover:bg-[#001A4D]/90 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Program
            </button>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Program / Strand Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Code</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Track</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Department</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Duration</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(courseArchivedView ? archivedCourses : activeCourses).map(course => {
                const isShs = isShsCourse(course);
                return (
                  <tr key={course.id} className="hover:bg-gray-50 transition-colors"
                    onMouseEnter={() => setHoveredRow(course.id)} onMouseLeave={() => setHoveredRow(null)}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{course.name}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{course.code}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        isShs ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-[#0E4EBD]'
                      }`}>
                        {isShs ? 'SHS' : 'College'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getDeptName(course.departmentId)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {isShs ? '2 Years (Gr. 11-12)' : `${course.yearLevels} Years`}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex justify-end gap-1 transition-opacity ${hoveredRow === course.id ? 'opacity-100' : 'opacity-0'}`}>
                        {!course.archived ? (
                          <>
                            <button onClick={() => {
                              setCourseForm({
                                name: course.name,
                                code: course.code,
                                departmentId: course.departmentId,
                                academicLevel: course.academicLevel || (isShs ? 'SHS' : 'COLLEGE'),
                                yearLevels: course.yearLevels || (isShs ? 2 : 4),
                              });
                              setModal({ type: 'edit-course', item: course });
                            }} className="p-1.5 rounded hover:bg-blue-50 text-[#1E70E8]"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => setModal({ type: 'archive-course', item: course })} className="p-1.5 rounded hover:bg-amber-50 text-amber-500"><Archive className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setModal({ type: 'restore-course', item: course })} className="p-1.5 rounded hover:bg-green-50 text-green-600"><RotateCcw className="w-4 h-4" /></button>
                            <button onClick={() => setModal({ type: 'delete-course', item: course })} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(courseArchivedView ? archivedCourses : activeCourses).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No {courseArchivedView ? 'archived' : 'active'} courses.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTIONS
         ═══════════════════════════════════════════════════════════════════════ */}
      {subTab === 'sections' && (
        <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-xs">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-[#001A4D]">Class Sections</h3>
              <ActiveArchivedTabs active={sectionArchivedView} onChange={setSectionArchivedView} />
            </div>
            <button onClick={() => { setSectionForm({ name: '', courseId: '', yearLevel: 1 }); setModal({ type: 'add-section' }); }}
              className="px-4 py-2 bg-[#001A4D] text-white rounded-lg text-sm font-medium hover:bg-[#001A4D]/90 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Section
            </button>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Section Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Course / Strand</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Track</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Department</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Year Level</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(sectionArchivedView ? archivedSections : activeSections).map(sec => {
                const course = getCourse(sec.courseId);
                const isShs = isShsCourse(course);
                return (
                  <tr key={sec.id} className="hover:bg-gray-50 transition-colors"
                    onMouseEnter={() => setHoveredRow(sec.id)} onMouseLeave={() => setHoveredRow(null)}>
                    <td className="px-4 py-3 text-sm font-mono font-bold text-gray-900">{sec.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getCourseCode(sec.courseId)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        isShs ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-[#0E4EBD]'
                      }`}>
                        {isShs ? 'SHS' : 'College'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getCourseDept(sec.courseId)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{formatSectionYear(sec)}</td>
                    <td className="px-4 py-3">
                      <div className={`flex justify-end gap-1 transition-opacity ${hoveredRow === sec.id ? 'opacity-100' : 'opacity-0'}`}>
                        {!sec.archived ? (
                          <>
                            <button onClick={() => {
                              setSectionForm({ name: sec.name, courseId: sec.courseId, yearLevel: sec.yearLevel });
                              setModal({ type: 'edit-section', item: sec });
                            }} className="p-1.5 rounded hover:bg-blue-50 text-[#1E70E8]"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => setModal({ type: 'archive-section', item: sec })} className="p-1.5 rounded hover:bg-amber-50 text-amber-500"><Archive className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setModal({ type: 'restore-section', item: sec })} className="p-1.5 rounded hover:bg-green-50 text-green-600"><RotateCcw className="w-4 h-4" /></button>
                            <button onClick={() => setModal({ type: 'delete-section', item: sec })} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(sectionArchivedView ? archivedSections : activeSections).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No {sectionArchivedView ? 'archived' : 'active'} sections.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODALS
         ═══════════════════════════════════════════════════════════════════════ */}
      {modal.type !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={close} />

          {/* ADD / EDIT DEPARTMENT */}
          {(modal.type === 'add-dept' || modal.type === 'edit-dept') && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-bold text-lg">
                    {modal.type === 'add-dept' ? 'Add Department' : 'Edit Department'}
                  </h3>
                  {modal.type === 'edit-dept' && (
                    <span className="px-2 py-0.5 bg-[#1E70E8] text-white text-xs rounded-full">Editing: {modal.item.code}</span>
                  )}
                </div>
                <button onClick={close} disabled={isSaving} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-50"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4 text-left">
                {/* Academic Track Toggle */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Academic Track <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeptForm({ ...deptForm, academicLevel: 'COLLEGE' })}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                        deptForm.academicLevel !== 'SHS'
                          ? 'bg-[#001A4D] text-[#FFD41C] border-[#001A4D] shadow-xs'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      College (Tertiary)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeptForm({ ...deptForm, academicLevel: 'SHS' })}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                        deptForm.academicLevel === 'SHS'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Senior High School
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Department Name <span className="text-red-500">*</span></label>
                  <input type="text" value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent disabled:opacity-50"
                    placeholder={deptForm.academicLevel === 'SHS' ? "e.g. Senior High School Department" : "e.g. School of Computer Studies"} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Code <span className="text-red-500">*</span></label>
                  <input type="text" value={deptForm.code} onChange={e => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })} disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#001A4D] focus:border-transparent disabled:opacity-50"
                    placeholder={deptForm.academicLevel === 'SHS' ? "e.g. SHS" : "e.g. SCS"} maxLength={10} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={close} disabled={isSaving} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                  <button onClick={handleSaveDept} disabled={!deptForm.name || !deptForm.code || isSaving}
                    className="flex-1 py-2.5 bg-[#001A4D] text-white rounded-xl text-sm font-bold hover:bg-[#001A4D]/90 disabled:opacity-40">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DEPT CONFIRMS */}
          {modal.type === 'archive-dept' && <ConfirmModal type="archive" name={modal.item.name} isSaving={isSaving} onConfirm={() => handleAction(() => updateDepartment(modal.item.id, { archived: true }))} onClose={close} />}
          {modal.type === 'restore-dept' && <ConfirmModal type="restore" name={modal.item.name} isSaving={isSaving} onConfirm={() => handleAction(() => updateDepartment(modal.item.id, { archived: false }))} onClose={close} />}
          {modal.type === 'delete-dept' && <ConfirmModal type="delete" name={modal.item.name} isSaving={isSaving} onConfirm={() => handleAction(() => deleteDepartment(modal.item.id))} onClose={close} deleteText={deleteText} onDeleteTextChange={setDeleteText} />}

          {/* ADD / EDIT COURSE */}
          {(modal.type === 'add-course' || modal.type === 'edit-course') && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-bold text-lg">
                    {modal.type === 'add-course' ? 'Add Program / Strand' : 'Edit Program / Strand'}
                  </h3>
                  {modal.type === 'edit-course' && (
                    <span className="px-2 py-0.5 bg-[#1E70E8] text-white text-xs rounded-full">Editing: {modal.item.code}</span>
                  )}
                </div>
                <button onClick={close} disabled={isSaving} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-50"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4 text-left">
                {/* Academic Track Toggle */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Academic Track <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCourseForm({
                        ...courseForm,
                        academicLevel: 'COLLEGE',
                        yearLevels: courseForm.yearLevels === 2 ? 4 : courseForm.yearLevels
                      })}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                        courseForm.academicLevel !== 'SHS'
                          ? 'bg-[#001A4D] text-[#FFD41C] border-[#001A4D] shadow-xs'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      College Program
                    </button>
                    <button
                      type="button"
                      onClick={() => setCourseForm({ ...courseForm, academicLevel: 'SHS', yearLevels: 2 })}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                        courseForm.academicLevel === 'SHS'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Senior High Strand
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {courseForm.academicLevel === 'SHS' ? 'Strand Name' : 'Course Name'} <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={courseForm.name} onChange={e => setCourseForm({ ...courseForm, name: e.target.value })} disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent disabled:opacity-50"
                    placeholder={courseForm.academicLevel === 'SHS' ? "e.g. Science, Technology, Engineering, and Mathematics" : "e.g. Bachelor of Science in Information Technology"} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Code <span className="text-red-500">*</span></label>
                  <input type="text" value={courseForm.code} onChange={e => setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })} disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#001A4D] focus:border-transparent disabled:opacity-50"
                    placeholder={courseForm.academicLevel === 'SHS' ? "e.g. STEM" : "e.g. BSIT"} maxLength={10} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Department <span className="text-red-500">*</span></label>
                  <select value={courseForm.departmentId} onChange={e => {
                    const deptId = e.target.value;
                    const dept = getDept(deptId);
                    const isShsDept = dept?.academicLevel === 'SHS' || dept?.name.toLowerCase().includes('senior high') || dept?.code === 'SHS';
                    setCourseForm({
                      ...courseForm,
                      departmentId: deptId,
                      academicLevel: isShsDept ? 'SHS' : courseForm.academicLevel,
                      yearLevels: isShsDept ? 2 : courseForm.yearLevels
                    });
                  }} disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent disabled:opacity-50">
                    <option value="">Select department...</option>
                    {activeDepts.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration (Year Levels)</label>
                  {courseForm.academicLevel === 'SHS' ? (
                    <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-600 font-medium">
                      2 Years (Grade 11 & Grade 12)
                    </div>
                  ) : (
                    <select value={courseForm.yearLevels} onChange={e => setCourseForm({ ...courseForm, yearLevels: Number(e.target.value) })} disabled={isSaving}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent disabled:opacity-50">
                      {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n} years</option>)}
                    </select>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={close} disabled={isSaving} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                  <button onClick={handleSaveCourse} disabled={!courseForm.name || !courseForm.code || !courseForm.departmentId || isSaving}
                    className="flex-1 py-2.5 bg-[#001A4D] text-white rounded-xl text-sm font-bold hover:bg-[#001A4D]/90 disabled:opacity-40">
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* COURSE CONFIRMS */}
          {modal.type === 'archive-course' && <ConfirmModal type="archive" name={modal.item.name} isSaving={isSaving} onConfirm={() => handleAction(() => updateCourse(modal.item.id, { archived: true }))} onClose={close} />}
          {modal.type === 'restore-course' && <ConfirmModal type="restore" name={modal.item.name} isSaving={isSaving} onConfirm={() => handleAction(() => updateCourse(modal.item.id, { archived: false }))} onClose={close} />}
          {modal.type === 'delete-course' && <ConfirmModal type="delete" name={modal.item.name} isSaving={isSaving} onConfirm={() => handleAction(() => deleteCourse(modal.item.id))} onClose={close} deleteText={deleteText} onDeleteTextChange={setDeleteText} />}

          {/* ADD / EDIT SECTION */}
          {(modal.type === 'add-section' || modal.type === 'edit-section') && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">{modal.type === 'add-section' ? 'Add Section' : 'Edit Section'}</h3>
                {modal.type === 'edit-section' && (
                  <span className="px-2 py-0.5 bg-[#1E70E8] text-white text-xs rounded-full">Editing: {modal.item.name}</span>
                )}
                <button onClick={close} disabled={isSaving} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-50"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4 text-left">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Program / Strand <span className="text-red-500">*</span></label>
                  <select value={sectionForm.courseId} onChange={e => {
                    const cId = e.target.value;
                    const c = getCourse(cId);
                    const shs = isShsCourse(c);
                    setSectionForm({
                      ...sectionForm,
                      courseId: cId,
                      yearLevel: shs ? 11 : 1
                    });
                  }} disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent disabled:opacity-50">
                    <option value="">Select course / strand...</option>
                    {activeCourses.map(c => (
                      <option key={c.id} value={c.id}>
                        {isShsCourse(c) ? '[SHS] ' : '[College] '}
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                {sectionForm.courseId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Department & Track</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 flex items-center justify-between">
                      <span>{getDeptName(getCourse(sectionForm.courseId)?.departmentId ?? '')}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        selectedCourseIsShs ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-[#0E4EBD]'
                      }`}>
                        {selectedCourseIsShs ? 'Senior High Track' : 'College Track'}
                      </span>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Year Level <span className="text-red-500">*</span></label>
                  <select value={sectionForm.yearLevel} onChange={e => setSectionForm({ ...sectionForm, yearLevel: Number(e.target.value) })} disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent disabled:opacity-50">
                    {selectedCourseIsShs ? (
                      <>
                        <option value={11}>Grade 11</option>
                        <option value={12}>Grade 12</option>
                      </>
                    ) : (
                      Array.from({ length: selectedCourseForSection?.yearLevels || 4 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>
                          {n === 1 ? '1st Year' : n === 2 ? '2nd Year' : n === 3 ? '3rd Year' : `${n}th Year`}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Section Name <span className="text-red-500">*</span></label>
                  <input type="text" value={sectionForm.name} onChange={e => setSectionForm({ ...sectionForm, name: e.target.value })} disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent font-mono disabled:opacity-50"
                    placeholder={selectedCourseIsShs ? "e.g. STEM 11-A or ABM 1101" : "e.g. BSIT 1101 or BSOA 2101"} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={close} disabled={isSaving} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                  <button onClick={handleSaveSection} disabled={!sectionForm.courseId || !sectionForm.name.trim() || isSaving}
                    className="flex-1 py-2.5 bg-[#001A4D] text-white rounded-xl text-sm font-bold hover:bg-[#001A4D]/90 disabled:opacity-40">
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION CONFIRMS */}
          {modal.type === 'archive-section' && <ConfirmModal type="archive" name={modal.item.name} isSaving={isSaving} onConfirm={() => handleAction(() => updateSection(modal.item.id, { archived: true }))} onClose={close} />}
          {modal.type === 'restore-section' && <ConfirmModal type="restore" name={modal.item.name} isSaving={isSaving} onConfirm={() => handleAction(() => updateSection(modal.item.id, { archived: false }))} onClose={close} />}
          {modal.type === 'delete-section' && <ConfirmModal type="delete" name={modal.item.name} isSaving={isSaving} onConfirm={() => handleAction(() => deleteSection(modal.item.id))} onClose={close} deleteText={deleteText} onDeleteTextChange={setDeleteText} />}
        </div>
      )}
    </div>
  );
}
