"use client"

import React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DependentForm } from "./DependentForm"
import { collection, addDoc, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc, onSnapshot } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, AlertCircle, UserPlus, UserX, UserCheck, AlertTriangle, Plus } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { createMemberRelationship } from "@/lib/member-relationship-service"
import { toast } from "@/components/ui/use-toast"
import { DependentData } from "@/types/dependent"

type ErrorState = { [key: string]: string } | null;

type DependentDetailsProps = {
  dependents: DependentData[]
  updateDependents: (dependents: DependentData[]) => void
  contractNumber?: string
  mainMemberIdNumber?: string
}

const emptyDependent: DependentData = {
  isDeleting: false,
  personalInfo: {
    title: "",
    firstName: "",
    lastName: "",
    initials: "",
    dateOfBirth: null,
    gender: "",
    relationshipToMainMember: "",
    nationality: "",
    idType: "South African ID",
    idNumber: "",
    dependentStatus: "Active",
    medicalAidNumber: "",
    employer: "",
    school: "",
    idDocumentUrl: null,
  },
  contactDetails: [],
  addressDetails: {
    streetAddress: "",
    city: "",
    stateProvince: "",
    postalCode: "",
    country: "",
  },
}

const checkDependentLimit = async (contractNumber: string, currentDependentCount: number): Promise<boolean> => {
  try {
    // Get contract details
    const contractQuery = query(
      collection(db, 'Contracts'),
      where('contractNumber', '==', contractNumber)
    )
    const contractSnapshot = await getDocs(contractQuery)
    
    if (contractSnapshot.empty) {
      throw new Error('Contract not found')
    }

    const contractData = contractSnapshot.docs[0].data()
    const policiesId = contractData.policiesId
  
    // Get policies details
    const policiesDoc = await getDoc(doc(db, 'Policies', policiesId))
    if (!policiesDoc.exists()) {
      throw new Error('policies not found')
    }
    
    const policiesData = policiesDoc.data()
    const maxDependents = policiesData.maxDependents || 0 // Get max dependents from policies
    
    // Check if adding another dependent would exceed the limit
    return currentDependentCount < maxDependents
  } catch (error) {
    console.error('Error checking dependent limit:', error)
    return false
  }
}

