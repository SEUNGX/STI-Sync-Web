import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { DEPARTMENTS_COLLECTION, COURSES_COLLECTION, SECTIONS_COLLECTION, SEMESTERS_COLLECTION } from '../services/academic.service';
import type { DepartmentDocument, CourseDocument, SectionDocument, SemesterDocument } from '../types/academic.types';

export function useDepartments() {
  const [data, setData] = useState<DepartmentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(db, DEPARTMENTS_COLLECTION), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map(doc => doc.data() as DepartmentDocument));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { data, loading, error };
}

export function useCourses() {
  const [data, setData] = useState<CourseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(db, COURSES_COLLECTION), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map(doc => doc.data() as CourseDocument));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { data, loading, error };
}

export function useSections() {
  const [data, setData] = useState<SectionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(db, SECTIONS_COLLECTION), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map(doc => doc.data() as SectionDocument));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { data, loading, error };
}

export function useSemesters() {
  const [data, setData] = useState<SemesterDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(db, SEMESTERS_COLLECTION), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map(doc => doc.data() as SemesterDocument));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { data, loading, error };
}

export function useActiveAcademicPeriods() {
  const { data: periods = [], loading, error } = useSemesters();

  const activeCollegePeriod = periods.find(
    (p) => !p.archived && (p.academicLevel === 'COLLEGE' || (!p.academicLevel && !String(p.semester).includes('Trimester'))) && p.status === 'ACTIVE'
  );

  const activeShsPeriod = periods.find(
    (p) => !p.archived && (p.academicLevel === 'SHS' || String(p.semester).includes('Trimester')) && p.status === 'ACTIVE'
  );

  /** Helper to get active period matching a specific academic level */
  const getActivePeriodFor = (level: import('../types/academic.types').AcademicLevel | undefined) => {
    return level === 'SHS' ? activeShsPeriod : activeCollegePeriod;
  };

  /** Helper to evaluate if a student needs re-enrollment */
  const isStudentPendingReEnrollment = (student: { academicLevel?: import('../types/academic.types').AcademicLevel; schoolYear?: string; semester?: string; term?: string }) => {
    const activePeriod = getActivePeriodFor(student.academicLevel || (student.semester && String(student.semester).includes('Trimester') ? 'SHS' : 'COLLEGE'));
    if (!activePeriod) return false;

    const studentTerm = student.term || student.semester;
    return (
      student.schoolYear !== activePeriod.academicYear ||
      studentTerm !== activePeriod.semester
    );
  };

  return {
    periods,
    activeCollegePeriod,
    activeShsPeriod,
    getActivePeriodFor,
    isStudentPendingReEnrollment,
    loading,
    error,
  };
}
