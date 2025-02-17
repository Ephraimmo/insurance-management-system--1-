"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { validateSouthAfricanID } from "@/src/utils/idValidation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

type DependentData = {
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

type DependentFormProps = {
  data: DependentData
  updateData: (data: DependentData) => void
  error?: string | null
  mainMemberIdNumber?: string
}

export function DependentForm({ data, updateData, error: externalError, mainMemberIdNumber }: DependentFormProps) {
  const [personalInfo, setPersonalInfo] = useState(data.personalInfo)
  const [contactDetails, setContactDetails] = useState(data.contactDetails)
  const [addressDetails, setAddressDetails] = useState(data.addressDetails)
  const [activeTab, setActiveTab] = useState("personal-info")
  const [error, setError] = useState<string | null>(externalError || null)
  const [idValidationErrors, setIdValidationErrors] = useState<string[]>([])

  useEffect(() => {
    setError(externalError || null)
  }, [externalError])

  const handlePersonalInfoChange = (field: string, value: string | Date | null) => {
    setError(null)
    const updatedInfo = { ...personalInfo, [field]: value }

    // Validate ID number in real-time
    if (field === "idNumber" && typeof value === "string" && updatedInfo.idType === "South African ID") {
      // First check if ID matches main member's ID
      if (mainMemberIdNumber && value === mainMemberIdNumber) {
        setIdValidationErrors(['Dependent cannot have the same ID number as the main member']);
        return;
      }

      const validationResult = validateSouthAfricanID(value);
      setIdValidationErrors(validationResult.errors);

      // Auto-fill date of birth and gender if valid
      if (validationResult.isValid) {
        if (validationResult.dateOfBirth) {
          updatedInfo.dateOfBirth = validationResult.dateOfBirth;
        }
        if (validationResult.gender) {
          updatedInfo.gender = validationResult.gender;
        }
      } else {
        // Even if not fully valid, still try to auto-fill what we can
        if (validationResult.dateOfBirth) {
          updatedInfo.dateOfBirth = validationResult.dateOfBirth;
        }
        if (validationResult.gender) {
          updatedInfo.gender = validationResult.gender;
        }
      }
    }

    // Clear validation errors when switching ID type
    if (field === "idType") {
      setIdValidationErrors([]);
    }

    setPersonalInfo(updatedInfo)
    updateData({ ...data, personalInfo: updatedInfo })
  }

  const handleContactDetailsChange = (index: number, field: string, value: string) => {
    setError(null)
    const updatedContacts = [...contactDetails]
    updatedContacts[index] = { ...updatedContacts[index], [field]: value }
    setContactDetails(updatedContacts)
    updateData({ ...data, contactDetails: updatedContacts })
  }

  const handleAddressDetailsChange = (field: string, value: string) => {
    setError(null)
    const updatedAddress = { ...addressDetails, [field]: value }
    setAddressDetails(updatedAddress)
    updateData({ ...data, addressDetails: updatedAddress })
  }

  const handleAddContact = () => {
    setError(null)
    const updatedContacts = [...contactDetails, { type: "Email" as "Email" | "Phone Number", value: "" }]
    setContactDetails(updatedContacts)
    updateData({ ...data, contactDetails: updatedContacts })
  }

  const handleRemoveContact = (index: number) => {
    setError(null)
    const updatedContacts = contactDetails.filter((_, i) => i !== index)
    setContactDetails(updatedContacts)
    updateData({ ...data, contactDetails: updatedContacts })
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
          {error}
        </div>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personal-info">Personal Information</TabsTrigger>
          <TabsTrigger value="contact-details">Contact Details</TabsTrigger>
          <TabsTrigger value="address-details">Address Details</TabsTrigger>
        </TabsList>

        <TabsContent value="personal-info">
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex gap-3 col-span-3">
                <div className="flex-1">
                  <Label htmlFor="type-of-id">Type of ID</Label>
                  <Select
                    value={personalInfo.idType}
                    onValueChange={(value: "South African ID" | "Passport") => handlePersonalInfoChange("idType", value)}
                  >
                    <SelectTrigger id="type-of-id">
                      <SelectValue placeholder="Select ID type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="South African ID">South African ID</SelectItem>
                      <SelectItem value="Passport">Passport</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <Label htmlFor="idnumber/passportnumber">
                    ID Number / Passport Number
                    {personalInfo.idType === "South African ID" && (
                      <span className="text-sm text-gray-500 ml-2">(13 digits)</span>
                    )}
                  </Label>
                  <Input
                    aria-label="idnumber/passportnumber"
                    value={personalInfo.idNumber}
                    onChange={(e) => handlePersonalInfoChange("idNumber", e.target.value)}
                    className={idValidationErrors.length > 0 ? "border-red-500" : ""}
                  />
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
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={personalInfo.firstName}
                  onChange={(e) => handlePersonalInfoChange("firstName", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={personalInfo.lastName}
                  onChange={(e) => handlePersonalInfoChange("lastName", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="initials">Initials</Label>
                <Input
                  id="initials"
                  value={personalInfo.initials}
                  onChange={(e) => handlePersonalInfoChange("initials", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <DatePicker
                  selected={personalInfo.dateOfBirth}
                  onSelect={(date) => handlePersonalInfoChange("dateOfBirth", date)}
                />
              </div>

              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select value={personalInfo.gender} onValueChange={(value) => handlePersonalInfoChange("gender", value)}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="relationshipToMainMember">Relationship</Label>
                <Select 
                  value={personalInfo.relationshipToMainMember} 
                  onValueChange={(value) => handlePersonalInfoChange("relationshipToMainMember", value)}
                >
                  <SelectTrigger id="relationshipToMainMember">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Spouse">Spouse</SelectItem>
                    <SelectItem value="Child">Child</SelectItem>
                    <SelectItem value="Parent">Parent</SelectItem>
                    <SelectItem value="Sibling">Sibling</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="nationality">Nationality</Label>
                <Select value={personalInfo.nationality} onValueChange={(value) => handlePersonalInfoChange("nationality", value)}>
                  <SelectTrigger id="nationality">
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="South African">South African</SelectItem>
                    <SelectItem value="Zimbabwean">Zimbabwean</SelectItem>
                    <SelectItem value="Mozambican">Mozambican</SelectItem>
                    <SelectItem value="Namibian">Namibian</SelectItem>
                    <SelectItem value="Botswanan">Botswanan</SelectItem>
                    <SelectItem value="Lesotho">Lesotho</SelectItem>
                    <SelectItem value="Swazi">Swazi</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="dependentStatus">Status</Label>
                <Select
                  value={personalInfo.dependentStatus}
                  onValueChange={(value: "Active" | "Inactive") => handlePersonalInfoChange("dependentStatus", value)}
                >
                  <SelectTrigger id="dependentStatus">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="contact-details">
          <Card className="p-4">
            <div className="space-y-2">
              {contactDetails.map((contact, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Select
                    value={contact.type}
                    onValueChange={(value: "Email" | "Phone Number") => handleContactDetailsChange(index, "type", value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select contact type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Email">Email</SelectItem>
                      <SelectItem value="Phone Number">Phone Number</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={contact.value}
                    onChange={(e) => handleContactDetailsChange(index, "value", e.target.value)}
                    className="flex-1"
                  />
                  <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveContact(index)}>
                    Remove
                  </Button>
                </div>
              ))}
              <Button id="Add Contact" type="button" onClick={handleAddContact} size="sm" className="mt-2">
                Add Contact
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="address-details">
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="streetAddress">Street Address</Label>
                <Input
                  id="streetAddress"
                  value={addressDetails.streetAddress}
                  onChange={(e) => handleAddressDetailsChange("streetAddress", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={addressDetails.city}
                  onChange={(e) => handleAddressDetailsChange("city", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="stateProvince">State/Province</Label>
                <Input
                  id="stateProvince"
                  value={addressDetails.stateProvince}
                  onChange={(e) => handleAddressDetailsChange("stateProvince", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  value={addressDetails.postalCode}
                  onChange={(e) => handleAddressDetailsChange("postalCode", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Select
                  value={addressDetails.country}
                  onValueChange={(value) => handleAddressDetailsChange("country", value)}
                >
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="South Africa">South Africa</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 