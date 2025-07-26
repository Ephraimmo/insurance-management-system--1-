"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertCircle, Search, ArrowLeft } from "lucide-react"
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { AddContract } from "@/components/AddContract"
import { toast } from "@/components/ui/use-toast"
import type { ContractData } from "@/components/AddContract"
import { DependentData } from "@/types/dependent"

interface AmendContractProps {
  userRole?: string
}

export function AmendContract({ userRole }: AmendContractProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [contractData, setContractData] = useState<ContractData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState(false)
  const [isUpdatingCatering, setIsUpdatingCatering] = useState(false)

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

      // Update contract status to "Amend"
      await updateDoc(doc(db, 'Contracts', contractDoc.id), {
        status: 'Amend',
        lastModifiedBy: userRole || 'Admin',
        lastModifiedAt: new Date()
      })

      // Get policies details with full information
      const policiesRef = doc(db, 'Policies', contractData.policiesId)
      const policiesDoc = await getDoc(policiesRef)
      const policiesData = policiesDoc.exists() ? policiesDoc.data() : null

      // Get all available policies to ensure proper selection
      const allPoliciesRef = collection(db, 'Policies')
      const allPoliciesSnapshot = await getDocs(allPoliciesRef)
      const allPolicies = allPoliciesSnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          name: data.name || '',
          coverAmount: data.coverAmount || '',
          premium: data.premium || 0,
          description: data.description || '',
          features: data.features || [],
          maxDependents: data.maxDependents || 0,
          status: data.status || 'Active',
          isSelected: doc.id === contractData.policiesId
        }
      })
    
      // Get all available catering options and mark selected ones
      const allCateringRef = collection(db, 'catering')
      const allCateringSnapshot = await getDocs(allCateringRef)
      const allCateringOptions = allCateringSnapshot.docs.map(doc => {
        const isSelected = Array.isArray(contractData.cateringOptionIds) && contractData.cateringOptionIds.includes(doc.id)
        return {
          id: doc.id,
          name: doc.data().name || '',
          price: doc.data().price || 0,
          description: doc.data().description || '',
          isLinked: doc.data().isLinked || false,
          isSelected: isSelected
        }
      })

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
        beneficiaries: validMembers
          .filter(m => m?.role === 'Beneficiary')
          .map(m => {
            const data = m!.data;
            // Ensure required beneficiary fields are present
            return {
              ...data,
              personalInfo: {
                ...data.personalInfo,
                relationshipToMainMember: data.personalInfo.relationshipToMainMember || '',
                beneficiaryPercentage: data.personalInfo.beneficiaryPercentage || 0,
                title: data.personalInfo.title || '',
                firstName: data.personalInfo.firstName || '',
                lastName: data.personalInfo.lastName || '',
                initials: data.personalInfo.initials || '',
                dateOfBirth: data.personalInfo.dateOfBirth || null,
                gender: data.personalInfo.gender || '',
                nationality: data.personalInfo.nationality || '',
                idType: data.personalInfo.idType || 'South African ID',
                idNumber: data.personalInfo.idNumber || '',
                idDocumentUrl: data.personalInfo.idDocumentUrl || null
              }
            };
          }) || [],
        dependents: validMembers
          .filter(m => m?.role === 'Dependent')
          .map(m => m!.data) as DependentData[] || [],
        policiesDetails: {
          policiesId: contractData.policiesId || '',
          name: policiesData?.name || '',
          coverAmount: policiesData?.coverAmount || '',
          premium: policiesData?.premium || null,
          description: policiesData?.description || '',
          features: policiesData?.features || [],
          maxDependents: policiesData?.maxDependents || 0,
          status: policiesData?.status || 'Active',
          isSelected: true,
          allPolicies: allPolicies
        },
        cateringOptions: allCateringOptions.filter(option => option.isSelected).map(option => ({
          id: option.id,
          name: option.name,
          price: option.price
        })),
        status: contractData.status || 'Active'
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

  // Add new function to update contract policy
  const updateContractPolicy = async (contractNumber: string, newPolicyId: string) => {
    
    setIsUpdatingPolicy(true)
    try {
      // Search for the contract
      const contractsRef = collection(db, 'Contracts')
      const q = query(contractsRef, where('contractNumber', '==', contractNumber))
      const contractSnapshot = await getDocs(q)

      if (contractSnapshot.empty) {
        throw new Error("Contract not found")
      }

      const contractDoc = contractSnapshot.docs[0]
      
      // Update the contract with the new policy ID
      await updateDoc(doc(db, 'Contracts', contractDoc.id), {
        policiesId: newPolicyId,
        updatedAt: new Date()
      })

      // Get the new policy details
      const policiesRef = doc(db, 'Policies', newPolicyId)
      const policiesDoc = await getDoc(policiesRef)
      const policiesData = policiesDoc.exists() ? policiesDoc.data() : null

      // Update local state with new policy details
      if (contractData && policiesData) {
        setContractData({
          ...contractData,
          policiesDetails: {
            ...contractData.policiesDetails,
            policiesId: newPolicyId,
            name: policiesData.name || '',
            coverAmount: policiesData.coverAmount || '',
            premium: policiesData.premium || null,
            description: policiesData.description || '',
            features: policiesData.features || [],
            maxDependents: policiesData.maxDependents || 0,
            status: policiesData.status || 'Active',
            isSelected: true
          }
        })
      }

      toast({
        title: "Success",
        description: "Contract policy has been updated successfully",
      })
    } catch (error) {
      console.error('Error updating contract policy:', error)
      toast({
        title: "Error",
        description: "Failed to update contract policy. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsUpdatingPolicy(false)
    }
  }

  // Add new function to update contract catering options
  const updateContractCatering = async (contractNumber: string, cateringId: string, isSelected: boolean) => {
    setIsUpdatingCatering(true)
    try {
      // Find the contract document
      const contractsRef = collection(db, 'Contracts')
      const q = query(contractsRef, where('contractNumber', '==', contractNumber))
      const contractSnapshot = await getDocs(q)

      if (contractSnapshot.empty) {
        toast({
          title: "Error",
          description: "Contract not found",
          variant: "destructive"
        })
        return
      }

      const contractDoc = contractSnapshot.docs[0]
      const currentData = contractDoc.data()
      
      // Get current catering options array or initialize if doesn't exist
      let cateringOptionIds = currentData.cateringOptionIds || []

      if (isSelected) {
        // Add the option if it's not already there
        if (!cateringOptionIds.includes(cateringId)) {
          cateringOptionIds.push(cateringId)
        }
      } else {
        // Remove the option
        cateringOptionIds = cateringOptionIds.filter((id: string) => id !== cateringId)
      }

      // Update the contract document
      await updateDoc(doc(db, 'Contracts', contractDoc.id), {
        cateringOptionIds,
        updatedAt: Timestamp.now()
      })

      // Get the catering option details
      const cateringRef = doc(db, 'catering', cateringId)
      const cateringDoc = await getDoc(cateringRef)
      const cateringData = cateringDoc.exists() ? cateringDoc.data() : null

      // Update local state to reflect changes
      if (contractData && cateringData) {
        const updatedCateringOptions = [...contractData.cateringOptions]
        if (isSelected) {
          // Add the new option
          updatedCateringOptions.push({
            id: cateringId,
            name: cateringData.name || '',
            price: cateringData.price || 0
          })
        } else {
          // Remove the option from local state
          const index = updatedCateringOptions.findIndex(opt => opt.id === cateringId)
          if (index !== -1) {
            updatedCateringOptions.splice(index, 1)
          }
        }
        setContractData({
          ...contractData,
          cateringOptions: updatedCateringOptions
        })
      }

      toast({
        title: "Success",
        description: isSelected ? "Catering option added successfully" : "Catering option removed successfully"
      })

    } catch (error) {
      console.error('Error updating catering options:', error)
      toast({
        title: "Error",
        description: "Failed to update catering options",
        variant: "destructive"
      })
    } finally {
      setIsUpdatingCatering(false)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contract Amendment</h1>
          <p className="text-muted-foreground mt-2">
            Search and modify existing contracts by entering the contract number
          </p>
        </div>
        {contractData && (
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Search
          </Button>
        )}
      </div>

      {!contractData && (
        <Card className="max-w-2xl mx-auto border-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Search Contract</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter the contract number to load and modify contract details
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contract-number" className="text-sm font-medium">
                  Contract Number
                </Label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      id="contract-number"
                      placeholder="e.g., CNT-12345678"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSearch()
                        }
                      }}
                      className="h-10"
                    />
                  </div>
                  <Button 
                    onClick={handleSearch} 
                    disabled={isSearching}
                    className="min-w-[120px] h-10"
                  >
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

              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  Quick Tips
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Contract numbers typically start with 'CNT-' followed by 8 characters</li>
                  <li>The search is case-sensitive</li>
                  <li>Make sure to enter the complete contract number</li>
                </ul>
              </div>
            </div>
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
          onPolicyChange={(policyId: string) => {
            if (contractData.mainMember.contractNumber) {
              updateContractPolicy(contractData.mainMember.contractNumber, policyId)
            }
          }}
          onCateringChange={(cateringId: string, isSelected: boolean) => {
            console.log('Catering change triggered:', { cateringId, isSelected });
            if (!contractData.mainMember.contractNumber) {
              toast({
                title: "Error",
                description: "Contract number not found",
                variant: "destructive"
              });
              return;
            }
            
            toast({
              title: "Processing",
              description: `${isSelected ? 'Adding' : 'Removing'} catering option...`,
            });
            
            updateContractCatering(
              contractData.mainMember.contractNumber,
              cateringId,
              isSelected
            );
          }}
        />
      )}
    </div>
  )
} 