import { CheckCircle, Calendar, Users, DollarSign, Shield, Rocket, Clock, MapPin, Award } from 'lucide-react';
import type { EventFormData } from '../../types/event.types';
import { useOfficerProfile } from '../../../../auth/hooks/useOfficerProfile';
import { useAdviserProfile } from '../../../auth/hooks/useAdviserProfile';
import { useAllEvents } from '../../hooks/useEventStream';
import {
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
  validateStep5,
  validateStep6,
} from '../../utils/event-validation';
import { formatCurrency } from '../../../../utils/currency';

interface Step7Props {
  data: EventFormData;
  onUpdate: (data: Partial<EventFormData>) => void;
  onPublish: () => void;
  isPublishing: boolean;
  isOfficer?: boolean;
}

export default function Step7Publish({ data, onUpdate, onPublish, isPublishing, isOfficer }: Step7Props) {
  const { profile: officerProfile } = useOfficerProfile();
  const { profile: adviserProfile } = useAdviserProfile();
  const { events: allEvents } = useAllEvents();

  const showOfficerMode = isOfficer !== undefined ? isOfficer : !!officerProfile;
  const creatorName = showOfficerMode
    ? (officerProfile?.studentName || data.createdByName || 'Student Officer')
    : (adviserProfile?.displayName || 'SAS Adviser');

  // Dynamic Theme Styling based on Officer vs Admin
  const accentBorder = 'border-[#0E4EBD]';
  const accentText = 'text-[#0E4EBD]';
  const accentBg = 'bg-[#0E4EBD]';
  const accentGradient = 'from-[#001A4D] to-[#0E4EBD]';

  // Validate steps using centralized validation rules
  const s1Res = validateStep1(data, showOfficerMode);
  const s2Res = validateStep2(data, allEvents, (data as any).id);
  const s3Res = validateStep3(data);
  const s4Res = validateStep4(data);
  const s5Res = validateStep5(data);
  const s6Res = validateStep6(data, showOfficerMode);
  const isCertified = Boolean(data.isCertified || data.officerAcknowledgement);

  const validationItems = [
    { id: 1, label: 'Event details complete', desc: s1Res.isValid ? 'Title, banner, type, and category specified' : (s1Res.errors[0] || 'Missing event details'), status: s1Res.isValid ? 'valid' : 'invalid' },
    { id: 2, label: 'Schedule and venue assigned', desc: s2Res.isValid ? 'Active semester, sessions, and venue configured without conflicts' : (s2Res.errors[0] || 'Schedule incomplete or has conflicts'), status: s2Res.isValid ? 'valid' : 'invalid' },
    { id: 3, label: 'Participant settings configured', desc: s3Res.isValid ? 'Target audience and academic cohort set' : (s3Res.errors[0] || 'Invalid participant settings'), status: s3Res.isValid ? 'valid' : 'invalid' },
    { id: 4, label: 'Staff fully assigned', desc: s4Res.isValid ? 'Event Head, Officer-in-Charge, and scanners' : (s4Res.errors[0] || 'Staff assignments incomplete'), status: s4Res.isValid ? 'valid' : 'invalid' },
    { id: 5, label: 'Budget requested', desc: s5Res.isValid ? 'Itemized budget lines are valid' : (s5Res.errors[0] || 'Invalid budget items'), status: s5Res.isValid ? 'valid' : 'invalid' },
    { id: 6, label: 'Documents uploaded', desc: s6Res.isValid ? 'Required proposal documents attached' : (s6Res.errors[0] || 'Required documents missing'), status: s6Res.isValid ? 'valid' : 'invalid' },
    ...(showOfficerMode ? [{ id: 7, label: 'Officer Proposal Acknowledgement', desc: isCertified ? 'Proposal certified accurate and ready for SAO review' : 'Certification checkbox required', status: isCertified ? 'valid' : 'invalid' }] : []),
  ];

  const validCount = validationItems.filter(item => item.status === 'valid').length;
  const totalCount = validationItems.length;
  const compliancePct = Math.round((validCount / totalCount) * 100);
  const allValid = validCount === totalCount;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">

        {/* Admin / Officer Event Summary Card */}
        <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className={`p-6 bg-gradient-to-r ${accentGradient} relative`}>
            <div className="flex gap-4">
              <div className={`w-24 h-24 bg-gradient-to-br ${accentGradient} rounded-lg flex items-center justify-center flex-shrink-0 shadow-xs`}>
                <Calendar className="w-10 h-10 text-white" />
              </div>

              <div className="flex-1">
                <h2 className="text-white font-bold text-2xl mb-1">
                  {data.title || 'Event Title'}
                </h2>
                <p className="text-[#FFD41C] text-sm mb-3 line-clamp-2">
                  {data.description || 'No event description provided'}
                </p>
                <div className="flex items-center gap-2 text-white text-sm">
                  <div className="w-6 h-6 rounded-full bg-white/20"></div>
                  <span className={`px-2 py-0.5 ${showOfficerMode ? 'bg-purple-500' : 'bg-blue-600'} rounded text-xs font-semibold`}>
                    {showOfficerMode ? 'Officer Proposal' : 'SAS Institutional Event'}
                  </span>
                </div>
              </div>

              <div className="absolute top-4 right-4">
                <div className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium text-sm shadow-xs ${
                  showOfficerMode ? 'bg-amber-400 text-[#001A4D]' : 'bg-green-500 text-white'
                }`}>
                  <Shield className="w-4 h-4" />
                  {showOfficerMode ? 'REQUIRES SAS REVIEW' : 'SAS APPROVED'}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white space-y-4">
            {/* Administrative Section */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-200">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-700 mb-2">Administrative</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Reference ID:</span>
                    <span className="ml-2 font-medium text-gray-900">{data.referenceId || 'Pending'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Created By:</span>
                    <span className="ml-2 font-medium text-gray-900">{creatorName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Visibility:</span>
                    <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">Will be published</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-200">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-700 mb-2">Schedule</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-900">SY {data.schoolYear || '...'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-900">{data.sessions?.length || 0} Sessions Configured</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-900">{data.customVenueName || 'On-Campus Venue'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Participants */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-200">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-700 mb-2">Participants & Settings</h3>
                <div className="text-sm text-gray-900 flex flex-col gap-1">
                  <span>
                    Target: <strong>{data.targetAudienceScope === 'members' ? 'Org Members Only' : 'Campus-Wide'}</strong> • {data.targetCourses?.length ? `${data.targetCourses.length} Courses` : 'All Courses'}, {data.targetYearLevels?.length ? `${data.targetYearLevels.length} Year Levels` : 'All Years'}{data.targetSections?.length ? `, ${data.targetSections.length} Sections` : ''}
                  </span>
                  {data.attendanceEnabled && <span className="text-green-600 font-medium">✓ Attendance Required (Min {data.minAttendancePercent || 80}%)</span>}
                  {data.certificatesEnabled && <span className="text-green-600 font-medium">✓ Certificates {data.autoIssueCertificates ? 'Auto-Issued' : 'Configured'}</span>}
                  {data.studentPayablesEnabled && <span className="text-blue-600 font-medium">✓ Required Payment: {formatCurrency(data.adminFeeOverride || 0)}</span>}
                </div>
              </div>
            </div>

            {/* Budget */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-200">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-700 mb-2">Budget</h3>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-[#001A4D]">{formatCurrency(data.totalApprovedBudget || data.totalRequestedBudget || 0)}</div>
                  <div className="text-xs text-gray-600">Total Amount across {data.budgetItems?.length || 0} line items</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Validation Checklist */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-[#001A4D] px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-bold">Final Validation Checklist</h3>
            <span className="text-xs text-[#FFD41C] font-mono font-bold">
              {validCount} / {totalCount} Validated
            </span>
          </div>

          <div className="p-4 space-y-2">
            {validationItems.map((item) => (
              <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg border ${
                item.status === 'valid' ? 'border-green-200 bg-green-50' :
                item.status === 'warning' ? 'border-amber-200 bg-amber-50' :
                'border-red-200 bg-red-50'
              }`}>
                <div className="flex-shrink-0 mt-0.5">
                  {item.status === 'valid' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : item.status === 'warning' ? (
                    <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold">!</div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">✕</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 text-sm">{item.label}</div>
                  <div className="text-xs text-gray-600">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {!allValid && (
            <div className="px-4 pb-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">!</div>
                <p className="text-sm text-red-800">
                  <strong>Resolve all validation issues before submitting this event.</strong> Ensure the Activity Proposal document is attached and the Officer Proposal Acknowledgement is certified.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Final Admin Summary */}
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm sticky top-0">
          <h4 className="font-bold text-gray-900 mb-3">Publication Summary</h4>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gradient-to-br from-green-600 to-green-500 rounded-lg text-white text-center shadow-xs">
                <Calendar className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xl font-bold">{data.sessions?.length || 0}</div>
                <div className="text-xs opacity-90">Sessions</div>
              </div>

              <div className="p-3 bg-gradient-to-br from-[#0E4EBD] to-[#1E70E8] rounded-lg text-white text-center shadow-xs">
                <Users className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xl font-bold">{data.expectedParticipantCount?.toLocaleString() || 0}</div>
                <div className="text-xs opacity-90">Expected</div>
              </div>

              <div className="p-3 bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-lg text-white text-center shadow-xs">
                <DollarSign className="w-5 h-5 mx-auto mb-1 text-[#FFD41C]" />
                <div className="text-xl font-bold">{((data.totalApprovedBudget || data.totalRequestedBudget || 0)/1000).toFixed(1)}K</div>
                <div className="text-xs opacity-90">Budget</div>
              </div>

              <div className="p-3 bg-gradient-to-br from-[#FFC107] to-[#FFD41C] rounded-lg text-white text-center shadow-xs">
                <Award className="w-5 h-5 mx-auto mb-1 text-[#001A4D]" />
                <div className="text-xl font-bold text-[#001A4D]">{compliancePct}%</div>
                <div className="text-xs text-[#001A4D]/80 font-bold">
                  {compliancePct === 100 ? 'Fully Compliant' : 'Compliance'}
                </div>
              </div>
            </div>

            {/* Post-Creation Actions */}
            <div className={`border-2 ${accentBorder} rounded-lg p-3`}>
              <h5 className="text-sm font-bold text-gray-900 mb-3">Post-Creation Actions</h5>
              <div className="space-y-2 text-xs">
                {[
                  'Event record created in database',
                  'Event published to student feed',
                  'Officers notified of assignments',
                  'Scanner activation codes generated',
                ].map((action, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{action}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Large Submit / Publish Button */}
            <button
              type="button"
              onClick={onPublish}
              disabled={!allValid || isPublishing}
              className={`w-full py-3 text-white rounded-lg font-bold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                showOfficerMode
                  ? 'bg-[#001A4D] hover:bg-[#0E4EBD] shadow-xs'
                  : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600'
              }`}
            >
              <Rocket className="w-5 h-5" />
              {isPublishing
                ? 'Submitting...'
                : showOfficerMode
                ? (data.proposalStatus === 'returned' || data.proposalStatus === 'rejected'
                    ? 'Save Changes & Resubmit Proposal'
                    : 'Submit Proposal for SAO Approval')
                : 'Create & Publish Event'}
            </button>

            {!allValid && (
              <p className="text-xs text-center text-red-600">
                Complete all validation items to publish
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
