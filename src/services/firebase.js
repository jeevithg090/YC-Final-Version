"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteObject = exports.getDownloadURL = exports.uploadBytes = exports.storageRef = exports.off = exports.get = exports.remove = exports.push = exports.set = exports.onValue = exports.ref = exports.Timestamp = exports.serverTimestamp = exports.onSnapshot = exports.limit = exports.orderBy = exports.where = exports.query = exports.deleteDoc = exports.updateDoc = exports.getDocs = exports.getDoc = exports.setDoc = exports.addDoc = exports.doc = exports.collection = exports.app = exports.storage = exports.realtimeDb = exports.db = void 0;
var app_1 = require("firebase/app");
var firestore_1 = require("firebase/firestore");
var database_1 = require("firebase/database");
var storage_1 = require("firebase/storage");
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Firebase Console Action: Enable Cloud Vision API for SmartBillSplitter OCR functionality
// Visit: https://console.developers.google.com/apis/api/vision.googleapis.com/overview
var firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || ''
};
// Initialize Firebase - check if app already exists to prevent duplicate initialization
var app = (0, app_1.getApps)().length === 0 ? (0, app_1.initializeApp)(firebaseConfig) : (0, app_1.getApp)();
exports.app = app;
// Export Firestore database for cloud-based data storage (for marketplace)
exports.db = (0, firestore_1.getFirestore)(app);
// Export Realtime Database for existing features (weather, mess, notifications)
exports.realtimeDb = (0, database_1.getDatabase)(app);
// Export Storage for file uploads
exports.storage = (0, storage_1.getStorage)(app);
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
exports.default = app;
// Re-export Firestore functions for easier imports
var firestore_2 = require("firebase/firestore");
Object.defineProperty(exports, "collection", { enumerable: true, get: function () { return firestore_2.collection; } });
Object.defineProperty(exports, "doc", { enumerable: true, get: function () { return firestore_2.doc; } });
Object.defineProperty(exports, "addDoc", { enumerable: true, get: function () { return firestore_2.addDoc; } });
Object.defineProperty(exports, "setDoc", { enumerable: true, get: function () { return firestore_2.setDoc; } });
Object.defineProperty(exports, "getDoc", { enumerable: true, get: function () { return firestore_2.getDoc; } });
Object.defineProperty(exports, "getDocs", { enumerable: true, get: function () { return firestore_2.getDocs; } });
Object.defineProperty(exports, "updateDoc", { enumerable: true, get: function () { return firestore_2.updateDoc; } });
Object.defineProperty(exports, "deleteDoc", { enumerable: true, get: function () { return firestore_2.deleteDoc; } });
Object.defineProperty(exports, "query", { enumerable: true, get: function () { return firestore_2.query; } });
Object.defineProperty(exports, "where", { enumerable: true, get: function () { return firestore_2.where; } });
Object.defineProperty(exports, "orderBy", { enumerable: true, get: function () { return firestore_2.orderBy; } });
Object.defineProperty(exports, "limit", { enumerable: true, get: function () { return firestore_2.limit; } });
Object.defineProperty(exports, "onSnapshot", { enumerable: true, get: function () { return firestore_2.onSnapshot; } });
Object.defineProperty(exports, "serverTimestamp", { enumerable: true, get: function () { return firestore_2.serverTimestamp; } });
Object.defineProperty(exports, "Timestamp", { enumerable: true, get: function () { return firestore_2.Timestamp; } });
// Re-export Realtime Database functions (for existing features)
var database_2 = require("firebase/database");
Object.defineProperty(exports, "ref", { enumerable: true, get: function () { return database_2.ref; } });
Object.defineProperty(exports, "onValue", { enumerable: true, get: function () { return database_2.onValue; } });
Object.defineProperty(exports, "set", { enumerable: true, get: function () { return database_2.set; } });
Object.defineProperty(exports, "push", { enumerable: true, get: function () { return database_2.push; } });
Object.defineProperty(exports, "remove", { enumerable: true, get: function () { return database_2.remove; } });
Object.defineProperty(exports, "get", { enumerable: true, get: function () { return database_2.get; } });
Object.defineProperty(exports, "off", { enumerable: true, get: function () { return database_2.off; } });
// Re-export Storage functions
var storage_2 = require("firebase/storage");
Object.defineProperty(exports, "storageRef", { enumerable: true, get: function () { return storage_2.ref; } });
Object.defineProperty(exports, "uploadBytes", { enumerable: true, get: function () { return storage_2.uploadBytes; } });
Object.defineProperty(exports, "getDownloadURL", { enumerable: true, get: function () { return storage_2.getDownloadURL; } });
Object.defineProperty(exports, "deleteObject", { enumerable: true, get: function () { return storage_2.deleteObject; } });
