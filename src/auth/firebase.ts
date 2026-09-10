/**
 * Firebase config — project tinhketcau-btct-5574 (console.firebase.google.com).
 * Bật Authentication → Sign-in method → Email/Password trong Firebase Console.
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
  apiKey: 'AIzaSyBiarXXhmcw9zkMIpHkSL7M_qfJNxy8',
  authDomain: 'tinhketcau-btct-5574.firebaseapp.com',
  projectId: 'tinhketcau-btct-5574',
  storageBucket: 'tinhketcau-btct-5574.firebasestorage.app',
  messagingSenderId: '736134775994',
  appId: '1:736134775994:web:60928843a51bc1c2b6ee83',
  measurementId: 'G-3N869YBY8E',
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
