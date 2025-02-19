import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
}

// Add validation for required config values
const requiredKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId'
]

// Check for missing configuration
const missingKeys = requiredKeys.filter(key => !firebaseConfig[key])
if (missingKeys.length > 0) {
  console.error('Missing Firebase configuration keys:', missingKeys)
  throw new Error(`Missing required Firebase configuration: ${missingKeys.join(', ')}`)
}

// Initialize Firebase
let app
try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
} catch (error) {
  console.error('Error initializing Firebase:', error)
  console.error('Firebase config:', {
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey ? '**exists**' : '**missing**',
    appId: firebaseConfig.appId ? '**exists**' : '**missing**'
  })
  throw error
}

const auth = getAuth(app)
const db = getFirestore(app)

export { app, auth, db } 