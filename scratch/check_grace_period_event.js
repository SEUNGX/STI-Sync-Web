import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
env.split(/\r?\n/).forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) envVars[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const app = initializeApp({
  apiKey: envVars.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.VITE_FIREBASE_APP_ID
});
const db = getFirestore(app);

async function run() {
  console.log('--- Searching for Event: Grace Period ---');
  const eventsSnap = await getDocs(collection(db, 'events'));
  let targetEvent = null;
  eventsSnap.forEach(d => {
    const data = d.data();
    if (data.title && data.title.toLowerCase().includes('grace period')) {
      targetEvent = { id: d.id, ...data };
    }
  });

  if (!targetEvent) {
    console.log('No event found matching "Grace Period". Here are all events:');
    eventsSnap.forEach(d => console.log(d.id, '=>', d.data().title));
    process.exit(0);
  }

  console.log('Found Event:', {
    id: targetEvent.id,
    title: targetEvent.title,
    proposalStatus: targetEvent.proposalStatus,
    targetAudienceScope: targetEvent.targetAudienceScope,
    targetDepartments: targetEvent.targetDepartments,
    targetCourses: targetEvent.targetCourses,
    targetYearLevels: targetEvent.targetYearLevels,
    targetSections: targetEvent.targetSections,
    expectedParticipantCount: targetEvent.expectedParticipantCount,
    sessions: targetEvent.sessions,
    studentPayablesEnabled: targetEvent.studentPayablesEnabled,
    defaultPenalty: targetEvent.defaultPenalty
  });

  // Fetch Attendance records for this event
  console.log('\n--- Fetching Attendance Records for Event ---');
  const attendanceSnap = await getDocs(collection(db, 'attendance'));
  const eventAttendance = [];
  attendanceSnap.forEach(d => {
    const data = d.data();
    if (data.eventId === targetEvent.id || data.event === targetEvent.title) {
      eventAttendance.push({ id: d.id, ...data });
    }
  });
  console.log(`Found ${eventAttendance.length} attendance records:`);
  eventAttendance.forEach(a => {
    console.log(`- Student: ${a.name || a.studentId} | Status: ${a.status} | CheckIn: ${a.checkIn} | CheckOut: ${a.checkOut} | Session: ${a.sessionId || a.sessionTitle}`);
  });

  // Fetch Payables for this event
  console.log('\n--- Fetching Payables for Event ---');
  const payablesSnap = await getDocs(collection(db, 'payables'));
  const eventPayables = [];
  payablesSnap.forEach(d => {
    const data = d.data();
    if (data.eventId === targetEvent.id) {
      eventPayables.push({ id: d.id, ...data });
    }
  });
  console.log(`Found ${eventPayables.length} payables for this event:`);
  eventPayables.forEach(p => {
    console.log(`- Payable: ${p.id} | Student: ${p.studentName || p.studentId} (${p.studentSchoolId || p.studentId}) | Type: ${p.type} | Amount: ${p.amount} | Status: ${p.status} | Desc: ${p.description}`);
  });

  // Fetch all students
  console.log('\n--- Checking Targeted Students ---');
  const studentsSnap = await getDocs(collection(db, 'students'));
  const allStudents = [];
  studentsSnap.forEach(d => allStudents.push({ id: d.id, ...d.data() }));

  console.log(`Total students in system: ${allStudents.length}`);
  
  // Filter eligible students based on target criteria
  const eligibleStudents = allStudents.filter(s => {
    if (targetEvent.targetYearLevels && targetEvent.targetYearLevels.length > 0) {
      if (!targetEvent.targetYearLevels.includes(s.yearLevel)) return false;
    }
    if (targetEvent.targetCourses && targetEvent.targetCourses.length > 0) {
      const matchCourse = targetEvent.targetCourses.some(c => c === s.courseId || c === s.courseCode);
      if (!matchCourse) return false;
    }
    if (targetEvent.targetSections && targetEvent.targetSections.length > 0) {
      const matchSection = targetEvent.targetSections.some(sec => sec === s.section || sec === s.sectionId);
      if (!matchSection) return false;
    }
    return true;
  });

  console.log(`Eligible targeted students count: ${eligibleStudents.length}`);
  console.log('Targeted students list:');
  eligibleStudents.forEach(s => {
    const hasAtt = eventAttendance.filter(a => a.studentId === s.studentId || a.studentId === s.id || a.studentAuthUid === s.authUid);
    const hasPay = eventPayables.filter(p => p.studentId === s.studentId || p.studentId === s.id || p.studentSchoolId === s.studentId || p.studentAuthUid === s.authUid);
    console.log(`- ${s.firstName} ${s.lastName} (${s.studentId}, ${s.courseCode || s.courseId} - ${s.yearLevel} - ${s.section}): AttendanceRecords=${hasAtt.length} (Statuses: ${hasAtt.map(a=>a.status).join(',')}), Payables=${hasPay.length} (Types: ${hasPay.map(p=>p.type+':'+p.amount).join(',')})`);
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
