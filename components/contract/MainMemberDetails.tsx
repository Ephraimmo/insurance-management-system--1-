"use client"

import { useState, useEffect, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MainMemberForm } from "./MainMemberForm"
import { Card } from "@/components/ui/card"
import { collection, addDoc, doc, setDoc, query, where, getDocs, updateDoc, getDoc, deleteDoc, QuerySnapshot, DocumentData } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertCircle, FileText, UserPlus, UserCog, Pencil } from "lucide-react"
import { validateSouthAfricanID } from "@/src/utils/idValidation"
import { toast } from "@/components/ui/use-toast"
import { createMemberRelationship, checkMainMemberExistingContract } from "@/lib/member-relationship-service"
import { format } from "date-fns"

type MainMemberData = {
  personalInfo: {
    title: string
    firstName: string
    lastName: string
    initials: string
    dateOfBirth: Date | null
    gender: string
    language: string
    maritalStatus: string
    nationality: string
    idType: "South African ID" | "Passport"
    idNumber: string
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
  contractNumber?: string
  contractId?: string
}

interface MainMemberDetailsProps {
  mainMember: MainMemberData
  updateMainMember: (data: MainMemberData) => void
  selectedPolicies?: {
    policiesId: string
    name: string
    coverAmount: string
    premium: number | null
  }
  selectedCateringOptions?: Array<{
    id: string
    name: string
    price: number
  }>
  userRole?: string
}

const emptyMainMember: MainMemberData = {
  personalInfo: {
    title: "",
    firstName: "",
    lastName: "",
    initials: "",
    dateOfBirth: null,
    gender: "",
    language: "",
    maritalStatus: "",
    nationality: "",
    idType: "South African ID",
    idNumber: "",
    idDocumentUrl: null,
  },
  contactDetails: [],
  addressDetails: {
    streetAddress: "",
    city: "",
    stateProvince: "",
    postalCode: "",
    country: "",
  }
}

type ErrorState = { [key: string]: string } | null

export function MainMemberDetails({ 
  mainMember, 
  updateMainMember, 
  selectedPolicies, 
  selectedCateringOptions,
  userRole 
}: MainMemberDetailsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [formData, setFormData] = useState<MainMemberData>(mainMember || emptyMainMember)
  const [saving, setSaving] = useState(false)
  const [existingMember, setExistingMember] = useState<MainMemberData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ErrorState>(null)
  const [editingMember, setEditingMember] = useState<MainMemberData | null>(null)
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string } | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const canEdit = userRole && userRole !== 'View Only'

  // Update formData when mainMember prop changes
  useEffect(() => {
    if (mainMember && mainMember.personalInfo.firstName) {
      setFormData(mainMember)
    }
  }, [mainMember])

  // Initialize component state
  useEffect(() => {
    const storedMember = sessionStorage.getItem('mainMember')
    if (storedMember) {
      const parsedMember = JSON.parse(storedMember)
      setFormData(parsedMember)
      updateMainMember(parsedMember)
    }
  }, [])

  // Save to session storage when main member data changes
  useEffect(() => {
    if (mainMember && mainMember.personalInfo.firstName) {
      sessionStorage.setItem('mainMember', JSON.stringify(mainMember))
    }
  }, [mainMember])

  const validateMainMemberData = (data: MainMemberData): ErrorState => {
    const errors: { [key: string]: string } = {}

    // Personal Information Validation
    if (!data.personalInfo.title) errors.title = 'Title is required'
    if (!data.personalInfo.firstName) errors.firstName = 'First name is required'
    if (!data.personalInfo.lastName) errors.lastName = 'Last name is required'
    if (!data.personalInfo.initials) errors.initials = 'Initials are required'
    if (!data.personalInfo.dateOfBirth) errors.dateOfBirth = 'Date of birth is required'
    if (!data.personalInfo.gender) errors.gender = 'Gender is required'
    if (!data.personalInfo.language) errors.language = 'Language is required'
    if (!data.personalInfo.maritalStatus) errors.maritalStatus = 'Marital status is required'
    if (!data.personalInfo.nationality) errors.nationality = 'Nationality is required'
    if (!data.personalInfo.idType) errors.idType = 'Type of ID is required'
    if (!data.personalInfo.idNumber) errors.idNumber = 'ID number is required'

    // ID validation
    if (data.personalInfo.idNumber && data.personalInfo.idType === "South African ID") {
      if (!validateSouthAfricanID(data.personalInfo.idNumber).isValid) {
        errors.idNumber = 'Invalid South African ID number'
      } else {
        const birthDate = new Date(data.personalInfo.dateOfBirth || '')
        const today = new Date()
        const age = today.getFullYear() - birthDate.getFullYear()
        const monthDiff = today.getMonth() - birthDate.getMonth()
        const adjustedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
          ? age - 1 
          : age

        if (adjustedAge < 18) {
          errors.idNumber = 'Main member must be at least 18 years old to open a contract'
        }
      }
    }

    // Contact Details Validation
    if (!data.contactDetails || data.contactDetails.length === 0) {
      errors.contacts = 'At least one contact method is required'
    } else {
      data.contactDetails.forEach((contact, index) => {
        if (!contact.type) errors[`contact${index}`] = 'Contact type is required'
        if (!contact.value) errors[`contact${index}`] = 'Contact value is required'
        
        if (contact.type === "Email" && contact.value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(contact.value)) {
            errors[`contact${index}`] = 'Invalid email format'
          }
        }
        
        if (contact.type === "Phone Number" && contact.value) {
          const phoneRegex = /^[0-9+\-\s()]{10,}$/
          if (!phoneRegex.test(contact.value)) {
            errors[`contact${index}`] = 'Invalid phone number format'
          }
        }
      })
    }

    // Address Details Validation
    if (!data.addressDetails.streetAddress) errors.streetAddress = 'Street address is required'
    if (!data.addressDetails.city) errors.city = 'City is required'
    if (!data.addressDetails.stateProvince) errors.stateProvince = 'State/Province is required'
    if (!data.addressDetails.postalCode) errors.postalCode = 'Postal code is required'
    if (!data.addressDetails.country) errors.country = 'Country is required'

    return Object.keys(errors).length > 0 ? errors : null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validateMainMemberData(formData)
    if (validationErrors) {
      setError(validationErrors)
      return
    }
    await saveToFirestore(formData)
  }

  const handleEdit = (member: MainMemberData) => {
    setEditingMember(member)
    setFormData(member)
    setIsEditDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!formData || !mainMember.contractNumber) return;

    setSaving(true);
    setIsUpdating(true);
    try {
      // Validate the data before updating
      const errors = validateMainMemberData(formData);
      if (errors) {
        setValidationErrors(errors);
        setSaving(false);
        return;
      }

      // Show updating toast
      toast({
        title: "Updating Member Details",
        description: "Please wait while we update the member information...",
        variant: "default",
      });

      // Get member relationship to find the member ID
      const relationshipsRef = collection(db, 'member_contract_relationships');
      const relationshipQuery = query(
        relationshipsRef,
        where('contract_number', '==', mainMember.contractNumber),
        where('role', '==', 'Main Member')  // Changed from 'Main' to 'Main Member'
      );
      const relationshipSnapshot = await getDocs(relationshipQuery);

      if (relationshipSnapshot.empty) {
        throw new Error('Member relationship not found');
      }

      const memberId = relationshipSnapshot.docs[0].data().member_id;
      
      // Update member in Members collection
      const memberRef = doc(db, 'Members', memberId);
      await updateDoc(memberRef, {
        ...formData.personalInfo,
        updatedAt: new Date(),
        lastModified: new Date(),
        modifiedBy: userRole || 'system'
      });

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
          createdAt: new Date(),
          updatedAt: new Date(),
          modifiedBy: userRole || 'system'
        })
      ));

      // Update address
      const addressRef = collection(db, 'Address');
      const existingAddressQuery = query(addressRef, where('memberId', '==', memberId));
      const existingAddress = await getDocs(existingAddressQuery);
      
      if (!existingAddress.empty) {
        await updateDoc(existingAddress.docs[0].ref, {
          ...formData.addressDetails,
          updatedAt: new Date(),
          modifiedBy: userRole || 'system'
        });
      } else {
        await addDoc(addressRef, {
          ...formData.addressDetails,
          memberId,
          memberIdNumber: formData.personalInfo.idNumber,
          createdAt: new Date(),
          updatedAt: new Date(),
          modifiedBy: userRole || 'system'
        });
      }

      // Update local state
      updateMainMember({
        ...formData,
        contractNumber: mainMember.contractNumber,
        contractId: mainMember.contractId
      });
      
      // Close dialog and reset states
      setIsEditDialogOpen(false);
      setEditingMember(null);
      setValidationErrors(null);
      
      // Show success message
      toast({
        title: "Success",
        description: `Member ${formData.personalInfo.firstName} ${formData.personalInfo.lastName} has been updated successfully.`,
        variant: "default",
      });

    } catch (error) {
      console.error('Error updating member:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update member details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setIsUpdating(false);
    }
  };

  const saveToFirestore = async (data: MainMemberData) => {
    setSaving(true)
    setError(null)
    try {
      // First check if member is already a main member in any contract
      const existingContractCheck = await checkMainMemberExistingContract(data.personalInfo.idNumber);
      if (existingContractCheck.exists) {
        setError({ 
          general: `This member is already a main member in contract ${existingContractCheck.contractNumber}. A member cannot be a main member in multiple contracts.` 
        });
        return;
      }

      // Check if member already exists
      const membersRef = collection(db, 'Members')
      const memberQuery = query(
        membersRef,
        where('idNumber', '==', data.personalInfo.idNumber),
        where('idType', '==', data.personalInfo.idType)
      )
      const memberSnapshot = await getDocs(memberQuery)
      let memberId: string

      if (!memberSnapshot.empty) {
        // Member exists - update their details
        const memberDoc = memberSnapshot.docs[0]
        memberId = memberDoc.id
        await updateDoc(doc(db, 'Members', memberId), {
          ...data.personalInfo,
          updatedAt: new Date()
        })

        // Update contact details
        const contactsRef = collection(db, 'Contacts')
        const existingContactsQuery = query(contactsRef, where('memberId', '==', memberId))
        const existingContacts = await getDocs(existingContactsQuery)
        
        // Delete existing contacts
        await Promise.all(existingContacts.docs.map(doc => deleteDoc(doc.ref)))
        
        // Add new contacts
        await Promise.all(data.contactDetails.map(contact =>
          addDoc(contactsRef, {
            ...contact,
            memberId,
            memberIdNumber: data.personalInfo.idNumber,
            updatedAt: new Date()
          })
        ))

        // Update address
        const addressRef = collection(db, 'Address')
        const existingAddressQuery = query(addressRef, where('memberId', '==', memberId))
        const existingAddress = await getDocs(existingAddressQuery)
        
        if (!existingAddress.empty) {
          await updateDoc(existingAddress.docs[0].ref, {
            ...data.addressDetails,
            updatedAt: new Date()
          })
        } else {
          await addDoc(addressRef, {
            ...data.addressDetails,
            memberId,
            memberIdNumber: data.personalInfo.idNumber,
            createdAt: new Date()
          })
        }
      } else {
        // Create new member
        const memberRef = await addDoc(membersRef, {
          ...data.personalInfo,
          createdAt: new Date()
        })
        memberId = memberRef.id

        // Add contact details
        await Promise.all(data.contactDetails.map(contact =>
          addDoc(collection(db, 'Contacts'), {
            ...contact,
            memberId,
            memberIdNumber: data.personalInfo.idNumber,
            createdAt: new Date()
          })
        ))

        // Add address details
        await addDoc(collection(db, 'Address'), {
          ...data.addressDetails,
          memberId,
          memberIdNumber: data.personalInfo.idNumber,
          createdAt: new Date()
        })
      }

      // Generate contract number
      const contractNumber = `CNT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`

      // Create contract record
      const contractRef = await addDoc(collection(db, 'Contracts'), {
        contractNumber,
        memberId,
        memberIdNumber: data.personalInfo.idNumber,
        status: 'In Progress',
        policiesId: selectedPolicies?.policiesId || null,
        cateringOptionIds: selectedCateringOptions?.map(option => option.id) || [],
        totalPremium: (selectedPolicies?.premium || 0) + 
          (selectedCateringOptions?.reduce((sum, option) => sum + option.price, 0) || 0),
        createdAt: new Date()
      })

      // Create member relationship
      await createMemberRelationship({
        memberId,
        contractNumber,
        role: 'Main Member'
      })

      // Update local state
      updateMainMember({
        ...data,
        contractNumber,
        contractId: contractRef.id
      })

      toast({
        title: "Success",
        description: memberSnapshot.empty ? 
          "Main member added successfully" : 
          "Existing member linked to new contract successfully",
      })

      setIsDialogOpen(false)
      setIsEditDialogOpen(false)
    } catch (error) {
      console.error('Error saving member data:', error)
      setError({ general: error instanceof Error ? error.message : 'Failed to save member data. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4"><Skeleton className="h-4 w-16" /></th>
                <th className="text-left p-4"><Skeleton className="h-4 w-24" /></th>
                <th className="text-left p-4"><Skeleton className="h-4 w-24" /></th>
                <th className="text-left p-4"><Skeleton className="h-4 w-24" /></th>
                <th className="text-right p-4"><Skeleton className="h-4 w-16" /></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="text-center p-8">
                  <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-gray-500">Loading member details...</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Main Member Details</h2>
          <p className="text-sm text-gray-500">Add or manage main member information</p>
        </div>
        {!mainMember.personalInfo.firstName && !existingMember && !loading && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Dialog 
                  open={isDialogOpen} 
                  onOpenChange={(open) => {
                    if (!saving) {
                      setIsDialogOpen(open)
                      if (!open) {
                        setError(null)
                      }
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button id="Add Main Member" className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Add Main Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent 
                    className="max-w-4xl max-h-[90vh] overflow-y-auto"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                  >
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Add Main Member Details
                        {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                      </DialogTitle>
                    </DialogHeader>
                    {error && 'general' in error && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                          {error.general}
                        </AlertDescription>
                      </Alert>
                    )}
                    <MainMemberForm
                      data={emptyMainMember}
                      updateData={setFormData}
                      errors={error || undefined}
                      isDisabled={saving}
                    />
                    <div className="flex justify-end space-x-2 mt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          if (!saving) {
                            setIsDialogOpen(false)
                            setError(null)
                          }
                        }}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSubmit}
                        disabled={saving}
                        id="Save"
                        className="gap-2"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4" />
                            Save
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </TooltipTrigger>
              <TooltipContent>Add new main member details</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="space-y-4">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4">Title</th>
              <th className="text-left p-4">First Name</th>
              <th className="text-left p-4">Last Name</th>
              <th className="text-left p-4">ID Number</th>
              <th className="text-left p-4">Date of Birth</th>
              <th className="text-right p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(mainMember.personalInfo.firstName || existingMember) ? (
              <tr className="border-b hover:bg-gray-50 transition-colors">
                <td className="p-4">
                  {mainMember.personalInfo.title || existingMember?.personalInfo.title}
                </td>
                <td className="p-4">
                  {mainMember.personalInfo.firstName || existingMember?.personalInfo.firstName}
                </td>
                <td className="p-4">
                  {mainMember.personalInfo.lastName || existingMember?.personalInfo.lastName}
                </td>
                <td className="p-4">
                  {mainMember.personalInfo.idNumber || existingMember?.personalInfo.idNumber}
                </td>
                <td className="p-4">
                  {mainMember.personalInfo.dateOfBirth ? 
                    format(mainMember.personalInfo.dateOfBirth, 'dd/MM/yyyy') : 
                    existingMember?.personalInfo.dateOfBirth ? 
                      format(existingMember.personalInfo.dateOfBirth, 'dd/MM/yyyy') : 
                      'N/A'
                  }
                </td>
                <td className="p-4 text-right">
                  {canEdit && (
                    <Dialog 
                      open={isEditDialogOpen} 
                      onOpenChange={(open) => {
                        if (!saving) {
                          setIsEditDialogOpen(open)
                          if (!open) {
                            setError(null)
                          }
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2"
                          onClick={() => handleEdit(mainMember)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent 
                        className="max-w-4xl max-h-[90vh] overflow-y-auto"
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onEscapeKeyDown={(e) => e.preventDefault()}
                      >
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Pencil className="h-5 w-5" />
                            Edit Main Member Details
                            {(saving || isUpdating) ? (
                              <Loader2 className="h-4 w-4 animate-spin ml-2" />
                            ) : null}
                          </DialogTitle>
                        </DialogHeader>
                        {error && 'general' in error && (
                          <Alert variant="destructive" className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>
                              {error.general}
                            </AlertDescription>
                          </Alert>
                        )}
                        <MainMemberForm
                          data={formData}
                          updateData={setFormData}
                          errors={error || undefined}
                          isDisabled={saving || isUpdating}
                        />
                        <div className="flex justify-end space-x-2 mt-4">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              if (!saving) {
                                setIsEditDialogOpen(false)
                                setError(null)
                              }
                            }}
                            disabled={saving || isUpdating}
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleUpdate}
                            disabled={saving || isUpdating}
                            className="gap-2"
                          >
                            {(saving || isUpdating) ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              <>
                                <Pencil className="h-4 w-4" />
                                Update
                              </>
                            )}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={5} className="text-center p-8">
                  {loading ? (
                    <div className="flex flex-col items-center space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-gray-500">Loading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-4">
                      <UserPlus className="h-12 w-12 text-gray-300" />
                      <div className="text-center">
                        <p className="text-gray-500">No main member added yet</p>
                        <p className="text-sm text-gray-400">Click the "Add Main Member" button to get started</p>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {(mainMember.personalInfo.idDocumentUrl || existingMember?.personalInfo.idDocumentUrl) && (
          <div className="flex justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a 
                    href={mainMember.personalInfo.idDocumentUrl || existingMember?.personalInfo.idDocumentUrl || '#'}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-500 hover:text-blue-700"
                  >
                    <FileText className="h-4 w-4" />
                    View ID Document
                  </a>
                </TooltipTrigger>
                <TooltipContent>Open ID document in new tab</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  )
}

