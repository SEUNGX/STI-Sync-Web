import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { StudentDocument, AcademicLevel, StudentSex, StudentYearLevel, StudentSemester } from '../../app/modules/students/types/student.types';
import { EventDocument, EventSession, EventScanner, BudgetLineItem, EventDocumentFile } from '../../app/modules/events/types/event.types';
import { ATTENDANCE_COLLECTION } from '../../app/modules/attendance/services/attendance.service';
import { AttendanceRecord, AttendanceStatus } from '../../app/modules/attendance/types/attendance.types';
import { PAYABLES_COLLECTION, syncStudentPayablesForActiveEvents } from '../../app/modules/finance/services/payable.service';
import { PayableDocument, PayableType } from '../../app/modules/finance/types/payable.types';
import { COURSES_COLLECTION, DEPARTMENTS_COLLECTION, SECTIONS_COLLECTION, SEMESTERS_COLLECTION } from '../../app/modules/academic/services/academic.service';
import { EVENTS_COLLECTION, generatePayablesForEvent } from '../../app/modules/events/services/event.service';

// Helper to strip all `undefined` values recursively for Firestore compatibility
export function cleanForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !(value instanceof Timestamp) &&
        !(value instanceof Date) &&
        !Array.isArray(value)
      ) {
        result[key] = cleanForFirestore(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

// ─── Extensive Filipino Names Pool (Over 100,000+ unique permutations) ────────
const FIRST_NAMES_MALE = [
  'Juan', 'Mark', 'Joshua', 'Christian', 'Angelo', 'Gabriel', 'John Paul', 'Kenneth', 'Daniel',
  'Jayson', 'Carl', 'Justin', 'Matthew', 'Nathaniel', 'Lance', 'Vince', 'Paolo', 'Rafael',
  'Alden', 'Jericho', 'Dominic', 'Miguel', 'Elijah', 'Francis', 'Cedric', 'Kian', 'Gian',
  'Patrick', 'Kyle', 'Sean', 'Kurt', 'Tristan', 'Marc', 'Dexter', 'Renzo', 'Rico', 'Noel',
];

const FIRST_NAMES_FEMALE = [
  'Maria', 'Angelica', 'Bea', 'Christine', 'Nicole', 'Patricia', 'Alyssa', 'Camille', 'Samantha',
  'Katrina', 'Andrea', 'Princess', 'Denise', 'Hannah', 'Erika', 'Kimberly', 'Rhea', 'Danica',
  'Jasmine', 'Chloe', 'Bianca', 'Janine', 'Clarisse', 'Pauline', 'Abigail', 'Mae', 'Joyce',
  'Ella', 'Shaira', 'Stephanie', 'Kyla', 'Giselle', 'Faith', 'Angel', 'Sofia', 'Cheska',
];

const LAST_NAMES = [
  'Dela Cruz', 'Santos', 'Reyes', 'Fernandez', 'Gonzales', 'Concordia', 'Lucanas', 'Mendoza',
  'Garcia', 'Flores', 'Villanueva', 'Bautista', 'Torres', 'Navarro', 'Castillo', 'Alvarez',
  'Mercado', 'Ramos', 'Aquino', 'Salazar', 'Domingo', 'Valdez', 'Perez', 'Castro',
  'Soriano', 'Gomez', 'Cruz', 'Robles', 'Pascual', 'Manalo', 'Rivera', 'Santiago',
  'Vergara', 'Ocampo', 'Cabrera', 'Padilla', 'Delos Reyes', 'Tolentino', 'Morales',
];

const MIDDLE_NAMES = [
  'Basa', 'Custodio', 'Dizon', 'Enriquez', 'Fabian', 'Guinto', 'Hernandez', 'Ilagan',
  'Jimenez', 'Katigbak', 'Lacson', 'Magno', 'Natividad', 'Ortiz', 'Pineda', 'Quizon',
  'Rosario', 'San Jose', 'Tañedo', 'Urbano', 'Veloso', 'Yambao', 'Zamora',
];

// Pre-crafted Event Title Presets
export const EVENT_PRESETS = [
  {
    title: 'Tech Innovators Hackathon & Dev Summit 2026',
    tagline: 'Building Next-Generation Digital Solutions for Community Impact',
    description: 'A 2-day hands-on tech summit and software development hackathon bringing together passionate developers, designers, and tech enthusiasts.',
    track: 'COLLEGE' as const,
    courses: ['BSIT', 'BSCS'],
    fee: 150,
  },
  {
    title: 'Hospitality & Culinary Arts Grand Expo',
    tagline: 'Mastering World-Class Service, Culinary Excellence, and Tourism Trends',
    description: 'An immersive showcase of hospitality management, fine dining table service, mocktail mixology, and modern tourism marketing strategies.',
    track: 'COLLEGE' as const,
    courses: ['BSHM', 'BSTM'],
    fee: 200,
  },
  {
    title: 'STI Ormoc Institutional Leadership Congress',
    tagline: 'Empowering Student Leaders through Ethical Governance and Collaboration',
    description: 'Annual leadership training and general assembly for student organization officers, council members, and aspiring student leaders.',
    track: 'CAMPUS_WIDE' as const,
    courses: [],
    fee: 0,
  },
  {
    title: 'STEM Robotics & Scientific Innovation Symposium',
    tagline: 'Pioneering Research, Automation, and Sustainable Engineering Solutions',
    description: 'Interactive STEM exhibition featuring automated robotics displays, applied physics projects, and scientific paper presentations.',
    track: 'SHS' as const,
    courses: ['STEM'],
    fee: 100,
  },
  {
    title: 'Business Ventures & Entrepreneurship Pitch Fest',
    tagline: 'Transforming Creative Ideas into Scalable Enterprise Solutions',
    description: 'Capstone project pitching competition where students showcase feasibility studies, business models, and innovative products.',
    track: 'COLLEGE' as const,
    courses: ['BSBA', 'BSIT'],
    fee: 120,
  },
];

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomStudentId(): string {
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  return `02000${randomSuffix}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. EVENT PARTICIPANT TARGETING VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

export function isStudentEligibleForEvent(event: Partial<EventDocument> | any, student: Partial<StudentDocument> | any): boolean {
  if (!event || !student) return false;

  // 1. Academic Track Check (College vs SHS)
  const isShsEvent =
    event.academicLevel === 'SHS' ||
    String(event.semester || '').includes('Trimester') ||
    (event.targetYearLevels || []).some((y: string) => y.includes('Grade 11') || y.includes('Grade 12'));

  const isShsStudent =
    student.academicLevel === 'SHS' ||
    String(student.semester || '').includes('Trimester') ||
    String(student.yearLevel || '').includes('Grade');

  if (isShsEvent !== isShsStudent) {
    return false;
  }

  // 2. School Year Check (if event defines specific schoolYear)
  if (event.schoolYear && student.schoolYear && event.schoolYear !== student.schoolYear) {
    return false;
  }

  // 3. Semester / Term Check (if event defines specific term)
  if (event.semester && student.semester && event.semester !== student.semester) {
    return false;
  }

  // 4. Target Participant Scope
  const scope = event.targetAudienceScope || event.targetAudience || 'all';

  const targetCourses: string[] = (event.targetCourses || event.targetCourseIds || []).map((c: string) => String(c).trim().toLowerCase());
  const targetYearLevels: string[] = (event.targetYearLevels || []).map((y: string) => String(y).trim().toLowerCase());
  const targetSections: string[] = (event.targetSections || event.targetSectionNames || []).map((s: string) => String(s).trim().toLowerCase());

  const hasSpecificTargets = targetCourses.length > 0 || targetYearLevels.length > 0 || targetSections.length > 0;

  if (scope === 'all' && !hasSpecificTargets) {
    return true;
  }

  // Match Course / Strand
  const studentCourseCode = String(student.courseCode || '').trim().toLowerCase();
  const studentCourseId = String(student.courseId || '').trim().toLowerCase();
  const matchesCourse =
    targetCourses.length === 0 ||
    (studentCourseCode && targetCourses.includes(studentCourseCode)) ||
    (studentCourseId && targetCourses.includes(studentCourseId));

  // Match Year Level
  const studentYear = String(student.yearLevel || '').trim().toLowerCase();
  const matchesYear =
    targetYearLevels.length === 0 ||
    (studentYear && targetYearLevels.includes(studentYear));

  // Match Section
  const studentSection = String(student.section || '').trim().toLowerCase();
  const matchesSection =
    targetSections.length === 0 ||
    (studentSection && targetSections.includes(studentSection));

  return matchesCourse && matchesYear && matchesSection;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. REALISTIC EVENT SEEDER (WITH DB MAINTENANCE MAPPINGS)
// ═══════════════════════════════════════════════════════════════════════════════

export interface SeedEventOptions {
  title?: string;
  tagline?: string;
  description?: string;
  hostingOrgId?: string;
  hostingOrgName?: string;
  academicTrack?: 'COLLEGE' | 'SHS' | 'CAMPUS_WIDE';
  targetCourses?: string[];
  targetYearLevels?: string[];
  targetSections?: string[];
  sessionCount?: number;
  hasTimeOut?: boolean;
  proposalStatus?: 'approved' | 'pending_review' | 'draft';
  enablePayables?: boolean;
  ticketFee?: number;
  expectedAttendees?: number;
  eventFormat?: 'On-Campus' | 'Online' | 'Hybrid';
  venueName?: string;
}

export async function seedSampleEvent(options: SeedEventOptions = {}): Promise<EventDocument> {
  const now = Timestamp.now();
  const nowDate = new Date();
  const yearStr = nowDate.getFullYear().toString();

  // 1. Fetch Maintenance Data from DB Collections
  let dbEventTypes: any[] = [];
  let dbEventCategories: any[] = [];
  let dbVenues: any[] = [];
  let dbOrgs: any[] = [];
  let activeCollegeSem: any = null;
  let activeShsSem: any = null;

  try {
    const [typesSnap, catsSnap, venuesSnap, orgsSnap, semsSnap] = await Promise.all([
      getDocs(collection(db, 'event_types')),
      getDocs(collection(db, 'event_categories')),
      getDocs(collection(db, 'venues')),
      getDocs(collection(db, 'organizations')),
      getDocs(query(collection(db, SEMESTERS_COLLECTION), where('status', '==', 'ACTIVE'))),
    ]);

    dbEventTypes = typesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    dbEventCategories = catsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    dbVenues = venuesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    dbOrgs = orgsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    semsSnap.docs.forEach((d) => {
      const s = { id: d.id, ...d.data() } as any;
      if (s.academicLevel === 'SHS' || String(s.semester).includes('Trimester')) {
        activeShsSem = s;
      } else {
        activeCollegeSem = s;
      }
    });
  } catch (err) {
    console.warn('[seedSampleEvent] Could not fetch DB maintenance collections:', err);
  }

  // Fallback defaults
  const chosenPreset = getRandomItem(EVENT_PRESETS);
  const track = options.academicTrack || chosenPreset.track;
  const isShs = track === 'SHS';
  const activeSem = isShs ? activeShsSem : activeCollegeSem;

  const title = options.title || chosenPreset.title;
  const tagline = options.tagline || chosenPreset.tagline;
  const description = options.description || chosenPreset.description;

  const chosenOrg =
    (options.hostingOrgId ? dbOrgs.find((o) => o.id === options.hostingOrgId) : null) ||
    dbOrgs[0] || { id: 'org_jpcs', name: 'Junior Philippine Computer Society' };

  const eventTypeObj = dbEventTypes[0] || { id: 'type_seminar', name: 'Seminar / Workshop' };
  const eventCategoryObj = dbEventCategories[0] || { id: 'cat_academic', name: 'Academic' };
  const venueObj = dbVenues[0] || { id: 'venue_gym', name: options.venueName || 'STI Ormoc Gymnasium' };

  const targetCourses = options.targetCourses !== undefined ? options.targetCourses : chosenPreset.courses;
  const targetYearLevels = options.targetYearLevels || (isShs ? ['Grade 11', 'Grade 12'] : ['1st Year', '2nd Year', '3rd Year', '4th Year']);
  const targetSections = options.targetSections || [];

  const sessionCount = options.sessionCount || 1;
  const hasTimeOut = options.hasTimeOut !== undefined ? options.hasTimeOut : true;
  const proposalStatus = options.proposalStatus || 'approved';
  const enablePayables = options.enablePayables !== undefined ? options.enablePayables : chosenPreset.fee > 0;
  const ticketFee = options.ticketFee !== undefined ? options.ticketFee : chosenPreset.fee;
  const expectedAttendees = options.expectedAttendees || (targetCourses.length > 0 ? 80 : 150);

  // Generate sessions adhering to gate pass mode
  const sessions: EventSession[] = [];
  const eventDateStr = nowDate.toISOString().split('T')[0];

  for (let i = 1; i <= sessionCount; i++) {
    const isMorning = i === 1;
    const sessDate = new Date(nowDate.getTime() + (i > 2 ? 86400000 : 0)).toISOString().split('T')[0];
    sessions.push({
      id: `sess_${Date.now()}_${i}`,
      title: sessionCount === 1 ? 'Main Session' : isMorning ? 'Morning Session' : `Afternoon Session (Day ${i > 2 ? 2 : 1})`,
      date: sessDate,
      startTime: isMorning ? '08:00' : '13:00',
      endTime: isMorning ? '12:00' : '17:00',
      timeInOpen: isMorning ? '07:30' : '12:30',
      timeInClose: isMorning ? '09:30' : '14:30',
      hasTimeOut,
      timeOutOpen: hasTimeOut ? (isMorning ? '11:30' : '16:30') : '',
      timeOutClose: hasTimeOut ? (isMorning ? '12:30' : '17:30') : '',
    });
  }

  // Generate Scanners
  const scannerOfficerName = `${getRandomItem(FIRST_NAMES_MALE)} ${getRandomItem(LAST_NAMES)}`;
  const scanners: EventScanner[] = [
    {
      id: `scan_${Date.now()}_1`,
      officerName: scannerOfficerName,
      officerUserId: `usr_${Date.now()}_1`,
      organizationId: chosenOrg.id,
      organizationName: chosenOrg.name,
      fullAccess: true,
      canCheckIn: true,
      canCheckOut: hasTimeOut,
      canViewList: true,
      canEditRecords: true,
      allowManualAttendance: true,
    },
  ];

  // Budget Items
  const budgetItems: BudgetLineItem[] = [
    { id: 'b_1', item: 'Venue & Audio-Visual Setup', description: 'Sound system, microphones, and projector', quantity: 1, unitCost: 1500, approvedAmount: 1500, status: 'approved' },
    { id: 'b_2', item: 'Resource Speaker Honorarium', description: 'Expert guest speaker token and honorarium', quantity: 1, unitCost: 3000, approvedAmount: 3000, status: 'approved' },
    { id: 'b_3', item: 'Event Materials & Badges', description: 'Participant badges, certificates, and kits', quantity: expectedAttendees, unitCost: 25, approvedAmount: expectedAttendees * 25, status: 'approved' },
  ];
  const totalApprovedBudget = budgetItems.reduce((acc, b) => acc + b.approvedAmount, 0);

  const docId = `test_evt_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
  const referenceId = `EVT-ADM-${yearStr}-${Math.floor(1000 + Math.random() * 9000)}`;
  const scannerActivationCode = Math.floor(100000 + Math.random() * 900000).toString();

  const eventDoc = cleanForFirestore<EventDocument>({
    id: docId,
    referenceId,
    title,
    tagline,
    description,
    objectives: [
      'Enhance practical skillsets aligned with industry standards.',
      'Foster student collaboration, engagement, and leadership.',
      'Provide experiential learning beyond the traditional classroom.',
    ],
    bannerImageUrl: null,
    isVisible: true,
    visibilityStart: null,
    eventTypeId: eventTypeObj.id,
    eventCategoryId: eventCategoryObj.id,
    hostingOrgId: chosenOrg.id,
    semesterId: activeSem?.id || 'sem_active',
    schoolYear: activeSem?.academicYear || '2026-2027',
    semester: activeSem?.semester || (isShs ? '1st Trimester' : '1st Semester'),
    academicLevel: isShs ? 'SHS' : 'COLLEGE',
    sessions,
    venueId: venueObj.id,
    customVenueName: venueObj.name,
    eventFormat: options.eventFormat || 'On-Campus',
    targetAudienceScope: targetCourses.length > 0 ? 'custom' : 'all',
    targetCourses,
    targetYearLevels,
    targetSections,
    expectedParticipantCount: expectedAttendees,
    expectedAttendees,
    actualAttendees: 0,
    attendeesCount: 0,
    attendanceEnabled: true,
    minAttendancePercent: 80,
    lateThresholdMinutes: 15,
    gracePeriodMinutes: 30,
    latePenaltyAmount: 20,
    certificatesEnabled: true,
    autoIssueCertificates: true,
    certificateSignatory: 'SAO Adviser & Organization President',
    studentPayablesEnabled: enablePayables,
    suggestedFeePerStudent: enablePayables ? ticketFee : 0,
    adminFeeOverride: enablePayables ? ticketFee : 0,
    totalExpectedCollection: enablePayables ? ticketFee * expectedAttendees : 0,
    supervisorId: 'sao_adviser_admin',
    scanners,
    scannerUserIds: scanners.map((s) => s.officerUserId).filter(Boolean) as string[],
    scannerActivationCode,
    budgetItems,
    totalApprovedBudget,
    documents: [],
    enableQRTickets: true,
    mandatoryAttendance: false,
    lockAfterApproval: false,
    proposalStatus,
    status: proposalStatus === 'approved' ? 'Upcoming' : 'Draft',
    createdBy: 'dev_test_seeder',
    approvedBy: proposalStatus === 'approved' ? 'SAO Head Adviser' : null,
    approvedAt: proposalStatus === 'approved' ? now : null,
    createdAt: now,
    updatedAt: now,
    isTestData: true,
  } as any);

  // 1. Write Event Document
  await setDoc(doc(db, EVENTS_COLLECTION, docId), eventDoc);

  // 2. If payables enabled and approved, trigger payable generation for registered students
  if (proposalStatus === 'approved' && enablePayables && ticketFee > 0) {
    try {
      await generatePayablesForEvent(eventDoc, docId, 'dev_test_seeder');
    } catch (payErr) {
      console.warn('[seedSampleEvent] Could not auto-generate student payables:', payErr);
    }
  }

  return eventDoc;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. REALISTIC STUDENT REGISTRY SEEDER
// ═══════════════════════════════════════════════════════════════════════════════

export interface SeedStudentOptions {
  count: number;
  track?: 'COLLEGE' | 'SHS' | 'MIXED';
  courseCode?: string;
  yearLevel?: StudentYearLevel;
  section?: string;
  schoolYear?: string;
  semester?: StudentSemester;
}

export async function seedSampleStudents(options: SeedStudentOptions): Promise<StudentDocument[]> {
  const {
    count = 10,
    track = 'MIXED',
    courseCode,
    yearLevel,
    section,
  } = options;

  let dbCourses: any[] = [];
  let dbDepartments: any[] = [];
  let dbSections: any[] = [];
  let activeCollegeSem: any = null;
  let activeShsSem: any = null;

  try {
    const [coursesSnap, deptSnap, secSnap, semSnap] = await Promise.all([
      getDocs(query(collection(db, COURSES_COLLECTION), where('archived', '==', false))),
      getDocs(query(collection(db, DEPARTMENTS_COLLECTION), where('archived', '==', false))),
      getDocs(query(collection(db, SECTIONS_COLLECTION), where('archived', '==', false))),
      getDocs(query(collection(db, SEMESTERS_COLLECTION), where('status', '==', 'ACTIVE'))),
    ]);

    dbCourses = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    dbDepartments = deptSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    dbSections = secSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    semSnap.docs.forEach((d) => {
      const sem = { id: d.id, ...d.data() } as any;
      if (sem.academicLevel === 'SHS' || String(sem.semester).includes('Trimester')) {
        activeShsSem = sem;
      } else {
        activeCollegeSem = sem;
      }
    });
  } catch (err) {
    console.warn('[seedSampleStudents] Could not fetch live academic settings, using defaults:', err);
  }

  const fallbackCollegeCourses = [
    { id: 'course_bsit', code: 'BSIT', name: 'Bachelor of Science in Information Technology', departmentId: 'dept_it', departmentName: 'Information Technology', academicLevel: 'COLLEGE' },
    { id: 'course_bscs', code: 'BSCS', name: 'Bachelor of Science in Computer Science', departmentId: 'dept_it', departmentName: 'Information Technology', academicLevel: 'COLLEGE' },
    { id: 'course_bshm', code: 'BSHM', name: 'Bachelor of Science in Hospitality Management', departmentId: 'dept_thm', departmentName: 'Tourism & Hospitality', academicLevel: 'COLLEGE' },
    { id: 'course_bsba', code: 'BSBA', name: 'Bachelor of Science in Business Administration', departmentId: 'dept_ba', departmentName: 'Business Administration', academicLevel: 'COLLEGE' },
  ];

  const fallbackShsCourses = [
    { id: 'course_stem', code: 'STEM', name: 'Science, Technology, Engineering, and Mathematics', departmentId: 'dept_shs', departmentName: 'Senior High School', academicLevel: 'SHS' },
    { id: 'course_abm', code: 'ABM', name: 'Accountancy, Business, and Management', departmentId: 'dept_shs', departmentName: 'Senior High School', academicLevel: 'SHS' },
    { id: 'course_humss', code: 'HUMSS', name: 'Humanities and Social Sciences', departmentId: 'dept_shs', departmentName: 'Senior High School', academicLevel: 'SHS' },
  ];

  const availableCollegeCourses = dbCourses.filter((c) => c.academicLevel !== 'SHS').length > 0
    ? dbCourses.filter((c) => c.academicLevel !== 'SHS')
    : fallbackCollegeCourses;

  const availableShsCourses = dbCourses.filter((c) => c.academicLevel === 'SHS').length > 0
    ? dbCourses.filter((c) => c.academicLevel === 'SHS')
    : fallbackShsCourses;

  const createdStudents: StudentDocument[] = [];
  const usedNames = new Set<string>();
  const now = Timestamp.now();

  for (let i = 0; i < count; i++) {
    const isMale = Math.random() > 0.5;
    let firstName = isMale ? getRandomItem(FIRST_NAMES_MALE) : getRandomItem(FIRST_NAMES_FEMALE);
    let lastName = getRandomItem(LAST_NAMES);
    let middleName = getRandomItem(MIDDLE_NAMES);
    let fullNameKey = `${firstName} ${middleName} ${lastName}`.toLowerCase();

    let attempts = 0;
    while (usedNames.has(fullNameKey) && attempts < 10) {
      firstName = isMale ? getRandomItem(FIRST_NAMES_MALE) : getRandomItem(FIRST_NAMES_FEMALE);
      lastName = getRandomItem(LAST_NAMES);
      fullNameKey = `${firstName} ${middleName} ${lastName}`.toLowerCase();
      attempts++;
    }
    usedNames.add(fullNameKey);

    const selectedTrack: AcademicLevel =
      track === 'MIXED' ? (Math.random() > 0.4 ? 'COLLEGE' : 'SHS') : track;

    const coursePool = selectedTrack === 'COLLEGE' ? availableCollegeCourses : availableShsCourses;
    const courseObj =
      (courseCode ? coursePool.find((c) => c.code === courseCode) : null) || getRandomItem(coursePool);

    const selectedYear: StudentYearLevel =
      yearLevel ||
      (selectedTrack === 'COLLEGE'
        ? (getRandomItem(['1st Year', '2nd Year', '3rd Year', '4th Year']) as StudentYearLevel)
        : (getRandomItem(['Grade 11', 'Grade 12']) as StudentYearLevel));

    const matchingSections = dbSections.filter(
      (s) => s.courseId === courseObj.id || s.courseCode === courseObj.code
    );
    const selectedSection =
      section ||
      (matchingSections.length > 0
        ? getRandomItem(matchingSections).name
        : selectedTrack === 'COLLEGE'
        ? `${courseObj.code} ${selectedYear.charAt(0)}0${Math.floor(1 + Math.random() * 3)}`
        : `${courseObj.code} ${selectedYear.replace('Grade ', '')}-${String.fromCharCode(65 + Math.floor(Math.random() * 3))}`);

    const activeSemDoc = selectedTrack === 'SHS' ? activeShsSem : activeCollegeSem;
    const schoolYear = options.schoolYear || activeSemDoc?.academicYear || '2026-2027';
    const semester: StudentSemester =
      options.semester || activeSemDoc?.semester || (selectedTrack === 'SHS' ? '1st Trimester' : '1st Semester');

    const studentIdNumber = generateRandomStudentId();
    const docId = `test_std_${studentIdNumber}`;

    const studentDoc = cleanForFirestore<StudentDocument>({
      id: docId,
      studentId: studentIdNumber,
      firstName,
      lastName,
      middleName,
      dateOfBirth: `200${Math.floor(3 + Math.random() * 4)}-0${Math.floor(1 + Math.random() * 9)}-15`,
      sex: isMale ? 'Male' : 'Female',
      contactNumber: `09${Math.floor(100000000 + Math.random() * 900000000)}`,
      academicLevel: selectedTrack,
      courseId: courseObj.id || `course_${courseObj.code.toLowerCase()}`,
      courseCode: courseObj.code,
      courseName: courseObj.name,
      departmentId: courseObj.departmentId || courseObj.deptId || 'dept_general',
      departmentName: courseObj.departmentName || courseObj.deptName || 'Academic Department',
      yearLevel: selectedYear,
      section: selectedSection,
      schoolYear,
      semester,
      term: semester,
      email: `${firstName.toLowerCase().replace(/\s+/g, '')}.${lastName.toLowerCase().replace(/\s+/g, '')}${Math.floor(Math.random() * 999)}@ormoc.sti.edu.ph`,
      authUid: `auth_${docId}`,
      requiresPasswordChange: false,
      requiresChangePassword: false,
      profilePhotoUrl: '',
      schoolIdPhotoUrl: '',
      status: 'ACTIVE',
      registrationSource: 'MANUAL',
      addedBy: 'dev_test_seeder',
      createdAt: now,
      updatedAt: now,
      isTestData: true,
    } as any);

    await setDoc(doc(db, 'students', docId), studentDoc);
    createdStudents.push(studentDoc);

    try {
      await syncStudentPayablesForActiveEvents(studentDoc, 'dev_test_seeder');
    } catch (paySyncErr) {
      console.warn(`[seedSampleStudents] Could not auto-sync payables for ${studentIdNumber}:`, paySyncErr);
    }
  }

  return createdStudents;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. TARGET-RESTRICTED & REAL GATEPASS SESSION ATTENDANCE SEEDER
// ═══════════════════════════════════════════════════════════════════════════════

export interface SeedAttendanceOptions {
  event: EventDocument;
  students: StudentDocument[];
  sessionId?: string;
  attendanceRate?: number;
  scannerName?: string;
  strictTargeting?: boolean;
}

export async function seedEventAttendance(options: SeedAttendanceOptions): Promise<{
  totalInjected: number;
  attendees: number;
  sessionsCount: number;
  skippedNonTargeted: number;
}> {
  const {
    event,
    students,
    sessionId = 'ALL',
    attendanceRate = 85,
    scannerName = 'Lead Scanner Officer',
    strictTargeting = true,
  } = options;

  if (!event || !event.id) {
    throw new Error('Valid Event is required for attendance seeding.');
  }

  const eligibleStudents = strictTargeting
    ? students.filter((s) => isStudentEligibleForEvent(event, s))
    : students;

  const skippedCount = students.length - eligibleStudents.length;

  if (eligibleStudents.length === 0) {
    throw new Error(
      `None of the provided ${students.length} students match the event targeting criteria (Track: ${event.academicLevel || 'All'}, Courses: ${(event.targetCourses || []).join(', ') || 'All'}, Year: ${(event.targetYearLevels || []).join(', ') || 'All'}). Generate matching students first!`
    );
  }

  const eventSessions: EventSession[] =
    event.sessions && event.sessions.length > 0
      ? event.sessions
      : [
          {
            id: 'sess_main',
            title: 'Main Session',
            date: new Date().toISOString().split('T')[0],
            startTime: '08:00',
            endTime: '12:00',
            timeInOpen: '07:30',
            timeInClose: '09:00',
            hasTimeOut: true,
            timeOutOpen: '11:30',
            timeOutClose: '12:30',
          },
        ];

  const sessionsToProcess =
    sessionId === 'ALL'
      ? eventSessions
      : eventSessions.filter((s) => s.id === sessionId);

  if (sessionsToProcess.length === 0) {
    throw new Error(`Selected session "${sessionId}" not found in event.`);
  }

  let totalInjected = 0;
  let uniqueAttendees = new Set<string>();

  for (const session of sessionsToProcess) {
    const sessionDate = session.date ? new Date(session.date) : new Date();
    const hasTimeOut = session.hasTimeOut !== false;

    for (const student of eligibleStudents) {
      const isAttending = Math.random() * 100 <= attendanceRate;
      const isLate = isAttending && Math.random() < 0.15;

      let status: AttendanceStatus;
      if (!isAttending) {
        status = 'Absent';
      } else if (isLate) {
        status = 'Late';
      } else if (!hasTimeOut) {
        status = 'Checked In';
      } else {
        status = 'Complete';
      }

      if (isAttending) {
        uniqueAttendees.add(student.studentId);
      }

      const baseHour = session.startTime ? parseInt(session.startTime.split(':')[0], 10) : 8;
      const checkInHour = isLate ? baseHour + 1 : baseHour;
      const checkInMin = Math.floor(5 + Math.random() * 45);
      const checkInAmPm = checkInHour >= 12 ? 'PM' : 'AM';
      const formattedCheckInHour = checkInHour > 12 ? checkInHour - 12 : checkInHour === 0 ? 12 : checkInHour;
      const checkInStr = isAttending
        ? `${String(formattedCheckInHour).padStart(2, '0')}:${String(checkInMin).padStart(2, '0')} ${checkInAmPm}`
        : '—';

      let checkOutStr = '—';
      if (hasTimeOut && isAttending) {
        const endHour = session.endTime ? parseInt(session.endTime.split(':')[0], 10) : 12;
        const checkOutMin = Math.floor(10 + Math.random() * 45);
        const checkOutAmPm = endHour >= 12 ? 'PM' : 'AM';
        const formattedEndHour = endHour > 12 ? endHour - 12 : endHour === 0 ? 12 : endHour;
        checkOutStr = `${String(formattedEndHour).padStart(2, '0')}:${String(checkOutMin).padStart(2, '0')} ${checkOutAmPm}`;
      }

      const recordId = `test_att_${event.id}_${session.id}_${student.studentId}`;
      const topAttendanceRef = doc(db, ATTENDANCE_COLLECTION, recordId);
      const eventSubAttendanceRef = doc(db, 'events', event.id, 'attendance_logs', recordId);

      const recordData = cleanForFirestore<any>({
        id: recordId,
        studentId: student.studentId || '',
        name: `${student.lastName || ''}, ${student.firstName || ''} ${student.middleName || ''}`.trim(),
        studentSchoolId: student.studentId || '',
        studentName: `${student.lastName || ''}, ${student.firstName || ''}`.trim(),
        courseCode: student.courseCode || '',
        yearLevel: student.yearLevel || '',
        section: student.section || '',
        org: event.hostingOrgId || event.organizationId || 'STI Council',
        eventId: event.id,
        event: event.title,
        eventName: event.title,
        sessionId: session.id,
        sessionTitle: session.title || 'Main Session',
        hasTimeOut,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        status,
        scannedBy: 'dev_scanner_uid',
        scannedByName: scannerName,
        createdAt: Timestamp.fromDate(sessionDate),
        scannedAt: Timestamp.fromDate(sessionDate),
        isTestData: true,
      });

      await Promise.all([
        setDoc(topAttendanceRef, recordData),
        setDoc(eventSubAttendanceRef, recordData),
      ]);

      totalInjected++;
    }
  }

  const totalActual = uniqueAttendees.size;
  try {
    const eventRef = doc(db, 'events', event.id);
    await updateDoc(eventRef, {
      actualAttendees: totalActual,
      attendeesCount: totalActual,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not update event actualAttendees count:', err);
  }

  return {
    totalInjected,
    attendees: totalActual,
    sessionsCount: sessionsToProcess.length,
    skippedNonTargeted: skippedCount,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. FINANCE & PAYABLES SEEDER
// ═══════════════════════════════════════════════════════════════════════════════

export interface SeedPayablesOptions {
  organizationId: string;
  organizationName: string;
  students: StudentDocument[];
  title: string;
  amount: number;
  type: PayableType;
  eventId?: string;
  paidPercentage?: number;
}

export async function seedPayables(options: SeedPayablesOptions): Promise<{ total: number; paid: number; unpaid: number }> {
  const {
    organizationId,
    organizationName,
    students,
    title,
    amount = 150,
    type = 'event_fee',
    eventId,
    paidPercentage = 75,
  } = options;

  let paidCount = 0;
  let unpaidCount = 0;
  const now = Timestamp.now();

  for (const student of students) {
    const isPaid = Math.random() * 100 <= paidPercentage;
    if (isPaid) paidCount++;
    else unpaidCount++;

    const docId = `test_pay_${student.studentId}_${type}_${Math.floor(Math.random() * 9999)}`;
    const payDoc = cleanForFirestore<any>({
      id: docId,
      studentId: student.studentId || '',
      studentName: `${student.lastName || ''}, ${student.firstName || ''}`.trim(),
      studentSchoolId: student.studentId || '',
      organizationId: organizationId || 'org_general',
      organizationName: organizationName || 'Student Organization',
      title: title || 'Payable Fee',
      feeTitle: title || 'Payable Fee',
      type: type || 'dues',
      amount: Number(amount) || 0,
      status: isPaid ? 'paid' : 'pending',
      paymentStatus: isPaid ? 'PAID' : 'UNPAID',
      paidAmount: isPaid ? Number(amount) : 0,
      assignedAmount: Number(amount) || 0,
      paidAt: isPaid ? now : null,
      paymentMethod: isPaid ? 'cash' : null,
      eventId: eventId ? eventId : null,
      courseCode: student.courseCode || '',
      yearLevel: student.yearLevel || '',
      section: student.section || '',
      academicLevel: student.academicLevel || 'COLLEGE',
      schoolYear: student.schoolYear || '2026-2027',
      semester: student.semester || '1st Semester',
      createdAt: now,
      updatedAt: now,
      isTestData: true,
    });

    await setDoc(doc(db, PAYABLES_COLLECTION, docId), payDoc);
  }

  return { total: students.length, paid: paidCount, unpaid: unpaidCount };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PURGE TEST DATA
// ═══════════════════════════════════════════════════════════════════════════════

export async function clearAllTestData(): Promise<{
  students: number;
  events: number;
  attendance: number;
  payables: number;
}> {
  let studentCount = 0;
  let eventCount = 0;
  let attCount = 0;
  let payCount = 0;

  // 1. Students
  const stdSnap = await getDocs(query(collection(db, 'students'), where('isTestData', '==', true)));
  for (const d of stdSnap.docs) {
    await deleteDoc(d.ref);
    studentCount++;
  }

  // 2. Events
  const evtSnap = await getDocs(query(collection(db, EVENTS_COLLECTION), where('isTestData', '==', true)));
  for (const d of evtSnap.docs) {
    await deleteDoc(d.ref);
    eventCount++;
  }

  // 3. Attendance
  const attSnap = await getDocs(query(collection(db, ATTENDANCE_COLLECTION), where('isTestData', '==', true)));
  for (const d of attSnap.docs) {
    await deleteDoc(d.ref);
    attCount++;
  }

  // 4. Payables
  const paySnap = await getDocs(query(collection(db, PAYABLES_COLLECTION), where('isTestData', '==', true)));
  for (const d of paySnap.docs) {
    await deleteDoc(d.ref);
    payCount++;
  }

  return { students: studentCount, events: eventCount, attendance: attCount, payables: payCount };
}
