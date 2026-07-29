import { X, Mail, Phone, Edit, Crown } from 'lucide-react';
import type { OrganizationMemberDocument } from '../../modules/organizations/types/member.types';
import type { OrganizationOfficerDocument } from '../../modules/organizations/hooks/useOrgOfficers';

interface MemberProfilePanelProps {
  member: OrganizationMemberDocument;
  officerRecord?: OrganizationOfficerDocument; // If they have an active officer record
  onClose: () => void;
  onEdit?: () => void;
  onAppointOfficer?: () => void;
  onChangeStatus?: () => void;
}

export function MemberProfilePanel({ member, officerRecord, onClose, onEdit, onAppointOfficer, onChangeStatus }: MemberProfilePanelProps) {
  // We can calculate attendance from another collection later, for now we mock
  const eventsAttended = 0;
  const totalEvents = 0;
  const attendancePercentage = totalEvents > 0 ? (eventsAttended / totalEvents) * 100 : 0;
  
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const avatar = getInitials(member.studentName);

  const formattedDate = member.dateJoined?.toDate 
    ? member.dateJoined.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Recently Added';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-[380px] bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#E0E0E0] px-6 py-4 flex items-center justify-between">
          <h2 className="text-[#001A4D] text-[18px] font-bold">Member Profile</h2>
          <button onClick={onClose} className="p-2 hover:bg-[#F8F8F8] rounded-lg transition-colors">
            <X className="w-5 h-5 text-[#888780]" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center relative">
            {officerRecord && (
              <div className="absolute top-0 right-1/4 translate-x-4 -translate-y-2 bg-[#FFC107] text-[#001A4D] p-1.5 rounded-full shadow-md" title="Organization Officer">
                <Crown className="w-5 h-5" />
              </div>
            )}
            <div className="w-24 h-24 bg-gradient-to-br from-[#0E4EBD] to-[#1E70E8] rounded-full flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4 shadow-inner">
              {avatar}
            </div>
            <h3 className="text-[#001A4D] text-[20px] font-bold mb-1">{member.studentName}</h3>
            <p className="text-[#888780] text-[14px] mb-3">{member.studentId}</p>
            
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${
                member.status === 'active' ? 'bg-[#22C55E]/10 text-[#16A34A] border border-[#22C55E]/20' : 
                member.status === 'inactive' ? 'bg-gray-100 text-gray-600 border border-gray-200' : 
                'bg-red-50 text-red-600 border border-red-200'
              }`}>
                {member.status}
              </span>
              {officerRecord && (
                <span className="px-3 py-1 bg-[#0E4EBD]/10 text-[#0E4EBD] border border-[#0E4EBD]/20 rounded-full text-[11px] font-bold tracking-wider uppercase">
                  {officerRecord.roleId || 'Officer'}
                </span>
              )}
            </div>
          </div>

          <div className="bg-[#F8F8F8] rounded-xl p-4 space-y-3 border border-[#E0E0E0]">
            <h4 className="text-[#001A4D] text-[14px] font-bold mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#888780]" /> Contact Information
            </h4>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-[#888780] text-[11px] font-medium uppercase tracking-wider">Email</p>
                <p className="text-[#001A4D] text-[13px]">{member.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 pt-2 border-t border-gray-200">
              <div className="flex-1">
                <p className="text-[#888780] text-[11px] font-medium uppercase tracking-wider">Contact Number</p>
                <p className="text-[#001A4D] text-[13px]">{member.contactNumber || '—'}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[#001A4D] text-[14px] font-bold mb-3">Academic Information</h4>
            <div className="space-y-2 border border-[#E0E0E0] rounded-xl p-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="text-[#888780] text-[13px]">Course</span>
                <span className="text-[#001A4D] text-[13px] font-medium">{member.course || '—'}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="text-[#888780] text-[13px]">Year Level</span>
                <span className="text-[#001A4D] text-[13px] font-medium">{member.year || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#888780] text-[13px]">Department</span>
                <span className="text-[#001A4D] text-[13px] font-medium">{member.department || '—'}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[#001A4D] text-[14px] font-bold mb-3">Organization Information</h4>
            <div className="space-y-2 border border-[#E0E0E0] rounded-xl p-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="text-[#888780] text-[13px]">Date Joined</span>
                <span className="text-[#001A4D] text-[13px] font-medium">{formattedDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#888780] text-[13px]">Payment Status</span>
                <span
                  className={`px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider ${
                    member.paymentStatus === 'paid'
                      ? 'bg-[#22C55E]/10 text-[#16A34A]'
                      : 'bg-[#E24B4A]/10 text-[#DC2626]'
                  }`}
                >
                  {member.paymentStatus === 'paid' ? 'Dues Paid' : 'Outstanding'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[#001A4D] text-[14px] font-bold mb-3">Attendance Summary</h4>
            <div className="space-y-2 border border-[#E0E0E0] rounded-xl p-4">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#888780]">Events Attended</span>
                <span className="text-[#001A4D] font-medium">
                  {eventsAttended} / {totalEvents}
                </span>
              </div>
              <div className="w-full bg-[#E0E0E0] rounded-full h-2 mt-2">
                <div
                  className="bg-[#0E4EBD] h-2 rounded-full transition-all"
                  style={{ width: `${attendancePercentage}%` }}
                />
              </div>
              <p className="text-[#0E4EBD] text-[12px] font-medium text-right mt-1">{attendancePercentage.toFixed(0)}%</p>
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-gray-200">
            <h4 className="text-[#001A4D] text-[14px] font-bold mb-2">Quick Actions</h4>
            
            {!officerRecord && (
              <button 
                onClick={onAppointOfficer}
                className="w-full px-4 py-2.5 bg-[#FFC107] text-[#001A4D] rounded-lg text-[14px] font-bold hover:bg-[#FFC107]/90 flex items-center justify-center gap-2 transition-colors"
              >
                <Crown className="w-4 h-4" />
                Appoint as Officer
              </button>
            )}

            <button 
              onClick={onEdit}
              className="w-full px-4 py-2.5 border border-[#E0E0E0] text-[#001A4D] rounded-lg text-[14px] font-medium hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
            >
              <Edit className="w-4 h-4 text-gray-500" />
              Edit Member Details
            </button>
            
            <button 
              onClick={onChangeStatus}
              className="w-full px-4 py-2.5 border border-[#E0E0E0] text-[#001A4D] rounded-lg text-[14px] font-medium hover:bg-gray-50 transition-colors"
            >
              Change Status
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
