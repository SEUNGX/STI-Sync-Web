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
  Upload,
  Phone,
  Mail,
  Building,
  Users,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { createStudentManually, isEmailTaken } from '../../../modules/students/services/student.service';
import { useStudents } from '../../../modules/students/hooks/useStudentStream';
import { uploadToCloudinary } from '../../../../services/cloudinary';
import { useDepartments, useCourses, useSections, useActiveAcademicPeriods } from '../../../modules/academic/hooks/useAcademicStream';
import type {
  StudentSex,
  StudentYearLevel,
  StudentSemester,
  AcademicLevel,
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
  academicLevel?: AcademicLevel;
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
  sendWelcomeEmail: boolean;
  // Step 4
  profilePhotoUrl: string;
  // Step 5
  schoolIdPhotoUrl: string;
}

const INITIAL_FORM: FormData = {
  lastName: '', firstName: '', middleName: '', studentId: '',
  dateOfBirth: '2005-01-01', sex: '', contactNumber: '',
  academicLevel: 'COLLEGE',
  courseId: '', courseName: '', courseCode: '', departmentId: '', departmentName: '',
  yearLevel: '', section: '', schoolYear: '', semester: '',
  email: '', password: '', confirmPassword: '',
  sendWelcomeEmail: true,
  profilePhotoUrl: '',
  schoolIdPhotoUrl: '',
};

const COLLEGE_YEAR_LEVELS: StudentYearLevel[] = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const SHS_YEAR_LEVELS: StudentYearLevel[] = ['Grade 11', 'Grade 12'];

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
  { icon: Camera, label: 'Photo' },
  { icon: CreditCard, label: 'School ID' },
];

// ─── Shared input style ───────────────────────────────────────────────────────
const inputCls = (hasError: boolean) =>
  `w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] transition-colors ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
  }`;

// ─── Label helper ─────────────────────────────────────────────────────────────
function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-1.5 text-left w-full">
      <label className="text-xs font-bold text-[#001A4D] uppercase tracking-wider flex items-center gap-1.5 text-left">
        {children}
      </label>
      {optional && (
        <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-normal normal-case">Optional</span>
      )}
    </div>
  );
}

