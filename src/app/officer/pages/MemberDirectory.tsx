import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import {
  Plus,
  Search,
  MoreVertical,
  Crown,
  Users,
  UserMinus,
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  Loader2,
  Calendar,
  Phone,
  X,
  ArrowUpAZ,
  ArrowDownAZ,
} from 'lucide-react';
import { useOfficerProfile } from '../../auth/hooks/useOfficerProfile';
import { useRoles } from '../../modules/roles/hooks/useRoles';
import { useOrgMembers } from '../../modules/organizations/hooks/useOrgMembers';
import { useOrgOfficers } from '../../modules/organizations/hooks/useOrgOfficers';
import { useStudents } from '../../modules/students/hooks/useStudentStream';
import { useCourses, useDepartments } from '../../modules/academic/hooks/useAcademicStream';
import {
  approveMemberApplication,
  rejectMemberApplication,
} from '../../modules/organizations/services/member.service';
import { MemberProfilePanel } from '../components/MemberProfilePanel';
import { AddMemberModal } from '../components/AddMemberModal';
import { AppointOfficerModal } from '../components/AppointOfficerModal';
import { RemoveMemberModal } from '../components/RemoveMemberModal';
import type { OrganizationMemberDocument } from '../../modules/organizations/types/member.types';
import { formatTimestampDate } from '../../modules/students/utils/date.utils';

