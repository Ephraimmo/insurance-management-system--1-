"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { Button } from "@/components/ui/button"
import { BeneficiaryData } from "./BeneficiaryDetails"
import { validateSouthAfricanID } from "@/src/utils/idValidation"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

type BeneficiaryFormProps = {
  data: BeneficiaryData
  updateData: (data: BeneficiaryData) => void
  mainMemberIdNumber?: string
  errors?: { [key: string]: string } | null
}

type CateringOptionsProps = {
  selectedOptions: string[]
  onChange: (options: string[]) => void
}

export function BeneficiaryForm({ data, updateData, mainMemberIdNumber, errors }: BeneficiaryFormProps) {
  const [personalInfo, setPersonalInfo] = useState(data.personalInfo)
  const [contactDetails, setContactDetails] = useState(data.contactDetails)
  const [addressDetails, setAddressDetails] = useState(data.addressDetails)
  const [activeTab, setActiveTab] = useState("personal-info")
  const [idValidationErrors, setIdValidationErrors] = useState<string[]>([])

  const handlePersonalInfoChange = (field: string, value: string | Date | null | number) => {
    const updatedInfo = { ...personalInfo, [field]: value };

    // Validate ID number in real-time
    if (field === "idNumber" && typeof value === "string" && updatedInfo.idType === "South African ID") {
      // First check if ID matches main member's ID
      if (mainMemberIdNumber && value === mainMemberIdNumber) {
        setIdValidationErrors(['Beneficiary cannot have the same ID number as the main member']);
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

    setPersonalInfo(updatedInfo);
    updateData({ ...data, personalInfo: updatedInfo });
  }

  const handleContactDetailsChange = (index: number, field: string, value: string) => {
    const updatedContacts = [...contactDetails]
    updatedContacts[index] = { ...updatedContacts[index], [field]: value }
    setContactDetails(updatedContacts)
    updateData({ ...data, contactDetails: updatedContacts })
  }

  const handleAddressDetailsChange = (field: string, value: string) => {
    setAddressDetails((prev) => ({ ...prev, [field]: value }))
    updateData({ ...data, addressDetails: { ...addressDetails, [field]: value } })
  }

  const handleAddContact = () => {
    const updatedContacts = [...contactDetails, { type: "Email" as "Email" | "Phone Number", value: "" }]
    setContactDetails(updatedContacts)
    updateData({ ...data, contactDetails: updatedContacts })
  }

  const handleRemoveContact = (index: number) => {
    const updatedContacts = contactDetails.filter((_, i) => i !== index)
    setContactDetails(updatedContacts)
    updateData({ ...data, contactDetails: updatedContacts })
  }

  // Add function to get missing fields summary
  const getMissingFieldsSummary = () => {
    if (!errors) return null;
    
    const personalInfoMissing = Object.keys(errors).some(key => 
      ['title', 'firstName', 'lastName', 'initials', 'dateOfBirth', 'gender', 
       'relationshipToMainMember', 'nationality', 'idType', 'idNumber'].includes(key)
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
                    onValueChange={(value: "South African ID" | "Passport") => {
                      handlePersonalInfoChange("idType", value);
                      setIdValidationErrors([]);
                    }}
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
                  <Label htmlFor="idnumber/passportnumber">
                    ID Number / Passport Number
                    {personalInfo.idType === "South African ID" && (
                      <span className="text-sm text-gray-500 ml-2">(13 digits)</span>
                    )}
                  </Label>
                  <Input
                    id="idnumber/passportnumber"
                    aria-label="idnumber/passportnumber"
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
                <Label htmlFor="relationshipToMainMember">Relationship</Label>
                <Select 
                  value={personalInfo.relationshipToMainMember} 
                  onValueChange={(value) => handlePersonalInfoChange("relationshipToMainMember", value)}
                >
                  <SelectTrigger id="relationshipToMainMember" className={errors?.relationshipToMainMember ? "border-red-500" : ""}>
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
                {errors?.relationshipToMainMember && (
                  <p className="text-sm text-red-500 mt-1">{errors.relationshipToMainMember}</p>
                )}
              </div>

              <div>
                <Label htmlFor="beneficiaryPercentage">Benefit %</Label>
                <Input
                  id="beneficiaryPercentage"
                  type="number"
                  min="0"
                  max="100"
                  value={personalInfo.beneficiaryPercentage}
                  onChange={(e) => handlePersonalInfoChange("beneficiaryPercentage", parseFloat(e.target.value))}
                />
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
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <DatePicker
                  id="dateOfBirth"
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
                <Label htmlFor="nationality">Nationality</Label>
                <Select value={personalInfo.nationality} onValueChange={(value) => handlePersonalInfoChange("nationality", value)}>
                  <SelectTrigger id="nationality" className={errors?.nationality ? "border-red-500" : ""}>
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
                {errors?.nationality && (
                  <p className="text-sm text-red-500 mt-1">{errors.nationality}</p>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="contact-details">
          <Card className="p-4">
            <div className="space-y-2">
              {errors?.contacts && (
                <Alert variant="destructive" className="mb-4">
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
                        <SelectTrigger className={`w-[180px] ${errors?.[`contact${index}`] ? "border-red-500" : ""}`}>
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
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 