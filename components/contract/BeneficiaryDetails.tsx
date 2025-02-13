"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertCircle, UserPlus, UserX, UserCheck, AlertTriangle, Percent } from "lucide-react"
import { Badge } from "@/components/ui/badge"

import { BeneficiaryForm } from "./BeneficiaryForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { addDoc, collection, deleteDoc, getDocs, query, where } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"

export type BeneficiaryData = {
  id?: string
  isDeleting?: boolean
  personalInfo: {
    title: string
    firstName: string
    lastName: string
    initials: string
    dateOfBirth: Date | null
    gender: string
    relationshipToMainMember: string
    nationality: string
    idType: "South African ID" | "Passport"
    idNumber: string
    beneficiaryPercentage: number
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

type BeneficiaryDetailsProps = {
  beneficiaries: BeneficiaryData[]
  updateBeneficiaries: (beneficiaries: BeneficiaryData[]) => void
  contractNumber?: string
  mainMemberIdNumber?: string
}

const emptyBeneficiary: BeneficiaryData = {
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
    beneficiaryPercentage: 0,
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

const saveBeneficiaryToFirestore = async (
  data: BeneficiaryData,
  contractNumber: string,
  mainMemberIdNumber: string
): Promise<string> => {
  try {
    // 1. Save personal info to Beneficiaries collection
    const beneficiaryRef = await addDoc(collection(db, 'Beneficiaries'), {
      ...data.personalInfo,
      contractNumber,
      mainMemberIdNumber,
      type: 'Beneficiary',
      totalPercentage: data.personalInfo.beneficiaryPercentage,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // 2. Save contact details with the beneficiary reference
    const contactPromises = data.contactDetails.map(contact =>
      addDoc(collection(db, 'Contacts'), {
        ...contact,
        beneficiaryId: beneficiaryRef.id,
        contractNumber,
        mainMemberIdNumber,
        type: 'Beneficiary',
        createdAt: new Date(),
        updatedAt: new Date()
      })
    )

    // 3. Save address details with the beneficiary reference
    await addDoc(collection(db, 'Address'), {
      ...data.addressDetails,
      beneficiaryId: beneficiaryRef.id,
      contractNumber,
      mainMemberIdNumber,
      type: 'Beneficiary',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Wait for all contact details to be saved
    await Promise.all(contactPromises)

    // Return the Firestore document ID
    return beneficiaryRef.id
  } catch (error) {
    console.error('Error saving beneficiary:', error)
    throw error
  }
}

const removeBeneficiaryFromFirestore = async (beneficiaryId: string, contractNumber: string): Promise<void> => {
  try {
    // Start with beneficiary record check first
    const beneficiaryQuery = query(
      collection(db, 'Beneficiaries'),
      where('id', '==', beneficiaryId),
      where('contractNumber', '==', contractNumber)
    )
    const beneficiarySnapshot = await getDocs(beneficiaryQuery)
    if (beneficiarySnapshot.empty) {
      throw new Error('Beneficiary record not found')
    }

    // Store deletion promises
    const deletionPromises: Promise<void>[] = []

    // 1. Check and delete address records
    const addressQuery = query(
      collection(db, 'Address'),
      where('beneficiaryId', '==', beneficiaryId),
      where('contractNumber', '==', contractNumber),
      where('type', '==', 'Beneficiary')
    )
    const addressSnapshot = await getDocs(addressQuery)
    if (addressSnapshot.size > 0) {
      deletionPromises.push(...addressSnapshot.docs.map(doc => deleteDoc(doc.ref)))
    }

    // 2. Check and delete contact records
    const contactsQuery = query(
      collection(db, 'Contacts'),
      where('beneficiaryId', '==', beneficiaryId),
      where('contractNumber', '==', contractNumber),
      where('type', '==', 'Beneficiary')
    )
    const contactsSnapshot = await getDocs(contactsQuery)
    if (contactsSnapshot.size > 0) {
      deletionPromises.push(...contactsSnapshot.docs.map(doc => deleteDoc(doc.ref)))
    }

    // 3. Add beneficiary record deletion to promises
    deletionPromises.push(deleteDoc(beneficiarySnapshot.docs[0].ref))

    // Execute all deletions concurrently
    await Promise.all(deletionPromises)
  } catch (error) {
    console.error('Error removing beneficiary:', error)
    if (error instanceof Error) {
      if (error.message === 'Beneficiary record not found') {
        throw new Error('Cannot find the beneficiary record to delete')
      }
      throw new Error(`Failed to remove beneficiary: ${error.message}`)
    }
    throw new Error('An unexpected error occurred while removing the beneficiary')
  }
}

const validateBeneficiaryPercentage = async (
  contractNumber: string, 
  currentPercentage: number, 
  existingBeneficiaries: BeneficiaryData[]
): Promise<boolean> => {
  try {
    // Calculate total percentage of existing beneficiaries
    const totalExistingPercentage = existingBeneficiaries.reduce(
      (sum, beneficiary) => sum + beneficiary.personalInfo.beneficiaryPercentage,
      0
    )

    // Check if adding the new percentage would exceed 100%
    const totalPercentage = totalExistingPercentage + currentPercentage
    return totalPercentage <= 100
  } catch (error) {
    console.error('Error validating beneficiary percentage:', error)
    return false
  }
}

const validateBeneficiaryData = (data: BeneficiaryData, existingBeneficiaries: BeneficiaryData[]): string | null => {
  // First validate required fields with proper type checking and validation
  const requiredFields = [
    { 
      field: 'firstName', 
      label: 'First Name',
      validate: (value: any) => typeof value === 'string' && value.trim().length > 0
    },
    { 
      field: 'lastName', 
      label: 'Last Name',
      validate: (value: any) => typeof value === 'string' && value.trim().length > 0
    },
    { 
      field: 'idNumber', 
      label: 'ID Number',
      validate: (value: any) => typeof value === 'string' && value.trim().length > 0
    },
    { 
      field: 'relationshipToMainMember', 
      label: 'Relationship to Main Member',
      validate: (value: any) => typeof value === 'string' && value.trim().length > 0
    },
    { 
      field: 'beneficiaryPercentage', 
      label: 'Benefit Percentage',
      validate: (value: any) => typeof value === 'number' && value > 0 && value <= 100
    }
  ]

  const missingFields = requiredFields
    .filter(({ field, validate }) => {
      const value = data.personalInfo[field as keyof typeof data.personalInfo]
      return !validate(value)
    })
    .map(({ label }) => label)

  if (missingFields.length > 0) {
    return `Please3 complete the following required fields: ${missingFields.join(', ')}`
  }

  // Validate ID Number format for South African IDs
  if (data.personalInfo.idType === "South African ID" && 
      !/^\d{13}$/.test(data.personalInfo.idNumber)) {
    return "South African ID number must be 13 digits"
  }

  // Check for duplicate ID numbers
  if (existingBeneficiaries.some(b => 
    b.personalInfo.idNumber === data.personalInfo.idNumber)) {
    return "A beneficiary with this ID number already exists"
  }

  // Validate beneficiary percentage
  if (data.personalInfo.beneficiaryPercentage < 1 || 
      data.personalInfo.beneficiaryPercentage > 100) {
    return "Beneficiary percentage must be between 1 and 100"
  }

  // Calculate total percentage including new beneficiary
  const totalPercentage = existingBeneficiaries.reduce(
    (sum, ben) => sum + ben.personalInfo.beneficiaryPercentage,
    0
  ) + data.personalInfo.beneficiaryPercentage

  if (totalPercentage > 100) {
    return `Total beneficiary percentage cannot exceed 100%. Current total: ${totalPercentage}%`
  }

  // Validate contact details if any are provided
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

  // Validate postal code if provided
  if (data.addressDetails.postalCode && 
      !/^\d{4}$/.test(data.addressDetails.postalCode)) {
    return "Invalid South African postal code"
  }

  return null
}

export function BeneficiaryDetails({ 
  beneficiaries, 
  updateBeneficiaries,
  contractNumber,
  mainMemberIdNumber 
}: BeneficiaryDetailsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)
  const [editingBeneficiary, setEditingBeneficiary] = useState<BeneficiaryData | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState<BeneficiaryData>(emptyBeneficiary)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [duplicateCheck, setDuplicateCheck] = useState<{
    checking: boolean;
    isDuplicate: boolean;
    message: string | null;
  }>({
    checking: false,
    isDuplicate: false,
    message: null
  });

  const handleAddBeneficiary = async () => {
    try {
      if (!contractNumber || !mainMemberIdNumber) {
        setError('Contract information is missing. Please add main member details first.')
        return
      }

      setIsSaving(true)
      setError(null)

      // Validate all required fields and data
      const validationError = validateBeneficiaryData(formData, beneficiaries)
      if (validationError) {
        setError(validationError)
        setIsSaving(false)
        return
      }

      // Check for duplicates
      const isDuplicate = await checkDuplicateBeneficiary(formData.personalInfo.idNumber)
      if (isDuplicate) {
        setError('This person is already registered as a beneficiary')
        setIsSaving(false)
        return
      }

      // Save beneficiary to Firestore
      const beneficiaryId = await saveBeneficiaryToFirestore(formData, contractNumber, mainMemberIdNumber)
      
      // Update local state with the new beneficiary
      const newBeneficiary = {
        ...formData,
        id: beneficiaryId
      }
      updateBeneficiaries([...beneficiaries, newBeneficiary])
      
      // Reset form and close dialog
      setIsDialogOpen(false)
      setFormData(emptyBeneficiary)
      setError(null)
    } catch (error) {
      console.error('Error adding beneficiary:', error)
      setError('Failed to add beneficiary. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditBeneficiary = async () => {
    try {
      if (!contractNumber || !mainMemberIdNumber) {
        setError('Contract information is missing')
        return
      }

      setIsSaving(true)
      setError(null)

      if (editingIndex !== null) {
        // Calculate total percentage excluding the current beneficiary
        const otherBeneficiaries = beneficiaries.filter((_, index) => index !== editingIndex)
        
        // Validate all required fields and data
        const validationError = validateBeneficiaryData(formData, otherBeneficiaries)
        if (validationError) {
          setError(validationError)
          setIsSaving(false)
          return
        }

        // Update beneficiary in Firestore
        const beneficiaryId = await saveBeneficiaryToFirestore(formData, contractNumber, mainMemberIdNumber)
        
        // Update local state
        const updatedBeneficiaries = [...beneficiaries]
        updatedBeneficiaries[editingIndex] = {
          ...formData,
          id: beneficiaryId
        }
    updateBeneficiaries(updatedBeneficiaries)
        
        // Reset form and close dialog
        setIsDialogOpen(false)
        setEditingBeneficiary(null)
        setEditingIndex(null)
        setFormData(emptyBeneficiary)
        setError(null)
      }
    } catch (error) {
      console.error('Error updating beneficiary:', error)
      setError('Failed to update beneficiary. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsDialogOpen(false)
    setEditingBeneficiary(null)
    setEditingIndex(null)
    setFormData(emptyBeneficiary)
  }

  const handleRemoveBeneficiary = async (index: number) => {
    if (!isSaving) {
      try {
        setIsSaving(true)
        const beneficiaryToRemove = beneficiaries[index]
        
        if (!beneficiaryToRemove.id || !contractNumber) {
          throw new Error('Missing beneficiary ID or contract number')
        }

        // Show loading state in UI
    const updatedBeneficiaries = [...beneficiaries]
        updatedBeneficiaries[index] = {
          ...beneficiaryToRemove,
          isDeleting: true
        }
    updateBeneficiaries(updatedBeneficiaries)

        // Remove from Firestore
        await removeBeneficiaryFromFirestore(beneficiaryToRemove.id, contractNumber)
        
        // Update local state only after successful Firestore deletion
        updateBeneficiaries(beneficiaries.filter((_, i) => i !== index))
        setError(null)
        setIsDeleteDialogOpen(false)
        setDeletingIndex(null)
      } catch (error) {
        console.error('Error removing beneficiary:', error)
        setError(error instanceof Error ? error.message : 'Failed to remove beneficiary. Please try again.')
      } finally {
        setIsSaving(false)
      }
    }
  }

  // Add function to check for duplicate beneficiaries
  const checkDuplicateBeneficiary = async (idNumber: string): Promise<boolean> => {
    setDuplicateCheck(prev => ({ ...prev, checking: true }));
    try {
      const beneficiariesQuery = query(
        collection(db, 'Beneficiaries'),
        where('idNumber', '==', idNumber),
        where('status', '==', 'Active')
      );
      const snapshot = await getDocs(beneficiariesQuery);
      const isDuplicate = !snapshot.empty;
      
      setDuplicateCheck({
        checking: false,
        isDuplicate,
        message: isDuplicate ? 'This person is already registered as a beneficiary' : null
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Beneficiaries</h2>
        <Dialog 
          open={isDialogOpen} 
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingBeneficiary(null);
              setEditingIndex(null);
              setFormData(emptyBeneficiary);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingBeneficiary(null)
              setEditingIndex(null)
              setFormData(emptyBeneficiary)
            }}>
              Add Beneficiary
            </Button>
          </DialogTrigger>
          <DialogContent 
            className="max-w-4xl max-h-[90vh] overflow-y-auto"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>
                {editingBeneficiary ? "Edit Beneficiary" : "Add New Beneficiary"}
              </DialogTitle>
            </DialogHeader>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md">
                <p className="font-medium mb-1">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            )}
            <BeneficiaryForm
              data={editingBeneficiary || emptyBeneficiary}
              updateData={(data: BeneficiaryData) => {
                setFormData(data);
                setError(null); // Clear error when form data changes
              }}
            />
            <div className="flex justify-end space-x-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  handleCancel();
                  setError(null);
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button 
                onClick={editingBeneficiary ? handleEditBeneficiary : handleAddBeneficiary}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Beneficiaries</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              Total Allocation: {beneficiaries.reduce((sum, ben) => 
                sum + ben.personalInfo.beneficiaryPercentage, 0
              )}%
            </span>
            {beneficiaries.reduce((sum, ben) => 
              sum + ben.personalInfo.beneficiaryPercentage, 0
            ) === 100 ? (
              <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
                <Percent className="w-3 h-3" />
                Complete
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 bg-yellow-50 text-yellow-700 border-yellow-200">
                <AlertTriangle className="w-3 h-3" />
                Incomplete
              </Badge>
            )}
          </div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Relationship</th>
              <th className="text-left p-4">Percentage</th>
              <th className="text-left p-4">Status</th>
              <th className="text-right p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
      {beneficiaries.map((beneficiary, index) => (
              <tr 
                key={index} 
                className={`border-b hover:bg-gray-50 transition-all duration-200 ${
                  beneficiary.isDeleting ? 'opacity-50 bg-gray-50' : ''
                }`}
              >
                <td className="p-4">
                  {beneficiary.personalInfo.title} {beneficiary.personalInfo.firstName} {beneficiary.personalInfo.lastName}
                </td>
                <td className="p-4">
                  {beneficiary.personalInfo.relationshipToMainMember}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${beneficiary.personalInfo.beneficiaryPercentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {beneficiary.personalInfo.beneficiaryPercentage}%
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-green-100 text-green-700">
                    <UserCheck className="w-3 h-3" />
                    Active
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={beneficiary.isDeleting}
                    onClick={() => {
                      setEditingBeneficiary(beneficiary)
                      setEditingIndex(index)
                      setIsDialogOpen(true)
                    }}
                  >
                    Edit
                  </Button>
            <Button
              variant="destructive"
              size="sm"
                    disabled={beneficiary.isDeleting || isSaving}
                    onClick={() => {
                      setDeletingIndex(index)
                      setIsDeleteDialogOpen(true)
                    }}
                  >
                    {beneficiary.isDeleting ? 'Removing...' : 'Remove'}
                  </Button>
                </td>
              </tr>
            ))}
            {beneficiaries.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center p-4 text-gray-500">
                  No beneficiaries added yet
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
              {error ? "Error Removing Beneficiary" : "Confirm Deletion"}
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
                <p className="text-gray-600">Are you sure you want to remove this beneficiary? This action cannot be undone.</p>
                {deletingIndex !== null && (
                  <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="font-medium">
                      {beneficiaries[deletingIndex].personalInfo.title} {beneficiaries[deletingIndex].personalInfo.firstName} {beneficiaries[deletingIndex].personalInfo.lastName}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {beneficiaries[deletingIndex].personalInfo.relationshipToMainMember} • {beneficiaries[deletingIndex].personalInfo.beneficiaryPercentage}%
                    </p>
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
                onClick={() => deletingIndex !== null && handleRemoveBeneficiary(deletingIndex)}
                disabled={isSaving}
              >
                {isSaving ? 'Removing...' : 'Remove Beneficiary'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

