import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, serverTimestamp, query, where } from 'firebase/firestore';
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
  const eventsSnap = await getDocs(collection(db, 'events'));
  let targetEvent = null;
  eventsSnap.forEach(d => {
    if (d.data().title?.toLowerCase().includes('grace period')) {
      targetEvent = { id: d.id, ...d.data() };
    }
  });

  if (!targetEvent) {
    console.log('Event Grace Period not found.');
    process.exit(1);
  }

  const studentsSnap = await getDocs(collection(db, 'students'));
  const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const eligible = allStudents.filter(s => {
    if (targetEvent.targetCourses && targetEvent.targetCourses.length > 0) {
      return targetEvent.targetCourses.some(c => c === s.courseId || c === s.courseCode);
    }
    return true;
  });

  console.log(`Eligible students: ${eligible.length}`);

  const attSnap = await getDocs(query(collection(db, 'attendance'), where('eventId', '==', targetEvent.id)));
  const existing = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Existing attendance records in Firestore: ${existing.length}`);

  const batch = writeBatch(db);
  let added = 0;
  const sId = targetEvent.sessions?.[0]?.id || '1790526954844';

  eligible.forEach(s => {
    const has = existing.some(r => r.studentId === s.studentId || r.studentId === s.id || r.studentAuthUid === s.authUid);
    if (!has) {
      const newRef = doc(collection(db, 'attendance'));
      batch.set(newRef, {
        studentId: s.studentId || s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        org: 'Student Affairs and Services (SAS)',
        eventId: targetEvent.id,
        event: targetEvent.title,
        sessionId: sId,
        checkIn: '—',
        checkOut: '—',
        status: 'Absent',
        createdAt: serverTimestamp()
      });
      added++;
    }
  });

  if (added > 0) {
    await batch.commit();
    console.log(`Successfully synced ${added} absent student records into Firestore!`);
  } else {
    console.log('All eligible students already have attendance records in Firestore.');
  }

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