export default function MemberDirectory() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const { profile } = useOfficerProfile();
  const activeOrgId = profile?.activeOrganizationId || '';

  const { data: roles = [] } = useRoles();
  const { members = [], loading: loadingMembers } = useOrgMembers(activeOrgId);
  const { officers = [], loading: loadingOfficers } = useOrgOfficers(activeOrgId);
  const { data: allStudents = [] } = useStudents();
  const { data: dbCourses = [] } = useCourses();
  const { data: dbDepartments = [] } = useDepartments();

  const [activeTab, setActiveTab] = useState<'members' | 'pending' | 'officers' | 'inactive'>(() => {
    if (tabParam && ['members', 'pending', 'officers', 'inactive'].includes(tabParam)) {
      return tabParam as any;
    }
    return 'members';
  });

  useEffect(() => {
    if (tabParam && ['members', 'pending', 'officers', 'inactive'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [tabParam]);
  
  // Filter & Sort State across ALL tabs
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'studentId' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [selectedMember, setSelectedMember] = useState<OrganizationMemberDocument | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAppointOfficerOpen, setIsAppointOfficerOpen] = useState(false);
  const [appointPreselected, setAppointPreselected] = useState<OrganizationMemberDocument | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMemberDocument | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Lightbox Image Preview
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // Map student documents by ID/email for fast lookup of middleName and profilePhotoUrl
  const studentMap = useMemo(() => {
    const map = new Map<string, any>();
    allStudents.forEach((s) => {
      if (s.id) map.set(s.id, s);
      if (s.studentId) map.set(s.studentId, s);
      if (s.email) map.set(s.email.toLowerCase(), s);
    });
    return map;
  }, [allStudents]);

  // ─── DYNAMIC ACTIVE COURSES & STRANDS DERIVED DIRECTLY FROM FIRESTORE ─────
  const activeDbCourses = useMemo(() => {
    return dbCourses.filter((c) => !c.archived);
  }, [dbCourses]);

  const courseOptions = useMemo(() => {
    const list: { code: string; label: string; academicLevel: string }[] = [];
    const addedCodes = new Set<string>();

    // 1. Add active courses/strands from Firestore `courses` collection
    activeDbCourses.forEach((c) => {
      const code = (c.code || '').trim();
      if (code && !addedCodes.has(code.toUpperCase())) {
        addedCodes.add(code.toUpperCase());
        list.push({
          code,
          label: code, // Code only!
          academicLevel: c.academicLevel || 'COLLEGE',
        });
      }
    });

    // 2. Supplement with any active member/student course codes present in db
    members.forEach((m) => {
      if (m.course && !addedCodes.has(m.course.trim().toUpperCase())) {
        const code = m.course.trim();
        addedCodes.add(code.toUpperCase());
        const isShs = ['STEM', 'ABM', 'HUMSS', 'GAS', 'TVL-ICT', 'TVL-HE', 'TVL-IA'].includes(code.toUpperCase());
        list.push({ code, label: code, academicLevel: isShs ? 'SHS' : 'COLLEGE' });
      }
    });

    allStudents.forEach((s) => {
      if (s.course && !addedCodes.has(s.course.trim().toUpperCase())) {
        const code = s.course.trim();
        addedCodes.add(code.toUpperCase());
        const isShs = ['STEM', 'ABM', 'HUMSS', 'GAS', 'TVL-ICT', 'TVL-HE', 'TVL-IA'].includes(code.toUpperCase());
        list.push({ code, label: code, academicLevel: isShs ? 'SHS' : 'COLLEGE' });
      }
    });

    return list.sort((a, b) => a.code.localeCompare(b.code));
  }, [activeDbCourses, members, allStudents]);

  // ─── DYNAMIC YEAR LEVEL OPTIONS FROM DATABASE ─────────────────────────────
  const yearOptions = useMemo(() => {
    const options = new Set<string>();

    members.forEach((m) => {
      if (m.year) options.add(m.year.trim());
    });

    officers.forEach((o) => {
      if ((o as any).year) options.add((o as any).year.trim());
    });

    allStudents.forEach((s) => {
      if (s.year) options.add(s.year.trim());
      if ((s as any).yearLevel) options.add((s as any).yearLevel.trim());
    });

    return Array.from(options).filter(Boolean).sort();
  }, [members, officers, allStudents]);

  // Helper to extract student full name (with middle name) and photo URL
  const getMemberDetails = (m: OrganizationMemberDocument | any) => {
    const sDoc =
      studentMap.get(m.studentId) ||
      (m.email ? studentMap.get(m.email.toLowerCase()) : undefined);

    const fullName = sDoc
      ? [sDoc.firstName, sDoc.middleName, sDoc.lastName].filter(Boolean).join(' ').trim()
      : m.studentName || 'Student';

    const photoUrl =
      sDoc?.profilePhotoUrl || m.profilePhotoUrl || m.photoUrl || '';

    return { fullName, photoUrl, studentDoc: sDoc };
  };

  // Split members into raw lists
  const rawActiveMembers = useMemo(() => members.filter((m) => m.status === 'active'), [members]);
  const rawInactiveMembers = useMemo(() => members.filter((m) => m.status === 'inactive' || m.status === 'suspended'), [members]);
  const rawPendingMembers = useMemo(() => members.filter((m) => m.status === 'pending'), [members]);

  // Check if current user has permission to appoint officers
  const activeRoleDoc = roles.find((r) => r.id === profile?.activeRoleId);
  const activeRoleName = activeRoleDoc?.name?.toLowerCase() || '';
  const canAppointOfficers = ['president', 'vice president', 'secretary'].includes(activeRoleName);

  // ─── Generic Filter & Sort Pipeline (Applies to ALL Tabs) ──────────────────
  const filterAndSortList = (rawList: any[]) => {
    return rawList
      .filter((item) => {
        const { fullName } = getMemberDetails(item);
        const q = (searchQuery || '').toLowerCase().trim();

        // Inclusive text search across name, student ID, course, email
        const matchesSearch =
          !q ||
          fullName.toLowerCase().includes(q) ||
          (item.studentName || '').toLowerCase().includes(q) ||
          (item.studentId || '').toLowerCase().includes(q) ||
          (item.course || '').toLowerCase().includes(q) ||
          (item.email || '').toLowerCase().includes(q);

        // Department / Program / Strand filter
        const dept = (item.department || item.course || '').toLowerCase().trim();
        const targetFilter = filterDepartment.toLowerCase().trim();
        const matchesDepartment =
          filterDepartment === 'All' ||
          dept.includes(targetFilter) ||
          targetFilter.includes(dept);

        // Year level filter
        const yr = item.year || item.yearLevel || '';
        const matchesYear =
          filterYear === 'All' || yr.toLowerCase() === filterYear.toLowerCase();

        return matchesSearch && matchesDepartment && matchesYear;
      })
      .sort((a, b) => {
        const detailsA = getMemberDetails(a);
        const detailsB = getMemberDetails(b);

        let compA = '';
        let compB = '';

        if (sortBy === 'name') {
          compA = detailsA.fullName.toLowerCase();
          compB = detailsB.fullName.toLowerCase();
        } else if (sortBy === 'studentId') {
          compA = (a.studentId || '').toLowerCase();
          compB = (b.studentId || '').toLowerCase();
        } else if (sortBy === 'date') {
          const timeA = (a.createdAt as any)?.seconds || (a.dateJoined as any)?.seconds || 0;
          const timeB = (b.createdAt as any)?.seconds || (b.dateJoined as any)?.seconds || 0;
          return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }

        if (compA < compB) return sortOrder === 'asc' ? -1 : 1;
        if (compA > compB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  };

  // Filtered lists for each tab
  const filteredActiveMembers = useMemo(() => filterAndSortList(rawActiveMembers), [rawActiveMembers, searchQuery, filterDepartment, filterYear, sortBy, sortOrder, studentMap]);
  const filteredPendingMembers = useMemo(() => filterAndSortList(rawPendingMembers), [rawPendingMembers, searchQuery, filterDepartment, filterYear, sortBy, sortOrder, studentMap]);
  const filteredOfficers = useMemo(() => filterAndSortList(officers), [officers, searchQuery, filterDepartment, filterYear, sortBy, sortOrder, studentMap]);
  const filteredInactiveMembers = useMemo(() => filterAndSortList(rawInactiveMembers), [rawInactiveMembers, searchQuery, filterDepartment, filterYear, sortBy, sortOrder, studentMap]);

  const getInitials = (name: string) =>
    (name || 'Student')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  // Approve Application Handler
  const handleApprove = async (member: OrganizationMemberDocument) => {
    setProcessingId(member.id);
    try {
      await approveMemberApplication(member.id, activeOrgId, profile?.studentId || 'Officer');
      setActionFeedback(`Approved membership application for ${member.studentName}!`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to approve member: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Reject Application Handler
  const handleReject = async (member: OrganizationMemberDocument) => {
    if (!window.confirm(`Are you sure you want to reject ${member.studentName}'s application?`)) {
      return;
    }
    setProcessingId(member.id);
    try {
      await rejectMemberApplication(member.id, activeOrgId, profile?.studentId || 'Officer');
      setActionFeedback(`Rejected application for ${member.studentName}.`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to reject member: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-[#001A4D] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-[#FFD41C] text-[#001A4D] font-bold text-xs rounded-full uppercase tracking-wider">
              Member Directory
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Organization Roster</h1>
          <p className="text-[#FFD41C]/80 text-sm mt-1">
            Manage organization members, officer assignments, and membership applications.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setIsAddMemberOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0E4EBD] text-white rounded-lg text-[14px] font-medium hover:bg-[#0E4EBD]/90 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5 text-[#FFD41C]" />
            Add Member
          </button>
        </div>
      </div>

      {/* Action feedback toast */}
      {actionFeedback && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-sm text-green-800 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span className="font-semibold">{actionFeedback}</span>
        </div>
      )}

      {/* Navigation Tabs with Pending Application Badge */}
      <div className="flex items-center gap-6 border-b border-[#E0E0E0]">
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'members'
              ? 'border-[#0E4EBD] text-[#0E4EBD]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Active Members ({rawActiveMembers.length})
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 relative cursor-pointer ${
            activeTab === 'pending'
              ? 'border-[#0E4EBD] text-[#0E4EBD]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending Applications
          {rawPendingMembers.length > 0 ? (
            <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs font-bold font-mono animate-pulse">
              {rawPendingMembers.length}
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-mono">0</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('officers')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'officers'
              ? 'border-[#0E4EBD] text-[#0E4EBD]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Crown className="w-4 h-4" />
          Officers ({officers.length})
        </button>

        <button
          onClick={() => setActiveTab('inactive')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'inactive'
              ? 'border-[#0E4EBD] text-[#0E4EBD]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserX className="w-4 h-4" />
          Inactive / Un-enrolled ({rawInactiveMembers.length})
        </button>
      </div>

      {/* ─── DYNAMIC DATABASE-DRIVEN FILTER & SEARCH CONTROLS ───────────── */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888780]" />
            <input
              type="text"
              placeholder={
                activeTab === 'members'
                  ? 'Search active members by name, ID, or course...'
                  : activeTab === 'pending'
                  ? 'Search pending applicants by name, ID, or course...'
                  : activeTab === 'officers'
                  ? 'Search officers by name, ID, or position...'
                  : 'Search inactive members by name, ID, or course...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:border-[#1E70E8] focus:ring-2 focus:ring-[#1E70E8]/20 outline-none"
            />
          </div>

          {/* Active Programs & SHS Strands Filter (Course Code Only) */}
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-3 py-2 border border-[#E0E0E0] rounded-lg text-xs font-semibold text-[#001A4D] bg-white outline-none focus:ring-2 focus:ring-[#1E70E8]/20 cursor-pointer"
          >
            <option value="All">All Programs &amp; Strands</option>
            {courseOptions.some((c) => c.academicLevel === 'COLLEGE') && (
              <optgroup label="College Programs">
                {courseOptions
                  .filter((c) => c.academicLevel === 'COLLEGE')
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
              </optgroup>
            )}
            {courseOptions.some((c) => c.academicLevel === 'SHS') && (
              <optgroup label="Senior High School (SHS) Strands">
                {courseOptions
                  .filter((c) => c.academicLevel === 'SHS')
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>

          {/* Dynamic Year Level Filter (Strictly from Database) */}
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="px-3 py-2 border border-[#E0E0E0] rounded-lg text-xs font-semibold text-[#001A4D] bg-white outline-none focus:ring-2 focus:ring-[#1E70E8]/20 cursor-pointer"
          >
            <option value="All">All Year Levels</option>
            {yearOptions.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          {/* Sort By Field & Direction */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-[#E0E0E0] rounded-lg px-2.5 py-1.5">
            <span className="text-xs text-gray-500 font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'studentId' | 'date')}
              className="bg-transparent text-xs font-bold text-[#001A4D] outline-none cursor-pointer"
            >
              <option value="name">Name</option>
              <option value="studentId">Student ID</option>
              <option value="date">Date Joined</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 hover:bg-gray-200 rounded transition-colors text-[#0E4EBD] font-bold text-xs flex items-center gap-1 cursor-pointer"
              title={sortOrder === 'asc' ? 'Ascending (A-Z)' : 'Descending (Z-A)'}
            >
              {sortOrder === 'asc' ? <ArrowUpAZ className="w-4 h-4" /> : <ArrowDownAZ className="w-4 h-4" />}
              <span>{sortOrder === 'asc' ? 'ASC' : 'DESC'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── TAB 1: ACTIVE MEMBERS ─────────────────────────────────────────── */}
      {activeTab === 'members' && (
        loadingMembers ? (
          <div className="flex justify-center p-12 text-gray-500">Loading members...</div>
        ) : filteredActiveMembers.length === 0 ? (
          <div className="text-center p-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 bg-white">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="font-bold text-gray-700">No active members match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredActiveMembers.map((member) => {
              const { fullName, photoUrl } = getMemberDetails(member);
              const officerRec = officers.find((o) => o.studentId === member.studentId && o.isActive);
              const officerRoleDoc = officerRec ? roles.find((r) => r.id === officerRec.roleId) : null;
              const positionTitle = officerRoleDoc?.name || officerRec?.roleName || 'Officer';

              return (
                <div
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className="bg-white border border-[#E0E0E0] rounded-xl p-5 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group"
                >
                  {(member.isOfficer || officerRec) && (
                    <div className="absolute top-0 right-0 bg-[#FFC107] text-[#001A4D] px-3 py-1 rounded-bl-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs">
                      <Crown className="w-3 h-3" /> {positionTitle}
                    </div>
                  )}

                  <div>
                    <div className="flex items-start justify-between mb-3">
                      {/* Profile Picture with Fixed-Size Click-to-Enlarge */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (photoUrl) {
                            setPreviewImage({ url: photoUrl, name: fullName });
                          }
                        }}
                        className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shadow-inner overflow-hidden border-2 border-[#0E4EBD] flex-shrink-0 ${
                          photoUrl ? 'cursor-pointer hover:opacity-90 hover:scale-105 transition-all' : 'bg-gradient-to-br from-[#0E4EBD] to-[#1E70E8] text-white'
                        }`}
                        title={photoUrl ? 'Click to enlarge photo' : fullName}
                      >
                        {photoUrl ? (
                          <img src={photoUrl} alt={fullName} className="w-full h-full object-cover" />
                        ) : (
                          getInitials(fullName)
                        )}
                      </div>

                      <div className="relative group/menu">
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 hover:bg-[#F8F8F8] rounded-lg cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4 text-[#888780]" />
                        </button>
                        {/* Action Menu */}
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#E0E0E0] rounded-lg shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10 overflow-hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMember(member);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-[#001A4D] hover:bg-gray-50 font-medium"
                          >
                            View Profile
                          </button>
                          {canAppointOfficers && !member.isOfficer && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAppointPreselected(member);
                                setIsAppointOfficerOpen(true);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-[#0E4EBD] hover:bg-blue-50 font-medium"
                            >
                              Appoint as Officer
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMemberToRemove(member);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium border-t border-gray-100 flex items-center gap-2"
                          >
                            <UserMinus className="w-4 h-4" /> Remove Member
                          </button>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-[#001A4D] text-[16px] font-bold mb-0.5 truncate group-hover:text-[#0E4EBD] transition-colors" title={fullName}>
                      {fullName}
                    </h3>
                    <p className="text-[#888780] font-mono text-[12px] mb-2">{member.studentId}</p>

                    <p className="text-gray-700 text-[13px]">
                      {member.course || 'N/A'} {member.year ? `· ${member.year}` : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ─── TAB 2: PENDING MEMBERSHIP APPLICATIONS ─────────────────────────── */}
      {activeTab === 'pending' && (
        loadingMembers ? (
          <div className="flex justify-center p-12 text-gray-500">Loading pending applications...</div>
        ) : filteredPendingMembers.length === 0 ? (
          <div className="text-center p-16 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500 bg-white shadow-xs">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-[#001A4D]">No Pending Applications</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              There are currently no new student membership applications matching your filter criteria.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-[#0E4EBD] flex items-center justify-between shadow-xs">
              <span className="font-semibold">
                🔔 {filteredPendingMembers.length} student application(s) awaiting verification.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPendingMembers.map((member) => {
                const { fullName, photoUrl } = getMemberDetails(member);
                const isProcessing = processingId === member.id;

                return (
                  <div
                    key={member.id}
                    className="bg-white border border-[#E0E0E0] rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      {/* Profile Picture */}
                      <div
                        onClick={() => {
                          if (photoUrl) {
                            setPreviewImage({ url: photoUrl, name: fullName });
                          }
                        }}
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-inner flex-shrink-0 ${
                          photoUrl ? 'cursor-pointer hover:opacity-90 hover:scale-105 transition-all' : 'bg-gradient-to-br from-[#0E4EBD] to-[#1E70E8]'
                        }`}
                      >
                        {photoUrl ? (
                          <img src={photoUrl} alt={fullName} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          getInitials(fullName)
                        )}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-[#001A4D] text-base">{fullName}</h4>
                          <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[11px] font-bold">
                            Pending
                          </span>
                        </div>

                        <p className="text-xs font-mono text-gray-500">{member.studentId}</p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 pt-1">
                          <span>{member.course || 'Degree Program / Strand N/A'}</span>
                          <span>{member.year || 'Year Level N/A'}</span>
                          <span>{member.department || 'Department'}</span>
                        </div>

                        {member.contactNumber && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            <span>{member.contactNumber}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-gray-500 pt-1 border-t border-gray-200/60">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>Applied on: {formatTimestampDate(member.createdAt || member.applicationDate)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleReject(member)}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-2 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <UserX className="w-4 h-4" /> Reject
                      </button>
                      <button
                        onClick={() => handleApprove(member)}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-2 bg-[#001A4D] hover:bg-[#0E4EBD] text-[#FFD41C] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserCheck className="w-4 h-4" />
                        )}
                        Approve Membership
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* ─── TAB 3: OFFICERS ──────────────────────────────────────────────── */}
      {activeTab === 'officers' && (
        loadingOfficers ? (
          <div className="flex justify-center p-12 text-gray-500">Loading officers...</div>
        ) : (
          <div className="space-y-6">
            {canAppointOfficers && (
              <div className="flex justify-end">
                <button
                  onClick={() => setIsAppointOfficerOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FFC107] text-[#001A4D] rounded-lg text-sm font-bold shadow-sm hover:bg-[#FFC107]/90 transition-colors cursor-pointer"
                >
                  <Crown className="w-4 h-4" /> Appoint Officer
                </button>
              </div>
            )}

            {filteredOfficers.length === 0 ? (
              <div className="text-center p-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 bg-white">
                No officers match your filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOfficers.map((officer) => {
                  const roleDoc = roles.find((r) => r.id === officer.roleId);
                  const roleName = roleDoc?.name || officer.roleName || officer.roleId;

                  const { fullName, photoUrl } = getMemberDetails(officer);

                  return (
                    <div
                      key={officer.id}
                      className="bg-white border border-[#E0E0E0] rounded-xl p-5 hover:shadow-lg transition-shadow flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between mb-4">
                          {/* Profile Picture with Fixed-Size Click-to-Enlarge */}
                          <div
                            onClick={() => {
                              if (photoUrl) {
                                setPreviewImage({ url: photoUrl, name: fullName });
                              }
                            }}
                            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-inner overflow-hidden border-2 border-[#001A4D] flex-shrink-0 ${
                              photoUrl ? 'cursor-pointer hover:opacity-90 hover:scale-105 transition-all' : 'bg-[#001A4D] text-white'
                            }`}
                            title={photoUrl ? 'Click to enlarge photo' : fullName}
                          >
                            {photoUrl ? (
                              <img src={photoUrl} alt={fullName} className="w-full h-full object-cover" />
                            ) : (
                              getInitials(fullName)
                            )}
                          </div>

                          <span className="px-3 py-1 bg-[#0E4EBD] text-white text-[11px] font-bold rounded-full uppercase tracking-wider">
                            {roleName}
                          </span>
                        </div>

                        <h3 className="text-[#001A4D] text-[16px] font-bold mb-1 truncate" title={fullName}>
                          {fullName}
                        </h3>
                        <p className="text-[#888780] font-mono text-[13px] mb-3">{officer.studentId}</p>
                        <p className="text-[#001A4D] text-[13px]">{officer.email}</p>
                      </div>

                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#E0E0E0]">
                        <span className="text-xs text-gray-500 flex-1">
                          Access:{' '}
                          {officer.isActive ? (
                            <span className="text-green-600 font-medium">Active</span>
                          ) : (
                            <span className="text-red-500 font-medium">Revoked</span>
                          )}
                        </span>
                        {officer.isActive && canAppointOfficers && (
                          <button className="text-xs font-medium text-red-600 hover:underline cursor-pointer">
                            Revoke Access
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}

      {/* ─── TAB 4: INACTIVE / UN-ENROLLED ──────────────────────────────── */}
      {activeTab === 'inactive' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-xs text-amber-800">
            <UserX className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span>
              These members are marked <strong>INACTIVE</strong> (e.g. un-enrolled for current term or missed re-enrollment deadline). They are preserved in history but cannot log in or participate in active events until reactivated by SAO.
            </span>
          </div>

          {filteredInactiveMembers.length === 0 ? (
            <div className="text-center p-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 bg-white">
              No inactive or un-enrolled organization members match your filter criteria.
            </div>
          ) : (
            <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-[#E0E0E0] text-xs font-bold text-gray-500 uppercase">
                    <tr>
                      <th className="px-5 py-3">Member</th>
                      <th className="px-5 py-3">Course / Strand &amp; Year</th>
                      <th className="px-5 py-3">Department</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E0E0] text-sm">
                    {filteredInactiveMembers.map((member) => {
                      const { fullName, photoUrl } = getMemberDetails(member);

                      return (
                        <tr key={member.id} className="hover:bg-gray-50/70 transition-colors opacity-75">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                onClick={() => {
                                  if (photoUrl) {
                                    setPreviewImage({ url: photoUrl, name: fullName });
                                  }
                                }}
                                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden border border-gray-300 ${
                                  photoUrl ? 'cursor-pointer hover:opacity-90 hover:scale-105 transition-all' : 'bg-gray-300 text-gray-600'
                                }`}
                              >
                                {photoUrl ? (
                                  <img src={photoUrl} alt={fullName} className="w-full h-full object-cover" />
                                ) : (
                                  getInitials(fullName)
                                )}
                              </div>
                              <div>
                                <p className="text-[#001A4D] font-bold text-sm">{fullName}</p>
                                <p className="text-gray-400 text-xs font-mono">{member.studentId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 text-xs">
                            {member.course} · {member.year}
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 text-xs">{member.department}</td>
                          <td className="px-5 py-3.5">
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold inline-flex items-center gap-1">
                              <UserX className="w-3.5 h-3.5 text-amber-600" />
                              Inactive / Un-enrolled
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Profile & Action Modals */}
      {selectedMember && (
        <MemberProfilePanel
          member={selectedMember}
          officerRecord={officers.find((o) => o.studentId === selectedMember.studentId && o.isActive)}
          onClose={() => setSelectedMember(null)}
          onAppointOfficer={
            canAppointOfficers && !selectedMember.isOfficer
              ? () => {
                  setSelectedMember(null);
                  setAppointPreselected(selectedMember);
                  setIsAppointOfficerOpen(true);
                }
              : undefined
          }
          onRemoveMember={() => {
            setMemberToRemove(selectedMember);
            setSelectedMember(null);
          }}
        />
      )}

      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        organizationId={activeOrgId}
        addedBy={profile?.studentId || 'system'}
      />

      <AppointOfficerModal
        isOpen={isAppointOfficerOpen}
        onClose={() => {
          setIsAppointOfficerOpen(false);
          setAppointPreselected(null);
        }}
        organizationId={activeOrgId}
        preselectedMember={appointPreselected}
        currentOfficers={officers}
      />

      <RemoveMemberModal
        member={memberToRemove}
        organizationId={activeOrgId}
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
      />

      {/* Lightbox / Fixed-Size Image Enlarge Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative w-80 h-80 sm:w-96 sm:h-96 md:w-[400px] md:h-[400px] p-2 bg-white/10 rounded-3xl border border-white/20 shadow-2xl flex flex-col items-center justify-center animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-9 h-9 bg-white text-gray-800 rounded-full flex items-center justify-center font-bold shadow-lg hover:bg-gray-100 transition-colors z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-black/40">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="w-full h-full object-cover"
              />
            </div>
            {previewImage.name && (
              <p className="mt-3 text-white text-xs sm:text-sm font-bold tracking-wide bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/20 truncate max-w-full">
                {previewImage.name}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
