import { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Download, Eye, Archive, MoreVertical, Building2, Filter } from 'lucide-react';
import AddStudentManuallyModal from './AddStudentManuallyModal';
import StudentDetailModal from '../../../modules/students/components/StudentDetailModal';
import ArchiveStudentModal from '../../../modules/students/components/ArchiveStudentModal';
import { StudentDocument } from '../../../modules/students/types/student.types';
import { formatTimestampDate } from '../../../modules/students/utils/date.utils';
import { exportStudentsToCSV } from '../../../modules/students/utils/export.utils';
import { useCourses, useSections } from '../../../modules/academic/hooks/useAcademicStream';
import { useAdviserProfile } from '../../../modules/auth/hooks/useAdviserProfile';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import type { OrganizationMemberDocument } from '../../../modules/organizations/types/member.types';
import type { PayableDocument } from '../../../modules/finance/types/payable.types';

interface ActiveStudentsProps {
  students: StudentDocument[];
}

export default function ActiveStudents({ students: activeStudents }: ActiveStudentsProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<StudentDocument | null>(null);
  const [selectedStudentForArchive, setSelectedStudentForArchive] = useState<StudentDocument | null>(null);
  const [activeMenuStudentId, setActiveMenuStudentId] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('All Courses');
  const [selectedYear, setSelectedYear] = useState('All Year Levels');
  const [selectedSection, setSelectedSection] = useState('All Sections');

  // Academic streams for filter dropdowns
  const { data: courses } = useCourses();
  const { data: sections } = useSections();
  const { user, profile } = useAdviserProfile();
  const adminUid = user?.uid || profile?.uid || 'admin';

  // Real-time Organization Memberships, Organizations & Payables for table enrichment
  const [allMemberships, setAllMemberships] = useState<OrganizationMemberDocument[]>([]);
  const [allOrgs, setAllOrgs] = useState<any[]>([]);
  const [allPayables, setAllPayables] = useState<PayableDocument[]>([]);

  useEffect(() => {
    // 1. Subscribe to organization members
    const qMembers = query(collection(db, 'organization_members'));
    const unsubMembers = onSnapshot(qMembers, (snap) => {
      setAllMemberships(snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrganizationMemberDocument)));
    });

    // 2. Subscribe to organizations for acronyms / names
    const qOrgs = query(collection(db, 'organizations'));
    const unsubOrgs = onSnapshot(qOrgs, (snap) => {
      setAllOrgs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // 3. Subscribe to payables
    const qPayables = query(collection(db, 'payables'));
    const unsubPayables = onSnapshot(qPayables, (snap) => {
      setAllPayables(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PayableDocument)));
    });

    return () => {
      unsubMembers();
      unsubOrgs();
      unsubPayables();
    };
  }, []);

  // Map student club memberships
  const studentOrgsMap = useMemo(() => {
    const orgMap = new Map<string, any>();
    allOrgs.forEach((o) => orgMap.set(o.id, o));

    const map = new Map<string, string[]>();
    allMemberships.forEach((m) => {
      const org = orgMap.get(m.organizationId);
      const clubBadge = org?.acronym || org?.name || m.department || 'Club';

      // Index under auth ID, school studentId, and email
      const keys: string[] = [];
      if (m.studentId) keys.push(m.studentId);
      if ((m as any).studentSchoolId) keys.push((m as any).studentSchoolId);
      if (m.email) keys.push(m.email.trim().toLowerCase());

      keys.forEach((key) => {
        if (!map.has(key)) {
          map.set(key, []);
        }
        const list = map.get(key)!;
        if (!list.includes(clubBadge)) {
          list.push(clubBadge);
        }
      });
    });
    return map;
  }, [allMemberships, allOrgs]);

  // Helper to get clubs for a student
  const getStudentClubs = (s: StudentDocument): string[] => {
    const list1 = studentOrgsMap.get(s.id) || [];
    const list2 = s.studentId ? (studentOrgsMap.get(s.studentId) || []) : [];
    const list3 = s.email ? (studentOrgsMap.get(s.email.trim().toLowerCase()) || []) : [];
    return Array.from(new Set([...list1, ...list2, ...list3]));
  };

  // Map student payables
  const studentPayablesMap = useMemo(() => {
    const map = new Map<string, { totalAssigned: number; totalPaid: number; hasUnpaid: boolean }>();
    allPayables.forEach((p) => {
      const assigned = Number(p.assignedAmount || 0);
      const paid = Number(p.paidAmount || 0);
      const isUnpaid = p.status !== 'paid' && p.status !== 'waived' && (assigned - paid) > 0;

      const keys: string[] = [];
      if (p.studentId) keys.push(p.studentId);
      if (p.studentSchoolId) keys.push(p.studentSchoolId);

      keys.forEach((key) => {
        if (!map.has(key)) {
          map.set(key, { totalAssigned: 0, totalPaid: 0, hasUnpaid: false });
        }
        const record = map.get(key)!;
        record.totalAssigned += assigned;
        record.totalPaid += paid;
        if (isUnpaid) {
          record.hasUnpaid = true;
        }
      });
    });
    return map;
  }, [allPayables]);

  // Available unique sections from active students and section config
  const availableSections = useMemo(() => {
    const sectionSet = new Set<string>();
    activeStudents.forEach((s) => {
      if (s.section) sectionSet.add(s.section);
    });
    sections.forEach((sec) => {
      if (sec.name) sectionSet.add(sec.name);
    });
    return Array.from(sectionSet).sort();
  }, [activeStudents, sections]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return activeStudents.filter((student) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${student.firstName} ${student.middleName || ''} ${student.lastName}`.toLowerCase();
        const studentId = (student.studentId || '').toLowerCase();
        const email = (student.email || '').toLowerCase();
        const course = (student.courseCode || '').toLowerCase();

        if (!fullName.includes(q) && !studentId.includes(q) && !email.includes(q) && !course.includes(q)) {
          return false;
        }
      }

      // 2. Course Filter
      if (selectedCourse !== 'All Courses') {
        if (student.courseCode !== selectedCourse && student.courseName !== selectedCourse) {
          return false;
        }
      }

      // 3. Year Level Filter
      if (selectedYear !== 'All Year Levels') {
        if (student.yearLevel !== selectedYear) {
          return false;
        }
      }

      // 4. Section Filter
      if (selectedSection !== 'All Sections') {
        if (student.section !== selectedSection) {
          return false;
        }
      }

      return true;
    });
  }, [activeStudents, searchQuery, selectedCourse, selectedYear, selectedSection]);

  // Live Summary Statistics
  const summaryStats = useMemo(() => {
    const totalActive = activeStudents.length;

    // Students with unpaid payables
    let totalWithOutstanding = 0;
    activeStudents.forEach((s) => {
      const pInfo = studentPayablesMap.get(s.id) || (s.studentId ? studentPayablesMap.get(s.studentId) : null);
      if (pInfo?.hasUnpaid) {
        totalWithOutstanding += 1;
      }
    });

    // New this semester (students added in current school year / semester or recent)
    const newThisSemester = activeStudents.filter((s) => {
      const ms = s.createdAt?.toMillis ? s.createdAt.toMillis() : 0;
      const daysOld = ms ? (Date.now() - ms) / (1000 * 60 * 60 * 24) : 999;
      return daysOld <= 120; // registered within 120 days
    }).length;

    return {
      totalActive,
      newThisSemester,
      totalWithOutstanding,
    };
  }, [activeStudents, studentPayablesMap]);

  const handleExport = () => {
    exportStudentsToCSV(filteredStudents, 'Active_Students_Filtered');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Active Students</h2>
          <p className="text-sm text-gray-500">Dashboard → Student Registry → Active Students</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 bg-[#83358E] text-white rounded-lg font-medium hover:bg-[#83358E]/90 flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Student Manually
          </button>
          <button
            onClick={handleExport}
            className="px-5 py-2.5 bg-[#001A4D] text-white rounded-lg font-medium hover:bg-[#001A4D]/90 flex items-center gap-2 shadow-sm transition-all"
            title="Export current filtered list to CSV"
          >
            <Download className="w-4 h-4" />
            Export Directory
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-3xl font-bold text-[#001A4D]">{summaryStats.totalActive}</div>
              <div className="text-sm text-gray-500 font-medium">Total Active Students</div>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:pl-6 pt-4 sm:pt-0">
            <div>
              <div className="text-3xl font-bold text-green-600">+{summaryStats.newThisSemester}</div>
              <div className="text-sm text-gray-500 font-medium">New This Semester</div>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:pl-6 pt-4 sm:pt-0">
            <div>
              <div className={`text-3xl font-bold ${summaryStats.totalWithOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {summaryStats.totalWithOutstanding}
              </div>
              <div className="text-sm text-gray-500 font-medium">Students with Unpaid Payables</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, student ID, or email..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] outline-none"
            />
          </div>

          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] outline-none bg-white text-gray-700"
          >
            <option value="All Courses">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.code}>{c.code} — {c.name}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] outline-none bg-white text-gray-700"
          >
            <option value="All Year Levels">All Year Levels</option>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
          </select>

          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#83358E] outline-none bg-white text-gray-700"
          >
            <option value="All Sections">All Sections</option>
            {availableSections.map((sec) => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>
        </div>

        {(searchQuery || selectedCourse !== 'All Courses' || selectedYear !== 'All Year Levels' || selectedSection !== 'All Sections') && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <span>Showing {filteredStudents.length} of {activeStudents.length} active students</span>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCourse('All Courses');
                setSelectedYear('All Year Levels');
                setSelectedSection('All Sections');
              }}
              className="text-[#0E4EBD] hover:underline font-medium"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Active Students Table */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs font-bold text-gray-700 uppercase">
              <tr>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">Course & Year</th>
                <th className="px-6 py-3.5">Section</th>
                <th className="px-6 py-3.5">Clubs</th>
                <th className="px-6 py-3.5">Payment Status</th>
                <th className="px-6 py-3.5">Last Record Update</th>
                <th className="px-6 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No active students match your search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const orgs = getStudentClubs(student);
                  const pInfo = studentPayablesMap.get(student.id) || (student.studentId ? studentPayablesMap.get(student.studentId) : null);
                  const isMenuOpen = activeMenuStudentId === student.id;

                  return (
                    <tr key={student.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-[#0E4EBD] to-[#83358E] rounded-full flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden shadow-sm flex-shrink-0">
                            {student.profilePhotoUrl ? (
                              <img 
                                src={student.profilePhotoUrl} 
                                alt="Profile" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    `${student.firstName || ''} ${student.lastName || ''}`
                                  )}&background=83358E&color=fff`;
                                }}
                              />
                            ) : (
                              `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-[#001A4D]">
                              {student.firstName} {student.middleName ? `${student.middleName} ` : ''}{student.lastName}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">{student.studentId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{student.courseCode}</div>
                        <div className="text-xs text-gray-500">{student.yearLevel}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700">{student.section || '—'}</td>
                      <td className="px-6 py-4">
                        {orgs.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {orgs.slice(0, 2).map((orgName, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-[#83358E]/10 text-[#83358E] rounded text-xs font-semibold">
                                {orgName}
                              </span>
                            ))}
                            {orgs.length > 2 && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                +{orgs.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {pInfo?.hasUnpaid ? (
                          <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                            Unpaid Dues
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            Cleared / Paid
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 font-medium">
                        {formatTimestampDate(student.updatedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1 relative">
                          <button
                            onClick={() => setSelectedStudentForDetail(student)}
                            className="p-2 text-[#0E4EBD] hover:bg-[#0E4EBD]/10 rounded-lg transition-colors"
                            title="View Full Student Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          <div className="relative">
                            <button
                              onClick={() => setActiveMenuStudentId(isMenuOpen ? null : student.id)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="More Options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {isMenuOpen && (
                              <div 
                                className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100"
                                onMouseLeave={() => setActiveMenuStudentId(null)}
                              >
                                <button
                                  onClick={() => {
                                    setActiveMenuStudentId(null);
                                    setSelectedStudentForDetail(student);
                                  }}
                                  className="w-full px-4 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#0E4EBD]" />
                                  View Full Info
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMenuStudentId(null);
                                    setSelectedStudentForArchive(student);
                                  }}
                                  className="w-full px-4 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Archive className="w-3.5 h-3.5 text-red-500" />
                                  Archive Student
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Manually Modal */}
      {showAddModal && (
        <AddStudentManuallyModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => setShowAddModal(false)}
        />
      )}

      {/* View Student Complete Details Modal */}
      {selectedStudentForDetail && (
        <StudentDetailModal
          student={selectedStudentForDetail}
          onClose={() => setSelectedStudentForDetail(null)}
          onArchive={(stu) => {
            setSelectedStudentForDetail(null);
            setSelectedStudentForArchive(stu);
          }}
        />
      )}

      {/* Archive Student Modal */}
      {selectedStudentForArchive && (
        <ArchiveStudentModal
          student={selectedStudentForArchive}
          adminUid={adminUid}
          onClose={() => setSelectedStudentForArchive(null)}
          onSuccess={() => setSelectedStudentForArchive(null)}
        />
      )}
    </div>
  );
}