// ─── Icon prefix wrapper ──────────────────────────────────────────────────────
function InputIcon({ icon: Icon, children, error }: { icon: React.FC<React.SVGProps<SVGSVGElement>>; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1 text-left">
      <div className="relative">
        <Icon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="[&>input]:pl-9 [&>select]:pl-9">{children}</div>
      </div>
      {error && <p className="text-red-500 text-xs text-left">{error}</p>}
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

  // Firestore streams for students / courses / departments / sections / active periods
  const { data: existingStudents = [] } = useStudents();
  const { data: courses } = useCourses();
  const { data: departments } = useDepartments();
  const { data: sections } = useSections();
  const { activeCollegePeriod, activeShsPeriod } = useActiveAcademicPeriods();

  const activeCourses = useMemo(() => courses.filter((c) => !c.archived), [courses]);
  const currentAcademicLevel = form.academicLevel || 'COLLEGE';

  // Filter courses strictly by chosen Academic Track
  const levelCourses = useMemo(() => {
    return activeCourses.filter((c) => {
      const dept = departments.find((d) => d.id === c.departmentId);
      const isShs =
        c.academicLevel === 'SHS' ||
        dept?.academicLevel === 'SHS' ||
        c.code.toUpperCase().includes('SHS') ||
        c.code.toUpperCase().includes('STEM') ||
        c.code.toUpperCase().includes('ABM') ||
        c.code.toUpperCase().includes('HUMSS') ||
        c.code.toUpperCase().includes('TVL') ||
        c.code.toUpperCase().includes('GAS') ||
        dept?.name.toLowerCase().includes('senior high');

      return currentAcademicLevel === 'SHS' ? isShs : !isShs;
    });
  }, [activeCourses, departments, currentAcademicLevel]);

  const availableYearLevels = currentAcademicLevel === 'SHS' ? SHS_YEAR_LEVELS : COLLEGE_YEAR_LEVELS;

  // Matching sections strictly filtered by selected course and year level
  const matchingSections = useMemo(() => {
    if (!form.courseId) return [];
    return sections.filter((s) => {
      if (s.archived || s.courseId !== form.courseId) return false;
      if (!form.yearLevel) return false;
      const rawYl = String(form.yearLevel);
      const yNum = rawYl.includes('11') ? 11 : rawYl.includes('12') ? 12 : rawYl.includes('1st') ? 1 : rawYl.includes('2nd') ? 2 : rawYl.includes('3rd') ? 3 : rawYl.includes('4th') ? 4 : 1;
      return s.yearLevel === form.yearLevel || Number(s.yearLevel) === yNum;
    });
  }, [sections, form.courseId, form.yearLevel]);

  // Auto-select active semester when academicLevel changes or loads
  useEffect(() => {
    const targetPeriod = currentAcademicLevel === 'SHS' ? activeShsPeriod : activeCollegePeriod;
    if (targetPeriod) {
      setForm((f) => ({
        ...f,
        schoolYear: targetPeriod.academicYear,
        semester: targetPeriod.semester as StudentSemester,
      }));
    }
  }, [activeCollegePeriod, activeShsPeriod, currentAcademicLevel]);

  const handleTrackChange = (level: AcademicLevel) => {
    const targetPeriod = level === 'SHS' ? activeShsPeriod : activeCollegePeriod;
    setForm((f) => ({
      ...f,
      academicLevel: level,
      courseId: '',
      courseName: '',
      courseCode: '',
      departmentId: '',
      departmentName: '',
      yearLevel: '',
      section: '',
      schoolYear: targetPeriod?.academicYear || f.schoolYear,
      semester: (targetPeriod?.semester as StudentSemester) || (level === 'SHS' ? '1st Trimester' : '1st Semester'),
    }));
    setErrors((e) => ({ ...e, courseId: '', yearLevel: '', section: '' }));
  };

  // Password strength
  const pwStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  // ── field setters (clears relevant duplicate errors immediately on change) ──
  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const updated = { ...e, [key]: '' };
      // Clear duplicate validation error if any name or birthday field is edited
      if (key === 'firstName' || key === 'lastName' || key === 'dateOfBirth') {
        delete updated.firstName;
        delete updated.lastName;
        delete updated.dateOfBirth;
      }
      return updated;
    });
  };

  // ── course selection → auto-fill department and reset year/section ───────────
  function selectCourse(courseId: string) {
    const course = levelCourses.find((c) => c.id === courseId);
    if (!course) return;
    const dept = departments.find((d) => d.id === course.departmentId);
    setForm((f) => ({
      ...f,
      courseId,
      courseName: course.name,
      courseCode: course.code,
      departmentId: course.departmentId,
      departmentName: dept?.name ?? '',
      yearLevel: '',
      section: '',
    }));
    setErrors((e) => ({ ...e, courseId: '', departmentId: '', yearLevel: '', section: '' }));
  }

  // ─── Validation per step ──────────────────────────────────────────────────
  function validateStep(s: number): Partial<Record<keyof FormData, string>> {
    const errs: Partial<Record<keyof FormData, string>> = {};

    if (s === 0) {
      if (!form.lastName.trim()) errs.lastName = 'Last name is required.';
      if (!form.firstName.trim()) errs.firstName = 'First name is required.';

      if (!form.studentId.trim()) {
        errs.studentId = 'Student ID is required.';
      } else if (!/^\d{11}$/.test(form.studentId.trim())) {
        errs.studentId = 'Student ID must be exactly 11 digits (e.g. 02000123456).';
      } else {
        const cleanId = form.studentId.trim();
        const idExists = existingStudents.some((st) => (st.studentId || '').trim() === cleanId);
        if (idExists) {
          errs.studentId = 'This Student ID number is already registered in the system.';
        }
      }

      const todayStr = new Date().toISOString().split('T')[0];
      if (!form.dateOfBirth) {
        errs.dateOfBirth = 'Date of birth is required.';
      } else if (form.dateOfBirth > todayStr) {
        errs.dateOfBirth = 'Date of birth cannot be a future date.';
      }

      if (!form.sex) errs.sex = 'Please select a sex.';

      const cleanPhone = form.contactNumber.replace(/\s/g, '');
      if (!form.contactNumber.trim()) {
        errs.contactNumber = 'Contact number is required.';
      } else if (!/^9\d{9}$/.test(cleanPhone)) {
        errs.contactNumber = 'Enter a valid 10-digit PH mobile number starting with 9.';
      } else {
        const phoneExists = existingStudents.some((st) => {
          const stPhone = (st.contactNumber || '').replace(/\s/g, '');
          return (
            stPhone === cleanPhone ||
            stPhone === `+63${cleanPhone}` ||
            stPhone === `0${cleanPhone}` ||
            (stPhone.startsWith('+63') && stPhone.slice(3) === cleanPhone) ||
            (stPhone.startsWith('0') && stPhone.slice(1) === cleanPhone)
          );
        });
        if (phoneExists) {
          errs.contactNumber = 'This contact number is already registered to another student.';
        }
      }

      // Check duplicate Name + Birthday combination (Single clear error on firstName)
      if (form.firstName.trim() && form.lastName.trim() && form.dateOfBirth) {
        const cleanFirst = form.firstName.trim().toLowerCase();
        const cleanLast = form.lastName.trim().toLowerCase();
        const cleanDob = form.dateOfBirth;

        const nameDobExists = existingStudents.some((st) => {
          const stFirst = (st.firstName || '').trim().toLowerCase();
          const stLast = (st.lastName || '').trim().toLowerCase();
          const stDob = st.dateOfBirth || '';
          return stFirst === cleanFirst && stLast === cleanLast && stDob === cleanDob;
        });

        if (nameDobExists) {
          errs.firstName = 'A student with this name and date of birth is already registered.';
        }
      }
    }

    if (s === 1) {
      if (!form.courseId) errs.courseId = 'Please select a course / program.';
      if (!form.yearLevel) errs.yearLevel = 'Please select a year level.';
      if (!form.section.trim()) errs.section = 'Section is required.';
      if (!form.schoolYear) errs.schoolYear = 'Active school year is required.';
      if (!form.semester) errs.semester = 'Active semester / trimester is required.';
    }

    if (s === 2) {
      if (!form.email.trim()) {
        errs.email = 'Email is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errs.email = 'Enter a valid email address.';
      } else {
        const cleanEmail = form.email.trim().toLowerCase();
        const emailExists = existingStudents.some(
          (st) => (st.email || '').trim().toLowerCase() === cleanEmail
        );
        if (emailExists) {
          errs.email = 'This email address is already registered to another student.';
        }
      }
      if (!form.password) errs.password = 'Password is required.';
      if (pwStrength.met < 2) errs.password = 'Password is too weak (at least Fair required).';
      if (!form.confirmPassword) errs.confirmPassword = 'Please confirm the password.';
      if (form.password !== form.confirmPassword)
        errs.confirmPassword = 'Passwords do not match.';
    }

    return errs;
  }

  async function goNext() {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    // When advancing from Step 3 (Credentials), verify email across ALL user roles (admin, adviser, officer, student)
    if (step === 2) {
      setPhotoUploading(true);
      try {
        const taken = await isEmailTaken(form.email);
        if (taken) {
          setErrors((e) => ({
            ...e,
            email: 'This email address is already registered to an existing account (Admin, Adviser, or Student).',
          }));
          setPhotoUploading(false);
          return;
        }
      } catch {
        // Non-fatal, backend will catch if duplicate
      } finally {
        setPhotoUploading(false);
      }
    }

    setStep((s) => s + 1);
  }

  function goBack() { setStep((s) => s - 1); }

  // ─── Final submit ─────────────────────────────────────────────────────────
  async function handleSubmit() {
    const errs = validateStep(2);
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
          academicLevel: currentAcademicLevel,
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
          sendWelcomeEmail: form.sendWelcomeEmail,
          profilePhotoUrl: form.profilePhotoUrl,
          schoolIdPhotoUrl: form.schoolIdPhotoUrl,
        },
        'admin'
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
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[500px] p-8 text-center overflow-hidden">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#001A4D] mb-1">Student Registered!</h2>
          <p className="text-gray-600 text-sm mb-4">
            <strong>{form.firstName} {form.lastName}</strong> has been enrolled and credentials created.
          </p>

          {/* Credentials Display Card */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left mb-5 space-y-2 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <span className="font-bold text-[#001A4D] uppercase tracking-wider">Account Credentials</span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                Requires Password Change
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-gray-700">
              <div>
                <span className="text-gray-400 block text-[11px]">Student ID</span>
                <strong className="text-[#001A4D]">{form.studentId}</strong>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Track & Program</span>
                <strong>{form.courseCode} · {form.yearLevel}</strong>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400 block text-[11px]">Login Email</span>
                <code className="text-[#0E4EBD] font-mono font-bold">{form.email}</code>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400 block text-[11px]">Temporary Password</span>
                <code className="text-amber-700 bg-amber-50 px-2 py-1 rounded font-mono font-bold inline-block border border-amber-200">
                  {form.password}
                </code>
              </div>
            </div>
          </div>

          <p className="text-gray-500 text-xs mb-6 leading-relaxed">
            {form.sendWelcomeEmail ? (
              <>
                An automated email has been sent to <span className="font-medium text-gray-700">{form.email}</span>. The student will be required to change their password upon their first login in the mobile app.
              </>
            ) : (
              <>
                Credentials created without email dispatch. Please provide the temporary password to the student manually. They will change it upon first login in the mobile app.
              </>
            )}
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[620px] max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Manual Student Registration</span>
            <h2 className="text-lg font-bold text-[#001A4D] mt-0.5">{STEPS[step]?.label}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Step Progress Indicator ── */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isDone = i < step;
              const isCurr = i === step;
              return (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isCurr
                        ? 'bg-[#001A4D] text-[#FFD41C] ring-2 ring-[#001A4D]/30 shadow-sm'
                        : isDone
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-400'
                        }`}
                    >
                      {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <span
                      className={`text-[10px] mt-1 font-medium hidden sm:block ${isCurr ? 'text-[#001A4D] font-bold' : isDone ? 'text-green-600' : 'text-gray-400'
                        }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 transition-all ${i < step ? 'bg-green-400' : 'bg-gray-200'
                        }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Step Content (scrollable) ── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Server-level error */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-xs">{errors.submit}</p>
            </div>
          )}

          {/* ════ STEP 1 — Personal Information ════ */}
          {step === 0 && (
            <div className="space-y-4 text-left">
              <div>
                <p className="font-bold text-[#001A4D] text-base">Personal Information</p>
                <p className="text-gray-500 text-xs mt-0.5">Enter the student's legal name, official student ID, and contact info.</p>
              </div>

              {/* Name row: Last, First, Middle */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <FieldLabel>Last Name <span className="text-red-500">*</span></FieldLabel>
                  <input
                    type="text"
                    placeholder="e.g. Dela Cruz"
                    className={inputCls(!!errors.lastName)}
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                  />
                  {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                </div>
                <div>
                  <FieldLabel>First Name <span className="text-red-500">*</span></FieldLabel>
                  <input
                    type="text"
                    placeholder="e.g. Juan"
                    className={inputCls(!!errors.firstName)}
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                  />
                  {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <FieldLabel optional>Middle Name</FieldLabel>
                  <input
                    type="text"
                    placeholder="e.g. Santos"
                    className={inputCls(false)}
                    value={form.middleName}
                    onChange={(e) => set('middleName', e.target.value)}
                  />
                </div>
              </div>

              {/* Student ID */}
              <div>
                <FieldLabel>Student ID Number <span className="text-red-500">*</span></FieldLabel>
                <input
                  type="text"
                  placeholder="02000123456"
                  maxLength={11}
                  className={inputCls(!!errors.studentId)}
                  value={form.studentId}
                  onChange={(e) => set('studentId', e.target.value.replace(/\D/g, ''))}
                />
                {errors.studentId
                  ? <p className="text-red-500 text-xs mt-1">{errors.studentId}</p>
                  : <p className="text-gray-400 text-xs mt-1">Enter the official 11-digit STI student ID exactly as shown on the physical ID card.</p>
                }
              </div>

              {/* DOB + Sex */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Date of Birth <span className="text-red-500">*</span></FieldLabel>
                  <input
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
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
            <div className="space-y-4 text-left">
              <div>
                <p className="font-bold text-[#001A4D] text-base">Academic Details</p>
                <p className="text-gray-500 text-xs mt-0.5">Select the academic track, program, year level, and section for this student.</p>
              </div>

              {/* Academic Track Toggle */}
              <div>
                <FieldLabel><Building className="w-3.5 h-3.5 text-gray-400" /> Academic Track <span className="text-red-500">*</span></FieldLabel>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleTrackChange('COLLEGE')}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                      currentAcademicLevel === 'COLLEGE'
                        ? 'bg-[#001A4D] text-[#FFD41C] border-[#001A4D] shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    College (Semestral)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTrackChange('SHS')}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                      currentAcademicLevel === 'SHS'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    Senior High School (Trimestral)
                  </button>
                </div>
              </div>

              {/* Course / Program */}
              <div>
                <FieldLabel>
                  <BookOpen className="w-3.5 h-3.5 text-gray-400" /> {currentAcademicLevel === 'SHS' ? 'Senior High Strand / Track' : 'College Course / Program'} <span className="text-red-500">*</span>
                </FieldLabel>
                <div className="relative">
                  <BookOpen className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    className={`${inputCls(!!errors.courseId)} pl-9 appearance-none`}
                    value={form.courseId}
                    onChange={(e) => selectCourse(e.target.value)}
                  >
                    <option value="">Select {currentAcademicLevel === 'SHS' ? 'SHS strand…' : 'course…'}</option>
                    {levelCourses.map((c) => (
                      <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                </div>
                {errors.courseId && <p className="text-red-500 text-xs mt-1">{errors.courseId}</p>}
                {form.courseId && (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-[#0E4EBD] rounded-full text-xs font-bold border border-blue-100">
                    <Check className="w-3.5 h-3.5" /> {form.courseCode} — {form.courseName}
                  </div>
                )}
              </div>

              {/* Year Level */}
              <div>
                <FieldLabel>Year Level <span className="text-red-500">*</span></FieldLabel>
                <div className={`grid ${currentAcademicLevel === 'SHS' ? 'grid-cols-2' : 'grid-cols-4'} gap-2`}>
                  {availableYearLevels.map((yl) => (
                    <button
                      key={yl}
                      type="button"
                      disabled={!form.courseId}
                      onClick={() => {
                        set('yearLevel', yl);
                        set('section', '');
                      }}
                      className={`h-[46px] rounded-xl text-xs font-bold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        form.yearLevel === yl
                          ? currentAcademicLevel === 'SHS'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-[#001A4D] text-[#FFD41C] border-[#001A4D] shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {yl}
                    </button>
                  ))}
                </div>
                {errors.yearLevel && <p className="text-red-500 text-xs mt-1">{errors.yearLevel}</p>}
                {!form.courseId && (
                  <p className="text-gray-400 text-xs mt-1">Select a course above first to enable year levels.</p>
                )}
              </div>

              {/* Section */}
              <div>
                <FieldLabel>
                  <Users className="w-3.5 h-3.5 text-gray-400" /> Section <span className="text-red-500">*</span>
                </FieldLabel>
                <div className="relative">
                  <Users className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    className={`${inputCls(!!errors.section)} pl-9 appearance-none disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
                    value={form.section}
                    onChange={(e) => set('section', e.target.value)}
                    disabled={!form.courseId || !form.yearLevel}
                  >
                    <option value="">
                      {!form.courseId
                        ? 'Select a course first'
                        : !form.yearLevel
                        ? 'Select a year level first'
                        : matchingSections.length === 0
                        ? 'No registered sections found for this year level'
                        : 'Select section…'}
                    </option>
                    {matchingSections.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                {errors.section && <p className="text-red-500 text-xs mt-1">{errors.section}</p>}
                {!form.yearLevel && form.courseId && (
                  <p className="text-amber-600 text-xs mt-1 font-medium">Please choose a Year Level above to load sections.</p>
                )}
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
                    value={form.departmentName || 'Auto-filled from selected program'}
                    className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-600 font-medium"
                  />
                </div>
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
                      value={form.schoolYear || 'Auto-resolving...'}
                      className="w-full px-4 pr-9 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700 font-bold"
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>{currentAcademicLevel === 'SHS' ? 'Active Trimester' : 'Active Semester'}</FieldLabel>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-gray-300 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      readOnly
                      type="text"
                      value={form.semester || 'Auto-resolving...'}
                      className="w-full px-4 pr-9 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700 font-bold"
                    />
                  </div>
                </div>
              </div>
              <p className="text-gray-400 text-xs mt-0">Auto-filled based on the currently active {currentAcademicLevel === 'SHS' ? 'SHS Trimester' : 'College Semester'}.</p>
              {errors.schoolYear && <p className="text-red-500 text-xs mt-1">{errors.schoolYear}</p>}
              {errors.semester && <p className="text-red-500 text-xs mt-1">{errors.semester}</p>}
            </div>
          )}

          {/* ════ STEP 3 — Account Credentials ════ */}
          {step === 2 && (
            <div className="space-y-4 text-left">
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

              {/* Send email toggle */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-[#0E4EBD] flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[#001A4D]">Send Credentials via Email</p>
                    <p className="text-[11px] text-gray-500">Dispatch temporary password and login guide to student's email.</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.sendWelcomeEmail}
                  onChange={(e) => set('sendWelcomeEmail', e.target.checked)}
                  className="w-4 h-4 text-[#0E4EBD] rounded focus:ring-[#0E4EBD] cursor-pointer"
                />
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
                'All text readable in portrait mode',
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

// ─── Photo Step sub-component with Live Camera & Gallery Upload ────────────────
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
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const cameraFileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  // Start live webcam stream
  const startCamera = async () => {
    setUploadError('');
    setCameraLoading(true);
    setIsCameraOpen(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam API not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: circle ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraLoading(false);
    } catch (err: unknown) {
      console.warn('Webcam stream unavailable, falling back to camera file picker:', err);
      stopCamera();
      cameraFileRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setCameraLoading(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const captureFrame = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (circle) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `${circle ? 'selfie' : 'school-id'}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      await handleFile(file);
    }, 'image/jpeg', 0.92);
  };

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
    <div className="space-y-5 text-left">
      <div>
        <p className="font-bold text-[#001A4D] text-base">{title}</p>
        <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>
      </div>

      {/* Capture area */}
      <div className="flex flex-col items-center gap-4">
        {circle ? (
          /* Profile photo — circle */
          <div
            className="relative cursor-pointer group"
            onClick={() => !uploading && startCamera()}
          >
            <div className="w-52 h-52 rounded-full border-2 border-dashed border-[#0E4EBD] bg-blue-50/50 flex items-center justify-center overflow-hidden ring-4 ring-[#0E4EBD]/20 group-hover:border-[#001A4D] transition-colors">
              {uploading ? (
                <div className="text-center">
                  <Loader className="w-10 h-10 text-[#0E4EBD] mx-auto mb-2 animate-spin" />
                  <p className="text-[#0E4EBD] font-bold text-sm">Uploading… {progress}%</p>
                </div>
              ) : value ? (
                <img src={value} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4">
                  <Camera className="w-12 h-12 text-[#0E4EBD] mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-[#001A4D] font-bold text-sm">Tap to take selfie</p>
                  <p className="text-gray-400 text-xs mt-0.5">Opens camera</p>
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
          /* School ID — portrait container */
          <div
            className="relative w-60 h-84 aspect-[3/4] mx-auto border-2 border-dashed border-[#0E4EBD] bg-blue-50/50 rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:border-[#001A4D] transition-colors flex items-center justify-center group"
            onClick={() => !uploading && startCamera()}
          >
            {uploading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <Loader className="w-10 h-10 text-[#0E4EBD] animate-spin" />
                <p className="text-[#0E4EBD] font-bold text-sm">Uploading… {progress}%</p>
              </div>
            ) : value ? (
              <>
                <img src={value} alt="School ID" className="w-full h-full object-contain bg-white" />
                <div className="absolute top-2 right-2 px-2.5 py-1 bg-green-600 text-white rounded-full flex items-center gap-1 shadow-md text-xs font-bold">
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>ID Uploaded</span>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                <CreditCard className="w-12 h-12 text-[#0E4EBD] group-hover:scale-110 transition-transform" />
                <p className="text-[#001A4D] font-bold text-sm">Tap to photograph ID</p>
                <p className="text-gray-400 text-xs">Align physical ID card in portrait mode</p>
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
            className="text-[#0E4EBD] text-xs font-bold hover:underline"
          >
            {circle ? 'Retake Photo' : 'Re-upload School ID'}
          </button>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 w-full">
          <button
            type="button"
            disabled={uploading}
            onClick={startCamera}
            className="flex-1 h-11 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-sm"
          >
            <Camera className="w-4 h-4" />
            {circle ? 'Take Selfie' : 'Take Photo'}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => galleryFileRef.current?.click()}
            className="flex-1 h-11 border border-[#0E4EBD] text-[#0E4EBD] rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Upload from Gallery
          </button>
        </div>

        {/* Hidden camera file input for mobile fallback */}
        <input
          ref={cameraFileRef}
          type="file"
          accept="image/*"
          capture={circle ? 'user' : 'environment'}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />

        {/* Hidden gallery file input */}
        <input
          ref={galleryFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Live Camera Stream Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95">
            <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#FFD41C]" />
                <h3 className="font-bold text-base">{circle ? 'Take Profile Selfie' : 'Photograph School ID Card'}</h3>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-gray-950 flex flex-col items-center justify-center relative min-h-[320px]">
              {cameraLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white bg-black/60 z-10">
                  <Loader className="w-8 h-8 animate-spin text-[#FFD41C]" />
                  <p className="text-xs font-semibold">Starting camera feed...</p>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full max-h-[380px] object-cover rounded-xl ${circle ? '-scale-x-100' : ''}`}
              />
            </div>

            <div className="p-4 bg-white flex items-center justify-between gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={stopCamera}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={captureFrame}
                disabled={cameraLoading}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                <Camera className="w-4 h-4 text-[#FFD41C]" />
                Capture & Use Photo
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
