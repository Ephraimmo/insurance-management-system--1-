"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DependentForm } from "./DependentForm"
import { collection, addDoc, query, where, getDocs, doc, getDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, AlertCircle, UserPlus, UserX, UserCheck, AlertTriangle } from "lucide-react"

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

const validateDependentData = (data: DependentData): string | null => {
  // Validate ID Number format for South African IDs
  if (data.personalInfo.idType === "South African ID" && 
      !/^\d{13}$/.test(data.personalInfo.idNumber)) {
    return "South African ID number must be 13 digits"
  }

  // Validate age based on relationship
  if (data.personalInfo.dateOfBirth) {
    const age = new Date().getFullYear() - data.personalInfo.dateOfBirth.getFullYear()
    
    if (data.personalInfo.relationshipToMainMember === "Child" && age >= 21) {
      return "Child dependents must be under 21 years old"
    }
  }

  // Validate contact details
  if (data.contactDetails.length > 0) {
    for (const contact of data.contactDetails) {
      if (contact.type === "Email" && 
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.value)) {
        return "Invalid email format"
      }
      if (contact.type === "Phone Number" && 
          !/^(\+27|0)\d{9}$/.test(contact.value)) {
        return "Invalid South African phone number format"
      }
    }
  }

  // Validate postal code
  if (!/^\d{4}$/.test(data.addressDetails.postalCode)) {
    return "Invalid South African postal code"
  }

  return null
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
  const [error, setError] = useState<string | null>(null)
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

      // Validate required fields
      if (!formData.personalInfo.firstName || !formData.personalInfo.lastName || !formData.personalInfo.idNumber) {
        setError('Please fill in all required fields (First Name, Last Name, and ID Number)')
        setIsSaving(false)
        return
      }

      // Additional validation
      const validationError = validateDependentData(formData);
      if (validationError) {
        setError(validationError);
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
      if (!formData.personalInfo.firstName || !formData.personalInfo.lastName || !formData.personalInfo.idNumber) {
        setError('Please fill in all required fields (First Name, Last Name, and ID Number)')
        setIsSaving(false)
        return
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
          setError(null)
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
        setError(error instanceof Error ? error.message : 'Failed to remove dependent. Please try again.')
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
                        'Add Dependent'
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent 
                    className="max-w-4xl max-h-[90vh] overflow-y-auto"
                    onPointerDownOutside={(e) => {
                      if (isSaving) {
                        e.preventDefault()
                      }
                    }}
                    onEscapeKeyDown={(e) => {
                      if (isSaving) {
                        e.preventDefault()
                      }
                    }}
                  >
                    <DialogHeader>
                      <DialogTitle>
                        {editingDependent ? "Edit Dependent" : "Add New Dependent"}
                        {isSaving && <span className="ml-2 text-sm text-gray-500">(Saving...)</span>}
                      </DialogTitle>
                    </DialogHeader>
                    {error && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md">
                        <p className="font-medium mb-1">Error</p>
                        <p className="text-sm">{error}</p>
                        {error.includes('Maximum number') && (
                          <p className="text-sm mt-2">
                            Please upgrade your policies to add more dependents or remove existing ones.
                            Current policies limit: {policiesLimit} dependents.
                          </p>
                        )}
                        {error.includes('Contract information') && (
                          <p className="text-sm mt-2">Please complete the main member details before adding dependents.</p>
                        )}
                        {error.includes('required fields') && (
                          <p className="text-sm mt-2">All marked fields must be completed to proceed.</p>
                        )}
                        {error.includes('policies not found') && (
                          <p className="text-sm mt-2">Please select a valid policies for this contract first.</p>
                        )}
                      </div>
                    )}
                    <DependentForm
                      data={editingDependent || formData}
                      updateData={(data) => {
                        setFormData(data)
                        setError(null) // Clear error when form data changes
                      }}
                      error={error}
                    />
                    <div className="flex justify-end space-x-2 mt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          if (!isSaving) {
                            setIsDialogOpen(false)
                            setEditingDependent(null)
                            setEditingIndex(null)
                            setFormData(emptyDependent)
                            setError(null)
                          }
                        }}
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
              setError(null)
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {error ? "Error Removing Dependent" : "Confirm Deletion"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {error ? (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md">
                <p className="font-medium mb-1">Error</p>
                <p className="text-sm">{error}</p>
                <p className="text-sm mt-2">Please try again or contact support if the problem persists.</p>
              </div>
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
                  setError(null)
                }
              }}
              disabled={isSaving}
            >
              {error ? 'Close' : 'Cancel'}
            </Button>
            {!error && (
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

