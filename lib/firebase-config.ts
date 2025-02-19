'use client';

import { initializeApp, getApps, getApp, FirebaseApp, FirebaseOptions } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'

type FirebaseConfigKeys = 'apiKey' | 'authDomain' | 'projectId' | 'storageBucket' | 'messagingSenderId' | 'appId' | 'databaseURL';

interface FirebaseConfig extends Record<FirebaseConfigKeys, string> {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL: string;
}

// Validate Firebase configuration
const validateConfig = () => {
  const config: FirebaseConfig = {
    apiKey: "AIzaSyDCXIw7LJkOXlF3a4MTZA3kA3Q46gARpWU",
    authDomain: "data-b93ed.firebaseapp.com",
    projectId: "data-b93ed",
    storageBucket: "data-b93ed.appspot.com",
    messagingSenderId: "218236841715",
    appId: "1:218236841715:web:f34737d3fa3bc759701186",
    databaseURL: "https://data-b93ed-default-rtdb.firebaseio.com",
  };

  // Check if all required fields are present
  const requiredFields: FirebaseConfigKeys[] = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missingFields = requiredFields.filter((field) => !config[field]);

  if (missingFields.length > 0) {
    throw new Error(`Missing required Firebase configuration fields: ${missingFields.join(', ')}`);
  }

  return config;
};

// Initialize Firebase with error handling
const initializeFirebase = () => {
  if (typeof window === 'undefined') {
    console.log('Firebase initialization skipped on server side');
    return { auth: null, db: null };
  }

  try {
    const config = validateConfig();
    console.log('Firebase configuration validated');

    let app: FirebaseApp;
    if (!getApps().length) {
      app = initializeApp(config);
      console.log('New Firebase app initialized');
    } else {
      app = getApp();
      console.log('Existing Firebase app retrieved');
    }

    const auth = getAuth(app);
    const db = getFirestore(app);

    // Verify auth initialization
    if (!auth) {
      throw new Error('Firebase Auth failed to initialize');
    }

    // Verify db initialization
    if (!db) {
      throw new Error('Firestore failed to initialize');
    }

    console.log('Firebase services initialized successfully');
    return { auth, db };
  } catch (error) {
    console.error('Firebase initialization error:', error);
    // Log detailed error information
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    return { auth: null, db: null };
  }
};

let firebaseInstance = {
  auth: null as Auth | null,
  db: null as Firestore | null
};

// Only initialize if we're on the client side
if (typeof window !== 'undefined') {
  firebaseInstance = initializeFirebase();
}

export const { auth, db } = firebaseInstance; 