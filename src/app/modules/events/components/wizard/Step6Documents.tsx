import { useState, useEffect, useMemo } from 'react';
import { Upload, FileText, Shield, CheckCircle, X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import type { EventFormData, EventDocumentFile } from '../../types/event.types';
import { uploadToCloudinary } from '../../../../../services/cloudinary';
import { formatAppDate } from '../../../../utils/date';

interface Step6Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
  isOfficer?: boolean;
}

export default function Step6Documents({ data, onUpdate, isOfficer }: Step6Props) {
  // Dynamic Theme Styling based on Officer vs Admin
  const accentBorder = 'border-[#0E4EBD]';
  const accentText = 'text-[#0E4EBD]';
  const accentBg = 'bg-[#0E4EBD]';
  const accentFocusRing = 'focus:ring-[#0E4EBD]';
  const accentGradient = 'from-[#001A4D] to-[#0E4EBD]';

  // ─── ENSURE ONLY ACTIVITY PROPOSAL IS REQUIRED ────────────────────────────
  useEffect(() => {
    let docs = data.documents ? [...data.documents] : [];

    const hasActivityProp = docs.some(
      (d) => d.id === 'req_activity_proposal' || (d.name || '').toLowerCase().includes('activity proposal')
    );

    if (!hasActivityProp) {
      docs.unshift({
        id: 'req_activity_proposal',
        name: 'Activity Proposal',
        fileUrl: null,
        required: true,
      });
    }

    // Standardize: Activity Proposal is required (true), all others are optional (false)
    docs = docs.map((d) => {
      const isActivityProp =
        d.id === 'req_activity_proposal' || (d.name || '').toLowerCase().includes('activity proposal');
      return {
        ...d,
        id: isActivityProp ? 'req_activity_proposal' : d.id,
        name: isActivityProp ? 'Activity Proposal' : d.name,
        required: isActivityProp,
      };
    });

    // Filter out old legacy required document stubs if empty
    docs = docs.filter(
      (d) =>
        d.required ||
        Boolean(d.fileUrl) ||
        (Boolean(d.name) &&
          d.name !== 'Official Event Approval Letter' &&
          d.name !== 'Approved Budget Authorization' &&
          d.name !== 'Campus Permit / Facilities Authorization')
    );

    // Only trigger update if changed
    if (JSON.stringify(docs) !== JSON.stringify(data.documents || [])) {
      onUpdate({ documents: docs });
    }
  }, [data.documents]);

  const documents = data.documents || [];
  const requiredDocItem = documents.find((d) => d.required) || {
    id: 'req_activity_proposal',
    name: 'Activity Proposal',
    fileUrl: null,
    required: true,
  };
  const extraDocuments = documents.filter((d) => !d.required);

  const [authorizationChecked, setAuthorizationChecked] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  const updateField = (field: keyof EventFormData, value: any) => {
    onUpdate({ [field]: value });
  };

  const addDocument = () => {
    const newDoc: EventDocumentFile = {
      id: `opt_${Date.now()}`,
      name: '',
      fileUrl: null,
      required: false,
    };
    updateField('documents', [...documents, newDoc]);
  };

  const removeDocument = (id: string) => {
    updateField('documents', documents.filter((d) => d.id !== id));
  };

  const updateDocumentName = (id: string, name: string) => {
    updateField(
      'documents',
      documents.map((d) => (d.id === id ? { ...d, name } : d))
    );
  };

  const handleDocumentUpload = async (id: string, file: File) => {
    setUploadingDocId(id);
    try {
      const result = await uploadToCloudinary(file, { folder: 'events/documents' });
      updateField(
        'documents',
        documents.map((d) => (d.id === id ? { ...d, fileUrl: result.secureUrl } : d))
      );
    } catch (error) {
      console.error('Failed to upload document', error);
      alert('Failed to upload document.');
    } finally {
      setUploadingDocId(null);
    }
  };

  // ─── DYNAMIC INSTITUTIONAL COMPLIANCE VERIFICATION ────────────────────────
  const complianceChecklist = useMemo(() => {
    const docs = data.documents || [];
    const activityPropDoc = docs.find(
      (d) => d.id === 'req_activity_proposal' || (d.name || '').toLowerCase().includes('activity proposal')
    );
    const hasUploadedActivityProposal = Boolean(activityPropDoc?.fileUrl);

    const hasOrg = Boolean(data.hostingOrgId);
    const hasStaff = Boolean(
      data.eventHeadUid || data.officerInChargeUid || (data.scanners && data.scanners.length > 0)
    );
    const hasSchedule = Boolean(
      data.sessions &&
        data.sessions.length > 0 &&
        (data.venueId || data.customVenueName || data.eventFormat)
    );
    const budgetTotal = (data.budgetItems || []).reduce(
      (sum, item) => sum + Number(item.quantity || 1) * Number(item.unitCost || 0),
      0
    );

    const isCertified = Boolean(data.isCertified || data.officerAcknowledgement);

    const items = [
      {
        id: 1,
        check: 'Organization is currently active and compliant',
        status: hasOrg ? ('passed' as const) : ('failed' as const),
        reason: hasOrg ? 'Hosting organization verified active' : 'No hosting organization assigned',
        auto: true,
      },
      {
        id: 2,
        check: 'Assigned officers are registered and in good standing',
        status: hasStaff ? ('passed' as const) : ('warning' as const),
        reason: hasStaff
          ? 'Event Head / Officers in charge assigned'
          : 'No event head or officer-in-charge assigned yet',
        auto: true,
      },
      {
        id: 3,
        check: 'Event schedule and venue assigned',
        status: hasSchedule ? ('passed' as const) : ('warning' as const),
        reason: hasSchedule
          ? `${data.sessions?.length || 0} session(s) scheduled at assigned venue`
          : 'Event schedule or venue not set',
        auto: true,
      },
      {
        id: 4,
        check: 'Budget requested is within organizational ceiling',
        status: 'passed' as const,
        reason:
          budgetTotal > 0
            ? `Budget allocation of ₱${budgetTotal.toLocaleString()} specified`
            : 'Zero-budget event (No financial allocation requested)',
        auto: true,
      },
      {
        id: 5,
        check: 'Activity Proposal document uploaded',
        status: hasUploadedActivityProposal ? ('passed' as const) : ('warning' as const),
        reason: hasUploadedActivityProposal
          ? 'Activity Proposal document uploaded successfully'
          : 'Activity Proposal document is missing',
        auto: true,
      },
      {
        id: 6,
        check: 'Officer Proposal Acknowledgement certified',
        status: isCertified ? ('passed' as const) : ('warning' as const),
        reason: isCertified
          ? 'Proposal certified accurate and ready for SAO review'
          : 'Officer proposal acknowledgement pending certification',
        auto: true,
      },
    ];

    const passedCount = items.filter((i) => i.status === 'passed').length;
    const warningCount = items.filter((i) => i.status === 'warning').length;
    const score = Math.round((passedCount / items.length) * 100);

    return { items, score, passedCount, warningCount, hasUploadedActivityProposal, isCertified };
  }, [data]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-6">
        {/* Section A - Official Event Documents */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center gap-2 border-l-4 ${accentBorder} pl-3`}>
              <h3 className="text-[#001A4D] font-bold text-base">Official Event Documents</h3>
              <span className={`px-2 py-0.5 ${accentBg} text-white text-xs rounded font-semibold`}>
                {isOfficer ? 'Proposal Attachments' : 'Admin Uploads'}
              </span>
            </div>
            <button
              type="button"
              onClick={addDocument}
              className="px-4 py-2 bg-[#1E70E8] text-white rounded-lg text-sm font-bold hover:bg-[#0E4EBD] flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Document
            </button>
          </div>

          <div className="space-y-4">
            {/* Single Required Document: Activity Proposal */}
            <div className="border border-gray-200 rounded-xl p-4 hover:border-[#0E4EBD] transition-colors bg-white shadow-2xs">
              <div className="flex items-start gap-3 mb-3">
                <FileText className={`w-5 h-5 ${accentText} flex-shrink-0 mt-0.5`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-gray-900 text-sm">Activity Proposal</h4>
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-extrabold rounded">
                      Required
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Comprehensive event proposal outline, objectives, budget request, and session mechanics.
                  </p>
                </div>
              </div>

              <div
                className={`relative border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:${accentBorder} cursor-pointer transition-colors overflow-hidden ${
                  requiredDocItem?.fileUrl ? 'bg-green-50 border-green-300' : ''
                }`}
              >
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleDocumentUpload('req_activity_proposal', e.target.files[0]);
                    }
                  }}
                  disabled={uploadingDocId === 'req_activity_proposal'}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                />
                {uploadingDocId === 'req_activity_proposal' ? (
                  <>
                    <Upload className={`w-6 h-6 ${accentText} animate-bounce mx-auto mb-1`} />
                    <p className="text-xs text-gray-600 font-medium">Uploading Activity Proposal...</p>
                  </>
                ) : requiredDocItem?.fileUrl ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
                    <p className="text-xs text-green-700 font-bold">Activity Proposal Uploaded Successfully</p>
                    <p className="text-[10px] text-green-600 font-medium">Click to replace file</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-700 font-bold">Click to upload Activity Proposal</p>
                    <p className="text-[11px] text-gray-400">PDF, DOC, DOCX, PNG, or JPG formats</p>
                  </>
                )}
              </div>
            </div>

            {/* Optional Additional Documents */}
            {extraDocuments.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Optional Additional Documents ({extraDocuments.length})
                </h4>

                {extraDocuments.map((doc) => (
                  <div key={doc.id} className="border border-blue-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <FileText className="w-4 h-4 text-[#1E70E8]" />
                        <input
                          type="text"
                          placeholder="Document Title (e.g., Risk Management Plan, Parent's Consent)"
                          value={doc.name}
                          onChange={(e) => updateDocumentName(doc.id, e.target.value)}
                          className={`w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold focus:ring-2 ${accentFocusRing} focus:border-transparent outline-none`}
                        />
                      </div>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded">
                        Optional
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDocument(doc.id)}
                        className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                        title="Remove Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div
                      className={`relative border-2 border-dashed border-blue-200 rounded-lg p-3 text-center hover:border-blue-500 cursor-pointer transition-colors overflow-hidden ${
                        doc.fileUrl ? 'bg-green-50 border-green-300' : ''
                      }`}
                    >
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleDocumentUpload(doc.id, e.target.files[0]);
                          }
                        }}
                        disabled={uploadingDocId === doc.id}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                      />
                      {uploadingDocId === doc.id ? (
                        <>
                          <Upload className="w-5 h-5 text-[#1E70E8] animate-bounce mx-auto mb-1" />
                          <p className="text-xs text-gray-600">Uploading file...</p>
                        </>
                      ) : doc.fileUrl ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
                          <p className="text-xs text-green-700 font-bold">Uploaded Successfully</p>
                          <p className="text-[10px] text-green-600 font-medium">Click to replace file</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                          <p className="text-xs text-gray-600 font-medium">Click to upload file attachment</p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section B - Dynamic Institutional Compliance Verification */}
        <div>
          <div className={`flex items-center gap-2 mb-4 border-l-4 ${accentBorder} pl-3`}>
            <h3 className="text-[#001A4D] font-bold text-base">Institutional Compliance Verification</h3>
            <span className={`px-2 py-0.5 ${accentBg} text-white text-xs rounded font-semibold`}>
              Real-time Automated Audit
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-[#001A4D] px-4 py-3 flex items-center justify-between">
              <h4 className="text-white font-bold text-sm">Automated Compliance Checklist</h4>
              <span className="text-xs text-[#FFD41C] font-mono font-bold">
                {complianceChecklist.passedCount} / {complianceChecklist.items.length} Passed
              </span>
            </div>

            <div className="p-4 space-y-3">
              {complianceChecklist.items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3.5 border rounded-xl ${
                    item.status === 'passed'
                      ? 'border-green-200 bg-green-50/50'
                      : item.status === 'warning'
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-red-200 bg-red-50/50'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {item.status === 'passed' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : item.status === 'warning' ? (
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    ) : (
                      <X className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-xs sm:text-sm font-bold ${
                          item.status === 'passed'
                            ? 'text-green-950'
                            : item.status === 'warning'
                            ? 'text-amber-950'
                            : 'text-red-950'
                        }`}
                      >
                        {item.check}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded">
                        Auto-checked
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section C - Adviser / Officer Authorization */}
        <div>
          <div className={`flex items-center gap-2 mb-4 border-l-4 ${accentBorder} pl-3`}>
            <h3 className="text-[#001A4D] font-bold text-base">
              {isOfficer ? 'Officer Submission Acknowledgement' : 'SAO Adviser Authorization'}
            </h3>
            <span className={`px-2 py-0.5 ${accentBg} text-white text-xs rounded font-semibold`}>
              {isOfficer ? 'Officer' : 'Admin Only'}
            </span>
          </div>

          <div className="p-6 bg-[#001A4D] border-4 border-[#FFC107] rounded-xl shadow-md">
            <div className="flex items-start gap-4 mb-4">
              <Shield className="w-8 h-8 text-[#FFC107] flex-shrink-0" />
              <div>
                <h4 className="text-white font-bold text-lg mb-1">
                  {isOfficer ? 'Officer Proposal Acknowledgement' : 'SAO Adviser Authorization'}
                </h4>
                <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">
                  {isOfficer
                    ? 'By submitting this event proposal, you certify that all information is accurate and has been reviewed by your organization officers.'
                    : 'By proceeding to publish this event, you are certifying that all provided information is accurate, all compliance items are verified, and this event is hereby officially approved under your authority as SAO Adviser of STI College Ormoc.'}
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 p-3.5 bg-white/10 border border-[#FFC107] rounded-xl cursor-pointer hover:bg-white/20 transition-colors">
              <input
                type="checkbox"
                checked={Boolean(data.isCertified || data.officerAcknowledgement)}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  updateField('isCertified', isChecked);
                  updateField('officerAcknowledgement', isChecked);
                }}
                className="mt-0.5 text-[#FFC107] bg-white/20 border-[#FFC107] rounded focus:ring-[#FFC107]"
              />
              <span className="text-white font-bold text-xs sm:text-sm">
                {isOfficer ? 'I certify this proposal is complete and ready for SAO review.' : 'I authorize this event creation.'}
              </span>
            </label>

            <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-gray-400 text-[10px] uppercase font-bold">Signatory</div>
                <div className="text-white font-bold">{isOfficer ? 'Club Officer' : 'SAO Adviser'}</div>
              </div>
              <div>
                <div className="text-gray-400 text-[10px] uppercase font-bold">Role</div>
                <div className="text-white font-bold">{isOfficer ? 'Event Lead' : 'System Administrator'}</div>
              </div>
              <div>
                <div className="text-gray-400 text-[10px] uppercase font-bold">Date</div>
                <div className="text-white font-bold">{formatAppDate(new Date())}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Dynamic Compliance Metrics */}
      <div className="sticky top-0 h-fit">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs space-y-4">
          <h4 className="font-bold text-gray-900 text-sm">Compliance Overview</h4>

          <div className="space-y-4">
            <div className="relative aspect-square max-w-[170px] mx-auto">
              <svg viewBox="0 0 100 100" className="transform -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#E5E7EB" strokeWidth="12" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={
                    complianceChecklist.score >= 100
                      ? '#10B981'
                      : complianceChecklist.score >= 80
                      ? '#FFC107'
                      : '#EF4444'
                  }
                  strokeWidth="12"
                  strokeDasharray={`${(complianceChecklist.score / 100) * 251.2} 251.2`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div
                  className={`text-3xl font-extrabold ${
                    complianceChecklist.score >= 100
                      ? 'text-green-600'
                      : complianceChecklist.score >= 80
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}
                >
                  {complianceChecklist.score}%
                </div>
                <div className="text-[11px] text-gray-500 font-semibold">Audit Score</div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-3.5 space-y-2">
              <div className="text-xs font-bold text-gray-800">Document Coverage</div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 font-medium">Activity Proposal</span>
                  <span
                    className={`font-bold font-mono ${
                      complianceChecklist.hasUploadedActivityProposal ? 'text-green-600' : 'text-amber-600'
                    }`}
                  >
                    {complianceChecklist.hasUploadedActivityProposal ? '1/1 Uploaded' : '0/1 Uploaded'}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      complianceChecklist.hasUploadedActivityProposal ? 'bg-green-500' : 'bg-amber-500'
                    }`}
                    style={{ width: complianceChecklist.hasUploadedActivityProposal ? '100%' : '0%' }}
                  />
                </div>

                {extraDocuments.length > 0 && (
                  <>
                    <div className="flex items-center justify-between text-xs pt-2">
                      <span className="text-gray-600 font-medium">Optional Documents</span>
                      <span className="font-bold font-mono text-blue-600">
                        {extraDocuments.filter((d) => Boolean(d.fileUrl)).length}/{extraDocuments.length}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{
                          width: `${
                            (extraDocuments.filter((d) => Boolean(d.fileUrl)).length / extraDocuments.length) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={`p-3 bg-gradient-to-br ${accentGradient} rounded-xl text-white text-center shadow-2xs`}>
              <Shield className="w-5 h-5 mx-auto mb-1 text-[#FFC107]" />
              <div className="text-xs font-bold">Audit Status</div>
              <div
                className={`text-xs font-extrabold mt-0.5 ${
                  complianceChecklist.score >= 100
                    ? 'text-green-300'
                    : complianceChecklist.score >= 80
                    ? 'text-amber-300'
                    : 'text-red-300'
                }`}
              >
                {complianceChecklist.score >= 100
                  ? 'Fully Compliant (100%)'
                  : complianceChecklist.score >= 80
                  ? 'Advisory Warnings'
                  : 'Requires Attention'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
