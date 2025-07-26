'use client';

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase-config';
import type { Member, Contact, Address, Contract, ContractMember } from './firebase-config';
import { createMemberRelationship } from './member-relationship-service';


// Contacts Collection Operations
export const addContact = async (contactData: Omit<Contact, 'contact_id' | 'created_at'>) => {
  try {
    const contactsRef = collection(db as any, 'contacts');
    const newContact = {
      ...contactData,
      created_at: Timestamp.now()
    };
    const docRef = await addDoc(contactsRef, newContact);
    return { ...newContact, contact_id: docRef.id };
  } catch (error) {
    console.error('Error adding contact:', error);
    throw error;
  }
};

export const getContactByMemberId = async (memberId: string) => {
  try {
    const contactsRef = collection(db as any, 'contacts');
    const q = query(contactsRef, where('member_id', '==', memberId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const contactDoc = querySnapshot.docs[0];
      return { contact_id: contactDoc.id, ...contactDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting contact:', error);
    throw error;
  }
};

// Addresses Collection Operations
export const addAddress = async (addressData: Omit<Address, 'address_id' | 'created_at'>) => {
  try {
    const addressesRef = collection(db as any, 'addresses');
    const newAddress = {
      ...addressData,
      created_at: Timestamp.now()
    };
    const docRef = await addDoc(addressesRef, newAddress);
    return { ...newAddress, address_id: docRef.id };
  } catch (error) {
    console.error('Error adding address:', error);
    throw error;
  }
};

export const getAddressByMemberId = async (memberId: string) => {
  try {
    const addressesRef = collection(db as any, 'addresses');
    const q = query(addressesRef, where('member_id', '==', memberId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const addressDoc = querySnapshot.docs[0];
      return { address_id: addressDoc.id, ...addressDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting address:', error);
    throw error;
  }
};

// Contracts Collection Operations
export const addContract = async (contractData: Omit<Contract, 'contract_id' | 'created_at'>) => {
  try {
    const contractsRef = collection(db as any, 'contracts');
    const newContract = {
      ...contractData,
      created_at: Timestamp.now()
    };
    const docRef = await addDoc(contractsRef, newContract);
    return { ...newContract, contract_id: docRef.id };
  } catch (error) {
    console.error('Error adding contract:', error);
    throw error;
  }
};

export const getContractById = async (contractId: string) => {
  try {
    const contractRef = doc(db as any, 'contracts', contractId);
    const contractDoc = await getDoc(contractRef);
    if (contractDoc.exists()) {
      return { contract_id: contractDoc.id, ...contractDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting contract:', error);
    throw error;
  }
};

// Contract Members Collection Operations
export const addContractMember = async (contractMemberData: Omit<ContractMember, 'contract_member_id' | 'created_at'>) => {
  try {
    const contractMembersRef = collection(db as any, 'contract_members');
    const newContractMember = {
      ...contractMemberData,
      created_at: Timestamp.now()
    };
    const docRef = await addDoc(contractMembersRef, newContractMember);
    return { ...newContractMember, contract_member_id: docRef.id };
  } catch (error) {
    console.error('Error adding contract member:', error);
    throw error;
  }
};

export const getContractMembersByContractId = async (contractId: string) => {
  try {
    const contractMembersRef = collection(db as any, 'contract_members');
    const q = query(contractMembersRef, where('contract_id', '==', contractId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      contract_member_id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting contract members:', error);
    throw error;
  }
};

export const getMemberContracts = async (memberId: string) => {
  try {
    const contractMembersRef = collection(db as any, 'contract_members');
    const q = query(contractMembersRef, where('member_id', '==', memberId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      contract_member_id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting member contracts:', error);
    throw error;
  }
}; 