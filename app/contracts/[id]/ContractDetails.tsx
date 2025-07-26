"use client"

import { useEffect, useState } from "react"
import { ContractSummary } from "@/components/contract/ContractSummary"
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type ContractData = {
  mainMember: {
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
    contractNumber?: string
    contractId?: string
  }
  beneficiaries: Array<{
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
  }>
  dependents: Array<{
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
  }>
  policiesDetails: {
    policiesId: string
    name: string
    coverAmount: string
    premium: number | null
    description: string
    features: string[]
    maxDependents: number
    status: string
    isSelected: boolean
  }
  cateringOptions: Array<{
    id: string
    name: string
    price: number
  }>
  status?: string
}

interface ContractDetailsProps {
  id: string
}

export function ContractDetails({ id }: ContractDetailsProps) {
  const [contractData, setContractData] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchContractDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get contract details
        const contractRef = doc(db, 'Contracts', id)
        const contractDoc = await getDoc(contractRef)
        
        if (!contractDoc.exists()) {
          setError('Contract not found')
          return
        }

        const contractData = contractDoc.data()

        // Get main member details
        const membersQuery = query(
          collection(db, 'Members'),
          where('idNumber', '==', contractData.memberIdNumber)
        )
        const memberSnapshot = await getDocs(membersQuery)
        const memberData = memberSnapshot.docs[0]?.data()

        // Get plan details
        const planRef = doc(db, 'Policies', contractData.policiesId)
        const policiesDoc = await getDoc(planRef)
        const policiesData = policiesDoc.data()

        // Get beneficiaries
        const beneficiariesQuery = query(
          collection(db, 'Beneficiaries'),
          where('contractNumber', '==', contractData.contractNumber)
        )
        const beneficiariesSnapshot = await getDocs(beneficiariesQuery)
        const beneficiariesData = beneficiariesSnapshot.docs.map(doc => doc.data())

        // Get dependents
        const dependentsQuery = query(
          collection(db, 'Dependents'),
          where('contractNumber', '==', contractData.contractNumber)
        )
        const dependentsSnapshot = await getDocs(dependentsQuery)
        const dependentsData = dependentsSnapshot.docs.map(doc => doc.data())

        // Get catering options
        const cateringOptionsData = await Promise.all(
          (contractData.cateringOptionIds || []).map(async (id: string) => {
            const cateringRef = doc(db, 'catering', id)
            const cateringDoc = await getDoc(cateringRef)
            return {
              id,
              ...cateringDoc.data()
            }
          })
        )

        // Construct full contract data
        const fullContractData: ContractData = {
          mainMember: {
            personalInfo: {
              title: memberData?.title || "",
              firstName: memberData?.firstName || "",
              lastName: memberData?.lastName || "",
              initials: memberData?.initials || "",
              dateOfBirth: memberData?.dateOfBirth?.toDate() || null,
              gender: memberData?.gender || "",
              language: memberData?.language || "",
              maritalStatus: memberData?.maritalStatus || "",
              nationality: memberData?.nationality || "",
              idType: memberData?.idType || "South African ID",
              idNumber: memberData?.idNumber || "",
              idDocumentUrl: memberData?.idDocumentUrl || null,
            },
            contactDetails: memberData?.contactDetails || [],
            addressDetails: {
              streetAddress: memberData?.addressDetails?.streetAddress || "",
              city: memberData?.addressDetails?.city || "",
              stateProvince: memberData?.addressDetails?.stateProvince || "",
              postalCode: memberData?.addressDetails?.postalCode || "",
              country: memberData?.addressDetails?.country || "",
            },
            contractNumber: contractData.contractNumber,
            contractId: contractDoc.id
          },
          beneficiaries: beneficiariesData.map(ben => ({
            personalInfo: {
              title: ben.title || "",
              firstName: ben.firstName || "",
              lastName: ben.lastName || "",
              initials: ben.initials || "",
              dateOfBirth: ben.dateOfBirth?.toDate() || null,
              gender: ben.gender || "",
              relationshipToMainMember: ben.relationshipToMainMember || "",
              nationality: ben.nationality || "",
              idType: ben.idType || "South African ID",
              idNumber: ben.idNumber || "",
              beneficiaryPercentage: ben.beneficiaryPercentage || 0,
              idDocumentUrl: ben.idDocumentUrl || null,
            },
            contactDetails: ben.contactDetails || [],
            addressDetails: {
              streetAddress: ben.addressDetails?.streetAddress || "",
              city: ben.addressDetails?.city || "",
              stateProvince: ben.addressDetails?.stateProvince || "",
              postalCode: ben.addressDetails?.postalCode || "",
              country: ben.addressDetails?.country || "",
            }
          })),
          dependents: dependentsData.map(dep => ({
            personalInfo: {
              firstName: dep.firstName || "",
              lastName: dep.lastName || "",
              initials: dep.initials || "",
              dateOfBirth: dep.dateOfBirth?.toDate() || null,
              gender: dep.gender || "",
              relationshipToMainMember: dep.relationshipToMainMember || "",
              nationality: dep.nationality || "",
              idType: dep.idType || "South African ID",
              idNumber: dep.idNumber || "",
              dependentStatus: dep.dependentStatus || "Active",
              medicalAidNumber: dep.medicalAidNumber,
              employer: dep.employer,
              school: dep.school,
              idDocumentUrl: dep.idDocumentUrl || null,
            },
            contactDetails: dep.contactDetails || [],
            addressDetails: {
              streetAddress: dep.addressDetails?.streetAddress || "",
              city: dep.addressDetails?.city || "",
              stateProvince: dep.addressDetails?.stateProvince || "",
              postalCode: dep.addressDetails?.postalCode || "",
              country: dep.addressDetails?.country || "",
            }
          })),
          policiesDetails: {
            policiesId: policiesData?.id || "",
            name: policiesData?.name || "",
            coverAmount: policiesData?.coverAmount || "",
            premium: policiesData?.premium || null,
            description: policiesData?.description || "",
            features: policiesData?.features || [],
            maxDependents: policiesData?.maxDependents || 0,
            status: policiesData?.status || "",
            isSelected: false
          },
          cateringOptions: cateringOptionsData,
          status: contractData.status
        }

        setContractData(fullContractData)
      } catch (error) {
        console.error('Error fetching contract details:', error)
        setError('Failed to load contract details')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchContractDetails()
    }
  }, [id])

  if (loading) {
    return (
      <div className="p-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Contracts
        </Button>
        <Card>
          <div className="p-6 space-y-6">
            <Skeleton className="h-4 w-[250px]" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[300px]" />
              <Skeleton className="h-4 w-[250px]" />
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (error || !contractData) {
    return (
      <div className="p-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Contracts
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error || 'Contract not found'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-4">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Contracts
      </Button>
      <ContractSummary 
        data={contractData as any} 
        onEdit={(tab: string) => {}} 
        isLoading={loading}
        error={error}
      />
    </div>
  )
} 