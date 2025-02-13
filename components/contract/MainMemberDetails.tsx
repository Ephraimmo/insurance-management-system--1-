"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MainMemberForm } from "./MainMemberForm"
import { Card } from "@/components/ui/card"
import { collection, addDoc, doc, setDoc, query, where, getDocs } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertCircle, FileText, UserPlus, UserCog } from "lucide-react"

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
  const [error, setError] = useState<string | null>(null)

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

  const saveToFirestore = async (data: MainMemberData) => {
    setSaving(true)
    setError(null)
    try {
      if (!selectedPolicies?.policiesId) {
        throw new Error('Please select a plan before adding main member details')
      }

      // First, validate required fields
      if (!data.personalInfo.firstName || !data.personalInfo.lastName || !data.personalInfo.idNumber) {
        throw new Error('Please fill in all required fields (First Name, Last Name, and ID Number)')
      }

      // First, save personal info to Members collection
      const memberRef = await addDoc(collection(db, 'Members'), {
        ...data.personalInfo,
        id: data.personalInfo.idNumber,
        createdAt: new Date()
      })

      // Use the member document ID to link contact details
      const contactPromises = data.contactDetails.map(contact =>
        addDoc(collection(db, 'Contacts'), {
          ...contact,
          memberId: memberRef.id,
          memberIdNumber: data.personalInfo.idNumber,
          createdAt: new Date()
        })
      )
      await Promise.all(contactPromises)

      // Save address details with the member reference
      await addDoc(collection(db, 'Address'), {
        ...data.addressDetails,
        memberId: memberRef.id,
        memberIdNumber: data.personalInfo.idNumber,
        createdAt: new Date()
      })

      // Generate a unique contract number
      const contractNumber = `CNT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`

      // Create contract record with only IDs for plan and catering
      const contractRef = await addDoc(collection(db, 'Contracts'), {
        contractNumber,
        memberId: memberRef.id,
        memberIdNumber: data.personalInfo.idNumber,
        status: 'In Progress',
        policiesId: selectedPolicies?.policiesId || null,
        cateringOptionIds: selectedCateringOptions?.map(option => option.id) || [],
        totalPremium: (selectedPolicies?.premium || 0) + 
          (selectedCateringOptions?.reduce((sum, option) => sum + option.price, 0) || 0),
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // Update local state with contract information
      updateMainMember({
        ...data,
        contractNumber,
        contractId: contractRef.id
      })
      
      setIsDialogOpen(false)
      setIsEditDialogOpen(false)
      setSaving(false)
    } catch (error) {
      console.error('Error saving member data:', error)
      setError(error instanceof Error ? error.message : 'Failed to save member data. Please try again.')
      setSaving(false)
    }
  }

  const updateExistingMember = async (data: MainMemberData) => {
    setSaving(true)
    setError(null)
    try {
      // Validate required fields
      if (!data.personalInfo.firstName || !data.personalInfo.lastName || !data.personalInfo.idNumber) {
        throw new Error('Please fill in all required fields (First Name, Last Name, and ID Number)')
      }

      // Update personal info in Members collection
      const membersQuery = query(
        collection(db, 'Members'),
        where('id', '==', data.personalInfo.idNumber)
      )
      const memberSnapshot = await getDocs(membersQuery)
      if (!memberSnapshot.empty) {
        const memberDoc = memberSnapshot.docs[0]
        await setDoc(doc(db, 'Members', memberDoc.id), {
          ...data.personalInfo,
          id: data.personalInfo.idNumber,
          updatedAt: new Date()
        }, { merge: true })

        // Update contact details
        const contactsQuery = query(
          collection(db, 'Contacts'),
          where('memberIdNumber', '==', data.personalInfo.idNumber)
        )
        const contactSnapshot = await getDocs(contactsQuery)
        const updateContactPromises = contactSnapshot.docs.map((doc) => 
          setDoc(doc.ref, {}, { merge: true })
        )
        // Add new contacts
        const newContactPromises = data.contactDetails.map(contact =>
          addDoc(collection(db, 'Contacts'), {
            ...contact,
            memberIdNumber: data.personalInfo.idNumber,
            updatedAt: new Date()
          })
        )
        await Promise.all([...updateContactPromises, ...newContactPromises])

        // Update address details
        const addressQuery = query(
          collection(db, 'Address'),
          where('memberIdNumber', '==', data.personalInfo.idNumber)
        )
        const addressSnapshot = await getDocs(addressQuery)
        if (!addressSnapshot.empty) {
          await setDoc(addressSnapshot.docs[0].ref, {
            ...data.addressDetails,
            updatedAt: new Date()
          }, { merge: true })
        }

        // Update local state
        updateMainMember({
          ...data,
          contractNumber: mainMember.contractNumber,
          contractId: mainMember.contractId
        })
      }
      
      setIsEditDialogOpen(false)
      setSaving(false)
    } catch (error) {
      console.error('Error updating member data:', error)
      setError(error instanceof Error ? error.message : 'Failed to update member data. Please try again.')
      setSaving(false)
    }
  }

  const handleSubmit = (data: { mainMember: MainMemberData }) => {
    if (mainMember.contractNumber) {
      updateExistingMember(data.mainMember)
    } else {
      saveToFirestore(data.mainMember)
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
                    <Button className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Add Main Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent 
                    className="max-w-4xl max-h-[90vh] overflow-y-auto"
                    onPointerDownOutside={(e) => {
                      if (saving) e.preventDefault()
                    }}
                    onEscapeKeyDown={(e) => {
                      if (saving) e.preventDefault()
                    }}
                  >
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Add Main Member Details
                        {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                      </DialogTitle>
                    </DialogHeader>
                    {error && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <MainMemberForm
                      data={emptyMainMember}
                      updateData={(data) => setFormData(data.mainMember)}
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
                        onClick={() => handleSubmit({ mainMember: formData })}
                        disabled={saving}
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
                <td className="p-4 text-right">
                  {canEdit && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
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
                              <Button variant="outline" size="sm" className="gap-2">
                                <UserCog className="h-4 w-4" />
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent 
                              className="max-w-4xl max-h-[90vh] overflow-y-auto"
                              onPointerDownOutside={(e) => {
                                if (saving) e.preventDefault()
                              }}
                              onEscapeKeyDown={(e) => {
                                if (saving) e.preventDefault()
                              }}
                            >
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <UserCog className="h-5 w-5" />
                                  Edit Main Member Details
                                  {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                                </DialogTitle>
                              </DialogHeader>
                              {error && (
                                <Alert variant="destructive" className="mb-4">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertTitle>Error</AlertTitle>
                                  <AlertDescription>{error}</AlertDescription>
                                </Alert>
                              )}
                              <MainMemberForm
                                data={mainMember}
                                updateData={(data) => setFormData(data.mainMember)}
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
                                  disabled={saving}
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  onClick={() => handleSubmit({ mainMember: formData })}
                                  disabled={saving}
                                  className="gap-2"
                                >
                                  {saving ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Updating...
                                    </>
                                  ) : (
                                    <>
                                      <UserCog className="h-4 w-4" />
                                      Update
                                    </>
                                  )}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TooltipTrigger>
                        <TooltipContent>Edit member details</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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