const saveDependentToFirestore = async (
  data: DependentData,
  contractNumber: string,
  mainMemberIdNumber: string
): Promise<string> => {
  try {
    // 1. Save basic info in Members collection
    const memberRef = await addDoc(collection(db, 'Members'), {
      firstName: data.personalInfo.firstName,
      lastName: data.personalInfo.lastName,
      initials: data.personalInfo.initials,
      dateOfBirth: data.personalInfo.dateOfBirth,
      gender: data.personalInfo.gender,
      nationality: data.personalInfo.nationality,
      idType: data.personalInfo.idType,
      idNumber: data.personalInfo.idNumber,
      medicalAidNumber: data.personalInfo.medicalAidNumber,
      employer: data.personalInfo.employer,
      school: data.personalInfo.school,
      idDocumentUrl: data.personalInfo.idDocumentUrl,
      type: 'Dependent',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 2. Create member_contract_relationships record
    const relationshipRef = await addDoc(collection(db, 'member_contract_relationships'), {
      member_id: memberRef.id,
      contract_number: contractNumber,
      role: 'Dependent',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 3. Create Relationship record with the relationship type
    await addDoc(collection(db, 'Relationship'), {
      member_contract_relationship_id: relationshipRef.id,
      relationshipType: data.personalInfo.relationshipToMainMember,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 4. Create Status record
    await addDoc(collection(db, 'Status'), {
      member_contract_relationship_id: relationshipRef.id,
      status: data.personalInfo.dependentStatus,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 5. Save contact details
    await Promise.all(data.contactDetails.map(contact =>
      addDoc(collection(db, 'Contacts'), {
        ...contact,
        memberId: memberRef.id,
        memberIdNumber: data.personalInfo.idNumber,
        type: 'Dependent',
        createdAt: new Date(),
        updatedAt: new Date()
      })
    ));

    // 6. Save address details
    await addDoc(collection(db, 'Address'), {
      ...data.addressDetails,
      memberId: memberRef.id,
      memberIdNumber: data.personalInfo.idNumber,
      type: 'Dependent',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return memberRef.id;
  } catch (error) {
    console.error('Error saving dependent:', error);
    throw error;
  }
};

const removeDependentFromFirestore = async (dependentId: string, contractNumber: string): Promise<void> => {
  try {
    // 1. Get the member_contract_relationship record
    const relationshipsRef = collection(db, 'member_contract_relationships');
    const relationshipQuery = query(
      relationshipsRef,
      where('member_id', '==', dependentId),
      where('contract_number', '==', contractNumber),
      where('role', '==', 'Dependent')
    );
    const relationshipSnapshot = await getDocs(relationshipQuery);
    
    if (!relationshipSnapshot.empty) {
      const memberContractRelationshipId = relationshipSnapshot.docs[0].id;

      // 2. Delete the Relationship record
      const relationshipTypeQuery = query(
        collection(db, 'Relationship'),
        where('member_contract_relationship_id', '==', memberContractRelationshipId)
      );
      const relationshipTypeSnapshot = await getDocs(relationshipTypeQuery);
      if (!relationshipTypeSnapshot.empty) {
        await deleteDoc(relationshipTypeSnapshot.docs[0].ref);
      }

      // 3. Delete the Status record
      const statusQuery = query(
        collection(db, 'Status'),
        where('member_contract_relationship_id', '==', memberContractRelationshipId)
      );
      const statusSnapshot = await getDocs(statusQuery);
      if (!statusSnapshot.empty) {
        await deleteDoc(statusSnapshot.docs[0].ref);
      }

      // 4. Finally delete the member_contract_relationship record
      await deleteDoc(relationshipSnapshot.docs[0].ref);
    }
  } catch (error) {
    console.error('Error removing dependent:', error);
    throw new Error('Failed to remove dependent relationship records');
  }
};

const validateDependentData = (data: DependentData, dependents: DependentData[]): string[] => {
  const errors: string[] = [];

  // Personal Information Validation (Required)
  if (!data.personalInfo.firstName?.trim()) errors.push("First Name is required");
  if (!data.personalInfo.lastName?.trim()) errors.push("Last Name is required");
  if (!data.personalInfo.initials?.trim()) errors.push("Initials are required");
  if (!data.personalInfo.dateOfBirth) errors.push("Date of Birth is required");
  if (!data.personalInfo.gender?.trim()) errors.push("Gender is required");
  if (!data.personalInfo.relationshipToMainMember?.trim()) errors.push("Relationship to Main Member is required");
  if (!data.personalInfo.nationality?.trim()) errors.push("Nationality is required");
  if (!data.personalInfo.idType?.trim()) errors.push("Type of ID is required");
  if (!data.personalInfo.idNumber?.trim()) errors.push("ID Number is required");
  if (!data.personalInfo.dependentStatus) errors.push("Dependent Status is required");

  // ID Number Validation for South African ID
  if (data.personalInfo.idType === "South African ID" && data.personalInfo.idNumber) {
    if (!/^\d{13}$/.test(data.personalInfo.idNumber.trim())) {
      errors.push("South African ID number must be 13 digits");
    }
  }

  // Validate age based on relationship
  if (data.personalInfo.dateOfBirth) {
    const age = new Date().getFullYear() - data.personalInfo.dateOfBirth.getFullYear();
    if (data.personalInfo.relationshipToMainMember === "Child" && age >= 21) {
      errors.push("Child dependents must be under 21 years old");
    }
  }

  // Contact Details Validation (Optional)
  if (data.contactDetails.length > 0) {
    data.contactDetails.forEach((contact, index) => {
      if (!contact.type) errors.push(`Contact type is required for contact #${index + 1}`);
      if (!contact.value?.trim()) errors.push(`Contact value is required for contact #${index + 1}`);
      
      // Email validation
      if (contact.type === "Email" && contact.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contact.value.trim())) {
          errors.push(`Invalid email format for contact #${index + 1}`);
        }
      }
      
      // Phone number validation
      if (contact.type === "Phone Number" && contact.value) {
        const phoneRegex = /^[0-9+\-\s()]{10,}$/;
        if (!phoneRegex.test(contact.value.trim())) {
          errors.push(`Invalid phone number format for contact #${index + 1}`);
        }
      }
    });
  }

  // Address Details Validation (Optional)
  if (Object.values(data.addressDetails).some(value => value.trim() !== "")) {
    // If any address field is filled, validate all required address fields
    if (!data.addressDetails.streetAddress?.trim()) errors.push("Street Address is required when providing address details");
    if (!data.addressDetails.city?.trim()) errors.push("City is required when providing address details");
    if (!data.addressDetails.stateProvince?.trim()) errors.push("State/Province is required when providing address details");
    if (!data.addressDetails.postalCode?.trim()) errors.push("Postal Code is required when providing address details");
    if (!data.addressDetails.country?.trim()) errors.push("Country is required when providing address details");

    // Validate postal code format if provided
    if (data.addressDetails.postalCode && 
        !/^\d{4}$/.test(data.addressDetails.postalCode)) {
      errors.push("Invalid South African postal code");
    }
  }

  return errors;
}

export function DependentDetails({ 
  dependents, 
  updateDependents,
  contractNumber,
  mainMemberIdNumber 
}: DependentDetailsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDependent, setEditingDependent] = useState<DependentData | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState<DependentData>(emptyDependent)
  const [error, setError] = useState<React.ReactNode | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)
  const [isCheckingLimit, setIsCheckingLimit] = useState(false)
  const [policiesLimit, setpoliciesLimit] = useState<number | null>(null)
  const [duplicateCheck, setDuplicateCheck] = useState<{
    checking: boolean;
    isDuplicate: boolean;
    message: string | null;
  }>({
    checking: false,
    isDuplicate: false,
    message: null
  });
  const [relationships, setRelationships] = useState<{ [key: string]: string }>({})
  const [statuses, setStatuses] = useState<{ [key: string]: string }>({})

  // Add effect to check policies limit on mount
  useEffect(() => {
    const checkpolicies = async () => {
      if (contractNumber) {
        setIsCheckingLimit(true)
        try {
          const canAddMore = await checkDependentLimit(contractNumber, dependents.length)
          // Extract the policies limit from the function (you'll need to modify checkDependentLimit to return this)
          setpoliciesLimit(canAddMore ? dependents.length + 1 : dependents.length)
        } catch (error) {
          console.error('Error checking policies limit:', error)
        } finally {
          setIsCheckingLimit(false)
        }
      }
    }
    checkpolicies()
  }, [contractNumber, dependents.length])

  // Add effect for real-time updates
  useEffect(() => {
    if (!contractNumber) return;

    // Set up real-time listener for member_contract_relationships
    const relationshipsRef = collection(db, 'member_contract_relationships');
    const relationshipQuery = query(
      relationshipsRef,
      where('contract_number', '==', contractNumber),
      where('role', '==', 'Dependent')
    );

    const unsubscribe = onSnapshot(relationshipQuery, async (snapshot) => {
      try {
        const updatedDependents: DependentData[] = [];
        
        for (const relationshipDoc of snapshot.docs) {
          const memberId = relationshipDoc.data().member_id;
          
          // Fetch member data
          const memberDoc = await getDoc(doc(db, 'Members', memberId));
          if (!memberDoc.exists()) continue;
          
          const memberData = memberDoc.data();

          // Fetch contact details
          const contactsQuery = query(
            collection(db, 'Contacts'),
            where('memberId', '==', memberId)
          );
          const contactsSnapshot = await getDocs(contactsQuery);
          const contactDetails = contactsSnapshot.docs.map(doc => ({
            type: doc.data().type as "Email" | "Phone Number",
            value: doc.data().value
          }));

          // Fetch address details
          const addressQuery = query(
            collection(db, 'Address'),
            where('memberId', '==', memberId)
          );
          const addressSnapshot = await getDocs(addressQuery);
          const addressData = addressSnapshot.docs[0]?.data();

          const dependentData: DependentData = {
            id: memberId,
            personalInfo: {
              title: memberData.title || '',
              firstName: memberData.firstName || '',
              lastName: memberData.lastName || '',
              initials: memberData.initials || '',
              dateOfBirth: memberData.dateOfBirth ? new Date(memberData.dateOfBirth.seconds * 1000) : null,
              gender: memberData.gender || '',
              relationshipToMainMember: memberData.relationshipToMainMember || '',
              nationality: memberData.nationality || '',
              idType: memberData.idType as "South African ID" | "Passport",
              idNumber: memberData.idNumber || '',
              dependentStatus: memberData.dependentStatus || 'Active',
              medicalAidNumber: memberData.medicalAidNumber || '',
              employer: memberData.employer || '',
              school: memberData.school || '',
              idDocumentUrl: memberData.idDocumentUrl || null
            },
            contactDetails,
            addressDetails: addressData ? {
              streetAddress: addressData.streetAddress || '',
              city: addressData.city || '',
              stateProvince: addressData.stateProvince || '',
              postalCode: addressData.postalCode || '',
              country: addressData.country || ''
            } : {
              streetAddress: '',
              city: '',
              stateProvince: '',
              postalCode: '',
              country: ''
            }
          };

          updatedDependents.push(dependentData);
        }

        // Update local state with the latest data
        updateDependents(updatedDependents);
      } catch (error) {
        console.error('Error in real-time update:', error);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [contractNumber, updateDependents]);

  // Add useEffect to fetch relationships and statuses
  useEffect(() => {
    const fetchRelationshipsAndStatuses = async () => {
      if (!contractNumber) return;
      
      try {
        // Get all member-contract relationships for this contract
        const relationshipsRef = collection(db, 'member_contract_relationships');
        const relationshipsQuery = query(
          relationshipsRef,
          where('contract_number', '==', contractNumber),
          where('role', '==', 'Dependent')
        );
        const relationshipsSnapshot = await getDocs(relationshipsQuery);
        
        // For each relationship, get the relationship type and status
        const relationshipPromises = relationshipsSnapshot.docs.map(async (doc) => {
          const memberContractRelationshipId = doc.id;
          const memberId = doc.data().member_id;
          
          // Get the relationship type from Relationship collection
          const relationshipTypeQuery = query(
            collection(db, 'Relationship'),
            where('member_contract_relationship_id', '==', memberContractRelationshipId)
          );
          const relationshipTypeSnapshot = await getDocs(relationshipTypeQuery);
          
          // Get the status from Status collection
          const statusQuery = query(
            collection(db, 'Status'),
            where('member_contract_relationship_id', '==', memberContractRelationshipId)
          );
          const statusSnapshot = await getDocs(statusQuery);
          
          return {
            memberId,
            relationshipType: relationshipTypeSnapshot.empty ? null : relationshipTypeSnapshot.docs[0].data().relationshipType,
            status: statusSnapshot.empty ? 'Active' : statusSnapshot.docs[0].data().status
          };
        });
        
        const results = await Promise.all(relationshipPromises);
        
        // Create separate maps for relationships and statuses
        const relationshipMap: { [key: string]: string } = {};
        const statusMap: { [key: string]: string } = {};
        
        results.forEach(result => {
          if (result) {
            if (result.relationshipType) {
              relationshipMap[result.memberId] = result.relationshipType;
            }
            statusMap[result.memberId] = result.status;
          }
        });
        
        setRelationships(relationshipMap);
        setStatuses(statusMap);
      } catch (error) {
        console.error('Error fetching relationships and statuses:', error);
      }
    };

    fetchRelationshipsAndStatuses();
  }, [contractNumber, dependents]);

  // Add function to check for duplicate dependents
  const checkDuplicateDependent = async (idNumber: string): Promise<boolean> => {
    
    setDuplicateCheck(prev => ({ ...prev, checking: true }));
    try {
      const dependentsQuery = query(
        collection(db, 'Dependents'),
        where('idNumber', '==', idNumber),
        where('status', '==', 'Active')
      );
      const snapshot = await getDocs(dependentsQuery);
      const isDuplicate = !snapshot.empty;
      
      setDuplicateCheck({
        checking: false,
        isDuplicate,
        message: isDuplicate ? 'This person is already registered as a dependent' : null
      });
      
      return isDuplicate;
    } catch (error) {
      console.error('Error checking duplicate:', error);
      setDuplicateCheck({
        checking: false,
        isDuplicate: false,
        message: 'Error checking duplicate status'
      });
      return false;
    }
  };

  // Add function to update existing member
  const updateExistingMember = async (memberId: string) => {
    if (!formData) return;
    
    try {
      const memberRef = doc(db, 'Members', memberId);
      await updateDoc(memberRef, {
        ...formData.personalInfo,
        updatedAt: new Date()
      });

      // Get member_contract_relationships record
      const relationshipsRef = collection(db, 'member_contract_relationships');
      const relationshipQuery = query(
        relationshipsRef,
        where('member_id', '==', memberId),
        where('contract_number', '==', contractNumber),
        where('role', '==', 'Dependent')
      );
      const relationshipSnapshot = await getDocs(relationshipQuery);
      
      if (!relationshipSnapshot.empty) {
        const memberContractRelationshipId = relationshipSnapshot.docs[0].id;
        
        // Find the Relationship record using member_contract_relationship_id
        const relationshipTypeQuery = query(
          collection(db, 'Relationship'),
          where('member_contract_relationship_id', '==', memberContractRelationshipId)
        );
        const relationshipTypeSnapshot = await getDocs(relationshipTypeQuery);
        
        if (!relationshipTypeSnapshot.empty) {
          // Update the existing Relationship record
          await updateDoc(relationshipTypeSnapshot.docs[0].ref, {
            relationshipType: formData.personalInfo.relationshipToMainMember,
            updatedAt: new Date()
          });
        } else {
          // Create new Relationship record if it doesn't exist
          await addDoc(collection(db, 'Relationship'), {
            member_contract_relationship_id: memberContractRelationshipId,
            relationshipType: formData.personalInfo.relationshipToMainMember,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      // Update contact details
      const contactsRef = collection(db, 'Contacts');
      const existingContactsQuery = query(contactsRef, where('memberId', '==', memberId));
      const existingContacts = await getDocs(existingContactsQuery);
      
      // Delete existing contacts
      await Promise.all(existingContacts.docs.map(doc => deleteDoc(doc.ref)));
      
      // Add new contacts
      await Promise.all(formData.contactDetails.map(contact =>
        addDoc(contactsRef, {
          ...contact,
          memberId,
          memberIdNumber: formData.personalInfo.idNumber,
          type: 'Dependent',
          updatedAt: new Date()
        })
      ));

      // Update address
      const addressRef = collection(db, 'Address');
      const existingAddressQuery = query(addressRef, where('memberId', '==', memberId));
      const existingAddress = await getDocs(existingAddressQuery);
      
      if (!existingAddress.empty) {
        await updateDoc(existingAddress.docs[0].ref, {
          ...formData.addressDetails,
          updatedAt: new Date()
        });
      } else {
        await addDoc(addressRef, {
          ...formData.addressDetails,
          memberId,
          memberIdNumber: formData.personalInfo.idNumber,
          type: 'Dependent',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating member:', error);
      throw new Error('Failed to update member details');
    }
  };

  const handleAddDependent = async () => {
    try {
      if (!contractNumber || !mainMemberIdNumber) {
        setError('Contract information is missing. Please add main member details first.')
        return
      }

      setIsSaving(true)
      setError(null)

      // Validate all required fields and data
      const validationErrors = validateDependentData(formData, dependents)
      
      if (validationErrors.length > 0) {
        const fieldErrors: { [key: string]: string } = {};

        validationErrors.forEach(error => {
          // Personal Information
          if (error.includes("First Name")) fieldErrors.firstName = error;
          if (error.includes("Last Name")) fieldErrors.lastName = error;
          if (error.includes("Initials")) fieldErrors.initials = error;
          if (error.includes("Date of Birth")) fieldErrors.dateOfBirth = error;
          if (error.includes("Gender")) fieldErrors.gender = error;
          if (error.includes("Relationship")) fieldErrors.relationshipToMainMember = error;
          if (error.includes("Nationality")) fieldErrors.nationality = error;
          if (error.includes("Type of ID")) fieldErrors.idType = error;
          if (error.includes("ID Number") || error.includes("South African ID number")) fieldErrors.idNumber = error;
          if (error.includes("Dependent Status")) fieldErrors.dependentStatus = error;
          if (error.includes("Child dependents")) fieldErrors.relationshipToMainMember = error;

          // Contact Details
          if (error.includes("contact")) {
            const contactIndex = error.match(/contact #(\d+)/)?.[1];
            if (contactIndex) {
              const index = parseInt(contactIndex) - 1;
              if (error.includes("type")) fieldErrors[`contact${index}Type`] = error;
              if (error.includes("value") || error.includes("email") || error.includes("phone")) {
                fieldErrors[`contact${index}Value`] = error;
              }
            }
          }

          // Address Details
          if (error.includes("Street Address")) fieldErrors.streetAddress = error;
          if (error.includes("City")) fieldErrors.city = error;
          if (error.includes("State/Province")) fieldErrors.stateProvince = error;
          if (error.includes("Postal Code") || error.includes("postal code")) fieldErrors.postalCode = error;
          if (error.includes("Country")) fieldErrors.country = error;
        });

        // Pass the field errors to the form
        setError(
          <DependentForm
            data={formData}
            updateData={(data) => {
              setFormData(data);
              setError(null);
            }}
            validationErrors={fieldErrors}
            mainMemberIdNumber={mainMemberIdNumber}
            contractNumber={contractNumber}
          />
        );
        setIsSaving(false);
        return;
      }

      // Check for duplicates
      const isDuplicate = await checkDuplicateDependent(formData.personalInfo.idNumber)
      if (isDuplicate) {
        setError('This person is already registered as a dependent')
        setIsSaving(false)
        return
      }

      let dependentId: string;

      // Check if this is an auto-populated member
      const membersRef = collection(db, 'Members');
      const memberQuery = query(
        membersRef,
        where('idNumber', '==', formData.personalInfo.idNumber),
        where('idType', '==', formData.personalInfo.idType)
      );
      const memberSnapshot = await getDocs(memberQuery);

      if (!memberSnapshot.empty) {
        // This is an existing member - create relationship records
        dependentId = memberSnapshot.docs[0].id;

        // 1. Create member_contract_relationships record
        const relationshipRef = await addDoc(collection(db, 'member_contract_relationships'), {
          member_id: dependentId,
          contract_number: contractNumber,
          role: 'Dependent',
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // 2. Create Relationship record
        const relationshipTypeRef = collection(db, 'Relationship');
        await addDoc(relationshipTypeRef, {
          member_contract_relationship_id: relationshipRef.id,
          relationshipType: formData.personalInfo.relationshipToMainMember,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // 3. Create Status record
        const statusRef = collection(db, 'Status');
        await addDoc(statusRef, {
          member_contract_relationship_id: relationshipRef.id,
          status: formData.personalInfo.dependentStatus,
          createdAt: new Date(),
          updatedAt: new Date()
        });

      } else {
        // This is a new member - save all details
        dependentId = await saveDependentToFirestore(formData, contractNumber, mainMemberIdNumber);
      }

      // Update local state with the new dependent
      const newDependent = {
        ...formData,
        id: dependentId
      }
      updateDependents([...dependents, newDependent])
      
      // Show success message
      toast({
        title: "Success",
        description: "Dependent added successfully",
        variant: "default",
      });
      
      // Reset form and close dialog
      setIsDialogOpen(false)
      setFormData(emptyDependent)
      setError(null)
    } catch (error) {
      console.error('Error adding dependent:', error)
      setError('Failed to add dependent. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditDependent = async () => {
    try {
      if (!contractNumber || !mainMemberIdNumber) {
        setError('Contract information is missing');
        return;
      }

      setIsSaving(true);
      setError(null);

      if (editingIndex !== null) {
        // 1. Update basic info in Members collection
        const membersRef = collection(db, 'Members');
        const memberQuery = query(
          membersRef,
          where('idNumber', '==', formData.personalInfo.idNumber),
          where('idType', '==', formData.personalInfo.idType)
        );
        
        const memberSnapshot = await getDocs(memberQuery);
        if (memberSnapshot.empty) {
          throw new Error('Member not found');
        }
        const memberId = memberSnapshot.docs[0].id;
        
        // Update member in Members collection
        await updateDoc(doc(db, 'Members', memberId), {
          ...formData.personalInfo,
          updatedAt: new Date()
        });

        // 2. Get member_contract_relationships record
        const relationshipsRef = collection(db, 'member_contract_relationships');
        const relationshipQuery = query(
          relationshipsRef,
          where('member_id', '==', memberId),
          where('contract_number', '==', contractNumber),
          where('role', '==', 'Dependent')
        );
        const relationshipSnapshot = await getDocs(relationshipQuery);
        
        if (!relationshipSnapshot.empty) {
          const memberContractRelationshipId = relationshipSnapshot.docs[0].id;
          
          // 3. Find and update the Relationship record
        const relationshipTypeQuery = query(
            collection(db, 'Relationship'),
            where('member_contract_relationship_id', '==', memberContractRelationshipId)
        );
        const relationshipTypeSnapshot = await getDocs(relationshipTypeQuery);
        
          if (!relationshipTypeSnapshot.empty) {
            // Update existing Relationship record
            await updateDoc(relationshipTypeSnapshot.docs[0].ref, {
            relationshipType: formData.personalInfo.relationshipToMainMember,
              updatedAt: new Date()
          });
        } else {
            // Create new Relationship record if it doesn't exist
            await addDoc(collection(db, 'Relationship'), {
              member_contract_relationship_id: memberContractRelationshipId,
              relationshipType: formData.personalInfo.relationshipToMainMember,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }

        // Update contact details
        const contactsRef = collection(db, 'Contacts');
        const existingContactsQuery = query(contactsRef, where('memberId', '==', memberId));
        const existingContacts = await getDocs(existingContactsQuery);
        
        // Delete existing contacts
        await Promise.all(existingContacts.docs.map(doc => deleteDoc(doc.ref)));
        
        // Add new contacts
        await Promise.all(formData.contactDetails.map(contact =>
          addDoc(contactsRef, {
            ...contact,
            memberId,
            memberIdNumber: formData.personalInfo.idNumber,
            createdAt: new Date()
          })
        ));

        // Update address
        const addressRef = collection(db, 'Address');
        const existingAddressQuery = query(addressRef, where('memberId', '==', memberId));
        const existingAddress = await getDocs(existingAddressQuery);
        
        if (!existingAddress.empty) {
          await updateDoc(existingAddress.docs[0].ref, {
            ...formData.addressDetails,
            updatedAt: new Date()
          });
        } else {
          await addDoc(addressRef, {
            ...formData.addressDetails,
            memberId,
            memberIdNumber: formData.personalInfo.idNumber,
            createdAt: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error updating dependent:', error);
      setError(error instanceof Error ? error.message : 'Failed to update dependent');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update dependent details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!isSaving) {
      setIsDialogOpen(false)
      setEditingDependent(null)
      setEditingIndex(null)
      setFormData(emptyDependent)
      setError(null)
    }
  }

  const handleRemoveDependent = async (index: number) => {
    if (!isSaving) {
      try {
        setIsSaving(true)
        const dependentToRemove = dependents[index]
        
        if (dependentToRemove.id && contractNumber) {
          // Update local state to show deleting status
          const updatedDependents = [...dependents]
          updatedDependents[index] = { ...dependentToRemove, isDeleting: true }
          updateDependents(updatedDependents)

          // Remove from Firestore
          await removeDependentFromFirestore(dependentToRemove.id, contractNumber)
          
          // Update local state to remove the dependent
          updateDependents(dependents.filter((_, i) => i !== index))
          setDeleteError(null)
          setIsDeleteDialogOpen(false)
          setDeletingIndex(null)
        }
      } catch (error) {
        console.error('Error removing dependent:', error)
        // Revert the isDeleting state if there's an error
    const updatedDependents = [...dependents]
        if (index < updatedDependents.length) {
          updatedDependents[index] = { ...updatedDependents[index], isDeleting: false }
    updateDependents(updatedDependents)
        }
        setDeleteError(error instanceof Error ? error.message : 'Failed to remove dependent. Please try again.')
      } finally {
        setIsSaving(false)
      }
    }
  }

  const isAtpoliciesLimit = policiesLimit !== null && dependents.length >= policiesLimit
  const isNearpoliciesLimit = policiesLimit !== null && dependents.length >= policiesLimit - 1

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
        <h2 className="text-2xl font-bold">Dependents</h2>
          <div className="flex items-center space-x-2">
            <p className="text-sm text-gray-500">
              Add or manage dependents for this contract
            </p>
            {isCheckingLimit ? (
              <span className="text-sm text-gray-400 flex items-center">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Checking policies limit...
              </span>
            ) : policiesLimit !== null && (
              <span className={`text-sm ${
                isAtpoliciesLimit ? 'text-red-500' : 
                isNearpoliciesLimit ? 'text-yellow-500' : 
                'text-gray-500'
              }`}>
                ({dependents.length}/{policiesLimit} dependents)
                {isAtpoliciesLimit && ' - Maximum limit reached'}
                {isNearpoliciesLimit && !isAtpoliciesLimit && ' - Approaching limit'}
              </span>
            )}
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Dialog 
                  open={isDialogOpen} 
                  onOpenChange={(open) => {
                    if (!isSaving) {
                      setIsDialogOpen(open)
                      if (!open) {
                        setEditingDependent(null)
                        setEditingIndex(null)
                        setFormData(emptyDependent)
                        setError(null)
                      }
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button 
                      id="Add Dependent"
                      onClick={() => {
                        if (!isSaving) {
                          setEditingDependent(null)
                          setEditingIndex(null)
                          setFormData(emptyDependent)
                          setError(null)
                        }
                      }}
                      disabled={isSaving || isAtpoliciesLimit}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Add Dependent
                        </>
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent 
                    className="max-w-4xl max-h-[90vh] overflow-y-auto"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                  >
                    <DialogHeader>
                      <DialogTitle>
                        {editingDependent ? "Edit Dependent" : "Add New Dependent"}
                        {isSaving && <span className="ml-2 text-sm text-gray-500">(Saving...)</span>}
                      </DialogTitle>
                    </DialogHeader>
                    <DependentForm
                      data={editingDependent || formData}
                      updateData={(data) => {
                        setFormData(data);
                        setError(null);
                      }}
                      error={typeof error === 'string' ? error : null}
                      mainMemberIdNumber={mainMemberIdNumber}
                      validationErrors={typeof error !== 'string' && React.isValidElement(error) ? error.props.validationErrors : {}}
                      onCancel={handleCancel}
                      isEditing={!!editingDependent}
                      onSave={async () => {
                        if (editingDependent) {
                          await handleEditDependent();
                        } else {
                          await handleAddDependent();
                        }
                      }}
                      contractNumber={contractNumber}
                    />
                    
                  </DialogContent>
                </Dialog>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isAtpoliciesLimit 
                ? 'Maximum number of dependents reached for your policies'
                : 'Add a new dependent to this contract'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="space-y-4">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Relationship</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Age</th>
              <th className="text-right p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
      {dependents.map((dependent, index) => (
              <tr 
                key={index} 
                className={`border-b hover:bg-gray-50 transition-all duration-200 ${
                  dependent.isDeleting ? 'opacity-50 bg-gray-50' : ''
                }`}
              >
                <td className="p-4">
                  {dependent.personalInfo.firstName} {dependent.personalInfo.lastName}
                </td>
                <td className="p-4">
                  {dependent.id && relationships[dependent.id] ? relationships[dependent.id] : 'Loading...'}
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
                    dependent.id && statuses[dependent.id] === 'Active'
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {dependent.id && statuses[dependent.id] === 'Active' ? (
                      <UserCheck className="w-3 h-3" />
                    ) : (
                      <UserX className="w-3 h-3" />
                    )}
                    {dependent.id ? statuses[dependent.id] || 'Loading...' : dependent.personalInfo.dependentStatus}
                  </span>
                </td>
                <td className="p-4">
                  {dependent.personalInfo.dateOfBirth ? (
                    <span className="text-sm">
                      {new Date().getFullYear() - dependent.personalInfo.dateOfBirth.getFullYear()} years
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">Not specified</span>
                  )}
                </td>
                <td className="p-4 text-right space-x-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={dependent.isDeleting || isSaving}
                          onClick={() => {
                            setEditingDependent(dependent)
                            setEditingIndex(index)
                            setIsDialogOpen(true)
                          }}
                        >
                          {dependent.isDeleting ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Removing...
                            </>
                          ) : 'Edit'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {dependent.isDeleting ? 'Removing dependent...' : 'Edit dependent details'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
                          disabled={dependent.isDeleting || isSaving}
                          onClick={() => {
                            setDeletingIndex(index)
                            setIsDeleteDialogOpen(true)
                          }}
                        >
                          {dependent.isDeleting ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Removing...
                            </>
                          ) : 'Remove'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {dependent.isDeleting ? 'Removing dependent...' : 'Remove this dependent'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </td>
              </tr>
            ))}
            {dependents.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center p-4 text-gray-500">
                  {isCheckingLimit ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Checking policies details...
                    </span>
                  ) : (
                    <span>No dependents added yet</span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog 
        open={isDeleteDialogOpen} 
        onOpenChange={(open) => {
          if (!isSaving) {
            setIsDeleteDialogOpen(open)
            if (!open) {
              setDeletingIndex(null)
              setDeleteError(null)
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteError ? "Error Removing Dependent" : "Confirm Deletion"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {deleteError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {deleteError}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <p className="text-gray-600">Are you sure you want to remove this dependent? This action cannot be undone.</p>
                {deletingIndex !== null && (
                  <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    {deletingIndex !== null && dependents[deletingIndex] && (
                      <>
                        <p className="font-medium">
                          {dependents[deletingIndex].personalInfo.firstName} {dependents[deletingIndex].personalInfo.lastName}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {dependents[deletingIndex].personalInfo.relationshipToMainMember} • {dependents[deletingIndex].personalInfo.dependentStatus}
                        </p>
                        {dependents[deletingIndex].personalInfo.medicalAidNumber && (
                          <p className="text-sm text-gray-500 mt-1">
                            Medical Aid: {dependents[deletingIndex].personalInfo.medicalAidNumber}
                          </p>
                        )}
                        {dependents[deletingIndex].personalInfo.employer && (
                          <p className="text-sm text-gray-500 mt-1">
                            Employer: {dependents[deletingIndex].personalInfo.employer}
                          </p>
                        )}
                        {dependents[deletingIndex].personalInfo.school && (
                          <p className="text-sm text-gray-500 mt-1">
                            School: {dependents[deletingIndex].personalInfo.school}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!isSaving) {
                  setIsDeleteDialogOpen(false)
                  setDeletingIndex(null)
                  setDeleteError(null)
                }
              }}
              disabled={isSaving}
            >
              {deleteError ? 'Close' : 'Cancel'}
            </Button>
            {!deleteError && (
              <Button
                variant="destructive"
                onClick={() => deletingIndex !== null && handleRemoveDependent(deletingIndex)}
                disabled={isSaving}
              >
                {isSaving ? 'Removing...' : 'Remove Dependent'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

