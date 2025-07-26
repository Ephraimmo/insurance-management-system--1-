"use client"

import { useState, useEffect } from "react"
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
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { toast } from "@/components/ui/use-toast"

type ValidationErrors = { [key: string]: string } | null

type TabId = "personal-info" | "contact-details" | "address-details"

interface BeneficiaryFormProps {
  data: BeneficiaryData
  updateData: (data: BeneficiaryData) => void
  error?: ValidationErrors
  mainMemberIdNumber?: string
  validationErrors?: ValidationErrors
  onTabChange?: (tab: TabId) => void
  isEditing?: boolean
}

type CateringOptionsProps = {
  selectedOptions: string[]
  onChange: (options: string[]) => void
}

export function BeneficiaryForm({ 
  data, 
  updateData, 
  error: externalError, 
  mainMemberIdNumber,
  validationErrors = {},
  onTabChange,
  isEditing = false
}: BeneficiaryFormProps) {
  const [personalInfo, setPersonalInfo] = useState(data.personalInfo)
  const [contactDetails, setContactDetails] = useState(data.contactDetails)
  const [addressDetails, setAddressDetails] = useState(data.addressDetails)
  const [activeTab, setActiveTab] = useState<TabId>("personal-info")
  const [idValidationErrors, setIdValidationErrors] = useState<string[]>([])
  const [autoPopulatedMemberId, setAutoPopulatedMemberId] = useState<string | null>(null)
  const [passportCheckTimeout, setPassportCheckTimeout] = useState<NodeJS.Timeout | null>(null)
  const [idCheckTimeout, setIdCheckTimeout] = useState<NodeJS.Timeout | null>(null)
  const [isExistingMember, setIsExistingMember] = useState(false)
  const [memberCheckComplete, setMemberCheckComplete] = useState(false)

  const handlePersonalInfoChange = (field: string, value: string | Date | null) => {
    const updatedInfo = { ...personalInfo, [field]: value }

    // Reset auto-populated state when ID number changes
    if (field === "idNumber") {
      setAutoPopulatedMemberId(null);
      setIdValidationErrors([]);
      setMemberCheckComplete(false);
      setIsExistingMember(false);

      if (typeof value === "string") {
        if (updatedInfo.idType === "South African ID") {
          // First check if ID matches main member's ID
          if (mainMemberIdNumber && value === mainMemberIdNumber) {
            setIdValidationErrors(['Beneficiary cannot have the same ID number as the main member']);
            return;
          }

          // Only validate if we have a complete ID number
          if (value.length === 13) {
            const validationResult = validateSouthAfricanID(value);
            if (!validationResult.isValid) {
              setIdValidationErrors(validationResult.errors);
            } else {
              // Auto-fill date of birth and gender if valid
              if (validationResult.dateOfBirth) {
                updatedInfo.dateOfBirth = validationResult.dateOfBirth;
              }
              if (validationResult.gender) {
                updatedInfo.gender = validationResult.gender;
              }
              // Check for existing member in Firestore
              checkExistingMember(value, updatedInfo);
            }
          }
        } else if (updatedInfo.idType === "Passport") {
          // Clear any existing timeout
          if (passportCheckTimeout) {
            clearTimeout(passportCheckTimeout);
          }

          // Set a new timeout for passport check
          const timeout = setTimeout(() => {
            if (mainMemberIdNumber && value === mainMemberIdNumber) {
              setIdValidationErrors(['Beneficiary cannot have the same passport number as the main member']);
              return;
            }
            // Check for existing member in Firestore
            checkExistingMember(value, updatedInfo);
          }, 1000); // Wait for 1 second after typing stops

          setPassportCheckTimeout(timeout);
        }
      }
    }

    // Clear validation errors when switching ID type
    if (field === "idType") {
      setIdValidationErrors([]);
      updatedInfo.idNumber = '';
      updatedInfo.dateOfBirth = null;
      updatedInfo.gender = '';
    }

    setPersonalInfo(updatedInfo)
    updateData({ ...data, personalInfo: updatedInfo })
  }

  // Move checkExistingMember function outside handlePersonalInfoChange
  const checkExistingMember = async (value: string, updatedInfo: typeof personalInfo) => {
    try {
      const membersRef = collection(db, 'Members');
      const q = query(
        membersRef,
        where('idNumber', '==', value),
        where('idType', '==', updatedInfo.idType)
      );
      const memberSnapshot = await getDocs(q);

      console.log("Query complete, found members:", !memberSnapshot.empty);

      setMemberCheckComplete(true)
      setIsExistingMember(!memberSnapshot.empty)

      if (!memberSnapshot.empty) {
        const memberDoc = memberSnapshot.docs[0];
        const memberData = memberDoc.data();

        // Store the member ID for later use
        setAutoPopulatedMemberId(memberDoc.id);

        // Auto-populate fields
        const populatedInfo = {
          ...updatedInfo,
          title: memberData.title || '',
          firstName: memberData.firstName || '',
          lastName: memberData.lastName || '',
          initials: memberData.initials || '',
          dateOfBirth: memberData.dateOfBirth ? new Date(memberData.dateOfBirth.seconds * 1000) : null,
          gender: memberData.gender || '',
          nationality: memberData.nationality || '',
          idDocumentUrl: memberData.idDocumentUrl || null,
        };

        // Fetch contact details
        const contactsRef = collection(db, 'Contacts');
        const contactsQuery = query(contactsRef, where('memberId', '==', memberDoc.id));
        const contactsSnapshot = await getDocs(contactsQuery);
        const newContactDetails = contactsSnapshot.docs.map(doc => ({
          type: doc.data().type as "Email" | "Phone Number",
          value: doc.data().value
        }));

        // Fetch address details
        const addressRef = collection(db, 'Address');
        const addressQuery = query(addressRef, where('memberId', '==', memberDoc.id));
        const addressSnapshot = await getDocs(addressQuery);
        let newAddressDetails = {
          streetAddress: '',
          city: '',
          stateProvince: '',
          postalCode: '',
          country: ''
        };
        
        if (!addressSnapshot.empty) {
          const addressData = addressSnapshot.docs[0].data();
          newAddressDetails = {
            streetAddress: addressData.streetAddress || '',
            city: addressData.city || '',
            stateProvince: addressData.stateProvince || '',
            postalCode: addressData.postalCode || '',
            country: addressData.country || ''
          };
        }

        // Update all form sections
        setPersonalInfo(populatedInfo);
        setContactDetails(newContactDetails);
        setAddressDetails(newAddressDetails);

        // Update parent component
        updateData({
          personalInfo: populatedInfo,
          contactDetails: newContactDetails,
          addressDetails: newAddressDetails
        });

        toast({
          title: "Existing Member Found",
          description: `Member details for ${memberData.firstName} ${memberData.lastName} have been auto-populated.`,
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error checking member:', error);
      setIdValidationErrors(prev => [...prev, 'Error checking member details. Please try again.']);
    }
  };

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

  // Update getMissingFieldsSummary to use validationErrors prop directly
  const getMissingFieldsSummary = () => {
    if (!validationErrors || typeof validationErrors !== 'object') return null;
    
    const personalInfoMissing = Object.keys(validationErrors).some(key => 
      ['title', 'firstName', 'lastName', 'initials', 'dateOfBirth', 'gender', 
       'relationshipToMainMember', 'nationality', 'idType', 'idNumber', 'beneficiaryPercentage'].includes(key)
    );
    
    const contactDetailsMissing = Object.keys(validationErrors).some(key => 
      key === 'contacts' || key.startsWith('contact')
    );
    
    const addressDetailsMissing = Object.keys(validationErrors).some(key => 
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
      {validationErrors && Object.keys(validationErrors).length > 0 && getMissingFieldsSummary()}
      <Tabs 
        defaultValue="personal-info" 
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as TabId);
          onTabChange?.(value as TabId);
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personal-info">Personal Info</TabsTrigger>
          <TabsTrigger value="contact-details">Contact Details</TabsTrigger>
          <TabsTrigger value="address-details">Address Details</TabsTrigger>
        </TabsList>
        <TabsContent value="personal-info">
          <Card className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type-of-id">Type of ID</Label>
                  <Select
                    value={personalInfo.idType}
                    onValueChange={(value) => handlePersonalInfoChange("idType", value)}
                    disabled={isEditing}
                  >
                    <SelectTrigger id="type-of-id" className={validationErrors?.idType ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select ID type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="South African ID">South African ID</SelectItem>
                      <SelectItem value="Passport">Passport</SelectItem>
                    </SelectContent>
                  </Select>
                  {validationErrors?.idType && (
                  <p className="text-sm text-red-500">{validationErrors.idType}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="id-number">
                  ID Number / Passport Number
                    {personalInfo.idType === "South African ID" && (
                      <span className="text-sm text-gray-500 ml-2">(13 digits)</span>
                    )}
                  </Label>
                  <Input
                    id="id-number"
                    placeholder={personalInfo.idType === "South African ID" ? "Enter 13 digit ID number" : "Enter passport number"}
                    value={personalInfo.idNumber}
                    onChange={(e) => handlePersonalInfoChange("idNumber", e.target.value)}
                    className={`border-2 ${
                      validationErrors?.idNumber || idValidationErrors.length > 0 
                        ? "border-red-500" 
                        : memberCheckComplete
                          ? isExistingMember
                            ? "border-yellow-500"
                            : "border-green-500"
                          : ""
                    }`}
                    maxLength={personalInfo.idType === "South African ID" ? 13 : 20}
                    disabled={isEditing}
                  />
                  {validationErrors?.idNumber && (
                  <p className="text-sm text-red-500">{validationErrors.idNumber}</p>
                  )}
                  {idValidationErrors.length > 0 && (
                  <div className="text-sm text-red-500">
                    {idValidationErrors.map((error, index) => (
                      <p key={index}>{error}</p>
                    ))}
                  </div>
                  )}
                </div>
              </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Select value={personalInfo.title} onValueChange={(value) => handlePersonalInfoChange("title", value)}>
                      <SelectTrigger id="title" className={validationErrors?.title ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select title" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mr">Mr</SelectItem>
                    <SelectItem value="Mrs">Mrs</SelectItem>
                    <SelectItem value="Ms">Ms</SelectItem>
                    <SelectItem value="Dr">Dr</SelectItem>
                  </SelectContent>
                </Select>
                    {validationErrors?.title && (
                  <p className="text-sm text-red-500">Title is required</p>
                )}
              </div>

              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={personalInfo.firstName}
                  onChange={(e) => handlePersonalInfoChange("firstName", e.target.value)}
                    className={validationErrors?.firstName ? "border-red-500" : ""}
                />
                  {validationErrors?.firstName && (
                  <p className="text-sm text-red-500">First name is required</p>
                )}
              </div>

              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={personalInfo.lastName}
                  onChange={(e) => handlePersonalInfoChange("lastName", e.target.value)}
                    className={validationErrors?.lastName ? "border-red-500" : ""}
                />
                  {validationErrors?.lastName && (
                  <p className="text-sm text-red-500">Last name is required</p>
                )}
              </div>

              <div>
                <Label htmlFor="initials">Initials</Label>
                <Input
                  id="initials"
                  value={personalInfo.initials}
                  onChange={(e) => handlePersonalInfoChange("initials", e.target.value)}
                    className={validationErrors?.initials ? "border-red-500" : ""}
                />
                  {validationErrors?.initials && (
                  <p className="text-sm text-red-500">Initials are required</p>
                )}
              </div>

              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <DatePicker
                  date={personalInfo.dateOfBirth}
                  onChange={(date) => handlePersonalInfoChange("dateOfBirth", date)}
                />
                  {validationErrors?.dateOfBirth && (
                  <p className="text-sm text-red-500">Date of birth is required</p>
                )}
              </div>

              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select value={personalInfo.gender} onValueChange={(value) => handlePersonalInfoChange("gender", value)}>
                    <SelectTrigger id="gender" className={validationErrors?.gender ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                  {validationErrors?.gender && (
                  <p className="text-sm text-red-500">Gender is required</p>
                )}
              </div>

              <div>
                <Label htmlFor="relationshipToMainMember">Relationship</Label>
                <Select 
                  value={personalInfo.relationshipToMainMember} 
                  onValueChange={(value) => handlePersonalInfoChange("relationshipToMainMember", value)}
                >
                  <SelectTrigger id="relationship" className={validationErrors?.relationshipToMainMember ? "border-red-500" : ""}>
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
                {validationErrors?.relationshipToMainMember && (
                  <p className="text-sm text-red-500">Relationship is required</p>
                )}
              </div>

              <div>
                <Label htmlFor="nationality">Nationality</Label>
                <Select value={personalInfo.nationality} onValueChange={(value) => handlePersonalInfoChange("nationality", value)}>
                    <SelectTrigger id="nationality" className={validationErrors?.nationality ? "border-red-500" : ""}>
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
                  {validationErrors?.nationality && (
                  <p className="text-sm text-red-500">Nationality is required</p>
                )}
                </div>

              <div>
                <Label htmlFor="beneficiary-percentage">Benefit %</Label>
                <Input
                  id="benefit-%"
                  type="number"
                  min="0"
                  max="100"
                  value={personalInfo.beneficiaryPercentage || ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : e.target.value;
                    handlePersonalInfoChange("beneficiaryPercentage", value);
                  }}
                  className={validationErrors?.beneficiaryPercentage ? "border-red-500" : ""}
                />
                {validationErrors?.beneficiaryPercentage && (
                  <p className="text-sm text-red-500">Benefit percentage is required</p>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="contact-details">
          <Card className="p-4">
            <div className="space-y-2">
              {validationErrors?.contacts && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationErrors.contacts}</AlertDescription>
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
                        <SelectTrigger className={validationErrors?.[`contact${index}Type`] ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select contact type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Email">Email</SelectItem>
                          <SelectItem value="Phone Number">Phone Number</SelectItem>
                        </SelectContent>
                      </Select>
                      {validationErrors?.[`contact${index}Type`] && (
                        <p className="text-sm text-red-500">Contact type is required</p>
                      )}
                    </div>
                    <div className="flex-[2]">
                      <Input
                        value={contact.value}
                        onChange={(e) => handleContactDetailsChange(index, "value", e.target.value)}
                        className={validationErrors?.[`contact${index}Value`] ? "border-red-500" : ""}
                        placeholder={contact.type === "Email" ? "Enter email address" : "Enter phone number"}
                      />
                      {validationErrors?.[`contact${index}Value`] && (
                        <p className="text-sm text-red-500">
                          {contact.type === "Email" ? "Valid email is required" : "Valid phone number is required"}
                        </p>
                      )}
                    </div>
                    <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveContact(index)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" onClick={handleAddContact} size="sm" className="mt-2">
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
                  className={validationErrors?.streetAddress ? "border-red-500" : ""}
                />
                {validationErrors?.streetAddress && (
                  <p className="text-sm text-red-500">Street address is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={addressDetails.city}
                  onChange={(e) => handleAddressDetailsChange("city", e.target.value)}
                  className={validationErrors?.city ? "border-red-500" : ""}
                />
                {validationErrors?.city && (
                  <p className="text-sm text-red-500">City is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="stateProvince">State/Province</Label>
                <Input
                  id="stateProvince"
                  value={addressDetails.stateProvince}
                  onChange={(e) => handleAddressDetailsChange("stateProvince", e.target.value)}
                  className={validationErrors?.stateProvince ? "border-red-500" : ""}
                />
                {validationErrors?.stateProvince && (
                  <p className="text-sm text-red-500">State/Province is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  value={addressDetails.postalCode}
                  onChange={(e) => handleAddressDetailsChange("postalCode", e.target.value)}
                  className={validationErrors?.postalCode ? "border-red-500" : ""}
                />
                {validationErrors?.postalCode && (
                  <p className="text-sm text-red-500">Postal code is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Select
                  value={addressDetails.country}
                  onValueChange={(value) => handleAddressDetailsChange("country", value)}
                >
                  <SelectTrigger id="country" className={validationErrors?.country ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="South Africa">South Africa</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {validationErrors?.country && (
                  <p className="text-sm text-red-500">Country is required</p>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 