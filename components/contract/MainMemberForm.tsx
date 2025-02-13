"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { MainMemberDetails } from "@/components/contract/MainMemberDetails"


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

type MainMemberFormProps = {
  data: MainMemberData
  updateData: (data: { mainMember: MainMemberData }) => void
}

export function MainMemberForm({ data, updateData }: MainMemberFormProps) {
  const [personalInfo, setPersonalInfo] = useState(data.personalInfo || {})
  const [contactDetails, setContactDetails] = useState(data.contactDetails || [])
  const [addressDetails, setAddressDetails] = useState(data.addressDetails || {})
  const [activeTab, setActiveTab] = useState("personal-info")
  const [fileUploadStatus, setFileUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle")

  const handlePersonalInfoChange = (field: string, value: string | Date | null) => {
    setPersonalInfo((prev) => ({ ...prev, [field]: value }))
    updateData({ mainMember: { ...data, personalInfo: { ...personalInfo, [field]: value } } })
  }

  const handleContactDetailsChange = (index: number, field: string, value: string) => {
    const updatedContacts = [...contactDetails]
    updatedContacts[index] = { ...updatedContacts[index], [field]: value }
    setContactDetails(updatedContacts)
    updateData({ mainMember: { ...data, contactDetails: updatedContacts } })
  }

  const handleAddContact = () => {
    setContactDetails([...contactDetails, { type: "Email", value: "" }])
  }

  const handleRemoveContact = (index: number) => {
    const updatedContacts = contactDetails.filter((_, i) => i !== index)
    setContactDetails(updatedContacts)
    updateData({ mainMember: { ...data, contactDetails: updatedContacts } })
  }

  const handleAddressDetailsChange = (field: string, value: string) => {
    setAddressDetails((prev) => ({ ...prev, [field]: value }))
    updateData({ mainMember: { ...data, addressDetails: { ...addressDetails, [field]: value } } })
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personal-info">Personal Information</TabsTrigger>
          <TabsTrigger value="contact-details">Contact Details</TabsTrigger>
          <TabsTrigger value="address-details">Address Details</TabsTrigger>
        </TabsList>

        <TabsContent value="personal-info">
          <Card className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Select value={personalInfo.title} onValueChange={(value) => handlePersonalInfoChange("title", value)}>
                  <SelectTrigger id="title">
                    <SelectValue placeholder="Select title" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mr">Mr</SelectItem>
                    <SelectItem value="Mrs">Mrs</SelectItem>
                    <SelectItem value="Ms">Ms</SelectItem>
                    <SelectItem value="Dr">Dr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  value={personalInfo.language}
                  onChange={(e) => handlePersonalInfoChange("language", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="maritalStatus">Marital Status</Label>
                <Select value={personalInfo.maritalStatus} onValueChange={(value) => handlePersonalInfoChange("maritalStatus", value)}>
                  <SelectTrigger id="maritalStatus">
                    <SelectValue placeholder="Select marital status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Divorced">Divorced</SelectItem>
                    <SelectItem value="Widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="nationality">Nationality</Label>
                <Input
                  id="nationality"
                  value={personalInfo.nationality}
                  onChange={(e) => handlePersonalInfoChange("nationality", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="idType">Type of ID</Label>
                <Select
                  value={personalInfo.idType}
                  onValueChange={(value: "South African ID" | "Passport") => handlePersonalInfoChange("idType", value)}
                >
                  <SelectTrigger id="idType">
                    <SelectValue placeholder="Select ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="South African ID">South African ID</SelectItem>
                    <SelectItem value="Passport">Passport</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="idNumber">ID Number / Passport Number</Label>
                <Input
                  id="idNumber"
                  value={personalInfo.idNumber}
                  onChange={(e) => handlePersonalInfoChange("idNumber", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="idDocument">ID Document (PDF)</Label>
                <Input id="idDocument" type="file" accept=".pdf" onChange={handleFileUpload} />
                {fileUploadStatus === "uploading" && <p>Uploading...</p>}
                {fileUploadStatus === "success" && <p>Upload successful</p>}
                {fileUploadStatus === "error" && <p>Upload failed. Please try again.</p>}
                {personalInfo.idDocumentUrl && (
                  <a href={personalInfo.idDocumentUrl} target="_blank" rel="noopener noreferrer">
                    View uploaded document
                  </a>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="contact-details">
          <Card className="p-6">
            {contactDetails.map((contact, index) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <Select
                  value={contact.type}
                  onValueChange={(value: "Email" | "Phone Number") => handleContactDetailsChange(index, "type", value)}
                >
                  <SelectTrigger>
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
                />
                <Button type="button" variant="destructive" onClick={() => handleRemoveContact(index)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" onClick={handleAddContact}>
              Add Contact
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="address-details">
          <Card className="p-6">
            <div className="space-y-2">
              <div>
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

