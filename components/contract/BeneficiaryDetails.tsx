"use client"

import { useState, ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertCircle, UserPlus, UserX, UserCheck, AlertTriangle, Percent } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { BeneficiaryForm } from "./BeneficiaryForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { addDoc, collection, deleteDoc, getDocs, query, where } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"

type ValidationErrors = { [key: string]: string } | null;
type MessageError = ReactNode | null;

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

const validateBeneficiaryData = (data: BeneficiaryData, existingBeneficiaries: BeneficiaryData[]): string[] => {
  const errors: string[] = [];

  // Personal Information Validation
  if (!data.personalInfo.title?.trim()) errors.push("Title is required");
  
  // First Name validation
  if (!data.personalInfo.firstName?.trim()) {
    errors.push("First Name: Please enter your first name");
  } else if (data.personalInfo.firstName.length < 2) {
    errors.push("First Name: Must be at least 2 characters long");
  }

  // Last Name validation
  if (!data.personalInfo.lastName?.trim()) {
    errors.push("Last Name: Please enter your last name");
  } else if (data.personalInfo.lastName.length < 2) {
    errors.push("Last Name: Must be at least 2 characters long");
  }

  // Initials validation
  if (!data.personalInfo.initials?.trim()) {
    errors.push("Initials: Please enter your initials");
  } else if (!/^[A-Z]+$/.test(data.personalInfo.initials.trim())) {
    errors.push("Initials: Must contain only capital letters");
  }

  // Date of Birth validation
  if (!data.personalInfo.dateOfBirth) {
    errors.push("Date of Birth: Please select your date of birth");
  } else {
    const today = new Date();
    const birthDate = new Date(data.personalInfo.dateOfBirth);
    if (birthDate > today) {
      errors.push("Date of Birth: Cannot be a future date");
    }
  }

  if (!data.personalInfo.gender?.trim()) errors.push("Gender is required");
  if (!data.personalInfo.relationshipToMainMember?.trim()) errors.push("Relationship to Main Member is required");
  if (!data.personalInfo.nationality?.trim()) errors.push("Nationality is required");
  
  // ID Type and Number validation
  if (!data.personalInfo.idType?.trim()) {
    errors.push("Type of ID is required");
  }
  if (!data.personalInfo.idNumber?.trim()) {
    errors.push("ID Number / Passport Number: Please enter your ID number");
  } else if (data.personalInfo.idType === "South African ID") {
    if (!/^\d{13}$/.test(data.personalInfo.idNumber.trim())) {
      errors.push("ID Number: Must be exactly 13 digits for South African ID");
    }
  } else if (data.personalInfo.idType === "Passport") {
    if (data.personalInfo.idNumber.length < 6) {
      errors.push("Passport Number: Must be at least 6 characters long");
    }
  }

  // Check for duplicate ID numbers
  if (existingBeneficiaries.some(b => 
    b.personalInfo.idNumber === data.personalInfo.idNumber)) {
    errors.push("ID Number / Passport Number: A beneficiary with this ID number already exists");
  }

  // Validate beneficiary percentage
  if (data.personalInfo.beneficiaryPercentage < 1 || 
      data.personalInfo.beneficiaryPercentage > 100) {
    errors.push("Beneficiary percentage must be between 1 and 100");
  }

  // Calculate total percentage including new beneficiary
  const totalPercentage = existingBeneficiaries.reduce(
    (sum, ben) => sum + ben.personalInfo.beneficiaryPercentage,
    0
  ) + data.personalInfo.beneficiaryPercentage;

  if (totalPercentage > 100) {
    errors.push(`Total beneficiary percentage cannot exceed 100%. Current total: ${totalPercentage}%`);
  }

  // Contact Details Validation
  if (!data.contactDetails || data.contactDetails.length === 0) {
    errors.push("At least one contact method is required");
  } else {
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

  // Address Details Validation
  if (!data.addressDetails.streetAddress?.trim()) errors.push("Street Address is required");
  if (!data.addressDetails.city?.trim()) errors.push("City is required");
  if (!data.addressDetails.stateProvince?.trim()) errors.push("State/Province is required");
  if (!data.addressDetails.postalCode?.trim()) errors.push("Postal Code is required");
  if (!data.addressDetails.country?.trim()) errors.push("Country is required");

  // Validate postal code if provided
  if (data.addressDetails.postalCode && 
      !/^\d{4}$/.test(data.addressDetails.postalCode)) {
    errors.push("Invalid South African postal code");
  }

  return errors;
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
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(null)
  const [messageError, setMessageError] = useState<MessageError>(null)
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
        setMessageError('Contract information is missing. Please add main member details first.')
        return
      }

      setIsSaving(true)
      setValidationErrors(null)
      setMessageError(null)

      // Validate all required fields and data
      const validationErrors = validateBeneficiaryData(formData, beneficiaries)
      if (validationErrors.length > 0) {
        const errorMap = validationErrors.reduce((acc: { [key: string]: string }, error) => {
          // Extract field name from error message (everything before the colon)
          const [field, ...messageParts] = error.split(":");
          const message = messageParts.join(":").trim();

          if (field.includes("First Name")) acc.firstName = message || field;
          else if (field.includes("Last Name")) acc.lastName = message || field;
          else if (field.includes("Initials")) acc.initials = message || field;
          else if (field.includes("Date of Birth")) acc.dateOfBirth = message || field;
          else if (field.includes("ID Number") || field.includes("Passport Number")) acc.idNumber = message || field;
          else if (field.includes("Title")) acc.title = message || field;
          else if (field.includes("Gender")) acc.gender = message || field;
          else if (field.includes("Relationship")) acc.relationshipToMainMember = message || field;
          else if (field.includes("Nationality")) acc.nationality = message || field;
          else if (field.includes("Type of ID")) acc.idType = message || field;
          else if (field.includes("contact")) acc.contacts = message || field;
          else if (field.includes("Street Address")) acc.streetAddress = message || field;
          else if (field.includes("City")) acc.city = message || field;
          else if (field.includes("State/Province")) acc.stateProvince = message || field;
          else if (field.includes("Postal Code")) acc.postalCode = message || field;
          else if (field.includes("Country")) acc.country = message || field;
          else if (field.includes("percentage")) acc.beneficiaryPercentage = message || field;
          return acc;
        }, {});

        setValidationErrors(errorMap);
        setMessageError(
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Please correct the following errors:</AlertTitle>
            <AlertDescription>
              <div className="grid grid-cols-2 gap-4 mt-2">
                {Object.entries(errorMap).map(([field, error], index) => (
                  <div key={index} className="space-y-1">
                    <h4 className="font-medium capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</h4>
                    <p className="text-sm">{error}</p>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        );
        setIsSaving(false);
        return;
      }

      // Check for duplicates
      const isDuplicate = await checkDuplicateBeneficiary(formData.personalInfo.idNumber)
      if (isDuplicate) {
        setMessageError('This person is already registered as a beneficiary')
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
      setValidationErrors(null)
    } catch (error) {
      console.error('Error adding beneficiary:', error)
      setMessageError('Failed to add beneficiary. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditBeneficiary = async () => {
    try {
      if (!contractNumber || !mainMemberIdNumber) {
        setMessageError('Contract information is missing')
        return
      }

      setIsSaving(true)
      setValidationErrors(null)
      setMessageError(null)

      if (editingIndex !== null) {
        // Calculate total percentage excluding the current beneficiary
        const otherBeneficiaries = beneficiaries.filter((_, index) => index !== editingIndex)
        
        // Validate all required fields and data
        const validationError = validateBeneficiaryData(formData, otherBeneficiaries)
        if (validationError.length > 0) {
          const errorMap = validationError.reduce((acc: { [key: string]: string }, error) => {
            // Extract field name from error message (everything before the colon)
            const [field, ...messageParts] = error.split(":");
            const message = messageParts.join(":").trim();

            if (field.includes("First Name")) acc.firstName = message || field;
            else if (field.includes("Last Name")) acc.lastName = message || field;
            else if (field.includes("Initials")) acc.initials = message || field;
            else if (field.includes("Date of Birth")) acc.dateOfBirth = message || field;
            else if (field.includes("ID Number") || field.includes("Passport Number")) acc.idNumber = message || field;
            else if (field.includes("Title")) acc.title = message || field;
            else if (field.includes("Gender")) acc.gender = message || field;
            else if (field.includes("Relationship")) acc.relationshipToMainMember = message || field;
            else if (field.includes("Nationality")) acc.nationality = message || field;
            else if (field.includes("Type of ID")) acc.idType = message || field;
            else if (field.includes("contact")) acc.contacts = message || field;
            else if (field.includes("Street Address")) acc.streetAddress = message || field;
            else if (field.includes("City")) acc.city = message || field;
            else if (field.includes("State/Province")) acc.stateProvince = message || field;
            else if (field.includes("Postal Code")) acc.postalCode = message || field;
            else if (field.includes("Country")) acc.country = message || field;
            else if (field.includes("percentage")) acc.beneficiaryPercentage = message || field;
            return acc;
          }, {});

          setValidationErrors(errorMap);
          setMessageError(
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Please correct the following errors:</AlertTitle>
              <AlertDescription>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {Object.entries(errorMap).map(([field, error], index) => (
                    <div key={index} className="space-y-1">
                      <h4 className="font-medium capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</h4>
                      <p className="text-sm">{error}</p>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          );
          setIsSaving(false);
          return;
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
        setValidationErrors(null)
      }
    } catch (error) {
      console.error('Error updating beneficiary:', error)
      setMessageError('Failed to update beneficiary. Please try again.')
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
        setValidationErrors(null)
        setIsDeleteDialogOpen(false)
        setDeletingIndex(null)
      } catch (error) {
        console.error('Error removing beneficiary:', error)
        setMessageError(error instanceof Error ? error.message : 'Failed to remove beneficiary. Please try again.')
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
            {validationErrors && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Validation Error</AlertTitle>
                <AlertDescription>
                  {validationErrors.title || validationErrors.firstName || validationErrors.lastName || validationErrors.initials || validationErrors.dateOfBirth || validationErrors.gender || validationErrors.relationshipToMainMember || validationErrors.nationality || validationErrors.idType || validationErrors.idNumber || validationErrors.contacts || validationErrors.streetAddress || validationErrors.city || validationErrors.stateProvince || validationErrors.postalCode || validationErrors.country}
                </AlertDescription>
              </Alert>
            )}
            <BeneficiaryForm
              data={editingBeneficiary || emptyBeneficiary}
              updateData={(data: BeneficiaryData) => {
                setFormData(data);
                setValidationErrors(null);
              }}
              mainMemberIdNumber={mainMemberIdNumber}
              errors={validationErrors}
            />
            <div className="flex justify-end space-x-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  handleCancel();
                  setValidationErrors(null);
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
              setValidationErrors(null)
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {messageError ? "Error Removing Beneficiary" : "Confirm Deletion"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {messageError ? (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md">
                <p className="font-medium mb-1">Error</p>
                <p className="text-sm">{messageError}</p>
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
                  setValidationErrors(null)
                }
              }}
              disabled={isSaving}
            >
              {messageError ? 'Close' : 'Cancel'}
            </Button>
            {!messageError && (
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

