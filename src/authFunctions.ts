import { 
  signInWithEmailAndPassword, 
  signOut,
  getAuth 
} from "firebase/auth"
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc
} from "firebase/firestore"
import { db } from "./FirebaseConfg"

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

export const loginWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const auth = getAuth()
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    
    // All users logging in with email are considered admin by default
    return {
      success: true,
      role: 'Admin'
    }
  } catch (error: any) {
    return {
      success: false,
      role: '',
      error: error.message
    }
  }
}

export const loginWithUsername = async (username: string, password: string): Promise<AuthResponse> => {
  try {
    // Find user in Firestore
    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('username', '==', username))
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      return {
        success: false,
        role: '',
        error: 'User not found'
      }
    }

    const userDoc = snapshot.docs[0]
    const userData = userDoc.data()

    // In production, you should use proper password hashing
    if (userData.password !== password) {
      return {
        success: false,
        role: '',
        error: 'Invalid password'
      }
    }

    return {
      success: true,
      role: userData.role
    }
  } catch (error: any) {
    return {
      success: false,
      role: '',
      error: error.message
    }
  }
}

export const logoutUser = async (): Promise<void> => {
  const auth = getAuth()
  await signOut(auth)
} 