"use client"

import React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DependentForm } from "./DependentForm"
import { collection, addDoc, query, where, getDocs, doc, getDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, AlertCircle, UserPlus, UserX, UserCheck, AlertTriangle, Plus } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type ErrorState = { [key: string]: string } | null;

type DependentData = {
  id?: string
  isDeleting?: boolean
  personalInfo: {
    firstName: string
    lastName: string
    initials: string
    dateOfBirth: Date | null
    gender: string
    relationshipToMainMember: string
    nationality: string
    idType: "South African ID" | "Passport"
    idNumber: string
    dependentStatus: "Active" | "Inactive"
    medicalAidNumber?: string
    employer?: string
    school?: string
    idDocumentUrl: string | null
  }
  contactDetails: Array<{
    type: "Email" | "Phone Number"
    value: string
  }>
  addressDetails: {
    streetAddress: string
    city: string
    stateProvince: string
    postalCode: string
    country: string
  }
}

type DependentDetailsProps = {
  dependents: DependentData[]
  updateDependents: (dependents: DependentData[]) => void
  contractNumber?: string
  mainMemberIdNumber?: string
}

const emptyDependent: DependentData = {
  isDeleting: false,
  personalInfo: {
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
    // First, save personal info to Dependents collection
    const dependentRef = await addDoc(collection(db, 'Dependents'), {
      ...data.personalInfo,
      contractNumber,
      mainMemberIdNumber,
      type: 'Dependent',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Save contact details with the dependent reference
    const contactPromises = data.contactDetails.map(contact =>
      addDoc(collection(db, 'Contacts'), {
        ...contact,
        dependentId: dependentRef.id,
        contractNumber,
        mainMemberIdNumber,
        type: 'Dependent',
        createdAt: new Date(),
        updatedAt: new Date()
      })
    )

    // Save address details with the dependent reference
    await addDoc(collection(db, 'Address'), {
      ...data.addressDetails,
      dependentId: dependentRef.id,
      contractNumber,
      mainMemberIdNumber,
      type: 'Dependent',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Wait for all contact details to be saved
    await Promise.all(contactPromises)

    // Return the Firestore document ID
    return dependentRef.id
  } catch (error) {
    console.error('Error saving dependent:', error)
    throw error
  }
}

const removeDependentFromFirestore = async (dependentId: string, contractNumber: string): Promise<void> => {
  try {
    // 1. Delete address records
    const addressQuery = query(
      collection(db, 'Address'),
      where('dependentId', '==', dependentId),
      where('contractNumber', '==', contractNumber),
      where('type', '==', 'Dependent')
    )
    const addressSnapshot = await getDocs(addressQuery)
    const addressDeletions = addressSnapshot.docs.map(doc => 
      deleteDoc(doc.ref)
    )
    await Promise.all(addressDeletions)

    // 2. Delete contact records
    const contactsQuery = query(
      collection(db, 'Contacts'),
      where('dependentId', '==', dependentId),
      where('contractNumber', '==', contractNumber),
      where('type', '==', 'Dependent')
    )
    const contactsSnapshot = await getDocs(contactsQuery)
    const contactDeletions = contactsSnapshot.docs.map(doc => 
      deleteDoc(doc.ref)
    )
    await Promise.all(contactDeletions)

    // 3. Finally, delete the dependent record
    const dependentQuery = query(
      collection(db, 'Dependents'),
      where('id', '==', dependentId),
      where('contractNumber', '==', contractNumber),
      where('type', '==', 'Dependent')
    )
    const dependentSnapshot = await getDocs(dependentQuery)
    if (!dependentSnapshot.empty) {
      await deleteDoc(dependentSnapshot.docs[0].ref)
    }
  } catch (error) {
    console.error('Error removing dependent:', error)
    throw new Error('Failed to remove dependent and related records')
  }
}

const validateDependentData = (data: DependentData): string[] => {
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

  const handleAddDependent = async () => {
    try {
      if (!contractNumber || !mainMemberIdNumber) {
        setError('Contract information is missing. Please add main member details first.')
        return
      }

      setIsSaving(true)
      setError(null)

      // Check if we can add more dependents
      const canAddMore = await checkDependentLimit(contractNumber, dependents.length)
      
      if (!canAddMore) {
        setError(`Maximum number of dependents (${policiesLimit}) reached for this policies`)
        setIsSaving(false)
        return
      }

      // Auto-fill date of birth from ID number
      if (formData.personalInfo.idType === "South African ID" && formData.personalInfo.idNumber) {
        const idNumber = formData.personalInfo.idNumber.trim();
        if (idNumber.match(/^\d{6}/)) {
          const yearPrefix = parseInt(idNumber.substring(0, 2)) > 22 ? "19" : "20";
          const year = yearPrefix + idNumber.substring(0, 2);
          const month = idNumber.substring(2, 4);
          const day = idNumber.substring(4, 6);
          
          const dateOfBirth = new Date(`${year}-${month}-${day}`);
          if (!isNaN(dateOfBirth.getTime())) {
            formData.personalInfo.dateOfBirth = dateOfBirth;
          }
        }
      }

      // Validate all required fields and data
      const validationErrors = validateDependentData(formData)
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
            updateData={setFormData}
            validationErrors={fieldErrors}
            mainMemberIdNumber={mainMemberIdNumber}
          />
        );
        setIsSaving(false);
        return;
      }

      // Check for duplicates
      const isDuplicate = await checkDuplicateDependent(formData.personalInfo.idNumber);
      if (isDuplicate) {
        setError('This person is already registered as a dependent');
        return;
      }

      // Save dependent to Firestore
      const dependentId = await saveDependentToFirestore(formData, contractNumber, mainMemberIdNumber)
      
      // Update local state with the new dependent
      const newDependent = {
        ...formData,
        id: dependentId
      }
      updateDependents([...dependents, newDependent])
      
      // Reset form and close dialog
      setIsDialogOpen(false)
      setFormData(emptyDependent)
      setError(null)
    } catch (error) {
      console.error('Error adding dependent:', error)
      setError(error instanceof Error ? error.message : 'Failed to add dependent. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditDependent = async () => {
    try {
      if (!contractNumber || !mainMemberIdNumber) {
        setError('Contract information is missing')
        return
      }

      setIsSaving(true)
      setError(null)

      // Validate required fields
      const validationErrors = validateDependentData(formData);
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
            updateData={setFormData}
            validationErrors={fieldErrors}
            mainMemberIdNumber={mainMemberIdNumber}
          />
        );
        setIsSaving(false);
        return;
      }

      if (editingIndex !== null) {
        // Update dependent in Firestore
        const dependentId = await saveDependentToFirestore(formData, contractNumber, mainMemberIdNumber)
        
        // Update local state
        const updatedDependents = [...dependents]
        updatedDependents[editingIndex] = {
          ...formData,
          id: dependentId
        }
        updateDependents(updatedDependents)
        
        // Reset form and close dialog
        setIsDialogOpen(false)
        setEditingDependent(null)
        setEditingIndex(null)
        setFormData(emptyDependent)
        setError(null)
      }
    } catch (error) {
      console.error('Error updating dependent:', error)
      setError('Failed to update dependent. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

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
                        // Auto-fill date of birth when ID number changes
                        if (data.personalInfo.idType === "South African ID" && 
                            data.personalInfo.idNumber && 
                            data.personalInfo.idNumber.length >= 6) {
                          const idNumber = data.personalInfo.idNumber.trim();
                          if (idNumber.match(/^\d{6}/)) {
                            const yearPrefix = parseInt(idNumber.substring(0, 2)) > 22 ? "19" : "20";
                            const year = yearPrefix + idNumber.substring(0, 2);
                            const month = idNumber.substring(2, 4);
                            const day = idNumber.substring(4, 6);
                            
                            const dateOfBirth = new Date(`${year}-${month}-${day}`);
                            if (!isNaN(dateOfBirth.getTime())) {
                              data.personalInfo.dateOfBirth = dateOfBirth;
                            }
                          }
                        }
                        setFormData(data);
                        setError(null);
                      }}
                      error={typeof error === 'string' ? error : null}
                      mainMemberIdNumber={mainMemberIdNumber}
                      validationErrors={typeof error !== 'string' && React.isValidElement(error) ? error.props.validationErrors : {}}
                    />
                    <div className="flex justify-end space-x-2 mt-4">
                      <Button 
                        variant="outline" 
                        onClick={handleCancel}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={editingDependent ? handleEditDependent : handleAddDependent}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {editingDependent ? 'Updating...' : 'Adding...'}
                          </>
                        ) : (
                          'Save'
                        )}
                      </Button>
                    </div>
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
                  {dependent.personalInfo.relationshipToMainMember}
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
                    dependent.personalInfo.dependentStatus === 'Active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {dependent.personalInfo.dependentStatus === 'Active' ? (
                      <UserCheck className="w-3 h-3" />
                    ) : (
                      <UserX className="w-3 h-3" />
                    )}
                    {dependent.personalInfo.dependentStatus}
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

