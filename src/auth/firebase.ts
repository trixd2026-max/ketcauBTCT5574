/**
 * Firebase config — project tinhketcau-btct-5574-24f5e
 * Bật Authentication → Sign-in method → Email/Password
 * Authorized domains: tinhketcau-btct-5574.vercel.app
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAP_8ZyLNc3XAOwwy3MVa6_jdzoDMYsYrg',
  authDomain: 'tinhketcau-btct-5574-24f5e.firebaseapp.com',
  projectId: 'tinhketcau-btct-5574-24f5e',
  storageBucket: 'tinhketcau-btct-5574-24f5e.firebasestorage.app',
  messagingSenderId: '307008571968',
  appId: '1:307008571968:web:8a625b4aec72bfa5052da5',
  measurementId: 'G-G09TMFT40M',
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (!app) app = initializeApp(firebaseConfig);
  if (!auth) auth = getAuth(app);
  return auth;
}

export async function firebaseLogin(email: string, password: string): Promise<User> {
  const a = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(a, email, password);
  return cred.user;
}

export async function firebaseRegister(email: string, password: string): Promise<User> {
  const a = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(a, email, password);
  return cred.user;
}

export async function firebaseLogout(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export function watchFirebaseUser(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), cb);
}
