import { db } from "./FirebaseConfg"
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore"

interface User {
  id: string
  username: string
  role: string
  createdAt: Date
  lastLogin?: Date
}

interface UserFormData {
  username: string
  password: string
  role: string
}

export const getAllUsers = async (): Promise<User[]> => {
  try {
    const usersRef = collection(db, "users")
    const snapshot = await getDocs(usersRef)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      lastLogin: doc.data().lastLogin?.toDate()
    })) as User[]
  } catch (error) {
    console.error("Error getting users:", error)
    throw error
  }
}

export const searchUsers = async (username: string, role: string): Promise<User[]> => {
  try {
    const usersRef = collection(db, "users")
    let q = query(usersRef)
    
    if (username) {
      q = query(q, where("username", ">=", username), where("username", "<=", username + "\uf8ff"))
    }

    if (role && role !== "all") {
      q = query(q, where("role", "==", role))
    }

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      lastLogin: doc.data().lastLogin?.toDate()
    })) as User[]
  } catch (error) {
    console.error("Error searching users:", error)
    throw error
  }
}

export const addUser = async (userData: UserFormData): Promise<string> => {
  try {
    // Check for existing username
    const usersRef = collection(db, "users")
    const q = query(usersRef, where("username", "==", userData.username))
    const snapshot = await getDocs(q)

    if (!snapshot.empty) {
      // Generate username suggestion
      const suggestion = `${userData.username}${Math.floor(Math.random() * 1000)}`
      throw new Error(`Username already exists. Try: ${suggestion}`)
    }

    const docRef = await addDoc(usersRef, {
      ...userData,
      createdAt: serverTimestamp(),
    })

    return docRef.id
  } catch (error) {
    console.error("Error adding user:", error)
    throw error
  }
}

export const updateUser = async (userId: string, userData: Partial<UserFormData>): Promise<void> => {
  try {
    const userRef = doc(db, "users", userId)
    const updateData: any = { ...userData }
    
    // Only include password if it's provided
    if (!userData.password) {
      delete updateData.password
    }

    await updateDoc(userRef, updateData)
  } catch (error) {
    console.error("Error updating user:", error)
    throw error
  }
}

export const deleteUser = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, "users", userId)
    await deleteDoc(userRef)
  } catch (error) {
    console.error("Error deleting user:", error)
    throw error
  }
}

export const generateUsernameSuggestion = (username: string): string => {
  const randomNum = Math.floor(Math.random() * 1000)
  return `${username}${randomNum}`
} 