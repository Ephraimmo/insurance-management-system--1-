"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { MainMemberDetails } from "@/components/contract/MainMemberDetails"
import { validateSouthAfricanID } from "@/src/utils/idValidation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { toast } from "@/components/ui/use-toast"
import { isValid } from "date-fns"


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
}

interface MainMemberFormProps {
  data: MainMemberData
  updateData: (data: MainMemberData) => void
  errors?: { [key: string]: string } | null
  isDisabled?: boolean
}

export function MainMemberForm({ data, updateData, errors, isDisabled = false }: MainMemberFormProps) {
  const [personalInfo, setPersonalInfo] = useState(data.personalInfo)
  const [contactDetails, setContactDetails] = useState(data.contactDetails)
  const [addressDetails, setAddressDetails] = useState(data.addressDetails)
  const [activeTab, setActiveTab] = useState("personal-info")
  const [fileUploadStatus, setFileUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle")
  const [idValidationErrors, setIdValidationErrors] = useState<string[]>([])
  const [wasAutoPopulated, setWasAutoPopulated] = useState(false)
  const [passportCheckTimeout, setPassportCheckTimeout] = useState<NodeJS.Timeout | null>(null)

  // Update local state when parent data changes
  useEffect(() => {
    setPersonalInfo(data.personalInfo)
    setContactDetails(data.contactDetails)
    setAddressDetails(data.addressDetails)
  }, [data])

  const handlePersonalInfoChange = async (field: string, value: string | Date | null) => {
    const updatedPersonalInfo = { ...personalInfo, [field]: value }
    
    // Handle ID number validation and auto-completion
    if (field === "idNumber") {
      // For South African ID, only allow numbers and limit to 13 digits
      if (personalInfo.idType === "South African ID") {
        const numericValue = value?.toString().replace(/\D/g, '').slice(0, 13) || ''
        updatedPersonalInfo.idNumber = numericValue

        // Auto-complete gender and date of birth if ID number is complete
        if (numericValue.length === 13) {
          try {
            // Extract date of birth
            const year = parseInt(numericValue.substring(0, 2))
            const month = parseInt(numericValue.substring(2, 4))
            const day = parseInt(numericValue.substring(4, 6))
            
            // Determine century (1900s or 2000s)
            const currentYear = new Date().getFullYear() % 100
            const century = year <= currentYear ? 2000 : 1900
            const fullYear = century + year

            // Create date object with proper validation
            const dob = new Date(fullYear, month - 1, day)
            
            // Validate the date before setting
            if (isValid(dob) && dob.getMonth() === month - 1 && dob.getDate() === day) {
              // Set to start of day to avoid timezone issues
              dob.setHours(0, 0, 0, 0)
              updatedPersonalInfo.dateOfBirth = dob
            } else {
              console.error('Invalid date extracted from ID number')
              updatedPersonalInfo.dateOfBirth = null
            }

            // Extract gender (digit 7-10 range: 0000-4999 for female, 5000-9999 for male)
            const genderDigits = parseInt(numericValue.substring(6, 10))
            const gender = genderDigits < 5000 ? "Female" : "Male"

            // Update the form with extracted information
            updatedPersonalInfo.gender = gender

            // Show toast notification about auto-completion
            toast({
              title: "Auto-completed",
              description: "Date of Birth and Gender have been automatically filled based on the ID number.",
              variant: "default",
            })
          } catch (error) {
            console.error('Error auto-completing from ID:', error)
          }
        }
      } else {
        // For passport, allow alphanumeric and limit to 20 characters
        const passportValue = value?.toString().slice(0, 20) || ''
        updatedPersonalInfo.idNumber = passportValue

        // Clear any existing timeout
        if (passportCheckTimeout) {
          clearTimeout(passportCheckTimeout)
        }

        // Update the form immediately with the new value
        setPersonalInfo(updatedPersonalInfo)
        updateData({
          personalInfo: updatedPersonalInfo,
          contactDetails,
          addressDetails
        })

        // Set a new timeout for passport check
        const timeout = setTimeout(async () => {
          try {
            // Only check if we have a passport value
            if (passportValue) {
              const membersRef = collection(db, 'Members')
              const q = query(
                membersRef,
                where('idNumber', '==', passportValue),
                where('idType', '==', 'Passport')
              )
              const memberSnapshot = await getDocs(q)

              if (!memberSnapshot.empty) {
                const memberDoc = memberSnapshot.docs[0]
                const memberData = memberDoc.data()

                // Auto-populate fields
                const populatedPersonalInfo = {
                  ...updatedPersonalInfo,
                  title: memberData.title || '',
                  firstName: memberData.firstName || '',
                  lastName: memberData.lastName || '',
                  initials: memberData.initials || '',
                  dateOfBirth: memberData.dateOfBirth ? new Date(memberData.dateOfBirth.seconds * 1000) : null,
                  gender: memberData.gender || '',
                  language: memberData.language || '',
                  maritalStatus: memberData.maritalStatus || '',
                  nationality: memberData.nationality || '',
                  idDocumentUrl: memberData.idDocumentUrl || null,
                }

                // Fetch contact details
                const contactsRef = collection(db, 'Contacts')
                const contactsQuery = query(contactsRef, where('memberId', '==', memberDoc.id))
                const contactsSnapshot = await getDocs(contactsQuery)
                const newContactDetails = contactsSnapshot.docs.map(doc => ({
                  type: doc.data().type as "Email" | "Phone Number",
                  value: doc.data().value
                }))

                // Fetch address details
                const addressRef = collection(db, 'Address')
                const addressQuery = query(addressRef, where('memberId', '==', memberDoc.id))
                const addressSnapshot = await getDocs(addressQuery)
                let newAddressDetails = {
                  streetAddress: '',
                  city: '',
                  stateProvince: '',
                  postalCode: '',
                  country: ''
                }
                
                if (!addressSnapshot.empty) {
                  const addressData = addressSnapshot.docs[0].data()
                  newAddressDetails = {
                    streetAddress: addressData.streetAddress || '',
                    city: addressData.city || '',
                    stateProvince: addressData.stateProvince || '',
                    postalCode: addressData.postalCode || '',
                    country: addressData.country || ''
                  }
                }

                // Update all form sections
                setPersonalInfo(populatedPersonalInfo)
                setContactDetails(newContactDetails)
                setAddressDetails(newAddressDetails)
                setWasAutoPopulated(true)

                // Update parent component
                updateData({
                  personalInfo: populatedPersonalInfo,
                  contactDetails: newContactDetails,
                  addressDetails: newAddressDetails
                })

                toast({
                  title: "Existing Member Found",
                  description: `Member details for ${memberData.firstName} ${memberData.lastName} have been auto-populated.`,
                  variant: "default",
                })
              }
            }
          } catch (error) {
            console.error('Error checking member:', error)
            setIdValidationErrors(['Error checking member details. Please try again.'])
          }
        }, 1000) // Wait for 1 second after typing stops

        setPassportCheckTimeout(timeout)
        return
      }
    }

    // Clear form when typing new ID number if data was auto-populated
    if (field === "idNumber" && wasAutoPopulated) {
      const clearedPersonalInfo = {
        ...personalInfo,
        title: '',
        firstName: '',
        lastName: '',
        initials: '',
        dateOfBirth: updatedPersonalInfo.dateOfBirth, // Preserve auto-completed date
        gender: updatedPersonalInfo.gender, // Preserve auto-completed gender
        language: '',
        maritalStatus: '',
        nationality: '',
        idDocumentUrl: null,
        idNumber: updatedPersonalInfo.idNumber
      }
      setWasAutoPopulated(false)
      setIdValidationErrors([])
      setPersonalInfo(clearedPersonalInfo)
      setContactDetails([])
      setAddressDetails({
        streetAddress: '',
        city: '',
        stateProvince: '',
        postalCode: '',
        country: ''
      })
      updateData({
        personalInfo: clearedPersonalInfo,
        contactDetails: [],
        addressDetails: {
          streetAddress: '',
          city: '',
          stateProvince: '',
          postalCode: '',
          country: ''
        }
      })
      return
    }
    
    // Clear form and validation when ID type changes
    if (field === "idType") {
      const clearedPersonalInfo = {
        ...personalInfo,
        idType: value as "South African ID" | "Passport",
        idNumber: '',
        title: '',
        firstName: '',
        lastName: '',
        initials: '',
        dateOfBirth: null,
        gender: '',
        language: '',
        maritalStatus: '',
        nationality: '',
        idDocumentUrl: null,
      }
      setIdValidationErrors([])
      setPersonalInfo(clearedPersonalInfo)
      setContactDetails([])
      setAddressDetails({
        streetAddress: '',
        city: '',
        stateProvince: '',
        postalCode: '',
        country: ''
      })
      updateData({
        personalInfo: clearedPersonalInfo,
        contactDetails: [],
        addressDetails: {
          streetAddress: '',
          city: '',
          stateProvince: '',
          postalCode: '',
          country: ''
        }
      })
      return
    }
    
    // Only perform member check if we have a complete ID number
    if (field === "idNumber" && updatedPersonalInfo.idNumber) {
      // For South African ID, validate the number first
      if (personalInfo.idType === "South African ID") {
        if (updatedPersonalInfo.idNumber.length !== 13) {
          setPersonalInfo(updatedPersonalInfo)
          updateData({
            personalInfo: updatedPersonalInfo,
            contactDetails,
            addressDetails
          })
          return
        }
        
        setIdValidationErrors([])
          const validationResult = validateSouthAfricanID(updatedPersonalInfo.idNumber)
          if (!validationResult.isValid) {
            setIdValidationErrors(validationResult.errors)
            setPersonalInfo(updatedPersonalInfo)
            updateData({
              personalInfo: updatedPersonalInfo,
              contactDetails,
              addressDetails
            })
            return
        }
          }

      try {
          // Check for existing member
          const membersRef = collection(db, 'Members')
          const q = query(
            membersRef,
            where('idNumber', '==', updatedPersonalInfo.idNumber),
            where('idType', '==', updatedPersonalInfo.idType)
          )
          const memberSnapshot = await getDocs(q)

          if (!memberSnapshot.empty) {
            const memberDoc = memberSnapshot.docs[0]
            const memberData = memberDoc.data()

            // Helper function to validate and transform language
            const validateLanguage = (lang: string) => {
              const validLanguages = ["English", "Afrikaans", "Zulu", "Xhosa", "Sotho", "Tswana"]
              return validLanguages.includes(lang) ? lang : "English"
            }

            // Helper function to validate and transform marital status
            const validateMaritalStatus = (status: string) => {
              const validStatuses = ["Single", "Married", "Divorced", "Widowed"]
              return validStatuses.includes(status) ? status : "Single"
            }

            // Auto-populate fields
            const populatedPersonalInfo = {
              title: memberData.title || '',
              firstName: memberData.firstName || '',
              lastName: memberData.lastName || '',
              initials: memberData.initials || '',
              dateOfBirth: memberData.dateOfBirth ? new Date(memberData.dateOfBirth.seconds * 1000) : null,
              gender: memberData.gender || '',
              language: validateLanguage(memberData.language || ''),
              maritalStatus: validateMaritalStatus(memberData.maritalStatus || ''),
              nationality: memberData.nationality || '',
              idType: memberData.idType || personalInfo.idType,
              idNumber: memberData.idNumber || updatedPersonalInfo.idNumber,
              idDocumentUrl: memberData.idDocumentUrl || null,
            }

            // Fetch contact details
            const contactsRef = collection(db, 'Contacts')
            const contactsQuery = query(contactsRef, where('memberId', '==', memberDoc.id))
            const contactsSnapshot = await getDocs(contactsQuery)
            const contactDetails = contactsSnapshot.docs.map(doc => ({
              type: doc.data().type as "Email" | "Phone Number",
              value: doc.data().value
            }))

            // Fetch address details
            const addressRef = collection(db, 'Address')
            const addressQuery = query(addressRef, where('memberId', '==', memberDoc.id))
            const addressSnapshot = await getDocs(addressQuery)
            let addressDetails = {
              streetAddress: '',
              city: '',
              stateProvince: '',
              postalCode: '',
              country: ''
            }
            
            if (!addressSnapshot.empty) {
              const addressData = addressSnapshot.docs[0].data()
              addressDetails = {
                streetAddress: addressData.streetAddress || '',
                city: addressData.city || '',
                stateProvince: addressData.stateProvince || '',
                postalCode: addressData.postalCode || '',
                country: addressData.country || ''
              }
            }

            // Set active tab to show populated data
            setActiveTab("personal-info")

            // Update all form sections
            setPersonalInfo(populatedPersonalInfo)
            setContactDetails(contactDetails)
            setAddressDetails(addressDetails)

            // Update parent component
            updateData({
              personalInfo: populatedPersonalInfo,
              contactDetails,
              addressDetails
            })

            // Show success message with more details
            toast({
              title: "Existing Member Found",
              description: `Member details for ${memberData.firstName} ${memberData.lastName} have been auto-populated.`,
              variant: "default",
            })

            setWasAutoPopulated(true)  // Set flag when data is auto-populated
            return
          }
        } catch (error) {
          console.error('Error checking member:', error)
          setIdValidationErrors(['Error checking member details. Please try again.'])
      }
    }

    setPersonalInfo(updatedPersonalInfo)
    updateData({
      personalInfo: updatedPersonalInfo,
      contactDetails,
      addressDetails
    })
  }

  const handleContactDetailsChange = (index: number, field: string, value: string) => {
    const updatedContacts = [...contactDetails]
    updatedContacts[index] = { ...updatedContacts[index], [field]: value }
    setContactDetails(updatedContacts)
    
    // Update parent with all current data
    updateData({
      personalInfo,
      contactDetails: updatedContacts,
      addressDetails
    })
  }

  const handleAddContact = () => {
    const updatedContacts = [...contactDetails, { type: "Email" as "Email" | "Phone Number", value: "" }]
    setContactDetails(updatedContacts)
    
    // Update parent with all current data
    updateData({
      personalInfo,
      contactDetails: updatedContacts,
      addressDetails
    })
  }

  const handleRemoveContact = (index: number) => {
    const updatedContacts = contactDetails.filter((_, i) => i !== index) as Array<{ type: "Email" | "Phone Number", value: string }>
    setContactDetails(updatedContacts)
    
    // Update parent with all current data
    updateData({
      personalInfo,
      contactDetails: updatedContacts,
      addressDetails
    })
  }

  const handleAddressDetailsChange = (field: string, value: string) => {
    const updatedAddressDetails = { ...addressDetails, [field]: value }
    setAddressDetails(updatedAddressDetails)
    
    // Update parent with all current data
    updateData({
      personalInfo,
      contactDetails,
      addressDetails: updatedAddressDetails
    })
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setFileUploadStatus("uploading")
      try {
        
        setFileUploadStatus("success")
      } catch (error) {
        console.error("Error uploading file:", error)
        setFileUploadStatus("error")
      }
    }
  }

  // Add function to check missing fields in each tab
  const getMissingFieldsSummary = () => {
    if (!errors) return null;
    
    const personalInfoMissing = Object.keys(errors).some(key => 
      ['title', 'firstName', 'lastName', 'initials', 'dateOfBirth', 'gender', 
       'language', 'maritalStatus', 'nationality', 'idType', 'idNumber'].includes(key)
    );
    
    const contactDetailsMissing = Object.keys(errors).some(key => 
      key === 'contacts' || key.startsWith('contact')
    );
    
    const addressDetailsMissing = Object.keys(errors).some(key => 
      ['streetAddress', 'city', 'stateProvince', 'postalCode', 'country'].includes(key)
    );

    const missingTabs = [];
    if (personalInfoMissing && activeTab !== 'personal-info') missingTabs.push('Personal Information');
    if (contactDetailsMissing && activeTab !== 'contact-details') missingTabs.push('Contact Details');
    if (addressDetailsMissing && activeTab !== 'address-details') missingTabs.push('Address Details');

    return missingTabs.length > 0 ? (
      <div className="mb-4 text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
        Please complete required fields in: {missingTabs.join(', ')}
      </div>
    ) : null;
  };

  return (
    <div className="space-y-6">
      {errors && getMissingFieldsSummary()}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger 
            value="personal-info"
            data-state={activeTab === "personal-info" ? "active" : "inactive"}
          >
            Personal Information
          </TabsTrigger>
          <TabsTrigger 
            value="contact-details"
            data-state={activeTab === "contact-details" ? "active" : "inactive"}
          >
            Contact Details
          </TabsTrigger>
          <TabsTrigger 
            value="address-details"
            data-state={activeTab === "address-details" ? "active" : "inactive"}
          >
            Address Details
          </TabsTrigger>
        </TabsList>

        <TabsContent 
          value="personal-info"
          data-state={activeTab === "personal-info" ? "active" : "inactive"}
        >
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex gap-3 col-span-3">
                <div className="flex-1">
                  <Label htmlFor="type-of-id">Type of ID</Label>
                  <Select
                    value={personalInfo.idType}
                    onValueChange={(value: "South African ID" | "Passport") => handlePersonalInfoChange("idType", value)}
                    disabled={isDisabled}
                  >
                    <SelectTrigger id="type-of-id" className={errors?.idType ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select ID type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="South African ID">South African ID</SelectItem>
                      <SelectItem value="Passport">Passport</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors?.idType && (
                    <p className="text-sm text-red-500 mt-1">{errors.idType}</p>
                  )}
                </div>

                <div className="flex-1">
                  <Label htmlFor="id-input">
                    ID Number / Passport Number
                    {personalInfo.idType === "South African ID" && (
                      <span className="text-sm text-gray-500 ml-2">(13 digits)</span>
                    )}
                  </Label>
                  <Input
                    id="id-input"
                    data-testid="id-input"
                    aria-label="ID Number / Passport Number"
                    placeholder={personalInfo.idType === "South African ID" ? "Enter 13 digit ID number" : "Enter passport number"}
                    value={personalInfo.idNumber}
                    onChange={(e) => handlePersonalInfoChange("idNumber", e.target.value)}
                    className={`${
                      errors?.idNumber || idValidationErrors.length > 0 
                        ? "border-red-500 border-2" 
                        : wasAutoPopulated 
                          ? "border-yellow-400 border-2" 
                          : personalInfo.idNumber && !wasAutoPopulated 
                            ? "border-green-500 border-2" 
                            : ""
                    }`}
                    maxLength={personalInfo.idType === "South African ID" ? 13 : 20}
                    disabled={isDisabled}
                  />
                  {errors?.idNumber && (
                    <p className="text-sm text-red-500 mt-1">{errors.idNumber}</p>
                  )}
                </div>
              </div>

              {personalInfo.idType === "South African ID" && idValidationErrors.length > 0 && (
                <div className="col-span-3">
                  <Alert variant="destructive" className="mt-1">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <ul className="list-disc pl-4">
                        {idValidationErrors.map((error, index) => (
                          <li key={index} className="text-sm">{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <div>
                <Label htmlFor="title">Title</Label>
                <Select
                  value={personalInfo.title}
                  onValueChange={(value) => handlePersonalInfoChange("title", value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger id="title" className={errors?.title ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select title" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mr">Mr</SelectItem>
                    <SelectItem value="Mrs">Mrs</SelectItem>
                    <SelectItem value="Ms">Ms</SelectItem>
                    <SelectItem value="Dr">Dr</SelectItem>
                  </SelectContent>
                </Select>
                {errors?.title && (
                  <p className="text-sm text-red-500 mt-1">{errors.title}</p>
                )}
              </div>

              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={personalInfo.firstName}
                  onChange={(e) => handlePersonalInfoChange("firstName", e.target.value)}
                  className={errors?.firstName ? "border-red-500" : ""}
                  disabled={isDisabled}
                />
                {errors?.firstName && (
                  <p className="text-sm text-red-500 mt-1">{errors.firstName}</p>
                )}
              </div>

              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={personalInfo.lastName}
                  onChange={(e) => handlePersonalInfoChange("lastName", e.target.value)}
                  className={errors?.lastName ? "border-red-500" : ""}
                  disabled={isDisabled}
                />
                {errors?.lastName && (
                  <p className="text-sm text-red-500 mt-1">{errors.lastName}</p>
                )}
              </div>

              <div>
                <Label htmlFor="initials">Initials</Label>
                <Input
                  id="initials"
                  value={personalInfo.initials}
                  onChange={(e) => handlePersonalInfoChange("initials", e.target.value)}
                  className={errors?.initials ? "border-red-500" : ""}
                  disabled={isDisabled}
                />
                {errors?.initials && (
                  <p className="text-sm text-red-500 mt-1">{errors.initials}</p>
                )}
              </div>

              <div>
                <Label htmlFor="dateofbirth">Date of Birth</Label>
                <DatePicker
                  date={personalInfo.dateOfBirth}
                  onChange={(date) => handlePersonalInfoChange("dateOfBirth", date)}
                  disabled={isDisabled}
                />
                {errors?.dateOfBirth && (
                  <p className="text-sm text-red-500 mt-1">{errors.dateOfBirth}</p>
                )}
              </div>

              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={personalInfo.gender}
                  onValueChange={(value) => handlePersonalInfoChange("gender", value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger id="gender" className={errors?.gender ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors?.gender && (
                  <p className="text-sm text-red-500 mt-1">{errors.gender}</p>
                )}
              </div>

              <div>
                <Label htmlFor="language">Language</Label>
                <Select
                  value={personalInfo.language}
                  onValueChange={(value) => handlePersonalInfoChange("language", value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger id="language" className={errors?.language ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Afrikaans">Afrikaans</SelectItem>
                    <SelectItem value="Zulu">Zulu</SelectItem>
                    <SelectItem value="Xhosa">Xhosa</SelectItem>
                    <SelectItem value="Sotho">Sotho</SelectItem>
                    <SelectItem value="Tswana">Tswana</SelectItem>
                  </SelectContent>
                </Select>
                {errors?.language && (
                  <p className="text-sm text-red-500 mt-1">{errors.language}</p>
                )}
              </div>

              <div>
                <Label htmlFor="marital-status">Marital Status</Label>
                <Select
                  value={personalInfo.maritalStatus}
                  onValueChange={(value) => handlePersonalInfoChange("maritalStatus", value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger id="marital-status" className={errors?.maritalStatus ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select marital status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem id="single" data-value="Single" value="Single">Single</SelectItem>
                    <SelectItem id="married" data-value="Married" value="Married">Married</SelectItem>
                    <SelectItem id="divorced" data-value="Divorced" value="Divorced">Divorced</SelectItem>
                    <SelectItem id="widowed" data-value="Widowed" value="Widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
                {errors?.maritalStatus && (
                  <p className="text-sm text-red-500 mt-1">{errors.maritalStatus}</p>
                )}
              </div>

              <div>
                <Label htmlFor="nationality">Nationality</Label>
                <Select
                  value={personalInfo.nationality}
                  onValueChange={(value) => handlePersonalInfoChange("nationality", value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger id="nationality" className={errors?.nationality ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem id="South African" data-value="South African" value="South African">South African</SelectItem>
                    <SelectItem id="Zimbabwean" data-value="Zimbabwean" value="Zimbabwean">Zimbabwean</SelectItem>
                    <SelectItem id="Mozambican" data-value="Mozambican" value="Mozambican">Mozambican</SelectItem>
                    <SelectItem id="Namibian" data-value="Namibian" value="Namibian">Namibian</SelectItem>
                    <SelectItem id="Botswanan" data-value="Botswanan" value="Botswanan">Botswanan</SelectItem>
                    <SelectItem id="Other" data-value="Other" value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors?.nationality && (
                  <p className="text-sm text-red-500 mt-1">{errors.nationality}</p>
                )}
              </div>

              <div className="col-span-3">
                <Label htmlFor="iddocument">ID Document</Label>
                <div className="flex items-center gap-3">
                <Input
                    id="iddocument" 
                    type="file" 
                    accept=".pdf" 
                    onChange={handleFileUpload}
                    aria-label="ID Document"
                    className="flex-1"
                    disabled={isDisabled}
                  />
                {personalInfo.idDocumentUrl && (
                    <a 
                      href={personalInfo.idDocumentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:text-blue-700"
                    >
                      View Document
                  </a>
                )}
                </div>
                {fileUploadStatus === "uploading" && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
                {fileUploadStatus === "success" && <p className="text-sm text-green-500 mt-1">Upload successful</p>}
                {fileUploadStatus === "error" && <p className="text-sm text-red-500 mt-1">Upload failed. Please try again.</p>}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent 
          value="contact-details"
          data-state={activeTab === "contact-details" ? "active" : "inactive"}
        >
          <Card className="p-4">
            <div className="space-y-4">
              {errors?.contacts && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.contacts}</AlertDescription>
                </Alert>
              )}
            {contactDetails.map((contact, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                <Select
                  value={contact.type}
                  onValueChange={(value: "Email" | "Phone Number") => handleContactDetailsChange(index, "type", value)}
                  disabled={isDisabled}
                >
                        <SelectTrigger className={errors?.[`contact${index}`] ? "border-red-500" : ""}>
                          <SelectValue>{contact.type}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Phone Number">Phone Number</SelectItem>
                  </SelectContent>
                </Select>
                    </div>
                    <div className="flex-[2]">
                <Input
                  value={contact.value}
                  onChange={(e) => handleContactDetailsChange(index, "value", e.target.value)}
                        className={errors?.[`contact${index}`] ? "border-red-500" : ""}
                        placeholder={contact.type === "Email" ? "Enter email address" : "Enter phone number"}
                />
                    </div>
                    <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveContact(index)} disabled={isDisabled}>
                  Remove
                </Button>
                  </div>
                  {errors?.[`contact${index}`] && (
                    <p className="text-sm text-red-500">{errors[`contact${index}`]}</p>
                  )}
              </div>
            ))}
              <Button id="Add Contact" type="button" onClick={handleAddContact} size="sm" disabled={isDisabled}>
              Add Contact
            </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent 
          value="address-details"
          data-state={activeTab === "address-details" ? "active" : "inactive"}
        >
          <Card className="p-4">
            <div className="space-y-4">
              {errors?.addresses && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.addresses}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                <Label htmlFor="streetAddress">Street Address</Label>
                <Input
                  id="streetAddress"
                  value={addressDetails.streetAddress}
                  onChange={(e) => handleAddressDetailsChange("streetAddress", e.target.value)}
                    className={errors?.streetAddress ? "border-red-500" : ""}
                    disabled={isDisabled}
                />
                  {errors?.streetAddress && (
                    <p className="text-sm text-red-500 mt-1">{errors.streetAddress}</p>
                  )}
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={addressDetails.city}
                  onChange={(e) => handleAddressDetailsChange("city", e.target.value)}
                    className={errors?.city ? "border-red-500" : ""}
                    disabled={isDisabled}
                />
                  {errors?.city && (
                    <p className="text-sm text-red-500 mt-1">{errors.city}</p>
                  )}
              </div>
              <div>
                <Label htmlFor="stateProvince">State/Province</Label>
                <Input
                  id="stateProvince"
                  value={addressDetails.stateProvince}
                  onChange={(e) => handleAddressDetailsChange("stateProvince", e.target.value)}
                    className={errors?.stateProvince ? "border-red-500" : ""}
                    disabled={isDisabled}
                />
                  {errors?.stateProvince && (
                    <p className="text-sm text-red-500 mt-1">{errors.stateProvince}</p>
                  )}
              </div>
              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  value={addressDetails.postalCode}
                  onChange={(e) => handleAddressDetailsChange("postalCode", e.target.value)}
                    className={errors?.postalCode ? "border-red-500" : ""}
                    disabled={isDisabled}
                />
                  {errors?.postalCode && (
                    <p className="text-sm text-red-500 mt-1">{errors.postalCode}</p>
                  )}
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Select
                  value={addressDetails.country}
                  onValueChange={(value) => handleAddressDetailsChange("country", value)}
                  disabled={isDisabled}
                >
                    <SelectTrigger id="country" className={errors?.country ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="South Africa">South Africa</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                  {errors?.country && (
                    <p className="text-sm text-red-500 mt-1">{errors.country}</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


