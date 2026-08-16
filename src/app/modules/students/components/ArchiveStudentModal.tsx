import { useState, useEffect } from 'react';
import { X, Archive, AlertTriangle, CheckCircle2, Loader2, DollarSign, ShieldAlert } from 'lucide-react';
import type { StudentDocument, StudentArchivalValidation } from '../types/student.types';
import { validateStudentArchival, archiveStudent } from '../services/student.service';

interface ArchiveStudentModalProps {
  student: StudentDocument;
  adminUid: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ARCHIVE_REASONS = [
  'Graduated',
  'Transferred to Another School',
  'Dropped Out',
  'Completed Program',
  'Manual Administrative Archival',
  'Other',
];

export default function ArchiveStudentModal({
  student,
  adminUid,
  onClose,
  onSuccess,
}: ArchiveStudentModalProps) {
  const [loadingValidation, setLoadingValidation] = useState(true);
  const [validation, setValidation] = useState<StudentArchivalValidation | null>(null);
  const [reason, setReason] = useState(ARCHIVE_REASONS[0]);
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoadingValidation(true);

    validateStudentArchival(student)
      .then((res) => {
        if (isMounted) {
          setValidation(res);
          setLoadingValidation(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setValidation({
            canArchive: false,
            blockers: [`Error verifying records: ${err.message}`],
            unpaidPayables: [],
            activeOfficerRoles: [],
          });
          setLoadingValidation(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [student]);

  const handleArchive = async () => {
    if (!validation?.canArchive) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const finalReason = reason === 'Other' && customNote.trim() ? customNote.trim() : reason;
      await archiveStudent(student, finalReason, adminUid);
      onSuccess();
    } catch (err: any) {
      console.error('Archival failed:', err);
      setSubmitError(err.message || 'Failed to archive student.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#E0E0E0]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#001A4D] to-[#83358E] px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Archive className="w-5 h-5 text-[#FFD41C]" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Archive Student Account</h3>
              <p className="text-xs text-white/80">
                {student.firstName} {student.lastName} ({student.studentId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {loadingValidation ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#0E4EBD]" />
              <p className="text-sm text-gray-500 font-medium">Checking student payables & clearance...</p>
            </div>
          ) : (
            <>
              {/* Validation Alert */}
              {!validation?.canArchive ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-red-900">Cannot Archive Student</h4>
                      <p className="text-xs text-red-700 mt-0.5">
                        This student has outstanding financial obligations. All dues, event fees, and fines must be fully settled or waived before archiving.
                      </p>
                    </div>
                  </div>

                  {/* List Unpaid Payables */}
                  {validation?.unpaidPayables && validation.unpaidPayables.length > 0 && (
                    <div className="bg-white rounded-lg border border-red-200 p-3 space-y-2 mt-2">
                      <span className="text-xs font-bold text-red-800 uppercase block">Unpaid Payables:</span>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs">
                        {validation.unpaidPayables.map((p) => (
                          <div key={p.id} className="flex items-center justify-between border-b border-gray-100 pb-1 last:border-0">
                            <div>
                              <span className="font-semibold text-gray-800">{p.label}</span>
                              <span className="text-gray-400 block">{p.organizationName}</span>
                            </div>
                            <span className="font-mono font-bold text-red-600">
                              ₱{p.outstandingAmount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div className="text-xs text-green-800">
                    <span className="font-bold block">Financial Clearance Confirmed</span>
                    Student has zero outstanding payables and is cleared for archival.
                  </div>
                </div>
              )}

              {/* Active Officer Notice */}
              {validation?.activeOfficerRoles && validation.activeOfficerRoles.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Active Officer Role Detected:</span>
                    <p className="mt-0.5">
                      This student is currently registered as an active officer. Archiving will automatically deactivate their officer credentials in the relevant organization(s).
                    </p>
                  </div>
                </div>
              )}

              {/* Reason Selector */}
              {validation?.canArchive && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                      Archive Reason <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] outline-none"
                    >
                      {ARCHIVE_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                      Adviser Notes / Additional Details (Optional)
                    </label>
                    <textarea
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      placeholder="Add any internal documentation regarding this archival..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#83358E] outline-none"
                    />
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs text-gray-600 space-y-1">
                    <span className="font-bold text-gray-700 block">Consequences of Archival:</span>
                    <p>• Student account will be moved to the <strong>Archived</strong> directory.</p>
                    <p>• Mobile application access will be deactivated.</p>
                    <p>• Historical attendance, financial liquidation logs, and certificates will remain preserved.</p>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                  {submitError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleArchive}
            disabled={!validation?.canArchive || submitting || loadingValidation}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 ${
              !validation?.canArchive || submitting || loadingValidation
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-red-600 hover:bg-red-700 shadow-md'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Archiving...
              </>
            ) : (
              <>
                <Archive className="w-4 h-4" />
                Archive Student
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
