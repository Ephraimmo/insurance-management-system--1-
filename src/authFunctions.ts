'use client';

import { 
  signInWithEmailAndPassword, 
  signOut,
  Auth,
  UserCredential
} from "firebase/auth"
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc,
  setDoc
} from "firebase/firestore"
import { auth, db } from "@/lib/firebase-config"

interface UserCredentials {
  username?: string
  email?: string
  password: string
}

interface AuthResponse {
  success: boolean
  role: string
  error?: string
}

const handleAuthError = (error: any): AuthResponse => {
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

export const loginWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
  if (typeof window === 'undefined') {
    return {
      success: false,
      role: '',
      error: 'Cannot login on server side'
    }
  }

  if (!auth) {
    return {
      success: false,
      role: '',
      error: 'Authentication service is not available'
    }
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    
    if (!userCredential.user || !db) {
      return {
        success: false,
        role: '',
        error: 'Authentication failed'
      }
    }

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
  } catch (error: any) {
    return handleAuthError(error)
  }
}

export const loginWithUsername = async (username: string, password: string): Promise<AuthResponse> => {
  if (typeof window === 'undefined') {
    return {
      success: false,
      role: '',
      error: 'Cannot login on server side'
    }
  }

  if (!db) {
    return {
      success: false,
      role: '',
      error: 'Database service is not available'
    }
  }

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

    await setDoc(doc(usersRef, userDoc.id), {
      ...userData,
      lastLogin: new Date()
    }, { merge: true })

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
  if (typeof window === 'undefined' || !auth) {
    console.error('Auth is not initialized or not on client side')
    return
  }

  try {
    await signOut(auth)
  } catch (error) {
    console.error('Logout error:', error)
    throw error
  }
} 