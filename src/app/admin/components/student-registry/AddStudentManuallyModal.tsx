/**
 * AddStudentManuallyModal.tsx
 *
 * 5-step wizard for the SAO Admin to manually register a student who
 * does not have a mobile device.
 *
 * Steps:
 *  1. Personal Information
 *  2. Academic Details
 *  3. Account Credentials
 *  4. Profile Photo
 *  5. School ID Photo
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  User,
  BookOpen,
  Lock,
  Camera,
  CreditCard,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Info,
  Upload,
  Phone,
  Mail,
  Building,
  Users,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { createStudentManually } from '../../../modules/students/services/student.service';
import { uploadToCloudinary } from '../../../../services/cloudinary';
import { useDepartments, useCourses, useSections, useSemesters } from '../../../modules/academic/hooks/useAcademicStream';
import type {
  StudentSex,
  StudentYearLevel,
  StudentSemester,
} from '../../../modules/students/types/student.types';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  // Step 1
  lastName: string;
  firstName: string;
  middleName: string;
  studentId: string;
  dateOfBirth: string;
  sex: StudentSex | '';
  contactNumber: string;
  // Step 2
  courseId: string;
  courseName: string;
  courseCode: string;
  departmentId: string;
  departmentName: string;
  yearLevel: StudentYearLevel | '';
  section: string;
  schoolYear: string;
  semester: StudentSemester | '';
  // Step 3
  email: string;
  password: string;
  confirmPassword: string;
  // Step 4
  profilePhotoUrl: string;
  // Step 5
  schoolIdPhotoUrl: string;
}

const INITIAL_FORM: FormData = {
  lastName: '', firstName: '', middleName: '', studentId: '',
  dateOfBirth: '', sex: '', contactNumber: '',
  courseId: '', courseName: '', courseCode: '', departmentId: '', departmentName: '',
  yearLevel: '', section: '', schoolYear: '', semester: '',
  email: '', password: '', confirmPassword: '',
  profilePhotoUrl: '',
  schoolIdPhotoUrl: '',
};

const YEAR_LEVELS: StudentYearLevel[] = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const SEMESTERS: StudentSemester[] = ['1st Semester', '2nd Semester'];

// ─── Password strength ────────────────────────────────────────────────────────
function getPasswordStrength(pw: string) {
  const criteria = {
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const met = Object.values(criteria).filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['', '#EF4444', '#FFC107', '#22C55E', '#16A34A'];
  return { criteria, met, label: labels[met] ?? '', color: colors[met] ?? '#E0E0E0' };
}

// ─── Step indicators ──────────────────────────────────────────────────────────
const STEPS = [
  { icon: User, label: 'Personal Info' },
  { icon: BookOpen, label: 'Academic' },
  { icon: Lock, label: 'Credentials' },
  { icon: Camera, label: 'Profile Photo' },
  { icon: CreditCard, label: 'School ID' },
];

// ─── Shared input style ───────────────────────────────────────────────────────
const inputCls = (hasError: boolean) =>
  `w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] transition-colors ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
  }`;

// ─── Label helper ─────────────────────────────────────────────────────────────
function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
      {children}
      {optional && (
        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Optional</span>
      )}
    </label>
  );
}

// ─── Icon prefix wrapper ──────────────────────────────────────────────────────
function InputIcon({ icon: Icon, children, error }: { icon: React.FC<React.SVGProps<SVGSVGElement>>; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1">
      <div className="relative">
        <Icon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="[&>input]:pl-9 [&>select]:pl-9">{children}</div>
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AddStudentManuallyModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'submit', string>>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Firestore streams for courses / departments / sections / semesters
  const { data: courses } = useCourses();
  const { data: departments } = useDepartments();
  const { data: sections } = useSections();
  const { data: semesters } = useSemesters();

  const activeCourses = courses.filter((c) => !c.archived);
  const activeSections = sections.filter((s) => !s.archived && s.courseId === form.courseId);
  const schoolYears = Array.from(new Set(semesters.map(s => s.academicYear))).sort().reverse();

  // Auto-select active semester
  useEffect(() => {
    if (semesters.length > 0 && !form.schoolYear && !form.semester) {
      const activeSem = semesters.find(s => s.status === 'ACTIVE');
      if (activeSem) {
        setForm(f => ({
          ...f,
          schoolYear: activeSem.academicYear,
          semester: activeSem.semester as StudentSemester,
        }));
      }
    }
  }, [semesters, form.schoolYear, form.semester]);

  // Password strength
  const pwStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  // ── field setters ───────────────────────────────────────────────────────────
  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  // ── course selection → auto-fill department ─────────────────────────────────
  function selectCourse(courseId: string) {
    const course = activeCourses.find((c) => c.id === courseId);
    if (!course) return;
    const dept = departments.find((d) => d.id === course.departmentId);
    setForm((f) => ({
      ...f,
      courseId,
      courseName: course.name,
      courseCode: course.code,
      departmentId: course.departmentId,
      departmentName: dept?.name ?? '',
    }));
    setErrors((e) => ({ ...e, courseId: '', departmentId: '' }));
  }

  // ─── Validation per step ──────────────────────────────────────────────────
  function validateStep(s: number): Partial<Record<keyof FormData, string>> {
    const errs: Partial<Record<keyof FormData, string>> = {};

    if (s === 0) {
      if (!form.lastName.trim()) errs.lastName = 'Last name is required.';
      if (!form.firstName.trim()) errs.firstName = 'First name is required.';
      if (!form.studentId.trim()) errs.studentId = 'Student ID is required.';
      if (!/^\d{11}$/.test(form.studentId.trim()))
        errs.studentId = 'Student ID must be exactly 11 digits (e.g. 02000258377).';
      if (!form.dateOfBirth) errs.dateOfBirth = 'Date of birth is required.';
      if (!form.sex) errs.sex = 'Please select a sex.';
      if (!form.contactNumber.trim()) errs.contactNumber = 'Contact number is required.';
      if (!/^9\d{9}$/.test(form.contactNumber.replace(/\s/g, '')))
        errs.contactNumber = 'Enter a valid 10-digit PH mobile number starting with 9.';
    }

    if (s === 1) {
      if (!form.courseId) errs.courseId = 'Please select a course.';
      if (!form.yearLevel) errs.yearLevel = 'Please select a year level.';
      if (!form.section.trim()) errs.section = 'Section is required.';
      if (!form.schoolYear) errs.schoolYear = 'Please select a school year.';
      if (!form.semester) errs.semester = 'Please select a semester.';
    }

    if (s === 2) {
      if (!form.email.trim()) errs.email = 'Email is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        errs.email = 'Enter a valid email address.';
      if (!form.password) errs.password = 'Password is required.';
      if (pwStrength.met < 2) errs.password = 'Password is too weak (at least Fair required).';
      if (!form.confirmPassword) errs.confirmPassword = 'Please confirm the password.';
      if (form.password !== form.confirmPassword)
        errs.confirmPassword = 'Passwords do not match.';
    }

    // Steps 3 & 4 (photo) are optional — photos can be uploaded later
    return errs;
  }

  function goNext() {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setStep((s) => s + 1);
  }

  function goBack() { setStep((s) => s - 1); }

  // ─── Final submit ─────────────────────────────────────────────────────────
  async function handleSubmit() {
    const errs = validateStep(2); // re-validate credentials just in case
    if (Object.keys(errs).length > 0) { setErrors(errs); setStep(2); return; }

    setSaving(true);
    try {
      await createStudentManually(
        {
          lastName: form.lastName,
          firstName: form.firstName,
          middleName: form.middleName,
          studentId: form.studentId,
          dateOfBirth: form.dateOfBirth,
          sex: form.sex as StudentSex,
          contactNumber: form.contactNumber.replace(/\s/g, ''),
          courseId: form.courseId,
          courseName: form.courseName,
          courseCode: form.courseCode,
          departmentId: form.departmentId,
          departmentName: form.departmentName,
          yearLevel: form.yearLevel as StudentYearLevel,
          section: form.section,
          schoolYear: form.schoolYear,
          semester: form.semester as StudentSemester,
          email: form.email,
          password: form.password,
          profilePhotoUrl: form.profilePhotoUrl,
          schoolIdPhotoUrl: form.schoolIdPhotoUrl,
        },
        'admin' // TODO: replace with actual admin UID from auth context
      );
      setDone(true);
    } catch (err: unknown) {
      setErrors({ submit: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  // ─── Success screen ───────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[480px] p-10 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#001A4D] mb-2">Student Added!</h2>
          <p className="text-gray-500 text-sm mb-1">
            <strong>{form.firstName} {form.lastName}</strong> has been successfully registered.
          </p>
          <p className="text-gray-400 text-xs mb-2">Student ID: {form.studentId}</p>
          <p className="text-gray-400 text-xs mb-6">
            A welcome email has been sent to <span className="font-medium">{form.email}</span> with a link to set their password.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setForm(INITIAL_FORM); setStep(0); setDone(false); }}
              className="flex-1 px-4 py-3 border border-[#0E4EBD] text-[#0E4EBD] rounded-xl font-medium text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Add Another
            </button>
            <button
              onClick={() => { onSuccess(); onClose(); }}
              className="flex-1 px-4 py-3 bg-[#001A4D] text-white rounded-xl font-medium text-sm hover:bg-[#001A4D]/90 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main modal ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[620px] flex flex-col max-h-[92vh] overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">Add Student Manually</h2>
            <p className="text-white/70 text-xs mt-0.5">
              For students without a mobile device · Step {step + 1} of {STEPS.length}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Step indicator ── */}
        <div className="flex items-center px-6 py-4 border-b border-gray-100 bg-gray-50 gap-1 flex-shrink-0 overflow-x-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={i} className="flex items-center gap-1 flex-shrink-0">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isActive ? 'bg-[#001A4D] text-[#FFD41C]'
                  : isDone ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                  }`}>
                  {isDone ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isDone ? 'text-green-400' : 'text-gray-300'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Global submit error ── */}
        {errors.submit && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{errors.submit}</p>
          </div>
        )}

        {/* ── Step content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ════ STEP 1 — Personal Information ════ */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <p className="font-bold text-[#001A4D] text-base">Personal Information</p>
                <p className="text-gray-500 text-xs mt-0.5">Enter the student's personal and contact details.</p>
              </div>

              {/* Name row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel><User className="w-3.5 h-3.5 text-gray-400" /> Last Name <span className="text-red-500">*</span></FieldLabel>
                  <input
                    type="text"
                    placeholder="Last name"
                    className={inputCls(!!errors.lastName)}
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                  />
                  {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                </div>
                <div>
                  <FieldLabel><User className="w-3.5 h-3.5 text-gray-400" /> First Name <span className="text-red-500">*</span></FieldLabel>
                  <input
                    type="text"
                    placeholder="First name"
                    className={inputCls(!!errors.firstName)}
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                  />
                  {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                </div>
              </div>

              {/* Middle name */}
              <div>
                <FieldLabel optional><User className="w-3.5 h-3.5 text-gray-400" /> Middle Name</FieldLabel>
                <input
                  type="text"
                  placeholder="Middle name"
                  className={inputCls()}
                  value={form.middleName}
                  onChange={(e) => set('middleName', e.target.value)}
                />
              </div>

              {/* Student ID */}
              <div>
                <FieldLabel><CreditCard className="w-3.5 h-3.5 text-gray-400" /> Student ID Number <span className="text-red-500">*</span></FieldLabel>
                <input
                  type="text"
                  placeholder="e.g. 02000123456"
                  className={inputCls(!!errors.studentId)}
                  value={form.studentId}
                  onChange={(e) => set('studentId', e.target.value)}
                />
                {errors.studentId
                  ? <p className="text-red-500 text-xs mt-1">{errors.studentId}</p>
                  : <p className="text-gray-400 text-xs mt-1">Enter your official STI student ID exactly as shown on your ID card.</p>
                }
              </div>

              {/* DOB + Sex */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Date of Birth <span className="text-red-500">*</span></FieldLabel>
                  <input
                    type="date"
                    className={inputCls(!!errors.dateOfBirth)}
                    value={form.dateOfBirth}
                    onChange={(e) => set('dateOfBirth', e.target.value)}
                  />
                  {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</p>}
                </div>
                <div>
                  <FieldLabel>Sex <span className="text-red-500">*</span></FieldLabel>
                  <div className="flex gap-2">
                    {(['Male', 'Female'] as StudentSex[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => set('sex', s)}
                        className={`flex-1 h-[42px] rounded-lg text-sm font-medium border transition-all ${form.sex === s
                          ? 'bg-[#001A4D] text-[#FFD41C] border-[#001A4D]'
                          : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                          }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {errors.sex && <p className="text-red-500 text-xs mt-1">{errors.sex}</p>}
                </div>
              </div>

              {/* Contact */}
              <div>
                <FieldLabel><Phone className="w-3.5 h-3.5 text-gray-400" /> Contact Number <span className="text-red-500">*</span></FieldLabel>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700 font-medium flex-shrink-0">
                    🇵🇭 +63
                  </div>
                  <input
                    type="tel"
                    placeholder="9XX XXX XXXX"
                    className={`flex-1 px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] ${errors.contactNumber ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    value={form.contactNumber}
                    onChange={(e) => set('contactNumber', e.target.value.replace(/[^\d\s]/g, ''))}
                    maxLength={12}
                  />
                </div>
                {errors.contactNumber && <p className="text-red-500 text-xs mt-1">{errors.contactNumber}</p>}
              </div>
            </div>
          )}

          {/* ════ STEP 2 — Academic Details ════ */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="font-bold text-[#001A4D] text-base">Academic Details</p>
                <p className="text-gray-500 text-xs mt-0.5">Select the student's current enrollment information for this semester.</p>
              </div>

              {/* Course */}
              <div>
                <FieldLabel><BookOpen className="w-3.5 h-3.5 text-gray-400" /> Course <span className="text-red-500">*</span></FieldLabel>
                <div className="relative">
                  <BookOpen className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    className={`${inputCls(!!errors.courseId)} pl-9 appearance-none`}
                    value={form.courseId}
                    onChange={(e) => selectCourse(e.target.value)}
                  >
                    <option value="">Select course…</option>
                    {activeCourses.map((c) => (
                      <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                </div>
                {errors.courseId && <p className="text-red-500 text-xs mt-1">{errors.courseId}</p>}
                {form.courseId && (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-[#0E4EBD] rounded-full text-xs font-medium border border-blue-100">
                    <Check className="w-3 h-3" /> {form.courseCode}
                  </div>
                )}
              </div>

              {/* Year Level */}
              <div>
                <FieldLabel>Year Level <span className="text-red-500">*</span></FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {YEAR_LEVELS.map((yl) => (
                    <button
                      key={yl}
                      type="button"
                      onClick={() => set('yearLevel', yl)}
                      className={`h-[52px] rounded-lg text-sm font-medium border transition-all ${form.yearLevel === yl
                        ? 'bg-[#001A4D] text-[#FFD41C] border-[#001A4D]'
                        : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                        }`}
                    >
                      {yl}
                    </button>
                  ))}
                </div>
                {errors.yearLevel && <p className="text-red-500 text-xs mt-1">{errors.yearLevel}</p>}
              </div>

              {/* Section */}
              <div>
                <FieldLabel><Users className="w-3.5 h-3.5 text-gray-400" /> Section <span className="text-red-500">*</span></FieldLabel>
                <div className="relative">
                  <Users className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    className={`${inputCls(!!errors.section)} pl-9 appearance-none`}
                    value={form.section}
                    onChange={(e) => set('section', e.target.value)}
                    disabled={!form.courseId}
                  >
                    <option value="">{form.courseId ? 'Select section…' : 'Select a course first'}</option>
                    {activeSections.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                {errors.section && <p className="text-red-500 text-xs mt-1">{errors.section}</p>}
              </div>

              {/* Department — read-only, auto-filled */}
              <div>
                <FieldLabel><Building className="w-3.5 h-3.5 text-gray-400" /> Department</FieldLabel>
                <div className="relative">
                  <Building className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Lock className="w-3.5 h-3.5 text-gray-300 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    readOnly
                    type="text"
                    value={form.departmentName || 'Auto-filled from selected course'}
                    className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-500 italic"
                  />
                </div>
                <p className="text-gray-400 text-xs mt-1">Auto-filled from your selected course.</p>
              </div>

              {/* Academic Term (School Year & Semester) — read-only, auto-filled */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>School Year</FieldLabel>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-gray-300 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      readOnly
                      type="text"
                      value={form.schoolYear || 'Loading...'}
                      className="w-full px-4 pr-9 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-500 italic"
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>Semester</FieldLabel>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-gray-300 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      readOnly
                      type="text"
                      value={form.semester || 'Loading...'}
                      className="w-full px-4 pr-9 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-500 italic"
                    />
                  </div>
                </div>
              </div>
              <p className="text-gray-400 text-xs mt-0">Auto-filled based on the currently active semester.</p>
              {errors.schoolYear && <p className="text-red-500 text-xs mt-1">{errors.schoolYear}</p>}
              {errors.semester && <p className="text-red-500 text-xs mt-1">{errors.semester}</p>}

              {/* Info card */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2">
                <Info className="w-4 h-4 text-[#0E4EBD] flex-shrink-0 mt-0.5" />
                <p className="text-[#001A4D] text-xs italic leading-relaxed">
                  Your year level and section will need to be re-confirmed at the start of each new semester.
                </p>
              </div>
            </div>
          )}

          {/* ════ STEP 3 — Account Credentials ════ */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="font-bold text-[#001A4D] text-base">Create Account Credentials</p>
                <p className="text-gray-500 text-xs mt-0.5">Set up the student's login email and password.</p>
              </div>

              {/* Email */}
              <div>
                <FieldLabel><Mail className="w-3.5 h-3.5 text-gray-400" /> Email Address <span className="text-red-500">*</span></FieldLabel>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="student@gmail.com"
                    className={`${inputCls(!!errors.email)} pl-9`}
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                  />
                </div>
                {errors.email
                  ? <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  : <p className="text-gray-400 text-xs mt-1">Use a personal email the student has access to — used for notifications and password reset.</p>
                }
              </div>

              {/* Password */}
              <div>
                <FieldLabel><Lock className="w-3.5 h-3.5 text-gray-400" /> Password <span className="text-red-500">*</span></FieldLabel>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Create password"
                    className={`${inputCls(!!errors.password)} pl-9 pr-10`}
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength bar */}
                {form.password && (
                  <div className="mt-2 space-y-1.5">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${(pwStrength.met / 4) * 100}%`, backgroundColor: pwStrength.color }}
                      />
                    </div>
                    <p className="text-xs font-bold" style={{ color: pwStrength.color }}>{pwStrength.label}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { key: 'length', label: '8+ characters' },
                        { key: 'uppercase', label: 'Uppercase' },
                        { key: 'number', label: 'Number' },
                        { key: 'special', label: 'Special character' },
                      ].map(({ key, label }) => {
                        const met = pwStrength.criteria[key as keyof typeof pwStrength.criteria];
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition-all ${met ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-400'
                              }`}
                          >
                            {met ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                            {label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <FieldLabel><Lock className="w-3.5 h-3.5 text-gray-400" /> Confirm Password <span className="text-red-500">*</span></FieldLabel>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showCpw ? 'text' : 'password'}
                    placeholder="Confirm password"
                    className={`${inputCls(!!errors.confirmPassword)} pl-9 pr-10`}
                    value={form.confirmPassword}
                    onChange={(e) => set('confirmPassword', e.target.value)}
                  />
                  <div className="absolute right-10 top-1/2 -translate-y-1/2">
                    {form.confirmPassword && (
                      form.password === form.confirmPassword
                        ? <CheckCircle className="w-4 h-4 text-green-500" />
                        : <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <button type="button" onClick={() => setShowCpw(!showCpw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showCpw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>

              {/* Security info card */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2">
                <Shield className="w-4 h-4 text-[#0E4EBD] flex-shrink-0 mt-0.5" />
                <p className="text-[#001A4D] text-xs italic leading-relaxed">
                  The password is encrypted. STI staff will never ask for the student's password. A welcome email will be sent so they can reset it.
                </p>
              </div>
            </div>
          )}

          {/* ════ STEP 4 — Profile Photo ════ */}
          {step === 3 && (
            <PhotoStep
              title="Take Profile Photo"
              subtitle="This photo is shown to officers during attendance verification. Face must be clearly visible."
              circle
              value={form.profilePhotoUrl}
              onChange={(url) => set('profilePhotoUrl', url)}
              folder="students/profile"
              onUploadingChange={setPhotoUploading}
              requirements={[
                'Face clearly visible and centered',
                'Good lighting, no shadows on face',
                'No sunglasses, hats, or face coverings',
                'Neutral expression, looking at camera',
              ]}
            />
          )}

          {/* ════ STEP 5 — School ID ════ */}
          {step === 4 && (
            <PhotoStep
              title="Upload School ID"
              subtitle="Take a clear photo of the physical STI College Ormoc ID card. Used to verify identity."
              circle={false}
              value={form.schoolIdPhotoUrl}
              onChange={(url) => set('schoolIdPhotoUrl', url)}
              folder="students/school-id"
              onUploadingChange={setPhotoUploading}
              requirements={[
                'Full card visible, no cropping',
                'All text readable',
                'Flat surface, no glare',
                'Show the front side of the ID',
              ]}
            />
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <button
            type="button"
            onClick={step === 0 ? onClose : goBack}
            className="flex items-center gap-1.5 px-5 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          <div className="flex items-center gap-2">
            {/* Dot progress */}
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all ${i === step ? 'w-4 h-2 bg-[#001A4D]' : i < step ? 'w-2 h-2 bg-green-400' : 'w-2 h-2 bg-gray-200'
                  }`}
              />
            ))}
          </div>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={photoUploading}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              {photoUploading ? 'Uploading…' : 'Next'}
              {photoUploading ? <Loader className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || photoUploading}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {saving ? 'Registering…' : photoUploading ? 'Uploading…' : 'Register Student'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Photo Step sub-component ─────────────────────────────────────────────────
interface PhotoStepProps {
  title: string;
  subtitle: string;
  circle: boolean;
  value: string;
  onChange: (url: string) => void;
  folder: string;
  onUploadingChange: (uploading: boolean) => void;
  requirements: string[];
}

function PhotoStep({ title, subtitle, circle, value, onChange, folder, onUploadingChange, requirements }: PhotoStepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  async function handleFile(file: File) {
    setUploadError('');
    setProgress(0);
    setUploading(true);
    onUploadingChange(true);
    try {
      const result = await uploadToCloudinary(file, {
        folder,
        onProgress: setProgress,
      });
      onChange(result.secureUrl);
    } catch (err: unknown) {
      setUploadError((err as Error).message);
      onChange('');
    } finally {
      setUploading(false);
      onUploadingChange(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-bold text-[#001A4D] text-base">{title}</p>
        <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>
      </div>

      {/* Capture area */}
      <div className="flex flex-col items-center gap-4">
        {circle ? (
          /* Profile photo — circle */
          <div className="relative">
            <div className="w-52 h-52 rounded-full border-2 border-dashed border-[#0E4EBD] bg-blue-50/50 flex items-center justify-center overflow-hidden ring-4 ring-[#0E4EBD]/20">
              {uploading ? (
                <div className="text-center">
                  <Loader className="w-10 h-10 text-[#0E4EBD] mx-auto mb-2 animate-spin" />
                  <p className="text-[#0E4EBD] font-bold text-sm">Uploading… {progress}%</p>
                </div>
              ) : value ? (
                <img src={value} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <Camera className="w-12 h-12 text-[#0E4EBD] mx-auto mb-2" />
                  <p className="text-[#001A4D] font-bold text-sm">Tap to capture</p>
                </div>
              )}
            </div>
            {value && !uploading && (
              <div className="absolute bottom-2 right-2 w-7 h-7 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow">
                <Check className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>
        ) : (
          /* School ID — landscape rectangle */
          <div
            className="relative w-full border-2 border-dashed border-[#0E4EBD] bg-blue-50/50 rounded-xl overflow-hidden cursor-pointer"
            style={{ height: 180 }}
            onClick={() => !uploading && fileRef.current?.click()}
          >
            {uploading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <Loader className="w-10 h-10 text-[#0E4EBD] animate-spin" />
                <p className="text-[#0E4EBD] font-bold text-sm">Uploading… {progress}%</p>
              </div>
            ) : value ? (
              <>
                <img src={value} alt="School ID" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 px-2 py-1 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3 text-white" />
                  <span className="text-white text-xs font-medium">ID Uploaded</span>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <CreditCard className="w-12 h-12 text-[#0E4EBD]" />
                <p className="text-[#001A4D] font-bold text-sm">Tap to photograph your ID</p>
                <p className="text-gray-400 text-xs">or upload from gallery</p>
              </div>
            )}
          </div>
        )}

        {uploadError && (
          <div className="w-full p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-xs">{uploadError}</p>
          </div>
        )}

        {value && !uploading && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[#0E4EBD] text-sm hover:underline"
          >
            {circle ? 'Retake' : 'Re-upload'}
          </button>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 w-full">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex-1 h-11 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-sm"
          >
            <Camera className="w-4 h-4" />
            {circle ? 'Take Selfie' : 'Take Photo'}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex-1 h-11 border border-[#0E4EBD] text-[#0E4EBD] rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Upload from Gallery
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture={circle ? 'user' : 'environment'}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = ''; // allow re-selecting the same file
          }}
        />
      </div>

      {/* Requirements */}
      <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
        <div className="flex items-center gap-1.5 mb-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <p className="text-amber-700 font-bold text-xs">Photo Requirements</p>
        </div>
        <ul className="space-y-1">
          {requirements.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
              <span className="text-[#001A4D] text-xs leading-relaxed">{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Skip note */}
      <p className="text-center text-gray-400 text-xs">
        Photos are optional at this stage and can be uploaded later from the student's profile.
      </p>
    </div>
  );
}
