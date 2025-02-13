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
  }
  cateringOptions: Array<{
    id: string
    name: string
    price: number
  }>
  status?: string
}

export default function ContractDetailsPage({ params }: { params: { id: string } }) {
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
        const contractRef = doc(db, 'Contracts', params.id)
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
            policiesId: contractData.policiesId,
            name: policiesData?.Name || 'Unknown Plan',
            coverAmount: policiesData?.Price?.toString() || '0',
            premium: policiesData?.Price || null
          },
          cateringOptions: cateringOptionsData,
          status: contractData.status
        }

        setContractData(fullContractData)
      } catch (error) {
        console.error('Error fetching contract details:', error)
        setError('Failed to load contract details. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchContractDetails()
    }
  }, [params.id])

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-8">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    )
  }

  if (!contractData) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>Contract not found</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold">Contract Details</h1>
        </div>
      </div>

      <Card className="p-6">
        <ContractSummary
          data={contractData}
          onEdit={() => {}}
        />
      </Card>
    </div>
  )
} 