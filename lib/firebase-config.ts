'use client';

import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore } from 'firebase/firestore'

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyDCXIw7LJkOXlF3a4MTZA3kA3Q46gARpWU",
  authDomain: "data-b93ed.firebaseapp.com",
  projectId: "data-b93ed",
  storageBucket: "data-b93ed.appspot.com",
  messagingSenderId: "218236841715",
  appId: "1:218236841715:web:f34737d3fa3bc759701186",
  databaseURL: "https://data-b93ed-default-rtdb.firebaseio.com"
};

let app;
let auth;
let db;

if (typeof window !== 'undefined') {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      
      // Initialize Firestore with memory cache enabled
      db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        cacheSizeBytes: 1048576 // 1 MB
      });
      
      auth = getAuth(app);
      console.log('Firebase services initialized successfully');
    } else {
      app = getApp();
      db = getFirestore(app);
      auth = getAuth(app);
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    // Initialize with default values if there's an error
    if (!db) {
      app = getApp();
      db = getFirestore(app);
    }
    if (!auth) {
      auth = getAuth(app);
    }
  }
} else {
  console.log('Firebase initialization skipped on server side');
}

export { auth, db }; 