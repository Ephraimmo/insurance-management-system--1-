import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDCXIw7LJkOXlF3a4MTZA3kA3Q46gARpWU",
  authDomain: "data-b93ed.firebaseapp.com",
  projectId: "data-b93ed",
  storageBucket: "data-b93ed.appspot.com",
  messagingSenderId: "218236841715",
  appId: "1:218236841715:web:f34737d3fa3bc759701186",
  databaseURL: "https://data-b93ed-default-rtdb.firebaseio.com",
}

let firebaseApp: FirebaseApp | undefined;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (typeof window !== 'undefined') {
  try {
    // Initialize Firebase
    if (!getApps().length) {
      firebaseApp = initializeApp(firebaseConfig);
      console.log('Firebase initialized successfully');
    } else {
      firebaseApp = getApp();
      console.log('Firebase app already initialized');
    }

    // Initialize Auth and Firestore
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    // Don't throw the error, just log it
    console.error('Firebase initialization failed. Some features may not work.');
  }
} else {
  // Server-side initialization (if needed)
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApp();
  }
}

export { firebaseApp as app, auth, db }; 