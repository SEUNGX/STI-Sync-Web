import { useState, useMemo, useEffect, useRef } from 'react';
import {
  X, Upload, Crown, Star, FileText, Calculator, ClipboardCheck, Users,
  Mail, Lock, Eye, EyeOff, Building, ChevronDown, Check, ArrowRight,
  ArrowLeft, Search, Loader2, AlertCircle, ShieldCheck, UserCheck, Sparkles,
  Info
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { useOrganizationTypes } from '../hooks/useOrganizationTypes';
import { useOrganizationMutations } from '../hooks/useOrganizationMutations';
import { useOrganizationStream } from '../hooks/useOrganizationStream';
import { useAllActiveOfficers } from '../hooks/useOrgOfficers';
import { useDepartments, useSemesters } from '../../academic';
import { useRoles } from '../../roles';
import { useStudents } from '../../students/hooks/useStudentStream';
import type { CreateOrganizationPayload, OrgAdviserData } from '../types/organization.types';
import type { OfficerAssignmentData } from '../services/officer.service';


// ─── Props ────────────────────────────────────────────────────────────────────
interface CreateClubModalProps {
  isOpen: boolean;
  onClose: () => void;
  createdBy?: string;
  onSuccess?: () => void;
}

interface OfficerAssignment {
  roleId: string;
  roleName: string;
  isRequired: boolean;
  studentName?: string;
  studentId?: string;
  email?: string;
  course?: string;
  year?: string;
  department?: string;
  contactNumber?: string;
  avatar?: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────
interface Step1Errors {
  name?: string;
  typeId?: string;
  department?: string;
  acronym?: string;
  schoolYear?: string;
  description?: string;
  logo?: string;
}

interface Step2Errors {
  name?: string;
  employeeId?: string;
  email?: string;
  departmentId?: string;
}

function validateStep1(form: {
  name: string;
  typeId: string;
  department: string;
  acronym: string;
  description: string;
  logo: File | null;
}) {
  const errors: Step1Errors = {};
  if (!form.name.trim()) errors.name = 'Organization name is required.';
  if (!form.typeId) errors.typeId = 'Please select an organization type.';
  if (!form.department) errors.department = 'Please select a department.';
  if (!form.acronym.trim()) errors.acronym = 'Acronym is required.';
  if (!form.description.trim()) errors.description = 'Description is required.';
  if (!form.logo) errors.logo = 'Organization logo is required.';
  return errors;
}

function validateStep2(adviser: {
  name: string;
  employeeId: string;
  email: string;
  departmentId: string;
}) {
  const errors: Step2Errors = {};
  if (!adviser.name.trim()) errors.name = 'Adviser full name is required.';
  if (!adviser.employeeId.trim()) errors.employeeId = 'Employee / Faculty ID is required.';
  if (!adviser.email.trim()) {
    errors.email = 'Adviser email address is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adviser.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!adviser.departmentId) errors.departmentId = 'Please select adviser department.';
  return errors;
}

// ─── Role icons ───────────────────────────────────────────────────────────────
function getRoleIcon(role: string) {
  switch (role) {
    case 'President': return Crown;
    case 'Vice President': return Star;
    case 'Secretary': return FileText;
    case 'Treasurer': return Calculator;
    case 'Auditor': return ClipboardCheck;
    case 'P.R.O.': return Users;
    default: return Users;
  }
}

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  const steps = [
    { number: 1, label: 'Organization Details' },
    { number: 2, label: 'Assign Adviser' },
    { number: 3, label: 'Assign Officers' },
    { number: 4, label: 'Review & Confirm' },
  ];
  return (
    <div className="flex items-center justify-center gap-2 py-5 px-6 border-b border-gray-200 bg-gray-50/50">
      {steps.map((step, idx) => (
        <div key={step.number} className="flex items-center">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${current > step.number
                ? 'bg-[#0E4EBD] text-white'
                : current === step.number
                  ? 'bg-[#FFC107] text-[#001A4D] shadow-xs'
                  : 'bg-[#E0E0E0] text-gray-500'
              }`}>
              {current > step.number ? <Check className="w-3.5 h-3.5" /> : step.number}
            </div>
            <span className={`text-xs font-semibold hidden sm:inline ${current === step.number ? 'text-[#001A4D]' : 'text-gray-500'}`}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-8 sm:w-12 h-0.5 mx-2 ${current > step.number ? 'bg-[#0E4EBD]' : 'bg-[#E0E0E0]'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Field error ──────────────────────────────────────────────────────────────
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {msg}
    </p>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CreateClubModal({ isOpen, onClose, createdBy = 'system', onSuccess }: CreateClubModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [step1Errors, setStep1Errors] = useState<Step1Errors>({});
  const [step2Errors, setStep2Errors] = useState<Step2Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isCheckingAdviser, setIsCheckingAdviser] = useState(false);

  // Officer Assignment Mode (Optional toggle)
  const [appointOfficersNow, setAppointOfficersNow] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Live data ───────────────────────────────────────────────────────────────
  const { data: orgTypes, loading: loadingTypes } = useOrganizationTypes();
  const { data: departments, loading: loadingDepts } = useDepartments();
  const { data: semesters, loading: loadingSemesters } = useSemesters();
  const { data: rawRoles, loading: loadingRoles } = useRoles();
  const { data: allStudents } = useStudents();
  const { officers: existingOfficers } = useAllActiveOfficers();
  const { data: allOrganizations } = useOrganizationStream();
  const { create, isSaving } = useOrganizationMutations();

  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const activeOrgTypes = orgTypes.filter(t => !t.archived);
  const activeDepts = departments.filter(d => !d.archived);
  const activeSemester = useMemo(() => semesters.find(s => s.status === 'ACTIVE') ?? null, [semesters]);
  const activeRoles = useMemo(() => rawRoles.filter(r => !r.archived), [rawRoles]);

  // Step 1 Form State
  const [formData, setFormData] = useState({
    name: '',
    typeId: '',
    department: '',
    acronym: '',
    schoolYear: '',
    semester: '',
    description: '',
    logo: null as File | null,
  });

  // Step 2 Adviser State (Fixed title: "Club Adviser")
  const [adviserData, setAdviserData] = useState<OrgAdviserData>({
    name: '',
    employeeId: '',
    email: '',
    departmentId: '',
    title: 'Club Adviser',
    temporaryPassword: 'Adv-' + Math.floor(1000 + Math.random() * 9000) + '!#',
    requiresPasswordChange: true,
  });

  // Step 3 Officers State
  const [officers, setOfficers] = useState<OfficerAssignment[]>([]);

  // Keep schoolYear/semester in sync with live active semester
  useEffect(() => {
    if (activeSemester && !formData.schoolYear) {
      setFormData(prev => ({
        ...prev,
        schoolYear: activeSemester.academicYear,
        semester: activeSemester.semester,
      }));
    }
  }, [activeSemester, formData.schoolYear]);

  // Initialize officers based on active roles
  useEffect(() => {
    if (activeRoles.length > 0 && officers.length === 0) {
      setOfficers(activeRoles.map(role => ({
        roleId: role.id,
        roleName: role.name,
        isRequired: role.isRequired,
      })));
    }
  }, [activeRoles, officers.length]);

  // Map of existing active officers across ALL organizations for cross-org exclusion
  const existingOfficerMap = useMemo(() => {
    const map = new Map<string, string>(); // studentId -> Org Name/Acronym
    (existingOfficers || []).forEach(off => {
      const org = (allOrganizations || []).find(o => o.id === off.organizationId);
      const orgLabel = org ? (org.acronym || org.name) : 'Another Club';
      if (off.studentId) {
        map.set(off.studentId.trim().toLowerCase(), orgLabel);
      }
    });
    return map;
  }, [existingOfficers, allOrganizations]);

  if (!isOpen) return null;

  const assignedOfficers = officers.filter(o => o.studentName);

  // Set of student IDs already assigned in THIS organization form (intra-org exclusion)
  const currentlyAssignedStudentIds = new Set(
    assignedOfficers.map(o => (o.studentId || '').trim().toLowerCase()).filter(Boolean)
  );

  const handleAssignOfficer = (roleId: string, student: any) => {
    setOfficers(prev => prev.map(o =>
      o.roleId === roleId
        ? {
            ...o,
            studentName: `${student.firstName} ${student.lastName}`.trim(),
            studentId: student.studentId,
            email: student.email,
            course: student.courseCode || student.courseName || 'N/A',
            year: student.yearLevel || 'N/A',
            department: student.departmentId || 'N/A',
            contactNumber: student.contactNumber || '',
            avatar: `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`.toUpperCase(),
          }
        : o
    ));
  };

  const handleRemoveOfficer = (roleId: string) => {
    setOfficers(prev => prev.map(o => o.roleId === roleId ? { roleId: o.roleId, roleName: o.roleName, isRequired: o.isRequired } : o));
  };

  // ─── Step Navigation Handlers ──────────────────────────────────────────────
  const handleNextFromStep1 = () => {
    const errors = validateStep1(formData);
    if (Object.keys(errors).length > 0) { setStep1Errors(errors); return; }
    setStep1Errors({});
    setCurrentStep(2);
  };

  const handleNextFromStep2 = async () => {
    const errors = validateStep2(adviserData);
    if (Object.keys(errors).length > 0) {
      setStep2Errors(errors);
      return;
    }

    const emailTrimmed = adviserData.email.trim().toLowerCase();
    const employeeIdTrimmed = adviserData.employeeId.trim();

    // 1. Check if email is already in use by an adviser in existing organizations stream
    const existingOrgWithAdviserEmail = (allOrganizations || []).find(
      org => org.adviser?.email?.toLowerCase().trim() === emailTrimmed
    );
    if (existingOrgWithAdviserEmail) {
      setStep2Errors({
        email: `This email is already assigned as Club Adviser for "${existingOrgWithAdviserEmail.name}". An adviser can only advise one organization.`,
      });
      return;
    }

    // 2. Check if employee ID is already in use in existing organizations stream
    const existingOrgWithEmployeeId = (allOrganizations || []).find(
      org => org.adviser?.employeeId?.trim() === employeeIdTrimmed
    );
    if (existingOrgWithEmployeeId) {
      setStep2Errors({
        employeeId: `This Employee ID is already assigned to the adviser for "${existingOrgWithEmployeeId.name}".`,
      });
      return;
    }

    // 3. Check if email or employee ID belongs to an existing student
    const studentMatch = (allStudents || []).find(
      s => s.email?.toLowerCase().trim() === emailTrimmed || s.studentId?.trim() === employeeIdTrimmed
    );
    if (studentMatch) {
      if (studentMatch.email?.toLowerCase().trim() === emailTrimmed) {
        setStep2Errors({
          email: `This email is registered to student "${studentMatch.firstName} ${studentMatch.lastName}". Club Advisers must use a faculty/employee account.`,
        });
      } else {
        setStep2Errors({
          employeeId: `This ID is registered to student "${studentMatch.firstName} ${studentMatch.lastName}". Please enter a valid Faculty/Employee ID.`,
        });
      }
      return;
    }

    // 4. Perform direct Firestore verification in organization_advisers collection
    setIsCheckingAdviser(true);
    try {
      const emailQuery = query(
        collection(db, 'organization_advisers'),
        where('email', '==', emailTrimmed),
        where('isActive', '==', true)
      );
      const emailSnap = await getDocs(emailQuery);
      if (!emailSnap.empty) {
        const adv = emailSnap.docs[0].data();
        setStep2Errors({
          email: `This email is already registered to active adviser "${adv.name}" (${adv.organizationName || 'Existing Club'}).`,
        });
        setIsCheckingAdviser(false);
        return;
      }

      const empIdQuery = query(
        collection(db, 'organization_advisers'),
        where('employeeId', '==', employeeIdTrimmed),
        where('isActive', '==', true)
      );
      const empIdSnap = await getDocs(empIdQuery);
      if (!empIdSnap.empty) {
        const adv = empIdSnap.docs[0].data();
        setStep2Errors({
          employeeId: `This Employee ID is already registered to active adviser "${adv.name}" (${adv.organizationName || 'Existing Club'}).`,
        });
        setIsCheckingAdviser(false);
        return;
      }
    } catch (queryErr) {
      console.warn('[handleNextFromStep2] Firestore adviser uniqueness check warning:', queryErr);
    } finally {
      setIsCheckingAdviser(false);
    }

    setStep2Errors({});
    setCurrentStep(3);
  };

  const handleNextFromStep3 = () => {
    // If officers assignment is active, validate duplicate selections
    if (appointOfficersNow && assignedOfficers.length > 0) {
      const studentRoles = new Map<string, string>();
      for (const officer of assignedOfficers) {
        if (!officer.studentId) continue;
        if (studentRoles.has(officer.studentId)) {
          const previousRole = studentRoles.get(officer.studentId);
          alert(`Student ${officer.studentName} is assigned to multiple roles (${previousRole} and ${officer.roleName}). A student can only hold one role per organization.`);
          return;
        }
        studentRoles.set(officer.studentId, officer.roleName);
      }
    }

    setCurrentStep(4);
  };

  // ─── Final Creation Handler ────────────────────────────────────────────────
  const handleCreate = async () => {
    setSubmitError(null);
    const payload: CreateOrganizationPayload = {
      name: formData.name.trim(),
      acronym: formData.acronym.trim(),
      typeId: formData.typeId,
      departmentId: formData.department,
      description: formData.description.trim(),
      academicYear: formData.schoolYear,
      semester: formData.semester,
      logoUrl: null,
      adviser: {
        ...adviserData,
        title: 'Club Adviser',
        requiresPasswordChange: true,
      },
    };

    const officersPayload: OfficerAssignmentData[] = appointOfficersNow
      ? assignedOfficers.map(o => ({
          roleId: o.roleId,
          roleName: o.roleName,
          studentId: o.studentId!,
          studentName: o.studentName!,
          email: o.email!,
          course: o.course,
          year: o.year,
          department: o.department,
          contactNumber: o.contactNumber,
        }))
      : [];

    const result = await create(payload, createdBy, formData.logo, officersPayload);
    if (result.success) {
      onSuccess?.();
      onClose();
    } else {
      setSubmitError('Failed to create organization: ' + (result.error || 'Unknown error. Check console.'));
    }
  };

  // Get display labels for review step
  const selectedType = activeOrgTypes.find(t => t.id === formData.typeId);
  const selectedDept = activeDepts.find(d => d.id === formData.department);
  const deptLabel = formData.department === 'cross-departmental'
    ? 'Cross-Departmental'
    : selectedDept ? `${selectedDept.code} — ${selectedDept.name}` : formData.department;

  const adviserDept = activeDepts.find(d => d.id === adviserData.departmentId);
  const adviserDeptLabel = adviserDept ? `${adviserDept.code} — ${adviserDept.name}` : adviserData.departmentId;

  // ─── Step 1: Organization Details ─────────────────────────────────────────
  const renderStep1 = () => (
    <div className="p-6 space-y-6">
      <div className="border-l-4 border-[#FFC107] pl-4">
        <h3 className="text-[#001A4D] font-bold text-lg">Organization Details</h3>
        <p className="text-gray-500 text-xs mt-0.5">Basic information and identity for the new student organization.</p>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-semibold text-[#001A4D] mb-1.5">
            Organization Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setStep1Errors(prev => { const n = { ...prev }; delete n.name; return n; }); }}
            placeholder="e.g. Junior Philippine Computer Society"
            className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent ${step1Errors.name ? 'border-red-400 bg-red-50' : 'border-[#E0E0E0]'}`}
          />
          <FieldError msg={step1Errors.name} />
        </div>

        {/* Type + Department */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#001A4D] mb-1.5">
              Organization Type <span className="text-red-500">*</span>
            </label>
            {loadingTypes ? (
              <div className="flex items-center gap-2 px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : (
              <select
                value={formData.typeId}
                onChange={(e) => { setFormData({ ...formData, typeId: e.target.value }); setStep1Errors(prev => { const n = { ...prev }; delete n.typeId; return n; }); }}
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent ${step1Errors.typeId ? 'border-red-400 bg-red-50' : 'border-[#E0E0E0]'}`}
              >
                <option value="">Select type</option>
                {activeOrgTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                {activeOrgTypes.length === 0 && (
                  <option disabled>No types defined — add in Settings</option>
                )}
              </select>
            )}
            <FieldError msg={step1Errors.typeId} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#001A4D] mb-1.5">
              Department <span className="text-red-500">*</span>
            </label>
            {loadingDepts ? (
              <div className="flex items-center gap-2 px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : (
              <select
                value={formData.department}
                onChange={(e) => { setFormData({ ...formData, department: e.target.value }); setStep1Errors(prev => { const n = { ...prev }; delete n.department; return n; }); }}
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent ${step1Errors.department ? 'border-red-400 bg-red-50' : 'border-[#E0E0E0]'}`}
              >
                <option value="">Select department</option>
                <option value="cross-departmental">🔀 Cross-Departmental (Institutional)</option>
                {activeDepts.map(d => (
                  <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                ))}
              </select>
            )}
            <FieldError msg={step1Errors.department} />
          </div>
        </div>

        {/* Acronym + School Year */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#001A4D] mb-1.5">
              Acronym <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.acronym}
              onChange={(e) => { setFormData({ ...formData, acronym: e.target.value.toUpperCase() }); setStep1Errors(prev => { const n = { ...prev }; delete n.acronym; return n; }); }}
              placeholder="e.g. JPCS"
              maxLength={10}
              className={`w-full px-4 py-2.5 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent ${step1Errors.acronym ? 'border-red-400 bg-red-50' : 'border-[#E0E0E0]'}`}
            />
            <FieldError msg={step1Errors.acronym} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#001A4D] mb-1.5">
              School Year & Semester
              <span className="ml-1 text-xs font-normal text-gray-400">(from active semester)</span>
            </label>
            {loadingSemesters ? (
              <div className="flex items-center gap-2 px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : activeSemester ? (
              <div className="px-4 py-2.5 border border-green-300 bg-green-50 rounded-xl text-xs text-green-800 font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                A.Y. {activeSemester.academicYear} — {activeSemester.semester}
              </div>
            ) : (
              <div className="px-4 py-2.5 border border-amber-300 bg-amber-50 rounded-xl text-xs text-amber-700">
                No active semester set in Academic Settings.
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-[#001A4D] mb-1.5">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => { setFormData({ ...formData, description: e.target.value }); setStep1Errors(prev => { const n = { ...prev }; delete n.description; return n; }); }}
            placeholder="Provide a brief overview of the organization's purpose and objectives..."
            rows={3}
            className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent resize-none ${step1Errors.description ? 'border-red-400 bg-red-50' : 'border-[#E0E0E0]'}`}
          />
          <FieldError msg={step1Errors.description} />
        </div>

        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-semibold text-[#001A4D] mb-1.5">
            Organization Logo <span className="text-red-500">*</span>
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center hover:bg-blue-50/50 transition-all cursor-pointer ${step1Errors.logo ? 'border-red-400 bg-red-50' : 'border-[#0E4EBD]/40 hover:border-[#0E4EBD]'}`}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/png, image/jpeg, image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setFormData(prev => ({ ...prev, logo: file }));
                setStep1Errors(prev => { const n = { ...prev }; delete n.logo; return n; });
              }}
            />
            {formData.logo ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-[#001A4D] text-sm font-bold">{formData.logo.name}</div>
                <div className="text-gray-500 text-xs mt-0.5">{(formData.logo.size / 1024).toFixed(1)} KB — Click to change</div>
              </div>
            ) : (
              <>
                <Upload className={`w-8 h-8 mx-auto mb-2 ${step1Errors.logo ? 'text-red-400' : 'text-[#0E4EBD]'}`} />
                <div className={`text-sm font-semibold mb-0.5 ${step1Errors.logo ? 'text-red-600' : 'text-[#001A4D]'}`}>Click to upload logo</div>
                <div className="text-gray-400 text-xs">PNG, JPG or WebP up to 5MB</div>
              </>
            )}
          </div>
          <FieldError msg={step1Errors.logo} />
        </div>
      </div>
    </div>
  );

  // ─── Step 2: Assign Adviser (Mandatory) ────────────────────────────────────
  const renderStep2 = () => (
    <div className="p-6 space-y-6">
      <div className="border-l-4 border-[#FFC107] pl-4">
        <h3 className="text-[#001A4D] font-bold text-lg">Assign Organization Adviser</h3>
        <p className="text-gray-500 text-xs mt-0.5">
          The Club Adviser has administrative access to manage the club and appoint executive officers.
        </p>
      </div>

      <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#0E4EBD] shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <strong>Adviser First-Access Protocol:</strong> The appointed faculty adviser will receive their account credentials via email. Upon logging in, they will be prompted to change their temporary password and can appoint executive officers from the student directory.
        </div>
      </div>

      <div className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="block text-sm font-semibold text-[#001A4D] mb-1.5">
            Adviser Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={adviserData.name}
            onChange={(e) => {
              setAdviserData({ ...adviserData, name: e.target.value });
              setStep2Errors(prev => { const n = { ...prev }; delete n.name; return n; });
            }}
            placeholder="e.g. Prof. Juan Dela Cruz, MIT"
            className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent ${step2Errors.name ? 'border-red-400 bg-red-50' : 'border-[#E0E0E0]'}`}
          />
          <FieldError msg={step2Errors.name} />
        </div>

        {/* Employee ID + Department */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#001A4D] mb-1.5">
              Employee / Faculty ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={adviserData.employeeId}
              onChange={(e) => {
                setAdviserData({ ...adviserData, employeeId: e.target.value });
                setStep2Errors(prev => { const n = { ...prev }; delete n.employeeId; return n; });
              }}
              placeholder="e.g. FAC-2024-0042"
              className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent ${step2Errors.employeeId ? 'border-red-400 bg-red-50' : 'border-[#E0E0E0]'}`}
            />
            <FieldError msg={step2Errors.employeeId} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#001A4D] mb-1.5">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              value={adviserData.departmentId}
              onChange={(e) => {
                setAdviserData({ ...adviserData, departmentId: e.target.value });
                setStep2Errors(prev => { const n = { ...prev }; delete n.departmentId; return n; });
              }}
              className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent ${step2Errors.departmentId ? 'border-red-400 bg-red-50' : 'border-[#E0E0E0]'}`}
            >
              <option value="">Select faculty department</option>
              {activeDepts.map(d => (
                <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
              ))}
            </select>
            <FieldError msg={step2Errors.departmentId} />
          </div>
        </div>

        {/* Email Address */}
        <div>
          <label className="block text-sm font-semibold text-[#001A4D] mb-1.5">
            Official / Institutional Email <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={adviserData.email}
              onChange={(e) => {
                setAdviserData({ ...adviserData, email: e.target.value });
                setStep2Errors(prev => { const n = { ...prev }; delete n.email; return n; });
              }}
              placeholder="e.g. juan.delacruz@ormoc.sti.edu.ph"
              className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent ${step2Errors.email ? 'border-red-400 bg-red-50' : 'border-[#E0E0E0]'}`}
            />
          </div>
          <FieldError msg={step2Errors.email} />
        </div>

        {/* Designation / Title (Fixed) + Generated Temporary Password Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Designation Title
            </label>
            <div className="px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-[#001A4D] flex items-center justify-between">
              <span>Club Adviser</span>
              <span className="px-2 py-0.5 bg-[#001A4D] text-white text-[10px] rounded font-bold">DEFAULT</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Initial Temporary Password
            </label>
            <div className="px-4 py-2.5 bg-amber-50/80 border border-amber-200 rounded-xl font-mono text-sm font-bold text-amber-900 flex items-center justify-between">
              <span>{adviserData.temporaryPassword}</span>
              <span className="text-[10px] text-amber-700 font-sans font-semibold">Auto-Generated</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Step 3: Assign Officers (Optional) ────────────────────────────────────
  const renderStep3 = () => (
    <div className="p-6 space-y-6">
      <div className="border-l-4 border-[#FFC107] pl-4 flex items-start justify-between">
        <div>
          <h3 className="text-[#001A4D] font-bold text-lg">Assign Executive Officers</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            Appoint student officers now or leave it for the Club Adviser to appoint later.
          </p>
        </div>
      </div>

      {/* Mode Switcher Banner */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#001A4D] text-white flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#001A4D]">Appoint Officers Now?</div>
            <div className="text-xs text-gray-500">
              {appointOfficersNow
                ? 'Select students to assign to executive board roles.'
                : 'Officers can be appointed later by the Club Adviser via the Officer Portal.'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAppointOfficersNow(!appointOfficersNow)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${appointOfficersNow
              ? 'bg-[#0E4EBD] text-white shadow-xs'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
        >
          {appointOfficersNow ? '✓ Appointing Now' : '+ Appoint Officers'}
        </button>
      </div>

      {appointOfficersNow ? (
        <div className="space-y-3">
          {loadingRoles ? (
            <div className="flex items-center justify-center p-8 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading roles...
            </div>
          ) : activeRoles.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-2xl border-gray-300 text-gray-500 text-xs">
              No officer roles defined yet in Settings.
            </div>
          ) : (
            officers.map((officer) => {
              const Icon = getRoleIcon(officer.roleName);
              return (
                <div
                  key={officer.roleId}
                  className={`border rounded-2xl p-4 flex items-center justify-between transition-all ${officer.studentName ? 'border-[#0E4EBD] bg-blue-50/20' : 'border-[#E0E0E0] bg-white'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#001A4D] rounded-xl flex items-center justify-center text-white shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#001A4D] text-sm">{officer.roleName}</span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                          Officer
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {officer.studentName ? officer.course : 'No student assigned'}
                      </div>
                    </div>
                  </div>

                  <div className="w-72">
                    {officer.studentName ? (
                      <div className="flex items-center gap-2 bg-[#001A4D] rounded-xl px-3 py-2 shadow-xs">
                        <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center text-[#001A4D] font-bold text-xs shrink-0">
                          {officer.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-xs font-bold truncate">{officer.studentName}</div>
                          <div className="text-white/70 text-[10px] truncate">{officer.studentId}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveOfficer(officer.roleId)}
                          className="text-white/70 hover:text-white shrink-0 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search student by name or ID..."
                          value={searchQueries[officer.roleId] || ''}
                          onChange={(e) => {
                            setSearchQueries(prev => ({ ...prev, [officer.roleId]: e.target.value }));
                            setActiveDropdown(officer.roleId);
                          }}
                          onFocus={() => setActiveDropdown(officer.roleId)}
                          className="w-full pl-9 pr-3 py-2 border border-[#E0E0E0] rounded-xl text-xs focus:ring-2 focus:ring-[#0E4EBD] focus:border-transparent outline-none"
                        />

                        {/* Dropdown with Deduplication & Cross-Org Filtering */}
                        {activeDropdown === officer.roleId && (searchQueries[officer.roleId] || '').length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E0E0E0] rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto">
                            {(() => {
                              const query = (searchQueries[officer.roleId] || '').toLowerCase();
                              const matches = (allStudents || []).filter(s =>
                                `${s.firstName} ${s.lastName}`.toLowerCase().includes(query) ||
                                s.studentId.toLowerCase().includes(query)
                              ).slice(0, 8);

                              if (matches.length === 0) {
                                return <div className="p-3 text-xs text-gray-500 text-center">No students found</div>;
                              }

                              return matches.map(s => {
                                const cleanSId = s.studentId.trim().toLowerCase();
                                const isAlreadyAssignedInThisOrg = currentlyAssignedStudentIds.has(cleanSId);
                                const otherOrgOfficerName = existingOfficerMap.get(cleanSId);
                                const isBlocked = isAlreadyAssignedInThisOrg || !!otherOrgOfficerName;

                                return (
                                  <div
                                    key={s.id}
                                    onClick={() => {
                                      if (isBlocked) return;
                                      handleAssignOfficer(officer.roleId, s);
                                      setActiveDropdown(null);
                                      setSearchQueries(prev => ({ ...prev, [officer.roleId]: '' }));
                                    }}
                                    className={`px-3.5 py-2 border-b border-gray-100 last:border-0 flex items-center justify-between ${isBlocked
                                        ? 'bg-gray-50 opacity-60 cursor-not-allowed'
                                        : 'hover:bg-blue-50 cursor-pointer'
                                      }`}
                                  >
                                    <div>
                                      <div className="font-semibold text-[#001A4D] text-xs">
                                        {s.firstName} {s.lastName}
                                      </div>
                                      <div className="text-[10px] text-gray-400">
                                        {s.studentId} • {s.courseCode || s.departmentId}
                                      </div>
                                    </div>

                                    {isAlreadyAssignedInThisOrg ? (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-bold">
                                        Already Selected
                                      </span>
                                    ) : otherOrgOfficerName ? (
                                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-bold">
                                        Officer in {otherOrgOfficerName}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-[#0E4EBD]">Select &rarr;</span>
                                    )}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="border border-dashed border-gray-300 bg-gray-50/50 rounded-2xl p-8 text-center space-y-2">
          <UserCheck className="w-8 h-8 text-gray-400 mx-auto" />
          <div className="text-sm font-bold text-[#001A4D]">No Officers Appointed Yet</div>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            You can proceed without assigning officers. The Club Adviser ({adviserData.name || 'Adviser'}) can appoint student officers from the student database after logging in.
          </p>
        </div>
      )}
    </div>
  );

  // ─── Step 4: Review & Confirm ──────────────────────────────────────────────
  const renderStep4 = () => (
    <div className="p-6 space-y-5">
      <div className="border-l-4 border-[#FFC107] pl-4">
        <h3 className="text-[#001A4D] font-bold text-lg">Review & Confirm Organization</h3>
        <p className="text-gray-500 text-xs mt-0.5">Please review all details before creating the organization.</p>
      </div>

      {/* Org Profile Card */}
      <div className="border border-[#E0E0E0] rounded-2xl p-5 space-y-4 bg-white shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-2xl flex items-center justify-center text-white font-bold text-xl overflow-hidden shadow-inner shrink-0">
            {formData.logo ? (
              <img src={URL.createObjectURL(formData.logo)} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              formData.acronym || 'ORG'
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-[#001A4D] font-bold text-lg truncate">{formData.name || 'Organization Name'}</h4>
              {selectedType && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#FFD54F] text-[#001A4D] rounded-full text-xs font-bold">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedType.color }} />
                  {selectedType.name}
                </span>
              )}
            </div>
            <p className="text-gray-500 text-xs font-mono font-bold">{formData.acronym}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 text-xs">
          <div>
            <div className="text-gray-400 font-medium">Department</div>
            <div className="text-[#001A4D] font-semibold">{deptLabel || '—'}</div>
          </div>
          <div>
            <div className="text-gray-400 font-medium">Academic Year</div>
            <div className="text-[#001A4D] font-semibold">
              {formData.schoolYear ? `A.Y. ${formData.schoolYear} — ${formData.semester}` : '—'}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-gray-400 font-medium">Description</div>
            <div className="text-gray-700 line-clamp-2">{formData.description || '—'}</div>
          </div>
        </div>
      </div>

      {/* Adviser Card */}
      <div className="border border-blue-200 bg-blue-50/40 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0E4EBD]" />
            <h4 className="text-[#001A4D] font-bold text-sm">Assigned Club Adviser</h4>
          </div>
          <span className="px-2 py-0.5 bg-[#001A4D] text-white text-[10px] font-bold rounded">MANDATORY</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs pt-1">
          <div>
            <div className="text-gray-500">Name</div>
            <div className="text-[#001A4D] font-bold">{adviserData.name}</div>
          </div>
          <div>
            <div className="text-gray-500">Employee ID</div>
            <div className="text-[#001A4D] font-semibold">{adviserData.employeeId || '—'}</div>
          </div>
          <div>
            <div className="text-gray-500">Email Address</div>
            <div className="text-[#0E4EBD] font-semibold">{adviserData.email}</div>
          </div>
          <div>
            <div className="text-gray-500">Department</div>
            <div className="text-[#001A4D] font-semibold">{adviserDeptLabel}</div>
          </div>
        </div>
      </div>

      {/* Officers Review */}
      <div className="border border-[#E0E0E0] rounded-2xl p-5 space-y-3 bg-white">
        <div className="flex items-center justify-between">
          <h4 className="text-[#001A4D] font-bold text-sm">Executive Officers</h4>
          <span className="text-xs text-gray-500 font-semibold">{assignedOfficers.length} Assigned</span>
        </div>

        {assignedOfficers.length > 0 ? (
          <div className="space-y-2">
            {assignedOfficers.map((officer) => (
              <div key={officer.roleId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-[#001A4D] text-white rounded-full flex items-center justify-center font-bold text-[10px]">
                    {officer.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-[#001A4D]">{officer.studentName}</div>
                    <div className="text-gray-400 text-[10px]">{officer.studentId} • {officer.email}</div>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 bg-[#0E4EBD] text-white rounded-full text-[10px] font-bold">
                  {officer.roleName}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">No officers appointed at creation. The Club Adviser will appoint officers later.</p>
        )}
      </div>

      {/* Email Dispatch Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <strong>Automated Credential Dispatch:</strong> An onboarding email containing login instructions and temporary credentials will be sent to the Adviser (<span className="font-semibold">{adviserData.email}</span>).
          {assignedOfficers.length > 0 && ' Appointed officers will receive an appointment notice and can log in using their student credentials.'}
        </div>
      </div>

      {submitError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-xs text-red-700 font-medium">{submitError}</p>
        </div>
      )}

      <label className="flex items-center gap-3 p-3.5 border border-[#E0E0E0] rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="w-4 h-4 text-[#0E4EBD] rounded border-gray-300 focus:ring-[#0E4EBD]"
        />
        <span className="text-[#001A4D] text-xs font-medium">
          I confirm that the organization details and adviser information are accurate.
        </span>
      </label>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-[640px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#001A4D] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-base">Create Student Organization</h2>
            <p className="text-white/60 text-xs">Step {currentStep} of 4</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <StepIndicator current={currentStep} />

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E0E0E0] px-6 py-4 flex items-center justify-between bg-gray-50">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                disabled={isSaving}
                className="px-4 py-2 bg-white border border-[#E0E0E0] text-[#001A4D] font-bold text-xs rounded-xl hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50 shadow-xs transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            {currentStep === 1 && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-500 font-semibold text-xs rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep < 4 ? (
              <button
                type="button"
                disabled={isCheckingAdviser}
                onClick={
                  currentStep === 1
                    ? handleNextFromStep1
                    : currentStep === 2
                    ? handleNextFromStep2
                    : handleNextFromStep3
                }
                className="px-5 py-2.5 bg-[#001A4D] text-white font-bold text-xs rounded-xl hover:bg-[#001A4D]/90 flex items-center gap-2 shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCheckingAdviser ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin text-[#FFC107]" /> Validating Adviser...</>
                ) : (
                  <>
                    {currentStep === 1
                      ? 'Next: Assign Adviser'
                      : currentStep === 2
                      ? 'Next: Assign Officers'
                      : 'Next: Review & Confirm'}
                    <ArrowRight className="w-3.5 h-3.5 text-[#FFC107]" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={!confirmed || isSaving}
                className="px-6 py-2.5 bg-[#0E4EBD] text-white font-bold text-xs rounded-xl hover:bg-[#0E4EBD]/90 flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-xs transition-all"
              >
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating Organization...</>
                ) : (
                  <><Building className="w-4 h-4 text-[#FFC107]" /> Create Organization</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
