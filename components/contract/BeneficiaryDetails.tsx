"use client"

import { useState, ReactNode, useEffect } from "react"
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
import { createMemberRelationship } from "@/lib/member-relationship-service"
import { validateSouthAfricanID } from "@/src/utils/idValidation"
import { toast } from "@/components/ui/use-toast"

import { BeneficiaryForm } from "./BeneficiaryForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { addDoc, collection, deleteDoc, getDocs, query, where, updateDoc, doc, onSnapshot, getDoc } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"

type ValidationErrors = { [key: string]: string } | null;
type MessageError = ReactNode | null;
type TabId = "personal-info" | "contact-details" | "address-details";
type ErrorsByTab = Record<TabId, string[]>;

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
    // 1. Save personal info to Members collection
    const memberRef = await addDoc(collection(db, 'Members'), {
      ...data.personalInfo,
      id: data.personalInfo.idNumber,
      type: 'Beneficiary',
      totalPercentage: data.personalInfo.beneficiaryPercentage,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // 2. Save contact details with the member reference
    const contactPromises = data.contactDetails.map(contact =>
      addDoc(collection(db, 'Contacts'), {
        ...contact,
        memberId: memberRef.id,
        memberIdNumber: data.personalInfo.idNumber,
        type: 'Beneficiary',
        createdAt: new Date(),
        updatedAt: new Date()
      })
    )

    // 3. Save address details with the member reference
    await addDoc(collection(db, 'Address'), {
      ...data.addressDetails,
      memberId: memberRef.id,
      memberIdNumber: data.personalInfo.idNumber,
      type: 'Beneficiary',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // 4. Create member relationship
    const relationshipRef = await addDoc(collection(db, 'member_contract_relationships'), {
      member_id: memberRef.id,
      contract_number: contractNumber,
      role: 'Beneficiary',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // 5. Save relationship details in Relationship collection
    await addDoc(collection(db, 'Relationship'), {
      member_contract_relationship_id: relationshipRef.id,
      relationshipType: data.personalInfo.relationshipToMainMember,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // 6. Save benefit details in Benefit collection
    await addDoc(collection(db, 'Benefit'), {
      member_contract_relationship_id: relationshipRef.id,
      percentage: data.personalInfo.beneficiaryPercentage,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Wait for all contact details to be saved
    await Promise.all(contactPromises)

    // Return the Firestore document ID
    return memberRef.id
  } catch (error) {
    console.error('Error saving beneficiary:', error)
    throw error
  }
}

const removeBeneficiaryFromFirestore = async (beneficiaryId: string, contractNumber: string): Promise<void> => {
  try {
    // 1. Get the member_contract_relationship record
    const relationshipsRef = collection(db, 'member_contract_relationships');
    const relationshipQuery = query(
      relationshipsRef,
      where('member_id', '==', beneficiaryId),
      where('contract_number', '==', contractNumber),
      where('role', '==', 'Beneficiary')
    );
    const relationshipSnapshot = await getDocs(relationshipQuery);
    
    if (!relationshipSnapshot.empty) {
      const memberContractRelationshipId = relationshipSnapshot.docs[0].id;

      // 2. Delete the Relationship record
      const relationshipTypeQuery = query(
          collection(db, 'Relationship'),
        where('member_contract_relationship_id', '==', memberContractRelationshipId)
      );
      const relationshipTypeSnapshot = await getDocs(relationshipTypeQuery);
      if (!relationshipTypeSnapshot.empty) {
        await deleteDoc(relationshipTypeSnapshot.docs[0].ref);
      }

      // 3. Delete the Benefit record
        const benefitQuery = query(
          collection(db, 'Benefit'),
        where('member_contract_relationship_id', '==', memberContractRelationshipId)
      );
      const benefitSnapshot = await getDocs(benefitQuery);
      if (!benefitSnapshot.empty) {
        await deleteDoc(benefitSnapshot.docs[0].ref);
      }

      // 4. Finally delete the member_contract_relationship record
      await deleteDoc(relationshipSnapshot.docs[0].ref);
    } else {
      throw new Error('Cannot find the beneficiary relationship record to delete');
    }
  } catch (error) {
    console.error('Error removing beneficiary:', error);
    throw new Error('Failed to remove beneficiary relationship records');
  }
};

const validateBeneficiaryData = (data: BeneficiaryData, existingBeneficiaries: BeneficiaryData[]): string[] => {
  const errors: string[] = [];

  // Personal Info Validation
  if (!data.personalInfo.title) errors.push("title is required");
  if (!data.personalInfo.firstName) errors.push("first name is required");
  if (!data.personalInfo.lastName) errors.push("last name is required");
  if (!data.personalInfo.initials) errors.push("initials are required");
  if (!data.personalInfo.dateOfBirth) errors.push("date of birth is required");
  if (!data.personalInfo.gender) errors.push("gender is required");
  if (!data.personalInfo.relationshipToMainMember) errors.push("relationship is required");
  if (!data.personalInfo.nationality) errors.push("nationality is required");
  if (!data.personalInfo.idType) errors.push("ID type is required");
  if (!data.personalInfo.idNumber) errors.push("ID number is required");
  if (!data.personalInfo.beneficiaryPercentage) errors.push("benefit percentage is required");

  // Contact Details Validation
  if (!data.contactDetails || data.contactDetails.length === 0) {
    errors.push("At least one contact method is required");
  } else {
    data.contactDetails.forEach((contact, index) => {
      if (!contact.type) errors.push(`contact #${index + 1} type is required`);
      if (!contact.value) errors.push(`contact #${index + 1} value is required`);
      
      if (contact.type === "Email" && contact.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contact.value)) {
          errors.push(`contact #${index + 1} email is invalid`);
        }
      }
      
      if (contact.type === "Phone Number" && contact.value) {
        const phoneRegex = /^[0-9+\-\s()]{10,}$/;
        if (!phoneRegex.test(contact.value)) {
          errors.push(`contact #${index + 1} phone number is invalid`);
        }
      }
    });
  }

  // Address Details Validation
  if (!data.addressDetails.streetAddress) errors.push("street address is required");
  if (!data.addressDetails.city) errors.push("city is required");
  if (!data.addressDetails.stateProvince) errors.push("state/province is required");
  if (!data.addressDetails.postalCode) errors.push("postal code is required");
  if (!data.addressDetails.country) errors.push("country is required");

  return errors;
};

const validateTabData = (data: BeneficiaryData, tab: TabId): boolean => {
  switch (tab) {
    case "personal-info":
      return !!(
        data.personalInfo.title?.trim() &&
        data.personalInfo.firstName?.trim() &&
        data.personalInfo.lastName?.trim() &&
        data.personalInfo.initials?.trim() &&
        data.personalInfo.dateOfBirth &&
        data.personalInfo.gender?.trim() &&
        data.personalInfo.relationshipToMainMember?.trim() &&
        data.personalInfo.nationality?.trim() &&
        data.personalInfo.idType?.trim() &&
        data.personalInfo.idNumber?.trim() &&
        data.personalInfo.beneficiaryPercentage >= 0 &&
        data.personalInfo.beneficiaryPercentage <= 100
      );
    case "contact-details":
      return data.contactDetails.length > 0 && data.contactDetails.every(contact => 
        contact.type?.trim() && 
        contact.value?.trim() && 
        (contact.type !== "Email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.value.trim())) &&
        (contact.type !== "Phone Number" || /^[0-9+\-\s()]*$/.test(contact.value.trim()))
      );
    case "address-details":
      return !!(
        data.addressDetails.streetAddress?.trim() &&
        data.addressDetails.city?.trim() &&
        data.addressDetails.stateProvince?.trim() &&
        data.addressDetails.postalCode?.trim() &&
        data.addressDetails.country?.trim()
      );
    default:
      return false;
  }
};

const checkDuplicateBeneficiary = async (idNumber: string): Promise<boolean> => {
  try {
    // Check in Members collection instead of Beneficiaries
    const membersQuery = query(
      collection(db, 'Members'),
      where('idNumber', '==', idNumber),
      where('type', '==', 'Beneficiary')
    );
    const snapshot = await getDocs(membersQuery);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking for duplicate beneficiary:', error);
    return false;
  }
};

const calculateTotalAllocation = (currentBeneficiaries: BeneficiaryData[]): number => {
  return Math.round(currentBeneficiaries.reduce((sum, ben) => 
    sum + Number(ben.personalInfo.beneficiaryPercentage), 0
  ));
};

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
  const [activeTab, setActiveTab] = useState("personal-info")
  const [duplicateCheck, setDuplicateCheck] = useState<{
    checking: boolean;
    isDuplicate: boolean;
    message: string | null;
  }>({
    checking: false,
    isDuplicate: false,
    message: null
  });

  useEffect(() => {
    if (!contractNumber) return;

    // Query for member-contract relationships
    const relationshipsRef = collection(db, 'member_contract_relationships');
    const relationshipsQuery = query(
      relationshipsRef,
      where('contract_number', '==', contractNumber),
      where('role', '==', 'Beneficiary')
    );

    // Set up the real-time listener
    const unsubscribe = onSnapshot(relationshipsQuery, async (relationshipSnapshot) => {
      try {
        const beneficiaryPromises = relationshipSnapshot.docs.map(async (relationshipDoc) => {
          const memberId = relationshipDoc.data().member_id;
          const relationshipId = relationshipDoc.id;

          // Get member details
          const memberDoc = await getDoc(doc(db, 'Members', memberId));
          if (!memberDoc.exists()) return null;
          const memberData = memberDoc.data();

          // Get contact details
          const contactsQuery = query(
            collection(db, 'Contacts'),
            where('memberId', '==', memberId)
          );
          const contactsSnapshot = await getDocs(contactsQuery);
          const contactDetails = contactsSnapshot.docs.map(doc => ({
            type: doc.data().type as "Email" | "Phone Number",
            value: doc.data().value
          }));

          // Get address details
          const addressQuery = query(
            collection(db, 'Address'),
            where('memberId', '==', memberId)
          );
          const addressSnapshot = await getDocs(addressQuery);
          const addressData = addressSnapshot.docs[0]?.data() || {
            streetAddress: '',
            city: '',
            stateProvince: '',
            postalCode: '',
            country: ''
          };

          // Get benefit percentage from Benefit collection
          const benefitQuery = query(
            collection(db, 'Benefit'),
            where('member_contract_relationship_id', '==', relationshipId)
          );
          const benefitSnapshot = await getDocs(benefitQuery);
          const benefitPercentage = benefitSnapshot.docs[0]?.data()?.percentage || 0;

          // Get relationship type from Relationship collection
          const relationshipTypeQuery = query(
            collection(db, 'Relationship'),
            where('member_contract_relationship_id', '==', relationshipId)
          );
          const relationshipTypeSnapshot = await getDocs(relationshipTypeQuery);
          const relationshipType = relationshipTypeSnapshot.docs[0]?.data()?.relationshipType || '';

          // Construct beneficiary object
          const beneficiary: BeneficiaryData = {
            id: memberId,
            personalInfo: {
              title: memberData.title || '',
              firstName: memberData.firstName || '',
              lastName: memberData.lastName || '',
              initials: memberData.initials || '',
              dateOfBirth: memberData.dateOfBirth ? new Date(memberData.dateOfBirth.seconds * 1000) : null,
              gender: memberData.gender || '',
              relationshipToMainMember: relationshipType,
              nationality: memberData.nationality || '',
              idType: memberData.idType || 'South African ID',
              idNumber: memberData.idNumber || '',
              beneficiaryPercentage: benefitPercentage,
              idDocumentUrl: memberData.idDocumentUrl || null,
            },
            contactDetails,
            addressDetails: {
              streetAddress: addressData.streetAddress || '',
              city: addressData.city || '',
              stateProvince: addressData.stateProvince || '',
              postalCode: addressData.postalCode || '',
              country: addressData.country || ''
            }
          };

          return beneficiary;
        });

        const beneficiariesData = (await Promise.all(beneficiaryPromises)).filter((b): b is BeneficiaryData => b !== null);
        updateBeneficiaries(beneficiariesData);
      } catch (error) {
        console.error('Error fetching beneficiaries:', error);
        setMessageError('Failed to fetch beneficiaries. Please refresh the page.');
      }
    }, (error) => {
      console.error('Error in beneficiaries listener:', error);
      setMessageError('Error listening to beneficiary changes. Please refresh the page.');
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [contractNumber, updateBeneficiaries]);

  const handleAddBeneficiary = async () => {
    try {
      if (!contractNumber || !mainMemberIdNumber) {
        setMessageError(
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Contract information is missing. Please add main member details first.</AlertDescription>
          </Alert>
        )
        return
      }

      setIsSaving(true)
      setMessageError(null)
      setValidationErrors(null)  // Clear previous validation errors

      // Calculate total allocation including the new beneficiary
      const totalAllocation = calculateTotalAllocation([...beneficiaries, formData]);
      if (totalAllocation > 100) {
        setMessageError(
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Invalid Allocation</AlertTitle>
            <AlertDescription>
              Total allocation exceeds 100%. Please adjust the beneficiary percentages.
            </AlertDescription>
          </Alert>
        );
        setIsSaving(false);
        return;
      }

      // Validate all required fields and data
      const errors = validateBeneficiaryData(formData, beneficiaries)
      
      if (errors.length > 0) {
        const fieldErrors: { [key: string]: string } = {};
        
        errors.forEach(error => {
          if (error.includes("title")) fieldErrors.title = "Title is required";
          if (error.includes("first name")) fieldErrors.firstName = "First name is required";
          if (error.includes("last name")) fieldErrors.lastName = "Last name is required";
          if (error.includes("initials")) fieldErrors.initials = "Initials are required";
          if (error.includes("date of birth")) fieldErrors.dateOfBirth = "Date of birth is required";
          if (error.includes("gender")) fieldErrors.gender = "Gender is required";
          if (error.includes("relationship")) fieldErrors.relationshipToMainMember = "Relationship is required";
          if (error.includes("nationality")) fieldErrors.nationality = "Nationality is required";
          if (error.includes("ID type")) fieldErrors.idType = "ID type is required";
          if (error.includes("ID number")) fieldErrors.idNumber = "ID number is required";
          if (error.includes("benefit percentage")) fieldErrors.beneficiaryPercentage = "Benefit percentage is required";

          // Contact Details
          if (error.includes("contact")) {
            if (error.includes("At least one contact method")) {
              fieldErrors.contacts = "At least one contact method is required";
        } else {
              const contactIndex = error.match(/contact #(\d+)/)?.[1];
              if (contactIndex) {
                const index = parseInt(contactIndex) - 1;
                if (error.includes("type")) fieldErrors[`contact${index}Type`] = "Contact type is required";
                if (error.includes("value")) fieldErrors[`contact${index}Value`] = "Contact value is required";
                if (error.includes("email is invalid")) fieldErrors[`contact${index}Value`] = "Valid email is required";
                if (error.includes("phone number is invalid")) fieldErrors[`contact${index}Value`] = "Valid phone number is required";
              }
            }
          }

          // Address Details
          if (error.includes("street address")) fieldErrors.streetAddress = "Street address is required";
          if (error.includes("city")) fieldErrors.city = "City is required";
          if (error.includes("state/province")) fieldErrors.stateProvince = "State/Province is required";
          if (error.includes("postal code")) fieldErrors.postalCode = "Postal code is required";
          if (error.includes("country")) fieldErrors.country = "Country is required";
        });

        setValidationErrors(fieldErrors);
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

      // First check if member exists using ID Type and ID Number
      const membersRef = collection(db, 'Members');
      const memberQuery = query(
        membersRef,
        where('idNumber', '==', formData.personalInfo.idNumber),
        where('idType', '==', formData.personalInfo.idType)
      );
      const memberSnapshot = await getDocs(memberQuery);

      let memberId: string;

      if (!memberSnapshot.empty) {
        // Member exists - check for existing relationship
        memberId = memberSnapshot.docs[0].id;

        // Check if relationship already exists
        const relationshipsRef = collection(db, 'member_contract_relationships');
        const relationshipQuery = query(
          relationshipsRef,
          where('member_id', '==', memberId),
          where('contract_number', '==', contractNumber),
          where('role', '==', 'Beneficiary')
        );
        const relationshipSnapshot = await getDocs(relationshipQuery);

        if (!relationshipSnapshot.empty) {
          setMessageError(
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Relationship Already Exists</AlertTitle>
              <AlertDescription>
                This person is already a beneficiary on this contract.
              </AlertDescription>
            </Alert>
          );
          setIsSaving(false);
          return;
        }

        // Create only the relationship
        await createMemberRelationship({
          memberId,
          contractNumber,
          role: 'Beneficiary',
          relationshipType: formData.personalInfo.relationshipToMainMember,
          benefitPercentage: formData.personalInfo.beneficiaryPercentage
        });
      } else {
        // This is a new member - save all details
        memberId = await saveBeneficiaryToFirestore(formData, contractNumber, mainMemberIdNumber);
      }
      
      // Update local state with the new beneficiary
      const newBeneficiary = {
        ...formData,
        id: memberId
      }
      updateBeneficiaries([...beneficiaries, newBeneficiary])
      
      // Reset form and close dialog
      setIsDialogOpen(false)
      setFormData(emptyBeneficiary)
      setValidationErrors(null)
      setMessageError(null)
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
        setMessageError(
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Contract information is missing</AlertDescription>
          </Alert>
        );
        return;
      }

      setIsSaving(true);
      setValidationErrors(null);
      setMessageError(null);

      if (editingIndex !== null && editingBeneficiary?.id) {
        // Calculate total allocation excluding the current beneficiary and including the updated one
        const otherBeneficiaries = beneficiaries.filter((_, index) => index !== editingIndex);
        const totalAllocation = calculateTotalAllocation([...otherBeneficiaries, formData]);
        
        if (totalAllocation > 100) {
          setMessageError(
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Invalid Allocation</AlertTitle>
              <AlertDescription>
                Total allocation exceeds 100%. Please adjust the beneficiary percentages.
              </AlertDescription>
            </Alert>
          );
          setIsSaving(false);
          return;
        }

        // Validate all required fields and data
        const errors = validateBeneficiaryData(formData, beneficiaries);
        if (errors.length > 0) {
          const fieldErrors: { [key: string]: string } = {};
          errors.forEach(error => {
            if (error.includes("title")) fieldErrors.title = "Title is required";
            if (error.includes("first name")) fieldErrors.firstName = "First name is required";
            if (error.includes("last name")) fieldErrors.lastName = "Last name is required";
            if (error.includes("initials")) fieldErrors.initials = "Initials are required";
            if (error.includes("date of birth")) fieldErrors.dateOfBirth = "Date of birth is required";
            if (error.includes("gender")) fieldErrors.gender = "Gender is required";
            if (error.includes("relationship")) fieldErrors.relationshipToMainMember = "Relationship is required";
            if (error.includes("nationality")) fieldErrors.nationality = "Nationality is required";
            if (error.includes("ID type")) fieldErrors.idType = "ID type is required";
            if (error.includes("ID number")) fieldErrors.idNumber = "ID number is required";
            if (error.includes("benefit percentage")) fieldErrors.beneficiaryPercentage = "Benefit percentage is required";

            // Contact Details
            if (error.includes("contact")) {
              if (error.includes("At least one contact method")) {
                fieldErrors.contacts = "At least one contact method is required";
              } else {
                const contactIndex = error.match(/contact #(\d+)/)?.[1];
                if (contactIndex) {
                  const index = parseInt(contactIndex) - 1;
                  if (error.includes("type")) fieldErrors[`contact${index}Type`] = "Contact type is required";
                  if (error.includes("value")) fieldErrors[`contact${index}Value`] = "Contact value is required";
                  if (error.includes("email is invalid")) fieldErrors[`contact${index}Value`] = "Valid email is required";
                  if (error.includes("phone number is invalid")) fieldErrors[`contact${index}Value`] = "Valid phone number is required";
                }
              }
            }

            // Address Details
            if (error.includes("street address")) fieldErrors.streetAddress = "Street address is required";
            if (error.includes("city")) fieldErrors.city = "City is required";
            if (error.includes("state/province")) fieldErrors.stateProvince = "State/Province is required";
            if (error.includes("postal code")) fieldErrors.postalCode = "Postal code is required";
            if (error.includes("country")) fieldErrors.country = "Country is required";
          });

          setValidationErrors(fieldErrors);
          setIsSaving(false);
          return;
        }

        try {
          // Update member details in Firestore
          const memberRef = doc(db, 'Members', editingBeneficiary.id);
          await updateDoc(memberRef, {
            title: formData.personalInfo.title,
            firstName: formData.personalInfo.firstName,
            lastName: formData.personalInfo.lastName,
            initials: formData.personalInfo.initials,
            dateOfBirth: formData.personalInfo.dateOfBirth,
            gender: formData.personalInfo.gender,
            nationality: formData.personalInfo.nationality,
            idType: formData.personalInfo.idType,
            idNumber: formData.personalInfo.idNumber,
            idDocumentUrl: formData.personalInfo.idDocumentUrl,
              updatedAt: new Date()
            });

          // Get member_contract_relationships document
          const relationshipsRef = collection(db, 'member_contract_relationships');
          const relationshipQuery = query(
            relationshipsRef,
            where('member_id', '==', editingBeneficiary.id),
            where('contract_number', '==', contractNumber),
            where('role', '==', 'Beneficiary')
          );
          const relationshipSnapshot = await getDocs(relationshipQuery);

          if (!relationshipSnapshot.empty) {
            const relationshipDoc = relationshipSnapshot.docs[0];
            const relationshipId = relationshipDoc.id;

            // Update relationship in Relationship collection
            const relationshipCollectionQuery = query(
              collection(db, 'Relationship'),
            where('member_contract_relationship_id', '==', relationshipId)
          );
            const relationshipCollectionSnapshot = await getDocs(relationshipCollectionQuery);

            if (!relationshipCollectionSnapshot.empty) {
              const relationshipCollectionDoc = relationshipCollectionSnapshot.docs[0];
              await updateDoc(relationshipCollectionDoc.ref, {
              relationshipType: formData.personalInfo.relationshipToMainMember,
              updatedAt: new Date()
            });
          }

            // Update benefit in Benefit collection
          const benefitQuery = query(
              collection(db, 'Benefit'),
            where('member_contract_relationship_id', '==', relationshipId)
          );
          const benefitSnapshot = await getDocs(benefitQuery);

            if (!benefitSnapshot.empty) {
              const benefitDoc = benefitSnapshot.docs[0];
              await updateDoc(benefitDoc.ref, {
              percentage: formData.personalInfo.beneficiaryPercentage,
              updatedAt: new Date()
              });
            }
          }

          // Update contacts
          const contactsRef = collection(db, 'Contacts');
          const contactsQuery = query(contactsRef, where('memberId', '==', editingBeneficiary.id));
          const contactsSnapshot = await getDocs(contactsQuery);

          // Delete existing contacts
          for (const doc of contactsSnapshot.docs) {
            await deleteDoc(doc.ref);
          }

          // Add new contacts
          for (const contact of formData.contactDetails) {
            await addDoc(contactsRef, {
              memberId: editingBeneficiary.id,
              type: contact.type,
              value: contact.value,
              createdAt: new Date()
            });
          }

          // Update address
          const addressRef = collection(db, 'Address');
          const addressQuery = query(addressRef, where('memberId', '==', editingBeneficiary.id));
          const addressSnapshot = await getDocs(addressQuery);

          if (addressSnapshot.empty) {
            // Create new address
            await addDoc(addressRef, {
              memberId: editingBeneficiary.id,
              ...formData.addressDetails,
              createdAt: new Date()
            });
          } else {
            // Update existing address
            await updateDoc(addressSnapshot.docs[0].ref, {
              ...formData.addressDetails,
              updatedAt: new Date()
            });
          }
        
        // Update local state
          const updatedBeneficiaries = [...beneficiaries];
        updatedBeneficiaries[editingIndex] = {
          ...formData,
            id: editingBeneficiary.id
          };
          updateBeneficiaries(updatedBeneficiaries);
        
        // Reset form and close dialog
          setIsDialogOpen(false);
          setEditingBeneficiary(null);
          setEditingIndex(null);
          setFormData(emptyBeneficiary);
          setValidationErrors(null);
          setMessageError(null);

          toast({
            title: "Success",
            description: "Beneficiary details updated successfully",
            variant: "default",
          });
        } catch (error) {
          console.error('Error updating beneficiary:', error);
          setMessageError(
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>Failed to update beneficiary. Please try again.</AlertDescription>
            </Alert>
          );
        }
      }
    } catch (error) {
      console.error('Error updating beneficiary:', error);
      setMessageError(
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to update beneficiary. Please try again.</AlertDescription>
        </Alert>
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsDialogOpen(false)
    setEditingBeneficiary(null)
    setEditingIndex(null)
    setFormData(emptyBeneficiary)
  }

  const handleRemoveBeneficiary = async (index: number) => {
    try {
      const beneficiary = beneficiaries[index];
      if (!beneficiary || !beneficiary.id || !contractNumber) {
        throw new Error('Invalid beneficiary data or contract number');
      }

      setDeletingIndex(index);
      setIsDeleteDialogOpen(true);
    } catch (error) {
      console.error('Error preparing beneficiary removal:', error);
      toast({
        title: "Error",
        description: "Failed to prepare beneficiary removal. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmDelete = async () => {
    try {
      if (deletingIndex === null) return;

      const beneficiary = beneficiaries[deletingIndex];
      if (!beneficiary || !beneficiary.id || !contractNumber) {
        throw new Error('Invalid beneficiary data or contract number');
      }

      setIsSaving(true);

      await removeBeneficiaryFromFirestore(beneficiary.id, contractNumber);

      // Update local state
      const updatedBeneficiaries = beneficiaries.filter((_, i) => i !== deletingIndex);
      updateBeneficiaries(updatedBeneficiaries);

      setIsDeleteDialogOpen(false);
      setDeletingIndex(null);
      
      toast({
        title: "Success",
        description: "Beneficiary removed successfully",
      });
      } catch (error) {
      console.error('Error removing beneficiary:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove beneficiary",
        variant: "destructive",
      });
      } finally {
      setIsSaving(false);
      }
  };

  const checkAndPopulateBeneficiary = async (idValue: string, idType: "South African ID" | "Passport") => {
    console.log("Starting beneficiary check for:", idValue, idType);
    try {
      const membersRef = collection(db, 'Members');
      const q = query(
        membersRef,
        where('idNumber', '==', idValue),
        where('idType', '==', idType)
      );
      const memberSnapshot = await getDocs(q);
      
      if (!memberSnapshot.empty) {
        const memberDoc = memberSnapshot.docs[0];
        const memberData = memberDoc.data();

        // Auto-populate personal info fields
        const populatedInfo = {
          ...formData.personalInfo,
          title: memberData.title || '',
          firstName: memberData.firstName || '',
          lastName: memberData.lastName || '',
          initials: memberData.initials || '',
          dateOfBirth: memberData.dateOfBirth ? new Date(memberData.dateOfBirth.seconds * 1000) : null,
          gender: memberData.gender || '',
          nationality: memberData.nationality || '',
          idDocumentUrl: memberData.idDocumentUrl || null,
          idNumber: idValue,
          idType: idType,
          beneficiaryPercentage: 0
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

        // Update form data
        const updatedData = {
          ...formData,
          id: memberDoc.id,
          personalInfo: populatedInfo,
          contactDetails: newContactDetails,
          addressDetails: newAddressDetails
        };
        
        setFormData(updatedData);

        toast({
          title: "Existing Member Found",
          description: `Member details for ${memberData.firstName} ${memberData.lastName} have been auto-populated.`,
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error checking member:', error);
      setMessageError('Error checking member details. Please try again.');
    }
  };

  const handlePersonalInfoChange = (field: string, value: string | Date | null) => {
    setMessageError(null);
    const updatedInfo = { ...formData.personalInfo, [field]: value };

    if (field === "idNumber" && typeof value === "string") {
      if (mainMemberIdNumber && value === mainMemberIdNumber) {
        setMessageError('Beneficiary cannot have the same ID number as the main member');
        return;
      }

      if (updatedInfo.idType === "South African ID" && value.length === 13) {
        const validationResult = validateSouthAfricanID(value);
        if (!validationResult.isValid) {
          setMessageError(validationResult.errors[0]);
        } else {
          if (validationResult.dateOfBirth) {
            updatedInfo.dateOfBirth = validationResult.dateOfBirth;
          }
          if (validationResult.gender) {
            updatedInfo.gender = validationResult.gender;
          }
          checkAndPopulateBeneficiary(value, "South African ID");
        }
      } else if (updatedInfo.idType === "Passport" && value.length > 0) {
        checkAndPopulateBeneficiary(value, "Passport");
      }
    }

    if (field === "idType") {
      updatedInfo.idNumber = '';
      updatedInfo.dateOfBirth = null;
      updatedInfo.gender = '';
    }

    setFormData(prev => ({
      ...prev,
      personalInfo: updatedInfo
    }));
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
            
            {messageError && (
              <div className="mb-4">
                {messageError}
              </div>
            )}
            
            <BeneficiaryForm
              data={editingBeneficiary || formData}
              updateData={(data: BeneficiaryData) => {
                setFormData(data);
                // Clear validation errors for the current tab if it's valid
                if (validateTabData(data, activeTab as TabId)) {
                  setValidationErrors(prev => {
                    if (!prev) return null;
                    const newErrors = { ...prev };
                    // Remove errors related to the current tab
                    Object.keys(newErrors).forEach(key => {
                      if (
                        (activeTab === "personal-info" && key.includes("personal")) ||
                        (activeTab === "contact-details" && key.includes("contact")) ||
                        (activeTab === "address-details" && key.includes("address"))
                      ) {
                        delete newErrors[key];
                      }
                    });
                    return Object.keys(newErrors).length > 0 ? newErrors : null;
                  });
                  setMessageError(null);
                }
              }}
              error={validationErrors}
              mainMemberIdNumber={mainMemberIdNumber}
              validationErrors={validationErrors}
              onTabChange={(tab: TabId) => {
                setActiveTab(tab);
                setMessageError(null);
              }}
              isEditing={!!editingBeneficiary}
            />
            <div className="flex justify-end space-x-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  handleCancel();
                  setValidationErrors(null);
                  setMessageError(null);
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button 
                onClick={editingBeneficiary ? handleEditBeneficiary : handleAddBeneficiary}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : editingBeneficiary ? 'Update' : 'Save'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              Add or manage beneficiaries for this contract
            </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              Total Allocation: {Math.round(beneficiaries.reduce((sum, ben) => 
                sum + Number(ben.personalInfo.beneficiaryPercentage), 0
              ))}%
            </span>
            {Math.round(beneficiaries.reduce((sum, ben) => 
              sum + Number(ben.personalInfo.beneficiaryPercentage), 0
            )) === 100 ? (
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
                    {deletingIndex !== null && beneficiaries[deletingIndex] && (
                      <>
                    <p className="font-medium">
                      {beneficiaries[deletingIndex].personalInfo.title} {beneficiaries[deletingIndex].personalInfo.firstName} {beneficiaries[deletingIndex].personalInfo.lastName}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {beneficiaries[deletingIndex].personalInfo.relationshipToMainMember} • {beneficiaries[deletingIndex].personalInfo.beneficiaryPercentage}%
                    </p>
                      </>
                    )}
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
                onClick={handleConfirmDelete}
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

