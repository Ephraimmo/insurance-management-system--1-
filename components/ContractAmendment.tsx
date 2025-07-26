"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertCircle, Search, ArrowLeft } from "lucide-react"
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { AddContract } from "@/components/AddContract"
import { toast } from "@/components/ui/use-toast"
import type { ContractData } from "@/components/AddContract"

interface ContractAmendmentProps {
  userRole?: string
}

export function ContractAmendment({ userRole }: ContractAmendmentProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [contractData, setContractData] = useState<ContractData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check if user has permission to access this page
  if (!userRole || userRole === 'View Only') {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to access this page. Please contact your administrator for access.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a contract number")
      return
    }

    setIsSearching(true)
    setError(null)
    setContractData(null)

    try {
      // Search for the contract
      const contractsRef = collection(db, 'Contracts')
      const q = query(contractsRef, where('contractNumber', '==', searchQuery.trim()))
      const contractSnapshot = await getDocs(q)

      if (contractSnapshot.empty) {
        setError("Contract not found")
        return
      }

      const contractDoc = contractSnapshot.docs[0]
      const contractData = contractDoc.data()

      // Get policies details first
      const policiesRef = doc(db, 'policies', contractData.policiesId)
      const policiesDoc = await getDoc(policiesRef)
      const policiesData = policiesDoc.exists() ? policiesDoc.data() : null

      // Get all member relationships for this contract
      const relationshipsRef = collection(db, 'member_contract_relationships')
      const relationshipsQuery = query(
        relationshipsRef,
        where('contract_number', '==', contractData.contractNumber)
      )
      const relationshipsSnapshot = await getDocs(relationshipsQuery)

      const memberPromises = relationshipsSnapshot.docs.map(async (relationshipDoc) => {
        const relationshipData = relationshipDoc.data()
        const memberDoc = await getDoc(doc(db, 'Members', relationshipData.member_id))
        
        if (!memberDoc.exists()) return null

        const memberData = memberDoc.data()

        // Get contact details
        const contactsRef = collection(db, 'Contacts')
        const contactsQuery = query(contactsRef, where('memberId', '==', relationshipData.member_id))
        const contactsSnapshot = await getDocs(contactsQuery)
        const contactDetails = contactsSnapshot.docs.map(doc => ({
          type: doc.data().type as "Email" | "Phone Number",
          value: doc.data().value
        }))

        // Get address details
        const addressRef = collection(db, 'Address')
        const addressQuery = query(addressRef, where('memberId', '==', relationshipData.member_id))
        const addressSnapshot = await getDocs(addressQuery)
        const addressDetails = !addressSnapshot.empty ? {
          streetAddress: addressSnapshot.docs[0].data().streetAddress || '',
          city: addressSnapshot.docs[0].data().city || '',
          stateProvince: addressSnapshot.docs[0].data().stateProvince || '',
          postalCode: addressSnapshot.docs[0].data().postalCode || '',
          country: addressSnapshot.docs[0].data().country || ''
        } : {
          streetAddress: '',
          city: '',
          stateProvince: '',
          postalCode: '',
          country: ''
        }

        return {
          role: relationshipData.role,
          data: {
            personalInfo: {
              title: memberData.title || '',
              firstName: memberData.firstName || '',
              lastName: memberData.lastName || '',
              initials: memberData.initials || '',
              dateOfBirth: memberData.dateOfBirth ? new Date(memberData.dateOfBirth.seconds * 1000) : null,
              gender: memberData.gender || '',
              language: memberData.language || '',
              maritalStatus: memberData.maritalStatus || '',
              nationality: memberData.nationality || '',
              idType: memberData.idType || "South African ID",
              idNumber: memberData.idNumber || '',
              idDocumentUrl: memberData.idDocumentUrl || null,
              ...(relationshipData.role === 'Beneficiary' && {
                relationshipToMainMember: memberData.relationshipToMainMember || '',
                beneficiaryPercentage: memberData.beneficiaryPercentage || 0
              }),
              ...(relationshipData.role === 'Dependent' && {
                relationshipToMainMember: memberData.relationshipToMainMember || '',
                dependentStatus: memberData.dependentStatus || 'Active',
                medicalAidNumber: memberData.medicalAidNumber || '',
                employer: memberData.employer || '',
                school: memberData.school || ''
              })
            },
            contactDetails,
            addressDetails,
            ...(relationshipData.role === 'Main Member' && {
              contractNumber: contractData.contractNumber,
              contractId: contractDoc.id
            })
          }
        }
      })

      const memberResults = await Promise.all(memberPromises)
      const validMembers = memberResults.filter(result => result !== null)

      // Get catering options details
      const cateringOptionsPromises = contractData.cateringOptionIds?.map(async (id: string) => {
        const cateringRef = doc(db, 'catering_options', id)
        const cateringDoc = await getDoc(cateringRef)
        if (cateringDoc.exists()) {
          const data = cateringDoc.data()
          return {
            id,
            name: data.name || '',
            price: data.price || 0
          }
        }
        return null
      }) || []

      const cateringResults = await Promise.all(cateringOptionsPromises)
      const validCateringOptions = cateringResults.filter(result => result !== null)

      // Structure the data for AddContract component
      const structuredData: ContractData = {
        mainMember: validMembers.find(m => m?.role === 'Main Member')?.data || {
          personalInfo: {
            title: '',
            firstName: '',
            lastName: '',
            initials: '',
            dateOfBirth: null,
            gender: '',
            language: '',
            maritalStatus: '',
            nationality: '',
            idType: "South African ID",
            idNumber: '',
            idDocumentUrl: null
          },
          contactDetails: [],
          addressDetails: {
            streetAddress: '',
            city: '',
            stateProvince: '',
            postalCode: '',
            country: ''
          }
        },
        beneficiaries: (validMembers
          .filter(m => m?.role === 'Beneficiary')
          .map(m => ({
            ...m!.data,
            personalInfo: {
              ...m!.data.personalInfo,
              relationshipToMainMember: m!.data.personalInfo.relationshipToMainMember || '',
              beneficiaryPercentage: m!.data.personalInfo.beneficiaryPercentage || 0
            }
          })) || []),
        dependents: (validMembers
          .filter(m => m?.role === 'Dependent')
          .map(m => ({
            ...m!.data,
            personalInfo: {
              ...m!.data.personalInfo,
              relationshipToMainMember: m!.data.personalInfo.relationshipToMainMember || '',
              dependentStatus: m!.data.personalInfo.dependentStatus || 'Active'
            }
          })) || []),
        policiesDetails: {
          policiesId: contractData.policiesId || '',
          name: policiesData?.Name || '',
          coverAmount: policiesData?.Price?.toString() || '',
          premium: policiesData?.Price || null,
          description: policiesData?.description || '',
          features: policiesData?.features || [],
          maxDependents: policiesData?.maxDependents || 0,
          status: policiesData?.status || 'Active',
          isSelected: true,
          allPolicies: []
        },
        cateringOptions: validCateringOptions as Array<{
          id: string
          name: string
          price: number
        }>
      }

      setContractData(structuredData)
    } catch (error) {
      console.error('Error searching contract:', error)
      setError("Failed to search contract. Please try again.")
    } finally {
      setIsSearching(false)
    }
  }

  const handleReset = () => {
    setContractData(null)
    setSearchQuery("")
    setError(null)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Contract Amendment</h1>
        {contractData && (
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Search
          </Button>
        )}
      </div>

      {!contractData && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Search Contract</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="contract-number">Contract Number</Label>
                <Input
                  id="contract-number"
                  placeholder="Enter contract number"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch()
                    }
                  }}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </>
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {contractData && (
        <AddContract 
          isAmendment={true}
          existingContract={contractData}
          userRole={userRole}
          onSuccess={() => {
            setContractData(null)
            setSearchQuery("")
            toast({
              title: "Success",
              description: "Contract has been updated successfully",
            })
          }}
        />
      )}
    </div>
  )
} 