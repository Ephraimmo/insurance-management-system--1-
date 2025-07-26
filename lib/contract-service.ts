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
  Timestamp,
  DocumentReference,
  WriteBatch,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase-config';
import type { Contract, ContractMember, Member } from './firebase-config';
import { createMemberRelationship } from './member-relationship-service';

// Ensure db is treated as Firestore instance
const firestore = db!;

export interface ContractWithMembers {
  contract_name: string;
  start_date: Date;
  end_date: Date;
  mainMember: {
    member_id: string;
    first_name: string;
    last_name: string;
    id_number: string;
    dob: Date;
  };
  dependents: Array<{
    member_id: string;
    first_name: string;
    last_name: string;
    id_number: string;
    dob: Date;
  }>;
  beneficiaries: Array<{
    member_id: string;
    first_name: string;
    last_name: string;
    id_number: string;
    dob: Date;
  }>;
}

interface CreateContractInput {
  contractName: string;
  startDate: Date;
  endDate: Date;
  mainMemberId: string;
  dependentIds: string[];
  beneficiaryIds: string[];
}

interface UpdateContractInput extends Partial<CreateContractInput> {
  contractId: string;
}

interface MemberContractRelationship {
  relationship_id: string;
  contract_number: string;
  member_id: string;
  role: 'Main Member' | 'Dependent' | 'Beneficiary';
  created_at: Date;
}

// Validation functions
const validateContractDates = (startDate: Date, endDate: Date): string | null => {
  if (startDate >= endDate) {
    return 'Start date must be before end date';
  }
  if (startDate < new Date()) {
    return 'Start date cannot be in the past';
  }
  return null;
};

const validateMemberIds = async (
  mainMemberId: string,
  dependentIds: string[],
  beneficiaryIds: string[]
): Promise<string | null> => {
  // Check for duplicate IDs
  const allIds = [mainMemberId, ...dependentIds, ...beneficiaryIds];
  const uniqueIds = new Set(allIds);
  if (uniqueIds.size !== allIds.length) {
    return 'Duplicate member IDs found';
  }

  // Verify all members exist
  try {
    const membersRef = collection(firestore, 'members');
    for (const id of uniqueIds) {
      const memberDoc = await getDoc(doc(membersRef, id));
      if (!memberDoc.exists()) {
        return `Member with ID ${id} not found`;
      }
    }
  } catch (error) {
    console.error('Error validating member IDs:', error);
    return 'Error validating member IDs';
  }

  return null;
};

// Create a new contract with members and relationships
export const createContract = async (input: CreateContractInput): Promise<string> => {
  // Validate dates
  const dateError = validateContractDates(input.startDate, input.endDate);
  if (dateError) {
    throw new Error(dateError);
  }

  // Validate member IDs
  const memberError = await validateMemberIds(
    input.mainMemberId,
    input.dependentIds,
    input.beneficiaryIds
  );
  if (memberError) {
    throw new Error(memberError);
  }

  const batch = writeBatch(firestore);

  try {
    // Create contract
    const contractsRef = collection(firestore, 'contracts');
    const contractDoc = await addDoc(contractsRef, {
      contract_name: input.contractName,
      start_date: Timestamp.fromDate(input.startDate),
      end_date: Timestamp.fromDate(input.endDate),
      created_at: Timestamp.now()
    });

    // Generate contract number
    const contractNumber = `CNT-${contractDoc.id.slice(0, 8).toUpperCase()}`;

    // Update contract with contract number
    await updateDoc(contractDoc, {
      contract_number: contractNumber
    });

    // Create relationships for all members
    await Promise.all([
      // Main member relationship
      createMemberRelationship({
        memberId: input.mainMemberId,
        contractNumber,
        role: 'Main Member'
      }),
      
      // Dependent relationships
      ...input.dependentIds.map(dependentId =>
        createMemberRelationship({
          memberId: dependentId,
          contractNumber,
          role: 'Dependent'
        })
      ),
      
      // Beneficiary relationships
      ...input.beneficiaryIds.map(beneficiaryId =>
        createMemberRelationship({
          memberId: beneficiaryId,
          contractNumber,
          role: 'Beneficiary'
        })
      )
    ]);

    await batch.commit();
    return contractDoc.id;
  } catch (error) {
    console.error('Error creating contract:', error);
    throw error;
  }
};

