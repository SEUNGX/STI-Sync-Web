import { Eye, UserCheck, X, Search, User } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useCourses } from '../../../modules/academic/hooks/useAcademicStream';
import { updateStudentStatus, returnStudent } from '../../../modules/students/services/student.service';
import { StudentDocument } from '../../../modules/students/types/student.types';
import { formatTimestampDateTime } from '../../../modules/students/utils/date.utils';

interface PendingVerificationProps {
  students: StudentDocument[];
}

export default function PendingVerification({ students }: PendingVerificationProps) {
  const { data: courses } = useCourses();

  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  // Reject state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter students
  const pendingStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = 
        s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCourse = courseFilter ? s.courseCode === courseFilter : true;
      const matchesYear = yearFilter ? s.yearLevel === yearFilter : true;

      return matchesSearch && matchesCourse && matchesYear;
    });
  }, [students, searchTerm, courseFilter, yearFilter]);

  const activeCourses = courses.filter(c => !c.archived);

  // Handlers
  const handleApprove = async (id: string) => {
    if (!window.confirm('Are you sure you want to approve this registration?')) return;
    setSubmitting(true);
    try {
      await updateStudentStatus(id, 'ACTIVE');
    } catch (e) {
      alert('Failed to approve student');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }
    setSubmitting(true);
    try {
      await returnStudent(id, rejectReason.trim());
      setRejectingId(null);
      setRejectReason('');
    } catch (e) {
      alert('Failed to return student registration');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Pending Verification</h2>
          <p className="text-sm text-gray-500">Dashboard → Student Registry → Pending Verification</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search by name, student ID, or email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="px-4 py-2 border border-gray-300 rounded-lg"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="">All Courses</option>
            {activeCourses.map(c => (
              <option key={c.id} value={c.code}>{c.code}</option>
            ))}
          </select>
          <select 
            className="px-4 py-2 border border-gray-300 rounded-lg"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="">All Year Levels</option>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
          </select>
          <span className="text-sm text-gray-500 whitespace-nowrap">Showing {pendingStudents.length} pending</span>
        </div>
      </div>

      {pendingStudents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No pending registrations found.</div>
      ) : (
        /* Verification Cards Grid */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {pendingStudents.map((student) => {
            const isRejecting = rejectingId === student.id;

            return (
              <div key={student.id} className="bg-white border border-[#E0E0E0] rounded-xl p-6 flex flex-col">
                {/* Identity Comparison Panel */}
                <div className="mb-6">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-2">Selfie Photo</div>
                      <div className="w-full aspect-square bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] rounded-xl flex items-center justify-center text-white font-bold text-4xl border-2 border-[#001A4D] overflow-hidden">
                        {student.profilePhotoUrl ? (
                          <img 
                            src={student.profilePhotoUrl} 
                            alt="Selfie" 
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent((student.firstName || '') + ' ' + (student.lastName || ''))}&background=001A4D&color=fff&size=256`;
                            }}
                          />
                        ) : (
                          <User className="w-16 h-16 opacity-50" />
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-2">School ID Photo</div>
                      <div className="w-full aspect-square bg-gradient-to-br from-[#002B7F] to-[#0E4EBD] rounded-xl flex items-center justify-center text-white font-bold text-4xl border-2 border-[#001A4D] overflow-hidden p-2">
                        {student.schoolIdPhotoUrl ? (
                          <img 
                            src={student.schoolIdPhotoUrl} 
                            alt="School ID" 
                            className="w-full h-full object-contain bg-white/20 rounded" 
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = `https://ui-avatars.com/api/?name=Error+Loading&background=EF4444&color=fff&size=256&font-size=0.25`;
                            }}
                          />
                        ) : (
                          <span className="text-sm font-normal opacity-50">No ID Uploaded</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#0E4EBD] flex-shrink-0" />
                    <span className="text-xs text-[#0E4EBD] font-medium">Compare these photos carefully before approving.</span>
                  </div>
                </div>

                {/* Submitted Information */}
                <div className="grid grid-cols-2 gap-4 mb-6 flex-1">
                  <div>
                    <div className="text-xs text-gray-500">Full Name</div>
                    <div className="font-bold text-[#001A4D]">{student.firstName} {student.middleName} {student.lastName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Student ID</div>
                    <div className="font-bold text-[#001A4D]">{student.studentId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Course</div>
                    <div className="text-gray-700">{student.courseCode} - {student.courseName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Year & Section</div>
                    <div className="text-gray-700">{student.yearLevel} - {student.section}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Email Address</div>
                    <div className="text-gray-700 text-sm break-all">{student.email}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Contact Number</div>
                    <div className="text-gray-700">{student.contactNumber}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-gray-500">Submission Date</div>
                    <div className="text-gray-700 italic text-sm">
                      {formatTimestampDateTime(student.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Action Row */}
                <div className="mt-auto space-y-3">
                  {isRejecting ? (
                    <div className="p-4 bg-red-50 rounded-lg border border-red-100 space-y-3">
                      <p className="text-sm font-medium text-red-800">Return Registration</p>
                      <textarea
                        autoFocus
                        placeholder="Provide a reason for returning this registration (e.g. Blurry ID, Info mismatch)..."
                        className="w-full text-sm p-2 border border-red-200 rounded focus:outline-none focus:ring-1 focus:ring-red-400"
                        rows={3}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleReject(student.id)}
                          disabled={submitting}
                          className="flex-1 bg-red-600 text-white text-sm font-medium py-2 rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          {submitting ? 'Returning...' : 'Confirm Return'}
                        </button>
                        <button 
                          onClick={() => { setRejectingId(null); setRejectReason(''); }}
                          disabled={submitting}
                          className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApprove(student.id)}
                        disabled={submitting}
                        className="w-full px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white hover:from-[#16A34A] hover:to-[#22C55E] disabled:opacity-50"
                      >
                        <UserCheck className="w-5 h-5" />
                        Approve Registration
                      </button>
                      <button 
                        onClick={() => setRejectingId(student.id)}
                        disabled={submitting}
                        className="w-full text-red-600 font-medium py-2 hover:bg-red-50 rounded flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Reject & Return
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
