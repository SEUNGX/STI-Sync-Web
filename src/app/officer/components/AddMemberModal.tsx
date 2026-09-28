import { useState, useMemo } from 'react';
import { X, Search, Loader2, Building2 } from 'lucide-react';
import { useStudents } from '../../modules/students/hooks/useStudentStream';
import { useDepartments, useCourses, useActiveAcademicPeriods } from '../../modules/academic/hooks/useAcademicStream';
import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useOrgMembers } from '../../modules/organizations/hooks/useOrgMembers';
import { addMember } from '../../modules/organizations/services/member.service';
import type { AddMemberPayload } from '../../modules/organizations/types/member.types';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  addedBy: string; // The studentId of the officer adding them
}

export function AddMemberModal({ isOpen, onClose, organizationId, addedBy }: AddMemberModalProps) {
  const { data: allStudents = [], loading: loadingStudents } = useStudents();
  const { members: existingOrgMembers = [], loading: loadingMembers } = useOrgMembers(organizationId);
  const { data: orgs = [] } = useOrganizationStream();
  const { data: departments = [] } = useDepartments();
  const { data: courses = [] } = useCourses();
  const { isStudentPendingReEnrollment } = useActiveAcademicPeriods();

  const activeOrg = orgs.find((o) => o.id === organizationId);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    studentId: '',
    studentName: '',
    email: '',
    course: '',
    year: '',
    department: '',
    contactNumber: '',
    paymentStatus: 'outstanding' as 'paid' | 'outstanding',
  });

  // Evaluate if organization is cross-departmental or department-specific
  const isCrossDepartmental = useMemo(() => {
    if (!activeOrg) return true;
    const rawDeptId = (activeOrg.departmentId || '').trim().toLowerCase();
    const rawDeptName = (activeOrg.department || (activeOrg as any).departmentName || '').trim().toLowerCase();

    return (
      !rawDeptId ||
      rawDeptId === 'cross-departmental' ||
      rawDeptId === 'cross-department' ||
      rawDeptId === 'all' ||
      rawDeptId === 'all departments' ||
      rawDeptId === 'general' ||
      rawDeptName === 'cross-departmental' ||
      rawDeptName === 'cross-department' ||
      rawDeptName === 'all departments' ||
      rawDeptName === 'general' ||
      rawDeptName === 'college-wide' ||
      rawDeptName === 'campus-wide' ||
      (activeOrg as any).isCrossDepartmental === true
    );
  }, [activeOrg]);

  // Check if a student is eligible based on org department/program restriction
  const isStudentProgramEligible = (student: any): boolean => {
    if (!student) return false;

    // 1. Must be an ACTIVE student
    if (student.status !== 'ACTIVE') return false;

    // 2. Must be actively enrolled for current term
    if (isStudentPendingReEnrollment(student)) return false;

    // 3. Cross-departmental orgs allow all active enrolled students
    if (isCrossDepartmental) return true;

    if (!activeOrg) return true;

    const rawDeptId = (activeOrg.departmentId || '').trim().toLowerCase();
    const rawDeptName = (activeOrg.department || (activeOrg as any).departmentName || '').trim().toLowerCase();

    // Look up department in database
    const matchedDept = departments.find(
      (d) =>
        d.id.toLowerCase() === rawDeptId ||
        d.code?.toLowerCase() === rawDeptId ||
        d.name?.toLowerCase() === rawDeptName ||
        (d.code && rawDeptName.includes(d.code.toLowerCase())) ||
        (d.name && rawDeptName.includes(d.name.toLowerCase()))
    );

    // Valid department identifiers
    const validDeptIdentifiers = new Set<string>();
    if (rawDeptId) validDeptIdentifiers.add(rawDeptId);
    if (rawDeptName) validDeptIdentifiers.add(rawDeptName);
    if (matchedDept) {
      validDeptIdentifiers.add(matchedDept.id.toLowerCase());
      if (matchedDept.code) validDeptIdentifiers.add(matchedDept.code.toLowerCase());
      if (matchedDept.name) validDeptIdentifiers.add(matchedDept.name.toLowerCase());
    }

    // Valid course/program identifiers under this department
    const validCourseIdentifiers = new Set<string>();
    if (matchedDept) {
      courses
        .filter((c) => c.departmentId === matchedDept.id || c.departmentCode === matchedDept.code)
        .forEach((c) => {
          validCourseIdentifiers.add(c.id.toLowerCase());
          if (c.code) validCourseIdentifiers.add(c.code.toLowerCase());
          if (c.name) validCourseIdentifiers.add(c.name.toLowerCase());
        });
    }

    // Check student's department
    const sDeptId = (student.departmentId || '').trim().toLowerCase();
    const sDeptCode = (student.departmentCode || '').trim().toLowerCase();
    const sDeptName = (student.department || student.departmentName || '').trim().toLowerCase();

    if (
      (sDeptId && validDeptIdentifiers.has(sDeptId)) ||
      (sDeptCode && validDeptIdentifiers.has(sDeptCode)) ||
      (sDeptName && validDeptIdentifiers.has(sDeptName))
    ) {
      return true;
    }

    // Check student's course / program
    const sCourseId = (student.courseId || '').trim().toLowerCase();
    const sCourseCode = (student.courseCode || '').trim().toLowerCase();
    const sCourseName = (student.courseName || '').trim().toLowerCase();

    if (
      (sCourseId && validCourseIdentifiers.has(sCourseId)) ||
      (sCourseCode && validCourseIdentifiers.has(sCourseCode)) ||
      (sCourseName && validCourseIdentifiers.has(sCourseName))
    ) {
      return true;
    }

    // Program heuristics by name
    if (rawDeptName.includes('information technology') || rawDeptId === 'it' || rawDeptId === 'dict') {
      if (sCourseCode === 'bsit' || sCourseCode === 'bscs' || sCourseName.includes('information technology') || sCourseName.includes('computer science')) {
        return true;
      }
    }
    if (rawDeptName.includes('business') || rawDeptId === 'ba' || rawDeptId === 'dba') {
      if (sCourseCode === 'bsba' || sCourseCode === 'bsa' || sCourseName.includes('business')) {
        return true;
      }
    }
    if (rawDeptName.includes('hospitality') || rawDeptId === 'hm' || rawDeptId === 'dhm') {
      if (sCourseCode === 'bshm' || sCourseCode === 'bstm' || sCourseName.includes('hospitality') || sCourseName.includes('tourism')) {
        return true;
      }
    }
    if (rawDeptName.includes('senior high') || rawDeptId === 'shs') {
      if (student.academicLevel === 'SHS' || String(student.yearLevel).toLowerCase().includes('grade')) {
        return true;
      }
    }

    return false;
  };

  if (!isOpen) return null;

  const handleSelectStudent = (student: any) => {
    setFormData({
      ...formData,
      studentId: student.studentId || student.id || '',
      studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      email: student.email || '',
      course: student.courseCode || student.courseName || '',
      year: student.yearLevel || '',
      department: student.department || student.departmentName || '',
      contactNumber: student.contactNumber || student.phone || '',
    });
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.studentName) {
      alert('Student ID and Name are required.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload: AddMemberPayload = {
        ...formData,
        studentId: (formData.studentId || '').trim(),
        studentName: (formData.studentName || '').trim(),
        email: (formData.email || '').trim().toLowerCase(),
        course: formData.course || '',
        year: formData.year || '',
        department: formData.department || '',
        contactNumber: formData.contactNumber || '',
        organizationId,
        status: 'active',
      };
      
      await addMember(payload, addedBy);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to add member: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[500px] shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-[#001A4D] px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">Add New Member</h2>
            {activeOrg && (
              <p className="text-blue-200 text-xs flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>{activeOrg.name}</span>
                <span className="text-blue-300">• {isCrossDepartmental ? 'Campus-wide / All Programs' : (activeOrg.department || 'Specific Department')}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Quick Search Student */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Eligible Student</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  !isCrossDepartmental && activeOrg?.department
                    ? `Search eligible ${activeOrg.department} students...`
                    : "Search active student by name, ID, or email..."
                }
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-9 pr-4 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8] outline-none"
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              {!isCrossDepartmental && activeOrg?.department
                ? `Showing active, enrolled students from ${activeOrg.department} not yet in this organization.`
                : 'Showing active, enrolled students not yet members of this organization.'}
            </p>

            {/* Dropdown */}
            {showDropdown && searchQuery.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E0E0E0] rounded-lg shadow-xl z-50 max-h-52 overflow-y-auto">
                {loadingStudents || loadingMembers ? (
                  <div className="p-3 text-sm text-gray-500 text-center">Loading eligible students...</div>
                ) : (
                  (() => {
                    const query = searchQuery.trim().toLowerCase();
                    const existingMemberIds = new Set<string>();
                    const existingMemberEmails = new Set<string>();

                    existingOrgMembers.forEach((m) => {
                      if (m.studentId) existingMemberIds.add(m.studentId.toLowerCase().trim());
                      if (m.email) existingMemberEmails.add(m.email.toLowerCase().trim());
                    });

                    const matches = allStudents
                      .filter((s) => {
                        if (!s) return false;

                        // 1. Program and enrollment eligibility check
                        if (!isStudentProgramEligible(s)) return false;

                        // 2. Exclude students already registered in this org
                        const sDocId = (s.id || '').toLowerCase().trim();
                        const sSchoolId = (s.studentId || '').toLowerCase().trim();
                        const sEmail = (s.email || '').toLowerCase().trim();

                        if (
                          existingMemberIds.has(sDocId) ||
                          (sSchoolId && existingMemberIds.has(sSchoolId)) ||
                          (sEmail && existingMemberEmails.has(sEmail))
                        ) {
                          return false;
                        }

                        // 3. Search query matching
                        const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
                        return fullName.includes(query) || sSchoolId.includes(query) || sEmail.includes(query);
                      })
                      .slice(0, 5);

                    if (matches.length === 0) {
                      return (
                        <div className="p-3 text-xs text-gray-500 text-center">
                          No eligible {!isCrossDepartmental && activeOrg?.department ? `${activeOrg.department} ` : ''}students found matching "{searchQuery}".
                        </div>
                      );
                    }

                    return matches.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleSelectStudent(s)}
                        className="px-4 py-2.5 hover:bg-blue-50/60 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                      >
                        <div className="font-medium text-[#001A4D] text-sm">{s.firstName} {s.lastName}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono">{s.studentId}</span>
                          <span>•</span>
                          <span className="text-[#0E4EBD] font-semibold">{s.courseCode || s.courseName || 'Student'}</span>
                          <span>•</span>
                          <span className="text-green-600 font-semibold">Active</span>
                        </div>
                      </div>
                    ));
                  })()
                )}
              </div>
            )}
          </div>

          <form id="add-member-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student ID *</label>
                <input
                  type="text"
                  required
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.studentName}
                  onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
                <input
                  type="text"
                  value={formData.course}
                  onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
                <input
                  type="text"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                <input
                  type="text"
                  value={formData.contactNumber}
                  onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Membership Payment</label>
              <select
                value={formData.paymentStatus}
                onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as 'paid' | 'outstanding' })}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:ring-2 focus:ring-[#1E70E8]"
              >
                <option value="outstanding">Outstanding (Pending Payment)</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </form>
        </div>

        <div className="border-t border-[#E0E0E0] px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-member-form"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-bold text-white bg-[#0E4EBD] rounded-lg hover:bg-[#0E4EBD]/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Adding...' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  );
}
