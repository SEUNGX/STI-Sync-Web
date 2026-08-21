/**
 * src/services/firebase.ts
 *
 * Firebase initialization engine — singleton pattern.
 * Import `db`, `auth`, `storage`, or `analytics` from here
 * in any module hook or service file.
 *
 * DO NOT call initializeApp() anywhere else in the codebase.
 * DO NOT import directly from "firebase/app" in component files.
 */

import { initializeApp, getApps, getApp, deleteApp } from "firebase/app";
import { getFirestore }                    from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getStorage }                      from "firebase/storage";
import { getAnalytics, isSupported }       from "firebase/analytics";

// ─── Firebase Project Configuration ───────────────────────────────────────────
export const firebaseConfig = {
  apiKey:            "AIzaSyCW-g385o-RT7GE_z-Q0FpMz9P5HR4LUuo",
  authDomain:        "sti-sync.firebaseapp.com",
  projectId:         "sti-sync",
  storageBucket:     "sti-sync.firebasestorage.app",
  messagingSenderId: "821083100323",
  appId:             "1:821083100323:web:b18bb485a6df1bb5d31b16",
  measurementId:     "G-51X2P4CQV7",
};

// ─── App Singleton ─────────────────────────────────────────────────────────────
// Guards against double-initialization in React strict mode / hot module reloads.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ─── Service Instances ─────────────────────────────────────────────────────────

/** Firestore database — use in all module hooks and services */
export const db = getFirestore(app);

/** Firebase Authentication */
export const auth = getAuth(app);

/** Firebase Storage — for event cover images, documents, certificate templates */
export const storage = getStorage(app);

/**
 * Creates a new Firebase Auth user account without disrupting the currently signed-in admin session.
 */
export const createSecondaryAuthUser = async (email: string, pass: string): Promise<string> => {
  const secondaryAppName = `SecondaryAuth-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim().toLowerCase(), pass);
    const uid = cred.user.uid;
    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);
    return uid;
  } catch (err: any) {
    await deleteApp(secondaryApp).catch(() => {});
    if (err?.code === 'auth/email-already-in-use') {
      console.info('[createSecondaryAuthUser] Email already registered in Firebase Auth.');
      return '';
    }
    throw err;
  }
};

/**
 * Firebase Analytics — conditionally initialized.
 * Analytics requires a browser environment (not SSR / Node).
 * Resolved as a Promise<Analytics | null> to handle unsupported environments gracefully.
 */
export const analyticsPromise = isSupported().then((supported) =>
  supported ? getAnalytics(app) : null
);

export default app;
