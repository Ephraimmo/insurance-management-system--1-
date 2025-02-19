import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDCXIw7LJkOXlF3a4MTZA3kA3Q46gARpWU",
  authDomain: "data-b93ed.firebaseapp.com",
  projectId: "data-b93ed",
  storageBucket: "data-b93ed.appspot.com",
  messagingSenderId: "218236841715",
  appId: "1:218236841715:web:f34737d3fa3bc759701186",
  databaseURL: "https://data-b93ed-default-rtdb.firebaseio.com",
}

// Initialize Firebase
let firebaseApp: FirebaseApp;

if (typeof window !== 'undefined') {
  try {
    if (!getApps().length) {
      firebaseApp = initializeApp(firebaseConfig);
      console.log('Firebase initialized successfully');
    } else {
      firebaseApp = getApp();
      console.log('Firebase app already initialized');
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
} else {
  // Server-side initialization (if needed)
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApp();
  }
}

const auth = typeof window !== 'undefined' ? getAuth(firebaseApp) : null;
const db = typeof window !== 'undefined' ? getFirestore(firebaseApp) : null;

export { firebaseApp as app, auth, db }; 