"use client"

import { useState, useEffect } from "react"
import { isValid } from "date-fns"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { validateSouthAfricanID } from "@/src/utils/idValidation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { toast } from "@/components/ui/use-toast"
import { DependentData } from "@/types/dependent"

type DependentFormProps = {
  data: DependentData
  updateData: (data: DependentData, wasAutoPopulated?: boolean) => void
  error?: string | null
  mainMemberIdNumber?: string
  validationErrors?: { [key: string]: string }
  onCancel?: () => void
  isEditing?: boolean
  onSave?: (data: DependentData) => Promise<void>
  contractNumber?: string
}

export function DependentForm({ 
  data, 
  updateData, 
  error: externalError, 
  mainMemberIdNumber,
  validationErrors,
  onCancel,
  isEditing,
  onSave,
  contractNumber
}: DependentFormProps) {
  validationErrors = validationErrors || {};
  isEditing = isEditing || false;

  const [personalInfo, setPersonalInfo] = useState(data.personalInfo)
  const [contactDetails, setContactDetails] = useState(data.contactDetails)
  const [addressDetails, setAddressDetails] = useState(data.addressDetails)
  const [error, setError] = useState<string | null>(externalError || null)
  const [idValidationErrors, setIdValidationErrors] = useState<string[]>([])
  const [autoPopulatedMemberId, setAutoPopulatedMemberId] = useState<string | null>(null)
  const [passportCheckTimeout, setPassportCheckTimeout] = useState<NodeJS.Timeout | null>(null)
  const [idCheckTimeout, setIdCheckTimeout] = useState<NodeJS.Timeout | null>(null)
  const [isExistingMember, setIsExistingMember] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [memberCheckComplete, setMemberCheckComplete] = useState(false)

  useEffect(() => {
    setError(externalError || null)
  }, [externalError])

  const handlePersonalInfoChange = async (field: string, value: string | Date | null) => {
    const updatedPersonalInfo = { ...personalInfo, [field]: value }

    // Handle ID number changes
    if (field === "idNumber") {
      // Reset states
      setIdValidationErrors([])
      setMemberCheckComplete(false)
      setIsExistingMember(false)

      // Check for duplicate with main member immediately
          if (mainMemberIdNumber && value === mainMemberIdNumber) {
        setIdValidationErrors(['Dependent cannot have the same ID number as the main member'])
        return
      }

      // Format input based on ID type
      if (personalInfo.idType === "South African ID") {
        // Only allow numbers and limit to 13 digits
        const numericValue = value?.toString().replace(/\D/g, '').slice(0, 13) || ''
        updatedPersonalInfo.idNumber = numericValue

        // Update the form immediately with the formatted value
        setPersonalInfo(updatedPersonalInfo)
        updateData({
          personalInfo: updatedPersonalInfo,
          contactDetails,
          addressDetails
        })

        // Clear any existing timeout
        if (idCheckTimeout) {
          clearTimeout(idCheckTimeout)
        }

        // Set new timeout for validation
        const timeout = setTimeout(async () => {
          // Only validate if we have a complete ID number
          if (numericValue.length === 13) {
            const validationResult = validateSouthAfricanID(numericValue)
            if (!validationResult.isValid) {
              setIdValidationErrors(validationResult.errors)
              return
            }

            // Auto-complete gender and date of birth if valid
            const updatedInfo = { ...updatedPersonalInfo }
              if (validationResult.dateOfBirth) {
              validationResult.dateOfBirth.setHours(0, 0, 0, 0)
              updatedInfo.dateOfBirth = validationResult.dateOfBirth
              }
              if (validationResult.gender) {
              updatedInfo.gender = validationResult.gender
            }

            // Update form with auto-completed data
            setPersonalInfo(updatedInfo)
            updateData({
              personalInfo: updatedInfo,
              contactDetails,
              addressDetails
            })

            // Show success toast
            toast({
              title: "Auto-completed",
              description: "Date of Birth and Gender have been automatically filled based on the ID number.",
              variant: "default",
            })
              
              // Check for existing member
            try {
              const membersRef = collection(db, 'Members')
              const q = query(
                membersRef,
                where('idNumber', '==', numericValue),
                where('idType', '==', 'South African ID')
              )
              const memberSnapshot = await getDocs(q)

              if (!memberSnapshot.empty) {
                await checkAndPopulateMember(numericValue, 'South African ID')
              }
            } catch (error) {
              console.error('Error checking existing member:', error)
            }
          }
        }, 1000)

        setIdCheckTimeout(timeout)
        return
      } else {
        // Handle passport number
        const passportValue = value?.toString().slice(0, 20) || ''
        updatedPersonalInfo.idNumber = passportValue

        // Update form immediately with formatted value
        setPersonalInfo(updatedPersonalInfo)
        updateData({
          personalInfo: updatedPersonalInfo,
          contactDetails,
          addressDetails
        })

        // Clear existing timeout
        if (passportCheckTimeout) {
          clearTimeout(passportCheckTimeout)
        }

        // Set new timeout for passport check
        const timeout = setTimeout(async () => {
          if (passportValue) {
            await checkAndPopulateMember(passportValue, 'Passport')
          }
        }, 1000)

        setPassportCheckTimeout(timeout)
        return
      }
    }

    // Handle all other field changes
    setPersonalInfo(updatedPersonalInfo)
    updateData({
      personalInfo: updatedPersonalInfo,
      contactDetails,
      addressDetails
    })
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

  // Update the check for existing relationship function
  const checkExistingRelationship = async (memberId: string, contractNumber: string): Promise<boolean> => {
    try {
      const relationshipsRef = collection(db, 'member_contract_relationships');
      const q = query(
        relationshipsRef,
        where('member_id', '==', memberId),
        where('contract_number', '==', contractNumber),
        where('role', '==', 'Dependent')
      );
      
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking relationship:', error);
      return false;
    }
  };

  // Update the create relationship function
  const createMemberRelationship = async (memberId: string, contractNumber: string): Promise<void> => {
    try {
      const relationshipExists = await checkExistingRelationship(memberId, contractNumber);
      
      if (!relationshipExists) {
        const relationshipsRef = collection(db, 'member_contract_relationships');
        await addDoc(relationshipsRef, {
          member_id: memberId,
          contract_number: contractNumber,
          role: 'Dependent',
          created_at: new Date(),
          updated_at: new Date()
        });

        toast({
          title: "Success",
          description: "Member relationship created successfully",
          variant: "default",
        });
      } else {
        console.log("Relationship already exists, skipping creation");
      }
    } catch (error) {
      console.error('Error creating relationship:', error);
      throw new Error('Failed to create member relationship');
    }
  };

  // Add function to update existing member
  const updateExistingMember = async (memberId: string) => {
    try {
      const memberRef = doc(db, 'Members', memberId);
      await updateDoc(memberRef, {
        ...personalInfo,
        updatedAt: new Date()
      });

      // Update contact details
      const contactsRef = collection(db, 'Contacts');
      const existingContactsQuery = query(contactsRef, where('memberId', '==', memberId));
      const existingContacts = await getDocs(existingContactsQuery);
      
      // Delete existing contacts
      await Promise.all(existingContacts.docs.map(doc => deleteDoc(doc.ref)));
      
      // Add new contacts
      await Promise.all(contactDetails.map(contact =>
        addDoc(contactsRef, {
          ...contact,
          memberId,
          memberIdNumber: personalInfo.idNumber,
          updatedAt: new Date()
        })
      ));

      // Update address
      const addressRef = collection(db, 'Address');
      const existingAddressQuery = query(addressRef, where('memberId', '==', memberId));
      const existingAddress = await getDocs(existingAddressQuery);
      
      if (!existingAddress.empty) {
        await updateDoc(existingAddress.docs[0].ref, {
          ...addressDetails,
          updatedAt: new Date()
        });
      } else {
        await addDoc(addressRef, {
          ...addressDetails,
          memberId,
          memberIdNumber: personalInfo.idNumber,
          createdAt: new Date()
        });
      }

      toast({
        title: "Success",
        description: "Member details updated successfully",
        variant: "default",
      });
    } catch (error) {
      console.error('Error updating member:', error);
      throw new Error('Failed to update member details');
    }
  };

  // Modify checkAndPopulateMember to set isExistingMember
  const checkAndPopulateMember = async (idValue: string, idType: "South African ID" | "Passport") => {
    console.log("Starting member check for:", idValue, idType);
    try {
      const membersRef = collection(db, 'Members');
      const q = query(
        membersRef,
        where('idNumber', '==', idValue),
        where('idType', '==', idType)
      );
      const memberSnapshot = await getDocs(q);
      console.log("Query complete, found members:", !memberSnapshot.empty);

      setMemberCheckComplete(true)
      setIsExistingMember(!memberSnapshot.empty)

      if (!memberSnapshot.empty) {
        const memberDoc = memberSnapshot.docs[0];
        const memberData = memberDoc.data();
        console.log("Found member:", memberData);

        // Store the member ID and set existing member flag
        setAutoPopulatedMemberId(memberDoc.id);
        setIsExistingMember(true);

        // Auto-populate personal info fields
        const populatedInfo = {
          ...personalInfo,
          firstName: memberData.firstName || '',
          lastName: memberData.lastName || '',
          initials: memberData.initials || '',
          dateOfBirth: memberData.dateOfBirth ? new Date(memberData.dateOfBirth.seconds * 1000) : null,
          gender: memberData.gender || '',
          nationality: memberData.nationality || '',
          dependentStatus: memberData.dependentStatus || 'Active',
          medicalAidNumber: memberData.medicalAidNumber || '',
          employer: memberData.employer || '',
          school: memberData.school || '',
          idDocumentUrl: memberData.idDocumentUrl || null,
          idNumber: idValue,
          idType: idType
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

        // Update parent component with wasAutoPopulated flag
        updateData({
          personalInfo: {
            title: populatedInfo.title,
            firstName: populatedInfo.firstName,
            lastName: populatedInfo.lastName,
            initials: populatedInfo.initials,
            dateOfBirth: populatedInfo.dateOfBirth,
            gender: populatedInfo.gender,
            relationshipToMainMember: populatedInfo.relationshipToMainMember,
            nationality: populatedInfo.nationality,
            idType: populatedInfo.idType,
            idNumber: populatedInfo.idNumber,
            dependentStatus: populatedInfo.dependentStatus,
            medicalAidNumber: populatedInfo.medicalAidNumber,
            employer: populatedInfo.employer,
            school: populatedInfo.school,
            idDocumentUrl: populatedInfo.idDocumentUrl
          },
          contactDetails: newContactDetails,
          addressDetails: newAddressDetails
        }, true);

        toast({
          title: "Existing Member Found",
          description: `Member details for ${memberData.firstName} ${memberData.lastName} have been auto-populated.`,
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error checking member:', error);
      setError('Error checking member details. Please try again.');
    }
  };

  // Add new function for handling member updates
  const handleUpdateMember = async () => {
    setIsUpdating(true)
    setError(null)
    
    try {
      // Find member using ID type and number
      const membersRef = collection(db, 'Members')
      const memberQuery = query(
        membersRef,
        where('idNumber', '==', personalInfo.idNumber),
        where('idType', '==', personalInfo.idType)
      )
      const memberSnapshot = await getDocs(memberQuery)
      
      if (memberSnapshot.empty) {
        throw new Error('Member not found')
      }

      const memberId = memberSnapshot.docs[0].id
      
      // Update member details in Members collection
      const memberRef = doc(db, 'Members', memberId)
      await updateDoc(memberRef, {
        ...personalInfo,
        updatedAt: new Date()
      })

      // Get member_contract_relationships record
      const relationshipsRef = collection(db, 'member_contract_relationships')
      const relationshipQuery = query(
        relationshipsRef,
        where('member_id', '==', memberId),
        where('contract_number', '==', contractNumber),
        where('role', '==', 'Dependent')
      )
      const relationshipSnapshot = await getDocs(relationshipQuery)
      
      if (!relationshipSnapshot.empty) {
        const memberContractRelationshipId = relationshipSnapshot.docs[0].id

        // Update or create Relationship record
        const relationshipTypeQuery = query(
          collection(db, 'Relationship'),
          where('member_contract_relationship_id', '==', memberContractRelationshipId)
        )
        const relationshipTypeSnapshot = await getDocs(relationshipTypeQuery)
        
        if (!relationshipTypeSnapshot.empty) {
          // Update existing Relationship record
          await updateDoc(relationshipTypeSnapshot.docs[0].ref, {
            relationshipType: personalInfo.relationshipToMainMember,
            updatedAt: new Date()
          })
        } else {
          // Create new Relationship record if it doesn't exist
          await addDoc(collection(db, 'Relationship'), {
            member_contract_relationship_id: memberContractRelationshipId,
            relationshipType: personalInfo.relationshipToMainMember,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }

        // Update or create Status record
        const statusQuery = query(
          collection(db, 'Status'),
          where('member_contract_relationship_id', '==', memberContractRelationshipId)
        )
        const statusSnapshot = await getDocs(statusQuery)
        
        if (!statusSnapshot.empty) {
          // Update existing Status record
          await updateDoc(statusSnapshot.docs[0].ref, {
            status: personalInfo.dependentStatus,
            updatedAt: new Date()
          })
        } else {
          // Create new Status record if it doesn't exist
          await addDoc(collection(db, 'Status'), {
            member_contract_relationship_id: memberContractRelationshipId,
            status: personalInfo.dependentStatus,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }
      }

      // Update contact details
      const contactsRef = collection(db, 'Contacts')
      const existingContactsQuery = query(contactsRef, where('memberId', '==', memberId))
      const existingContacts = await getDocs(existingContactsQuery)
      
      // Delete existing contacts
      await Promise.all(existingContacts.docs.map(doc => deleteDoc(doc.ref)))
      
      // Add new contacts
      await Promise.all(contactDetails.map(contact =>
        addDoc(contactsRef, {
          ...contact,
          memberId,
          memberIdNumber: personalInfo.idNumber,
          updatedAt: new Date()
        })
      ))

      // Update address
      const addressRef = collection(db, 'Address')
      const existingAddressQuery = query(addressRef, where('memberId', '==', memberId))
      const existingAddress = await getDocs(existingAddressQuery)
      
      if (!existingAddress.empty) {
        await updateDoc(existingAddress.docs[0].ref, {
          ...addressDetails,
          updatedAt: new Date()
        })
      } else {
        await addDoc(addressRef, {
          ...addressDetails,
          memberId,
          memberIdNumber: personalInfo.idNumber,
          createdAt: new Date()
        })
      }

      // Fetch the updated member data
      const updatedMemberDoc = await getDoc(memberRef)
      const updatedMemberData = updatedMemberDoc.data()

      // Update parent component with latest data
      updateData({
        personalInfo: {
          title: updatedMemberData?.title || '',
          firstName: updatedMemberData?.firstName || '',
          lastName: updatedMemberData?.lastName || '',
          initials: updatedMemberData?.initials || '',
          dateOfBirth: updatedMemberData?.dateOfBirth ? new Date(updatedMemberData.dateOfBirth.seconds * 1000) : null,
          gender: updatedMemberData?.gender || '',
          relationshipToMainMember: updatedMemberData?.relationshipToMainMember || '',
          nationality: updatedMemberData?.nationality || '',
          idType: (updatedMemberData?.idType as "South African ID" | "Passport") || "South African ID",
          idNumber: updatedMemberData?.idNumber || '',
          dependentStatus: updatedMemberData?.dependentStatus || 'Active',
          medicalAidNumber: updatedMemberData?.medicalAidNumber || '',
          employer: updatedMemberData?.employer || '',
          school: updatedMemberData?.school || '',
          idDocumentUrl: updatedMemberData?.idDocumentUrl || null
        },
        contactDetails,
        addressDetails
      })

      toast({
        title: "Success",
        description: "Dependent details updated successfully",
        variant: "default",
      })

      // Close the dialog
      if (onCancel) {
        onCancel()
      }
    } catch (error) {
      console.error('Error updating member:', error)
      setError(error instanceof Error ? error.message : 'Failed to update member details')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSave = async () => {
    if (onSave) {
      setIsSaving(true);
      setError(null); // Clear any existing errors
      
      try {
        // Check if this person is already a dependent on this contract
        if (contractNumber) {
          // First find if the member exists
          const membersRef = collection(db, 'Members');
          const memberQuery = query(
            membersRef,
            where('idNumber', '==', personalInfo.idNumber),
            where('idType', '==', personalInfo.idType)
          );
          const memberSnapshot = await getDocs(memberQuery);
          
          if (!memberSnapshot.empty) {
            const memberId = memberSnapshot.docs[0].id;
            
            // Check for existing relationship in this contract
            const relationshipsRef = collection(db, 'member_contract_relationships');
            const relationshipQuery = query(
              relationshipsRef,
              where('member_id', '==', memberId),
              where('contract_number', '==', contractNumber),
              where('role', '==', 'Dependent')
            );
            const relationshipSnapshot = await getDocs(relationshipQuery);
            
            if (!relationshipSnapshot.empty) {
              setError('This person is already a Dependent on this contract');
              setIsSaving(false);
              return;
            }
          }
        }

        if (isEditing && contractNumber) {
          // Find member using ID type and number
          const membersRef = collection(db, 'Members');
          const memberQuery = query(
            membersRef,
            where('idNumber', '==', personalInfo.idNumber),
            where('idType', '==', personalInfo.idType)
          );
          
          const memberSnapshot = await getDocs(memberQuery);
          
          if (memberSnapshot.empty) {
            throw new Error('Member not found');
          }

          const memberId = memberSnapshot.docs[0].id;
          
          // Update the member details
          await updateExistingMember(memberId);

          // Fetch the latest data after update
          const updatedMemberDoc = await getDoc(doc(db, 'Members', memberId));
          const updatedMemberData = updatedMemberDoc.data();

          // Fetch latest contact details
          const contactsRef = collection(db, 'Contacts');
          const contactsQuery = query(contactsRef, where('memberId', '==', memberId));
          const contactsSnapshot = await getDocs(contactsQuery);
          const latestContactDetails = contactsSnapshot.docs.map(doc => ({
            type: doc.data().type as "Email" | "Phone Number",
            value: doc.data().value
          }));

          // Fetch latest address details
          const addressRef = collection(db, 'Address');
          const addressQuery = query(addressRef, where('memberId', '==', memberId));
          const addressSnapshot = await getDocs(addressQuery);
          let latestAddressDetails = {
            streetAddress: '',
            city: '',
            stateProvince: '',
            postalCode: '',
            country: ''
          };
          
          if (!addressSnapshot.empty) {
            const addressData = addressSnapshot.docs[0].data();
            latestAddressDetails = {
              streetAddress: addressData.streetAddress || '',
              city: addressData.city || '',
              stateProvince: addressData.stateProvince || '',
              postalCode: addressData.postalCode || '',
              country: addressData.country || ''
            };
          }

          // Update parent component with latest data
          updateData({
            personalInfo: {
              title: updatedMemberData?.title || '',
              firstName: updatedMemberData?.firstName || '',
              lastName: updatedMemberData?.lastName || '',
              initials: updatedMemberData?.initials || '',
              dateOfBirth: updatedMemberData?.dateOfBirth ? new Date(updatedMemberData.dateOfBirth.seconds * 1000) : null,
              gender: updatedMemberData?.gender || '',
              relationshipToMainMember: updatedMemberData?.relationshipToMainMember || '',
              nationality: updatedMemberData?.nationality || '',
              idType: (updatedMemberData?.idType as "South African ID" | "Passport") || "South African ID",
              idNumber: updatedMemberData?.idNumber || '',
              dependentStatus: updatedMemberData?.dependentStatus || 'Active',
              medicalAidNumber: updatedMemberData?.medicalAidNumber,
              employer: updatedMemberData?.employer,
              school: updatedMemberData?.school,
              idDocumentUrl: updatedMemberData?.idDocumentUrl || null
            },
            contactDetails: latestContactDetails,
            addressDetails: latestAddressDetails
          }, false);
          
          toast({
            title: "Success",
            description: "Dependent details updated successfully",
            variant: "default",
          });

          // Close dialog
          if (onCancel) {
            onCancel();
          }
        } else {
          // Check for existing relationship if we have a contract number
          if (contractNumber) {
            // Find member using ID type and number
            const membersRef = collection(db, 'Members');
            const memberQuery = query(
              membersRef,
              where('idNumber', '==', personalInfo.idNumber),
              where('idType', '==', personalInfo.idType)
            );
            
            const memberSnapshot = await getDocs(memberQuery);
            
            if (!memberSnapshot.empty) {
              const memberId = memberSnapshot.docs[0].id;
              const relationshipExists = await checkExistingRelationship(memberId, contractNumber);
              if (relationshipExists) {
                setError('This person is already a dependent on this contract');
                return;
              }
            }
          }

          // Create new member or save changes
          await onSave({
            personalInfo,
            contactDetails,
            addressDetails
          });

          // Find the newly created member to get its latest data
          const newMemberQuery = query(
            collection(db, 'Members'),
            where('idNumber', '==', personalInfo.idNumber),
            where('idType', '==', personalInfo.idType)
          );
          const newMemberSnapshot = await getDocs(newMemberQuery);
          
          if (!newMemberSnapshot.empty) {
            const newMemberId = newMemberSnapshot.docs[0].id;
            const newMemberData = newMemberSnapshot.docs[0].data();

            // Fetch latest contact details
            const contactsRef = collection(db, 'Contacts');
            const contactsQuery = query(contactsRef, where('memberId', '==', newMemberId));
            const contactsSnapshot = await getDocs(contactsQuery);
            const latestContactDetails = contactsSnapshot.docs.map(doc => ({
              type: doc.data().type as "Email" | "Phone Number",
              value: doc.data().value
            }));

            // Fetch latest address details
            const addressRef = collection(db, 'Address');
            const addressQuery = query(addressRef, where('memberId', '==', newMemberId));
            const addressSnapshot = await getDocs(addressQuery);
            let latestAddressDetails = {
              streetAddress: '',
              city: '',
              stateProvince: '',
              postalCode: '',
              country: ''
            };
            
            if (!addressSnapshot.empty) {
              const addressData = addressSnapshot.docs[0].data();
              latestAddressDetails = {
                streetAddress: addressData.streetAddress || '',
                city: addressData.city || '',
                stateProvince: addressData.stateProvince || '',
                postalCode: addressData.postalCode || '',
                country: addressData.country || ''
              };
            }

            // Update parent component with latest data
            const updatedData = {
              personalInfo: {
                title: newMemberData?.title || '',
                firstName: newMemberData?.firstName || '',
                lastName: newMemberData?.lastName || '',
                initials: newMemberData?.initials || '',
                dateOfBirth: newMemberData?.dateOfBirth ? new Date(newMemberData.dateOfBirth.seconds * 1000) : null,
                gender: newMemberData?.gender || '',
                relationshipToMainMember: newMemberData?.relationshipToMainMember || '',
                nationality: newMemberData?.nationality || '',
                idType: (newMemberData?.idType as "South African ID" | "Passport") || "South African ID",
                idNumber: newMemberData?.idNumber || '',
                dependentStatus: newMemberData?.dependentStatus || 'Active',
                medicalAidNumber: newMemberData?.medicalAidNumber,
                employer: newMemberData?.employer,
                school: newMemberData?.school,
                idDocumentUrl: newMemberData?.idDocumentUrl || null
              },
              contactDetails: latestContactDetails,
              addressDetails: latestAddressDetails
            };

            // First update the parent component
            updateData(updatedData, false);

            // Show success message
            toast({
              title: "Success",
              description: "Dependent added successfully",
              variant: "default",
            });

            // Then close the dialog
            if (onCancel) {
              onCancel();
            }
          }
        }
      } catch (error) {
        console.error('Error saving:', error);
        setError(error instanceof Error ? error.message : 'Failed to save. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personal">Personal Details</TabsTrigger>
          <TabsTrigger value="contact">Contact Details</TabsTrigger>
          <TabsTrigger value="address">Address Details</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex gap-3 col-span-3">
                <div className="flex-1">
                  <Label htmlFor="type-of-id">Type of ID</Label>
                  <Select
                    value={personalInfo.idType}
                    onValueChange={(value: "South African ID" | "Passport") => handlePersonalInfoChange("idType", value)}
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
                    <p className="text-sm text-red-500 mt-1">{validationErrors.idType}</p>
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
                    disabled={isEditing}
                  />
                  {(validationErrors?.idNumber || idValidationErrors.length > 0) && (
                    <p className="text-sm text-red-500 mt-1">
                      {validationErrors?.idNumber || idValidationErrors[0]}
                    </p>
                  )}
                </div>
              </div>

              {personalInfo.idType === "South African ID" && idValidationErrors.length > 0 && (
                <div className="col-span-3">
                  <ul className="text-sm text-red-500 mt-1 pl-4 list-disc">
                    {idValidationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Personal Information Fields */}
              <div className="col-span-3 grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Select
                      value={personalInfo.title}
                      onValueChange={(value) => handlePersonalInfoChange("title", value)}
                    >
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
                      <p className="text-sm text-red-500 mt-1">{validationErrors.title}</p>
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
                    <p className="text-sm text-red-500 mt-1">{validationErrors.firstName}</p>
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
                    <p className="text-sm text-red-500 mt-1">{validationErrors.lastName}</p>
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
                    <p className="text-sm text-red-500 mt-1">{validationErrors.initials}</p>
                  )}
                  </div>

                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <DatePicker
                      date={personalInfo.dateOfBirth}
                      onChange={(date) => handlePersonalInfoChange("dateOfBirth", date)}
                    />
                  {validationErrors?.dateOfBirth && (
                    <p className="text-sm text-red-500 mt-1">{validationErrors.dateOfBirth}</p>
                  )}
                  </div>

                  <div>
                    <Label htmlFor="gender">Gender</Label>
                  <Select 
                    value={personalInfo.gender} 
                    onValueChange={(value) => handlePersonalInfoChange("gender", value)}
                  >
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
                    <p className="text-sm text-red-500 mt-1">{validationErrors.gender}</p>
                  )}
                  </div>

                  <div>
                  <Label htmlFor="relationshipToMainMember">Relationship</Label>
                    <Select 
                      value={personalInfo.relationshipToMainMember} 
                      onValueChange={(value) => handlePersonalInfoChange("relationshipToMainMember", value)}
                    >
                    <SelectTrigger 
                      id="relationship" 
                      className={validationErrors?.relationshipToMainMember ? "border-red-500" : ""}
                    >
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
                    <p className="text-sm text-red-500 mt-1">{validationErrors.relationshipToMainMember}</p>
                  )}
                  </div>

                  <div>
                    <Label htmlFor="nationality">Nationality</Label>
                  <Select 
                      value={personalInfo.nationality}
                    onValueChange={(value) => handlePersonalInfoChange("nationality", value)}
                  >
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
                    <p className="text-sm text-red-500 mt-1">{validationErrors.nationality}</p>
                  )}
                  </div>

                  <div>
                  <Label htmlFor="dependentStatus">Status</Label>
                    <Select
                      value={personalInfo.dependentStatus}
                      onValueChange={(value: "Active" | "Inactive") => handlePersonalInfoChange("dependentStatus", value)}
                    >
                    <SelectTrigger 
                      id="status" 
                      className={validationErrors?.dependentStatus ? "border-red-500" : ""}
                    >
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  {validationErrors?.dependentStatus && (
                    <p className="text-sm text-red-500 mt-1">{validationErrors.dependentStatus}</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="contact">
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Contact Details</h3>
            <div className="space-y-2">
            {contactDetails.map((contact, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                <Select
                  value={contact.type}
                  onValueChange={(value: "Email" | "Phone Number") => handleContactDetailsChange(index, "type", value)}
                >
                        <SelectTrigger 
                          className={`w-[180px] ${validationErrors?.[`contact${index}Type`] ? "border-red-500" : ""}`}
                        >
                    <SelectValue placeholder="Select contact type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Phone Number">Phone Number</SelectItem>
                  </SelectContent>
                </Select>
                      {validationErrors?.[`contact${index}Type`] && (
                        <p className="text-sm text-red-500 mt-1">{validationErrors[`contact${index}Type`]}</p>
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
                        <p className="text-sm text-red-500 mt-1">{validationErrors[`contact${index}Value`]}</p>
                      )}
                    </div>
                    <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveContact(index)}>
                  Remove
                </Button>
                  </div>
              </div>
            ))}
              <Button id="Add Contact" type="button" onClick={handleAddContact} size="sm" className="mt-2">
              Add Contact
            </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="address">
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Address Details</h3>
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
                  <p className="text-sm text-red-500 mt-1">{validationErrors.streetAddress}</p>
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
                  <p className="text-sm text-red-500 mt-1">{validationErrors.city}</p>
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
                  <p className="text-sm text-red-500 mt-1">{validationErrors.stateProvince}</p>
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
                  <p className="text-sm text-red-500 mt-1">{validationErrors.postalCode}</p>
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
                  <p className="text-sm text-red-500 mt-1">{validationErrors.country}</p>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      <div className="flex justify-end space-x-2 mt-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button 
          variant="outline" 
          onClick={onCancel}
          disabled={isSaving || isUpdating}
        >
          Cancel
        </Button>
        <Button 
          onClick={isEditing ? handleUpdateMember : handleSave}
          disabled={isSaving || isUpdating}
        >
          {isSaving || isUpdating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isEditing ? 'Updating...' : 'Saving...'}
            </>
          ) : (
            isEditing ? 'Update' : 'Save'
          )}
        </Button>
      </div>
    </div>
  )
} 