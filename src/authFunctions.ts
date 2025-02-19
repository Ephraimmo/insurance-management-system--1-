'use client';

import { 
  signInWithEmailAndPassword, 
  signOut,
  Auth,
  UserCredential,
  getAuth
} from "firebase/auth"
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc,
  setDoc,
  getFirestore
} from "firebase/firestore"
import { auth as globalAuth, db as globalDb } from "@/lib/firebase-config"
import { getApp } from "firebase/app";

const getFirebaseAuth = () => {
  try {
    return globalAuth || getAuth(getApp());
  } catch (error) {
    console.error('Error getting Firebase Auth:', error);
    return null;
  }
};

const getFirebaseDb = () => {
  try {
    return globalDb || getFirestore(getApp());
  } catch (error) {
    console.error('Error getting Firestore:', error);
    return null;
  }
};

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
  console.error('Login error:', error);
  let errorMessage = 'Failed to login';
  
  if (error.code === 'auth/user-not-found') {
    errorMessage = 'No user found with this email';
  } else if (error.code === 'auth/wrong-password') {
    errorMessage = 'Invalid password';
  } else if (error.code === 'auth/invalid-email') {
    errorMessage = 'Invalid email format';
  } else if (error.code === 'auth/too-many-requests') {
    errorMessage = 'Too many failed attempts. Please try again later';
  } else if (error.code === 'auth/invalid-api-key') {
    errorMessage = 'Authentication service is temporarily unavailable';
    console.error('Invalid API key error. Configuration may be incorrect.');
  }

  return {
    success: false,
    role: '',
    error: errorMessage
  };
};

export const loginWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
  if (typeof window === 'undefined') {
    return {
      success: false,
      role: '',
      error: 'Cannot login on server side'
    };
  }

  const auth = getFirebaseAuth();
  const db = getFirebaseDb();

  if (!auth || !db) {
    console.error('Firebase services not available:', { auth: !!auth, db: !!db });
    return {
      success: false,
      role: '',
      error: 'Authentication service is not available'
    };
  }

  try {
    console.log('Attempting login with email...');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Email login successful');

    if (!userCredential.user) {
      return {
        success: false,
        role: '',
        error: 'Authentication failed'
      };
    }

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('Creating new admin user...');
      const userDoc = doc(usersRef);
      await setDoc(userDoc, {
        email,
        role: 'Admin',
        createdAt: new Date()
      });
      
      return {
        success: true,
        role: 'Admin'
      };
    }

    const userData = snapshot.docs[0].data();
    console.log('Login successful, role:', userData.role);
    return {
      success: true,
      role: userData.role || 'Admin'
    };
  } catch (error: any) {
    return handleAuthError(error);
  }
};

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