'use client';

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
  setDoc,
  getFirestore,
  Timestamp
} from "firebase/firestore"
import { initializeApp, getApps, getApp } from "firebase/app"
import type { Member } from '@/lib/firebase-config'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

interface AuthResponse {
  success: boolean
  role: string
  error?: string
  userId?: string
}

const getFirebaseServices = () => {
  if (typeof window === 'undefined') {
    return { auth: null, db: null };
  }

  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const auth = getAuth(app);
    const db = getFirestore(app);
    return { auth, db };
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    return { auth: null, db: null };
  }
};

export const loginWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
  const { auth, db } = getFirebaseServices();
  
  if (!auth || !db) {
    return {
      success: false,
      role: '',
      error: 'Authentication service is temporarily unavailable'
    };
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    if (!userCredential.user) {
      return {
        success: false,
        role: '',
        error: 'Authentication failed'
      };
    }

    try {
      const membersRef = collection(db, 'members');
      const q = query(membersRef, where('email', '==', email));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Create a new member record
        const memberData: Omit<Member, 'member_id' | 'created_at' | 'updated_at'> = {
          first_name: email.split('@')[0], // Temporary name from email
          last_name: '',
          dob: new Date(),
          id_number: userCredential.user.uid,
          member_type: 'Main'
        };

        const newMemberRef = doc(membersRef);
        await setDoc(newMemberRef, {
          ...memberData,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now()
        });
        
        return {
          success: true,
          role: 'Admin',
          userId: userCredential.user.uid
        };
      }

      const memberDoc = snapshot.docs[0];
      const memberData = memberDoc.data() as Member;
      
      return {
        success: true,
        role: memberData.member_type === 'Main' ? 'Admin' : 'User',
        userId: userCredential.user.uid
      };
    } catch (dbError) {
      console.error('Database error:', dbError);
      return {
        success: true,
        role: 'Admin',
        error: 'User role could not be retrieved',
        userId: userCredential.user.uid
      };
    }
  } catch (error: any) {
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
    }

    return {
      success: false,
      role: '',
      error: errorMessage
    };
  }
};

export const loginWithUsername = async (username: string, password: string): Promise<AuthResponse> => {
  const { db } = getFirebaseServices();
  
  if (!db) {
    return {
      success: false,
      role: '',
      error: 'Database service is temporarily unavailable'
    };
  }

  try {
    const membersRef = collection(db, 'members');
    const q = query(membersRef, where('username', '==', username));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return {
        success: false,
        role: '',
        error: 'No user found with this username'
      };
    }

    const memberDoc = snapshot.docs[0];
    const memberData = memberDoc.data() as Member;

    // In a real application, you should never store passwords in Firestore
    // This is just for demonstration. Use Firebase Auth instead.
    if (password !== 'demo-password') {
      return {
        success: false,
        role: '',
        error: 'Invalid password'
      };
    }

    try {
      await setDoc(doc(membersRef, memberDoc.id), {
        ...memberData,
        updated_at: Timestamp.now()
      }, { merge: true });
    } catch (updateError) {
      console.error('Error updating last login:', updateError);
    }

    return {
      success: true,
      role: memberData.member_type === 'Main' ? 'Admin' : 'User',
      userId: memberDoc.id
    };
  } catch (error: any) {
    console.error('Login error:', error);
    return {
      success: false,
      role: '',
      error: 'An unexpected error occurred. Please try again.'
    };
  }
};

export const logoutUser = async (): Promise<void> => {
  const { auth } = getFirebaseServices();
  
  if (!auth) {
    console.error('Auth service not available');
    return;
  }

  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}; 