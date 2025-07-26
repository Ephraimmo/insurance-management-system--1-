"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertCircle, CheckCircle2, XCircle, FileImage, Download, Eye } from "lucide-react"
import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableHeader, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table"
import { collection, getDocs, query, where, doc, getDoc, updateDoc, orderBy, limit, onSnapshot, deleteDoc, addDoc } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { DocumentData, Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { getContractRelationships } from "@/lib/member-relationship-service"
import { MainMemberForm } from "@/components/contract/MainMemberForm"
import { DependentData } from "@/types/dependent"

let cateringOptionsAmount = 0;
type MainMemberData = {
  personalInfo: {
    title: string
    firstName: string
    lastName: string
    idNumber: string
    gender: string
    dateOfBirth: Date | null
    initials: string
    language: string
    maritalStatus: string
    nationality: string
    idType: "South African ID" | "Passport"
    idDocumentUrl: string | null
  }
  contractNumber?: string
  contractId?: string
  addressDetails: {
    streetAddress: string
    city: string
    stateProvince: string
    postalCode: string
    country: string
  }
  contactDetails: Array<{
    type: "Email" | "Phone Number"
    value: string
  }>
}

type BeneficiaryData = {
  id?: string
  personalInfo: {
    title?: string
    firstName: string
    lastName: string
    initials?: string
    dateOfBirth?: Date | null
    gender?: string
    relationshipToMainMember: string
    nationality?: string
    idType?: "South African ID" | "Passport"
    idNumber: string
    beneficiaryPercentage: number
    idDocumentUrl?: string | null
  }
  contactDetails?: Array<{
    type: "Email" | "Phone Number"
    value: string
  }>
  addressDetails?: {
    streetAddress: string
    city: string
    stateProvince: string
    postalCode: string
    country: string
  }
}

const policiess = {
  silver: { name: "Silver (policies A)", price: 200 },
  gold: { name: "Gold (policies B)", price: 350 },
  platinum: { name: "Platinum (policies C)", price: 400 },
}

const cateringOptions = {
  option1: { name: "Option 1", price: 110 },
  option2: { name: "Option 2", price: 110 },
  option3: { name: "Option 3", price: 110 },
  option4: { name: "Option 4", price: 110 },
}

type Payment = {
  id: string
  amount: number
  paymentDate: Date
  paymentMethod: string
  status: string
  reference: string
  receiptUrl?: string
}

type Claim = {
  id: string
  claimNumber: string
  claimDate: Date
  startDate: Date
  endDate: Date
  status: string
  claimantName: string
  coverageAmount: number
}

type ContractData = {
  mainMember: MainMemberData
  beneficiaries: BeneficiaryData[]
  dependents: DependentData[]
  policiesDetails: {
    policiesId: string
    name: string
    coverAmount: string
    premium: number | null
  }
  cateringOptions: Array<{
    id: string
    name: string
    price: number
  }>
  status?: string
}

type ContractSummaryProps = {
  data: ContractData
  onEdit: (tab: string) => void
  isLoading?: boolean
  error?: string | null
}

// Add type for member relationship
type MemberRelationship = {
  relationship_id: string
  member_id: string
  contract_number: string
  role: 'Main Member' | 'Dependent' | 'Beneficiary'
  created_at: Date
}

// Update FirestoreMemberData type
type FirestoreMemberData = {
  firstName: string
  lastName: string
  idNumber: string
  dateOfBirth: Date | null
  gender: string
  title?: string
  initials?: string
  language?: string
  maritalStatus?: string
  nationality?: string
  idType?: "South African ID" | "Passport"
  idDocumentUrl?: string | null
  totalPercentage?: number
}

type FirestorepoliciesData = {
  Name: string
  Price: number
  Description: string
  Details: string[]
  MaxDependents: number
}

type FirestoreBeneficiaryData = {
  personalInfo: {
    title: string
    firstName: string
    lastName: string
    initials: string
    dateOfBirth: string
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

type FirestoreDependentData = {
  personalInfo: {
    firstName: string
    lastName: string
    initials: string
    dateOfBirth: string
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

type FirestoreContractData = {
  contractNumber: string
  memberIdNumber: string
  policiesId: string
  status: string
  cateringOptionIds: string[]
}

async function generateUniqueContractNumber(): Promise<string> {
  const generateNumber = () => {
    const prefix = 'CNT'
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 5).toUpperCase()
    return `${prefix}-${timestamp}-${random}`
  }

  let contractNumber = generateNumber()
  let isUnique = false
  let maxAttempts = 10
  let attempts = 0

  while (!isUnique && attempts < maxAttempts) {
    try {
      // Check if contract number exists
      const contractQuery = query(
        collection(db, 'Contracts'),
        where('contractNumber', '==', contractNumber)
      )
      const contractSnapshot = await getDocs(contractQuery)

      if (contractSnapshot.empty) {
        isUnique = true
      } else {
        // Generate a new number if duplicate found
        contractNumber = generateNumber()
        attempts++
      }
    } catch (error) {
      console.error('Error checking contract number:', error)
      throw new Error('Failed to generate unique contract number')
    }
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique contract number after maximum attempts')
  }

  return contractNumber
}

export function ContractSummary({ data, onEdit, isLoading = false, error = null }: ContractSummaryProps) {
  const [activeTab, setActiveTab] = useState("contract")
  const [contractData, setContractData] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [recentClaims, setRecentClaims] = useState<Claim[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [viewingReceipt, setViewingReceipt] = useState<{ url: string; reference: string } | null>(null)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [benefitLoading, setBenefitLoading] = useState(true);
  const [benefitError, setBenefitError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showMainMemberDialog, setShowMainMemberDialog] = useState(false);
  const [mainMemberFormData, setMainMemberFormData] = useState<MainMemberData>({
    personalInfo: {
      title: '',
      firstName: '',
      lastName: '',
      idNumber: '',
      gender: '',
      dateOfBirth: null,
      initials: '',
      language: '',
      maritalStatus: '',
      nationality: '',
      idType: 'South African ID',
      idDocumentUrl: null
    },
    contractNumber: '',
    contractId: '',
    addressDetails: {
      streetAddress: '',
      city: '',
      stateProvince: '',
      postalCode: '',
      country: ''
    },
    contactDetails: []
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchContractData = async () => {
      try {
        setLoading(true)
        setFetchError(null)

        if (!data.mainMember.contractId) {
          throw new Error('Contract ID is missing')
        }

        // Get contract details
        const contractRef = doc(db, 'Contracts', data.mainMember.contractId)
        const contractDoc = await getDoc(contractRef)
        
        if (!contractDoc.exists()) {
          throw new Error('Contract not found')
        }

        const contractData = contractDoc.data() as FirestoreContractData

        // If contract number is missing, generate a unique one and update the contract
        if (!contractData.contractNumber) {
          try {
            const uniqueContractNumber = await generateUniqueContractNumber()
            await updateDoc(contractRef, {
              contractNumber: uniqueContractNumber
            })
            contractData.contractNumber = uniqueContractNumber
          } catch (error) {
            console.error('Error generating contract number:', error)
            throw new Error('Failed to generate contract number')
          }
        }

        // Get policies details
        const policiesRef = doc(db, 'Policies', contractData.policiesId)
        const policiesDoc = await getDoc(policiesRef)
        
        if (!policiesDoc.exists()) {
          throw new Error('policies not found')
        }
        const policiesData = policiesDoc.data()
        
        // Get catering options
        const cateringOptionsData = await Promise.all(
          (contractData.cateringOptionIds || []).map(async (id: string) => {
            const cateringRef = doc(db, 'catering', id)
            const cateringDoc = await getDoc(cateringRef)
            if (!cateringDoc.exists()) {
              return {
                id,
                name: 'Unknown Option',
                price: 0
              }
            }
            const data = cateringDoc.data()
            return {
              id,
              name: data.name || 'Unknown Option',
              price: data.price || 0
            }
          })
        )
        
        // Get member_contract_relationships for this contract
        const relationshipsRef = collection(db, 'member_contract_relationships')
        const relationshipsQuery = query(
          relationshipsRef,
          where('contract_number', '==', contractData.contractNumber)
        )
        
        
        const relationshipsSnapshot = await getDocs(relationshipsQuery)

        // Initialize arrays for different member types
        let mainMemberData: FirestoreMemberData = {
          firstName: '',
          lastName: '',
          idNumber: '',
          dateOfBirth: null,
          gender: '',
          title: '',
          initials: '',
          language: '',
          maritalStatus: '',
          nationality: ''
        };
        const beneficiariesData: BeneficiaryData[] = []
        const dependentsData: DependentData[] = []

        // Process each relationship
        await Promise.all(relationshipsSnapshot.docs.map(async (relationshipDoc) => {
          const relationshipData = relationshipDoc.data()
          const memberId = relationshipData.member_id
          const memberRole = relationshipData.role
          
          // Get member details
          const memberDoc = await getDoc(doc(db, 'Members', memberId))
          if (!memberDoc.exists()) return

          const memberData = memberDoc.data() as FirestoreMemberData

          // Get relationship type if exists
          const relationshipTypeQuery = query(
            collection(db, 'Relationship'),
            where('member_contract_relationship_id', '==', relationshipDoc.id)
          )
          const relationshipTypeSnapshot = await getDocs(relationshipTypeQuery)
          const relationshipType = relationshipTypeSnapshot.empty ? '' : relationshipTypeSnapshot.docs[0].data().relationshipType
          
          // Get status if exists
          const statusQuery = query(
            collection(db, 'Status'),
            where('member_contract_relationship_id', '==', relationshipDoc.id)
          )
          const statusSnapshot = await getDocs(statusQuery)
          const status = statusSnapshot.empty ? 'Active' : statusSnapshot.docs[0].data().status

          switch (memberRole) {
            case 'Main Member':
              mainMemberData = {
                ...memberData,
                dateOfBirth: memberData.dateOfBirth instanceof Timestamp ? 
                  memberData.dateOfBirth.toDate() : 
                  null
              };
              break;
            case 'Beneficiary':
              beneficiariesData.push({
                id: memberDoc.id,
                personalInfo: {
                  firstName: memberData.firstName,
                  lastName: memberData.lastName,
                  relationshipToMainMember: relationshipType,
                  idNumber: memberData.idNumber,
                  beneficiaryPercentage: (memberData as any).totalPercentage || 0
                }
              });
              break;
            case 'Dependent':
              dependentsData.push({
                id: memberDoc.id,
                personalInfo: {
                  title: memberData.title || '',
                  firstName: memberData.firstName,
                  lastName: memberData.lastName,
                  initials: memberData.initials || '',
                  dateOfBirth: memberData.dateOfBirth ? new Date(memberData.dateOfBirth) : null,
                  gender: memberData.gender || '',
                  relationshipToMainMember: relationshipType,
                  nationality: memberData.nationality || '',
                  idType: memberData.idType || 'South African ID',
                  idNumber: memberData.idNumber,
                  dependentStatus: status,
                  idDocumentUrl: memberData.idDocumentUrl || null
                },
                contactDetails: [],
                addressDetails: {
                  streetAddress: '',
                  city: '',
                  stateProvince: '',
                  postalCode: '',
                  country: ''
                }
              });
              break;
          }
        }))
        
        if (!mainMemberData.firstName) {
          console.warn('Main member data is missing or incomplete');
        }

        // Construct full contract data
        const fullContractData: ContractData = {
          mainMember: {
            personalInfo: {
              title: mainMemberData.title || '',
              firstName: mainMemberData.firstName || 'N/A',
              lastName: mainMemberData.lastName || 'N/A',
              idNumber: mainMemberData.idNumber || 'N/A',
              gender: mainMemberData.gender || 'N/A',
              dateOfBirth: mainMemberData.dateOfBirth,
              initials: mainMemberData.initials || '',
              language: mainMemberData.language || '',
              maritalStatus: mainMemberData.maritalStatus || '',
              nationality: mainMemberData.nationality || '',
              idType: mainMemberData.idType || 'South African ID',
              idDocumentUrl: mainMemberData.idDocumentUrl || null
            },
            contractNumber: contractData.contractNumber,
            contractId: contractDoc.id,
            addressDetails: {
              streetAddress: '',
              city: '',
              stateProvince: '',
              postalCode: '',
              country: ''
            },
            contactDetails: []
          },
          beneficiaries: beneficiariesData,
          dependents: dependentsData,
          policiesDetails: {
            policiesId: contractData.policiesId,
            name: policiesData.name || 'Unknown policies',
            coverAmount: policiesData.coverAmount?.toString() || '0',
            premium: policiesData.premium || null
          },
          cateringOptions: cateringOptionsData,
          status: contractData.status
        }

        setContractData(fullContractData)
      } catch (error) {
        console.error('Error fetching contract data:', error)
        setFetchError(error instanceof Error ? error.message : 'Failed to load contract data')
      } finally {
        setLoading(false)
      }
    }

    if (data.mainMember.contractId) {
      fetchContractData()
    }
  }, [data.mainMember.contractId])

  useEffect(() => {
    const fetchPaymentHistory = async () => {
      if (!data.mainMember.contractNumber) return

      try {
        setLoadingHistory(true)
        // Fetch recent payments
        const paymentsQuery = query(
          collection(db, 'Payments'),
          where('contractNumber', '==', data.mainMember.contractNumber)
        )
        
        try {
          const paymentsSnapshot = await getDocs(paymentsQuery)
          const payments = paymentsSnapshot.docs
            .map(doc => ({
              id: doc.id,
              reference: doc.data().reference,
              amount: doc.data().amount,
              paymentMethod: doc.data().paymentMethod,
              status: doc.data().status,
              receiptUrl: doc.data().receiptUrl,
              paymentDate: doc.data().paymentDate?.toDate() || new Date()
            }))
            .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())
            .slice(0, 3) as Payment[]
          setRecentPayments(payments)
        } catch (error: any) {
          // Check if the error is due to missing index
          if (error.code === 'failed-precondition') {
            console.error('Missing index for payments query. Please create the following index:')
            console.error('Collection: Payments')
            console.error('Fields to index: contractNumber (Ascending), paymentDate (Descending)')
          } else {
            console.error('Error fetching payments:', error)
          }
        }
      } catch (error) {
        console.error('Error fetching payment history:', error)
      } finally {
        setLoadingHistory(false)
      }
    }

    fetchPaymentHistory()
  }, [data.mainMember.contractNumber])

  useEffect(() => {
    const fetchClaimHistory = async () => {
      if (!data.mainMember.contractNumber) return

      try {
        setLoadingHistory(true)
        
        const claimsQuery = query(
          collection(db, 'Claims'),
          where('contractNumber', '==', data.mainMember.contractNumber),
          limit(3)
        )

        const claimsSnapshot = await getDocs(claimsQuery)
        
        const claimsWithCoverage = await Promise.all(claimsSnapshot.docs.map(async (doc) => {
          const claimData = doc.data()
          const claimNumber = claimData.claimNumber || `CLM-${doc.id.slice(0, 8)}`
          
          const claimPoliciesQuery = query(
            collection(db, 'ClaimPolicies'),
            where('claimNumber', '==', claimNumber),
            limit(1)
          )
          
          const claimPoliciesSnapshot = await getDocs(claimPoliciesQuery)
          const coverageAmount = claimPoliciesSnapshot.empty ? 0 : 
            claimPoliciesSnapshot.docs[0].data().coverageAmount || 0

          return {
            id: doc.id,
            claimNumber: claimNumber,
            claimDate: claimData.claimDate?.toDate() || new Date(),
            startDate: claimData.startDate?.toDate() || new Date(),
            endDate: claimData.endDate?.toDate() || new Date(),
            status: claimData.status || 'Pending',
            claimantName: claimData.claimantName || 'Unknown',
            coverageAmount: coverageAmount
          }
        })) as Claim[]
        
        setRecentClaims(claimsWithCoverage)
      } catch (error) {
        console.error('Error fetching claim history:', error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load claim history"
        })
      } finally {
        setLoadingHistory(false)
      }
    }

    fetchClaimHistory()
  }, [data.mainMember.contractNumber])

  useEffect(() => {
    if (!contractData?.mainMember.contractNumber) return;

    // Query for member-contract relationships
    const relationshipsRef = collection(db, 'member_contract_relationships');
    const relationshipsQuery = query(
      relationshipsRef,
      where('contract_number', '==', contractData.mainMember.contractNumber),
      where('role', '==', 'Beneficiary')
    );

    // Set up the real-time listener
    const unsubscribe = onSnapshot(relationshipsQuery, async (relationshipSnapshot) => {
      try {
        setBenefitLoading(true);
        setBenefitError(null);
        
        const beneficiaryPromises = relationshipSnapshot.docs.map(async (relationshipDoc) => {
          const memberId = relationshipDoc.data().member_id;
          const relationshipId = relationshipDoc.id;

          try {
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

            // Get benefit percentage from Benefit collection with error handling
            const benefitQuery = query(
              collection(db, 'Benefit'),
              where('member_contract_relationship_id', '==', relationshipId)
            );
            const benefitSnapshot = await getDocs(benefitQuery);
            const benefitPercentage = benefitSnapshot.docs[0]?.data()?.percentage || 0;

            if (benefitSnapshot.empty) {
              console.warn(`No benefit percentage found for relationship ID: ${relationshipId}`);
            }

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
                dateOfBirth: memberData.dateOfBirth ? new Date(memberData.dateOfBirth) : null,
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
          } catch (error) {
            console.error('Error processing beneficiary:', error);
            return null;
          }
        });

        const beneficiariesData = (await Promise.all(beneficiaryPromises)).filter((b): b is BeneficiaryData => b !== null);
        
        // Validate total percentage
        const totalPercentage = beneficiariesData.reduce((sum, ben) => sum + (ben.personalInfo.beneficiaryPercentage || 0), 0);
        if (totalPercentage > 100) {
          console.warn(`Total beneficiary percentage exceeds 100%: ${totalPercentage}%`);
        }
        
        setContractData(prevData => ({
          ...prevData!,
          beneficiaries: beneficiariesData
        }));
        setBenefitLoading(false);
      } catch (error) {
        console.error('Error fetching beneficiaries:', error);
        setBenefitError('Failed to fetch beneficiaries. Please refresh the page.');
        setBenefitLoading(false);
      }
    }, (error) => {
      console.error('Error in beneficiaries listener:', error);
      setBenefitError('Error listening to beneficiary changes. Please refresh the page.');
      setBenefitLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [contractData?.mainMember.contractNumber, setContractData]);

  const totalCateringCost = (contractData?.cateringOptions || []).reduce(
    (total: number, option) => total + option.price,
    0
  )
  const totalCost = (contractData?.policiesDetails.premium || 0) + totalCateringCost

  const totalBeneficiaryPercentage = (contractData?.beneficiaries || []).reduce(
    (sum, beneficiary) => {
      const percentage = Number(beneficiary?.personalInfo?.beneficiaryPercentage) || 0;
      return sum + percentage;
    },
    0
  );

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'pending':
      case 'in progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleMainMemberUpdate = async (updatedData: MainMemberData) => {
    try {
      setIsUpdating(true);
      
      // Get the member relationship
      const relationshipsRef = collection(db, 'member_contract_relationships');
      const q = query(
        relationshipsRef,
        where('contract_number', '==', contractData?.mainMember.contractNumber),
        where('role', '==', 'Main Member')
      );
      
      const relationshipSnapshot = await getDocs(q);
      if (relationshipSnapshot.empty) {
        throw new Error('Main member relationship not found');
      }
      
      const memberId = relationshipSnapshot.docs[0].data().member_id;
      
      // Update member details
      const memberRef = doc(db, 'Members', memberId);
      await updateDoc(memberRef, {
        title: updatedData.personalInfo.title,
        firstName: updatedData.personalInfo.firstName,
        lastName: updatedData.personalInfo.lastName,
        initials: updatedData.personalInfo.initials,
        dateOfBirth: updatedData.personalInfo.dateOfBirth,
        gender: updatedData.personalInfo.gender,
        language: updatedData.personalInfo.language,
        maritalStatus: updatedData.personalInfo.maritalStatus,
        nationality: updatedData.personalInfo.nationality,
        idType: updatedData.personalInfo.idType,
        idNumber: updatedData.personalInfo.idNumber,
        idDocumentUrl: updatedData.personalInfo.idDocumentUrl
      });

      // Update contacts
      const contactsRef = collection(db, 'Contacts');
      const contactsQuery = query(contactsRef, where('memberId', '==', memberId));
      const contactsSnapshot = await getDocs(contactsQuery);
      
      // Delete existing contacts
      for (const doc of contactsSnapshot.docs) {
        await deleteDoc(doc.ref);
      }
      
      // Add new contacts
      for (const contact of updatedData.contactDetails || []) {
        await addDoc(contactsRef, {
          memberId,
          type: contact.type,
          value: contact.value
        });
      }

      // Update address
      const addressRef = collection(db, 'Address');
      const addressQuery = query(addressRef, where('memberId', '==', memberId));
      const addressSnapshot = await getDocs(addressQuery);
      
      if (addressSnapshot.empty) {
        // Create new address
        await addDoc(addressRef, {
          memberId,
          ...updatedData.addressDetails
        });
      } else {
        // Update existing address
        if (updatedData.addressDetails) {
          await updateDoc(addressSnapshot.docs[0].ref, updatedData.addressDetails);
        }
      }

      toast({
        title: "Success",
        description: "Main member details updated successfully",
      });

      // Close dialog and refresh data
      setShowMainMemberDialog(false);
      
      // Update the local state to reflect changes
      if (contractData) {
        setContractData({
          ...contractData,
          mainMember: {
            personalInfo: updatedData.personalInfo,
            contractNumber: contractData.mainMember.contractNumber,
            contractId: contractData.mainMember.contractId,
            addressDetails: updatedData.addressDetails,
            contactDetails: updatedData.contactDetails
          }
        });
      }

    } catch (error) {
      console.error('Error updating main member:', error);
      toast({
        title: "Error",
        description: "Failed to update main member details",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </CardContent>
        </Card>

        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Card className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-28" />
              </div>
            </Card>
          </div>
        ))}
      </div>
    )
  }

  if (fetchError || error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Summary</AlertTitle>
        <AlertDescription>{fetchError || error}</AlertDescription>
      </Alert>
    )
  }

  if (!contractData) {
    return (
      <Alert>
        <AlertTitle>No Data</AlertTitle>
        <AlertDescription>No contract data available.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Contract Details
            <Badge className={getStatusColor(contractData.status)}>
              {contractData.status || 'New'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Contract Number</span>
            <span className="font-medium">{contractData.mainMember.contractNumber || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Total Monthly Premium</span>
            <span className="font-bold text-lg">R {totalCost.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="contract" className="w-full" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="contract">Contract</TabsTrigger>
          <TabsTrigger value="policies">policies</TabsTrigger>
          <TabsTrigger value="main-member">Main Member</TabsTrigger>
          <TabsTrigger value="beneficiaries">Beneficiaries</TabsTrigger>
          <TabsTrigger value="dependents">Dependents</TabsTrigger>
          {data.mainMember.contractNumber && (
            <>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="claims">Claims</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="contract">
      <Card>
        <CardHeader>
              <CardTitle>Contract Overview</CardTitle>
        </CardHeader>
        <CardContent>
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Monthly Premium</TableHead>
                      <TableHead>Total Beneficiaries</TableHead>
                      <TableHead>Total Dependents</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{contractData.mainMember.contractNumber || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(contractData.status)}>
                          {contractData.status || 'New'}
                        </Badge>
                      </TableCell>
                      <TableCell>R {(totalCost + cateringOptionsAmount ).toLocaleString()}</TableCell>
                      <TableCell>{contractData.beneficiaries.length}</TableCell>
                      <TableCell>{contractData.dependents.length}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="policies">
      <Card>
        <CardHeader>
              <CardTitle>
                policies Details
              </CardTitle>
        </CardHeader>
        <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>policies Name</TableHead>
                    <TableHead>Cover Amount</TableHead>
                    <TableHead>Monthly Premium</TableHead>
                    <TableHead>Catering Options</TableHead>
                    <TableHead>Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>{contractData.policiesDetails.name}</TableCell>
                    <TableCell>R {contractData.policiesDetails.coverAmount}</TableCell>
                    <TableCell>R {contractData.policiesDetails.premium?.toLocaleString() || '0'}</TableCell>
                    <TableCell>{contractData.cateringOptions.length} selected</TableCell>
                    <TableCell>R {totalCost.toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {contractData.cateringOptions.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold mb-2">Selected Catering Options</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Option Name</TableHead>
                        <TableHead>Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contractData.cateringOptions.map((option) => (
                        <TableRow key={option.id}>
                          <TableCell>{option.name}</TableCell>
                          <TableCell>R {option.price.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="main-member">
      <Card>
        <CardHeader>
              <CardTitle>
                Main Member Details
              </CardTitle>
        </CardHeader>
        <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !contractData?.mainMember?.personalInfo ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                  <p>No main member details available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Full Name</TableHead>
                      <TableHead>ID Number</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Date of Birth</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        {contractData.mainMember.personalInfo.firstName} {contractData.mainMember.personalInfo.lastName}
                      </TableCell>
                      <TableCell>{contractData.mainMember.personalInfo.idNumber}</TableCell>
                      <TableCell>{contractData.mainMember.personalInfo.gender}</TableCell>
                      <TableCell>
                        {contractData.mainMember.personalInfo.dateOfBirth 
                          ? format(contractData.mainMember.personalInfo.dateOfBirth, 'dd/MM/yyyy')
                          : 'N/A'
                        }
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="beneficiaries">
      <Card>
        <CardHeader>
              <CardTitle className="flex justify-between items-center">
                Beneficiary Details
                <div className="flex items-center gap-2">
                  <Badge variant={totalBeneficiaryPercentage === 100 ? "default" : "destructive"}>
                    Total: {totalBeneficiaryPercentage}%
                  </Badge>
                </div>
              </CardTitle>
        </CardHeader>
        <CardContent>
              {benefitError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{benefitError}</AlertDescription>
                </Alert>
              ) : benefitLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : contractData.beneficiaries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                  <p>No beneficiaries added yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>ID Number</TableHead>
                      <TableHead>Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractData.beneficiaries.map((beneficiary, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {beneficiary.personalInfo.firstName} {beneficiary.personalInfo.lastName}
                        </TableCell>
                        <TableCell>{beneficiary.personalInfo.relationshipToMainMember}</TableCell>
                        <TableCell>{beneficiary.personalInfo.idNumber}</TableCell>
                        <TableCell>{beneficiary.personalInfo.beneficiaryPercentage}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="dependents">
      <Card>
        <CardHeader>
              <CardTitle>
                Dependent Details
              </CardTitle>
        </CardHeader>
        <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>ID Number</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractData.dependents.map((dependent, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {dependent.personalInfo.firstName} {dependent.personalInfo.lastName}
                      </TableCell>
                      <TableCell>{dependent.personalInfo.relationshipToMainMember}</TableCell>
                      <TableCell>
                        <Badge variant={dependent.personalInfo.dependentStatus === "Active" ? "default" : "secondary"}>
                          {dependent.personalInfo.dependentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{dependent.personalInfo.idNumber}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
        </CardContent>
      </Card>
        </TabsContent>

        {data.mainMember.contractNumber && (
          <>
            <TabsContent value="payments">
              <Card>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    Recent Payments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingHistory ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : recentPayments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                      <p>No payment history found</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reference</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Receipt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{payment.reference}</TableCell>
                            <TableCell>{format(payment.paymentDate, 'dd/MM/yyyy')}</TableCell>
                            <TableCell>R {payment.amount.toLocaleString()}</TableCell>
                            <TableCell>{payment.paymentMethod}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                payment.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                payment.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {payment.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              {payment.receiptUrl && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setViewingReceipt({ 
                                          url: payment.receiptUrl!, 
                                          reference: payment.reference 
                                        })}
                                      >
                                        <FileImage className="h-4 w-4 text-blue-500" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>View receipt</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="claims">
              <Card>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    Recent Claims
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingHistory ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : recentClaims.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                      <p>No claim history found</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Claim Number</TableHead>
                          <TableHead>Claimant</TableHead>
                          <TableHead>Coverage Amount</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>End Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentClaims.map((claim) => (
                          <TableRow key={claim.id}>
                            <TableCell className="font-medium">{claim.claimNumber}</TableCell>
                            <TableCell>{claim.claimantName}</TableCell>
                            <TableCell>R {claim.coverageAmount.toLocaleString()}</TableCell>
                            <TableCell>{format(claim.startDate, 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{format(claim.endDate, 'dd/MM/yyyy')}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                claim.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                claim.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                claim.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {claim.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>

      <Dialog open={viewingReceipt !== null} onOpenChange={(open) => !open && setViewingReceipt(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <FileImage className="h-5 w-5" />
              Payment Receipt
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col min-h-[60vh]">
            <div className="grid md:grid-cols-[1fr,300px] gap-6 pt-2 flex-1">
              {/* Image Section */}
              <div className="relative bg-gray-50 rounded-lg overflow-hidden border shadow-inner">
                <div className="absolute inset-0 flex items-center justify-center">
                  {isImageLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/90 backdrop-blur-sm z-10 gap-3">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground animate-pulse">Loading receipt...</p>
                    </div>
                  )}
                  {viewingReceipt?.url && (
                    <img
                      src={viewingReceipt.url}
                      alt={`Receipt for ${viewingReceipt.reference}`}
                      className={`max-w-full max-h-[60vh] object-contain transition-opacity duration-300 ${isImageLoading ? 'opacity-0' : 'opacity-100'}`}
                      onLoadStart={() => setIsImageLoading(true)}
                      onLoad={() => setIsImageLoading(false)}
                      onError={() => {
                        setIsImageLoading(false)
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description: "Failed to load receipt image"
                        })
                      }}
                    />
                  )}
                </div>
                <div className="aspect-[3/4] md:aspect-auto md:h-[60vh]" />
              </div>

              {/* Details Section */}
              <div className="space-y-4">
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <h3 className="font-semibold mb-4 flex items-center gap-2 text-primary">
                    <FileImage className="h-4 w-4" />
                    Receipt Information
                  </h3>
                  <dl className="space-y-3 text-sm">
                    <div className="grid grid-cols-[100px,1fr] items-center py-1 border-b">
                      <dt className="text-muted-foreground">Reference:</dt>
                      <dd className="font-medium">{viewingReceipt?.reference}</dd>
                    </div>
                    <div className="grid grid-cols-[100px,1fr] items-center py-1">
                      <dt className="text-muted-foreground">Status:</dt>
                      <dd>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Uploaded
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <h3 className="font-semibold mb-4 flex items-center gap-2 text-primary">
                    <Download className="h-4 w-4" />
                    Actions
                  </h3>
                  <div className="space-y-3">
                    <Button 
                      className="w-full justify-start" 
                      variant="outline"
                      onClick={() => window.open(viewingReceipt?.url, '_blank')}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Open in New Tab
                    </Button>
                    <Button 
                      className="w-full justify-start" 
                      variant="outline"
                      onClick={() => {
                        const link = document.createElement('a')
                        link.href = viewingReceipt?.url || ''
                        link.download = `receipt-${viewingReceipt?.reference}`
                        link.click()
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Receipt
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t mt-6 pt-4">
              <Button
                variant="outline"
                onClick={() => setViewingReceipt(null)}
                className="px-8"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMainMemberDialog} onOpenChange={setShowMainMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Main Member Details</DialogTitle>
          </DialogHeader>
          <MainMemberForm
            data={mainMemberFormData}
            updateData={setMainMemberFormData}
            errors={formErrors}
          />
          <DialogFooter>
            <Button
              onClick={() => setShowMainMemberDialog(false)}
              variant="outline"
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleMainMemberUpdate(mainMemberFormData)}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

