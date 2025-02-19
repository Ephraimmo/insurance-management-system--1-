'use client';

import { 
  signInWithEmailAndPassword, 
  signOut,
  getAuth,
  Auth
} from "firebase/auth"
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  setDoc,
  getFirestore,
  Firestore
} from "firebase/firestore"
import { getApp } from "firebase/app"
import { auth as globalAuth, db as globalDb } from "@/lib/firebase-config"

interface AuthResponse {
  success: boolean
  role: string
  error?: string
}

const ensureFirebaseServices = () => {
  try {
    let auth: Auth | null = globalAuth
    let db: Firestore | null = globalDb

    if (!auth || !db) {
      const app = getApp()
      if (!auth) auth = getAuth(app)
      if (!db) db = getFirestore(app)
    }

    if (!auth || !db) {
      throw new Error('Firebase services not available')
    }

    return { auth, db }
  } catch (error) {
    console.error('Error ensuring Firebase services:', error)
    return { auth: null, db: null }
  }
}

export const loginWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
  const services = ensureFirebaseServices()
  
  if (!services.auth || !services.db) {
    console.error('Firebase services not available:', { 
      auth: !!services.auth, 
      db: !!services.db 
    })
    return {
      success: false,
      role: '',
      error: 'Authentication service is temporarily unavailable'
    }
  }

  const { auth, db } = services

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    
    if (!userCredential.user) {
      return {
        success: false,
        role: '',
        error: 'Authentication failed'
      }
    }

    try {
      const usersRef = collection(db, 'users')
      const q = query(usersRef, where('email', '==', email))
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        const userDoc = doc(usersRef)
        await setDoc(userDoc, {
          email,
          role: 'Admin',
          createdAt: new Date()
        })
        
        return {
          success: true,
          role: 'Admin'
        }
      }

      const userData = snapshot.docs[0].data()
      return {
        success: true,
        role: userData.role || 'Admin'
      }
    } catch (dbError) {
      console.error('Database error:', dbError)
      return {
        success: true,
        role: 'Admin',
        error: 'User role could not be retrieved'
      }
    }
  } catch (error: any) {
    console.error('Login error:', error)
    let errorMessage = 'Failed to login'
    
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No user found with this email'
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Invalid password'
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email format'
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many failed attempts. Please try again later'
    } else if (error.code === 'auth/invalid-api-key') {
      errorMessage = 'Authentication service is temporarily unavailable'
    }

    return {
      success: false,
      role: '',
      error: errorMessage
    }
  }
}

export const loginWithUsername = async (username: string, password: string): Promise<AuthResponse> => {
  const services = ensureFirebaseServices()
  
  if (!services.db) {
    return {
      success: false,
      role: '',
      error: 'Database service is temporarily unavailable'
    }
  }

  const { db } = services

  try {
    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('username', '==', username))
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      return {
        success: false,
        role: '',
        error: 'No user found with this username'
      }
    }

    const userDoc = snapshot.docs[0]
    const userData = userDoc.data()

    if (userData.password !== password) {
      return {
        success: false,
        role: '',
        error: 'Invalid password'
      }
    }

    try {
      await setDoc(doc(usersRef, userDoc.id), {
        ...userData,
        lastLogin: new Date()
      }, { merge: true })
    } catch (updateError) {
      console.error('Error updating last login:', updateError)
      // Continue with login even if updating last login fails
    }

    return {
      success: true,
      role: userData.role || 'User'
    }
  } catch (error: any) {
    console.error('Login error:', error)
    return {
      success: false,
      role: '',
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

export const logoutUser = async (): Promise<void> => {
  const services = ensureFirebaseServices()
  
  if (!services.auth) {
    console.error('Auth service not available')
    return
  }

  try {
    await signOut(services.auth)
  } catch (error) {
    console.error('Logout error:', error)
    throw error
  }
} 