import { useState } from 'react';
import { Plus, Archive, RotateCcw, Trash2, Edit2, X, AlertTriangle, GripVertical } from 'lucide-react';
import { formatAppDate } from '../../../utils/date';

interface AcademicYearSemesterProps {
  onUnsavedChange: () => void;
}

interface Semester {
  id: string;
  academicYear: string;
  semester: string;
  startDate: string;
  endDate: string;
  label: string;
  status: 'Active' | 'Upcoming' | 'Completed';
  archived: boolean;
}

interface GradePeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  restrictEvents: boolean;
  order: number;
  archived: boolean;
}

type SemModal =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; item: Semester }
  | { type: 'archive'; item: Semester }
  | { type: 'restore'; item: Semester }
  | { type: 'delete'; item: Semester };

type GradeModal =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; item: GradePeriod }
  | { type: 'archive'; item: GradePeriod }
  | { type: 'restore'; item: GradePeriod }
  | { type: 'delete'; item: GradePeriod };

const INIT_SEMS: Semester[] = [
  { id: 's1', academicYear: '2025–2026', semester: '1st Semester', startDate: '2025-08-01', endDate: '2025-12-20', label: 'AY2025-2026-1S', status: 'Completed', archived: false },
  { id: 's2', academicYear: '2025–2026', semester: '2nd Semester', startDate: '2026-01-06', endDate: '2026-05-31', label: 'AY2025-2026-2S', status: 'Completed', archived: false },
  { id: 's3', academicYear: '2026–2027', semester: '1st Semester', startDate: '2026-08-03', endDate: '2026-12-19', label: 'AY2026-2027-1S', status: 'Active', archived: false },
];

const INIT_GRADES: GradePeriod[] = [
  { id: 'g1', name: 'Prelim', startDate: '2026-08-03', endDate: '2026-09-20', restrictEvents: false, order: 1, archived: false },
  { id: 'g2', name: 'Midterm', startDate: '2026-09-21', endDate: '2026-11-07', restrictEvents: true, order: 2, archived: false },
  { id: 'g3', name: 'Finals', startDate: '2026-11-08', endDate: '2026-12-19', restrictEvents: true, order: 3, archived: false },
];

