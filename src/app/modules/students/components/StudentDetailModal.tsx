import { useState } from 'react';
import { 
  X, User, Building2, CreditCard, CalendarCheck, 
  Mail, Phone, Calendar, Clock, ShieldCheck, CheckCircle2, 
  AlertCircle, Archive, FileText, ChevronRight, Hash, DollarSign,
  Shield, Check, Users
} from 'lucide-react';
import type { StudentDocument } from '../types/student.types';
import { useStudentDetail } from '../hooks/useStudentDetail';
import { formatTimestampDate } from '../utils/date.utils';
import { formatCurrency } from '../../../utils/currency';
import { formatAppDate } from '../../../utils/date';

interface StudentDetailModalProps {
  student: StudentDocument;
  onClose: () => void;
  onArchive?: (student: StudentDocument) => void;
  readOnly?: boolean;
}

type TabType = 'profile' | 'clubs' | 'finances' | 'attendance';

export default function StudentDetailModal({
  student: initialStudent,
  onClose,
  onArchive,
  readOnly = false,
}: StudentDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const { student: streamedStudent, memberships, payables, attendances, stats, loading } = useStudentDetail(initialStudent);

  const student = streamedStudent || initialStudent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-[#E0E0E0]">
        {/* Modal Header */}
        <div className="relative bg-gradient-to-r from-[#001A4D] via-[#002B7F] to-[#0E4EBD] px-8 py-6 text-white flex-shrink-0 shadow-sm">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-lg flex-shrink-0">
              {student.profilePhotoUrl ? (
                <img
                  src={student.profilePhotoUrl}
                  alt={`${student.firstName} ${student.lastName}`}
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      `${student.firstName} ${student.lastName}`
                    )}&background=001A4D&color=fff&size=160`;
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-xl flex items-center justify-center text-white font-bold text-2xl">
                  {student.firstName?.[0] || 'S'}{student.lastName?.[0] || 'T'}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold truncate">
                  {student.firstName} {student.middleName ? `${student.middleName} ` : ''}{student.lastName}
                </h2>
                <span className={`px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  student.status === 'ACTIVE' ? 'bg-green-500/90 text-white' :
                  student.status === 'ARCHIVED' ? 'bg-gray-400 text-white' :
                  student.status === 'INACTIVE' ? 'bg-amber-500/90 text-white' :
                  'bg-blue-500 text-white'
                }`}>
                  {student.status}
                </span>
                {student.archiveReason && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs bg-white/20 text-white">
                    Reason: {student.archiveReason}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-white/80 text-sm">
                <span className="flex items-center gap-1 font-mono font-medium text-[#FFD41C]">
                  <Hash className="w-3.5 h-3.5" />
                  {student.studentId}
                </span>
                <span>•</span>
                <span>{student.courseCode} — {student.yearLevel}</span>
                <span>•</span>
                <span>Section: {student.section}</span>
                <span>•</span>
                <span>{student.schoolYear} ({student.semester})</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mt-6 border-b border-white/20 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'border-[#FFD41C] text-[#FFD41C]'
                  : 'border-transparent text-white/80 hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              Profile & Info
            </button>
            <button
              onClick={() => setActiveTab('clubs')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'clubs'
                  ? 'border-[#FFD41C] text-[#FFD41C]'
                  : 'border-transparent text-white/80 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Clubs
              {memberships.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-white/20 text-white font-mono">
                  {memberships.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('finances')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'finances'
                  ? 'border-[#FFD41C] text-[#FFD41C]'
                  : 'border-transparent text-white/80 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Finances & Payables
              {stats.outstandingBalance > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-red-500 text-white font-mono">
                  {formatCurrency(stats.outstandingBalance)}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'attendance'
                  ? 'border-[#FFD41C] text-[#FFD41C]'
                  : 'border-transparent text-white/80 hover:text-white'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              Event Attendance
              {attendances.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-white/20 text-white font-mono">
                  {attendances.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
          {/* TAB 1: Profile & Info */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="bg-white rounded-xl p-5 border border-[#E0E0E0] shadow-sm space-y-4">
                  <h3 className="font-bold text-[#001A4D] text-base flex items-center gap-2 border-b border-gray-100 pb-3">
                    <User className="w-4 h-4 text-[#0E4EBD]" />
                    Personal Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-gray-500 font-medium block">Full Name</span>
                      <span className="font-medium text-[#001A4D]">{student.firstName} {student.middleName} {student.lastName}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-medium block">Student ID</span>
                      <span className="font-mono font-bold text-[#0E4EBD]">{student.studentId}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-medium block">Email Address</span>
                      <span className="font-medium text-gray-800 flex items-center gap-1.5 break-all">
                        <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {student.email}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-medium block">Contact Number</span>
                      <span className="font-medium text-gray-800 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {student.contactNumber || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-medium block">Date of Birth</span>
                      <span className="font-medium text-gray-800 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {student.dateOfBirth || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-medium block">Sex</span>
                      <span className="font-medium text-gray-800">{student.sex || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Academic Enrollment */}
                <div className="bg-white rounded-xl p-5 border border-[#E0E0E0] shadow-sm space-y-4">
                  <h3 className="font-bold text-[#001A4D] text-base flex items-center gap-2 border-b border-gray-100 pb-3">
                    <Building2 className="w-4 h-4 text-[#0E4EBD]" />
                    Academic & Enrollment
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-gray-500 font-medium block">Department</span>
                      <span className="font-medium text-[#001A4D]">{student.departmentName || student.departmentId}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-medium block">Course</span>
                      <span className="font-medium text-[#001A4D]">{student.courseName} ({student.courseCode})</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-medium block">Year Level</span>
                      <span className="font-medium text-gray-800">{student.yearLevel}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-medium block">Section</span>
                      <span className="font-medium text-gray-800">{student.section}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-medium block">School Year</span>
                      <span className="font-medium text-gray-800">{student.schoolYear}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-medium block">Semester</span>
                      <span className="font-medium text-gray-800">{student.semester}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Photo Verification & Media */}
              <div className="bg-white rounded-xl p-5 border border-[#E0E0E0] shadow-sm space-y-4">
                <h3 className="font-bold text-[#001A4D] text-base flex items-center gap-2 border-b border-gray-100 pb-3">
                  <ShieldCheck className="w-4 h-4 text-[#0E4EBD]" />
                  Identity & Registration Verification Media
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col items-center">
                    <span className="text-xs font-bold text-gray-700 uppercase mb-3">Profile / Live Selfie Photo</span>
                    <div className="w-48 h-48 rounded-xl overflow-hidden bg-white border-2 border-gray-200 shadow-inner flex items-center justify-center">
                      {student.profilePhotoUrl ? (
                        <img 
                          src={student.profilePhotoUrl} 
                          alt="Profile Selfie" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <span className="text-xs text-gray-400 italic">No selfie photo uploaded</span>
                      )}
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col items-center">
                    <span className="text-xs font-bold text-gray-700 uppercase mb-3">Physical School ID Card Photo</span>
                    <div className="w-48 h-48 rounded-xl overflow-hidden bg-white border-2 border-gray-200 shadow-inner flex items-center justify-center">
                      {student.schoolIdPhotoUrl ? (
                        <img 
                          src={student.schoolIdPhotoUrl} 
                          alt="School ID Card" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <span className="text-xs text-gray-400 italic">No school ID card photo uploaded</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500">
                  <span>Registration Source: <strong className="text-gray-700">{student.registrationSource || 'MANUAL'}</strong></span>
                  <span>Registered Date: <strong className="text-gray-700">{formatTimestampDate(student.createdAt)}</strong></span>
                  <span>Last Record Update: <strong className="text-gray-700">{formatTimestampDate(student.updatedAt)}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Clubs */}
          {activeTab === 'clubs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#001A4D] text-base">Club Memberships & Roles</h3>
                <span className="text-xs text-gray-500">Joined in {memberships.length} club(s)</span>
              </div>

              {memberships.length === 0 ? (
                <div className="bg-white border border-[#E0E0E0] rounded-xl p-12 text-center text-gray-500">
                  <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="font-medium text-gray-700">No Club Memberships Found</p>
                  <p className="text-xs text-gray-400 mt-1">This student is not currently registered as a member in any student clubs.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {memberships.map((m) => (
                    <div key={m.id} className="bg-white border border-[#E0E0E0] rounded-xl p-5 shadow-sm space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-[#001A4D] text-xs uppercase overflow-hidden border border-gray-200 flex-shrink-0">
                            {m.logoUrl ? (
                              <img src={m.logoUrl} alt={m.clubName} className="w-full h-full object-cover" />
                            ) : (
                              m.clubAcronym || m.clubName.slice(0, 3).toUpperCase()
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-[#001A4D] text-base leading-tight">
                              {m.clubName}
                              {m.clubAcronym && (
                                <span className="ml-1.5 text-xs text-gray-500 font-medium">({m.clubAcronym})</span>
                              )}
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">Role: <strong className="text-gray-800">{m.role}</strong></p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {m.isOfficer && (
                            <span className="px-2.5 py-0.5 bg-[#001A4D] text-[#FFD41C] rounded-full text-xs font-bold shadow-xs">
                              Officer
                            </span>
                          )}
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {m.status}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-2.5 border-t border-gray-100">
                        <div>
                          <span className="text-gray-400 block">Dues Status:</span>
                          <span className={`font-semibold ${
                            m.paymentStatus === 'paid' ? 'text-green-600' : 'text-amber-600'
                          }`}>
                            {m.paymentStatus === 'paid' ? '✓ Dues Paid' : '⚠ Outstanding Dues'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">Date Joined:</span>
                          <span className="text-gray-700 font-medium">
                            {formatTimestampDate(m.dateJoined)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Finances & Payables */}
          {activeTab === 'finances' && (
            <div className="space-y-6">
              {/* Financial Metrics Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-gray-500 uppercase">Total Billed</div>
                  <div className="text-2xl font-bold text-[#001A4D] mt-1">{formatCurrency(stats.totalBilled)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{payables.length} total payable item(s)</div>
                </div>
                <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-gray-500 uppercase">Total Paid</div>
                  <div className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats.totalPaid)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Recorded collections</div>
                </div>
                <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-gray-500 uppercase">Outstanding Balance</div>
                  <div className={`text-2xl font-bold mt-1 ${stats.outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(stats.outstandingBalance)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {stats.outstandingBalance > 0 ? 'Unsettled obligations' : 'Fully cleared'}
                  </div>
                </div>
              </div>

              {/* Payables Table */}
              <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-[#001A4D] text-base">Payables Breakdown</h3>
                  <span className="text-xs text-gray-500">{payables.length} record(s)</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-xs font-bold text-gray-700 uppercase">
                      <tr>
                        <th className="px-5 py-3">Payable Item</th>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3">Assigned / Paid</th>
                        <th className="px-5 py-3">Due Date</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Payment Info</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {payables.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                            No payables or fines found for this student.
                          </td>
                        </tr>
                      ) : (
                        payables.map((p) => {
                          const assigned = Number(p.assignedAmount || 0);
                          const paid = Number(p.paidAmount || 0);
                          const isPaid = p.status === 'paid' || paid >= assigned;

                          return (
                            <tr key={p.id} className="hover:bg-gray-50/80">
                              <td className="px-5 py-3.5">
                                <div className="font-semibold text-[#001A4D]">{p.label}</div>
                                <div className="text-xs text-gray-500">{p.organizationName || 'SAO Admin'}</div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded text-xs capitalize font-medium">
                                  {p.type?.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="font-mono font-bold text-gray-900">{formatCurrency(assigned)}</div>
                                <div className="text-xs text-green-600 font-mono">Paid: {formatCurrency(paid)}</div>
                              </td>
                              <td className="px-5 py-3.5 text-xs text-gray-600">
                                {formatAppDate(p.dueDate, '—')}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase ${
                                  isPaid ? 'bg-green-100 text-green-700' :
                                  p.status === 'overdue' ? 'bg-red-100 text-red-700' :
                                  p.status === 'waived' ? 'bg-gray-100 text-gray-600' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-xs text-gray-500">
                                {p.paidAt ? (
                                  <div>
                                    <span className="block font-medium text-gray-700">
                                      {formatAppDate(p.paidAt)}
                                    </span>
                                    <span>Method: {p.paymentMethod || 'Cash'}</span>
                                  </div>
                                ) : (
                                  <span className="italic text-gray-400">Unpaid</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Event Attendance */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              {/* Attendance Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-gray-500 uppercase">Total Event Participations</div>
                  <div className="text-2xl font-bold text-[#001A4D] mt-1">{stats.totalEvents}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Events registered / logged</div>
                </div>
                <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-gray-500 uppercase">Events Attended</div>
                  <div className="text-2xl font-bold text-green-600 mt-1">{stats.eventsAttended}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Verified check-ins</div>
                </div>
                <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-gray-500 uppercase">Overall Attendance Rate</div>
                  <div className="text-2xl font-bold text-[#0E4EBD] mt-1">{stats.attendanceRate}%</div>
                  <div className="text-xs text-gray-400 mt-0.5">Campus event compliance</div>
                </div>
              </div>

              {/* Attendance Logs Table */}
              <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-[#001A4D] text-base">Attendance History Logs</h3>
                  <span className="text-xs text-gray-500">{attendances.length} event log(s)</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-xs font-bold text-gray-700 uppercase">
                      <tr>
                        <th className="px-5 py-3">Event Name</th>
                        <th className="px-5 py-3">Host / Organizer</th>
                        <th className="px-5 py-3">Check-In</th>
                        <th className="px-5 py-3">Check-Out</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {attendances.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                            No attendance logs recorded for this student yet.
                          </td>
                        </tr>
                      ) : (
                        attendances.map((a) => (
                          <tr key={a.id} className="hover:bg-gray-50/80">
                            <td className="px-5 py-3.5 font-semibold text-[#001A4D]">{a.event}</td>
                            <td className="px-5 py-3.5 text-gray-600 text-xs">{a.org || 'SAO Event'}</td>
                            <td className="px-5 py-3.5 text-xs text-gray-700 font-mono">{a.checkIn || '—'}</td>
                            <td className="px-5 py-3.5 text-xs text-gray-700 font-mono">{a.checkOut || '—'}</td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                a.status === 'Complete' || a.status === 'Checked In' ? 'bg-green-100 text-green-700' :
                                a.status === 'Late' ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-white border-t border-[#E0E0E0] flex items-center justify-between flex-shrink-0">
          <div>
            {!readOnly && student.status !== 'ARCHIVED' && onArchive && (
              <button
                onClick={() => onArchive(student)}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
              >
                <Archive className="w-4 h-4" />
                Archive Student Account
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#001A4D] text-white rounded-lg text-sm font-semibold hover:bg-[#001A4D]/90 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
