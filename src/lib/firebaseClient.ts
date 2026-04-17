import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyDGdqwlq_oS_jlupgGnQdlacmcNB8puteI",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "shareplus1.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "shareplus1",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "shareplus1.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "222377089673",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:222377089673:web:7f7902e202bae6acc88458",
};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

function getClientApp() {
  if (cachedApp) return cachedApp;
  if (typeof window === "undefined") {
    throw new Error("Firebase client SDK was accessed on the server");
  }
  cachedApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return cachedApp;
}

export function getClientAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getClientApp());
  return cachedAuth;
}

export async function signInWithGoogle() {
  const auth = getClientAuth();
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}