function ActiveArchivedTabs({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
      <button onClick={() => onChange(false)} className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${!active ? 'bg-white text-[#001A4D] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Active</button>
      <button onClick={() => onChange(true)} className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${active ? 'bg-white text-[#001A4D] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Archived</button>
    </div>
  );
}

export default function AcademicYearSemester({ onUnsavedChange }: AcademicYearSemesterProps) {
  const [semesters, setSemesters] = useState<Semester[]>(INIT_SEMS);
  const [gradePeriods, setGradePeriods] = useState<GradePeriod[]>(INIT_GRADES);

  const [semArchivedView, setSemArchivedView] = useState(false);
  const [gradeArchivedView, setGradeArchivedView] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const [semModal, setSemModal] = useState<SemModal>({ type: 'none' });
  const [gradeModal, setGradeModal] = useState<GradeModal>({ type: 'none' });
  const [deleteText, setDeleteText] = useState('');

  const [semForm, setSemForm] = useState({ academicYear: '', semester: '1st Semester', startDate: '', endDate: '', label: '', status: 'Upcoming' as Semester['status'] });
  const [gradeForm, setGradeForm] = useState({ name: '', startDate: '', endDate: '', restrictEvents: false, order: 1 });

  const closeSem = () => { setSemModal({ type: 'none' }); setDeleteText(''); };
  const closeGrade = () => { setGradeModal({ type: 'none' }); setDeleteText(''); };
  const change = () => onUnsavedChange();

  const activeSems = semesters.filter(s => !s.archived);
  const archivedSems = semesters.filter(s => s.archived);
  const activeGrades = gradePeriods.filter(g => !g.archived).sort((a, b) => a.order - b.order);
  const archivedGrades = gradePeriods.filter(g => g.archived);

  const statusPill = (s: Semester['status']) =>
    s === 'Active' ? 'bg-green-100 text-green-700' :
    s === 'Upcoming' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600';

  const saveSem = () => {
    if (semModal.type === 'add') setSemesters([...semesters, { id: `s${Date.now()}`, ...semForm, archived: false }]);
    else if (semModal.type === 'edit') setSemesters(semesters.map(s => s.id === semModal.item.id ? { ...s, ...semForm } : s));
    change(); closeSem();
  };

  const saveGrade = () => {
    if (gradeModal.type === 'add') setGradePeriods([...gradePeriods, { id: `g${Date.now()}`, ...gradeForm, archived: false }]);
    else if (gradeModal.type === 'edit') setGradePeriods(gradePeriods.map(g => g.id === gradeModal.item.id ? { ...g, ...gradeForm } : g));
    change(); closeGrade();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Academic Year & Semester</h2>
        <p className="text-sm text-gray-500 mt-1">Manage semester records and grade periods</p>
      </div>

      {/* SEMESTER TABLE */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-[#001A4D]">Semester History</h3>
            <ActiveArchivedTabs active={semArchivedView} onChange={setSemArchivedView} />
          </div>
          <button onClick={() => { setSemForm({ academicYear: '', semester: '1st Semester', startDate: '', endDate: '', label: '', status: 'Upcoming' }); setSemModal({ type: 'add' }); }}
            className="px-4 py-2 bg-[#001A4D] text-white rounded-lg text-sm font-medium hover:bg-[#001A4D]/90 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Semester
          </button>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Academic Year</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Semester</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Period</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Label</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Status</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(semArchivedView ? archivedSems : activeSems).map(sem => (
              <tr key={sem.id} className="hover:bg-gray-50 transition-colors"
                onMouseEnter={() => setHoveredRow(sem.id)} onMouseLeave={() => setHoveredRow(null)}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{sem.academicYear}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{sem.semester}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{sem.startDate} → {sem.endDate}</td>
                <td className="px-4 py-3 text-xs font-mono text-gray-600">{sem.label}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusPill(sem.status)}`}>{sem.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className={`flex justify-end gap-1 transition-opacity ${hoveredRow === sem.id ? 'opacity-100' : 'opacity-0'}`}>
                    {!sem.archived ? (
                      <>
                        <button onClick={() => { setSemForm({ academicYear: sem.academicYear, semester: sem.semester, startDate: sem.startDate, endDate: sem.endDate, label: sem.label, status: sem.status }); setSemModal({ type: 'edit', item: sem }); }} className="p-1.5 rounded hover:bg-blue-50 text-[#1E70E8]"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setSemModal({ type: 'archive', item: sem })} className="p-1.5 rounded hover:bg-amber-50 text-amber-500"><Archive className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setSemModal({ type: 'restore', item: sem })} className="p-1.5 rounded hover:bg-green-50 text-green-600"><RotateCcw className="w-4 h-4" /></button>
                        <button onClick={() => setSemModal({ type: 'delete', item: sem })} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(semArchivedView ? archivedSems : activeSems).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No {semArchivedView ? 'archived' : 'active'} semesters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* GRADE PERIODS */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-[#001A4D]">Grade Periods</h3>
            <ActiveArchivedTabs active={gradeArchivedView} onChange={setGradeArchivedView} />
          </div>
          <button onClick={() => { setGradeForm({ name: '', startDate: '', endDate: '', restrictEvents: false, order: activeGrades.length + 1 }); setGradeModal({ type: 'add' }); }}
            className="px-4 py-2 bg-[#001A4D] text-white rounded-lg text-sm font-medium hover:bg-[#001A4D]/90 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Grade Period
          </button>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-8"></th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Period Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Start Date</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">End Date</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">Restrict Events</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(gradeArchivedView ? archivedGrades : activeGrades).map(gp => (
              <tr key={gp.id} className="hover:bg-gray-50 transition-colors"
                onMouseEnter={() => setHoveredRow(gp.id)} onMouseLeave={() => setHoveredRow(null)}>
                <td className="px-4 py-3"><GripVertical className="w-4 h-4 text-gray-300" /></td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{gp.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{gp.startDate}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{gp.endDate}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${gp.restrictEvents ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                    {gp.restrictEvents ? 'Restricted' : 'Allowed'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className={`flex justify-end gap-1 transition-opacity ${hoveredRow === gp.id ? 'opacity-100' : 'opacity-0'}`}>
                    {!gp.archived ? (
                      <>
                        <button onClick={() => { setGradeForm({ name: gp.name, startDate: gp.startDate, endDate: gp.endDate, restrictEvents: gp.restrictEvents, order: gp.order }); setGradeModal({ type: 'edit', item: gp }); }} className="p-1.5 rounded hover:bg-blue-50 text-[#1E70E8]"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setGradeModal({ type: 'archive', item: gp })} className="p-1.5 rounded hover:bg-amber-50 text-amber-500"><Archive className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setGradeModal({ type: 'restore', item: gp })} className="p-1.5 rounded hover:bg-green-50 text-green-600"><RotateCcw className="w-4 h-4" /></button>
                        <button onClick={() => setGradeModal({ type: 'delete', item: gp })} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(gradeArchivedView ? archivedGrades : activeGrades).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No {gradeArchivedView ? 'archived' : 'active'} grade periods.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SEMESTER MODALS */}
      {semModal.type !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeSem} />
          {(semModal.type === 'add' || semModal.type === 'edit') && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-bold text-lg">{semModal.type === 'add' ? 'Add Academic Semester' : 'Edit Academic Semester'}</h3>
                  {semModal.type === 'edit' && <span className="px-2 py-0.5 bg-[#1E70E8] text-white text-xs rounded-full">Editing: {semModal.item.label}</span>}
                </div>
                <button onClick={closeSem} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Academic Year <span className="text-red-500">*</span></label>
                  <input type="text" value={semForm.academicYear} onChange={e => setSemForm({ ...semForm, academicYear: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" placeholder="e.g. 2026–2027" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Semester <span className="text-red-500">*</span></label>
                  <select value={semForm.semester} onChange={e => setSemForm({ ...semForm, semester: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent">
                    <option>1st Semester</option><option>2nd Semester</option><option>Summer Term</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date <span className="text-red-500">*</span></label>
                    <input type="date" value={semForm.startDate} onChange={e => setSemForm({ ...semForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date <span className="text-red-500">*</span></label>
                    <input type="date" value={semForm.endDate} onChange={e => setSemForm({ ...semForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Academic Year Label <span className="text-red-500">*</span></label>
                  <input type="text" value={semForm.label} onChange={e => setSemForm({ ...semForm, label: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" placeholder="e.g. AY2026-2027-1S" />
                  <p className="text-xs text-gray-400 mt-1">Used in all reports and exports.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="flex gap-4">
                    {(['Active', 'Upcoming', 'Completed'] as Semester['status'][]).map(s => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={semForm.status === s} onChange={() => setSemForm({ ...semForm, status: s })} className="accent-[#001A4D]" />
                        <span className="text-sm text-gray-700">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {semModal.type === 'edit' && <p className="text-xs text-gray-400 italic">Last modified: {formatAppDate(new Date())}</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={closeSem} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={saveSem} disabled={!semForm.academicYear || !semForm.startDate || !semForm.endDate || !semForm.label}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer shadow-xs">
                    {semModal.type === 'add' ? 'Save' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {semModal.type === 'archive' && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Archive Semester</h3>
                <button onClick={closeSem} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-700 mb-4">Archive <span className="font-bold">{semModal.item.label}</span>? It can be restored later.</p>
                <div className="flex gap-3">
                  <button onClick={closeSem} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={() => { setSemesters(semesters.map(s => s.id === semModal.item.id ? { ...s, archived: true } : s)); change(); closeSem(); }} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600">Archive</button>
                </div>
              </div>
            </div>
          )}
          {semModal.type === 'restore' && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Restore Semester</h3>
                <button onClick={closeSem} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-700 mb-4">Restore <span className="font-bold">{semModal.item.label}</span>?</p>
                <div className="flex gap-3">
                  <button onClick={closeSem} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={() => { setSemesters(semesters.map(s => s.id === semModal.item.id ? { ...s, archived: false } : s)); change(); closeSem(); }} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700">Restore</button>
                </div>
              </div>
            </div>
          )}
          {semModal.type === 'delete' && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-orange-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Permanently Delete</h3>
                <button onClick={closeSem} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">Permanently delete <span className="font-bold">{semModal.item.label}</span>? This cannot be undone.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type <span className="font-mono font-bold">DELETE</span> to confirm</label>
                  <input type="text" value={deleteText} onChange={e => setDeleteText(e.target.value)} className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm font-mono" />
                </div>
                <div className="flex gap-3">
                  <button onClick={closeSem} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={() => { setSemesters(semesters.filter(s => s.id !== semModal.item.id)); change(); closeSem(); }} disabled={deleteText !== 'DELETE'}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-40">Delete Forever</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GRADE PERIOD MODALS */}
      {gradeModal.type !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeGrade} />
          {(gradeModal.type === 'add' || gradeModal.type === 'edit') && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-bold text-lg">{gradeModal.type === 'add' ? 'Add Grade Period' : 'Edit Grade Period'}</h3>
                  {gradeModal.type === 'edit' && <span className="px-2 py-0.5 bg-[#1E70E8] text-white text-xs rounded-full">Editing: {gradeModal.item.name}</span>}
                </div>
                <button onClick={closeGrade} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Period Name <span className="text-red-500">*</span></label>
                  <input type="text" value={gradeForm.name} onChange={e => setGradeForm({ ...gradeForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" placeholder="e.g. Prelim / Midterm / Finals" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                    <input type="date" value={gradeForm.startDate} onChange={e => setGradeForm({ ...gradeForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
                    <input type="date" value={gradeForm.endDate} onChange={e => setGradeForm({ ...gradeForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Order / Sequence</label>
                  <input type="number" value={gradeForm.order} onChange={e => setGradeForm({ ...gradeForm, order: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#001A4D] focus:border-transparent" min={1} />
                </div>
                <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Restrict Events to This Period</p>
                    <p className="text-xs text-gray-400 mt-0.5">Block event proposals during this grade period</p>
                  </div>
                  <button onClick={() => setGradeForm({ ...gradeForm, restrictEvents: !gradeForm.restrictEvents })}
                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${gradeForm.restrictEvents ? 'bg-[#001A4D]' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${gradeForm.restrictEvents ? 'translate-x-5' : ''}`} />
                  </button>
                </label>
                <div className="flex gap-3 pt-2">
                  <button onClick={closeGrade} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={saveGrade} disabled={!gradeForm.name}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer shadow-xs">
                    {gradeModal.type === 'add' ? 'Save' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {gradeModal.type === 'archive' && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Archive Grade Period</h3>
                <button onClick={closeGrade} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-700 mb-4">Archive <span className="font-bold">{gradeModal.item.name}</span>?</p>
                <div className="flex gap-3">
                  <button onClick={closeGrade} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={() => { setGradePeriods(gradePeriods.map(g => g.id === gradeModal.item.id ? { ...g, archived: true } : g)); change(); closeGrade(); }} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600">Archive</button>
                </div>
              </div>
            </div>
          )}
          {gradeModal.type === 'restore' && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Restore Grade Period</h3>
                <button onClick={closeGrade} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-700 mb-4">Restore <span className="font-bold">{gradeModal.item.name}</span>?</p>
                <div className="flex gap-3">
                  <button onClick={closeGrade} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={() => { setGradePeriods(gradePeriods.map(g => g.id === gradeModal.item.id ? { ...g, archived: false } : g)); change(); closeGrade(); }} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700">Restore</button>
                </div>
              </div>
            </div>
          )}
          {gradeModal.type === 'delete' && (
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-orange-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">Permanently Delete</h3>
                <button onClick={closeGrade} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">Permanently delete <span className="font-bold">{gradeModal.item.name}</span>?</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type <span className="font-mono font-bold">DELETE</span> to confirm</label>
                  <input type="text" value={deleteText} onChange={e => setDeleteText(e.target.value)} className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm font-mono" />
                </div>
                <div className="flex gap-3">
                  <button onClick={closeGrade} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={() => { setGradePeriods(gradePeriods.filter(g => g.id !== gradeModal.item.id)); change(); closeGrade(); }} disabled={deleteText !== 'DELETE'}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-40">Delete Forever</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