// Get contract with all member details using relationships
export const getContractWithMembers = async (contractId: string): Promise<ContractWithMembers | null> => {
  try {
    // Get contract
    const contractRef = doc(firestore, 'contracts', contractId);
    const contractDoc = await getDoc(contractRef);

    if (!contractDoc.exists()) {
      return null;
    }

    const contract = {
      contract_id: contractDoc.id,
      ...contractDoc.data()
    } as Contract;

    // Get relationships for this contract
    const relationshipsRef = collection(firestore, 'member_contract_relationships');
    const q = query(relationshipsRef, where('contract_number', '==', (contract as any).contract_number));
    const relationshipsSnapshot = await getDocs(q);

    const result: ContractWithMembers = {
      ...contract,
      mainMember: {
        member_id: '',
        first_name: '',
        last_name: '',
        id_number: '',
        dob: new Date()
      },
      dependents: [],
      beneficiaries: []
    };

    // Get member details for each relationship
    for (const relationshipDoc of relationshipsSnapshot.docs) {
      const relationshipData = relationshipDoc.data();
      const memberDetails = await getMemberById(relationshipData.member_id);

      if (memberDetails) {
        switch (relationshipData.role) {
          case 'Main Member':
            result.mainMember = memberDetails as Member;
            break;
          case 'Dependent':
            result.dependents.push(memberDetails as Member);
            break;
          case 'Beneficiary':
            result.beneficiaries.push(memberDetails as Member);
            break;
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error getting contract with members:', error);
    throw error;
  }
};

// Update contract and relationships
export const updateContract = async (input: UpdateContractInput): Promise<void> => {
  const batch = writeBatch(firestore);

  try {
    const contractRef = doc(firestore, 'contracts', input.contractId);
    const contractDoc = await getDoc(contractRef);

    if (!contractDoc.exists()) {
      throw new Error('Contract not found');
    }

    const contractData = contractDoc.data();
    const contractNumber = contractData.contract_number;

    // Update contract details if provided
    const updateData: Record<string, any> = {
      updated_at: Timestamp.now()
    };

    if (input.contractName) {
      updateData.contract_name = input.contractName;
    }
    if (input.startDate) {
      updateData.start_date = Timestamp.fromDate(input.startDate);
    }
    if (input.endDate) {
      updateData.end_date = Timestamp.fromDate(input.endDate);
    }

    await updateDoc(contractRef, updateData);

    // Update relationships if provided
    if (input.mainMemberId || input.dependentIds || input.beneficiaryIds) {
      // Delete existing relationships
      const relationshipsRef = collection(firestore, 'member_contract_relationships');
      const q = query(relationshipsRef, where('contract_number', '==', contractNumber));
      const snapshot = await getDocs(q);
      
      for (const doc of snapshot.docs) {
        await deleteDoc(doc.ref);
      }

      // Add new relationships
      if (input.mainMemberId) {
        await addDoc(relationshipsRef, {
          contract_number: contractNumber,
          member_id: input.mainMemberId,
          role: 'Main Member',
          created_at: Timestamp.now()
        });
      }

      if (input.dependentIds) {
        for (const dependentId of input.dependentIds) {
          await addDoc(relationshipsRef, {
            contract_number: contractNumber,
            member_id: dependentId,
            role: 'Dependent',
            created_at: Timestamp.now()
          });
        }
      }

      if (input.beneficiaryIds) {
        for (const beneficiaryId of input.beneficiaryIds) {
          await addDoc(relationshipsRef, {
            contract_number: contractNumber,
            member_id: beneficiaryId,
            role: 'Beneficiary',
            created_at: Timestamp.now()
          });
        }
      }
    }

    await batch.commit();
  } catch (error) {
    console.error('Error updating contract:', error);
    throw error;
  }
};

// Helper function to get member by ID
const getMemberById = async (memberId: string): Promise<Member | null> => {
  try {
    const memberRef = doc(firestore, 'members', memberId);
    const memberDoc = await getDoc(memberRef);
    if (memberDoc.exists()) {
      return {
        member_id: memberDoc.id,
        ...memberDoc.data()
      } as Member;
    }
    return null;
  } catch (error) {
    console.error('Error getting member:', error);
    return null;
  }
}; 