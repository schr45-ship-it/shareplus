import {
  addDoc,
  collection,
  doc,
  getFirestore,
  getDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";

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
let cachedDb: Firestore | null = null;

function getClientApp() {
  if (cachedApp) return cachedApp;
  if (typeof window === "undefined") {
    throw new Error("Firestore client SDK was accessed on the server");
  }
  cachedApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return cachedApp;
}

export function getClientDb(): Firestore {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getClientApp());
  return cachedDb;
}

export async function createStation(input: {
  title: string;
  city: string;
  region: string;
  connectorType: string;
  powerKw: number;
  street: string;
  location?: { lat: number; lng: number };
  hostPhone: string;
  hostName: string;
  notes: string;
  hoursStart: string;
  hoursEnd: string;
  availability: Array<{ dayKey: string; enabled: boolean; start: string; end: string }>;
  ownerUid: string;
  pricingType: string;
  priceIls: number;
  priceNote?: string;
}) {
  const db = getClientDb();
  const ref = await addDoc(collection(db, "stations"), {
    ...input,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return ref.id;
}

export type StationDoc = {
  title: string;
  city: string;
  region: string;
  connectorType: string;
  powerKw: number;
  street: string;
  exactAddress?: string;
  location?: { lat: number; lng: number };
  hostPhone: string;
  hostName: string;
  notes: string;
  hoursStart: string;
  hoursEnd: string;
  availability?: Array<{ dayKey: string; enabled: boolean; start: string; end: string }>;
  ownerUid?: string;
  pricingType?: string;
  priceIls?: number;
  priceNote?: string;
};

export async function getStation(stationId: string) {
  const db = getClientDb();
  const snap = await getDoc(doc(db, "stations", stationId));
  if (!snap.exists()) return null;
  return { id: snap.id, data: snap.data() as StationDoc };
}

export async function updateStation(
  stationId: string,
  patch: Partial<Omit<StationDoc, "ownerUid">>
) {
  const db = getClientDb();
  await updateDoc(doc(db, "stations", stationId), {
    ...patch,
    updatedAt: new Date(),
  });
}
