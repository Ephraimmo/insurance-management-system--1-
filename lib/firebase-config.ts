import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const productionConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
}

const developmentConfig = {
  apiKey: "AIzaSyDCXIw7LJkOXlF3a4MTZA3kA3Q46gARpWU",
  authDomain: "data-b93ed.firebaseapp.com",
  projectId: "data-b93ed",
  storageBucket: "data-b93ed.appspot.com",
  messagingSenderId: "218236841715",
  appId: "1:218236841715:web:f34737d3fa3bc759701186",
  databaseURL: "https://data-b93ed-default-rtdb.firebaseio.com",
}

// Use development config if env variables are not set
const firebaseConfig = Object.values(productionConfig).every(value => !value) 
  ? developmentConfig 
  : productionConfig

// Initialize Firebase
let app
try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig)
    console.log('Firebase initialized successfully')
  } else {
    app = getApp()
    console.log('Firebase app already initialized')
  }
} catch (error) {
  console.error('Error initializing Firebase:', error)
  console.error('Firebase config:', {
    apiKey: '**hidden**',
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    databaseURL: firebaseConfig.databaseURL,
  })
  throw error
}

const auth = getAuth(app)
const db = getFirestore(app)

export { app, auth, db } 