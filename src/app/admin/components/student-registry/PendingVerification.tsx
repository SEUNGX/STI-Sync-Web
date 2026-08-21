import { Eye, UserCheck, X, Search, User, Filter, ArrowLeft } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useCourses } from '../../../modules/academic/hooks/useAcademicStream';
import { updateStudentStatus, returnStudent } from '../../../modules/students/services/student.service';
import { StudentDocument } from '../../../modules/students/types/student.types';
import { formatTimestampDateTime } from '../../../modules/students/utils/date.utils';

interface PendingVerificationProps {
  students: StudentDocument[];
  initialStudentId?: string;
}

export default function PendingVerification({ students, initialStudentId }: PendingVerificationProps) {
  const { data: courses } = useCourses();
  const [searchParams, setSearchParams] = useSearchParams();

  const paramTargetId = searchParams.get('id') || searchParams.get('studentId') || initialStudentId || '';
  const paramSearch = searchParams.get('search') || '';

  const [targetStudentId, setTargetStudentId] = useState<string>(paramTargetId);
  const [searchTerm, setSearchTerm] = useState(paramSearch);
  const [courseFilter, setCourseFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  // Keep target student in sync with search params
  useEffect(() => {
    const id = searchParams.get('id') || searchParams.get('studentId') || initialStudentId || '';
    const search = searchParams.get('search') || '';
    if (id) {
      setTargetStudentId(id);
    }
    if (search && !searchTerm) {
      setSearchTerm(search);
    }
  }, [searchParams, initialStudentId]);

  // Reject state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Identify targeted student if present
  const targetedStudent = useMemo(() => {
    if (!targetStudentId) return null;
    return students.find(
      s => s.id === targetStudentId || s.studentId?.toLowerCase() === targetStudentId.toLowerCase()
    ) || null;
  }, [students, targetStudentId]);

  // Filter students
  const pendingStudents = useMemo(() => {
    // If a specific student was targeted from review button and is in the list
    if (targetStudentId && targetedStudent) {
      return [targetedStudent];
    }

    return students.filter(s => {
      const matchesSearch = 
        !searchTerm ||
        s.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCourse = courseFilter ? s.courseCode === courseFilter : true;
      const matchesYear = yearFilter ? s.yearLevel === yearFilter : true;

      return matchesSearch && matchesCourse && matchesYear;
    });
  }, [students, targetStudentId, targetedStudent, searchTerm, courseFilter, yearFilter]);

  const activeCourses = courses.filter(c => !c.archived);

  const handleClearTarget = () => {
    setTargetStudentId('');
    setSearchTerm('');
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('id');
    newParams.delete('studentId');
    newParams.delete('search');
    setSearchParams(newParams);
  };

  // Handlers
  const handleApprove = async (id: string) => {
    if (!window.confirm('Are you sure you want to approve this registration?')) return;
    setSubmitting(true);
    try {
      await updateStudentStatus(id, 'ACTIVE');
      if (targetStudentId) {
        handleClearTarget();
      }
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
      if (targetStudentId) {
        handleClearTarget();
      }
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

      {/* Targeted Student Notice Banner */}
      {targetStudentId && (
        <div className="p-4 bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] rounded-2xl text-white shadow-md flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-[#FFD41C]">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold text-[#FFD41C] tracking-wider">Targeted Student Review</span>
                {targetedStudent && (
                  <span className="px-2 py-0.5 bg-white/20 rounded text-[11px] font-mono">
                    {targetedStudent.studentId}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-white/95 mt-0.5">
                {targetedStudent
                  ? `Reviewing verification for ${targetedStudent.firstName} ${targetedStudent.lastName}`
                  : `Filtered by ID: ${targetStudentId}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClearTarget}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-[#001A4D] font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>View All ({students.length})</span>
          </button>
        </div>
      )}

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
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (targetStudentId) {
                  setTargetStudentId('');
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('id');
                  newParams.delete('studentId');
                  setSearchParams(newParams);
                }
              }}
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
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="">All Year Levels</option>
            <option value="Grade 11">Grade 11</option>
            <option value="Grade 12">Grade 12</option>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
          </select>
          <span className="text-sm text-gray-500 whitespace-nowrap">Showing {pendingStudents.length} pending</span>
        </div>
      </div>

      {pendingStudents.length === 0 ? (
        <div className="text-center py-12 text-gray-500 space-y-2">
          <p>No pending registrations found.</p>
          {targetStudentId && (
            <button
              onClick={handleClearTarget}
              className="text-[#0E4EBD] hover:underline text-xs font-bold"
            >
              Clear filter and view all {students.length} pending students
            </button>
          )}
        </div>
      ) : (
        /* Verification Cards Grid */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {pendingStudents.map((student) => {
            const isRejecting = rejectingId === student.id;

            return (
              <div key={student.id} className="bg-white border border-[#E0E0E0] rounded-xl p-6 flex flex-col">
                {/* Identity & Portrait ID Card Verification Panel */}
                <div className="mb-5 space-y-4">
                  {/* Top row: Circular selfie avatar & student title */}
                  <div className="flex items-center gap-3.5 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <div className="relative flex-shrink-0">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#001A4D] to-[#0E4EBD] border-2 border-white shadow-md ring-2 ring-[#001A4D]/20 overflow-hidden flex items-center justify-center text-white">
                        {student.profilePhotoUrl ? (
                          <img 
                            src={student.profilePhotoUrl} 
                            alt="Selfie" 
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent((student.firstName || '') + ' ' + (student.lastName || ''))}&background=001A4D&color=fff&size=128`;
                            }}
                          />
                        ) : (
                          <User className="w-7 h-7 opacity-60" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-[#001A4D] text-base truncate">
                        {student.firstName} {student.middleName} {student.lastName}
                      </h4>
                      <p className="text-xs text-gray-500 font-mono">ID: {student.studentId}</p>
                      <span className="inline-block mt-0.5 px-2 py-0.5 bg-blue-100 text-[#0E4EBD] text-[10px] font-bold rounded-full">
                        {student.academicLevel === 'SHS' ? 'Senior High School' : 'College'} · {student.courseCode}
                      </span>
                    </div>
                  </div>

                  {/* Centerpiece: Physical Student ID Card in Portrait Orientation */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <span className="text-xs font-bold text-[#001A4D] uppercase tracking-wider">
                        Official Student ID Card (Front)
                      </span>
                      <span className="text-[11px] text-gray-400">Portrait View</span>
                    </div>
                    <div className="w-full max-w-[280px] h-[360px] aspect-[3/4] mx-auto bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-[#001A4D] shadow-md overflow-hidden p-2 flex items-center justify-center relative group">
                      {student.schoolIdPhotoUrl ? (
                        <img 
                          src={student.schoolIdPhotoUrl} 
                          alt="Physical School ID Card" 
                          className="w-full h-full object-contain rounded-lg" 
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=Error+Loading&background=EF4444&color=fff&size=256&font-size=0.25`;
                          }}
                        />
                      ) : (
                        <div className="text-center p-4">
                          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <span className="text-xs text-gray-400 font-medium">No physical ID uploaded</span>
                        </div>
                      )}
                    </div>
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
