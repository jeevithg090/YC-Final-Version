import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Firebase Console Action: Enable Cloud Vision API for SmartBillSplitter OCR functionality
// Visit: https://console.developers.google.com/apis/api/vision.googleapis.com/overview
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? ''
};

// Initialize Firebase - check if app already exists to prevent duplicate initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Export Firestore database for cloud-based data storage (for marketplace)
export const db = getFirestore(app);

// Export Realtime Database for existing features (weather, mess, notifications)
export const realtimeDb = getDatabase(app);

// Export Storage for file uploads
export const storage = getStorage(app);

// Export Auth for authentication
export const auth = getAuth(app);

// Firebase Console Actions needed:
/*
IMPORTANT: Firebase Storage Setup Required!

1. ✅ Firebase project created at https://console.firebase.google.com/
2. ✅ Updated storageBucket URL to: yogo-campus.firebasestorage.app

3. Enable Firebase Storage:
   - Go to Firebase Console > Storage
   - Click "Get started"
   - Choose "Start in test mode" or configure rules

4. Set up Firebase Storage security rules:
   Go to Firebase Console > Storage > Rules tab
   Replace the default rules with:

4. Set up Firebase Storage security rules:
   Go to Firebase Console > Storage > Rules tab
   Replace the default rules with:
    // Allow anyone to read files (for viewing images)
rules_version = '2';=**} {
service firebase.storage {
  match /b/{bucket}/o {
    // Allow anyone to read files (for viewing images)
    match /{allPaths=**} { users to upload to events folder
      allow read: if true;e} {
    } allow write: if true; // Change to proper auth when available: request.auth != null
    }
    // Allow authenticated users to upload to events folder
    match /events/{filename} {rs to upload to other folders
      allow write: if true; // Change to proper auth when available: request.auth != null
    } allow write: if true; // Change to proper auth when available: request.auth != null
    }
    // Allow authenticated users to upload to other folders
    match /{folder}/{filename} {
      allow write: if true; // Change to proper auth when available: request.auth != null
    }t up Firestore security rules (if not already done):
  }Go to Firebase Console > Firestore Database > Rules tab
}
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /events/{document} {
      allow read, write: if true; // Change to proper auth rules later
    }
    // ... other collection rules
  }
}

6. Test Storage connectivity in the Events feature before uploading
*/

// Firebase Console Actions for Timetable Features:

/*
1. ✅ Firebase project already created
2. ✅ Firestore database enabled
3. Update Firestore security rules to include timetable collections:

Add to your Firestore rules:
    // Timetable collections
    match /extracted_timetables/{document} {
      allow read, write: if true; // Change to proper auth rules when authentication is added
    }
    
    match /notification_settings/{document} {
      allow read, write: if true; // Change to proper auth rules when authentication is added
    }

4. The following collections will be auto-created when first used:
   - extracted_timetables: Stores AI-processed timetable data
   - notification_settings: Stores user notification preferences
*/

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
