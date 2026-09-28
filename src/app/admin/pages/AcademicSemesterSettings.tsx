import { useState, useMemo, useEffect } from "react";
import {
  RefreshCw,
  Plus,
  School,
  AlertTriangle,
  AlertCircle,
  Eye,
  Edit,
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
  ShieldAlert,
  Info,
  Archive,
} from "lucide-react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useSemesters } from "../../modules/academic/hooks/useAcademicStream";
import {
  createSemester,
  updateSemester,
  generateSemesterLabel,
  getAcademicYearSuggestions,
  getSemesterTermAvailability,
  executeSemesterRollover,
  sortSemestersChronologically,
} from "../../modules/academic/services/academic.service";
import { useAdviserProfile } from "../../modules/auth/hooks/useAdviserProfile";
import type { SemesterDocument, SemesterStatus, SemesterTerm, AcademicLevel } from "../../modules/academic/types/academic.types";
import { formatAppDate, isDeadlinePassed } from "../../utils/date";


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
  activeTab,
  completedCount = 0,
  canRollover,
  onRollover,
}: {
  state: BannerState;
  activeSemester: SemesterDocument | undefined;
  activeTab: "college" | "shs" | "completed";
  completedCount?: number;
  canRollover: boolean;
  onRollover: () => void;
}) {
  const isShs = activeTab === "shs" || (activeSemester && (activeSemester.academicLevel === "SHS" || String(activeSemester.semester).includes("Trimester")));
  const termTypeLabel = isShs ? "Trimester" : "Semester";

  if (activeTab === "completed") {
    return (
      <div className="w-full p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-[#001A4D] via-[#002B7F] to-[#0A47B8] text-white flex flex-col sm:flex-row sm:items-center justify-between mb-6 shadow-lg shadow-[#001A4D]/15 border border-blue-900/40 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <Archive className="w-6 h-6 text-[#FFD41C]" />
          </div>
          <div>
            <p className="text-white/70 text-xs uppercase tracking-wider mb-0.5 font-bold">Historical Academic Records</p>
            <p className="text-white font-black text-[24px] sm:text-[28px] leading-tight">
              Archived &amp; Completed Terms
            </p>
            <p className="text-white/80 text-xs sm:text-sm mt-0.5">
              Browse and inspect past semester and trimester records, student lists, and activity archives.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-4 py-2.5 bg-white/15 rounded-xl text-center min-w-[140px]">
            <p className="text-[#FFD41C] font-bold text-xl">{completedCount}</p>
            <p className="text-white/80 text-xs font-semibold">Completed Records</p>
          </div>
        </div>
      </div>
    );
  }

  if (!activeSemester && state === "active") {
    return (
      <div className="w-full p-6 rounded-2xl bg-gradient-to-r from-gray-500 to-gray-600 flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <School className="w-10 h-10 text-white/50" />
          <div>
            <p className="text-white/70 text-xs uppercase tracking-wider mb-0.5 font-bold">No Active {termTypeLabel}</p>
            <p className="text-white font-bold text-xl">Add a {termTypeLabel.toLowerCase()} to begin.</p>
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
            <p className="text-white/70 text-xs uppercase tracking-wider mb-0.5 font-bold">Currently Active {termTypeLabel}</p>
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
              {
                label: "Track",
                value: activeSemester.academicLevel === "SHS" ? "Senior High School" : "College",
              },
              {
                label: "Re-enrollment Deadline",
                value: activeSemester.reenrollDeadline ? formatDate(activeSemester.reenrollDeadline) : "Not Set",
              },
            ].map((chip) => (
              <div key={chip.label} className="px-3 py-2 bg-white/15 rounded-xl text-center min-w-[120px]">
                <p className="text-white font-bold text-sm truncate">{chip.value}</p>
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
            <p className="text-white font-bold text-xl">{termTypeLabel} Ending Soon</p>
            <p className="text-white/90 text-sm">
              End Date: {formatDate(activeSemester.endDate)} · {days} day{days !== 1 ? "s" : ""} remaining
            </p>
            <p className="text-white/80 text-sm mt-0.5">Prepare for {termTypeLabel.toLowerCase()} rollover.</p>
          </div>
        </div>
        <button
          onClick={onRollover}
          disabled={!canRollover}
          title={!canRollover ? `Rollover locked until ${termTypeLabel.toLowerCase()} end date or re-enrollment deadline is reached.` : `Run ${termTypeLabel} Rollover`}
          className={`px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${
            canRollover
              ? "bg-[#001A4D] text-white hover:bg-[#001A4D]/90 cursor-pointer"
              : "bg-black/20 text-white/50 cursor-not-allowed border border-white/20"
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Run {termTypeLabel} Rollover
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
            <p className="text-white font-bold text-xl">{termTypeLabel} Has Ended — Rollover Required</p>
            <p className="text-white/90 text-sm mt-0.5">
              The current {termTypeLabel.toLowerCase()} end date has passed. Run the {termTypeLabel.toLowerCase()} rollover to begin the new {termTypeLabel.toLowerCase()}.
            </p>
          </div>
        </div>
        <button
          onClick={onRollover}
          disabled={!canRollover}
          title={!canRollover ? `Rollover locked until ${termTypeLabel.toLowerCase()} end date or re-enrollment deadline is reached.` : `Run ${termTypeLabel} Rollover Now`}
          className={`px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${
            canRollover
              ? "bg-[#FFD41C] text-[#001A4D] hover:bg-[#FFD41C]/90 cursor-pointer"
              : "bg-white/20 text-white/50 cursor-not-allowed border border-white/20"
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Run {termTypeLabel} Rollover Now
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

  const academicLevel = defaultAcademicLevel;
  const isShs = academicLevel === "SHS";
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
    if (!form.semester)           errs.semester     = `Please select a ${isShs ? 'trimester' : 'semester'}.`;
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
      errs.reenrollDeadline = "Re-enrollment deadline should be on or before the start date.";
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
      errs.duplicate = `${form.semester} for A.Y. ${form.academicYear} already exists under ${isShs ? 'Senior High School' : 'College'}.`;
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
        status: "UPCOMING",
        academicLevel,
        termType: isShs ? 'TRIMESTER' : 'SEMESTER',
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[560px] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarPlus className="w-5 h-5 text-[#FFD41C]" />
            <h3 className="text-white font-bold text-base">
              Add {isShs ? 'Senior High School Trimester' : 'College Semester'}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Both Terms Exist Warning */}
        {termAvailability.bothExist && (
          <div className="mx-5 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-xs text-[#001A4D]">
            <AlertCircle className="w-4 h-4 text-[#0E4EBD] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">All {isShs ? 'Trimesters' : 'Semesters'} Created</p>
              <p className="text-[11px] text-gray-700 mt-0.5">
                All terms for A.Y. {form.academicYear} have already been registered under this track. Please choose an upcoming Academic Year below.
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
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
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
              {isShs ? 'Trimester' : 'Semester'} <span className="text-red-500">*</span>
            </label>
            <div className={`grid ${isShs ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5`}>
              {(isShs
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
              {isShs ? 'Trimester Label' : 'Semester Label'}
              <span className="text-[10px] text-[#0E4EBD] bg-blue-50 px-1.5 py-0.5 rounded font-semibold">AUTO</span>
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={autoLabel || `Select Academic Year and ${isShs ? 'Trimester' : 'Semester'} above…`}
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
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved || !ayValidation.valid || termAvailability.bothExist}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
              saved
                ? "bg-green-600 text-white"
                : "bg-[#001A4D] text-white hover:bg-[#001A4D]/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
  const [execError, setExecError] = useState<string | null>(null);
  const [rolloverResult, setRolloverResult] = useState<{ eventsArchivedCount?: number } | null>(null);

  // Active term for currently selected track
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

  // Validation: Check if active term's deadline or end date has been reached
  const isEndDatePassed = activeSemester?.endDate ? isDeadlinePassed(activeSemester.endDate) : false;
  const isDeadlinePassedVal = activeSemester?.reenrollDeadline ? isDeadlinePassed(activeSemester.reenrollDeadline) : false;
  const isRolloverAllowedForTrack = Boolean(activeSemester && (isEndDatePassed || isDeadlinePassedVal));

  // Upcoming terms for selected track
  const upcomingSemesters = useMemo(() => {
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
  }, [existingSemesters, rolloverTrack]);

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

  const steps = ["Select Track & Term", "Review Impact & Confirm"];

  const execSteps = [
    `Validating ${rolloverTrack === "SHS" ? "Senior High School" : "College"} records...`,
    `Closing active ${rolloverTrack === "SHS" ? "trimester" : "semester"} (${activeSemester?.label || "Current"})...`,
    `Archiving completed events for ${activeSemester?.label || "closing term"}...`,
    `Activating target ${rolloverTrack === "SHS" ? "trimester" : "semester"} (${targetSemester?.label || "Next"})...`,
    `Updating active ${rolloverTrack === "SHS" ? "SHS" : "College"} students to require re-enrollment...`,
    "Writing immutable audit trail log...",
  ];

  const handleExecute = async () => {
    if (!activeSemester || !targetSemester || !isRolloverAllowedForTrack) return;
    setExecuting(true);
    setExecError(null);
    setExecStep(0);

    try {
      setExecStep(1);
      await new Promise((r) => setTimeout(r, 450));

      setExecStep(2);
      await new Promise((r) => setTimeout(r, 450));

      setExecStep(3);
      await new Promise((r) => setTimeout(r, 450));

      setExecStep(4);
      const res = await executeSemesterRollover(
        activeSemester,
        targetSemester,
        { academicLevel: rolloverTrack },
        profile?.uid
      );
      setRolloverResult(res);

      setExecStep(5);
      await new Promise((r) => setTimeout(r, 450));

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
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
              <p className="text-[#001A4D] font-bold text-xl mb-1">
                {rolloverTrack === "SHS" ? "Senior High School" : "College"} Rollover Complete!
              </p>
              <p className="text-gray-600 text-sm mb-2">
                <strong>{targetSemester?.label}</strong> is now the active {rolloverTrack === "SHS" ? "trimester" : "semester"}.
              </p>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-[#001A4D] text-left mb-4 space-y-1">
                <p className="font-semibold text-[#0E4EBD]">Student Impact Notice:</p>
                <p>
                  All active <strong>{rolloverTrack === "SHS" ? "Senior High School" : "College"}</strong> students must now confirm re-enrollment in the mobile app.
                </p>
                <p className="text-gray-500">
                  {rolloverTrack === "SHS" ? "College" : "Senior High School"} students remain completely unaffected.
                </p>
              </div>
              {typeof rolloverResult?.eventsArchivedCount === "number" && rolloverResult.eventsArchivedCount > 0 && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold mb-5 flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{rolloverResult.eventsArchivedCount} completed event(s) from {activeSemester?.label} archived.</span>
                </div>
              )}
              <button
                onClick={onClose}
                className="w-full py-3 bg-[#001A4D] text-[#FFD41C] font-bold rounded-xl text-sm hover:bg-[#001A4D]/90 transition-colors cursor-pointer"
              >
                Done &amp; View Dashboard
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[640px] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-8 py-5 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-[#FFD41C] rounded-xl flex items-center justify-center shadow-xs">
              <RefreshCw className="w-6 h-6 text-[#001A4D]" />
            </div>
            <div>
              <p className="text-white font-bold text-xl">Academic Rollover</p>
              <p className="text-[#FFD41C] text-xs font-medium">Switch to the next academic period &amp; prompt student re-enrollment</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator (2 Steps) */}
        <div className="flex items-center px-8 py-3.5 border-b border-gray-200 bg-gray-50/70 gap-2">
          {steps.map((s, i) => {
            const num = i + 1;
            const isActive = num === step;
            const isDone = num < step;
            return (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isDone ? "bg-emerald-500 text-white" : isActive ? "bg-[#0E4EBD] text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : num}
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isActive ? "text-[#0E4EBD] font-bold" : isDone ? "text-emerald-700 font-medium" : "text-gray-400"
                  }`}
                >
                  {s}
                </span>
                {i < steps.length - 1 && <div className="flex-1 h-px bg-gray-200 mx-2" />}
              </div>
            );
          })}
        </div>

        {/* Error Notice */}
        {execError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p>{execError}</p>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* STEP 1: Select Track & Upcoming Term */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-[#001A4D] font-bold text-sm mb-1">
                  1. Which Academic Track are you rolling over?
                </label>
                <p className="text-gray-500 text-xs mb-3">
                  Each track operates independently. Rolling over College only affects College students, and rolling over Senior High only affects Senior High students.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRolloverTrack("COLLEGE")}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 ${
                      rolloverTrack === "COLLEGE"
                        ? "bg-[#001A4D] text-[#FFD41C] border-[#001A4D] shadow-sm ring-2 ring-[#001A4D]/20"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <span className="text-sm">College</span>
                    <span className="text-[10px] font-normal opacity-80">Semestral Track</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRolloverTrack("SHS")}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 ${
                      rolloverTrack === "SHS"
                        ? "bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-600/20"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <span className="text-sm">Senior High School</span>
                    <span className="text-[10px] font-normal opacity-90">Trimestral Track</span>
                  </button>
                </div>
              </div>

              {/* Current Active Term Status for selected track */}
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Active Term:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    activeSemester ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                  }`}>
                    {activeSemester ? "ACTIVE" : "NONE"}
                  </span>
                </div>

                {activeSemester ? (
                  <div>
                    <p className="font-bold text-[#001A4D] text-base">
                      {activeSemester.semester} · A.Y. {activeSemester.academicYear}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                      <span>End Date: <strong className="text-gray-700">{formatDate(activeSemester.endDate)}</strong></span>
                      <span>•</span>
                      <span>Re-enrollment Deadline: <strong className="text-gray-700">{formatDate(activeSemester.reenrollDeadline)}</strong></span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">
                    No active {rolloverTrack === "SHS" ? "trimester" : "semester"} found for this track.
                  </p>
                )}

                {/* Validation Notice if deadline or end date not yet reached */}
                {activeSemester && !isRolloverAllowedForTrack && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">
                        Rollover Locked for {rolloverTrack === "SHS" ? "Senior High School" : "College"}
                      </p>
                      <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                        The current active term has not yet reached its end date (<strong>{formatDate(activeSemester.endDate)}</strong>) or re-enrollment deadline (<strong>{formatDate(activeSemester.reenrollDeadline)}</strong>).
                        Rollover is disabled until either date arrives so ongoing student records are not prematurely completed.
                      </p>
                    </div>
                  </div>
                )}

                {activeSemester && isRolloverAllowedForTrack && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Eligible for rollover (deadline or end date reached).</span>
                  </div>
                )}
              </div>

              {/* Upcoming Target Selection */}
              <div>
                <label className="block text-[#001A4D] font-bold text-sm mb-1">
                  2. Select Target Upcoming Term to Activate:
                </label>
                <p className="text-gray-500 text-xs mb-3">
                  This term will become the new current active period for {rolloverTrack === "SHS" ? "Senior High School" : "College"}.
                </p>

                {upcomingSemesters.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-center">
                    <AlertCircle className="w-5 h-5 text-amber-600 mx-auto" />
                    <p className="text-xs font-bold text-amber-900">
                      No Upcoming {rolloverTrack === "SHS" ? "Trimesters" : "Semesters"} Found
                    </p>
                    <p className="text-xs text-amber-800">
                      Please register the next academic term in the main table before executing rollover.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {upcomingSemesters.map((sem) => {
                      const isSelected = targetSemester?.id === sem.id;
                      return (
                        <label
                          key={sem.id}
                          onClick={() => setSelectedTargetId(sem.id)}
                          className={`block p-3.5 border rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? "border-[#0E4EBD] bg-blue-50/50 ring-2 ring-[#0E4EBD]/25"
                              : "border-gray-200 hover:border-gray-300 bg-white"
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
                                <p className="font-bold text-[#001A4D] text-sm">
                                  {sem.semester} · A.Y. {sem.academicYear}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {formatDate(sem.startDate)} – {formatDate(sem.endDate)}
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 bg-blue-50 text-[#0E4EBD] text-xs font-mono font-bold rounded-lg border border-blue-100">
                              {sem.label}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Review Impact & Confirm */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-[#001A4D] font-bold text-base">Review Rollover Impact</p>
                <p className="text-gray-500 text-xs">
                  Verify what changes will take effect once you execute this rollover for <strong>{rolloverTrack === "SHS" ? "Senior High School" : "College"}</strong>.
                </p>
              </div>

              {/* Term Transition Banner */}
              <div className="p-4 bg-gradient-to-r from-[#001A4D] via-[#002B7F] to-[#0E4EBD] rounded-xl text-white flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-[10px] uppercase font-bold tracking-wider">Closing Active Term</p>
                  <p className="text-sm font-bold">{activeSemester?.label || "None"}</p>
                  <span className="text-[10px] text-amber-300">Status &rarr; COMPLETED</span>
                </div>
                <div className="text-xl font-bold text-[#FFD41C]">➔</div>
                <div>
                  <p className="text-[#FFD41C] text-[10px] uppercase font-bold tracking-wider">Activating Next Term</p>
                  <p className="text-sm font-bold">{targetSemester?.label}</p>
                  <span className="text-[10px] text-green-300">Status &rarr; ACTIVE</span>
                </div>
              </div>

              {/* Direct Simple Explanation Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#001A4D]">
                    <RefreshCw className="w-4 h-4 text-[#0E4EBD]" />
                    <span>Student Re-enrollment Effect</span>
                  </div>
                  <ul className="space-y-1.5 text-gray-700">
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#0E4EBD] font-bold">•</span>
                      <span>
                        <strong>All active {rolloverTrack === "SHS" ? "SHS" : "College"} students</strong> will now be flagged as <em>Pending Re-enrollment</em> for {targetSemester?.label}.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#0E4EBD] font-bold">•</span>
                      <span>Students will be prompted to confirm their enrollment via the mobile app.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>
                        Students from the <strong>{rolloverTrack === "SHS" ? "College" : "Senior High School"}</strong> track are <strong>NOT</strong> affected.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="border border-green-200 bg-green-50/50 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-green-900">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Preserved Records</span>
                  </div>
                  <ul className="space-y-1.5 text-gray-700">
                    <li className="flex items-start gap-1.5">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>Past events and completed proposals remain archived and viewable.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>All historical attendance logs, fines, and student balances are preserved.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>Audit trail entry will be written automatically.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <div className="p-3.5 border border-gray-200 rounded-xl bg-gray-50">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authorized}
                    onChange={() => setAuthorized(!authorized)}
                    className="w-4 h-4 accent-[#0E4EBD] flex-shrink-0 mt-0.5"
                  />
                  <span className="text-xs text-gray-700 leading-relaxed font-medium">
                    I authorize this rollover for <strong>{rolloverTrack === "SHS" ? "Senior High School" : "College"}</strong>.
                    I understand that students in this track will be required to re-enroll for <strong>{targetSemester?.label}</strong>.
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-between rounded-b-2xl">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            {step > 1 ? "← Back" : "Cancel"}
          </button>

          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!targetSemester || !isRolloverAllowedForTrack}
              className="px-5 py-2.5 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
            >
              Next: Review Impact →
            </button>
          ) : (
            <button
              onClick={handleExecute}
              disabled={!authorized || !targetSemester || !isRolloverAllowedForTrack}
              className={`px-6 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                authorized && targetSemester && isRolloverAllowedForTrack
                  ? "bg-[#001A4D] text-[#FFD41C] hover:bg-[#001A4D]/90 shadow-sm cursor-pointer"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Execute Rollover Now
            </button>
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
  const [tab, setTab] = useState<"overview" | "events" | "students">("overview");
  const [events, setEvents] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const academicTrack = semester.academicLevel || (String(semester.semester).includes("Trimester") ? "SHS" : "COLLEGE");

  // Query events and students tied to this semester
  useEffect(() => {
    let unsubEvents: () => void = () => {};
    let unsubStudents: () => void = () => {};

    try {
      const eventsQ = query(collection(db, "events"));
      unsubEvents = onSnapshot(eventsQ, (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const matchedEvents = docs.filter((e: any) =>
          e.semesterId === semester.id ||
          (e.schoolYear === semester.academicYear && (e.semester === semester.semester || e.term === semester.semester))
        );
        setEvents(matchedEvents);
      });

      const studentsQ = query(collection(db, "students"));
      unsubStudents = onSnapshot(studentsQ, (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const matchedStudents = docs.filter((s: any) => {
          const sLevel = s.academicLevel || (s.yearLevel === "Grade 11" || s.yearLevel === "Grade 12" ? "SHS" : "COLLEGE");
          return (
            sLevel === academicTrack &&
            s.schoolYear === semester.academicYear &&
            (s.semester === semester.semester || s.term === semester.semester)
          );
        });
        setStudents(matchedStudents);
        setLoadingData(false);
      });
    } catch (err) {
      console.warn("Error subscribing to semester history:", err);
      setLoadingData(false);
    }

    return () => {
      unsubEvents();
      unsubStudents();
    };
  }, [semester.id, semester.academicYear, semester.semester, academicTrack]);

  // Export events CSV
  const handleExportEventsCSV = () => {
    if (events.length === 0) return alert("No events to export.");
    const headers = ["Event Title", "Organizer", "Date", "Location", "Status"];
    const rows = events.map((e) => [
      `"${(e.title || e.eventName || "").replace(/"/g, '""')}"`,
      `"${(e.organizationName || e.org || "").replace(/"/g, '""')}"`,
      `"${e.date || e.startDate || ""}"`,
      `"${(e.location || e.venue || "").replace(/"/g, '""')}"`,
      `"${e.status || e.proposalStatus || ""}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Events_${semester.label}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export students CSV
  const handleExportStudentsCSV = () => {
    if (students.length === 0) return alert("No students to export.");
    const headers = ["Student ID", "Full Name", "Program", "Year Level", "Section", "Status"];
    const rows = students.map((s) => [
      `"${s.studentId || ""}"`,
      `"${(s.firstName || "")} ${(s.lastName || "")}".trim()`,
      `"${s.courseCode || s.courseName || ""}"`,
      `"${s.yearLevel || ""}"`,
      `"${s.section || ""}"`,
      `"${s.status || ""}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Students_${semester.label}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-5 flex items-center justify-between text-white">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-white/20 text-[#FFD41C] text-xs font-bold rounded-full">
                {academicTrack === "SHS" ? "Senior High School" : "College"}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                semester.status === "ACTIVE"
                  ? "bg-green-500 text-white"
                  : semester.status === "UPCOMING"
                  ? "bg-blue-400 text-white"
                  : "bg-gray-400 text-white"
              }`}>
                {semester.status}
              </span>
            </div>
            <h3 className="text-xl font-bold">
              {semester.semester} · A.Y. {semester.academicYear}
            </h3>
            <p className="text-white/80 text-xs mt-0.5 font-mono">
              Label: {semester.label}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 bg-white gap-2">
          <button
            onClick={() => setTab("overview")}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
              tab === "overview" ? "border-[#0E4EBD] text-[#0E4EBD]" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setTab("events")}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === "events" ? "border-[#0E4EBD] text-[#0E4EBD]" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Events
            <span className="px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded-full text-[10px]">
              {events.length}
            </span>
          </button>
          <button
            onClick={() => setTab("students")}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === "students" ? "border-[#0E4EBD] text-[#0E4EBD]" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Enrolled Students
            <span className="px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded-full text-[10px]">
              {students.length}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "overview" && (
            <div className="space-y-5">
              {/* Period Date Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
                  <div className="text-[11px] font-bold text-gray-500 uppercase">Start Date</div>
                  <div className="text-sm font-bold text-[#001A4D] mt-1">{formatDate(semester.startDate)}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
                  <div className="text-[11px] font-bold text-gray-500 uppercase">End Date</div>
                  <div className="text-sm font-bold text-[#001A4D] mt-1">{formatDate(semester.endDate)}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
                  <div className="text-[11px] font-bold text-gray-500 uppercase">Duration</div>
                  <div className="text-sm font-bold text-[#0E4EBD] mt-1">{weeksBetween(semester.startDate, semester.endDate)}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
                  <div className="text-[11px] font-bold text-gray-500 uppercase">Re-enrollment Deadline</div>
                  <div className="text-sm font-bold text-amber-600 mt-1">{formatDate(semester.reenrollDeadline)}</div>
                </div>
              </div>

              {/* Real Metrics Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4">
                  <div className="text-xs font-bold text-[#001A4D] uppercase tracking-wider mb-1">
                    {academicTrack === "SHS" ? "Senior High School" : "College"} Students
                  </div>
                  <div className="text-3xl font-black text-[#001A4D]">{students.length}</div>
                  <p className="text-xs text-gray-500 mt-1">Students enrolled in this academic period.</p>
                </div>
                <div className="border border-green-200 bg-green-50/40 rounded-xl p-4">
                  <div className="text-xs font-bold text-green-900 uppercase tracking-wider mb-1">Events Hosted</div>
                  <div className="text-3xl font-black text-green-700">{events.length}</div>
                  <p className="text-xs text-gray-500 mt-1">Campus proposals and activities conducted.</p>
                </div>
              </div>

              {/* Status Info Box */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-2">
                <div className="font-bold text-[#001A4D]">Period Status Information</div>
                <div className="text-gray-600 leading-relaxed">
                  {semester.status === "ACTIVE" ? (
                    <span>This is currently the active period for {academicTrack === "SHS" ? "Senior High School" : "College"}. Active students can re-enroll and new event proposals anchor to this term.</span>
                  ) : semester.status === "UPCOMING" ? (
                    <span>This is an upcoming period scheduled to begin on {formatDate(semester.startDate)}. You can edit its dates or activate it through a semester rollover once the active period concludes.</span>
                  ) : (
                    <span>This period is completed. All associated event outcomes, attendance history, and student rosters are preserved for institutional audit.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "events" && (
            <div>
              {loadingData ? (
                <div className="py-12 text-center text-gray-400">Loading events...</div>
              ) : events.length === 0 ? (
                <div className="py-12 text-center text-gray-400 space-y-2">
                  <Calendar className="w-8 h-8 mx-auto text-gray-300" />
                  <p className="text-sm">No events recorded for this semester.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-600 font-bold uppercase border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5">Event Name</th>
                        <th className="px-3 py-2.5">Organizer</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {events.map((e) => (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 font-bold text-[#001A4D]">{e.title || e.eventName}</td>
                          <td className="px-3 py-2.5 text-gray-600">{e.organizationName || e.org || "Campus"}</td>
                          <td className="px-3 py-2.5 text-gray-500">{e.date || e.startDate || "—"}</td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                              {e.status || e.proposalStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "students" && (
            <div>
              {loadingData ? (
                <div className="py-12 text-center text-gray-400">Loading students...</div>
              ) : students.length === 0 ? (
                <div className="py-12 text-center text-gray-400 space-y-2">
                  <School className="w-8 h-8 mx-auto text-gray-300" />
                  <p className="text-sm">No students recorded under this academic period.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-600 font-bold uppercase border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5">Student ID</th>
                        <th className="px-3 py-2.5">Student Name</th>
                        <th className="px-3 py-2.5">Program</th>
                        <th className="px-3 py-2.5">Year &amp; Section</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {students.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 font-mono font-bold text-[#0E4EBD]">{s.studentId}</td>
                          <td className="px-3 py-2.5 font-bold text-[#001A4D]">{s.firstName} {s.lastName}</td>
                          <td className="px-3 py-2.5 text-gray-600">{s.courseCode || s.courseName}</td>
                          <td className="px-3 py-2.5 text-gray-600">{s.yearLevel} - {s.section}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Exports */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportEventsCSV}
              disabled={events.length === 0}
              className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export Events (CSV)
            </button>
            <button
              onClick={handleExportStudentsCSV}
              disabled={students.length === 0}
              className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export Students (CSV)
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#001A4D] text-white rounded-lg text-xs font-bold hover:bg-[#001A4D]/90 transition-colors"
          >
            Close
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

          {/* Semester / Trimester */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {String(semester.semester).includes('Trimester') || semester.academicLevel === 'SHS' ? 'Trimester' : 'Semester'} <span className="text-red-500">*</span>
            </label>
            <div className={`grid ${(String(semester.semester).includes('Trimester') || semester.academicLevel === 'SHS') ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
              {((String(semester.semester).includes('Trimester') || semester.academicLevel === 'SHS')
                ? (["1st Trimester", "2nd Trimester", "3rd Trimester"] as any[])
                : (["1st Semester", "2nd Semester"] as SemesterTerm[])
              ).map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-2.5 px-3 py-2.5 border rounded-lg cursor-pointer transition-all ${
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
                  <span className="text-xs font-bold text-[#001A4D]">{opt}</span>
                </label>
              ))}
            </div>
            {errors.semester && <p className="text-red-500 text-xs mt-1">{errors.semester}</p>}
          </div>

          {/* Auto label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              {String(semester.semester).includes('Trimester') || semester.academicLevel === 'SHS' ? 'Trimester Label' : 'Semester Label'}
              <span className="text-[10px] text-[#0E4EBD] bg-blue-50 px-1.5 py-0.5 rounded font-semibold">AUTO</span>
            </label>
            <div className="relative">
              <input
                readOnly
                type="text"
                value={autoLabel || `Fill in Academic Year and ${String(semester.semester).includes('Trimester') || semester.academicLevel === 'SHS' ? 'Trimester' : 'Semester'} above…`}
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
          <div className="h-4 w-20 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function AcademicSemesterSettings() {
  const { data: semesters, loading, error } = useSemesters();

  const [activeTab, setActiveTab] = useState<"college" | "shs" | "completed">("college");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRollover, setShowRollover] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<SemesterDocument | null>(null);
  const [editTarget, setEditTarget]       = useState<SemesterDocument | null>(null);

  const activeCollegeSemester = useMemo(
    () =>
      semesters.find(
        (s) =>
          s.status === "ACTIVE" &&
          (s.academicLevel === "COLLEGE" || (!s.academicLevel && !String(s.semester).includes("Trimester")))
      ),
    [semesters]
  );

  const activeShsSemester = useMemo(
    () =>
      semesters.find(
        (s) =>
          s.status === "ACTIVE" &&
          (s.academicLevel === "SHS" || String(s.semester).includes("Trimester"))
      ),
    [semesters]
  );

  // Rollover validation: active term end date or reenrollment deadline must be passed
  const isCollegeRolloverReady = Boolean(
    activeCollegeSemester &&
    (isDeadlinePassed(activeCollegeSemester.endDate) || isDeadlinePassed(activeCollegeSemester.reenrollDeadline))
  );

  const isShsRolloverReady = Boolean(
    activeShsSemester &&
    (isDeadlinePassed(activeShsSemester.endDate) || isDeadlinePassed(activeShsSemester.reenrollDeadline))
  );

  const canAnyRollover = isCollegeRolloverReady || isShsRolloverReady;

  const completedSemestersCount = useMemo(
    () => semesters.filter((s) => s.status === "COMPLETED").length,
    [semesters]
  );

  const currentDisplayActiveSemester = activeTab === "shs" ? activeShsSemester : activeCollegeSemester;
  const bannerState = deriveBannerState(
    currentDisplayActiveSemester ? [currentDisplayActiveSemester] : []
  );

  const filteredSemesters = useMemo(() => {
    let list: SemesterDocument[] = [];
    if (activeTab === "completed") {
      list = semesters.filter((s) => s.status === "COMPLETED");
    } else if (activeTab === "shs") {
      list = semesters.filter(
        (s) => s.status !== "COMPLETED" && (s.academicLevel === "SHS" || String(s.semester).includes("Trimester"))
      );
    } else {
      list = semesters.filter(
        (s) =>
          s.status !== "COMPLETED" &&
          (s.academicLevel === "COLLEGE" || (!s.academicLevel && !String(s.semester).includes("Trimester")))
      );
    }
    return sortSemestersChronologically(list, sortOrder);
  }, [semesters, activeTab, sortOrder]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Academic Year &amp; Semester</h2>
        </div>
        <button
          onClick={() => setShowRollover(true)}
          disabled={!canAnyRollover}
          className={`px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-xs ${
            canAnyRollover
              ? "bg-[#001A4D] hover:bg-[#002D72] text-white cursor-pointer"
              : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
          }`}
          title={
            !canAnyRollover
              ? "Rollover Locked: Neither College nor Senior High active term has reached its end date or re-enrollment deadline yet."
              : "Run Semester Rollover"
          }
        >
          <RefreshCw className="w-4 h-4" />
          Run Semester Rollover
        </button>
      </div>

      {/* Active Semester Banner / Completed Records Card */}
      <ActiveSemesterBanner
        state={bannerState}
        activeSemester={currentDisplayActiveSemester}
        activeTab={activeTab}
        completedCount={completedSemestersCount}
        canRollover={
          currentDisplayActiveSemester
            ? isDeadlinePassed(currentDisplayActiveSemester.endDate) ||
              isDeadlinePassed(currentDisplayActiveSemester.reenrollDeadline)
            : false
        }
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "college"
                    ? "bg-[#001A4D] text-[#FFD41C] shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                College (Semesters)
              </button>
              <button
                onClick={() => setActiveTab("shs")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "shs"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Senior High School (Trimesters)
              </button>
              <button
                onClick={() => setActiveTab("completed")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "completed"
                    ? "bg-[#001A4D] text-[#FFD41C] shadow-xs"
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
            {activeTab !== "completed" && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-[#001A4D] text-[#FFD41C] rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-[#001A4D]/90 transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add {activeTab === "shs" ? "Trimester" : "Semester"}
              </button>
            )}
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
                : "No completed semesters."}
            </p>
            {activeTab !== "completed" && (
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
                    Re-enrollment Deadline
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
                    <td className="px-4 py-3 text-gray-700 font-medium text-sm">
                      {sem.reenrollDeadline ? formatDate(sem.reenrollDeadline) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* View — always available */}
                        <button
                          onClick={() => setHistoryTarget(sem)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                          title="View Semester Details"
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
      {editTarget && (
        <EditSemesterModal
          semester={editTarget}
          existingSemesters={semesters}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
