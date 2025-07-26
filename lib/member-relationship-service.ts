'use client';

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase-config';
import type { Member } from './firebase-config';

type MemberRelationshipData = {
  memberId: string;
  contractNumber: string;
  role: 'Main Member' | 'Dependent' | 'Beneficiary';
  relationshipType?: string;
  benefitPercentage?: number;
};

export const createMemberRelationship = async (data: MemberRelationshipData): Promise<void> => {
  try {
    // First check if relationship already exists
    const relationshipsRef = collection(db!, 'member_contract_relationships');
    const existingQuery = query(
      relationshipsRef,
      where('member_id', '==', data.memberId),
      where('contract_number', '==', data.contractNumber),
      where('role', '==', data.role)
    );
    
    const existingSnapshot = await getDocs(existingQuery);
    
    // If relationship doesn't exist, create it
    if (existingSnapshot.empty) {
      const relationshipRef = await addDoc(relationshipsRef, {
        member_id: data.memberId,
        contract_number: data.contractNumber,
        role: data.role,
        created_at: new Date(),
        updated_at: new Date()
      });

      // If this is a beneficiary, create Relationship and Benefit records
      if (data.role === 'Beneficiary') {
        // Create Relationship record
        if (data.relationshipType) {
          await addDoc(collection(db!, 'Relationship'), {
            member_contract_relationship_id: relationshipRef.id,
            relationshipType: data.relationshipType,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        // Create Benefit record
        if (data.benefitPercentage !== undefined) {
          await addDoc(collection(db!, 'Benefit'), {
            member_contract_relationship_id: relationshipRef.id,
            percentage: data.benefitPercentage,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    }
  } catch (error) {
    console.error('Error creating member relationship:', error);
    throw new Error('Failed to create member relationship');
  }
};

export const getMemberRelationships = async (contractNumber: string): Promise<MemberRelationshipData[]> => {
  try {
    const relationshipsRef = collection(db!, 'member_contract_relationships');
    const relationshipsQuery = query(
      relationshipsRef,
      where('contract_number', '==', contractNumber)
    );
    
    const snapshot = await getDocs(relationshipsQuery);
    return snapshot.docs.map(doc => ({
      memberId: doc.data().member_id,
      contractNumber: doc.data().contract_number,
      role: doc.data().role
    }));
  } catch (error) {
    console.error('Error getting member relationships:', error);
    throw new Error('Failed to get member relationships');
  }
};

export const getMemberRole = async (memberId: string, contractNumber: string): Promise<string | null> => {
  try {
    const relationshipsRef = collection(db!, 'member_contract_relationships');
    const relationshipQuery = query(
      relationshipsRef,
      where('member_id', '==', memberId),
      where('contract_number', '==', contractNumber)
    );
    
    const snapshot = await getDocs(relationshipQuery);
    if (!snapshot.empty) {
      return snapshot.docs[0].data().role;
    }
    return null;
  } catch (error) {
    console.error('Error getting member role:', error);
    throw new Error('Failed to get member role');
  }
};

export const getContractRelationships = async (contractNumber: string) => {
  try {
    const relationshipsRef = collection(db!, 'member_contract_relationships');
    const q = query(relationshipsRef, where('contract_number', '==', contractNumber));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      relationship_id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting contract relationships:', error);
    throw error;
  }
};

export const checkMainMemberExistingContract = async (idNumber: string): Promise<{ exists: boolean; contractNumber?: string }> => {
  try {
    // First get the member ID using the ID number
    const membersRef = collection(db!, 'Members');
    const memberQuery = query(
      membersRef,
      where('idNumber', '==', idNumber)
    );
    const memberSnapshot = await getDocs(memberQuery);
    
    if (!memberSnapshot.empty) {
      const memberId = memberSnapshot.docs[0].id;
      
      // Check if this member is a main member in any contract
      const relationshipsRef = collection(db!, 'member_contract_relationships');
      const relationshipQuery = query(
        relationshipsRef,
        where('member_id', '==', memberId),
        where('role', '==', 'Main Member')
      );
      
      const relationshipSnapshot = await getDocs(relationshipQuery);
      
      if (!relationshipSnapshot.empty) {
        // Member is already a main member in a contract
        return {
          exists: true,
          contractNumber: relationshipSnapshot.docs[0].data().contract_number
        };
      }
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error checking main member existing contract:', error);
    throw new Error('Failed to check main member existing contract');
  }
}; 