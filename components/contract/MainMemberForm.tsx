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
}

export function MainMemberForm({ data, updateData, errors }: MainMemberFormProps) {
  const [personalInfo, setPersonalInfo] = useState(data.personalInfo)
  const [contactDetails, setContactDetails] = useState(data.contactDetails)
  const [addressDetails, setAddressDetails] = useState(data.addressDetails)
  const [activeTab, setActiveTab] = useState("personal-info")
  const [fileUploadStatus, setFileUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle")
  const [idValidationErrors, setIdValidationErrors] = useState<string[]>([])

  // Update local state when parent data changes
  useEffect(() => {
    setPersonalInfo(data.personalInfo)
    setContactDetails(data.contactDetails)
    setAddressDetails(data.addressDetails)
  }, [data])

  const handlePersonalInfoChange = async (field: string, value: string | Date | null) => {
    const updatedPersonalInfo = { ...personalInfo, [field]: value }
    
    // Validate ID number in real-time
    if (field === "idNumber" && typeof value === "string" && updatedPersonalInfo.idType === "South African ID") {
      const validationResult = validateSouthAfricanID(value);
      setIdValidationErrors(validationResult.errors);

      if (validationResult.isValid) {
        // Check for existing contract with this ID
        try {
          const contractsQuery = query(
            collection(db, 'Contracts'),
            where('memberIdNumber', '==', value)
          );
          const contractSnapshot = await getDocs(contractsQuery);
          
          if (!contractSnapshot.empty) {
            const existingContract = contractSnapshot.docs[0].data();
            setIdValidationErrors([`A contract already exists with this ID number (Contract Number: ${existingContract.contractNumber})`]);
            return;
          }
        } catch (error) {
          console.error('Error checking for existing contract:', error);
          setIdValidationErrors(['Error checking for existing contract. Please try again.']);
          return;
        }

        // Auto-fill date of birth and gender if valid
        if (validationResult.dateOfBirth) {
          updatedPersonalInfo.dateOfBirth = validationResult.dateOfBirth;
        }
        if (validationResult.gender) {
          updatedPersonalInfo.gender = validationResult.gender;
        }
      } else {
        // Even if not fully valid, still try to auto-fill what we can
        if (validationResult.dateOfBirth) {
          updatedPersonalInfo.dateOfBirth = validationResult.dateOfBirth;
        }
        if (validationResult.gender) {
          updatedPersonalInfo.gender = validationResult.gender;
        }
      }
    }

    // Clear validation errors when switching ID type
    if (field === "idType") {
      setIdValidationErrors([]);
    }

    setPersonalInfo(updatedPersonalInfo)
    
    // Update parent with all current data
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
    <div className="space-y-4">
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
                  <Label htmlFor="idnumber">
                    ID Number / Passport Number
                    {personalInfo.idType === "South African ID" && (
                      <span className="text-sm text-gray-500 ml-2">(13 digits)</span>
                    )}
                  </Label>
                  <Input
                    id="idnumber"
                    value={personalInfo.idNumber}
                    onChange={(e) => handlePersonalInfoChange("idNumber", e.target.value)}
                    className={errors?.idNumber ? "border-red-500" : ""}
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
                <Select value={personalInfo.title} onValueChange={(value) => handlePersonalInfoChange("title", value)}>
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
                />
                {errors?.initials && (
                  <p className="text-sm text-red-500 mt-1">{errors.initials}</p>
                )}
              </div>

              <div>
                <Label htmlFor="dateofbirth">Date of Birth</Label>
                <DatePicker
                  id="dateofbirth"
                  selected={personalInfo.dateOfBirth}
                  onSelect={(date) => handlePersonalInfoChange("dateOfBirth", date)}
                  className={errors?.dateOfBirth ? "border-red-500" : ""}
                />
                {errors?.dateOfBirth && (
                  <p className="text-sm text-red-500 mt-1">{errors.dateOfBirth}</p>
                )}
              </div>

              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select value={personalInfo.gender} onValueChange={(value) => handlePersonalInfoChange("gender", value)}>
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
                <Select value={personalInfo.language} onValueChange={(value) => handlePersonalInfoChange("language", value)}>
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
                <Select value={personalInfo.maritalStatus} onValueChange={(value) => handlePersonalInfoChange("maritalStatus", value)}>
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
                <Select value={personalInfo.nationality} onValueChange={(value) => handlePersonalInfoChange("nationality", value)}>
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
                >
                        <SelectTrigger className={errors?.[`contact${index}`] ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select contact type" />
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
                    <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveContact(index)}>
                  Remove
                </Button>
                  </div>
                  {errors?.[`contact${index}`] && (
                    <p className="text-sm text-red-500">{errors[`contact${index}`]}</p>
                  )}
              </div>
            ))}
              <Button id="Add Contact" type="button" onClick={handleAddContact} size="sm">
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


