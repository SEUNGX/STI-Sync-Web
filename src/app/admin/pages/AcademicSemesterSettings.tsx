import { useState, useMemo, useEffect } from "react";
import {
  RefreshCw,
  Plus,
  School,
  AlertTriangle,
  AlertCircle,
  Eye,
  Edit,
  Archive,
  Trash2,
  X,
  CheckCircle,
  Calendar,
  Loader,
  Check,
  Lock,
  Save,
  CalendarPlus,
  Clock,
  FileText,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useSemesters } from "../../modules/academic/hooks/useAcademicStream";
import {
  createSemester,
  updateSemester,
  archiveSemester,
  deleteSemester,
  generateSemesterLabel,
  getAcademicYearSuggestions,
  getSemesterTermAvailability,
  executeSemesterRollover,
  sortSemestersChronologically,
} from "../../modules/academic/services/academic.service";
import { useAdviserProfile } from "../../modules/auth/hooks/useAdviserProfile";
import type { SemesterDocument, SemesterStatus, SemesterTerm } from "../../modules/academic/types/academic.types";
import { formatAppDate } from "../../utils/date";


// ─── Types ────────────────────────────────────────────────────────────────────
type BannerState = "active" | "ending-soon" | "rollover-needed" | "in-progress";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return formatAppDate(iso, "—");
}

function weeksBetween(start: string, end: string): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const weeks = Math.round(ms / (7 * 24 * 60 * 60 * 1000));
  return `${weeks} week${weeks !== 1 ? "s" : ""}`;
}

