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
import { collection, getDocs, query, where, doc, getDoc, updateDoc, orderBy, limit } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { DocumentData } from 'firebase/firestore'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"

let cateringOptionsAmount = 0;
type MainMemberData = {
  personalInfo: {
    firstName: string
    lastName: string
    idNumber: string
    gender: string
    dateOfBirth: Date | null
  }
  contractNumber?: string
  contractId?: string
}

type BeneficiaryData = {
  id?: string
  personalInfo: {
    firstName: string
    lastName: string
    relationshipToMainMember: string
    idNumber: string
    beneficiaryPercentage: number
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

type DependentData = {
  id?: string
  personalInfo: {
    firstName: string
    lastName: string
    relationshipToMainMember: string
    dependentStatus: string
    idNumber: string
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

// Add type for Firestore data
type FirestoreMemberData = {
  firstName: string
  lastName: string
  idNumber: string
  dateOfBirth: string
  gender: string
  title: string
  initials: string
  language: string
  maritalStatus: string
  nationality: string
  idType: "South African ID" | "Passport"
  idDocumentUrl: string | null
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
        const policiesRef = query(
          collection(db, 'Policies'),
          where('id', '==', contractData.policiesId)
        )
        const policiesDoc = await getDocs(policiesRef)
        cateringOptionsAmount = 0;
        if (policiesDoc.empty) {
          throw new Error('policies not found')
        }
        const policiesData = policiesDoc.docs[0].data()
        
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
      
        // Get the main member details
        const membersQuery = query(
          collection(db, 'Members'),
          where('idNumber', '==', contractData.memberIdNumber)
        )
        const memberSnapshot = await getDocs(membersQuery)
        const memberDoc = memberSnapshot.docs[0]
        if (!memberDoc) {
          throw new Error('Member not found')
        }
        const memberData = memberDoc.data() as FirestoreMemberData

        // Get beneficiaries
        const beneficiariesQuery = query(
          collection(db, 'Beneficiaries'),
          where('contractNumber', '==', contractData.contractNumber)
        )
        const beneficiariesSnapshot = await getDocs(beneficiariesQuery)
        const beneficiariesData = beneficiariesSnapshot.docs.map(doc => ({
          id: doc.id,
          personalInfo: {
            firstName: doc.data().firstName,
            lastName: doc.data().lastName,
            relationshipToMainMember: doc.data().relationshipToMainMember,
            idNumber: doc.data().idNumber,
            beneficiaryPercentage: doc.data().beneficiaryPercentage
          }
        }))

        // Get dependents
        const dependentsQuery = query(
          collection(db, 'Dependents'),
          where('contractNumber', '==', contractData.contractNumber)
        )
        const dependentsSnapshot = await getDocs(dependentsQuery)
        const dependentsData = dependentsSnapshot.docs.map(doc => ({
          id: doc.id,
          personalInfo: {
            firstName: doc.data().firstName,
            lastName: doc.data().lastName,
            relationshipToMainMember: doc.data().relationshipToMainMember,
            dependentStatus: doc.data().dependentStatus,
            idNumber: doc.data().idNumber
          }
        }))

        // Construct full contract data with all required fields
        const fullContractData: ContractData = {
          mainMember: {
            personalInfo: {
              firstName: memberData.firstName,
              lastName: memberData.lastName,
              idNumber: memberData.idNumber,
              gender: memberData.gender,
              dateOfBirth: null
            },
            contractNumber: contractData.contractNumber,
            contractId: contractDoc.id
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
        setFetchError(error instanceof Error ? error.message : 'Failed to load contract data. Please try again.')
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

  const totalCateringCost = (contractData?.cateringOptions || []).reduce(
    (total: number, option) => total + option.price,
    0
  )
  const totalCost = (contractData?.policiesDetails.premium || 0) + totalCateringCost

  const totalBeneficiaryPercentage = (contractData?.beneficiaries || []).reduce(
    (sum, beneficiary) => {
      const percentage = beneficiary?.personalInfo?.beneficiaryPercentage || 0
      return sum + percentage
    },
    0
  )

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
              <CardTitle className="flex justify-between items-center">
                policies Details
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => onEdit("policies")}>
                        Edit
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit policies details</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
              <CardTitle className="flex justify-between items-center">
                Main Member Details
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => onEdit("main-member")}>
                        Edit
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit main member details</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
        </CardHeader>
        <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>ID Number</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Actions</TableHead>
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
                      <Button variant="outline" size="sm" onClick={() => onEdit("main-member")}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => onEdit("beneficiaries")}>
                          Add
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add beneficiary</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardTitle>
        </CardHeader>
        <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>ID Number</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Actions</TableHead>
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
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => onEdit(`beneficiary-${index}`)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="dependents">
      <Card>
        <CardHeader>
              <CardTitle className="flex justify-between items-center">
                Dependent Details
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => onEdit("dependents")}>
                        Add
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add dependent</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                    <TableHead>Actions</TableHead>
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
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => onEdit(`dependent-${index}`)}>
                          Edit
                        </Button>
                      </TableCell>
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
    </div>
  )
}

