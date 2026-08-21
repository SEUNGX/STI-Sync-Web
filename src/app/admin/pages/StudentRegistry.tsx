import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Clock, RefreshCw, UserCheck, UserX, Archive, Loader2 } from 'lucide-react';
import RegistryDashboard from '../components/student-registry/RegistryDashboard';
import PendingVerification from '../components/student-registry/PendingVerification';
import ReEnrollmentManagement from '../components/student-registry/ReEnrollmentManagement';
import ActiveStudents from '../components/student-registry/ActiveStudents';
import InactiveSuspended from '../components/student-registry/InactiveSuspended';
import ArchivedGraduates from '../components/student-registry/ArchivedGraduates';
import { useStudents } from '../../modules/students/hooks/useStudentStream';
import { useActiveAcademicPeriods } from '../../modules/academic/hooks/useAcademicStream';
import { StudentDocument } from '../../modules/students/types/student.types';

type RegistryView = 'dashboard' | 'pending' | 'reenrollment' | 'active' | 'inactive' | 'archived';

export function StudentRegistry() {
  const [activeView, setActiveView] = useState<RegistryView>('dashboard');
  const [searchParams, setSearchParams] = useSearchParams();

  const targetStudentId = searchParams.get('id') || searchParams.get('studentId') || undefined;

  useEffect(() => {
    const tab = searchParams.get('tab');
    const id = searchParams.get('id') || searchParams.get('studentId');
    if (tab === 'pending' || id) {
      setActiveView('pending');
    } else if (tab && ['dashboard', 'pending', 'reenrollment', 'active', 'inactive', 'archived'].includes(tab)) {
      setActiveView(tab as RegistryView);
    }
  }, [searchParams]);

  const handleNavigate = (view: string, studentIdOrSearch?: string) => {
    if (studentIdOrSearch) {
      setSearchParams({ tab: view, id: studentIdOrSearch });
    } else {
      setSearchParams({ tab: view });
    }
    setActiveView(view as RegistryView);
  };

  const { data: students, loading: loadingStudents, error: errorStudents } = useStudents();
  const {
    activeCollegePeriod,
    activeShsPeriod,
    isStudentPendingReEnrollment,
    loading: loadingSemesters,
    error: errorSemesters,
  } = useActiveAcademicPeriods();

  const loading = loadingStudents || loadingSemesters;
  const error = errorStudents || errorSemesters;

  const activeSemester = activeCollegePeriod || activeShsPeriod;

  const categorizedStudents = useMemo(() => {
    const pending: StudentDocument[] = [];
    const active: StudentDocument[] = [];
    const inactive: StudentDocument[] = [];
    const archived: StudentDocument[] = [];
    const reenrollment: StudentDocument[] = [];

    students.forEach(student => {
      switch (student.status) {
        case 'PENDING':
          pending.push(student);
          break;
        case 'ACTIVE':
          active.push(student);
          if (isStudentPendingReEnrollment(student)) {
            reenrollment.push(student);
          }
          break;
        case 'INACTIVE':
          inactive.push(student);
          break;
        case 'ARCHIVED':
          archived.push(student);
          break;
        default:
          if ((student.status as string) === 'SUSPENDED') {
            inactive.push(student);
          }
          break;
      }
    });

    return { pending, active, inactive, archived, reenrollment };
  }, [students, isStudentPendingReEnrollment]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#0E4EBD]" />
        <p className="text-gray-500 font-medium">Loading registry data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200">
        <h3 className="font-bold mb-2">Error loading data</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  const { pending, active, inactive, archived, reenrollment } = categorizedStudents;

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <RegistryDashboard 
          onNavigate={handleNavigate} 
          categorizedStudents={{ ...categorizedStudents, suspended: [] }} 
          activeSemester={activeSemester} 
          allStudents={students}
        />;
      case 'pending':
        return <PendingVerification students={pending} initialStudentId={targetStudentId} />;
      case 'reenrollment':
        return <ReEnrollmentManagement students={active} activeSemester={activeSemester} />;
      case 'active':
        return <ActiveStudents students={active} />;
      case 'inactive':
        return <InactiveSuspended inactiveStudents={inactive} suspendedStudents={[]} />;
      case 'archived':
        return <ArchivedGraduates students={archived} />;
      default:
        return <RegistryDashboard 
          onNavigate={handleNavigate} 
          categorizedStudents={{ ...categorizedStudents, suspended: [] }} 
          activeSemester={activeSemester} 
          allStudents={students}
        />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-[#E0E0E0] rounded-xl p-2 shadow-sm">
        <button
          onClick={() => setActiveView('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeView === 'dashboard'
              ? 'bg-[#001A4D] text-white'
              : 'text-[#001A4D] hover:bg-gray-50'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveView('pending')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeView === 'pending'
              ? 'bg-[#001A4D] text-white'
              : 'text-[#001A4D] hover:bg-gray-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending Verification
          {pending.length > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs font-bold font-mono">
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveView('reenrollment')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeView === 'reenrollment'
              ? 'bg-[#001A4D] text-white'
              : 'text-[#001A4D] hover:bg-gray-50'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Re-enrollment
          {reenrollment.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-xs font-bold font-mono">
              {reenrollment.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveView('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeView === 'active'
              ? 'bg-[#001A4D] text-white'
              : 'text-[#001A4D] hover:bg-gray-50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Active Students
        </button>
        <button
          onClick={() => setActiveView('inactive')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeView === 'inactive'
              ? 'bg-[#001A4D] text-white'
              : 'text-[#001A4D] hover:bg-gray-50'
          }`}
        >
          <UserX className="w-4 h-4" />
          Inactive Students
        </button>
        <button
          onClick={() => setActiveView('archived')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeView === 'archived'
              ? 'bg-[#001A4D] text-white'
              : 'text-[#001A4D] hover:bg-gray-50'
          }`}
        >
          <Archive className="w-4 h-4" />
          Archived
        </button>
      </div>

      {/* Main Content */}
      {renderView()}
    </div>
  );
}
