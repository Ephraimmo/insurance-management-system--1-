"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { ContractSummary } from "@/components/contract/ContractSummary"
import { ArrowLeft, Search, Loader2, FileText } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

type Contract = {
  id: string
  contractNumber: string
  mainMemberName: string
  mainMemberIdNumber: string
  policies: string
  status: string
}

type ContractData = {
  mainMember: {
    personalInfo: any
    contactDetails: Array<{
      type: "Email" | "Phone Number"
      value: string
    }>
    addressDetails: any
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
  dependents: any[]
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

// This will be our default state while data is loading
const mockContracts: Contract[] = []

interface SearchContractProps {
  userRole?: string
}

export function SearchContract({ userRole }: SearchContractProps) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [policiess, setpoliciess] = useState<Array<{ id: string, name: string }>>([])
  const [searchParams, setSearchParams] = useState({
    contractNumber: "",
    mainMemberIdNumber: "",
    policies: "all",
    status: "all",
  })
  const [selectedContract, setSelectedContract] = useState<ContractData | null>(null)
  const [loadingContract, setLoadingContract] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)

  // Add new function to fetch policiess
  const fetchpoliciess = async () => {
    try {
      const policiessCollection = collection(db, 'policies Database')
      const policiessSnapshot = await getDocs(policiessCollection)
      const policiessData = policiessSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().Name || 'Unnamed policies'
      }))
      setpoliciess(policiessData)
    } catch (error) {
      console.error('Error fetching policiess:', error)
    }
  }

  useEffect(() => {
    // Call fetchpoliciess when component mounts
    fetchpoliciess()
  }, [])

  useEffect(() => {
    const fetchContracts = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Get all contracts from Firestore
        const contractsQuery = query(collection(db, 'Contracts'))
        const contractsSnapshot = await getDocs(contractsQuery)
        
        // Array to store our processed contracts
        const fetchedContracts: Contract[] = []
      
        // Process each contract document
        for (const doc of contractsSnapshot.docs) {
          const contractData = doc.data()
          
          // Get the main member details for this contract
          const membersQuery = query(
            collection(db, 'Members'),
            where('idNumber', '==', contractData.memberIdNumber)
          )
          
          const memberSnapshot = await getDocs(membersQuery)
          const memberData = memberSnapshot.docs[0]?.data()
          
          // Get the policies details
          const policiessQuery = query(
            collection(db, 'Policies'),
            where('id', '==', contractData.policiesId)
          )
          const policiesSnapshot = await getDocs(policiessQuery)
          const policiesData = policiesSnapshot.docs[0]?.data()
          
          // Construct the contract object
          fetchedContracts.push({
            id: doc.id,
            contractNumber: contractData.contractNumber || 'N/A',
            mainMemberName: memberData ? `${memberData.firstName} ${memberData.lastName}` : 'Unknown',
            mainMemberIdNumber: contractData.memberIdNumber || 'N/A',
            policies: policiesData?.name || 'Unknown policies',
            status: contractData.status || 'unknown'
          })
          
        }
        
        // Update the state with fetched contracts
        setContracts(fetchedContracts)
        setFilteredContracts(fetchedContracts)
      } catch (error) {
        console.error('Error fetching contracts:', error)
        setError('Failed to load contracts. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    // Call the fetch function
    fetchContracts()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setSearchParams((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setSearchParams((prev) => ({ ...prev, [name]: value }))
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearchLoading(true)
    
    // Filter contracts based on search parameters
    const filtered = contracts.filter((contract) => {
      const matchContractNumber = searchParams.contractNumber === "" ||
        contract.contractNumber.toLowerCase().includes(searchParams.contractNumber.toLowerCase())
      
      const matchIdNumber = searchParams.mainMemberIdNumber === "" ||
        contract.mainMemberIdNumber.includes(searchParams.mainMemberIdNumber)
      
      const matchpolicies = searchParams.policies === "all" ||
        contract.policies.toLowerCase() === searchParams.policies.toLowerCase()
      
      const matchStatus = searchParams.status === "all" ||
        contract.status.toLowerCase() === searchParams.status.toLowerCase()

      return matchContractNumber && matchIdNumber && matchpolicies && matchStatus
    })

    // Simulate progress for better UX
    setLoadingProgress(30)
    await new Promise(resolve => setTimeout(resolve, 300))
    setLoadingProgress(60)
    await new Promise(resolve => setTimeout(resolve, 200))
    setLoadingProgress(100)
    await new Promise(resolve => setTimeout(resolve, 200))

    setFilteredContracts(filtered)
    setSearchLoading(false)
    setLoadingProgress(0)
  }

  // Add function to fetch contract details
  const fetchContractDetails = async (contractId: string) => {
    try {
      setLoadingContract(true)
      setError(null)
      setLoadingProgress(0)

      // Get contract details
      setLoadingProgress(10)
      const contractRef = doc(db, 'Contracts', contractId)
      const contractDoc = await getDoc(contractRef)
      
      if (!contractDoc.exists()) {
        setError('Contract not found')
        return
      }

      const contractData = contractDoc.data()
      setLoadingProgress(20)

      // Get main member details
      setLoadingProgress(30)
      const membersQuery = query(
        collection(db, 'Members'),
        where('idNumber', '==', contractData.memberIdNumber)
      )
      const memberSnapshot = await getDocs(membersQuery)
      const memberData = memberSnapshot.docs[0]?.data()
      setLoadingProgress(40)

      // Get policies details
      setLoadingProgress(50)
      const policiesRef = doc(db, 'Policies', contractData.policiesId)
      const policiesDoc = await getDoc(policiesRef)
      const policiesData = policiesDoc.data()
      setLoadingProgress(60)

      // Get beneficiaries
      setLoadingProgress(70)
      const beneficiariesQuery = query(
        collection(db, 'Beneficiaries'),
        where('contractNumber', '==', contractData.contractNumber)
      )
      const beneficiariesSnapshot = await getDocs(beneficiariesQuery)
      const beneficiariesData = beneficiariesSnapshot.docs.map(doc => doc.data())
      setLoadingProgress(80)

      // Get dependents
      setLoadingProgress(85)
      const dependentsQuery = query(
        collection(db, 'Dependents'),
        where('contractNumber', '==', contractData.contractNumber)
      )
      const dependentsSnapshot = await getDocs(dependentsQuery)
      const dependentsData = dependentsSnapshot.docs.map(doc => doc.data())
      setLoadingProgress(90)

      // Get catering options
      setLoadingProgress(95)
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
          personalInfo: memberData,
          contactDetails: [],
          addressDetails: {},
          contractNumber: contractData.contractNumber,
          contractId: contractDoc.id
        },
        beneficiaries: beneficiariesData.map((beneficiary) => ({
          personalInfo: beneficiary.personalInfo,
          contactDetails: beneficiary.contactDetails,
          addressDetails: beneficiary.addressDetails
        })),
        dependents: dependentsData,
        policiesDetails: {
          policiesId: contractData.policiesId,
          name: policiesData?.Name || 'Unknown policies',
          coverAmount: policiesData?.Price?.toString() || '0',
          premium: policiesData?.Price || null
        },
        cateringOptions: cateringOptionsData,
        status: contractData.status
      }

      setLoadingProgress(100)
      await new Promise(resolve => setTimeout(resolve, 200)) // Let user see 100%
      setSelectedContract(fullContractData)
    } catch (error) {
      console.error('Error fetching contract details:', error)
      setError('Failed to load contract details. Please try again.')
    } finally {
      setLoadingContract(false)
      setLoadingProgress(0)
    }
  }

  // Modify loading overlay
  if (loadingContract) {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-300" />
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <Card className="mx-auto w-[90%] max-w-md p-6 shadow-lg transition-all duration-300 ease-out">
            <CardContent className="flex flex-col items-center justify-center space-y-6">
              <div className="relative w-full">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Loading progress</span>
                  <span className="text-primary font-medium">{loadingProgress}%</span>
                </div>
                <Progress value={loadingProgress} className="h-2" />
                <div className="mt-4 flex justify-center">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FileText className="h-8 w-8 text-primary animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center space-y-2">
                <CardTitle>Loading Contract Details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {loadingProgress < 20 ? "Fetching contract information..." :
                   loadingProgress < 40 ? "Loading member details..." :
                   loadingProgress < 60 ? "Retrieving policies information..." :
                   loadingProgress < 80 ? "Loading beneficiaries..." :
                   loadingProgress < 90 ? "Loading dependents..." :
                   loadingProgress < 100 ? "Getting catering options..." :
                   "Finalizing..."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i}>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-10 w-24" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-6" />
                ))}
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <Skeleton key={j} className="h-10" />
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Error Loading Contracts</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="ml-4"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </Card>
    )
  }

  if (selectedContract) {
    return (
      <div className="container mx-auto py-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setSelectedContract(null)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Search
            </Button>
            <h1 className="text-2xl font-bold">Contract Details</h1>
          </div>
        </div>

        <Card className="p-6">
          <ContractSummary
            data={selectedContract}
            onEdit={() => {}}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Search Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contractNumber">Contract Number</Label>
                <Input
                  id="contractNumber"
                  name="contractNumber"
                  value={searchParams.contractNumber}
                  onChange={handleInputChange}
                  placeholder="Enter contract number"
                />
              </div>
              <div>
                <Label htmlFor="mainMemberIdNumber">Main Member ID Number</Label>
                <Input
                  id="mainMemberIdNumber"
                  name="mainMemberIdNumber"
                  value={searchParams.mainMemberIdNumber}
                  onChange={handleInputChange}
                  placeholder="Enter ID number"
                />
              </div>
              <div>
                <Label htmlFor="policies">policies</Label>
                <Select
                  name="policies"
                  value={searchParams.policies}
                  onValueChange={(value) => handleSelectChange("policies", value)}
                >
                  <SelectTrigger id="policies">
                    <SelectValue placeholder="Select policies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {policiess.map((policies) => (
                      <SelectItem key={policies.id} value={policies.name}>
                        {policies.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  name="status"
                  value={searchParams.status}
                  onValueChange={(value) => handleSelectChange("status", value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in-force">In Force</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                id="Search"
                type="submit" 
                disabled={searchLoading}
                className="relative"
              >
                {searchLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
              {searchLoading && (
                <Progress value={loadingProgress} className="flex-1 h-2" />
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search Results</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract Number</TableHead>
                <TableHead>Main Member Name</TableHead>
                <TableHead>Main Member ID Number</TableHead>
                <TableHead>policies</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No contracts found matching your search criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredContracts.map((contract) => (
                  <TableRow 
                    key={contract.contractNumber}
                    className="cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => fetchContractDetails(contract.id)}
                  >
                    <TableCell className="text-blue-600 hover:text-blue-800 font-medium">
                      {contract.contractNumber}
                    </TableCell>
                    <TableCell>{contract.mainMemberName}</TableCell>
                    <TableCell>{contract.mainMemberIdNumber}</TableCell>
                    <TableCell>{contract.policies}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${contract.status === 'in-force' ? 'bg-green-100 text-green-800' : 
                          contract.status === 'new' ? 'bg-blue-100 text-blue-800' : 
                          'bg-gray-100 text-gray-800'}`}>
                        {contract.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