function daysUntilEnd(endDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate + "T00:00:00");
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function deriveBannerState(semesters: SemesterDocument[]): BannerState {
  const active = semesters.find((s) => s.status === "ACTIVE");
  if (!active) return "active";
  const days = daysUntilEnd(active.endDate);
  if (days < 0) return "rollover-needed";
  if (days <= 14) return "ending-soon";
  return "active";
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ActiveSemesterBanner({
  state,
  activeSemester,
  onRollover,
}: {
  state: BannerState;
  activeSemester: SemesterDocument | undefined;
  onRollover: () => void;
}) {
  if (!activeSemester && state === "active") {
    return (
      <div className="w-full p-6 rounded-2xl bg-gradient-to-r from-gray-500 to-gray-600 flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <School className="w-10 h-10 text-white/50" />
          <div>
            <p className="text-white/70 text-xs uppercase tracking-wider mb-0.5">No Active Semester</p>
            <p className="text-white font-bold text-xl">Add a semester and set it as Active to begin.</p>
          </div>
        </div>
      </div>
    );
  }

  const days = activeSemester ? daysUntilEnd(activeSemester.endDate) : 0;

  if (state === "active" && activeSemester) {
    return (
      <div className="w-full p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-[#001A4D] via-[#002B7F] to-[#0A47B8] text-white flex items-center justify-between mb-6 shadow-lg shadow-[#001A4D]/15 border border-blue-900/40">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <School className="w-6 h-6 text-[#FFD41C]" />
          </div>
          <div>
            <p className="text-white/70 text-xs uppercase tracking-wider mb-0.5 font-bold">Currently Active Semester</p>
            <p className="text-white font-black text-[26px] sm:text-[28px] leading-tight">
              {activeSemester.semester} · A.Y. {activeSemester.academicYear}
            </p>
            <p className="text-white/80 text-xs sm:text-sm mt-0.5">
              {formatDate(activeSemester.startDate)} — {formatDate(activeSemester.endDate)}
            </p>
          </div>
          <span className="ml-2 px-3 py-1 bg-[#FFD41C] text-[#001A4D] text-xs font-black rounded-full shadow-sm">
            {days} day{days !== 1 ? "s" : ""} remaining
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            {[
              { label: "Active Students", value: String(activeSemester.students) },
              { label: "Events This Semester", value: String(activeSemester.events) },
            ].map((chip) => (
              <div key={chip.label} className="px-3 py-2 bg-white/15 rounded-xl text-center">
                <p className="text-white font-bold text-sm">{chip.value}</p>
                <p className="text-white/80 text-xs">{chip.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state === "ending-soon" && activeSemester) {
    return (
      <div className="w-full p-6 rounded-2xl bg-gradient-to-r from-[#FFC107] to-[#FFD41C] flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <AlertTriangle className="w-10 h-10 text-white" />
          <div>
            <p className="text-white font-bold text-xl">Semester Ending Soon</p>
            <p className="text-white/90 text-sm">
              End Date: {formatDate(activeSemester.endDate)} · {days} day{days !== 1 ? "s" : ""} remaining
            </p>
            <p className="text-white/80 text-sm mt-0.5">Prepare for semester rollover.</p>
          </div>
        </div>
        <button
          onClick={onRollover}
          className="px-5 py-2.5 bg-[#001A4D] text-white rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-[#001A4D]/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Run Semester Rollover
        </button>
      </div>
    );
  }

  if (state === "rollover-needed") {
    return (
      <div className="w-full p-6 rounded-2xl bg-gradient-to-r from-[#EF4444] to-[#F97316] flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <AlertCircle className="w-10 h-10 text-white" />
          <div>
            <p className="text-white font-bold text-xl">Semester Has Ended — Rollover Required</p>
            <p className="text-white/90 text-sm mt-0.5">
              The current semester end date has passed. Run the semester rollover to begin the new semester.
            </p>
          </div>
        </div>
        <button
          onClick={onRollover}
          className="px-5 py-2.5 bg-[#FFD41C] text-[#001A4D] rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-[#FFD41C]/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Run Semester Rollover Now
        </button>
      </div>
    );
  }

  return null;
}

function StatusPill({ status }: { status: SemesterStatus }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-green-500 to-green-400 text-white text-xs font-bold rounded-full">
        <span className="w-1.5 h-1.5 bg-white rounded-full" />
        CURRENT
      </span>
    );
  }
  if (status === "UPCOMING") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
        UPCOMING
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">
      COMPLETED
    </span>
  );
}

// ─── Academic Year Helpers ───────────────────────────────────────────────────
function sanitizeAcademicYearInput(rawInput: string): string {
  const digits = rawInput.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return digits;
}

function validateAcademicYearStrict(ay: string): { valid: boolean; error?: string } {
  if (!ay || !ay.trim()) {
    return { valid: false, error: "Academic year is required." };
  }
  const clean = ay.trim();
  if (!/^\d{4}-\d{4}$/.test(clean)) {
    return { valid: false, error: "Format must be YYYY-YYYY (e.g. 2026-2027)." };
  }
  const [startYear, endYear] = clean.split("-").map(Number);
  const currentYear = new Date().getFullYear();
  if (endYear !== startYear + 1) {
    return { valid: false, error: "End year must be exactly 1 year after start year (e.g. 2026-2027)." };
  }
  if (startYear < currentYear - 1) {
    return { valid: false, error: `Cannot create a past academic year (minimum ${currentYear - 1}-${currentYear}).` };
  }
  return { valid: true };
}

// ─── Add Semester Modal ────────────────────────────────────────────────────────
interface AddSemesterModalProps {
  existingSemesters: SemesterDocument[];
  defaultAcademicLevel?: AcademicLevel;
  onClose: () => void;
  onSuccess: () => void;
}

function AddSemesterModal({ existingSemesters, defaultAcademicLevel = "COLLEGE", onClose, onSuccess }: AddSemesterModalProps) {
  const aySuggestions = useMemo(() => getAcademicYearSuggestions(), []);

  const [academicLevel, setAcademicLevel] = useState<AcademicLevel>(defaultAcademicLevel);
  const [form, setForm] = useState({
    academicYear: aySuggestions[1] || "2026-2027",
    semester: "" as AcademicTerm | "",
    startDate: "",
    endDate: "",
    reenrollDeadline: "",
    status: "UPCOMING" as SemesterStatus,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Live AY strict validation
  const ayValidation = useMemo(
    () => validateAcademicYearStrict(form.academicYear),
    [form.academicYear]
  );

  // Term availability for the selected Academic Year and level
  const termAvailability = useMemo(
    () => getSemesterTermAvailability(form.academicYear, existingSemesters, academicLevel),
    [form.academicYear, existingSemesters, academicLevel]
  );

  // Auto-select valid term when AY changes or initializes
  useEffect(() => {
    if (termAvailability.suggestedTerm) {
      const term = termAvailability.suggestedTerm;
      const [startYear, endYear] = form.academicYear.split("-").map(Number);
      let sDate = form.startDate;
      let eDate = form.endDate;
      let rDate = form.reenrollDeadline;

      if (startYear && endYear) {
        if (term === "1st Semester") {
          sDate = `${startYear}-08-01`;
          eDate = `${startYear}-12-15`;
          rDate = `${startYear}-07-25`;
        } else if (term === "2nd Semester") {
          sDate = `${endYear}-01-15`;
          eDate = `${endYear}-05-30`;
          rDate = `${endYear}-01-05`;
        } else if (term === "1st Trimester") {
          sDate = `${startYear}-08-01`;
          eDate = `${startYear}-11-15`;
          rDate = `${startYear}-07-25`;
        } else if (term === "2nd Trimester") {
          sDate = `${startYear}-11-20`;
          eDate = `${endYear}-02-28`;
          rDate = `${startYear}-11-10`;
        } else if (term === "3rd Trimester") {
          sDate = `${endYear}-03-05`;
          eDate = `${endYear}-06-20`;
          rDate = `${endYear}-02-25`;
        }
      }

      setForm((prev) => ({
        ...prev,
        semester: term,
        startDate: sDate,
        endDate: eDate,
        reenrollDeadline: rDate,
      }));
    }
  }, [form.academicYear, academicLevel, termAvailability.suggestedTerm]);

  const handleSelectAY = (ay: string) => {
    const termInfo = getSemesterTermAvailability(ay, existingSemesters, academicLevel);
    const term = termInfo.suggestedTerm || (academicLevel === "SHS" ? "1st Trimester" : "1st Semester");
    
    let sDate = "";
    let eDate = "";
    let rDate = "";
    const [startYear, endYear] = ay.split("-").map(Number);
    if (startYear && endYear) {
      if (term === "1st Semester") {
        sDate = `${startYear}-08-01`;
        eDate = `${startYear}-12-15`;
        rDate = `${startYear}-07-25`;
      } else if (term === "2nd Semester") {
        sDate = `${endYear}-01-15`;
        eDate = `${endYear}-05-30`;
        rDate = `${endYear}-01-05`;
      } else if (term === "1st Trimester") {
        sDate = `${startYear}-08-01`;
        eDate = `${startYear}-11-15`;
        rDate = `${startYear}-07-25`;
      } else if (term === "2nd Trimester") {
        sDate = `${startYear}-11-20`;
        eDate = `${endYear}-02-28`;
        rDate = `${startYear}-11-10`;
      } else if (term === "3rd Trimester") {
        sDate = `${endYear}-03-05`;
        eDate = `${endYear}-06-20`;
        rDate = `${endYear}-02-25`;
      }
    }

    setForm((prev) => ({
      ...prev,
      academicYear: ay,
      semester: term,
      startDate: sDate || prev.startDate,
      endDate: eDate || prev.endDate,
      reenrollDeadline: rDate || prev.reenrollDeadline,
    }));
    setErrors({});
  };

  const handleAYInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = sanitizeAcademicYearInput(e.target.value);
    setForm((prev) => ({ ...prev, academicYear: formatted }));
    setErrors((prev) => ({ ...prev, academicYear: "", duplicate: "" }));
  };

  const handleSelectTerm = (term: AcademicTerm) => {
    let sDate = form.startDate;
    let eDate = form.endDate;
    let rDate = form.reenrollDeadline;
    const [startYear, endYear] = form.academicYear.split("-").map(Number);

    if (startYear && endYear) {
      if (term === "1st Semester") {
        sDate = `${startYear}-08-01`;
        eDate = `${startYear}-12-15`;
        rDate = `${startYear}-07-25`;
      } else if (term === "2nd Semester") {
        sDate = `${endYear}-01-15`;
        eDate = `${endYear}-05-30`;
        rDate = `${endYear}-01-05`;
      } else if (term === "1st Trimester") {
        sDate = `${startYear}-08-01`;
        eDate = `${startYear}-11-15`;
        rDate = `${startYear}-07-25`;
      } else if (term === "2nd Trimester") {
        sDate = `${startYear}-11-20`;
        eDate = `${endYear}-02-28`;
        rDate = `${startYear}-11-10`;
      } else if (term === "3rd Trimester") {
        sDate = `${endYear}-03-05`;
        eDate = `${endYear}-06-20`;
        rDate = `${endYear}-02-25`;
      }
    }

    setForm((prev) => ({
      ...prev,
      semester: term,
      startDate: sDate,
      endDate: eDate,
      reenrollDeadline: rDate,
    }));
    setErrors((prev) => ({ ...prev, semester: "", duplicate: "" }));
  };

  // Auto-generate label live from form inputs
  const autoLabel = useMemo(() => {
    if (!form.academicYear || !form.semester) return "";
    return generateSemesterLabel(form.academicYear, form.semester, academicLevel);
  }, [form.academicYear, form.semester, academicLevel]);

  // Validation helper — runs on submit
  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};

    // Strict AY check
    const ayCheck = validateAcademicYearStrict(form.academicYear);
    if (!ayCheck.valid) {
      errs.academicYear = ayCheck.error || "Invalid academic year.";
    }

    // Required fields
    if (!form.semester)           errs.semester     = "Please select a semester/trimester.";
    if (!form.startDate)          errs.startDate    = "Start date is required.";
    if (!form.endDate)            errs.endDate      = "End date is required.";

    // Past date check
    const todayStr = new Date().toISOString().split("T")[0];
    if (form.startDate && form.startDate < todayStr) {
      errs.startDate = "Start date cannot be in the past.";
    }
    if (form.endDate && form.endDate < todayStr) {
      errs.endDate = "End date cannot be in the past.";
    }
    if (form.reenrollDeadline && form.reenrollDeadline < todayStr) {
      errs.reenrollDeadline = "Re-enrollment deadline cannot be in the past.";
    }

    // Date logic
    if (form.startDate && form.endDate && form.endDate <= form.startDate) {
      errs.endDate = "End date must be after start date.";
    }
    if (form.reenrollDeadline && form.startDate && form.reenrollDeadline > form.startDate) {
      errs.reenrollDeadline = "Re-enrollment deadline should be on or before the semester start date.";
    }

    // Block adding if there's already an ACTIVE period for this track and new one is also ACTIVE
    const hasActiveForTrack = existingSemesters.some(
      (s) =>
        !s.archived &&
        s.status === "ACTIVE" &&
        (s.academicLevel === academicLevel || (academicLevel === "SHS" ? String(s.semester).includes("Trimester") : (!s.academicLevel && !String(s.semester).includes("Trimester"))))
    );
    if (hasActiveForTrack && form.status === "ACTIVE") {
      errs.status = `There is already an active ${academicLevel === 'SHS' ? 'trimester' : 'semester'}. A new period cannot be set as Active directly. Run a rollover to switch.`;
    }

    // Duplicate check: same academic year + same semester + same level
    const duplicate = existingSemesters.some((s) => {
      const sLevel = s.academicLevel || (String(s.semester).includes("Trimester") ? "SHS" : "COLLEGE");
      return (
        !s.archived &&
        sLevel === academicLevel &&
        s.academicYear.replace(/[–—\s]/g, "-").toLowerCase() === form.academicYear.replace(/[–—\s]/g, "-").toLowerCase() &&
        s.semester === form.semester
      );
    });
    if (duplicate && !errs.academicYear && !errs.semester) {
      errs.duplicate = `${form.semester} for A.Y. ${form.academicYear} already exists under ${academicLevel === 'SHS' ? 'Senior High School' : 'College'}.`;
    }

    return errs;
  }

  async function handleSave() {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      await createSemester({
        academicYear: form.academicYear.replace(/[–—]/g, "-").trim(),
        semester: form.semester as AcademicTerm,
        startDate: form.startDate,
        endDate: form.endDate,
        reenrollDeadline: form.reenrollDeadline,
        status: form.status,
        academicLevel,
        termType: academicLevel === 'SHS' ? 'TRIMESTER' : 'SEMESTER',
      });
      setSaved(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch {
      setErrors({ submit: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const hasActiveBlock = existingSemesters.some(
    (s) =>
      !s.archived &&
      s.status === "ACTIVE" &&
      (s.academicLevel === academicLevel || (academicLevel === "SHS" ? String(s.semester).includes("Trimester") : (!s.academicLevel && !String(s.semester).includes("Trimester"))))
  );


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[560px] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarPlus className="w-5 h-5 text-[#FFD41C]" />
            <h3 className="text-white font-bold text-base">
              Add {academicLevel === 'SHS' ? 'Senior High School Trimester' : 'College Semester'}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active semester block warning */}
        {hasActiveBlock && (
          <div className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-amber-700 text-xs">
              <strong>Active semester detected.</strong> New semesters default to <strong>Upcoming</strong>. You can switch active semesters anytime by running a <strong>Semester Rollover</strong>.
            </p>
          </div>
        )}

        {/* Both Terms Exist Warning */}
        {termAvailability.bothExist && (
          <div className="mx-5 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-xs text-[#001A4D]">
            <AlertCircle className="w-4 h-4 text-[#0E4EBD] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Both 1st & 2nd Semesters Created</p>
              <p className="text-[11px] text-gray-700 mt-0.5">
                Both terms for A.Y. {form.academicYear} have already been registered. Please choose an upcoming Academic Year below.
              </p>
            </div>
          </div>
        )}

        {/* Duplicate / submit error */}
        {(errors.duplicate || errors.submit) && (
          <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-xs">{errors.duplicate || errors.submit}</p>
          </div>
        )}

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Academic Track Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Academic Track <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setAcademicLevel('COLLEGE');
                  handleSelectTerm('1st Semester');
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  academicLevel === 'COLLEGE'
                    ? 'bg-[#001A4D] text-[#FFD41C] border-[#001A4D] shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                College (Semestral)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAcademicLevel('SHS');
                  handleSelectTerm('1st Trimester');
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  academicLevel === 'SHS'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                Senior High School (Trimestral)
              </button>
            </div>
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Academic Year <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 2026-2027"
              maxLength={9}
              className={`w-full px-4 py-2.5 border rounded-lg font-mono focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] ${
                errors.academicYear || (!ayValidation.valid && form.academicYear.length === 9)
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300"
              }`}
              value={form.academicYear}
              onChange={handleAYInputChange}
            />
            {errors.academicYear ? (
              <p className="text-red-500 text-xs mt-1">{errors.academicYear}</p>
            ) : !ayValidation.valid && form.academicYear.length === 9 ? (
              <p className="text-red-500 text-xs mt-1">{ayValidation.error}</p>
            ) : form.academicYear.length > 0 && form.academicYear.length < 9 ? (
              <p className="text-amber-600 text-xs mt-1 font-sans">
                Format must be YYYY-YYYY (e.g. 2026-2027)
              </p>
            ) : null}

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-gray-400 font-semibold mr-1">Suggestions:</span>
              {aySuggestions.map((ay) => {
                const isSelected = form.academicYear === ay;
                return (
                  <button
                    key={ay}
                    type="button"
                    onClick={() => handleSelectAY(ay)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-[#001A4D] text-[#FFD41C] shadow-xs"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {ay}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Semester / Trimester Term Availability */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {academicLevel === 'SHS' ? 'Trimester' : 'Semester'} <span className="text-red-500">*</span>
            </label>
            <div className={`grid ${academicLevel === 'SHS' ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5`}>
              {(academicLevel === 'SHS'
                ? (['1st Trimester', '2nd Trimester', '3rd Trimester'] as TrimesterTerm[])
                : (['1st Semester', '2nd Semester'] as SemesterTerm[])
              ).map((opt) => {
                const isAlreadyCreated =
                  opt === '1st Semester' || opt === '1st Trimester'
                    ? termAvailability.firstSemExists
                    : opt === '2nd Semester' || opt === '2nd Trimester'
                    ? termAvailability.secondSemExists
                    : termAvailability.thirdSemExists;
                const isSelected = form.semester === opt;

                return (
                  <label
                    key={opt}
                    className={`flex flex-col gap-1 px-3 py-2.5 border rounded-xl transition-all ${
                      isAlreadyCreated
                        ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'border-[#0E4EBD] bg-blue-50/50 ring-2 ring-[#0E4EBD]/30 cursor-pointer'
                        : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="academicTerm"
                        value={opt}
                        checked={isSelected}
                        disabled={isAlreadyCreated}
                        onChange={() => handleSelectTerm(opt)}
                        className="accent-[#0E4EBD]"
                      />
                      <span className="text-xs font-bold text-[#001A4D]">{opt}</span>
                    </div>
                    {isAlreadyCreated && (
                      <span className="text-[10px] font-bold text-amber-700 ml-5">
                        ✓ Created
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            {errors.semester && <p className="text-red-500 text-xs mt-1">{errors.semester}</p>}
          </div>

          {/* Auto-generated Label (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              Semester Label
              <span className="text-[10px] text-[#0E4EBD] bg-blue-50 px-1.5 py-0.5 rounded font-semibold">AUTO</span>
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={autoLabel || "Select Academic Year and Semester above…"}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 font-mono font-semibold text-sm pr-9"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Auto-generated label used across events, QR tickets, certificates, and student transcripts.
            </p>
          </div>

          {/* Start / End Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                min={todayStr}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] ${
                  errors.startDate ? "border-red-400 bg-red-50" : "border-gray-300"
                }`}
                value={form.startDate}
                onChange={(e) => {
                  setForm({ ...form, startDate: e.target.value });
                  setErrors((prev) => ({ ...prev, startDate: "", endDate: "" }));
                }}
              />
              {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                min={form.startDate && form.startDate > todayStr ? form.startDate : todayStr}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] ${
                  errors.endDate ? "border-red-400 bg-red-50" : "border-gray-300"
                }`}
                value={form.endDate}
                onChange={(e) => {
                  setForm({ ...form, endDate: e.target.value });
                  setErrors((prev) => ({ ...prev, endDate: "" }));
                }}
              />
              {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
            </div>
          </div>

          {/* Re-enrollment Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Re-enrollment Deadline
            </label>
            <input
              type="date"
              min={todayStr}
              max={form.startDate || undefined}
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] ${
                errors.reenrollDeadline ? "border-red-400 bg-red-50" : "border-gray-300"
              }`}
              value={form.reenrollDeadline}
              onChange={(e) => {
                setForm({ ...form, reenrollDeadline: e.target.value });
                setErrors((prev) => ({ ...prev, reenrollDeadline: "" }));
              }}
            />
            {errors.reenrollDeadline ? (
              <p className="text-red-500 text-xs mt-1">{errors.reenrollDeadline}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Date by which students must confirm enrollment for this term (must be before or on start date).</p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Initial Status</label>
            <div className="flex gap-4">
              {(["UPCOMING", "ACTIVE"] as SemesterStatus[]).map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={form.status === s}
                    disabled={s === "ACTIVE" && hasActiveBlock}
                    onChange={() => {
                      setForm({ ...form, status: s });
                      setErrors((prev) => ({ ...prev, status: "" }));
                    }}
                    className="accent-[#0E4EBD]"
                  />
                  <span className={`text-sm capitalize ${s === "ACTIVE" && hasActiveBlock ? "text-gray-400" : ""}`}>
                    {s === "UPCOMING" ? "Upcoming (Recommended)" : "Active"}
                  </span>
                </label>
              ))}
            </div>
            {errors.status && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-xs">{errors.status}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved || !ayValidation.valid || termAvailability.bothExist}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
              saved
                ? "bg-green-600 text-white"
                : "bg-[#001A4D] text-white hover:bg-[#001A4D]/90 disabled:opacity-50 disabled:cursor-not-allowed"
            }`}
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : saved ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Semester
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Rollover Modal ────────────────────────────────────────────────────────────
interface RolloverModalProps {
  existingSemesters: SemesterDocument[];
  defaultAcademicLevel?: AcademicLevel;
  onClose: () => void;
  onSuccess?: () => void;
}

function RolloverModal({ existingSemesters, defaultAcademicLevel = "COLLEGE", onClose, onSuccess }: RolloverModalProps) {
  const { profile } = useAdviserProfile();
  const [rolloverTrack, setRolloverTrack] = useState<AcademicLevel>(defaultAcademicLevel);
  const [step, setStep] = useState(1);
  const [executing, setExecuting] = useState(false);
  const [done, setDone] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [execStep, setExecStep] = useState(0);
  const [carryBudget, setCarryBudget] = useState(true);
  const [autoInactivate, setAutoInactivate] = useState(true);
  const [flagOfficers, setFlagOfficers] = useState(true);
  const [resetCompliance, setResetCompliance] = useState(true);
  const [execError, setExecError] = useState<string | null>(null);

  const activeSemester = useMemo(
    () =>
      existingSemesters.find(
        (s) =>
          !s.archived &&
          s.status === "ACTIVE" &&
          (s.academicLevel === rolloverTrack ||
            (rolloverTrack === "SHS"
              ? String(s.semester).includes("Trimester")
              : !s.academicLevel && !String(s.semester).includes("Trimester")))
      ),
    [existingSemesters, rolloverTrack]
  );

  const upcomingSemesters = useMemo(
    () => {
      const filtered = existingSemesters.filter(
        (s) =>
          s.status === "UPCOMING" &&
          !s.archived &&
          (s.academicLevel === rolloverTrack ||
            (rolloverTrack === "SHS"
              ? String(s.semester).includes("Trimester")
              : !s.academicLevel && !String(s.semester).includes("Trimester")))
      );
      return sortSemestersChronologically(filtered, "asc");
    },
    [existingSemesters, rolloverTrack]
  );

  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    upcomingSemesters[0]?.id || ""
  );

  useEffect(() => {
    if (upcomingSemesters.length > 0 && !upcomingSemesters.some((s) => s.id === selectedTargetId)) {
      setSelectedTargetId(upcomingSemesters[0].id);
    }
  }, [upcomingSemesters, selectedTargetId]);

  const targetSemester = useMemo(
    () => upcomingSemesters.find((s) => s.id === selectedTargetId) || upcomingSemesters[0],
    [upcomingSemesters, selectedTargetId]
  );

  const steps = ["Select New Semester", "Review Impact", "Configure Rollover", "Confirm & Execute"];

  const execSteps = [
    "Validating semester records and permissions...",
    `Closing active ${rolloverTrack === 'SHS' ? 'trimester' : 'semester'} (${activeSemester?.label || 'Current'})...`,
    `Activating target ${rolloverTrack === 'SHS' ? 'trimester' : 'semester'} (${targetSemester?.label || 'Next'})...`,
    `Flagging active ${rolloverTrack === 'SHS' ? 'SHS' : 'College'} students for re-enrollment in active registry...`,
    "Writing immutable audit trail log...",
  ];

  const handleExecute = async () => {
    if (!activeSemester || !targetSemester) return;
    setExecuting(true);
    setExecError(null);
    setExecStep(0);

    try {
      setExecStep(1);
      await new Promise((r) => setTimeout(r, 600));

      setExecStep(2);
      await new Promise((r) => setTimeout(r, 600));

      setExecStep(3);
      await executeSemesterRollover(
        activeSemester,
        targetSemester,
        { academicLevel: rolloverTrack, carryBudget, autoInactivate, flagOfficers, resetCompliance },
        profile?.uid
      );

      setExecStep(4);
      await new Promise((r) => setTimeout(r, 600));

      setDone(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Rollover execution error:", err);
      setExecError(err?.message || "Failed to execute rollover.");
      setExecuting(false);
    }
  };

  if (executing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] p-8">
          <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] -mx-8 -mt-8 px-8 py-5 rounded-t-2xl mb-6 flex items-center gap-3">
            <RefreshCw className="w-8 h-8 text-[#FFD41C] animate-spin" style={{ animationDuration: "2s" }} />
            <span className="text-white font-bold text-lg">{done ? "Rollover Complete!" : "Executing Rollover..."}</span>
          </div>

          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-[#001A4D] font-bold text-xl mb-1">Semester Rollover Complete!</p>
              <p className="text-gray-500 text-sm mb-1">
                <strong>{targetSemester?.label}</strong> is now the active semester.
              </p>
              <p className="text-xs text-gray-400 mb-5">
                All active students are now listed under <strong>Re-enrollment Management</strong>.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 bg-[#001A4D] text-[#FFD41C] font-bold rounded-xl text-sm hover:bg-[#001A4D]/90 transition-colors cursor-pointer"
              >
                View Updated Dashboard
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-5">
                {execSteps.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {i < execStep ? (
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : i === execStep ? (
                      <Loader className="w-4 h-4 text-[#0E4EBD] animate-spin flex-shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        i < execStep ? "text-emerald-700 font-medium" : i === execStep ? "text-[#0E4EBD] font-bold" : "text-gray-400"
                      }`}
                    >
                      {s}
                    </span>
                  </div>
                ))}
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0E4EBD] rounded-full transition-all duration-500"
                  style={{ width: `${(execStep / execSteps.length) * 100}%` }}
                />
              </div>
              <p className="text-right text-gray-400 text-xs mt-1">
                Step {execStep} of {execSteps.length}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[680px] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-8 py-5 rounded-t-2xl flex items-center gap-4">
          <div className="w-[52px] h-[52px] bg-[#FFD41C] rounded-full flex items-center justify-center">
            <RefreshCw className="w-7 h-7 text-[#001A4D]" />
          </div>
          <div>
            <p className="text-white font-bold text-[22px]">Semester Rollover</p>
            <p className="text-[#FFD41C] text-sm">Switch to the next academic semester</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center px-8 py-4 border-b border-gray-200 bg-white gap-2">
          {steps.map((s, i) => {
            const num = i + 1;
            const isActive = num === step;
            const isDone = num < step;
            return (
              <div key={i} className="flex items-center gap-1 flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isDone ? "bg-emerald-500 text-white" : isActive ? "bg-[#0E4EBD] text-white" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : num}
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isActive ? "text-[#0E4EBD] font-bold" : isDone ? "text-emerald-600 font-medium" : "text-gray-400"
                  }`}
                >
                  {s}
                </span>
                {i < steps.length - 1 && <div className="flex-1 h-px bg-gray-200 mx-1" />}
              </div>
            );
          })}
        </div>

        {/* Error notice if any */}
        {execError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p>{execError}</p>
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-[#001A4D] font-bold text-lg mb-1">Which track are you rolling over?</p>
                <p className="text-gray-500 text-xs">
                  Choose the academic track and select the upcoming term to activate.
                </p>
              </div>

              {/* Track Selector */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRolloverTrack('COLLEGE')}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                    rolloverTrack === 'COLLEGE'
                      ? 'bg-[#001A4D] text-[#FFD41C] border-[#001A4D] shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  College (Semestral)
                </button>
                <button
                  type="button"
                  onClick={() => setRolloverTrack('SHS')}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                    rolloverTrack === 'SHS'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  Senior High School (Trimestral)
                </button>
              </div>

              {upcomingSemesters.length === 0 ? (
                <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 font-bold">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    No Upcoming {rolloverTrack === 'SHS' ? 'Trimesters' : 'Semesters'} Found
                  </div>
                  <p className="text-amber-700 text-xs leading-relaxed">
                    You do not have any registered <strong>UPCOMING</strong> {rolloverTrack === 'SHS' ? 'trimesters' : 'semesters'} under {rolloverTrack === 'SHS' ? 'Senior High School' : 'College'}. Please create the next term before running a rollover.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingSemesters.map((sem) => {
                    const isSelected = (targetSemester?.id === sem.id);
                    return (
                      <label
                        key={sem.id}
                        onClick={() => setSelectedTargetId(sem.id)}
                        className={`block p-4 border rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? "border-[#0E4EBD] bg-blue-50/40 ring-2 ring-[#0E4EBD]/30"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="targetSemester"
                              checked={isSelected}
                              onChange={() => setSelectedTargetId(sem.id)}
                              className="accent-[#0E4EBD]"
                            />
                            <div>
                              <p className="font-bold text-[#001A4D] text-base">
                                {sem.semester} · A.Y. {sem.academicYear}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {formatDate(sem.startDate)} – {formatDate(sem.endDate)}
                              </p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-blue-50 text-[#0E4EBD] text-xs font-bold rounded-full border border-blue-100">
                            {sem.label}
                          </span>
                        </div>
                        {sem.reenrollDeadline && (
                          <div className="mt-2 text-xs text-gray-500 pl-7">
                            Re-enrollment Deadline: <strong className="text-gray-700">{formatDate(sem.reenrollDeadline)}</strong>
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-[#001A4D] font-bold text-lg mb-4">What will happen during this rollover?</p>
              
              {/* Transition Banner */}
              <div className="p-4 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] rounded-xl text-white mb-5 flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs uppercase font-bold tracking-wider">Closing Active Semester</p>
                  <p className="text-base font-bold">{activeSemester?.label || "None"}</p>
                </div>
                <div className="text-2xl font-bold text-[#FFD41C]">➔</div>
                <div>
                  <p className="text-[#FFD41C] text-xs uppercase font-bold tracking-wider">Activating New Semester</p>
                  <p className="text-base font-bold">{targetSemester?.label}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="border-l-4 border-amber-500 pl-3 py-3 pr-3 bg-gray-50">
                    <p className="text-[#001A4D] font-bold text-sm">State Changes (New Term):</p>
                  </div>
                  {[
                    "Active Semester status → COMPLETED",
                    "Target Semester status → ACTIVE",
                    "All Active Students → Pending Re-enrollment",
                    "Compliance checklists → Fresh semester cycle",
                    "New event proposals anchor to new term",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0">
                      <RefreshCw className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span className="text-[#001A4D] text-xs">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="border-l-4 border-green-500 pl-3 py-3 pr-3 bg-gray-50">
                    <p className="text-[#001A4D] font-bold text-sm">What Carries Over (Preserved):</p>
                  </div>
                  {[
                    "All past event records and outcomes",
                    "All attendance logs — Preserved in full",
                    "All unpaid balances and fines carry over",
                    "All liquidation and audit trail records",
                    "All student verification data",
                    "All issued certificates",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-[#001A4D] text-xs">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-[#001A4D] font-bold text-lg mb-1">Configure the new semester settings.</p>

              {/* Re-enrollment */}
              <div className="p-4 border border-gray-200 rounded-xl">
                <div className="border-l-4 border-[#0E4EBD] pl-3 mb-4">
                  <p className="text-[#001A4D] font-bold text-sm">Student Re-enrollment</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Re-enrollment Deadline</label>
                    <p className="text-xs font-bold text-[#001A4D]">
                      {targetSemester?.reenrollDeadline ? formatDate(targetSemester.reenrollDeadline) : "Configured on semester creation"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Students must confirm enrollment by this date.</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Auto-Inactivate Students Who Don't Confirm</p>
                      <p className="text-xs text-gray-500">Allows one-click batch inactivation of unconfirmed students in Student Registry</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoInactivate(!autoInactivate)}
                      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${autoInactivate ? "bg-[#0E4EBD]" : "bg-gray-300"}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${autoInactivate ? "translate-x-6" : ""}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Budget */}
              <div className="p-4 border border-gray-200 rounded-xl">
                <div className="border-l-4 border-[#0E4EBD] pl-3 mb-4">
                  <p className="text-[#001A4D] font-bold text-sm">Budget Setup for New Semester</p>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Carry Over Unspent Org Budgets</p>
                    <p className="text-xs text-gray-500">Preserve remaining club cash balances into next semester's allocation.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCarryBudget(!carryBudget)}
                    className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${carryBudget ? "bg-[#0E4EBD]" : "bg-gray-300"}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${carryBudget ? "translate-x-6" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Organization */}
              <div className="p-4 border border-gray-200 rounded-xl">
                <div className="border-l-4 border-[#0E4EBD] pl-3 mb-4">
                  <p className="text-[#001A4D] font-bold text-sm">Organization Settings</p>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Flag Officer Roles for Re-assignment Review", desc: "Notify SAS that officer positions should be confirmed.", state: flagOfficers, toggle: () => setFlagOfficers(!flagOfficers) },
                    { label: "Reset Organization Compliance Scores", desc: "Resets organization compliance checklist for the fresh semester cycle.", state: resetCompliance, toggle: () => setResetCompliance(!resetCompliance) },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={item.toggle}
                        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${item.state ? "bg-[#0E4EBD]" : "bg-gray-300"}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${item.state ? "translate-x-6" : ""}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="text-[#001A4D] font-bold text-lg mb-4">Final confirmation before executing rollover.</p>
              <div className="p-5 bg-[#001A4D] rounded-2xl mb-4 text-white">
                <p className="text-[#FFD41C] font-bold text-xs uppercase tracking-wider mb-3">Rollover Execution Summary</p>
                {[
                  { label: "Current Active Semester", value: activeSemester ? `${activeSemester.semester} · A.Y. ${activeSemester.academicYear}` : "None" },
                  { label: "Target Active Semester", value: targetSemester ? `${targetSemester.semester} · A.Y. ${targetSemester.academicYear}` : "—" },
                  { label: "Budget carry-over", value: carryBudget ? "Yes — unspent balances roll over" : "No — fresh start" },
                  { label: "Auto-inactivate overdue", value: autoInactivate ? "Enabled" : "Disabled" },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center py-2 border-b border-white/10 last:border-0 text-sm">
                    <span className="text-white/70">{row.label}</span>
                    <span className="text-white font-medium">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 border border-gray-200 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authorized}
                    onChange={() => setAuthorized(!authorized)}
                    className="w-5 h-5 accent-[#0E4EBD] flex-shrink-0 mt-0.5"
                  />
                  <span className="text-sm text-gray-700 leading-relaxed">
                    I authorize this semester rollover. I understand this will activate <strong>{targetSemester?.label}</strong>, complete the previous active semester, and flag active students for re-enrollment.
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-between rounded-b-2xl">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="px-5 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            {step > 1 ? "← Previous" : "Cancel"}
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !targetSemester}
              className="px-5 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-sm"
            >
              Next: {steps[step]} →
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleExecute}
                disabled={!authorized || !targetSemester}
                className={`px-5 py-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${
                  authorized && targetSemester ? "bg-[#001A4D] text-[#FFD41C] hover:bg-[#001A4D]/90" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                Execute Semester Rollover
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Semester History View ─────────────────────────────────────────────────────
function SemesterHistoryModal({
  semester,
  onClose,
}: {
  semester: SemesterDocument;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("events");
  const historyTabs = ["events", "attendance", "financial", "students"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        {/* Amber read-only banner */}
        <div className="flex items-center justify-between px-6 py-3 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-600" />
            <span className="text-amber-700 font-bold text-sm">
              Viewing Historical Data: {semester.semester} · A.Y. {semester.academicYear}. All data in this view is read-only.
            </span>
          </div>
          <button onClick={onClose} className="text-[#001A4D] text-xs font-medium hover:underline">
            Return to Current Semester
          </button>
        </div>

        {/* Header Card */}
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-2xl">
              {semester.semester} · A.Y. {semester.academicYear}
            </p>
            <p className="text-white/80 text-sm">
              {formatDate(semester.startDate)} — {formatDate(semester.endDate)}
            </p>
          </div>
          <div className="flex gap-3">
            {[
              { label: "Events Held", value: semester.events },
              { label: "Students Active", value: semester.students },
              { label: "Liquidations Filed", value: "—" },
              { label: "Certificates Issued", value: "—" },
            ].map((chip) => (
              <div key={chip.label} className="px-3 py-2 bg-white/15 rounded-xl text-center">
                <p className="text-white font-bold text-base">{chip.value}</p>
                <p className="text-white/80 text-xs">{chip.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 bg-white">
          {historyTabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                tab === t ? "border-[#0E4EBD] text-[#0E4EBD] font-bold" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "events" ? "Events" : t === "attendance" ? "Attendance" : t === "financial" ? "Financial" : "Students"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "events" && (
            <div className="space-y-3">
              {semester.events === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No events recorded for this semester.</p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Event records are pulled from the events module.</p>
              )}
            </div>
          )}
          {tab === "attendance" && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Overall Attendance Rate", value: "—", color: "text-green-600" },
                { label: "Total Check-ins", value: "—", color: "text-[#001A4D]" },
                { label: "Avg per Event", value: "—", color: "text-[#0E4EBD]" },
              ].map((s) => (
                <div key={s.label} className="p-4 bg-white border border-gray-200 rounded-xl text-center">
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-500 text-xs mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}
          {tab === "financial" && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Total Budget Allocated", value: "—", color: "text-[#001A4D]" },
                { label: "Total Spent", value: "—", color: "text-[#0E4EBD]" },
                { label: "Liquidations Filed", value: "—", color: "text-blue-600" },
                { label: "Approved", value: "—", color: "text-green-600" },
              ].map((s) => (
                <div key={s.label} className="p-4 bg-white border border-gray-200 rounded-xl">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-500 text-xs mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}
          {tab === "students" && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Total Enrolled", value: String(semester.students) || "—", color: "text-[#001A4D]" },
                { label: "Active at Semester End", value: "—", color: "text-green-600" },
                { label: "Overall Compliance Rate", value: "—", color: "text-[#0E4EBD]" },
                { label: "Re-enrollment Confirmation", value: "—", color: "text-blue-600" },
              ].map((s) => (
                <div key={s.label} className="p-4 bg-white border border-gray-200 rounded-xl">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-500 text-xs mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-[#001A4D] font-bold text-sm mb-3">Generate Historical Report</p>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-[#001A4D] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-[#001A4D]/90 transition-colors">
              <Download className="w-3.5 h-3.5" />
              Export Full Semester Report (PDF)
            </button>
            <button className="px-4 py-2 border border-[#0E4EBD] text-[#0E4EBD] rounded-lg text-xs hover:bg-blue-50 transition-colors flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Export Financial Summary (Excel)
            </button>
            <button className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors">
              Export Attendance Data (CSV)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Archive Confirm Modal ─────────────────────────────────────────────────────
function ArchiveConfirmModal({
  semester,
  onClose,
  onConfirm,
}: {
  semester: SemesterDocument;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-4 flex items-center gap-3">
          <Archive className="w-5 h-5 text-white" />
          <h3 className="text-white font-bold text-base">Archive Semester</h3>
        </div>
        <div className="p-5">
          <p className="text-[#001A4D] font-medium mb-2">
            Archive <strong>{semester.semester} · A.Y. {semester.academicYear}</strong>?
          </p>
          <p className="text-gray-500 text-sm">
            This will mark the semester as <strong>COMPLETED</strong> and hide it from the active view. Historical data is preserved and accessible in the Archived tab.
          </p>
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-amber-600 transition-colors"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
            Archive Semester
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Semester Modal ───────────────────────────────────────────────────────
interface EditSemesterModalProps {
  semester: SemesterDocument;
  existingSemesters: SemesterDocument[];
  onClose: () => void;
}

function EditSemesterModal({ semester, existingSemesters, onClose }: EditSemesterModalProps) {
  const [form, setForm] = useState({
    academicYear:     semester.academicYear,
    semester:         semester.semester as SemesterTerm | "",
    startDate:        semester.startDate,
    endDate:          semester.endDate,
    reenrollDeadline: semester.reenrollDeadline ?? "",
    status:           semester.status,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Live AY strict validation
  const ayValidation = useMemo(
    () => validateAcademicYearStrict(form.academicYear),
    [form.academicYear]
  );

  const handleAYInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = sanitizeAcademicYearInput(e.target.value);
    setForm((prev) => ({ ...prev, academicYear: formatted }));
    setErrors((prev) => ({ ...prev, academicYear: "", duplicate: "" }));
  };

  const autoLabel = useMemo(() => {
    if (!form.academicYear || !form.semester) return "";
    return generateSemesterLabel(form.academicYear, form.semester as SemesterTerm);
  }, [form.academicYear, form.semester]);

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};

    const ayCheck = validateAcademicYearStrict(form.academicYear);
    if (!ayCheck.valid) {
      errs.academicYear = ayCheck.error || "Invalid academic year.";
    }

    if (!form.semester)           errs.semester     = "Please select a semester.";
    if (!form.startDate)          errs.startDate    = "Start date is required.";
    if (!form.endDate)            errs.endDate      = "End date is required.";

    if (form.startDate && form.endDate && form.endDate <= form.startDate) {
      errs.endDate = "End date must be after start date.";
    }
    if (form.reenrollDeadline && form.startDate && form.reenrollDeadline > form.startDate) {
      errs.reenrollDeadline = "Re-enrollment deadline should be on or before the semester start date.";
    }

    // Duplicate: same AY + term, but not itself
    const duplicate = existingSemesters.some(
      (s) =>
        s.id !== semester.id &&
        s.academicYear.replace(/[–—\s]/g, "-").toLowerCase() === form.academicYear.replace(/[–—\s]/g, "-").toLowerCase() &&
        s.semester === form.semester
    );
    if (duplicate && !errs.academicYear && !errs.semester) {
      errs.duplicate = `${form.semester} for A.Y. ${form.academicYear} already exists.`;
    }

    // Date conflict: skip self
    if (form.startDate && form.endDate && !errs.startDate && !errs.endDate) {
      const conflicting = existingSemesters.find((s) => {
        if (s.id === semester.id || !s.startDate || !s.endDate) return false;
        return form.startDate <= s.endDate && form.endDate >= s.startDate;
      });
      if (conflicting) {
        errs.dateConflict =
          `Date range conflicts with: ${conflicting.semester} · A.Y. ${conflicting.academicYear} ` +
          `(${formatDate(conflicting.startDate)} – ${formatDate(conflicting.endDate)}).`;
      }
    }

    return errs;
  }

  async function handleSave() {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      await updateSemester(semester.id, {
        academicYear:     form.academicYear.replace(/[–—]/g, "-").trim(),
        semester:         form.semester as SemesterTerm,
        startDate:        form.startDate,
        endDate:          form.endDate,
        reenrollDeadline: form.reenrollDeadline,
        status:           form.status,
      });
      setSaved(true);
      setTimeout(onClose, 1200);
    } catch {
      setErrors({ submit: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[540px] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Edit className="w-5 h-5 text-[#FFD41C]" />
            <div>
              <h3 className="text-white font-bold text-base">Edit Semester</h3>
              <p className="text-white/70 text-xs mt-0.5">{semester.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error banners */}
        {(errors.duplicate || errors.submit) && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-xs">{errors.duplicate || errors.submit}</p>
          </div>
        )}
        {errors.dateConflict && (
          <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <Calendar className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 text-xs font-semibold mb-0.5">Date Range Conflict</p>
              <p className="text-red-700 text-xs">{errors.dateConflict}</p>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Academic Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Academic Year <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 2026-2027"
              maxLength={9}
              className={`w-full px-4 py-2.5 border rounded-lg font-mono focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] ${
                errors.academicYear || (!ayValidation.valid && form.academicYear.length === 9)
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300"
              }`}
              value={form.academicYear}
              onChange={handleAYInputChange}
            />
            {errors.academicYear ? (
              <p className="text-red-500 text-xs mt-1">{errors.academicYear}</p>
            ) : !ayValidation.valid && form.academicYear.length === 9 ? (
              <p className="text-red-500 text-xs mt-1">{ayValidation.error}</p>
            ) : form.academicYear.length > 0 && form.academicYear.length < 9 ? (
              <p className="text-amber-600 text-xs mt-1 font-sans">
                Format must be YYYY-YYYY (e.g. 2026-2027)
              </p>
            ) : null}
          </div>

          {/* Semester */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Semester <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              {(["1st Semester", "2nd Semester"] as SemesterTerm[]).map((opt) => (
                <label
                  key={opt}
                  className={`flex-1 flex items-center gap-2.5 px-4 py-3 border rounded-lg cursor-pointer transition-all ${
                    form.semester === opt
                      ? "border-[#0E4EBD] bg-blue-50/50 ring-2 ring-[#0E4EBD]/30"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="edit-semester"
                    value={opt}
                    checked={form.semester === opt}
                    onChange={() => {
                      setForm({ ...form, semester: opt });
                      setErrors((p) => ({ ...p, semester: "", duplicate: "" }));
                    }}
                    className="accent-[#0E4EBD]"
                  />
                  <span className="text-sm font-medium text-[#001A4D]">{opt}</span>
                </label>
              ))}
            </div>
            {errors.semester && <p className="text-red-500 text-xs mt-1">{errors.semester}</p>}
          </div>

          {/* Auto label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              Semester Label
              <span className="text-[10px] text-[#0E4EBD] bg-blue-50 px-1.5 py-0.5 rounded font-semibold">AUTO</span>
            </label>
            <div className="relative">
              <input
                readOnly
                type="text"
                value={autoLabel || "Fill in Academic Year and Semester above…"}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 italic text-sm pr-9"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                min={form.status === "UPCOMING" ? todayStr : undefined}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] ${
                  errors.startDate || errors.dateConflict ? "border-red-400 bg-red-50" : "border-gray-300"
                }`}
                value={form.startDate}
                onChange={(e) => {
                  setForm({ ...form, startDate: e.target.value });
                  setErrors((p) => ({ ...p, startDate: "", endDate: "", dateConflict: "" }));
                }}
              />
              {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                min={form.startDate ? form.startDate : form.status === "UPCOMING" ? todayStr : undefined}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] ${
                  errors.endDate || errors.dateConflict ? "border-red-400 bg-red-50" : "border-gray-300"
                }`}
                value={form.endDate}
                onChange={(e) => {
                  setForm({ ...form, endDate: e.target.value });
                  setErrors((p) => ({ ...p, endDate: "", dateConflict: "" }));
                }}
              />
              {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
            </div>
          </div>

          {/* Re-enrollment Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Re-enrollment Deadline
            </label>
            <input
              type="date"
              min={form.status === "UPCOMING" ? todayStr : undefined}
              max={form.startDate || undefined}
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] ${
                errors.reenrollDeadline ? "border-red-400 bg-red-50" : "border-gray-300"
              }`}
              value={form.reenrollDeadline}
              onChange={(e) => {
                setForm({ ...form, reenrollDeadline: e.target.value });
                setErrors((p) => ({ ...p, reenrollDeadline: "" }));
              }}
            />
            {errors.reenrollDeadline && <p className="text-red-500 text-xs mt-1">{errors.reenrollDeadline}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved || !ayValidation.valid}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
              saved
                ? "bg-green-600 text-white"
                : "bg-[#001A4D] text-white hover:bg-[#001A4D]/90 disabled:opacity-50 disabled:cursor-not-allowed"
            }`}
          >
            {saving ? (
              <><Loader className="w-4 h-4 animate-spin" />Saving…</>
            ) : saved ? (
              <><CheckCircle className="w-4 h-4" />Saved!</>
            ) : (
              <><Save className="w-4 h-4" />Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({
  semester,
  onClose,
  onConfirm,
}: {
  semester: SemesterDocument;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const isConfirmed = confirmText.trim().toUpperCase() === "DELETE";

  async function handleDelete() {
    if (!isConfirmed) return;
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[440px] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-4 flex items-center gap-3">
          <Trash2 className="w-5 h-5 text-white" />
          <h3 className="text-white font-bold text-base">Delete Semester</h3>
        </div>

        <div className="p-5 space-y-4">
          {/* Warning */}
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 text-xs font-semibold">This action is permanent and cannot be undone.</p>
              <p className="text-red-600 text-xs mt-0.5">
                All records associated with this semester will be permanently removed from the database.
              </p>
            </div>
          </div>

          {/* Semester info */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-[#001A4D] font-bold text-sm">{semester.semester} · A.Y. {semester.academicYear}</p>
            <p className="text-gray-500 text-xs mt-1">
              {formatDate(semester.startDate)} — {formatDate(semester.endDate)}
            </p>
            <span className="mt-2 inline-flex px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
              ARCHIVED
            </span>
          </div>

          {/* Confirmation input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
            </label>
            <input
              type="text"
              placeholder="DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent font-mono ${
                confirmText && !isConfirmed ? "border-red-400 bg-red-50" : "border-gray-300"
              }`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || loading}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
              isConfirmed && !loading
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-0">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-gray-100 last:border-0">
          <div className="h-5 w-16 bg-gray-200 rounded-full" />
          <div className="h-4 w-28 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="h-4 w-16 bg-gray-200 rounded" />
          <div className="h-4 w-8 bg-gray-200 rounded" />
          <div className="h-4 w-8 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function AcademicSemesterSettings() {
  const { data: semesters, loading, error } = useSemesters();

  const [activeTab, setActiveTab] = useState<"college" | "shs" | "archived">("college");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRollover, setShowRollover] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<SemesterDocument | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<SemesterDocument | null>(null);
  const [editTarget, setEditTarget]       = useState<SemesterDocument | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<SemesterDocument | null>(null);

  const activeCollegeSemester = useMemo(
    () =>
      semesters.find(
        (s) =>
          !s.archived &&
          s.status === "ACTIVE" &&
          (s.academicLevel === "COLLEGE" || (!s.academicLevel && !String(s.semester).includes("Trimester")))
      ),
    [semesters]
  );

  const activeShsSemester = useMemo(
    () =>
      semesters.find(
        (s) =>
          !s.archived &&
          s.status === "ACTIVE" &&
          (s.academicLevel === "SHS" || String(s.semester).includes("Trimester"))
      ),
    [semesters]
  );

  const currentDisplayActiveSemester = activeTab === "shs" ? activeShsSemester : activeCollegeSemester;
  const bannerState = deriveBannerState(
    currentDisplayActiveSemester ? [currentDisplayActiveSemester] : []
  );

  const filteredSemesters = useMemo(() => {
    let list: SemesterDocument[] = [];
    if (activeTab === "archived") {
      list = semesters.filter((s) => s.archived || s.status === "COMPLETED");
    } else if (activeTab === "shs") {
      list = semesters.filter(
        (s) => !s.archived && (s.academicLevel === "SHS" || String(s.semester).includes("Trimester"))
      );
    } else {
      list = semesters.filter(
        (s) =>
          !s.archived &&
          (s.academicLevel === "COLLEGE" || (!s.academicLevel && !String(s.semester).includes("Trimester")))
      );
    }
    return sortSemestersChronologically(list, sortOrder);
  }, [semesters, activeTab, sortOrder]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Academic Year &amp; Semester</h2>
          <p className="text-gray-500 text-sm">Settings &rsaquo; Academic Periods &amp; Tracks</p>
        </div>
        <button
          onClick={() => setShowRollover(true)}
          className="px-5 py-2.5 bg-[#001A4D] hover:bg-[#002D72] text-white rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Run Semester Rollover
        </button>
      </div>

      {/* Active Semester Banner */}
      <ActiveSemesterBanner
        state={bannerState}
        activeSemester={currentDisplayActiveSemester}
        onRollover={() => setShowRollover(true)}
      />

      {/* Firebase error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">Failed to load semesters: {error.message}</p>
        </div>
      )}

      {/* Semester Records Table */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-xs">
        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-gray-100 gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="border-l-4 border-[#0E4EBD] pl-3">
              <h3 className="text-[#001A4D] font-bold text-base">Academic Records</h3>
            </div>
            <div className="flex gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
              <button
                onClick={() => setActiveTab("college")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "college"
                    ? "bg-[#001A4D] text-[#FFD41C] shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                College (Semesters)
              </button>
              <button
                onClick={() => setActiveTab("shs")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "shs"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Senior High School (Trimesters)
              </button>
              <button
                onClick={() => setActiveTab("archived")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "archived"
                    ? "bg-gray-700 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Archived &amp; Completed
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-gray-200 cursor-pointer"
              title="Toggle Chronological Sort Order"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[#0E4EBD]" />
              <span>
                Sort: {sortOrder === "asc" ? "Chronological (Oldest First)" : "Reverse Chronological (Newest First)"}
              </span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-[#001A4D] text-[#FFD41C] rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-[#001A4D]/90 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Add {activeTab === "shs" ? "Trimester" : "Semester"}
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <TableSkeleton />
        ) : filteredSemesters.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium text-sm">
              {activeTab === "college"
                ? "No active or upcoming college semesters."
                : activeTab === "shs"
                ? "No active or upcoming SHS trimesters."
                : "No archived semesters."}
            </p>
            {activeTab !== "archived" && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-3 px-4 py-2 text-[#0E4EBD] text-sm font-bold hover:underline flex items-center gap-1 mx-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add your first {activeTab === "shs" ? "trimester" : "semester"}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Status
                  </th>
                  <th
                    onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                    className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0] cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to toggle chronological sort order"
                  >
                    <div className="flex items-center gap-1">
                      <span>Academic Year</span>
                      {sortOrder === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-[#0E4EBD]" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-[#0E4EBD]" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Semester
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Label
                  </th>
                  <th
                    onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                    className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0] cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to toggle chronological sort order"
                  >
                    <div className="flex items-center gap-1">
                      <span>Start Date</span>
                      {sortOrder === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-[#0E4EBD]" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-[#0E4EBD]" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    End Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Events
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Students
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-[#E0E0E0]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {filteredSemesters.map((sem) => (
                  <tr
                    key={sem.id}
                    className={`transition-colors ${
                      sem.status === "ACTIVE"
                        ? "border-l-4 border-l-[#FFD41C] bg-blue-50/40 hover:bg-blue-50/60"
                        : "hover:bg-gray-50/80"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <StatusPill status={sem.status} />
                    </td>
                    <td className="px-4 py-3 text-[#001A4D] font-bold text-sm">A.Y. {sem.academicYear}</td>
                    <td className="px-4 py-3 text-[#001A4D] text-sm">{sem.semester}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-[#0E4EBD] text-xs font-mono font-semibold rounded">
                        {sem.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{formatDate(sem.startDate)}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{formatDate(sem.endDate)}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{weeksBetween(sem.startDate, sem.endDate)}</td>
                    <td className="px-4 py-3 text-[#0E4EBD] font-bold text-sm">{sem.events}</td>
                    <td className="px-4 py-3 text-[#001A4D] font-bold text-sm">{sem.students}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* View — always available */}
                        <button
                          onClick={() => setHistoryTarget(sem)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                          title="View Semester Data"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit — allowed ONLY for UPCOMING semesters */}
                        <button
                          onClick={() => setEditTarget(sem)}
                          disabled={sem.status !== "UPCOMING"}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                            sem.status !== "UPCOMING"
                              ? "text-gray-300 cursor-not-allowed"
                              : "hover:bg-gray-100 text-gray-500"
                          }`}
                          title={
                            sem.status === "ACTIVE"
                              ? "Cannot edit active semester."
                              : sem.status === "COMPLETED"
                              ? "Cannot edit completed historical semester."
                              : "Edit Semester"
                          }
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Archive — shown only for non-archived, non-ACTIVE */}
                        {!sem.archived && sem.status !== "ACTIVE" && (
                          <button
                            onClick={() => setArchiveTarget(sem)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-50 text-amber-500 transition-colors"
                            title="Archive Semester"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete — only for archived semesters */}
                        {sem.archived && (
                          <button
                            onClick={() => setDeleteTarget(sem)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                            title="Delete Semester (archived only)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddSemesterModal
          existingSemesters={semesters}
          defaultAcademicLevel={activeTab === "shs" ? "SHS" : "COLLEGE"}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => setShowAddModal(false)}
        />
      )}
      {showRollover && (
        <RolloverModal
          existingSemesters={semesters}
          defaultAcademicLevel={activeTab === "shs" ? "SHS" : "COLLEGE"}
          onClose={() => setShowRollover(false)}
        />
      )}
      {historyTarget && (
        <SemesterHistoryModal semester={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}
      {archiveTarget && (
        <ArchiveConfirmModal
          semester={archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onConfirm={() => archiveSemester(archiveTarget.id)}
        />
      )}
      {editTarget && (
        <EditSemesterModal
          semester={editTarget}
          existingSemesters={semesters}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          semester={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteSemester(deleteTarget.id)}
        />
      )}
    </div>
  );
}
