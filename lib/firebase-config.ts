'use client';

import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore'

// Types for our database schema
export interface Member {
  member_id: string;
  first_name: string;
  last_name: string;
  dob: Date;
  id_number: string;
  member_type: 'Main' | 'Dependent' | 'Beneficiary';
  created_at: Date;
  updated_at: Date;
}

export interface Contact {
  contact_id: string;
  member_id: string;
  email: string;
  phone: string;
  created_at: Date;
}

export interface Address {
  address_id: string;
  member_id: string;
  street: string;
  city: string;
  state: string;
  postal_code: string;
  created_at: Date;
}

export interface Contract {
  contract_id: string;
  contract_name: string;
  start_date: Date;
  end_date: Date;
  created_at: Date;
}

export interface ContractMember {
  contract_member_id: string;
  contract_id: string;
  member_id: string;
  role: 'Main Member' | 'Dependent' | 'Beneficiary';
  created_at: Date;
}

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

let app;
let auth;
let db: Firestore | undefined;

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