"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { collection, getDocs, query, where, orderBy, doc, updateDoc, addDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { Loader2, Search, CalendarIcon, X, UserPlus, Users, ArrowLeft, Pencil, Plus, Trash2, AlertCircle, Check } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import { DatePicker } from "@/components/ui/date-picker"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/components/ui/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

interface MemberData {
  id: string
  title: string
  firstName: string
  lastName: string
  initials: string
  idNumber: string
  dateOfBirth: Date | null
  gender: string
  language: string
  maritalStatus: string
  nationality: string
  idType: "South African ID" | "Passport"
  idDocumentUrl: string | null
  type: 'Main' | 'Dependent' | 'Beneficiary'
  medicalAidNumber?: string
  employer?: string
  school?: string
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

interface SearchFilters {
  idNumber: string
  firstName: string
  lastName: string
  dateOfBirth: Date | null
  contactInfo: string
}

export function Customers() {
  const [members, setMembers] = useState<MemberData[]>([])
  const [loading, setLoading] = useState(true)
  const [idType, setIdType] = useState("All")
  const [error, setError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    idNumber: "",
    firstName: "",
    lastName: "",
    dateOfBirth: null,
    contactInfo: ""
  })
  const [selectedMember, setSelectedMember] = useState<MemberData | null>(null)
  const [isEditingMember, setIsEditingMember] = useState(false)
  const [editedMember, setEditedMember] = useState<MemberData | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [isAddingContact, setIsAddingContact] = useState(false)
  const [newContact, setNewContact] = useState<{
    type: "Email" | "Phone Number" | "select"
    value: string
  }>({ type: "select", value: "" })
  const [contactError, setContactError] = useState<string | null>(null)
  const [isSavingContact, setIsSavingContact] = useState(false)
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null)
  const [isUpdatingContact, setIsUpdatingContact] = useState(false)
  const [editedContact, setEditedContact] = useState<{
    type: "Email" | "Phone Number"
    value: string
  } | null>(null)
  const [isDeletingContact, setIsDeletingContact] = useState(false)
  const [deletingContactIndex, setDeletingContactIndex] = useState<number | null>(null)
  const [isEditingAddress, setIsEditingAddress] = useState(false)
  const [editedAddress, setEditedAddress] = useState<{
    streetAddress: string
    city: string
    stateProvince: string
    postalCode: string
    country: string
  } | null>(null)
  const [isUpdatingAddress, setIsUpdatingAddress] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [isSavingMember, setIsSavingMember] = useState(false)
  const [newMember, setNewMember] = useState<Omit<MemberData, 'id' | 'contactDetails' | 'addressDetails'> | null>(null)
  const [isAddingAddress, setIsAddingAddress] = useState(false)
  const [isSavingAddress, setIsSavingAddress] = useState(false)
  const [newAddress, setNewAddress] = useState<{
    streetAddress: string
    city: string
    stateProvince: string
    postalCode: string
    country: string
  }>({
    streetAddress: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: ''
  })

  useEffect(() => {
    fetchMembers()
  }, [])

  const fetchMembers = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get all members
      const membersRef = collection(db, 'Members')
      const membersSnapshot = await getDocs(membersRef)
      
      const membersPromises = membersSnapshot.docs.map(async (doc) => {
        const memberData = doc.data()
        
        // Get contact details for this member
        const contactsRef = collection(db, 'Contacts')
        const contactsQuery = query(contactsRef, where('memberId', '==', doc.id))
        const contactsSnapshot = await getDocs(contactsQuery)
        const contactDetails = contactsSnapshot.docs.map(contactDoc => ({
          type: contactDoc.data().type as "Email" | "Phone Number",
          value: contactDoc.data().value
        }))

        // Get address details for this member
        const addressRef = collection(db, 'Address')
        const addressQuery = query(addressRef, where('memberId', '==', doc.id))
        const addressSnapshot = await getDocs(addressQuery)
        const addressDetails = !addressSnapshot.empty ? {
          streetAddress: addressSnapshot.docs[0].data().streetAddress || '',
          city: addressSnapshot.docs[0].data().city || '',
          stateProvince: addressSnapshot.docs[0].data().stateProvince || '',
          postalCode: addressSnapshot.docs[0].data().postalCode || '',
          country: addressSnapshot.docs[0].data().country || ''
        } : {
          streetAddress: '',
          city: '',
          stateProvince: '',
          postalCode: '',
          country: ''
        }
        
        return {
          id: doc.id,
          title: memberData.title || '',
          firstName: memberData.firstName || '',
          lastName: memberData.lastName || '',
          initials: memberData.initials || '',
          idNumber: memberData.idNumber || '',
          dateOfBirth: memberData.dateOfBirth ? new Date(memberData.dateOfBirth.seconds * 1000) : null,
          gender: memberData.gender || '',
          language: memberData.language || '',
          maritalStatus: memberData.maritalStatus || '',
          nationality: memberData.nationality || '',
          idType: memberData.idType || 'South African ID',
          idDocumentUrl: memberData.idDocumentUrl || null,
          type: memberData.type || 'Main',
          medicalAidNumber: memberData.medicalAidNumber || '',
          employer: memberData.employer || '',
          school: memberData.school || '',
          contactDetails,
          addressDetails
        }
      })

      const membersData = await Promise.all(membersPromises)
      setMembers(membersData)
    } catch (error) {
      console.error('Error fetching members:', error)
      setError('Failed to fetch members. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (field: keyof SearchFilters, value: string | Date | null) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const clearFilters = () => {
    setFilters({
      idNumber: "",
      firstName: "",
      lastName: "",
      dateOfBirth: null,
      contactInfo: ""
    })
    setIdType("All")
  }

  const formatDate = (date: Date | null): string | null => {
    return date ? format(date, 'yyyy/MM/dd') : null;
  }

  const filteredMembers = members.filter(member => {
    // ID Type filter
    if (idType !== "All" && member.idType !== idType) {
      return false;
    }

    // ID Number filter
    if (filters.idNumber && !member.idNumber.toLowerCase().includes(filters.idNumber.toLowerCase())) {
      return false;
    }

    // First Name filter
    if (filters.firstName && !member.firstName.toLowerCase().includes(filters.firstName.toLowerCase())) {
      return false;
    }

    // Last Name filter
    if (filters.lastName && !member.lastName.toLowerCase().includes(filters.lastName.toLowerCase())) {
      return false;
    }

    // Date of Birth filter
    if (filters.dateOfBirth) {
      const memberDate = member.dateOfBirth ? format(member.dateOfBirth, 'yyyy/MM/dd') : null;
      const filterDate = filters.dateOfBirth ? format(filters.dateOfBirth, 'yyyy/MM/dd') : null;
      if (memberDate !== filterDate) {
        return false;
      }
    }

    // Contact Info filter
    if (filters.contactInfo) {
      const hasMatchingContact = member.contactDetails.some(contact =>
        contact.value.toLowerCase().includes(filters.contactInfo.toLowerCase())
      );
      if (!hasMatchingContact) {
        return false;
      }
    }

    return true;
  });

  const handleViewMember = (memberId: string) => {
    const member = members.find(m => m.id === memberId)
    if (member) {
      setSelectedMember(member)
      setIsAddingMember(false)
      setIsEditingMember(false)
      setEditedMember(null)
      setNewMember(null)
      setUpdateError(null)
    }
  }

  const handleBack = () => {
    setSelectedMember(null)
  }

  const handleEditMember = () => {
    setIsEditingMember(true)
    setEditedMember(selectedMember)
  }

  const handleUpdateMember = async () => {
    try {
      setIsUpdating(true)
      setUpdateError(null)

      // Validate that no field is empty
      const requiredFields = [
        'title', 'firstName', 'lastName', 'initials', 'language',
        'maritalStatus', 'nationality', 'type', 'idType', 'idNumber'
      ]

      const missingFields = requiredFields.filter(field => 
        !editedMember || !editedMember[field as keyof MemberData]
      )

      if (missingFields.length > 0) {
        setUpdateError(`Please fill in all required fields: ${missingFields.join(', ')}`)
        return
      }

      if (!selectedMember?.id || !editedMember) {
        setUpdateError('No member selected for update')
        return
      }

      // Validate ID number
      const idError = await validateMemberID(
        editedMember.idType,
        editedMember.idNumber,
        selectedMember.id
      );

      if (idError) {
        setUpdateError(idError);
        return;
      }

      // Update member in Firestore
      const memberRef = doc(db, 'Members', selectedMember.id)
      await updateDoc(memberRef, {
        title: editedMember.title,
        firstName: editedMember.firstName,
        lastName: editedMember.lastName,
        initials: editedMember.initials,
        idType: editedMember.idType,
        idNumber: editedMember.idNumber,
        dateOfBirth: editedMember.dateOfBirth,
        gender: editedMember.gender,
        language: editedMember.language,
        maritalStatus: editedMember.maritalStatus,
        nationality: editedMember.nationality,
        type: editedMember.type,
        medicalAidNumber: editedMember.medicalAidNumber || null,
        employer: editedMember.employer || null,
        school: editedMember.school || null,
        updatedAt: new Date()
      })

      // Update the selected member state with new data
      setSelectedMember({
        ...selectedMember,
        ...editedMember
      })

      // Exit edit mode
      setIsEditingMember(false)
      setEditedMember(null)

      toast({
        title: "Success",
        description: "Member details updated successfully",
      })
    } catch (error) {
      console.error('Error updating member:', error)
      setUpdateError('Failed to update member details. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleMemberFieldChange = (field: keyof MemberData, value: string) => {
    if (editedMember) {
      setEditedMember({
        ...editedMember,
        [field]: value
      })
    }
  }

  const handleEditContact = (contactIndex: number) => {
    setEditingContactIndex(contactIndex)
    setEditedContact({
      type: selectedMember!.contactDetails[contactIndex].type,
      value: selectedMember!.contactDetails[contactIndex].value
    })
    setContactError(null)
  }

  const handleUpdateContact = async (contactIndex: number) => {
    try {
      if (!selectedMember?.id || !editedContact) return

      const validationError = validateContact(editedContact.type, editedContact.value)
      if (validationError) {
        setContactError(validationError)
        return
      }

      setIsUpdatingContact(true)
      setContactError(null)

      // Get the existing contact document
      const contactsRef = collection(db, 'Contacts')
      const contactsQuery = query(contactsRef, where('memberId', '==', selectedMember.id))
      const contactsSnapshot = await getDocs(contactsQuery)
      const contactDocs = contactsSnapshot.docs

      if (contactIndex >= 0 && contactIndex < contactDocs.length) {
        // Update the contact in Firestore
        await updateDoc(contactDocs[contactIndex].ref, {
          type: editedContact.type,
          value: editedContact.value,
          updatedAt: new Date()
        })

        // Update local state
        const updatedContacts = [...selectedMember.contactDetails]
        updatedContacts[contactIndex] = editedContact
        setSelectedMember({
          ...selectedMember,
          contactDetails: updatedContacts
        })

        // Reset editing state
        setEditingContactIndex(null)
        setEditedContact(null)
        
        toast({
          title: "Success",
          description: "Contact updated successfully",
        })
      }
    } catch (error) {
      console.error('Error updating contact:', error)
      setContactError('Failed to update contact. Please try again.')
    } finally {
      setIsUpdatingContact(false)
    }
  }

  const handleCancelEditContact = () => {
    setEditingContactIndex(null)
    setEditedContact(null)
    setContactError(null)
  }

  const handleRemoveContact = async (contactIndex: number) => {
    try {
      if (!selectedMember?.id) return

      setIsDeletingContact(true)

      // Get the existing contact document
      const contactsRef = collection(db, 'Contacts')
      const contactsQuery = query(contactsRef, where('memberId', '==', selectedMember.id))
      const contactsSnapshot = await getDocs(contactsQuery)
      const contactDocs = contactsSnapshot.docs

      if (contactIndex >= 0 && contactIndex < contactDocs.length) {
        // Delete the contact from Firestore
        await deleteDoc(contactDocs[contactIndex].ref)

        // Update local state
        const updatedContacts = [...selectedMember.contactDetails]
        updatedContacts.splice(contactIndex, 1)
        setSelectedMember({
          ...selectedMember,
          contactDetails: updatedContacts
        })
        
        toast({
          title: "Success",
          description: "Contact deleted successfully",
        })
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
      toast({
        title: "Error",
        description: "Failed to delete contact. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeletingContact(false)
      setDeletingContactIndex(null)
    }
  }

  const validateContact = (type: string, value: string): string | null => {
    if (type === "select") return "Please select a contact type"
    if (!value) return "Please enter a value"

    if (type === "Email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        return "Please enter a valid email address"
      }
    }

    if (type === "Phone Number") {
      const phoneRegex = /^\+?[\d\s-]{10,}$/
      if (!phoneRegex.test(value)) {
        return "Please enter a valid phone number"
      }
    }

    return null
  }

  const handleAddContact = () => {
    setIsAddingContact(true)
    setNewContact({ type: "select", value: "" })
    setContactError(null)
  }

  const handleSaveContact = async () => {
    try {
      const validationError = validateContact(newContact.type, newContact.value)
      if (validationError) {
        setContactError(validationError)
        return
      }

      setIsSavingContact(true)
      setContactError(null)

      if (!selectedMember?.id) {
        throw new Error('No member selected')
      }

      // Add contact to Contacts collection
      const contactsRef = collection(db, 'Contacts')
      await addDoc(contactsRef, {
        memberId: selectedMember.id,
        type: newContact.type,
        value: newContact.value,
        createdAt: new Date()
      })

      // Update local state
      setSelectedMember({
        ...selectedMember,
        contactDetails: [
          ...selectedMember.contactDetails,
          { type: newContact.type as "Email" | "Phone Number", value: newContact.value }
        ]
      })

      // Reset add contact state
      setIsAddingContact(false)
      setNewContact({ type: "select", value: "" })
      
      toast({
        title: "Success",
        description: "Contact added successfully",
      })
    } catch (error) {
      console.error('Error saving contact:', error)
      setContactError('Failed to save contact. Please try again.')
    } finally {
      setIsSavingContact(false)
    }
  }

  const handleCancelAddContact = () => {
    setIsAddingContact(false)
    setNewContact({ type: "select", value: "" })
    setContactError(null)
  }

  const validateAddress = (address: typeof editedAddress): string | null => {
    if (!address) return 'Address details are required'
    
    if (!address.streetAddress?.trim()) return 'Street address is required'
    if (!address.city?.trim()) return 'City is required'
    if (!address.stateProvince?.trim()) return 'State/Province is required'
    if (!address.postalCode?.trim()) return 'Postal code is required'
    if (!address.country?.trim()) return 'Country is required'
    
    return null
  }

  const handleEditAddress = () => {
    if (!selectedMember) return;
    setIsEditingAddress(true)
    setEditedAddress(selectedMember.addressDetails || {
      streetAddress: '',
      city: '',
      stateProvince: '',
      postalCode: '',
      country: ''
    })
    setAddressError(null)
  }

  const handleSaveAddress = async () => {
    try {
      setIsUpdatingAddress(true)
      setAddressError(null)

      // Validate all fields are filled
      const validationError = validateAddress(editedAddress)
      if (validationError) {
        setAddressError(validationError)
        return
      }

      if (!selectedMember?.id || !editedAddress) {
        setAddressError('No member selected for update')
        return
      }

      // Update member in Firestore with new address
      const memberRef = doc(db, 'Members', selectedMember.id)
      await updateDoc(memberRef, {
        addressDetails: {
          streetAddress: editedAddress.streetAddress,
          city: editedAddress.city,
          stateProvince: editedAddress.stateProvince,
          postalCode: editedAddress.postalCode,
          country: editedAddress.country,
          updatedAt: new Date()
        }
      })

      // Update the selected member state with new address
      setSelectedMember({
        ...selectedMember,
        addressDetails: editedAddress
      })

      // Exit edit mode
      setIsEditingAddress(false)
      setEditedAddress(null)

      toast({
        title: "Success",
        description: "Address has been saved successfully",
      })
    } catch (error) {
      console.error('Error saving address:', error)
      setAddressError('Failed to save address. Please try again.')
    } finally {
      setIsUpdatingAddress(false)
    }
  }

  const handleCancelEditAddress = () => {
    setIsEditingAddress(false)
    setEditedAddress(null)
    setAddressError(null)
  }

  const handleAddressChange = (field: 'streetAddress' | 'city' | 'stateProvince' | 'postalCode' | 'country', value: string) => {
    if (editedAddress) {
      setEditedAddress({
        ...editedAddress,
        [field]: value
      })
      setAddressError(null)
    }
  }

  const handleAddPerson = () => {
    setIsAddingMember(true)
    setSelectedMember({
      id: '',
      title: '',
      firstName: '',
      lastName: '',
      initials: '',
      idNumber: '',
      dateOfBirth: null,
      gender: '',
      language: '',
      maritalStatus: '',
      nationality: '',
      idType: 'South African ID',
      idDocumentUrl: null,
      type: 'Main',
      contactDetails: [],
      addressDetails: {
        streetAddress: '',
        city: '',
        stateProvince: '',
        postalCode: '',
        country: ''
      }
    })
    setNewMember({
      title: '',
      firstName: '',
      lastName: '',
      initials: '',
      idNumber: '',
      dateOfBirth: null,
      gender: '',
      language: '',
      maritalStatus: '',
      nationality: '',
      idType: 'South African ID',
      idDocumentUrl: null,
      type: 'Main'
    })
    setUpdateError(null)
  }

  const checkExistingMember = async (idType: "South African ID" | "Passport", idNumber: string): Promise<boolean> => {
    try {
      const membersRef = collection(db, 'Members')
      let q;
      
      // Create query based on ID type
      q = query(membersRef, 
        where('idType', '==', idType),
        where('idNumber', '==', idNumber)
      )
      
      const snapshot = await getDocs(q)
      return !snapshot.empty
    } catch (error) {
      console.error('Error checking existing member:', error)
      throw new Error('Failed to check for existing member')
    }
  }

  const handleSaveNewMember = async () => {
    try {
      if (!newMember) {
        setUpdateError('No member data to save')
        return
      }

      // Check for required fields
      const requiredFields = [
        'title', 'firstName', 'lastName', 'initials', 'language',
        'maritalStatus', 'nationality', 'type', 'idType', 'idNumber',
        'dateOfBirth', 'gender'
      ]
      const missingFields = requiredFields.filter(field => !newMember[field as keyof typeof newMember])
      if (missingFields.length > 0) {
        setUpdateError(`Please fill in all required fields: ${missingFields.join(', ')}`)
        return
      }

      setIsSavingMember(true)
      setUpdateError(null)

      // Check if member already exists based on ID type and number
      const memberExists = await checkExistingMember(newMember.idType, newMember.idNumber)
      if (memberExists) {
        setUpdateError(`A member with this ${newMember.idType} number already exists`)
        setIsSavingMember(false)
        return
      }

      // Create new member document
      const membersRef = collection(db, 'Members')
      const memberDoc = await addDoc(membersRef, {
        ...newMember,
        dateOfBirth: newMember.dateOfBirth || null,
        createdAt: new Date()
      })

      // Create new member object
      const newMemberData: MemberData = {
        id: memberDoc.id,
        ...newMember,
        dateOfBirth: newMember.dateOfBirth || null,
        contactDetails: [],
        addressDetails: {
          streetAddress: '',
          city: '',
          stateProvince: '',
          postalCode: '',
          country: ''
        }
      }

      setMembers(prev => [...prev, newMemberData])
      setSelectedMember(newMemberData)
      setIsAddingMember(false)
      setNewMember(null)
      
      toast({
        title: "Success",
        description: "Member added successfully",
      })
    } catch (error) {
      console.error('Error saving new member:', error)
      setUpdateError('Failed to save member. Please try again.')
    } finally {
      setIsSavingMember(false)
    }
  }

  const handleAddAddress = () => {
    setIsAddingAddress(true)
    setNewAddress({
      streetAddress: '',
      city: '',
      stateProvince: '',
      postalCode: '',
      country: ''
    })
    setAddressError(null)
  }

  const handleSaveNewAddress = async () => {
    try {
      setIsSavingAddress(true)
      setAddressError(null)

      // Validate all fields are filled
      const validationError = validateAddress(newAddress)
      if (validationError) {
        setAddressError(validationError)
        return
      }

      if (!selectedMember?.id) {
        setAddressError('No member selected for update')
        return
      }

      // Update member in Firestore with new address
      const memberRef = doc(db, 'Members', selectedMember.id)
      await updateDoc(memberRef, {
        addressDetails: {
          streetAddress: newAddress.streetAddress,
          city: newAddress.city,
          stateProvince: newAddress.stateProvince,
          postalCode: newAddress.postalCode,
          country: newAddress.country,
          updatedAt: new Date()
        }
      })

      // Update the selected member state with new address
      setSelectedMember({
        ...selectedMember,
        addressDetails: newAddress
      })

      // Exit add mode
      setIsAddingAddress(false)
      setNewAddress({
        streetAddress: '',
        city: '',
        stateProvince: '',
        postalCode: '',
        country: ''
      })

      toast({
        title: "Success",
        description: "Address has been saved successfully",
      })
    } catch (error) {
      console.error('Error saving address:', error)
      setAddressError('Failed to save address. Please try again.')
    } finally {
      setIsSavingAddress(false)
    }
  }

  const handleCancelNewAddress = () => {
    setIsAddingAddress(false)
    setNewAddress({
      streetAddress: '',
      city: '',
      stateProvince: '',
      postalCode: '',
      country: ''
    })
    setAddressError(null)
  }

  const handleNewAddressChange = (field: 'streetAddress' | 'city' | 'stateProvince' | 'postalCode' | 'country', value: string) => {
    setNewAddress(prev => ({
      ...prev,
      [field]: value
    }))
    setAddressError(null)
  }

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== "" && value !== null
  ) || idType !== "All"

  // Add new validation functions
  const validateSouthAfricanID = (idNumber: string): boolean => {
    // Check length
    if (idNumber.length !== 13) return false;

    // Check if all characters are numbers
    if (!/^\d+$/.test(idNumber)) return false;

    // Extract date components
    const year = parseInt(idNumber.substring(0, 2));
    const month = parseInt(idNumber.substring(2, 4));
    const day = parseInt(idNumber.substring(4, 6));

    // Validate date components
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // Validate citizenship digits (7-10)
    const citizenshipDigit = parseInt(idNumber.charAt(10));
    if (citizenshipDigit !== 0 && citizenshipDigit !== 1) return false;

    // Validate checksum (Luhn algorithm)
    let sum = 0;
    let isEven = false;
    for (let i = idNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(idNumber.charAt(i));
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      sum += digit;
      isEven = !isEven;
    }
    return (sum % 10) === 0;
  }

  const validatePassportNumber = (passport: string): boolean => {
    // Basic passport validation - can be customized based on requirements
    return passport.length >= 6 && passport.length <= 9 && /^[A-Z0-9]+$/.test(passport.toUpperCase());
  }

  const checkDuplicatePassport = async (passport: string, excludeMemberId?: string): Promise<boolean> => {
    try {
      const membersRef = collection(db, 'Members');
      const q = query(
        membersRef, 
        where('idType', '==', 'Passport'),
        where('idNumber', '==', passport)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return false;
      
      // If we're updating an existing member, exclude their own ID from the duplicate check
      if (excludeMemberId) {
        return snapshot.docs.some(doc => doc.id !== excludeMemberId);
      }
      
      return true;
    } catch (error) {
      console.error('Error checking duplicate passport:', error);
      return false;
    }
  }

  const validateMemberID = async (idType: string, idNumber: string, currentMemberId?: string): Promise<string | null> => {
    // Validate South African ID
    if (idType === "South African ID") {
      if (!/^\d{13}$/.test(idNumber)) {
        return "South African ID must be 13 digits"
      }
      // Add more SA ID validation if needed
    }
    
    // Validate Passport
    if (idType === "Passport") {
      if (!/^[A-Z0-9]{6,9}$/i.test(idNumber)) {
        return "Passport number must be 6-9 alphanumeric characters"
      }
      
      // Check for duplicate passport numbers
      const membersRef = collection(db, 'Members')
      const q = query(membersRef, where('idNumber', '==', idNumber))
      const querySnapshot = await getDocs(q)
      
      const hasDuplicate = querySnapshot.docs.some(doc => 
        doc.id !== currentMemberId && doc.data().idNumber === idNumber
      )
      
      if (hasDuplicate) {
        return "This passport number is already registered"
      }
    }
    
    return null
  }

  if (selectedMember) {
  return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Members
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {selectedMember.firstName} {selectedMember.lastName}
          </h1>
        </div>

        {/* Member Details Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <div>
              <CardTitle>Member Details</CardTitle>
              <CardDescription>Personal information and preferences</CardDescription>
            </div>
            {isAddingMember ? (
      <Button 
                onClick={handleSaveNewMember}
                size="sm"
                className="gap-2"
                disabled={isSavingMember}
              >
                {isSavingMember ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Add Member
                  </>
                )}
              </Button>
            ) : (
              <Button 
                onClick={isEditingMember ? handleUpdateMember : handleEditMember}
                size="sm"
                className="gap-2"
                disabled={isUpdating}
              >
                {isEditingMember ? (
                  <>
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {isUpdating ? 'Updating...' : 'Update'}
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </>
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {updateError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{updateError}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Title</Label>
                {(isEditingMember || isAddingMember) ? (
                  <Select
                    value={isAddingMember ? (newMember?.title || '') : (editedMember?.title || '')}
                    onValueChange={(value: string) => {
                      if (isAddingMember && newMember) {
                        setNewMember({ ...newMember, title: value })
                      } else {
                        handleMemberFieldChange('title', value)
                      }
                    }}
                    disabled={isUpdating || isSavingMember}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select title" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mr">Mr</SelectItem>
                      <SelectItem value="Mrs">Mrs</SelectItem>
                      <SelectItem value="Ms">Ms</SelectItem>
                      <SelectItem value="Dr">Dr</SelectItem>
                      <SelectItem value="Prof">Prof</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">{selectedMember.title || 'N/A'}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">First Name</Label>
                {(isEditingMember || isAddingMember) ? (
                  <Input
                    value={isAddingMember ? newMember?.firstName : editedMember?.firstName || ''}
                    onChange={(e) => {
                      if (isAddingMember && newMember) {
                        setNewMember({ ...newMember, firstName: e.target.value })
                      } else {
                        handleMemberFieldChange('firstName', e.target.value)
                      }
                    }}
                    className="h-8 text-sm"
                    disabled={isUpdating || isSavingMember}
                  />
                ) : (
                  <p className="text-sm font-medium">{selectedMember.firstName || 'N/A'}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Last Name</Label>
                {(isEditingMember || isAddingMember) ? (
                  <Input
                    value={isAddingMember ? newMember?.lastName : editedMember?.lastName || ''}
                    onChange={(e) => {
                      if (isAddingMember && newMember) {
                        setNewMember({ ...newMember, lastName: e.target.value })
                      } else {
                        handleMemberFieldChange('lastName', e.target.value)
                      }
                    }}
                    className="h-8 text-sm"
                    disabled={isUpdating || isSavingMember}
                  />
                ) : (
                  <p className="text-sm font-medium">{selectedMember.lastName || 'N/A'}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Initials</Label>
                {(isEditingMember || isAddingMember) ? (
                  <Input
                    value={isAddingMember ? newMember?.initials : editedMember?.initials || ''}
                    onChange={(e) => {
                      if (isAddingMember && newMember) {
                        setNewMember({ ...newMember, initials: e.target.value })
                      } else {
                        handleMemberFieldChange('initials', e.target.value)
                      }
                    }}
                    className="h-8 text-sm"
                    disabled={isUpdating || isSavingMember}
                  />
                ) : (
                  <p className="text-sm font-medium">{selectedMember.initials || 'N/A'}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">ID Type</Label>
                {(isEditingMember || isAddingMember) ? (
                  <Select
                    value={isAddingMember ? newMember?.idType : editedMember?.idType}
                    onValueChange={(value) => {
                      if (isAddingMember && newMember) {
                        setNewMember({ ...newMember, idType: value as "South African ID" | "Passport" })
                      } else {
                        handleMemberFieldChange('idType', value)
                      }
                    }}
                    disabled={isUpdating || isSavingMember || (isEditingMember && !isAddingMember)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select ID type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="South African ID">South African ID</SelectItem>
                      <SelectItem value="Passport">Passport</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">{selectedMember.idType || 'N/A'}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">ID Number</Label>
                {(isEditingMember || isAddingMember) ? (
                  <Input
                    value={isAddingMember ? newMember?.idNumber : editedMember?.idNumber || ''}
                    onChange={(e) => {
                      if (isAddingMember && newMember) {
                        setNewMember({ ...newMember, idNumber: e.target.value })
                      } else {
                        handleMemberFieldChange('idNumber', e.target.value)
                      }
                    }}
                    className="h-8 text-sm"
                    disabled={isUpdating || isSavingMember || !isAddingMember}
                  />
                ) : (
                  <p className="text-sm font-medium">{selectedMember.idNumber || 'N/A'}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Date of Birth</Label>
                {(isEditingMember || isAddingMember) ? (
                  <DatePicker
                    date={isAddingMember ? (newMember?.dateOfBirth || null) : (editedMember?.dateOfBirth || null)}
                    onChange={(date: Date | null) => {
                      if (isAddingMember && newMember) {
                        setNewMember({ ...newMember, dateOfBirth: date })
                      } else if (editedMember) {
                        setEditedMember({ ...editedMember, dateOfBirth: date })
                      }
                    }}
                    disabled={isUpdating || isSavingMember || !isAddingMember}
                  />
                ) : (
                  <p className="text-sm font-medium">
                    {selectedMember.dateOfBirth ? format(selectedMember.dateOfBirth, 'PPP') : 'N/A'}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Gender</Label>
                {(isEditingMember || isAddingMember) ? (
                  <Select
                    value={isAddingMember ? newMember?.gender : editedMember?.gender}
                    onValueChange={(value) => {
                      if (isAddingMember && newMember) {
                        setNewMember({ ...newMember, gender: value })
                      } else {
                        handleMemberFieldChange('gender', value)
                      }
                    }}
                    disabled={isUpdating || isSavingMember || !isAddingMember}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">{selectedMember.gender || 'N/A'}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Language</Label>
                {(isEditingMember || isAddingMember) ? (
                  <Select
                    value={isAddingMember ? newMember?.language : editedMember?.language}
                    onValueChange={(value) => {
                      if (isAddingMember && newMember) {
                        setNewMember({ ...newMember, language: value })
                      } else {
                        handleMemberFieldChange('language', value)
                      }
                    }}
                    disabled={isUpdating || isSavingMember}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Afrikaans">Afrikaans</SelectItem>
                      <SelectItem value="Zulu">Zulu</SelectItem>
                      <SelectItem value="Xhosa">Xhosa</SelectItem>
                      <SelectItem value="Sotho">Sotho</SelectItem>
                      <SelectItem value="Tswana">Tswana</SelectItem>
                      <SelectItem value="Venda">Venda</SelectItem>
                      <SelectItem value="Tsonga">Tsonga</SelectItem>
                      <SelectItem value="Swati">Swati</SelectItem>
                      <SelectItem value="Ndebele">Ndebele</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">{selectedMember.language || 'N/A'}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Marital Status</Label>
                {(isEditingMember || isAddingMember) ? (
                  <Select
                    value={isAddingMember ? newMember?.maritalStatus : editedMember?.maritalStatus}
                    onValueChange={(value) => {
                      if (isAddingMember && newMember) {
                        setNewMember({ ...newMember, maritalStatus: value })
                      } else {
                        handleMemberFieldChange('maritalStatus', value)
                      }
                    }}
                    disabled={isUpdating || isSavingMember}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select marital status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Married">Married</SelectItem>
                      <SelectItem value="Divorced">Divorced</SelectItem>
                      <SelectItem value="Widowed">Widowed</SelectItem>
                      <SelectItem value="Separated">Separated</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">{selectedMember.maritalStatus || 'N/A'}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nationality</Label>
                {(isEditingMember || isAddingMember) ? (
                  <Select
                    value={isAddingMember ? newMember?.nationality : editedMember?.nationality}
                    onValueChange={(value) => {
                      if (isAddingMember && newMember) {
                        setNewMember({ ...newMember, nationality: value })
                      } else {
                        handleMemberFieldChange('nationality', value)
                      }
                    }}
                    disabled={isUpdating || isSavingMember}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select nationality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="South African">South African</SelectItem>
                      <SelectItem value="Zimbabwean">Zimbabwean</SelectItem>
                      <SelectItem value="Mozambican">Mozambican</SelectItem>
                      <SelectItem value="Namibian">Namibian</SelectItem>
                      <SelectItem value="Botswanan">Botswanan</SelectItem>
                      <SelectItem value="Swazi">Swazi</SelectItem>
                      <SelectItem value="Lesotho">Lesotho</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium">{selectedMember.nationality || 'N/A'}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Member Type</Label>
                {(isEditingMember || isAddingMember) ? (
                  <Input
                    value={isAddingMember ? newMember?.type : editedMember?.type || ''}
                    onChange={(e) => {
                      if (isAddingMember && newMember) {
                        setNewMember({ ...newMember, type: e.target.value as 'Main' | 'Dependent' | 'Beneficiary' })
                      } else {
                        handleMemberFieldChange('type', e.target.value)
                      }
                    }}
                    className="h-8 text-sm"
                    disabled={isUpdating || isSavingMember}
                  />
                ) : (
                  <p className="text-sm font-medium">{selectedMember.type || 'N/A'}</p>
                )}
              </div>
              {selectedMember.type === 'Dependent' && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Medical Aid Number</Label>
                    {(isEditingMember || isAddingMember) ? (
                      <Input
                        value={isAddingMember ? newMember?.medicalAidNumber : editedMember?.medicalAidNumber || ''}
                        onChange={(e) => {
                          if (isAddingMember && newMember) {
                            setNewMember({ ...newMember, medicalAidNumber: e.target.value })
                          } else {
                            handleMemberFieldChange('medicalAidNumber', e.target.value)
                          }
                        }}
                        className="h-8 text-sm"
                        disabled={isUpdating || isSavingMember}
                      />
                    ) : (
                      <p className="text-sm font-medium">{selectedMember.medicalAidNumber || 'N/A'}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Employer</Label>
                    {(isEditingMember || isAddingMember) ? (
                      <Input
                        value={isAddingMember ? newMember?.employer : editedMember?.employer || ''}
                        onChange={(e) => {
                          if (isAddingMember && newMember) {
                            setNewMember({ ...newMember, employer: e.target.value })
                          } else {
                            handleMemberFieldChange('employer', e.target.value)
                          }
                        }}
                        className="h-8 text-sm"
                        disabled={isUpdating || isSavingMember}
                      />
                    ) : (
                      <p className="text-sm font-medium">{selectedMember.employer || 'N/A'}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">School</Label>
                    {(isEditingMember || isAddingMember) ? (
                      <Input
                        value={isAddingMember ? newMember?.school : editedMember?.school || ''}
                        onChange={(e) => {
                          if (isAddingMember && newMember) {
                            setNewMember({ ...newMember, school: e.target.value })
                          } else {
                            handleMemberFieldChange('school', e.target.value)
                          }
                        }}
                        className="h-8 text-sm"
                        disabled={isUpdating || isSavingMember}
                      />
                    ) : (
                      <p className="text-sm font-medium">{selectedMember.school || 'N/A'}</p>
                    )}
                  </div>
                </>
              )}
              {selectedMember.idDocumentUrl && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">ID Document</Label>
                  <a 
                    href={selectedMember.idDocumentUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm"
                  >
                    View Document
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Details Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Contact Details</CardTitle>
              <CardDescription>Contact information and preferences</CardDescription>
            </div>
            <Button 
              onClick={handleAddContact} 
              size="sm" 
              className="gap-2"
              disabled={isAddingContact || isAddingMember || !selectedMember.id}
            >
              <Plus className="h-4 w-4" />
              Add Contact
            </Button>
          </CardHeader>
          <CardContent>
            {contactError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{contactError}</AlertDescription>
              </Alert>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAddingContact ? (
                  <TableRow>
                    <TableCell>
                      <Select
                        value={newContact.type}
                        onValueChange={(value) => {
                          setNewContact(prev => ({ ...prev, type: value as "Email" | "Phone Number" | "select", value: "" }))
                          setContactError(null)
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="<Select>" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="select">
                            <span className="text-muted-foreground">&lt;Select&gt;</span>
                          </SelectItem>
                          <SelectItem value="Email">Email</SelectItem>
                          <SelectItem value="Phone Number">Phone Number</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={newContact.value}
                        onChange={(e) => {
                          setNewContact(prev => ({ ...prev, value: e.target.value }))
                          setContactError(null)
                        }}
                        placeholder={newContact.type !== "select" ? `Enter ${newContact.type.toLowerCase()}...` : '<Select>'}
                        className="h-8"
                        disabled={newContact.type === "select"}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleSaveContact}
                          disabled={newContact.type === "select" || !newContact.value || isSavingContact}
                          className="h-8 w-8 p-0"
                        >
                          {isSavingContact ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          <span className="sr-only">Save</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCancelAddContact}
                          className="h-8 w-8 p-0"
                          disabled={isSavingContact}
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Cancel</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : selectedMember.contactDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6">
                      <div className="text-muted-foreground">No contacts saved</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  selectedMember.contactDetails.map((contact, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {editingContactIndex === index ? (
                          <Select
                            value={editedContact?.type || contact.type}
                            onValueChange={(value: "Email" | "Phone Number") => {
                              setEditedContact(prev => ({ ...prev!, type: value, value: "" }))
                              setContactError(null)
                            }}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Email">Email</SelectItem>
                              <SelectItem value="Phone Number">Phone Number</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          contact.type
                        )}
                      </TableCell>
                      <TableCell>
                        {editingContactIndex === index ? (
                          <Input
                            value={editedContact?.value || ""}
                            onChange={(e) => {
                              setEditedContact(prev => ({ ...prev!, value: e.target.value }))
                              setContactError(null)
                            }}
                            placeholder={`Enter ${editedContact?.type.toLowerCase()}...`}
                            className="h-8"
                          />
                        ) : (
                          contact.value
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {editingContactIndex === index ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleUpdateContact(index)}
                                disabled={!editedContact?.type || !editedContact?.value || isUpdatingContact}
                                className="h-8 w-8 p-0"
                              >
                                {isUpdatingContact ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                                <span className="sr-only">Update</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleCancelEditContact}
                                className="h-8 w-8 p-0"
                                disabled={isUpdatingContact}
                              >
                                <X className="h-4 w-4" />
                                <span className="sr-only">Cancel</span>
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditContact(index)}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingContactIndex(index)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                disabled={selectedMember.contactDetails.length <= 1}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Address Details Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Address Details</CardTitle>
              <CardDescription>View and manage address information</CardDescription>
            </div>
            {(!selectedMember.addressDetails?.streetAddress &&
              !selectedMember.addressDetails?.city &&
              !selectedMember.addressDetails?.stateProvince &&
              !selectedMember.addressDetails?.postalCode &&
              !selectedMember.addressDetails?.country &&
              !isAddingAddress) && (
              <Button 
                size="sm" 
                onClick={handleAddAddress}
                disabled={isAddingMember || !selectedMember.id}
      >
        <Plus className="h-4 w-4 mr-2" />
                Add Address
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {addressError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{addressError}</AlertDescription>
              </Alert>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Street Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State/Province</TableHead>
                  <TableHead>Postal Code</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAddingAddress ? (
                  <TableRow>
                    <TableCell>
                      <Input
                        value={newAddress.streetAddress}
                        onChange={(e) => handleNewAddressChange('streetAddress', e.target.value)}
                        className="h-8"
                        disabled={isSavingAddress}
                        placeholder="Enter street address"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={newAddress.city}
                        onChange={(e) => handleNewAddressChange('city', e.target.value)}
                        className="h-8"
                        disabled={isSavingAddress}
                        placeholder="Enter city"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={newAddress.stateProvince}
                        onChange={(e) => handleNewAddressChange('stateProvince', e.target.value)}
                        className="h-8"
                        disabled={isSavingAddress}
                        placeholder="Enter state/province"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={newAddress.postalCode}
                        onChange={(e) => handleNewAddressChange('postalCode', e.target.value)}
                        className="h-8"
                        disabled={isSavingAddress}
                        placeholder="Enter postal code"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={newAddress.country}
                        onChange={(e) => handleNewAddressChange('country', e.target.value)}
                        className="h-8"
                        disabled={isSavingAddress}
                        placeholder="Enter country"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleSaveNewAddress}
                          disabled={isSavingAddress}
                          className="h-8 w-8 p-0"
                        >
                          {isSavingAddress ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          <span className="sr-only">Save</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCancelNewAddress}
                          className="h-8 w-8 p-0"
                          disabled={isSavingAddress}
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Cancel</span>
      </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !selectedMember.addressDetails?.streetAddress &&
                   !selectedMember.addressDetails?.city &&
                   !selectedMember.addressDetails?.stateProvince &&
                   !selectedMember.addressDetails?.postalCode &&
                   !selectedMember.addressDetails?.country ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6">
                      <div className="text-muted-foreground">No address</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell>
                      {isEditingAddress ? (
                        <Input
                          value={editedAddress?.streetAddress || ''}
                          onChange={(e) => handleAddressChange('streetAddress', e.target.value)}
                          className="h-8"
                          disabled={isUpdatingAddress}
                          placeholder="Enter street address"
                        />
                      ) : (
                        <span className="text-sm">{selectedMember.addressDetails.streetAddress || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditingAddress ? (
                        <Input
                          value={editedAddress?.city || ''}
                          onChange={(e) => handleAddressChange('city', e.target.value)}
                          className="h-8"
                          disabled={isUpdatingAddress}
                          placeholder="Enter city"
                        />
                      ) : (
                        <span className="text-sm">{selectedMember.addressDetails.city || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditingAddress ? (
                        <Input
                          value={editedAddress?.stateProvince || ''}
                          onChange={(e) => handleAddressChange('stateProvince', e.target.value)}
                          className="h-8"
                          disabled={isUpdatingAddress}
                          placeholder="Enter state/province"
                        />
                      ) : (
                        <span className="text-sm">{selectedMember.addressDetails.stateProvince || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditingAddress ? (
                        <Input
                          value={editedAddress?.postalCode || ''}
                          onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                          className="h-8"
                          disabled={isUpdatingAddress}
                          placeholder="Enter postal code"
                        />
                      ) : (
                        <span className="text-sm">{selectedMember.addressDetails.postalCode || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditingAddress ? (
                        <Input
                          value={editedAddress?.country || ''}
                          onChange={(e) => handleAddressChange('country', e.target.value)}
                          className="h-8"
                          disabled={isUpdatingAddress}
                          placeholder="Enter country"
                        />
                      ) : (
                        <span className="text-sm">{selectedMember.addressDetails.country || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {isEditingAddress ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleSaveAddress}
                              disabled={isUpdatingAddress}
                              className="h-8 w-8 p-0"
                            >
                              {isUpdatingAddress ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                              <span className="sr-only">Save</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleCancelEditAddress}
                              className="h-8 w-8 p-0"
                              disabled={isUpdatingAddress}
                            >
                              <X className="h-4 w-4" />
                              <span className="sr-only">Cancel</span>
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleEditAddress}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <AlertDialog open={deletingContactIndex !== null} onOpenChange={(open) => !open && setDeletingContactIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contact</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this contact? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingContact}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingContactIndex !== null && handleRemoveContact(deletingContactIndex)}
                disabled={isDeletingContact}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingContact ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Member Management</h1>
          </div>
          <p className="text-muted-foreground">
            View and manage member information
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center text-muted-foreground">
            <Users className="mr-2 h-4 w-4" />
            <span>{members.length} Members</span>
          </div>
          <Button onClick={handleAddPerson} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Member
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle>Search Members</CardTitle>
            <p className="text-sm text-muted-foreground">
              Use the filters below to search for specific members
            </p>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 px-2 lg:px-3"
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>ID Number</Label>
              <Input
                placeholder="Search by ID number"
                value={filters.idNumber}
                onChange={(e) => handleFilterChange('idNumber', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                placeholder="Search by first name"
                value={filters.firstName}
                onChange={(e) => handleFilterChange('firstName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Surname</Label>
              <Input
                placeholder="Search by surname"
                value={filters.lastName}
                onChange={(e) => handleFilterChange('lastName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ID Type</Label>
              <Select value={idType} onValueChange={setIdType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select ID type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="South African ID">South African ID</SelectItem>
                  <SelectItem value="Passport">Passport</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <DatePicker
                date={filters.dateOfBirth}
                onChange={(date) => handleFilterChange('dateOfBirth', date)}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Info</Label>
              <Input
                placeholder="Search by email or phone"
                value={filters.contactInfo}
                onChange={(e) => handleFilterChange('contactInfo', e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              {filteredMembers.length} results found
            </p>
            <Button 
              onClick={() => fetchMembers()}
              disabled={loading}
              className="min-w-[120px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Surname</TableHead>
                <TableHead>First Name</TableHead>
                <TableHead>Initials</TableHead>
                <TableHead>ID Type</TableHead>
                <TableHead>ID Number</TableHead>
                <TableHead>Date of Birth</TableHead>
                <TableHead>Contact Info</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <span className="block mt-2 text-sm text-muted-foreground">Loading members...</span>
                  </TableCell>
                </TableRow>
              ) : filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <p className="text-muted-foreground">No members found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((member) => (
                  <TableRow key={member.id} className="hover:bg-muted/50">
                    <TableCell>
                      <button
                        onClick={() => handleViewMember(member.id)}
                        className="text-primary hover:underline text-left font-medium"
                      >
                        {member.lastName}
                      </button>
                    </TableCell>
                    <TableCell>{member.firstName}</TableCell>
                    <TableCell>{member.initials}</TableCell>
                    <TableCell>
                      {member.idType}
                    </TableCell>
                    <TableCell>{member.idNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {member.dateOfBirth ? format(member.dateOfBirth, 'PPP') : 'No date'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.contactDetails.map((contact, index) => (
                        <div key={index} className="text-sm">
                          {contact.type === "Email" ? (
                            <a href={`mailto:${contact.value}`} className="text-primary hover:underline">
                              {contact.value}
                            </a>
                          ) : (
                            <a href={`tel:${contact.value}`} className="text-primary hover:underline">
                              {contact.value}
                            </a>
                          )}
                        </div>
                      ))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

