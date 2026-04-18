import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };

    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  } catch {
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON");
  }
}

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedMessaging: Messaging | null = null;

function getAdminApp() {
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length > 0 ? getApps()[0] : null;
  if (!cachedApp) {
    const serviceAccount = getServiceAccount();
    cachedApp = initializeApp({
      credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    });
  }
  return cachedApp;
}

export function getAdminAuth() {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getAdminApp());
  return cachedAuth;
}

export function getAdminDb() {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getAdminApp());
  return cachedDb;
}

export function getAdminMessaging() {
  if (cachedMessaging) return cachedMessaging;
  cachedMessaging = getMessaging(getAdminApp());
  return cachedMessaging;
}
