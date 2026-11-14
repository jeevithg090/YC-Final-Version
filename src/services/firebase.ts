import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getAuth, initializeAuth, type Auth, type Persistence } from 'firebase/auth';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { readFirebaseConfig } from '../config/firebaseConfig';

// Each variable is referenced explicitly so Expo can inline it at build time.
const firebaseConfig = readFirebaseConfig({
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_DATABASE_URL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
});

/** `false` when required `EXPO_PUBLIC_FIREBASE_*` variables are missing. */
export const isFirebaseConfigured = firebaseConfig.isConfigured;
/** Names of the missing required Firebase environment variables. */
export const missingFirebaseEnvVars = firebaseConfig.missing;

if (!isFirebaseConfigured) {
  console.warn(`Firebase is not configured. Missing: ${missingFirebaseEnvVars.join(', ')}`);
}

// Initialize Firebase - check if app already exists to prevent duplicate initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig.options) : getApp();

// Export Firestore database for cloud-based data storage (for marketplace)
export const db = getFirestore(app);

// Export Realtime Database for existing features (weather, mess, notifications)
export const realtimeDb = getDatabase(app);

// Export Storage for file uploads
export const storage = getStorage(app);

/**
 * On iOS/Android, persist the session in AsyncStorage so users stay signed in
 * across app restarts (the default React Native persistence is in-memory).
 * `getReactNativePersistence` only exists in Firebase's React Native build,
 * which Metro resolves on native platforms, so it is looked up at runtime.
 */
function createAuth(): Auth {
  if (Platform.OS === 'web') return getAuth(app);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getReactNativePersistence } = require('firebase/auth') as {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
  };
  if (!getReactNativePersistence) return getAuth(app);
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // initializeAuth throws if auth was already initialised (e.g. fast refresh).
    return getAuth(app);
  }
}

export const auth = createAuth();

// Export Firebase app instance
export default app;
export { app };

// Re-export Firestore functions for easier imports
export { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';

// Re-export Realtime Database functions (for existing features)
export { ref, onValue, set, push, remove, get, off } from 'firebase/database';

// Re-export Storage functions
export { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
