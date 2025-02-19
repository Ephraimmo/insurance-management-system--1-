'use client';

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDCXIw7LJkOXlF3a4MTZA3kA3Q46gARpWU",
  authDomain: "data-b93ed.firebaseapp.com",
  projectId: "data-b93ed",
  storageBucket: "data-b93ed.appspot.com",
  messagingSenderId: "218236841715",
  appId: "1:218236841715:web:f34737d3fa3bc759701186",
  databaseURL: "https://data-b93ed-default-rtdb.firebaseio.com"
};

// Initialize Firebase
function initializeFirebase() {
  if (typeof window === 'undefined') {
    return { auth: null, db: null };
  }

  let app;
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
      console.log('Firebase initialized successfully');
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      return { auth: null, db: null };
    }
  } else {
    app = getApp();
  }

  const auth = getAuth(app);
  const db = getFirestore(app);

  return { auth, db };
}

const { auth, db } = initializeFirebase();

export { auth, db }; 