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

async function check() {
  const eventsSnap = await getDocs(collection(db, 'events'));
  let targetEvent = null;
  eventsSnap.forEach(d => {
    if (d.data().title?.toLowerCase().includes('grace period')) {
      targetEvent = { id: d.id, ...d.data() };
    }
  });

  const attSnap = await getDocs(query(collection(db, 'attendance'), where('eventId', '==', targetEvent.id)));
  console.log(`\n=== Total Attendance Records for Grace Period: ${attSnap.size} ===`);
  attSnap.forEach(d => {
    const data = d.data();
    console.log(`- ${data.name} (${data.studentId}) | Status: ${data.status} | Session: ${data.sessionId}`);
  });
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
